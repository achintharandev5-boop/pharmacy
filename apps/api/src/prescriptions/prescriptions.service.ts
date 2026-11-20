import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseService } from '../supabase/supabase.service';
import { toHttpError, unwrap, unwrapList, unwrapRequired } from '../common/db';
import { zonedDate } from '../common/time';
import { CreatePrescriptionDto, CreatePrescriptionItemDto, LogSmsDto } from './dto/create-prescription.dto';
import { generatePrescriptionNumber, normalizeSriLankanPhone } from '../domain/prescription/prescription.rules';
import { validateInstructionCombinations } from '../domain/prescription/instruction.rules';
import { formatDosageReadable } from '../domain/prescription/dosage.rules';
import { isKnownExpired, parseLabelExpiry } from '../domain/prescription/expiry.rules';
import { isDispensableBatch } from '../inventory/inventory.service';
import type { PrescriptionWriteMode } from '../config/env.validation';

interface ProductRow {
  id: string;
  name: string;
  stock_quantity: number | null;
  expiry_date: string | null;
  is_active?: boolean | null;
}

interface StockChange {
  productId: string;
  before: number;
  after: number;
}

export interface PrescriptionCreated {
  id: string;
  prescriptionNumber: string;
  status: string;
  customerName: string;
  customerPhone: string | null;
  itemCount: number;
  createdAt: string;
  /** Transactional mode only: the batches each label was dispensed from. */
  items?: { itemId: string; productId: string | null; allocations: BatchAllocation[] }[];
}

export interface BatchAllocation {
  batchId: string | null;
  batchNumber: string | null;
  expiryDate: string | null;
  quantity: number;
}

interface ExpiryBatchRow {
  id: string;
  product_id: string;
  batch_number: string;
  expiry_date: string | null;
  quantity_available: number | null;
  status: string | null;
  received_at: string | null;
}

/** Batch statuses whose units are never dispensed. */
const NON_DISPENSABLE_STATUSES = new Set(['QUARANTINED', 'EXPIRED']);

const MAX_NUMBER_ATTEMPTS = 3;
const MAX_STOCK_ATTEMPTS = 3;
const PENDING = { status: 'PENDING' };

/**
 * Creates prescriptions and records dispensing.
 *
 * A prescription is reported as saved only after every write (header, items, stock, movement
 * audit, event) has been confirmed by the database. If any step fails, the steps already done
 * are reversed and the request fails. The reversal is best effort; if it also fails the error
 * says so and the incident is logged with the record id for manual reconciliation.
 *
 * Two write paths, chosen by PRESCRIPTION_WRITE_MODE:
 *   legacy (default)  the steps above. Deducts the product total only, but refuses units that
 *                     sit in expired, quarantined or undated batches.
 *   transactional     the `create_prescription` database function (migration 000500): one
 *                     transaction, earliest-expiry-first deduction from eligible batches.
 *                     Not to be enabled until the pharmacist approves the allocation rules.
 * Both paths run the same request validation and build the same item rows, so the stored
 * instructions and label text are identical.
 */
@Injectable()
export class PrescriptionsService {
  private readonly logger = new Logger(PrescriptionsService.name);
  private readonly timeZone: string;
  readonly writeMode: PrescriptionWriteMode;

  constructor(
    private readonly supabaseService: SupabaseService,
    config: ConfigService,
  ) {
    this.timeZone = config.get<string>('PHARMACY_TIMEZONE') ?? 'Asia/Colombo';
    // Anything other than an explicit 'transactional' keeps the existing behaviour.
    this.writeMode = config.get<string>('PRESCRIPTION_WRITE_MODE') === 'transactional' ? 'transactional' : 'legacy';
  }

  private get db() {
    return this.supabaseService.getClient();
  }

  async create(dto: CreatePrescriptionDto, idempotencyKey: string | undefined, userId: string | null) {
    if (idempotencyKey !== undefined && !/^[\w.:-]{8,200}$/.test(idempotencyKey)) {
      throw new BadRequestException({ code: 'INVALID_IDEMPOTENCY_KEY', message: 'Idempotency-Key header is invalid.' });
    }

    if (this.writeMode === 'transactional') {
      // The database function handles the key itself, inside the same transaction.
      return this.createTransactional(dto, idempotencyKey, userId);
    }

    if (idempotencyKey) {
      const replay = await this.claimIdempotencyKey(idempotencyKey);
      if (replay) return replay;
    }

    try {
      const result = await this.createUnchecked(dto, userId);
      if (idempotencyKey) {
        unwrap(
          await this.db.from('idempotency_keys').update({ response_payload: result }).eq('key', idempotencyKey),
          'record the idempotency key',
        );
      }
      return result;
    } catch (err) {
      if (idempotencyKey) {
        // Release the key so the client can retry with it.
        const { error } = await this.db.from('idempotency_keys').delete().eq('key', idempotencyKey);
        if (error) this.logger.error(`Could not release idempotency key after failure (${error.code ?? 'NETWORK'})`);
      }
      throw err;
    }
  }

  /**
   * Reserves the key. Returns the stored response if the request was already completed,
   * throws if it is still in progress, or returns null when this request now owns the key.
   */
  private async claimIdempotencyKey(key: string): Promise<PrescriptionCreated | null> {
    const { error } = await this.db.from('idempotency_keys').insert({ key, response_payload: PENDING });
    if (!error) return null;
    if (error.code !== '23505') throw toHttpError(error, 'check the idempotency key');

    const existing = unwrapRequired(
      await this.db.from('idempotency_keys').select('response_payload').eq('key', key).maybeSingle(),
      'read the idempotency key',
    ) as { response_payload: PrescriptionCreated | typeof PENDING };

    if ((existing.response_payload as typeof PENDING).status === 'PENDING') {
      throw new ConflictException({
        code: 'REQUEST_IN_PROGRESS',
        message: 'This prescription is already being saved. Wait a moment and check the prescription list before retrying.',
      });
    }
    return existing.response_payload as PrescriptionCreated;
  }

  /**
   * Checks shared by both write paths, made before anything is written: medicine or name on
   * every label, instruction combinations, printed expiry, patient reference, catalogue
   * medicines exist, whole units, active. Returns the products and the units required of each.
   */
  private async validateRequest(dto: CreatePrescriptionDto, today: string) {
    for (const [index, item] of dto.items.entries()) {
      if (item.ent?.startDay && item.ent?.endDay && item.ent.endDay < item.ent.startDay) {
        throw new BadRequestException(`Label ${index + 1}: End Day must be on or after Start Day.`);
      }
      if (item.ent && item.frequency === 'CUSTOM' && !item.ent.customHours) {
        throw new BadRequestException(`Label ${index + 1}: set custom ENT hours.`);
      }

      if (!item.productId && !item.alternativeProductName?.trim()) {
        throw new BadRequestException({
          code: 'MEDICINE_REQUIRED',
          message: `Label ${index + 1}: select a medicine or enter its name.`,
        });
      }
      if (item.instructions?.length) {
        const combo = validateInstructionCombinations(item.instructions);
        if (!combo.valid) throw new BadRequestException({ code: 'INVALID_INSTRUCTIONS', message: `Label ${index + 1}: ${combo.message}` });
      }
      const expiry = parseLabelExpiry(item.expiryDate);
      if (expiry && isKnownExpired(expiry, today)) {
        throw new BadRequestException({
          code: 'PRODUCT_EXPIRED',
          message: `Label ${index + 1}: the expiry date on the label (${expiry.text}) has passed.`,
        });
      }
      // Add Expiry Date prints the GRN batch expiry only (Document 5 pp. 41–43): never a typed date.
      if (
        Boolean(item.expiryDate?.trim()) !== Boolean(item.expiryBatchId) ||
        (item.expiryBatchId && !item.productId)
      ) {
        throw new BadRequestException({
          code: 'EXPIRY_BATCH_REQUIRED',
          message: `Label ${index + 1}: the expiry date must come from a GRN batch of the selected medicine. Select Add Expiry Date again.`,
        });
      }
    }

    if (dto.customerId) {
      unwrapRequired(
        await this.db.from('customers').select('id').eq('id', dto.customerId).maybeSingle(),
        'look up the patient',
      );
    }

    const products = await this.loadProducts(dto.items);
    const required = new Map<string, number>();
    for (const item of dto.items) {
      if (!item.productId) continue;
      const product = products.get(item.productId)!;
      if (!Number.isInteger(item.quantity)) {
        throw new BadRequestException({
          code: 'INVALID_QUANTITY',
          message: `${product.name}: dispensed quantity must be a whole number of units.`,
        });
      }
      required.set(product.id, (required.get(product.id) ?? 0) + item.quantity);
    }

    for (const productId of required.keys()) {
      const product = products.get(productId)!;
      if (product.is_active === false) {
        throw new BadRequestException({
          code: 'PRODUCT_INACTIVE',
          productId,
          message: `${product.name} is marked inactive and cannot be dispensed.`,
        });
      }
    }
    const expiryBatches = await this.loadExpiryBatches(dto.items, today);
    return { products, required, expiryBatches };
  }

  /**
   * Re-checks every printed batch expiry against the database at save time: the batch exists,
   * belongs to the label's medicine, may be dispensed today, and its recorded expiry is exactly
   * the date printed. A stale or edited reference is refused; nothing is corrected silently.
   */
  private async loadExpiryBatches(
    items: CreatePrescriptionItemDto[],
    today: string,
  ): Promise<Map<string, ExpiryBatchRow>> {
    const ids = [
      ...new Set(
        items
          .map((i) => i.expiryBatchId)
          .filter((id): id is string => Boolean(id)),
      ),
    ];
    if (ids.length === 0) return new Map();
    const rows = unwrapList(
      await this.db
        .from('product_batches')
        .select(
          'id, product_id, batch_number, expiry_date, quantity_available, status, received_at',
        )
        .in('id', ids),
      'check the label expiry batches',
    ) as ExpiryBatchRow[];
    const byId = new Map(rows.map((b) => [b.id, b]));
    for (const [index, item] of items.entries()) {
      if (!item.expiryBatchId) continue;
      const batch = byId.get(item.expiryBatchId);
      const problem =
        !batch || batch.product_id !== item.productId
          ? 'the batch is not a batch of the selected medicine'
          : !isDispensableBatch(batch, today)
            ? `batch ${batch.batch_number} cannot be dispensed (expired, quarantined, empty or undated)`
            : batch.expiry_date !== item.expiryDate
              ? `batch ${batch.batch_number} expires on ${batch.expiry_date}, not ${item.expiryDate}`
              : null;
      if (problem) {
        throw new BadRequestException({
          code: 'EXPIRY_BATCH_MISMATCH',
          message: `Label ${index + 1}: ${problem}. Select Add Expiry Date again.`,
        });
      }
    }
    return byId;
  }

  private async createUnchecked(dto: CreatePrescriptionDto, userId: string | null): Promise<PrescriptionCreated> {
    const today = zonedDate(this.timeZone);

    // 1. Validate everything before writing anything.
    const { products, required, expiryBatches } = await this.validateRequest(
      dto,
      today,
    );
    const blocked = await this.nonDispensableUnits([...required.keys()], today);

    for (const [productId, qty] of required) {
      const product = products.get(productId)!;
      if (product.expiry_date && product.expiry_date < today) {
        throw new BadRequestException({
          code: 'PRODUCT_EXPIRED',
          productId,
          productName: product.name,
          expiryDate: product.expiry_date,
          message: `Cannot dispense expired product ${product.name} (expired ${product.expiry_date}).`,
        });
      }
      const unusable = blocked.get(productId) ?? 0;
      const available = Number(product.stock_quantity ?? 0) - unusable;
      if (available < qty) {
        throw new ConflictException({
          code: 'INSUFFICIENT_STOCK',
          productId,
          productName: product.name,
          requested: qty,
          available,
          message:
            `Insufficient stock for ${product.name}. Requested: ${qty}, available: ${available}.` +
            (unusable > 0 ? ` ${unusable} further unit(s) are in expired, quarantined or undated batches and cannot be dispensed.` : ''),
        });
      }
    }

    // 2. Write, reversing completed steps if a later one fails.
    const header = await this.insertHeader(dto, userId);
    const applied: StockChange[] = [];
    try {
      const itemRows = unwrapList(
        await this.db
          .from('prescription_items')
          .insert(
            dto.items.map((item) =>
              this.itemRow(header.id, item, products, expiryBatches),
            ),
          )
          .select('id, product_id, quantity'),
        'save the prescription items',
      ) as { id: string; product_id: string | null; quantity: number }[];

      if (itemRows.length !== dto.items.length) {
        throw new InternalServerErrorException({ code: 'PARTIAL_WRITE', message: 'Not all prescription items were saved.' });
      }

      for (const [productId, qty] of required) {
        applied.push(await this.decrementStock(productId, qty));
      }

      const movements = itemRows
        .filter((row) => row.product_id)
        .map((row) => ({
          product_id: row.product_id,
          prescription_id: header.id,
          prescription_item_id: row.id,
          movement_type: 'DISPENSE',
          quantity: -Number(row.quantity),
          ...this.movementStockFigures(row, itemRows, applied),
          created_by: userId,
        }));
      if (movements.length > 0) {
        unwrap(await this.db.from('inventory_movements').insert(movements), 'record the stock movements');
      }

      unwrap(
        await this.db.from('prescription_events').insert({
          prescription_id: header.id,
          event_type: 'CREATED',
          user_id: userId,
          metadata: { itemCount: dto.items.length },
        }),
        'record the prescription event',
      );
    } catch (err) {
      await this.rollback(header.id, applied);
      throw err;
    }

    return {
      id: header.id,
      prescriptionNumber: header.prescription_number,
      status: header.status,
      customerName: header.customer_name_text,
      customerPhone: header.customer_phone,
      itemCount: dto.items.length,
      createdAt: header.created_at,
    };
  }

  /**
   * Units per product held in batches that must never be dispensed: quarantined, marked
   * expired, past their expiry date, or with no expiry date recorded.
   */
  private async nonDispensableUnits(productIds: string[], today: string): Promise<Map<string, number>> {
    const blocked = new Map<string, number>();
    if (productIds.length === 0) return blocked;
    const batches = unwrapList(
      await this.db
        .from('product_batches')
        .select('product_id, quantity_available, expiry_date, status')
        .in('product_id', productIds),
      'check batch expiry',
    ) as { product_id: string; quantity_available: number | null; expiry_date: string | null; status: string | null }[];
    for (const b of batches) {
      const qty = Number(b.quantity_available ?? 0);
      if (qty <= 0) continue;
      if (NON_DISPENSABLE_STATUSES.has(b.status ?? '') || !b.expiry_date || b.expiry_date < today) {
        blocked.set(b.product_id, (blocked.get(b.product_id) ?? 0) + qty);
      }
    }
    return blocked;
  }

  /** Writes the whole prescription with `create_prescription` (one database transaction). */
  private async createTransactional(
    dto: CreatePrescriptionDto,
    idempotencyKey: string | undefined,
    userId: string | null,
  ): Promise<PrescriptionCreated> {
    const today = zonedDate(this.timeZone);
    const { products, expiryBatches } = await this.validateRequest(dto, today);
    await this.assertFefoMatchesPrintedBatches(dto, expiryBatches, today);

    const payload = {
      customer_id: dto.customerId ?? null,
      customer_name: dto.customerName.trim(),
      customer_phone: normalizeSriLankanPhone(dto.customerPhone),
      // Same rows as the legacy path; the function sets the prescription id and name snapshot.
      items: dto.items.map((item) => {
        const row: Partial<ReturnType<PrescriptionsService['itemRow']>> =
          this.itemRow('', item, products, expiryBatches);
        delete row.prescription_id;
        delete row.product_name_snapshot;
        return row;
      }),
    };

    const result = unwrap(
      await this.db.rpc('create_prescription', {
        p_payload: payload,
        p_user_id: userId,
        p_idempotency_key: idempotencyKey ?? null,
      }),
      'save the prescription',
    ) as PrescriptionCreated | null;

    if (!result?.id) {
      throw new InternalServerErrorException({ code: 'NO_RESULT', message: 'The database did not confirm the prescription.' });
    }
    return result;
  }

  /**
   * Transactional mode deducts earliest-expiry-first (create_prescription). A label printed with
   * one batch's expiry must not be dispensed from another batch, so the save is refused unless
   * that allocation would take every unit of the label from the printed batch. Items are
   * allocated in order, as the database function does. Choosing a batch is not reinterpreted.
   */
  private async assertFefoMatchesPrintedBatches(
    dto: CreatePrescriptionDto,
    expiryBatches: Map<string, ExpiryBatchRow>,
    today: string,
  ) {
    if (expiryBatches.size === 0) return;
    const productIds = [
      ...new Set(
        dto.items.filter((i) => i.expiryBatchId).map((i) => i.productId!),
      ),
    ];
    const rows = unwrapList(
      await this.db
        .from('product_batches')
        .select(
          'id, product_id, batch_number, expiry_date, quantity_available, status, received_at',
        )
        .in('product_id', productIds),
      'check the batch allocation',
    ) as ExpiryBatchRow[];
    const queue = new Map<string, { id: string; left: number }[]>();
    for (const id of productIds) {
      queue.set(
        id,
        rows
          .filter((b) => b.product_id === id && isDispensableBatch(b, today))
          .sort((a, b) =>
            a.expiry_date! < b.expiry_date!
              ? -1
              : a.expiry_date! > b.expiry_date!
                ? 1
                : String(a.received_at ?? '').localeCompare(
                    String(b.received_at ?? ''),
                  ) || a.id.localeCompare(b.id),
          )
          .map((b) => ({ id: b.id, left: Number(b.quantity_available) })),
      );
    }
    for (const [index, item] of dto.items.entries()) {
      const batches = item.productId ? queue.get(item.productId) : undefined;
      if (!batches) continue;
      let remaining = item.quantity;
      const used = new Set<string>();
      for (const b of batches) {
        if (remaining <= 0) break;
        const take = Math.min(remaining, b.left);
        if (take <= 0) continue;
        b.left -= take;
        remaining -= take;
        used.add(b.id);
      }
      if (
        item.expiryBatchId &&
        (remaining > 0 || used.size !== 1 || !used.has(item.expiryBatchId))
      ) {
        throw new ConflictException({
          code: 'EXPIRY_BATCH_ALLOCATION_MISMATCH',
          message: `Label ${index + 1}: earliest-expiry-first dispensing would not take these units only from batch ${expiryBatches.get(item.expiryBatchId)!.batch_number}, so the printed expiry could be wrong. Choose the batch that will be dispensed, or remove Add Expiry Date.`,
        });
      }
    }
  }

  private async loadProducts(
    items: CreatePrescriptionItemDto[],
  ): Promise<Map<string, ProductRow>> {
    const ids = [...new Set(items.map((i) => i.productId).filter((id): id is string => Boolean(id)))];
    if (ids.length === 0) return new Map();

    const rows = unwrapList(
      await this.db.from('products').select('*').in('id', ids),
      'look up the medicines',
    ) as ProductRow[];
    const byId = new Map(rows.map((p) => [p.id, p]));
    const missing = ids.filter((id) => !byId.has(id));
    if (missing.length > 0) {
      throw new BadRequestException({
        code: 'PRODUCT_NOT_FOUND',
        productIds: missing,
        message: 'A selected medicine is no longer in the catalogue. Search for it again before saving.',
      });
    }
    return byId;
  }

  private async insertHeader(dto: CreatePrescriptionDto, userId: string | null) {
    const phone = normalizeSriLankanPhone(dto.customerPhone);
    for (let attempt = 1; attempt <= MAX_NUMBER_ATTEMPTS; attempt++) {
      const count = await this.db.from('prescriptions').select('id', { count: 'exact', head: true });
      if (count.error) throw toHttpError(count.error, 'number the prescription');

      const { data, error } = await this.db
        .from('prescriptions')
        .insert({
          prescription_number: generatePrescriptionNumber((count.count ?? 0) + attempt),
          customer_id: dto.customerId ?? null,
          customer_name_text: dto.customerName.trim(),
          customer_phone: phone,
          status: 'COMPLETED',
          created_by: userId,
        })
        .select('id, prescription_number, status, customer_name_text, customer_phone, created_at')
        .single();

      if (!error && data) return data;
      // Another prescription took this number at the same moment; try the next one.
      if (error?.code === '23505' && attempt < MAX_NUMBER_ATTEMPTS) continue;
      throw toHttpError(error ?? { code: 'NO_ROW' }, 'save the prescription');
    }
    throw new ConflictException({ code: 'NUMBER_CONFLICT', message: 'Could not allocate a prescription number. Please try again.' });
  }

  private itemRow(
    prescriptionId: string,
    item: CreatePrescriptionItemDto,
    products: Map<string, ProductRow>,
    expiryBatches: Map<string, ExpiryBatchRow>,
  ) {
    const product = item.productId ? products.get(item.productId) : undefined;
    const expiry = parseLabelExpiry(item.expiryDate);
    const batch = item.expiryBatchId
      ? expiryBatches.get(item.expiryBatchId)
      : undefined;
    return {
      prescription_id: prescriptionId,
      product_id: product?.id ?? null,
      product_name_snapshot: product?.name ?? item.alternativeProductName!.trim(),
      alternative_product_name: item.alternativeProductName?.trim() || null,
      quantity: item.quantity,
      days: item.days ?? null,
      morning_qty: item.dosage?.morning ?? 0,
      lunch_qty: item.dosage?.lunch ?? 0,
      night_qty: item.dosage?.night ?? 0,
      frequency_type: item.frequency ?? null,
      frequency_qty: item.frequencyQty ?? null,
      stat_qty: item.stat?.qty ?? null,
      stat_follow_up: item.stat?.followUp ?? null,
      // The DATE column only receives an unambiguous date; the printed text is kept below.
      expiry_date: expiry?.isoDate ?? null,
      show_address: item.showAddress !== false,
      instructions_json: {
        instructions: item.instructions ?? [],
        ...(item.ent ? { ent: item.ent } : {}),
        ...(item.weekly ? { weekly: item.weekly } : {}),
        ...(item.weekdayRange ? { weekdayRange: item.weekdayRange } : {}),
        reasons: item.reasons ?? [],
        selectedDaysOfWeek: item.selectedDaysOfWeek ?? [],
        labelExpiryText: expiry?.text ?? null,
        // The batch the printed expiry came from, as verified at save time. Kept with the label
        // so the record shows what was printed even if the batch changes later.
        expiryBatch: batch
          ? {
              id: batch.id,
              batchNumber: batch.batch_number,
              expiryDate: batch.expiry_date,
            }
          : null,
        stat: item.stat ?? null,
      },
      final_instruction_text: item.finalInstructionText?.trim()
        ? item.finalInstructionText
        : this.buildInstructionText(item),
    };
  }

  /**
   * Decrements stock only if it has not changed since it was read (compare-and-set), so two
   * concurrent dispenses cannot both spend the same units.
   */
  private async decrementStock(productId: string, qty: number): Promise<StockChange> {
    for (let attempt = 1; attempt <= MAX_STOCK_ATTEMPTS; attempt++) {
      const current = unwrapRequired(
        await this.db.from('products').select('name, stock_quantity').eq('id', productId).maybeSingle(),
        'read stock',
      ) as { name: string; stock_quantity: number | null };
      const before = Number(current.stock_quantity ?? 0);
      if (before < qty) {
        throw new ConflictException({
          code: 'INSUFFICIENT_STOCK',
          productId,
          productName: current.name,
          requested: qty,
          available: before,
          message: `Insufficient stock for ${current.name}. Requested: ${qty}, available: ${before}.`,
        });
      }
      const updated = unwrapList(
        await this.db
          .from('products')
          .update({ stock_quantity: before - qty, updated_at: new Date().toISOString() })
          .eq('id', productId)
          .eq('stock_quantity', before)
          .select('id'),
        'update stock',
      );
      if (updated.length === 1) return { productId, before, after: before - qty };
    }
    throw new ConflictException({
      code: 'STOCK_CHANGED',
      message: 'Stock for a medicine changed while saving. Nothing was saved; please try again.',
    });
  }

  /** Per-item before/after figures, splitting a product's total change across its items in order. */
  private movementStockFigures(
    row: { id: string; product_id: string | null; quantity: number },
    rows: { id: string; product_id: string | null; quantity: number }[],
    applied: StockChange[],
  ) {
    const change = applied.find((c) => c.productId === row.product_id)!;
    let before = change.before;
    for (const r of rows) {
      if (r.id === row.id) break;
      if (r.product_id === row.product_id) before -= Number(r.quantity);
    }
    return { stock_before: before, stock_after: before - Number(row.quantity) };
  }

  private async rollback(prescriptionId: string, applied: StockChange[]) {
    const failures: string[] = [];
    for (const change of applied) {
      const qty = change.before - change.after;
      try {
        // Add the units back without overwriting changes made by others in the meantime.
        let restored = false;
        for (let attempt = 0; attempt < MAX_STOCK_ATTEMPTS && !restored; attempt++) {
          const { data, error } = await this.db.from('products').select('stock_quantity').eq('id', change.productId).single();
          if (error || !data) break;
          const now = Number(data.stock_quantity ?? 0);
          const res = await this.db
            .from('products')
            .update({ stock_quantity: now + qty, updated_at: new Date().toISOString() })
            .eq('id', change.productId)
            .eq('stock_quantity', now)
            .select('id');
          restored = !res.error && Array.isArray(res.data) && res.data.length === 1;
        }
        if (!restored) failures.push(`stock:${change.productId}`);
      } catch {
        failures.push(`stock:${change.productId}`);
      }
    }

    // Children are deleted explicitly rather than relying on ON DELETE CASCADE.
    for (const table of ['inventory_movements', 'prescription_events', 'prescription_items'] as const) {
      const res = await this.db.from(table).delete().eq('prescription_id', prescriptionId);
      if (res.error) failures.push(table);
    }
    const rx = await this.db.from('prescriptions').delete().eq('id', prescriptionId);
    if (rx.error) failures.push('prescription');

    if (failures.length > 0) {
      this.logger.error(
        `RECONCILIATION REQUIRED: prescription ${prescriptionId} failed and could not be fully reversed (${failures.join(', ')})`,
      );
      throw new InternalServerErrorException({
        code: 'RECONCILIATION_REQUIRED',
        prescriptionId,
        message:
          'The prescription was not saved, and the partial changes could not be fully reversed. ' +
          'Do not retry. Ask an administrator to check stock and prescription records.',
      });
    }
  }

  async findAll() {
    return unwrapList(
      await this.db
        .from('prescriptions')
        .select('*, prescription_items(*)')
        .order('created_at', { ascending: false })
        .limit(30),
      'load prescriptions',
    );
  }

  async findOne(id: string) {
    return unwrapRequired(
      await this.db
        .from('prescriptions')
        .select('*, prescription_items(*), prescription_events(*)')
        .eq('id', id)
        .maybeSingle(),
      'load the prescription',
    );
  }

  async logPrint(id: string, userId: string | null) {
    await this.requireExists(id);
    const printedAt = new Date().toISOString();
    unwrap(await this.db.from('prescriptions').update({ printed_at: printedAt }).eq('id', id), 'record the print');
    unwrap(
      await this.db.from('prescription_events').insert({
        prescription_id: id,
        event_type: 'PRINTED',
        user_id: userId,
        metadata: {},
      }),
      'record the print event',
    );
    return { success: true, printedAt };
  }

  async logSms(id: string, dto: LogSmsDto, userId: string | null) {
    await this.requireExists(id);
    unwrap(
      await this.db.from('prescription_events').insert({
        prescription_id: id,
        event_type: dto.status === 'SENT' ? 'SMS_SENT' : 'SMS_FAILED',
        user_id: userId,
        metadata: {
          recipient: normalizeSriLankanPhone(dto.recipient),
          messageLength: dto.messageLength,
          providerReference: dto.providerReference ?? null,
          failureReason: dto.failureReason ?? null,
        },
      }),
      'record the SMS event',
    );
    return { success: true };
  }

  private async requireExists(id: string) {
    const row = unwrap(await this.db.from('prescriptions').select('id').eq('id', id).maybeSingle(), 'look up the prescription');
    if (!row) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Prescription not found.' });
  }

  /** Fallback instruction text for clients that do not send the printed text. Unchanged clinical wording. */
  private buildInstructionText(item: CreatePrescriptionItemDto): string {
    const parts: string[] = [];

    if (item.dosage) {
      const m = formatDosageReadable(item.dosage.morning);
      const l = formatDosageReadable(item.dosage.lunch);
      const n = formatDosageReadable(item.dosage.night);
      const dosageParts: string[] = [];
      if (m) dosageParts.push(`උදේ ${m}`);
      if (l) dosageParts.push(`දවල් ${l}`);
      if (n) dosageParts.push(`රෑ ${n}`);
      if (dosageParts.length > 0) parts.push(dosageParts.join(' • '));
    }

    if (item.instructions && item.instructions.length > 0) {
      parts.push(item.instructions.join(' • '));
    }

    if (item.days) {
      parts.push(`දින ${item.days} ක් සඳහා`);
    }

    return parts.join(' • ') || 'නියමිත පරිදි ගන්න';
  }
}
