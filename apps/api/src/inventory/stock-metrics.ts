/**
 * Pure stock and expiry classification. Thresholds come from each product's own
 * `minimum_stock` / `reorder_level`; when a product has neither, its level is UNCLASSIFIED
 * rather than assumed healthy or low.
 */
import { addDays } from '../common/time';

export type StockLevel = 'OUT_OF_STOCK' | 'CRITICAL' | 'LOW' | 'HEALTHY' | 'UNCLASSIFIED';
export type ExpiryBand = 'EXPIRED' | 'WITHIN_30' | 'WITHIN_60' | 'WITHIN_90' | 'LATER' | 'NO_DATE';

/** Database rows are untyped; these name the fields read. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ProductLike = Record<string, any>; // id, stock_quantity, minimum_stock, reorder_level, expiry_date
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type BatchLike = Record<string, any>; // product_id, quantity_available, expiry_date

function num(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export function stockLevel(p: ProductLike): StockLevel {
  const stock = num(p.stock_quantity) ?? 0;
  if (stock <= 0) return 'OUT_OF_STOCK';
  const min = num(p.minimum_stock);
  const reorder = num(p.reorder_level);
  if (min !== null && stock <= min) return 'CRITICAL';
  if (reorder !== null && stock <= reorder) return 'LOW';
  if (min === null && reorder === null) return 'UNCLASSIFIED';
  return 'HEALTHY';
}

export function expiryBand(expiry: string | null | undefined, today: string): ExpiryBand {
  if (!expiry) return 'NO_DATE';
  if (expiry < today) return 'EXPIRED';
  if (expiry <= addDays(today, 30)) return 'WITHIN_30';
  if (expiry <= addDays(today, 60)) return 'WITHIN_60';
  if (expiry <= addDays(today, 90)) return 'WITHIN_90';
  return 'LATER';
}

/**
 * Products with stock on hand that is expired or expires within `days`.
 * Batch records are used when a product has any; otherwise the product's own expiry date.
 */
export function productsExpiringWithin(
  products: ProductLike[],
  batches: BatchLike[],
  today: string,
  days: number,
): Set<string> {
  const limit = addDays(today, days);
  const withBatches = new Set(batches.map((b) => b.product_id));
  const result = new Set<string>();

  for (const b of batches) {
    if ((num(b.quantity_available) ?? 0) > 0 && b.expiry_date && b.expiry_date <= limit) result.add(b.product_id);
  }
  for (const p of products) {
    if (withBatches.has(p.id)) continue;
    if ((num(p.stock_quantity) ?? 0) > 0 && p.expiry_date && p.expiry_date <= limit) result.add(p.id);
  }
  return result;
}

export function countStockLevels(products: ProductLike[]) {
  const counts = { healthy: 0, low: 0, critical: 0, outOfStock: 0, unclassified: 0 };
  for (const p of products) {
    const level = stockLevel(p);
    if (level === 'HEALTHY') counts.healthy++;
    else if (level === 'LOW') counts.low++;
    else if (level === 'CRITICAL') counts.critical++;
    else if (level === 'OUT_OF_STOCK') counts.outOfStock++;
    else counts.unclassified++;
  }
  return counts;
}

export function toNumber(v: unknown): number {
  return num(v) ?? 0;
}
