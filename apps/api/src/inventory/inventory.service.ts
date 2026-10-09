import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseService } from '../supabase/supabase.service';
import { unwrap, unwrapList } from '../common/db';
import { addDays, startOfZonedDay, zonedDate } from '../common/time';
import { ReceiveStockDto, StockAdjustmentDto } from './dto/inventory.dto';
import { countStockLevels, expiryBand, stockLevel, toNumber } from './stock-metrics';

export const RANGE_DAYS: Record<string, number> = { '7d': 7, '30d': 30, '90d': 90 };

type Row = Record<string, any>;

function assertIdempotencyKey(key: string | undefined) {
  if (key !== undefined && !/^[\w.:-]{8,200}$/.test(key)) {
    throw new BadRequestException({ code: 'INVALID_IDEMPOTENCY_KEY', message: 'Idempotency-Key header is invalid.' });
  }
}

/**
 * Inventory reads and stock-changing operations.
 *
 * Every figure is computed from stored records. A database error is returned as an error;
 * it is never replaced with sample data or reported as zero.
 *
 * Receiving and adjustments call database functions (`receive_stock`, `adjust_stock`) so the
 * batch, product total and movement ledger change in one transaction. Until migration
 * 20261010000300 is applied these endpoints return 503 SCHEMA_OUT_OF_DATE.
 */
@Injectable()
export class InventoryService {
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

  private today() {
    return zonedDate(this.timeZone);
  }

  private async loadProducts(): Promise<Row[]> {
    return unwrapList(await this.db.from('products').select('*'), 'load products');
  }

  private async loadBatches(): Promise<Row[]> {
    return unwrapList(await this.db.from('product_batches').select('*'), 'load batches');
  }

  async getSummary() {
    const [products, batches] = await Promise.all([this.loadProducts(), this.loadBatches()]);
    const today = this.today();
    const productById = new Map(products.map((p) => [p.id, p]));

    const expiry = { expired: 0, within30Days: 0, within60Days: 0, within90Days: 0 };
    let batchUnits = 0;
    let cost = 0;
    let retail = 0;
    let unpricedBatches = 0;
    let stockedBatches = 0;

    for (const b of batches) {
      const qty = toNumber(b.quantity_available);
      if (qty <= 0) continue;
      stockedBatches++;
      batchUnits += qty;
      cost += qty * toNumber(b.purchase_cost);
      const unitRetail = b.retail_price ?? productById.get(b.product_id)?.retail_price;
      if (unitRetail === null || unitRetail === undefined) unpricedBatches++;
      else retail += qty * toNumber(unitRetail);

      const band = expiryBand(b.expiry_date, today);
      if (band === 'EXPIRED') expiry.expired++;
      else if (band === 'WITHIN_30') expiry.within30Days++;
      else if (band === 'WITHIN_60') expiry.within60Days++;
      else if (band === 'WITHIN_90') expiry.within90Days++;
    }

    return {
      asOf: new Date().toISOString(),
      totalProducts: products.length,
      totalUnits: products.reduce((sum, p) => sum + Math.max(0, toNumber(p.stock_quantity)), 0),
      batchUnits,
      stock: countStockLevels(products),
      /** Counts of batches with stock remaining. */
      expiry,
      valuation: {
        cost,
        retail,
        potentialMargin: retail - cost,
        stockedBatches,
        /** Batches with stock but no retail price; excluded from the retail figure. */
        unpricedBatches,
      },
    };
  }

  async getAlerts() {
    const [products, batches] = await Promise.all([this.loadProducts(), this.loadBatches()]);
    const today = this.today();
    const nameOf = new Map(products.map((p) => [p.id, p.name as string]));
    const alerts: Row[] = [];

    for (const b of batches) {
      if (toNumber(b.quantity_available) <= 0) continue;
      const band = expiryBand(b.expiry_date, today);
      const name = nameOf.get(b.product_id) ?? 'Unknown product';
      if (band === 'EXPIRED') {
        alerts.push({
          id: `exp_${b.id}`,
          severity: 'DANGER',
          type: 'EXPIRED',
          title: `${name} – expired batch`,
          message: `Batch ${b.batch_number} expired on ${b.expiry_date}. ${toNumber(b.quantity_available)} units remain in stock.`,
          productId: b.product_id,
          batchId: b.id,
          actionText: 'Review batch',
        });
      } else if (band === 'WITHIN_30') {
        alerts.push({
          id: `exp30_${b.id}`,
          severity: 'WARNING',
          type: 'EXPIRING_SOON',
          title: `${name} – expiring soon`,
          message: `Batch ${b.batch_number} expires on ${b.expiry_date}.`,
          productId: b.product_id,
          batchId: b.id,
          actionText: 'View batch',
        });
      }
    }

    for (const p of products) {
      if (p.is_active === false) continue;
      const level = stockLevel(p);
      if (level === 'OUT_OF_STOCK') {
        alerts.push({
          id: `out_${p.id}`,
          severity: 'CRITICAL',
          type: 'OUT_OF_STOCK',
          title: `${p.name} – out of stock`,
          message: 'Recorded stock is 0 units.',
          productId: p.id,
          actionText: 'View product',
        });
      } else if (level === 'CRITICAL' || level === 'LOW') {
        alerts.push({
          id: `low_${p.id}`,
          severity: level === 'CRITICAL' ? 'HIGH' : 'WARNING',
          type: 'LOW_STOCK',
          title: `${p.name} – low stock`,
          message: `${toNumber(p.stock_quantity)} units remaining (reorder level ${p.reorder_level ?? '—'}).`,
          productId: p.id,
          actionText: 'Receive stock',
        });
      }
    }

    const order = ['DANGER', 'CRITICAL', 'HIGH', 'WARNING'];
    return alerts.sort((a, b) => order.indexOf(a.severity) - order.indexOf(b.severity));
  }

  async getBatches(query?: string, status?: string) {
    let q = this.db
      .from('product_batches')
      .select('*, products(name, generic_name, barcode, sku), suppliers(name)')
      .order('expiry_date', { ascending: true, nullsFirst: false });
    if (status && status !== 'ALL') q = q.eq('status', status);

    const data = unwrapList(await q, 'load batches');
    const term = query?.trim().toLowerCase();
    if (!term) return data;
    return data.filter(
      (b: Row) =>
        b.batch_number?.toLowerCase().includes(term) ||
        b.products?.name?.toLowerCase().includes(term) ||
        b.products?.barcode?.includes(term),
    );
  }

  async getMovements(query?: string, type?: string) {
    let q = this.db
      .from('inventory_movements')
      .select('*, products(name, barcode), product_batches(batch_number), prescriptions(prescription_number)')
      .order('created_at', { ascending: false })
      .limit(500);
    if (type && type !== 'ALL') q = q.eq('movement_type', type);

    const data = unwrapList(await q, 'load stock movements');
    const term = query?.trim().toLowerCase();
    if (!term) return data;
    return data.filter(
      (m: Row) =>
        m.products?.name?.toLowerCase().includes(term) ||
        m.product_batches?.batch_number?.toLowerCase().includes(term) ||
        m.prescriptions?.prescription_number?.toLowerCase().includes(term),
    );
  }

  async receiveStock(dto: ReceiveStockDto, userId: string, idempotencyKey?: string) {
    assertIdempotencyKey(idempotencyKey);
    const payload = {
      supplier_id: dto.supplierId,
      invoice_number: dto.invoiceNumber?.trim() || null,
      grn_number: dto.grnNumber?.trim() || null,
      received_date: dto.receivedDate ?? this.today(),
      notes: dto.notes?.trim() || null,
      items: dto.items.map((i) => ({
        product_id: i.productId,
        batch_number: i.batchNumber.trim(),
        quantity: i.quantity,
        unit_cost: i.purchaseCost,
        retail_price: i.retailPrice ?? null,
        manufactured_date: i.manufacturedDate ?? null,
        expiry_date: i.expiryDate,
      })),
    };
    const result = unwrap(
      await this.db.rpc('receive_stock', {
        p_payload: payload,
        p_user_id: userId,
        p_idempotency_key: idempotencyKey ?? null,
      }),
      'receive stock',
    ) as { receipt_id: string; receipt_number: string; line_count: number; unit_count: number } | null;

    if (!result?.receipt_id) {
      throw new Error('receive_stock returned no receipt');
    }
    return {
      success: true,
      receiptId: result.receipt_id,
      grnNumber: result.receipt_number,
      lineCount: result.line_count,
      unitCount: result.unit_count,
    };
  }

  async adjustStock(dto: StockAdjustmentDto, userId: string, idempotencyKey?: string) {
    assertIdempotencyKey(idempotencyKey);
    const result = unwrap(
      await this.db.rpc('adjust_stock', {
        p_product_id: dto.productId,
        p_batch_id: dto.batchId ?? null,
        p_type: dto.type,
        p_quantity: dto.quantity,
        p_reason: dto.reason.trim(),
        p_user_id: userId,
        p_idempotency_key: idempotencyKey ?? null,
      }),
      'adjust stock',
    ) as { movement_id: string; stock_before: number; stock_after: number } | null;

    if (!result?.movement_id) {
      throw new Error('adjust_stock returned no movement');
    }
    return {
      success: true,
      movementId: result.movement_id,
      stockBefore: Number(result.stock_before),
      stockAfter: Number(result.stock_after),
    };
  }

  /** Batches with stock remaining, grouped by how soon they expire. */
  async getExpiryMatrix() {
    const batches = (await this.getBatches()).filter((b: Row) => toNumber(b.quantity_available) > 0);
    const today = this.today();
    const pick = (band: string) => batches.filter((b: Row) => expiryBand(b.expiry_date, today) === band);
    return {
      asOf: today,
      expired: pick('EXPIRED'),
      expiring30: pick('WITHIN_30'),
      expiring60: pick('WITHIN_60'),
      expiring90: pick('WITHIN_90'),
      /** Batches with stock but no recorded expiry date. */
      noExpiryDate: pick('NO_DATE'),
    };
  }

  /** Products at or below their own reorder level. Products without thresholds are not listed. */
  async getLowStock() {
    const products = await this.loadProducts();
    return products
      .filter((p) => p.is_active !== false)
      .map((p) => ({ product: p, level: stockLevel(p) }))
      .filter(({ level }) => level === 'OUT_OF_STOCK' || level === 'CRITICAL' || level === 'LOW')
      .map(({ product: p, level }): Row => {
        const stock = toNumber(p.stock_quantity);
        const max = p.maximum_stock === null || p.maximum_stock === undefined ? null : toNumber(p.maximum_stock);
        return {
          ...p,
          status: level === 'LOW' ? 'LOW_STOCK' : level,
          /** Only when a maximum stock level is recorded for the product. */
          suggestedOrderQty: max !== null && max > stock ? max - stock : null,
        };
      })
      .sort((a: Row, b: Row) => toNumber(a.stock_quantity) - toNumber(b.stock_quantity));
  }

  async getAnalytics(range = '30d') {
    const days = RANGE_DAYS[range] ?? 30;
    const today = this.today();
    const from = startOfZonedDay(this.timeZone, addDays(today, -(days - 1))).toISOString();

    const [products, batches, itemsRes] = await Promise.all([
      this.loadProducts(),
      this.loadBatches(),
      this.db.from('prescription_items').select('product_id, product_name_snapshot, quantity, created_at').gte('created_at', from),
    ]);
    const items = unwrapList(itemsRes, 'load dispensing history');
    const productById = new Map(products.map((p) => [p.id, p]));

    const dispensed = new Map<string, number>();
    for (const item of items) {
      if (!item.product_id) continue;
      dispensed.set(item.product_id, (dispensed.get(item.product_id) ?? 0) + toNumber(item.quantity));
    }

    const valueByProduct = new Map<string, number>();
    for (const b of batches) {
      const qty = toNumber(b.quantity_available);
      if (qty > 0) valueByProduct.set(b.product_id, (valueByProduct.get(b.product_id) ?? 0) + qty * toNumber(b.purchase_cost));
    }

    const fastMoving = [...dispensed.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([id, qty]) => ({
        productId: id,
        name: productById.get(id)?.name ?? items.find((i) => i.product_id === id)?.product_name_snapshot ?? 'Unknown product',
        category: productById.get(id)?.category ?? null,
        dispensedQty: qty,
      }));

    const idle = products.filter((p) => toNumber(p.stock_quantity) > 0 && !dispensed.has(p.id));
    const lastDispensed = new Map<string, string>();
    if (idle.length > 0) {
      const history = unwrapList(
        await this.db
          .from('prescription_items')
          .select('product_id, created_at')
          .in(
            'product_id',
            idle.map((p) => p.id),
          )
          .order('created_at', { ascending: false })
          .limit(5000),
        'load dispensing history',
      );
      for (const h of history) if (!lastDispensed.has(h.product_id)) lastDispensed.set(h.product_id, h.created_at);
    }
    const slowMoving = idle
      .map((p) => {
        const last = lastDispensed.get(p.id);
        return {
          productId: p.id,
          name: p.name,
          stockQty: toNumber(p.stock_quantity),
          /** Purchase-cost value from batch records; null when the product has no costed batches. */
          stockValue: valueByProduct.has(p.id) ? valueByProduct.get(p.id)! : null,
          lastDispensedAt: last ?? null,
          daysSinceDispensed: last ? Math.floor((Date.now() - new Date(last).getTime()) / 86_400_000) : null,
        };
      })
      .sort((a, b) => (b.stockValue ?? 0) - (a.stockValue ?? 0))
      .slice(0, 10);

    const byCategory = new Map<string, number>();
    for (const [id, value] of valueByProduct) {
      const category = productById.get(id)?.category || 'Uncategorised';
      byCategory.set(category, (byCategory.get(category) ?? 0) + value);
    }
    const total = [...byCategory.values()].reduce((a, b) => a + b, 0);
    const stockByCategory = [...byCategory.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([category, value]) => ({
        category,
        value,
        percentage: total > 0 ? Math.round((value / total) * 1000) / 10 : 0,
      }));

    return { range: `${days}d`, from, fastMoving, slowMoving, stockByCategory };
  }
}
