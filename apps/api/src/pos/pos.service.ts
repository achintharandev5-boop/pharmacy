import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseService } from '../supabase/supabase.service';
import { likeTerm, unwrapList } from '../common/db';
import { zonedDate } from '../common/time';
import { isDispensableBatch } from '../inventory/inventory.service';

const SEARCH_LIMIT = 25;
const CUSTOMER_LIMIT = 10;
/** A phone lookup needs this many digits, so the POS cannot be used to list patients. */
export const MIN_CUSTOMER_DIGITS = 7;

/**
 * A patient as the point of sale may see them: enough to confirm who is at the counter, nothing
 * clinical. Address, age, allergies, notes and history are never returned here.
 */
export interface PosCustomer {
  id: string;
  name: string;
  phoneLast4: string;
  /** Registration date, to tell apart patients who share a name and phone. */
  registeredOn: string | null;
}

export interface PosBatch {
  id: string;
  batchNumber: string;
  expiryDate: string;
  quantityAvailable: number;
}

/**
 * One medicine as the point of sale sees it. Price and stock come only from the database:
 * a missing price is reported as null, never defaulted.
 */
export interface PosCatalogItem {
  id: string;
  name: string;
  genericName: string | null;
  brandName: string | null;
  strength: string | null;
  dosageForm: string | null;
  barcode: string | null;
  rxRequired: boolean;
  /** `products.retail_price`; null when no retail price has been recorded. */
  price: number | null;
  /** `products.stock_quantity`: every unit on hand, sellable or not. */
  recordedStock: number;
  /** Units the approved allocation rule (D-08) could sell today. */
  sellableQuantity: number;
  nearestExpiry: string | null;
  /** Eligible batches, earliest expiry first. Only returned to stock managers. */
  batches?: PosBatch[];
}

type Row = Record<string, unknown>;

function textOrNull(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

/**
 * Read-only catalogue for the point of sale (Milestone 1). It never changes stock.
 *
 * Sellable stock follows the allocation rule approved for POS (D-08), which is the rule of the
 * `create_prescription` function: units in batches with stock, a known expiry not yet passed
 * and a status other than QUARANTINED or EXPIRED; plus units recorded without a batch only when
 * the medicine's own expiry date is known and not passed; never more than the product total.
 */
@Injectable()
export class PosService {
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

  async searchCatalog(
    params: { q?: string; barcode?: string; ids?: string },
    includeBatches: boolean,
  ): Promise<PosCatalogItem[]> {
    const barcode = params.barcode?.trim();
    const term = likeTerm(params.q ?? '');
    const ids = params.ids ? params.ids.split(',').map((id) => id.trim()) : [];
    if (!barcode && !term && ids.length === 0) {
      throw new BadRequestException('Enter a medicine name or scan a barcode.');
    }

    const products = ids.length
      ? unwrapList<Row>(
          await this.db.from('products').select('*').in('id', ids),
          'recheck the cart',
        )
      : barcode
        ? unwrapList<Row>(
            await this.db
              .from('products')
              .select('*')
              .eq('barcode', barcode)
              .limit(1),
            'look up the barcode',
          )
        : unwrapList<Row>(
            await this.db
              .from('products')
              .select('*')
              .or(
                `name.ilike.%${term}%,generic_name.ilike.%${term}%,brand_name.ilike.%${term}%`,
              )
              .order('name', { ascending: true })
              .limit(SEARCH_LIMIT),
            'search medicines',
          );

    const active = products.filter((p) => p.is_active !== false);
    if (active.length === 0) return [];

    const batches = unwrapList<Row>(
      await this.db
        .from('product_batches')
        .select(
          'id, product_id, batch_number, expiry_date, quantity_available, status, received_at',
        )
        .in(
          'product_id',
          active.map((p) => p.id),
        ),
      'load the medicine batches',
    );

    const today = zonedDate(this.timeZone);
    return active.map((p) =>
      toCatalogItem(
        p,
        batches.filter((b) => b.product_id === p.id),
        today,
        includeBatches,
      ),
    );
  }

  /** Finds patients by phone number for the counter. Matches on digits only. */
  async lookupCustomers(phone: string): Promise<PosCustomer[]> {
    const digits = phoneDigits(phone);
    if (digits.length < MIN_CUSTOMER_DIGITS) {
      throw new BadRequestException(
        `Enter at least ${MIN_CUSTOMER_DIGITS} digits of the phone number.`,
      );
    }
    const rows = unwrapList<Row>(
      await this.db
        .from('customers')
        .select('id, name, phone_number, created_at')
        .ilike('phone_number', `%${digits}%`)
        .order('name', { ascending: true })
        .limit(CUSTOMER_LIMIT),
      'search patients',
    );
    return rows.map(toPosCustomer);
  }
}

function phoneDigits(value: unknown): string {
  return typeof value === 'string' ? value.replace(/\D/g, '') : '';
}

export function toPosCustomer(row: Row): PosCustomer {
  const created = textOrNull(row.created_at);
  return {
    id: String(row.id),
    name: String(row.name),
    phoneLast4: phoneDigits(row.phone_number).slice(-4),
    registeredOn: created ? created.slice(0, 10) : null,
  };
}

function toNumber(value: unknown): number {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function toPrice(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

export function toCatalogItem(
  product: Row,
  batches: Row[],
  today: string,
  includeBatches: boolean,
): PosCatalogItem {
  const recordedStock = Math.max(0, toNumber(product.stock_quantity));
  const eligible = batches
    .filter((b) => isDispensableBatch(b, today))
    .sort(
      (a, b) =>
        (textOrNull(a.expiry_date) ?? '').localeCompare(
          textOrNull(b.expiry_date) ?? '',
        ) ||
        (textOrNull(a.received_at) ?? '').localeCompare(
          textOrNull(b.received_at) ?? '',
        ) ||
        String(a.id).localeCompare(String(b.id)),
    );
  const inBatches = batches.reduce(
    (sum, b) => sum + toNumber(b.quantity_available),
    0,
  );
  const fromBatches = eligible.reduce(
    (sum, b) => sum + toNumber(b.quantity_available),
    0,
  );

  const declaredExpiry = textOrNull(product.expiry_date);
  const productExpiry =
    declaredExpiry && /^\d{4}-\d{2}-\d{2}$/.test(declaredExpiry)
      ? declaredExpiry
      : null;
  const unbatched = Math.max(0, recordedStock - inBatches);
  const fromUnbatched = productExpiry && productExpiry >= today ? unbatched : 0;

  const expiries = eligible.map((b) => b.expiry_date as string);
  if (fromUnbatched > 0 && productExpiry) expiries.push(productExpiry);
  expiries.sort();

  return {
    id: String(product.id),
    name: String(product.name),
    genericName: textOrNull(product.generic_name),
    brandName: textOrNull(product.brand_name),
    strength: textOrNull(product.strength),
    dosageForm: textOrNull(product.dosage_form),
    barcode: textOrNull(product.barcode),
    rxRequired: product.rx_required === true,
    price: toPrice(product.retail_price),
    recordedStock,
    sellableQuantity: Math.min(recordedStock, fromBatches + fromUnbatched),
    nearestExpiry: expiries[0] ?? null,
    ...(includeBatches
      ? {
          batches: eligible.map((b) => ({
            id: String(b.id),
            batchNumber: String(b.batch_number),
            expiryDate: String(b.expiry_date),
            quantityAvailable: toNumber(b.quantity_available),
          })),
        }
      : {}),
  };
}
