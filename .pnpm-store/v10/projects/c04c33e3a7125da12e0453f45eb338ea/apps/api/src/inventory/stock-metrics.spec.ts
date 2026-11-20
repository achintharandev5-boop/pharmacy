import { countStockLevels, expiryBand, productsExpiringWithin, stockLevel } from './stock-metrics';

describe('stock classification', () => {
  it('uses each product’s own thresholds', () => {
    expect(stockLevel({ id: 'a', stock_quantity: 0, reorder_level: 10, minimum_stock: 2 })).toBe('OUT_OF_STOCK');
    expect(stockLevel({ id: 'a', stock_quantity: 2, reorder_level: 10, minimum_stock: 2 })).toBe('CRITICAL');
    expect(stockLevel({ id: 'a', stock_quantity: 10, reorder_level: 10, minimum_stock: 2 })).toBe('LOW');
    expect(stockLevel({ id: 'a', stock_quantity: 11, reorder_level: 10, minimum_stock: 2 })).toBe('HEALTHY');
  });

  it('does not invent a threshold when none is recorded', () => {
    expect(stockLevel({ id: 'a', stock_quantity: 3 })).toBe('UNCLASSIFIED');
    expect(stockLevel({ id: 'a', stock_quantity: null })).toBe('OUT_OF_STOCK');
  });

  it('counts levels, including zero results as genuine zeros', () => {
    expect(countStockLevels([])).toEqual({ healthy: 0, low: 0, critical: 0, outOfStock: 0, unclassified: 0 });
    expect(
      countStockLevels([
        { id: 'a', stock_quantity: 0 },
        { id: 'b', stock_quantity: 5 },
        { id: 'c', stock_quantity: 50, reorder_level: 10 },
      ]),
    ).toEqual({ healthy: 1, low: 0, critical: 0, outOfStock: 1, unclassified: 1 });
  });
});

describe('expiry classification', () => {
  const today = '2026-10-10';

  it('bands expiry dates relative to the pharmacy date', () => {
    expect(expiryBand('2026-10-09', today)).toBe('EXPIRED');
    expect(expiryBand('2026-10-10', today)).toBe('WITHIN_30');
    expect(expiryBand('2026-11-09', today)).toBe('WITHIN_30');
    expect(expiryBand('2026-12-01', today)).toBe('WITHIN_60');
    expect(expiryBand('2027-01-01', today)).toBe('WITHIN_90');
    expect(expiryBand('2028-01-01', today)).toBe('LATER');
    expect(expiryBand(null, today)).toBe('NO_DATE');
  });

  it('prefers batch expiry and ignores empty batches', () => {
    const products = [
      { id: 'batched', stock_quantity: 10, expiry_date: '2026-10-15' },
      { id: 'legacy', stock_quantity: 10, expiry_date: '2026-10-15' },
      { id: 'legacy-empty', stock_quantity: 0, expiry_date: '2026-10-15' },
    ];
    const batches = [
      { product_id: 'batched', quantity_available: 0, expiry_date: '2026-10-12' },
      { product_id: 'batched', quantity_available: 5, expiry_date: '2027-06-01' },
    ];
    expect([...productsExpiringWithin(products, batches, today, 30)]).toEqual(['legacy']);
  });
});
