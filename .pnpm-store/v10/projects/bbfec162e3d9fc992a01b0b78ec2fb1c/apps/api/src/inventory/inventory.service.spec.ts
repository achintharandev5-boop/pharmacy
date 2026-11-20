import {
  BadRequestException,
  ConflictException,
  ParseUUIDPipe,
  ServiceUnavailableException,
  ValidationPipe,
} from '@nestjs/common';
import { InventoryController } from './inventory.controller';
import { ROLES_KEY } from '../auth/decorators';
import { ALL_ROLES } from '../auth/roles';
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

  it('limits dashboard low-stock results after applying pharmacy stock thresholds', async () => {
    const db = new FakeSupabase({
      products: [
        { id: 'a', name: 'A', stock_quantity: 0, reorder_level: 5 },
        { id: 'b', name: 'B', stock_quantity: 1, reorder_level: 5 },
      ],
    });
    await expect(serviceFor(db).getLowStock(1)).resolves.toHaveLength(1);
  });

  it('returns a zero-filled, date-filtered movement series', async () => {
    const db = new FakeSupabase({
      inventory_movements: [
        { id: 'today-1', created_at: new Date().toISOString() },
        { id: 'today-2', created_at: new Date().toISOString() },
        { id: 'old', created_at: '2020-01-01T00:00:00Z' },
      ],
    });
    const result = await serviceFor(db).getMovementActivity('7d');
    expect(result).toHaveLength(7);
    expect(result.reduce((sum, day) => sum + day.movements, 0)).toBe(2);
    expect(db.calls.filter((call) => call.table === 'inventory_movements')).toHaveLength(1);
  });

  it('rejects unsupported movement chart ranges and surfaces database errors', async () => {
    await expect(serviceFor(new FakeSupabase()).getMovementActivity('365d')).rejects.toBeInstanceOf(BadRequestException);
    await expect(serviceFor(new FakeSupabase().fail('inventory_movements', 'select')).getMovementActivity('7d')).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });

  it('returns only stocked batches expiring in the supported window and caps the result count', async () => {
    const db = new FakeSupabase({
      product_batches: [
        { id: 'soon', quantity_available: 3, expiry_date: addDays(today, 10) },
        { id: 'expired', quantity_available: 2, expiry_date: addDays(today, -1) },
        { id: 'empty', quantity_available: 0, expiry_date: addDays(today, 2) },
        { id: 'later', quantity_available: 1, expiry_date: addDays(today, 45) },
      ],
    });
    const result = await serviceFor(db).getUpcomingExpiryBatches(1);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('expired');
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

describe('Returns and quarantine (migration 20261010000500)', () => {
  const pipe = new ValidationPipe({ whitelist: true, transform: true });
  const BATCH = '88888888-8888-4888-8888-888888888888';

  it('no longer accepts the ambiguous RETURNED adjustment type', async () => {
    await expect(
      pipe.transform({ productId: PRODUCT, type: 'RETURNED', quantity: 1, reason: 'Came back' }, { type: 'body', metatype: StockAdjustmentDto }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('requires a batch for a supplier return before calling the database', async () => {
    const db = new FakeSupabase();
    const called = jest.fn();
    db.rpcHandlers.adjust_stock = () => {
      called();
      return { data: null, error: null };
    };
    await expect(
      serviceFor(db).adjustStock({ productId: PRODUCT, type: 'SUPPLIER_RETURN', quantity: 2, reason: 'Recall notice' }, USER),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(called).not.toHaveBeenCalled();
  });

  it('sends a supplier return to adjust_stock against the batch, attributed to the user', async () => {
    const db = new FakeSupabase();
    let args: any;
    db.rpcHandlers.adjust_stock = (a) => {
      args = a;
      return { data: { movement_id: 'm1', stock_before: 10, stock_after: 8 }, error: null };
    };
    await serviceFor(db).adjustStock({ productId: PRODUCT, batchId: BATCH, type: 'SUPPLIER_RETURN', quantity: 2, reason: ' Recall notice ' }, USER);
    expect(args).toMatchObject({ p_type: 'SUPPLIER_RETURN', p_batch_id: BATCH, p_reason: 'Recall notice', p_user_id: USER });
  });

  it('records a patient return without touching stock', async () => {
    const db = new FakeSupabase({ products: [{ id: PRODUCT, name: 'Panadol 500mg', stock_quantity: 10 }] });
    const saved = await serviceFor(db).recordPatientReturn({ productId: PRODUCT, quantity: 3, reason: 'Treatment stopped' }, USER);
    expect(saved).toMatchObject({ product_name_text: 'Panadol 500mg', quantity: 3, recorded_by: USER });
    expect(db.table('products')[0].stock_quantity).toBe(10);
    expect(db.table('inventory_movements')).toHaveLength(0);
  });

  it('needs a medicine or a name for a patient return', async () => {
    await expect(serviceFor(new FakeSupabase()).recordPatientReturn({ quantity: 1, reason: 'Unknown pack' }, USER)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('disposes of a held return once, and refuses a second disposal', async () => {
    const db = new FakeSupabase({ patient_returns: [{ id: BATCH, status: 'HELD_FOR_REVIEW' }] });
    await serviceFor(db).disposePatientReturn(BATCH, 'Sent for destruction', USER);
    expect(db.table('patient_returns')[0]).toMatchObject({ status: 'DISPOSED', disposed_by: USER, disposal_note: 'Sent for destruction' });
    await expect(serviceFor(db).disposePatientReturn(BATCH, 'Again', USER)).rejects.toBeInstanceOf(ConflictException);
  });

  it('passes quarantine and release to the database with the reason and user', async () => {
    const db = new FakeSupabase();
    const seen: any[] = [];
    db.rpcHandlers.quarantine_batch = (a) => (seen.push(a), { data: { status: 'QUARANTINED' }, error: null });
    db.rpcHandlers.release_batch = () => ({ data: null, error: { code: 'P0001', hint: 'EXPIRED_BATCH', message: 'expired' } as any });
    await serviceFor(db).quarantineBatch(BATCH, ' Damaged seal ', USER);
    expect(seen[0]).toEqual({ p_batch_id: BATCH, p_reason: 'Damaged seal', p_user_id: USER });
    await expect(serviceFor(db).releaseBatch(BATCH, 'Checked', USER)).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('InventoryService.getDispensingBatches (Add Expiry Date, Feature #22)', () => {
  const OTHER = '22222222-2222-4222-8222-222222222222';
  const tomorrow = addDays(today, 1);
  const yesterday = addDays(today, -1);
  const batch = (id: string, over: Record<string, unknown> = {}) => ({
    id,
    product_id: PRODUCT,
    batch_number: id.toUpperCase(),
    expiry_date: '2099-08-31',
    quantity_available: 10,
    status: 'ACTIVE',
    received_at: '2026-01-01T00:00:00Z',
    ...over,
  });

  function dbWith(batches: Record<string, unknown>[]) {
    return new FakeSupabase({
      products: [
        { id: PRODUCT, name: 'Panadol' },
        { id: OTHER, name: 'Other' },
      ],
      product_batches: batches,
    });
  }

  it('returns only dispensable batches of that medicine, with the GRN expiry exactly as recorded', async () => {
    const db = dbWith([
      batch('b-late', { expiry_date: '2099-12-31' }),
      batch('b-early', { expiry_date: tomorrow }),
      batch('b-today', { expiry_date: today }),
      batch('b-expired', { expiry_date: yesterday }),
      batch('b-undated', { expiry_date: null }),
      batch('b-quarantined', { status: 'QUARANTINED' }),
      batch('b-marked', { status: 'EXPIRED' }),
      batch('b-empty', { quantity_available: 0 }),
      batch('b-other', { product_id: OTHER }),
    ]);
    const result = await serviceFor(db).getDispensingBatches(PRODUCT);
    expect(result.productId).toBe(PRODUCT);
    expect(result.batches.map((b) => b.id).sort()).toEqual([
      'b-early',
      'b-late',
      'b-today',
    ]);
    expect(result.batches.find((b) => b.id === 'b-late')).toEqual({
      id: 'b-late',
      batchNumber: 'B-LATE',
      expiryDate: '2099-12-31',
      quantityAvailable: 10,
    });
    // Eligible-but-excluded batches are counted, never silently presented as usable.
    expect(result.excludedBatchCount).toBe(4);
  });

  it('returns an empty list, not an invented batch, when nothing is dispensable', async () => {
    const result = await serviceFor(
      dbWith([batch('b1', { expiry_date: null })]),
    ).getDispensingBatches(PRODUCT);
    expect(result.batches).toEqual([]);
  });

  it('reports an unknown medicine and a database failure as errors', async () => {
    await expect(
      serviceFor(dbWith([])).getDispensingBatches(
        '99999999-9999-4999-8999-999999999999',
      ),
    ).rejects.toMatchObject({ status: 404 });
    await expect(
      serviceFor(
        dbWith([]).fail('product_batches', 'select'),
      ).getDispensingBatches(PRODUCT),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('is open to every workstation role and validates the medicine id', async () => {
    expect(
      Reflect.getMetadata(
        ROLES_KEY,
        InventoryController.prototype.getDispensingBatches,
      ),
    ).toEqual(ALL_ROLES);
    await expect(
      new ParseUUIDPipe().transform('not-a-uuid', {
        type: 'query',
        data: 'productId',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
