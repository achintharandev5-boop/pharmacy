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
}

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
 * The target design is a single database transaction (see migration
 * 20261010000300_transactional_functions.sql, `create_prescription`). This service keeps
 * working against the current schema until that migration is reviewed and applied.
 */
@Injectable()
export class PrescriptionsService {
  private readonly logger = new Logger(PrescriptionsService.name);
  private readonly timeZone: string;

  constructor(
    private readonly supabaseService: SupabaseService,
    config: ConfigService,
  ) {
    this.timeZone = config.get<string>('PHARMACY_TIMEZONE') ?? 'Asia/Colombo';
  }

  private get db() {
    return this.supabaseService.getClient();
  }

  async create(dto: CreatePrescriptionDto, idempotencyKey: string | undefined, userId: string | null) {
    if (idempotencyKey !== undefined && !/^[\w.:-]{8,200}$/.test(idempotencyKey)) {
      throw new BadRequestException({ code: 'INVALID_IDEMPOTENCY_KEY', message: 'Idempotency-Key header is invalid.' });
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

  private async createUnchecked(dto: CreatePrescriptionDto, userId: string | null): Promise<PrescriptionCreated> {
    const today = zonedDate(this.timeZone);

    // 1. Validate everything before writing anything.
    for (const [index, item] of dto.items.entries()) {
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

    for (const [productId, qty] of required) {
      const product = products.get(productId)!;
      if (product.is_active === false) {
        throw new BadRequestException({
          code: 'PRODUCT_INACTIVE',
          productId,
          message: `${product.name} is marked inactive and cannot be dispensed.`,
        });
      }
      if (product.expiry_date && product.expiry_date < today) {
        throw new BadRequestException({
          code: 'PRODUCT_EXPIRED',
          productId,
          productName: product.name,
          expiryDate: product.expiry_date,
          message: `Cannot dispense expired product ${product.name} (expired ${product.expiry_date}).`,
        });
      }
      const available = Number(product.stock_quantity ?? 0);
      if (available < qty) {
        throw new ConflictException({
          code: 'INSUFFICIENT_STOCK',
          productId,
          productName: product.name,
          requested: qty,
          available,
          message: `Insufficient stock for ${product.name}. Requested: ${qty}, available: ${available}.`,
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
          .insert(dto.items.map((item) => this.itemRow(header.id, item, products)))
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

  private async loadProducts(items: CreatePrescriptionItemDto[]): Promise<Map<string, ProductRow>> {
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

  private itemRow(prescriptionId: string, item: CreatePrescriptionItemDto, products: Map<string, ProductRow>) {
    const product = item.productId ? products.get(item.productId) : undefined;
    const expiry = parseLabelExpiry(item.expiryDate);
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
        reasons: item.reasons ?? [],
        selectedDaysOfWeek: item.selectedDaysOfWeek ?? [],
        labelExpiryText: expiry?.text ?? null,
        stat: item.stat ?? null,
      },
      final_instruction_text: item.finalInstructionText?.trim() || this.buildInstructionText(item),
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
