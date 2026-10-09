import { BadRequestException, ConflictException, ServiceUnavailableException, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InventoryService } from './inventory.service';
import { SupabaseService } from '../supabase/supabase.service';
import { FakeSupabase } from '../test-utils/fake-supabase';
import { ReceiveStockDto, StockAdjustmentDto } from './dto/inventory.dto';
import { addDays, zonedDate } from '../common/time';

const PRODUCT = '11111111-1111-4111-8111-111111111111';
const SUPPLIER = '77777777-7777-4777-8777-777777777777';
const USER = '55555555-5555-4555-8555-555555555555';

function serviceFor(db: FakeSupabase) {
  return new InventoryService(
    { getClient: () => db.client() } as unknown as SupabaseService,
    { get: () => 'Asia/Colombo' } as unknown as ConfigService,
  );
}

const today = zonedDate('Asia/Colombo');

describe('Inventory request validation (finding D9)', () => {
  const pipe = new ValidationPipe({ whitelist: true, transform: true });

  it('keeps a goods-receipt body intact instead of stripping it', async () => {
    const body = {
      supplierId: SUPPLIER,
      invoiceNumber: 'INV-1',
      items: [{ productId: PRODUCT, productName: 'ignored', batchNumber: 'B1', quantity: 10, purchaseCost: 12.5, expiryDate: '2028-01-31' }],
    };
    const dto = await pipe.transform(body, { type: 'body', metatype: ReceiveStockDto });
    expect(dto.items[0]).toMatchObject({ productId: PRODUCT, batchNumber: 'B1', quantity: 10, purchaseCost: 12.5 });
    expect(dto.items[0]).not.toHaveProperty('productName');
  });

  it('requires an expiry date and a supplier on received stock', async () => {
    const noExpiry = { supplierId: SUPPLIER, items: [{ productId: PRODUCT, batchNumber: 'B1', quantity: 1, purchaseCost: 1 }] };
    await expect(pipe.transform(noExpiry, { type: 'body', metatype: ReceiveStockDto })).rejects.toBeInstanceOf(BadRequestException);
    const noSupplier = { items: [{ productId: PRODUCT, batchNumber: 'B1', quantity: 1, purchaseCost: 1, expiryDate: '2028-01-01' }] };
    await expect(pipe.transform(noSupplier, { type: 'body', metatype: ReceiveStockDto })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('keeps an adjustment body intact and requires a reason', async () => {
    const dto = await pipe.transform(
      { productId: PRODUCT, type: 'DAMAGED', quantity: 2, reason: 'Broken bottles' },
      { type: 'body', metatype: StockAdjustmentDto },
    );
    expect(dto).toMatchObject({ productId: PRODUCT, type: 'DAMAGED', quantity: 2, reason: 'Broken bottles' });
    await expect(
      pipe.transform({ productId: PRODUCT, type: 'DAMAGED', quantity: 2 }, { type: 'body', metatype: StockAdjustmentDto }),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      pipe.transform({ productId: PRODUCT, type: 'DAMAGED', quantity: -2, reason: 'x y z' }, { type: 'body', metatype: StockAdjustmentDto }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('InventoryService', () => {
  describe('summary', () => {
    it('reports genuine zeros for an empty database', async () => {
      const summary = await serviceFor(new FakeSupabase()).getSummary();
      expect(summary).toMatchObject({
        totalProducts: 0,
        totalUnits: 0,
        stock: { healthy: 0, low: 0, critical: 0, outOfStock: 0, unclassified: 0 },
        expiry: { expired: 0, within30Days: 0, within60Days: 0, within90Days: 0 },
        valuation: { cost: 0, retail: 0, potentialMargin: 0 },
      });
    });

    it('fails rather than reporting zeros when a query fails', async () => {
      await expect(serviceFor(new FakeSupabase().fail('product_batches', 'select')).getSummary()).rejects.toBeInstanceOf(
        ServiceUnavailableException,
      );
    });

    it('values stock from batch records and flags unpriced batches', async () => {
      const db = new FakeSupabase({
        products: [{ id: PRODUCT, name: 'A', stock_quantity: 15, reorder_level: 10, minimum_stock: 2, retail_price: null }],
        product_batches: [
          { id: 'b1', product_id: PRODUCT, quantity_available: 10, purchase_cost: 2, retail_price: 3, expiry_date: addDays(today, -1) },
          { id: 'b2', product_id: PRODUCT, quantity_available: 5, purchase_cost: 4, retail_price: null, expiry_date: addDays(today, 45) },
          { id: 'b3', product_id: PRODUCT, quantity_available: 0, purchase_cost: 9, retail_price: 9, expiry_date: addDays(today, 1) },
        ],
      });
      const s = await serviceFor(db).getSummary();
      expect(s.valuation).toEqual({ cost: 40, retail: 30, potentialMargin: -10, stockedBatches: 2, unpricedBatches: 1 });
      expect(s.expiry).toEqual({ expired: 1, within30Days: 0, within60Days: 1, within90Days: 0 });
      expect(s.stock.healthy).toBe(1);
    });
  });

  it('returns no alerts (not sample alerts) when stock is healthy', async () => {
    const db = new FakeSupabase({ products: [{ id: PRODUCT, name: 'A', stock_quantity: 100, reorder_level: 10 }] });
    await expect(serviceFor(db).getAlerts()).resolves.toEqual([]);
  });

  it('lists low stock only against recorded thresholds', async () => {
    const db = new FakeSupabase({
      products: [
        { id: 'a', name: 'Low', stock_quantity: 3, reorder_level: 10, maximum_stock: 50 },
        { id: 'b', name: 'No threshold', stock_quantity: 3 },
        { id: 'c', name: 'Healthy', stock_quantity: 30, reorder_level: 10 },
      ],
    });
    const low = await serviceFor(db).getLowStock();
    expect(low.map((p) => p.name)).toEqual(['Low']);
    expect(low[0]).toMatchObject({ status: 'LOW_STOCK', suggestedOrderQty: 47 });
  });

  describe('receiving and adjustments (transactional database functions)', () => {
    const receipt: ReceiveStockDto = {
      supplierId: SUPPLIER,
      items: [{ productId: PRODUCT, batchNumber: 'B1', quantity: 10, purchaseCost: 2, expiryDate: '2028-01-31' }],
    };

    it('passes the validated receipt and the user to receive_stock', async () => {
      const db = new FakeSupabase();
      let args: any;
      db.rpcHandlers.receive_stock = (a) => {
        args = a;
        return { data: { receipt_id: 'r1', receipt_number: 'GRN-1', line_count: 1, unit_count: 10 }, error: null };
      };
      await expect(serviceFor(db).receiveStock(receipt, USER, 'idem-key-1')).resolves.toEqual({
        success: true,
        receiptId: 'r1',
        grnNumber: 'GRN-1',
        lineCount: 1,
        unitCount: 10,
      });
      expect(args).toMatchObject({
        p_user_id: USER,
        p_idempotency_key: 'idem-key-1',
        p_payload: { supplier_id: SUPPLIER, items: [{ product_id: PRODUCT, batch_number: 'B1', quantity: 10, unit_cost: 2 }] },
      });
    });

    it('reports a missing database function as a pending migration, not as success', async () => {
      const err = await serviceFor(new FakeSupabase()).receiveStock(receipt, USER).catch((e) => e);
      expect(err).toBeInstanceOf(ServiceUnavailableException);
      expect(err.getResponse()).toMatchObject({ code: 'SCHEMA_OUT_OF_DATE' });
    });

    it('surfaces an insufficient-stock rejection from adjust_stock as 409', async () => {
      const db = new FakeSupabase();
      db.rpcHandlers.adjust_stock = () => ({
        data: null,
        error: { code: 'P0001', hint: 'INSUFFICIENT_STOCK', message: 'Only 3 units available in batch B1.' } as any,
      });
      const err = await serviceFor(db)
        .adjustStock({ productId: PRODUCT, type: 'DAMAGED', quantity: 5, reason: 'Broken' }, USER)
        .catch((e) => e);
      expect(err).toBeInstanceOf(ConflictException);
      expect(err.getResponse()).toEqual({ code: 'INSUFFICIENT_STOCK', message: 'Only 3 units available in batch B1.' });
    });

    it('never reports success when the database call fails', async () => {
      const db = new FakeSupabase();
      db.rpcHandlers.adjust_stock = () => ({ data: null, error: { message: 'fetch failed' } });
      await expect(
        serviceFor(db).adjustStock({ productId: PRODUCT, type: 'ADJUSTMENT_IN', quantity: 5, reason: 'Count' }, USER),
      ).rejects.toBeInstanceOf(ServiceUnavailableException);
    });
  });

  it('builds analytics from dispensing records only', async () => {
    const db = new FakeSupabase({
      products: [
        { id: 'a', name: 'Fast', stock_quantity: 10, category: 'Analgesic' },
        { id: 'b', name: 'Idle', stock_quantity: 4, category: null },
      ],
      product_batches: [{ product_id: 'b', quantity_available: 4, purchase_cost: 10 }],
      prescription_items: [{ product_id: 'a', product_name_snapshot: 'Fast', quantity: 6, created_at: new Date().toISOString() }],
    });
    const a = await serviceFor(db).getAnalytics('7d');
    expect(a.fastMoving).toEqual([{ productId: 'a', name: 'Fast', category: 'Analgesic', dispensedQty: 6 }]);
    expect(a.slowMoving).toEqual([
      expect.objectContaining({ productId: 'b', stockQty: 4, stockValue: 40, lastDispensedAt: null, daysSinceDispensed: null }),
    ]);
    expect(a.stockByCategory).toEqual([{ category: 'Uncategorised', value: 40, percentage: 100 }]);
  });
});
