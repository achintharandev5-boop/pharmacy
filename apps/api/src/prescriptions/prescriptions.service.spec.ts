import {
  BadRequestException,
  ConflictException,
  HttpException,
  InternalServerErrorException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrescriptionsService } from './prescriptions.service';
import { SupabaseService } from '../supabase/supabase.service';
import { FakeSupabase } from '../test-utils/fake-supabase';
import type { CreatePrescriptionDto } from './dto/create-prescription.dto';
import { generatePrescriptionNumber } from '../domain/prescription/prescription.rules';

const PANADOL = '11111111-1111-4111-8111-111111111111';
const AMOX = '22222222-2222-4222-8222-222222222222';
const EXPIRED = '33333333-3333-4333-8333-333333333333';
const PATIENT = '44444444-4444-4444-8444-444444444444';
const USER = '55555555-5555-4555-8555-555555555555';
const BATCH_A = '66666666-6666-4666-8666-666666666661';
const BATCH_B = '66666666-6666-4666-8666-666666666662';

function seed() {
  const db = new FakeSupabase({
    products: [
      { id: PANADOL, name: 'Panadol 500mg', stock_quantity: 100, expiry_date: '2030-01-01', is_active: true },
      { id: AMOX, name: 'Amoxicillin 250mg', stock_quantity: 10, expiry_date: null },
      { id: EXPIRED, name: 'Old Syrup', stock_quantity: 50, expiry_date: '2020-01-01' },
    ],
    customers: [{ id: PATIENT, name: 'Registered Patient', phone_number: '0771234567' }],
  });
  db.unique = { prescriptions: [['prescription_number']], idempotency_keys: [['key']] };
  return db;
}

function serviceFor(db: FakeSupabase) {
  const supabase = { getClient: () => db.client() } as unknown as SupabaseService;
  const config = { get: () => 'Asia/Colombo' } as unknown as ConfigService;
  return new PrescriptionsService(supabase, config);
}

const item = (over: Partial<CreatePrescriptionDto['items'][number]> = {}) => ({
  productId: PANADOL,
  quantity: 10,
  dosage: { morning: 1, lunch: 0, night: 1 },
  days: 5,
  ...over,
});

const rx = (over: Partial<CreatePrescriptionDto> = {}): CreatePrescriptionDto => ({
  customerName: 'Walk-in Patient',
  items: [item()],
  ...over,
});

function stockOf(db: FakeSupabase, id: string) {
  return db.table('products').find((p) => p.id === id)!.stock_quantity;
}

function expectNothingSaved(db: FakeSupabase) {
  expect(db.table('prescriptions')).toHaveLength(0);
  expect(db.table('prescription_items')).toHaveLength(0);
  expect(db.table('inventory_movements')).toHaveLength(0);
}

describe('PrescriptionsService.create', () => {
  it('saves header, items, stock, movements and audit event, attributed to the user', async () => {
    const db = seed();
    const result = await serviceFor(db).create(
      rx({ customerId: PATIENT, items: [item(), item({ productId: AMOX, quantity: 4 })] }),
      undefined,
      USER,
    );

    expect(result).toMatchObject({ status: 'COMPLETED', itemCount: 2, customerName: 'Walk-in Patient' });
    expect(result.prescriptionNumber).toMatch(/^RX-\d{8}-000001$/);
    expect(db.table('prescriptions')[0]).toMatchObject({ created_by: USER, customer_id: PATIENT });
    expect(db.table('prescription_items')).toHaveLength(2);
    expect(stockOf(db, PANADOL)).toBe(90);
    expect(stockOf(db, AMOX)).toBe(6);
    expect(db.table('inventory_movements')).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ product_id: PANADOL, quantity: -10, stock_before: 100, stock_after: 90, created_by: USER }),
        expect.objectContaining({ product_id: AMOX, quantity: -4, stock_before: 10, stock_after: 6 }),
      ]),
    );
    expect(db.table('prescription_events')).toEqual([expect.objectContaining({ event_type: 'CREATED', user_id: USER })]);
  });

  it('stores the printed instruction text when the client sends it', async () => {
    const db = seed();
    await serviceFor(db).create(
      rx({ items: [item({ finalInstructionText: 'උදේ 1 • රෑ 1' })] }),
      undefined,
      USER,
    );
    expect(db.table('prescription_items')[0].final_instruction_text).toBe(
      'උදේ 1 • රෑ 1',
    );
  });

  it('preserves ENT metadata and the printed text in the existing label record', async () => {
    const db = seed();
    const ent = {
      customHours: 3,
      startDay: '2026-11-01',
      endDay: '2026-11-04',
      site: 'ear' as const,
      direction: 'right' as const,
      unit: 'drop',
      pluralUnit: 'drops',
      template: 'Instill {qty} {unit} into {location} {time}.',
    };
    const text = 'Instill 3 drops into the right ear in the morning.';
    await serviceFor(db).create(
      rx({ items: [item({ ent, finalInstructionText: text })] }),
      undefined,
      USER,
    );
    const saved = db.table('prescription_items')[0];
    expect(saved.instructions_json.ent).toEqual(ent);
    expect(saved.final_instruction_text).toBe(text);
  });

  it('rejects reversed ENT dates without saving or dispensing', async () => {
    const db = seed();
    const ent = {
      site: 'eye' as const,
      direction: 'both' as const,
      unit: 'drop',
      pluralUnit: 'drops',
      template: '{qty} {unit} {location} {time}',
      startDay: '2026-11-05',
      endDay: '2026-11-01',
    };
    await expect(
      serviceFor(db).create(rx({ items: [item({ ent })] }), undefined, USER),
    ).rejects.toBeInstanceOf(BadRequestException);
    expectNothingSaved(db);
    expect(stockOf(db, PANADOL)).toBe(100);
  });

  it('refuses a typed label expiry that does not come from a GRN batch (Feature #22)', async () => {
    for (const over of [
      { expiryDate: '1/8/2028' },
      { expiryDate: '2099-01-31' },
      { expiryBatchId: BATCH_A },
    ]) {
      const db = seed();
      const err = await serviceFor(db)
        .create(rx({ items: [item(over)] }), undefined, USER)
        .catch((e) => e);
      expect(err).toBeInstanceOf(BadRequestException);
      expect(err.getResponse()).toMatchObject({
        code: 'EXPIRY_BATCH_REQUIRED',
      });
      expectNothingSaved(db);
    }
  });

  describe('never reports success when a write fails', () => {
    it('fails with 503 when the header insert fails, and saves nothing', async () => {
      const db = seed().fail('prescriptions', 'insert');
      await expect(
        serviceFor(db).create(rx(), undefined, USER),
      ).rejects.toBeInstanceOf(ServiceUnavailableException);
      expectNothingSaved(db);
      expect(stockOf(db, PANADOL)).toBe(100);
    });

    it('rolls back the header when the item insert fails', async () => {
      const db = seed().fail('prescription_items', 'insert');
      await expect(
        serviceFor(db).create(rx(), undefined, USER),
      ).rejects.toBeInstanceOf(ServiceUnavailableException);
      expectNothingSaved(db);
      expect(stockOf(db, PANADOL)).toBe(100);
    });

    it('restores stock and removes the prescription when the movement audit fails', async () => {
      const db = seed().fail('inventory_movements', 'insert');
      await expect(
        serviceFor(db).create(rx(), undefined, USER),
      ).rejects.toBeInstanceOf(ServiceUnavailableException);
      expectNothingSaved(db);
      expect(stockOf(db, PANADOL)).toBe(100);
    });

    it('restores stock when the audit event fails', async () => {
      const db = seed().fail('prescription_events', 'insert');
      await expect(
        serviceFor(db).create(rx(), undefined, USER),
      ).rejects.toBeInstanceOf(ServiceUnavailableException);
      expectNothingSaved(db);
      expect(stockOf(db, PANADOL)).toBe(100);
    });

    it('reports RECONCILIATION_REQUIRED when the reversal itself fails', async () => {
      const db = seed()
        .fail('prescription_events', 'insert')
        .fail('prescriptions', 'delete');
      const err = await serviceFor(db)
        .create(rx(), undefined, USER)
        .catch((e) => e);
      expect(err).toBeInstanceOf(InternalServerErrorException);
      expect((err as HttpException).getResponse()).toMatchObject({
        code: 'RECONCILIATION_REQUIRED',
      });
    });

    it('fails when the product lookup errors instead of treating the product as unknown', async () => {
      const db = seed().fail('products', 'select');
      await expect(
        serviceFor(db).create(rx(), undefined, USER),
      ).rejects.toBeInstanceOf(ServiceUnavailableException);
      expectNothingSaved(db);
    });
  });

  describe('validation', () => {
    it('rejects a product id that is not in the catalogue', async () => {
      const db = seed();
      const err = await serviceFor(db)
        .create(
          rx({
            items: [
              item({ productId: '99999999-9999-4999-8999-999999999999' }),
            ],
          }),
          undefined,
          USER,
        )
        .catch((e) => e);
      expect(err).toBeInstanceOf(BadRequestException);
      expect(err.getResponse()).toMatchObject({ code: 'PRODUCT_NOT_FOUND' });
      expectNothingSaved(db);
    });

    it('rejects insufficient stock, counting every label for the same product', async () => {
      const db = seed();
      const err = await serviceFor(db)
        .create(
          rx({
            items: [
              item({ productId: AMOX, quantity: 6 }),
              item({ productId: AMOX, quantity: 6 }),
            ],
          }),
          undefined,
          USER,
        )
        .catch((e) => e);
      expect(err).toBeInstanceOf(ConflictException);
      expect(err.getResponse()).toMatchObject({
        code: 'INSUFFICIENT_STOCK',
        requested: 12,
        available: 10,
      });
      expect(stockOf(db, AMOX)).toBe(10);
    });

    it('rejects an expired product', async () => {
      const db = seed();
      const err = await serviceFor(db)
        .create(
          rx({ items: [item({ productId: EXPIRED, quantity: 1 })] }),
          undefined,
          USER,
        )
        .catch((e) => e);
      expect(err).toBeInstanceOf(BadRequestException);
      expect(err.getResponse()).toMatchObject({ code: 'PRODUCT_EXPIRED' });
    });

    it('rejects a label whose printed expiry has passed', async () => {
      const db = seed();
      await expect(
        serviceFor(db).create(
          rx({ items: [item({ expiryDate: '2020-01-31' })] }),
          undefined,
          USER,
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects an unknown patient id', async () => {
      const db = seed();
      await expect(
        serviceFor(db).create(
          rx({ customerId: '99999999-9999-4999-8999-999999999999' }),
          undefined,
          USER,
        ),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('requires a medicine name for a label without a catalogue product', async () => {
      const db = seed();
      await expect(
        serviceFor(db).create(
          rx({ items: [item({ productId: undefined })] }),
          undefined,
          USER,
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('saves a manually named medicine without touching stock', async () => {
      const db = seed();
      await serviceFor(db).create(
        rx({
          items: [
            item({
              productId: undefined,
              alternativeProductName: 'Herbal balm',
            }),
          ],
        }),
        undefined,
        USER,
      );
      expect(db.table('prescription_items')[0]).toMatchObject({
        product_id: null,
        product_name_snapshot: 'Herbal balm',
      });
      expect(db.table('inventory_movements')).toHaveLength(0);
    });

    it('rejects incompatible instruction combinations', async () => {
      const db = seed();
      await expect(
        serviceFor(db).create(
          rx({ items: [item({ instructions: ['BEFORE', 'AFTER'] })] }),
          undefined,
          USER,
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('concurrency', () => {
    it('does not overwrite a concurrent stock change (compare-and-set)', async () => {
      const db = seed();
      let interfered = false;
      db.beforeUpdate = (table) => {
        if (table === 'products' && !interfered) {
          interfered = true;
          // Another dispense takes 5 units between our read and our write.
          db.table('products').find((p) => p.id === PANADOL)!.stock_quantity =
            95;
        }
      };
      await serviceFor(db).create(rx(), undefined, USER);
      expect(stockOf(db, PANADOL)).toBe(85);
      expect(db.table('inventory_movements')[0]).toMatchObject({
        stock_before: 95,
        stock_after: 85,
      });
    });

    it('retries the prescription number when another request took it', async () => {
      const db = seed();
      // One existing row, so the first attempt uses sequence 2, which is already taken.
      db.table('prescriptions').push({
        id: 'existing',
        prescription_number: generatePrescriptionNumber(2),
      });
      const result = await serviceFor(db).create(rx(), undefined, USER);
      expect(result.prescriptionNumber).toBe(generatePrescriptionNumber(3));
    });
  });

  describe('idempotency', () => {
    it('returns the stored result for a repeated key without saving twice', async () => {
      const db = seed();
      const service = serviceFor(db);
      const a = await service.create(rx(), 'key-12345678', USER);
      const b = await service.create(rx(), 'key-12345678', USER);
      expect(b).toEqual(a);
      expect(db.table('prescriptions')).toHaveLength(1);
      expect(stockOf(db, PANADOL)).toBe(90);
    });

    it('rejects a duplicate request that is still in progress', async () => {
      const db = seed();
      db.table('idempotency_keys').push({
        key: 'key-inflight',
        response_payload: { status: 'PENDING' },
      });
      await expect(
        serviceFor(db).create(rx(), 'key-inflight', USER),
      ).rejects.toBeInstanceOf(ConflictException);
      expectNothingSaved(db);
    });

    it('releases the key after a failure so the client can retry', async () => {
      const db = seed().fail(
        'prescription_items',
        'insert',
        { message: 'fetch failed' },
        1,
      );
      const service = serviceFor(db);
      await expect(
        service.create(rx(), 'key-retry-01', USER),
      ).rejects.toBeInstanceOf(ServiceUnavailableException);
      expect(db.table('idempotency_keys')).toHaveLength(0);
      await expect(
        service.create(rx(), 'key-retry-01', USER),
      ).resolves.toMatchObject({ status: 'COMPLETED' });
    });

    it('rejects a malformed key', async () => {
      await expect(
        serviceFor(seed()).create(rx(), 'bad key!', USER),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });
});

describe('PrescriptionsService print and SMS logging', () => {
  const RX = '66666666-6666-4666-8666-666666666666';

  it('records a print event attributed to the user', async () => {
    const db = new FakeSupabase({ prescriptions: [{ id: RX }] });
    await serviceFor(db).logPrint(RX, USER);
    expect(db.table('prescription_events')).toEqual([
      expect.objectContaining({ event_type: 'PRINTED', user_id: USER }),
    ]);
    expect(db.table('prescriptions')[0].printed_at).toBeTruthy();
  });

  it('fails instead of reporting success when the print cannot be recorded', async () => {
    const db = new FakeSupabase({ prescriptions: [{ id: RX }] }).fail(
      'prescription_events',
      'insert',
    );
    await expect(serviceFor(db).logPrint(RX, USER)).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });

  it('returns 404 for an unknown prescription', async () => {
    await expect(
      serviceFor(new FakeSupabase()).logPrint(RX, USER),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('records failed SMS attempts as failures', async () => {
    const db = new FakeSupabase({ prescriptions: [{ id: RX }] });
    await serviceFor(db).logSms(
      RX,
      {
        recipient: '0771234567',
        status: 'FAILED',
        messageLength: 120,
        failureReason: 'gateway',
      },
      USER,
    );
    expect(db.table('prescription_events')[0]).toMatchObject({
      event_type: 'SMS_FAILED',
      metadata: expect.objectContaining({
        recipient: '94771234567',
        failureReason: 'gateway',
      }),
    });
  });
});

describe('PrescriptionsService batch expiry guard (legacy write path)', () => {
  function withBatches(batches: Record<string, unknown>[]) {
    const db = seed();
    db.tables.product_batches = batches;
    return db;
  }

  it('does not count units in expired, quarantined or undated batches as available', async () => {
    const db = withBatches([
      {
        product_id: AMOX,
        quantity_available: 3,
        expiry_date: '2020-01-01',
        status: 'ACTIVE',
      },
      {
        product_id: AMOX,
        quantity_available: 2,
        expiry_date: '2099-01-01',
        status: 'QUARANTINED',
      },
      {
        product_id: AMOX,
        quantity_available: 1,
        expiry_date: null,
        status: 'ACTIVE',
      },
      {
        product_id: AMOX,
        quantity_available: 4,
        expiry_date: '2099-01-01',
        status: 'ACTIVE',
      },
    ]);
    // Total 10 recorded, of which 6 are not dispensable.
    const err = await serviceFor(db)
      .create(
        rx({ items: [item({ productId: AMOX, quantity: 5 })] }),
        undefined,
        USER,
      )
      .catch((e: HttpException) => e);
    expect(err).toBeInstanceOf(ConflictException);
    expect((err as HttpException).getResponse()).toMatchObject({
      code: 'INSUFFICIENT_STOCK',
      available: 4,
    });
    expectNothingSaved(db);

    await serviceFor(db).create(
      rx({ items: [item({ productId: AMOX, quantity: 4 })] }),
      undefined,
      USER,
    );
    expect(stockOf(db, AMOX)).toBe(6);
  });

  it('fails closed when batch records cannot be read', async () => {
    const db = seed().fail('product_batches', 'select');
    await expect(
      serviceFor(db).create(rx(), undefined, USER),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
    expectNothingSaved(db);
  });
});

describe('PrescriptionsService transactional write mode (create_prescription)', () => {
  function transactional(db: FakeSupabase) {
    const supabase = {
      getClient: () => db.client(),
    } as unknown as SupabaseService;
    const values: Record<string, string> = {
      PHARMACY_TIMEZONE: 'Asia/Colombo',
      PRESCRIPTION_WRITE_MODE: 'transactional',
    };
    return new PrescriptionsService(supabase, {
      get: (k: string) => values[k],
    } as unknown as ConfigService);
  }

  it('is off unless explicitly configured', () => {
    expect(serviceFor(seed()).writeMode).toBe('legacy');
    expect(transactional(seed()).writeMode).toBe('transactional');
  });

  it('sends the same item rows as the legacy path, with the user and idempotency key', async () => {
    const db = seed();
    let args: any;
    db.rpcHandlers.create_prescription = (a) => {
      args = a;
      return {
        data: {
          id: 'rx-1',
          prescriptionNumber: 'RX-20261010-000001',
          status: 'COMPLETED',
          customerName: 'Walk-in Patient',
          customerPhone: '94771234567',
          itemCount: 1,
          createdAt: 'now',
          items: [
            {
              itemId: 'i1',
              productId: PANADOL,
              allocations: [
                {
                  batchId: 'b1',
                  batchNumber: 'B1',
                  expiryDate: '2099-01-01',
                  quantity: 10,
                },
              ],
            },
          ],
        },
        error: null,
      };
    };
    const result = await transactional(db).create(
      rx({
        customerPhone: '0771234567',
        items: [item({ finalInstructionText: 'උදේ 1 • රෑ 1' })],
      }),
      'rx-key-123456',
      USER,
    );

    expect(args.p_user_id).toBe(USER);
    expect(args.p_idempotency_key).toBe('rx-key-123456');
    expect(args.p_payload).toMatchObject({
      customer_name: 'Walk-in Patient',
      customer_phone: '94771234567',
    });
    expect(args.p_payload.items[0]).toEqual(
      expect.objectContaining({
        product_id: PANADOL,
        quantity: 10,
        morning_qty: 1,
        night_qty: 1,
        days: 5,
        expiry_date: null,
        final_instruction_text: 'උදේ 1 • රෑ 1',
        instructions_json: expect.objectContaining({
          labelExpiryText: null,
          expiryBatch: null,
        }),
      }),
    );
    expect(args.p_payload.items[0]).not.toHaveProperty('prescription_id');
    expect(result.items?.[0].allocations[0].batchNumber).toBe('B1');
    // Nothing is written outside the database function.
    expect(db.table('prescriptions')).toHaveLength(0);
    expect(db.table('idempotency_keys')).toHaveLength(0);
  });

  it('runs the shared validation before calling the database', async () => {
    const db = seed();
    const called = jest.fn();
    db.rpcHandlers.create_prescription = () => {
      called();
      return { data: null, error: null };
    };
    await expect(transactional(db).create(rx({ items: [item({ productId: AMOX, quantity: 1.5 })] }), undefined, USER)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await expect(transactional(db).create(rx({ items: [item({ expiryDate: '2020-01-01' })] }), undefined, USER)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(called).not.toHaveBeenCalled();
  });

  it('maps the database refusals to HTTP errors', async () => {
    const db = seed();
    db.rpcHandlers.create_prescription = () => ({
      data: null,
      error: { code: 'P0001', hint: 'INSUFFICIENT_STOCK', message: 'Not enough dispensable stock of Panadol 500mg for 10 unit(s).' } as any,
    });
    await expect(transactional(db).create(rx(), undefined, USER)).rejects.toBeInstanceOf(ConflictException);

    db.rpcHandlers.create_prescription = () => ({ data: null, error: { code: 'P0001', hint: 'EXPIRY_UNKNOWN', message: 'x' } as any });
    await expect(transactional(db).create(rx(), undefined, USER)).rejects.toBeInstanceOf(BadRequestException);

    db.rpcHandlers.create_prescription = () => ({ data: null, error: { message: 'fetch failed' } });
    await expect(transactional(db).create(rx(), undefined, USER)).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('reports a missing database function as an out-of-date schema', async () => {
    const err = await transactional(seed()).create(rx(), undefined, USER).catch((e: HttpException) => e);
    expect(err).toBeInstanceOf(ServiceUnavailableException);
    expect((err as HttpException).getResponse()).toMatchObject({ code: 'SCHEMA_OUT_OF_DATE' });
  });
});

describe('PrescriptionsService printed batch expiry (Feature #22)', () => {
  const batch = (over: Record<string, unknown> = {}) => ({
    id: BATCH_A,
    product_id: PANADOL,
    batch_number: 'PA-1',
    expiry_date: '2099-08-31',
    quantity_available: 40,
    status: 'ACTIVE',
    received_at: '2026-01-01T00:00:00Z',
    ...over,
  });
  function withBatches(batches: Record<string, unknown>[]) {
    const db = seed();
    db.tables.product_batches = batches;
    return db;
  }
  function transactional(db: FakeSupabase) {
    const supabase = {
      getClient: () => db.client(),
    } as unknown as SupabaseService;
    const values: Record<string, string> = {
      PHARMACY_TIMEZONE: 'Asia/Colombo',
      PRESCRIPTION_WRITE_MODE: 'transactional',
    };
    return new PrescriptionsService(supabase, {
      get: (k: string) => values[k],
    } as unknown as ConfigService);
  }
  const printed = { expiryBatchId: BATCH_A, expiryDate: '2099-08-31' };

  it('saves the exact verified batch expiry with the label, without changing the instruction text', async () => {
    const db = withBatches([batch()]);
    await serviceFor(db).create(
      rx({
        items: [item({ ...printed, finalInstructionText: 'උදේ 1 • රෑ 1 ' })],
      }),
      undefined,
      USER,
    );
    const saved = db.table('prescription_items')[0];
    expect(saved.expiry_date).toBe('2099-08-31');
    expect(saved.instructions_json.labelExpiryText).toBe('2099-08-31');
    expect(saved.instructions_json.expiryBatch).toEqual({
      id: BATCH_A,
      batchNumber: 'PA-1',
      expiryDate: '2099-08-31',
    });
    // The expiry is its own field; the administration sentence is saved byte for byte.
    expect(saved.final_instruction_text).toBe('උදේ 1 • රෑ 1 ');
  });

  it.each([
    ['an unknown batch', [], printed],
    ['a batch of another medicine', [batch({ product_id: AMOX })], printed],
    [
      'a changed GRN expiry (stale reference)',
      [batch({ expiry_date: '2099-09-30' })],
      printed,
    ],
    ['a quarantined batch', [batch({ status: 'QUARANTINED' })], printed],
    ['an empty batch', [batch({ quantity_available: 0 })], printed],
    [
      'an expired batch',
      [batch({ expiry_date: '2020-01-01' })],
      { expiryBatchId: BATCH_A, expiryDate: '2099-08-31' },
    ],
  ])('refuses %s and saves nothing', async (_name, batches, over) => {
    const db = withBatches(batches as Record<string, unknown>[]);
    const err = await serviceFor(db)
      .create(rx({ items: [item(over)] }), undefined, USER)
      .catch((e) => e);
    expect(err).toBeInstanceOf(BadRequestException);
    expect(err.getResponse()).toMatchObject({
      code: 'EXPIRY_BATCH_MISMATCH',
      message: expect.stringContaining('Label 1'),
    });
    expectNothingSaved(db);
    expect(stockOf(db, PANADOL)).toBe(100);
  });

  it('names the affected label when several labels are saved', async () => {
    const db = withBatches([batch()]);
    const err = await serviceFor(db)
      .create(
        rx({
          items: [
            item(printed),
            item({ expiryBatchId: BATCH_A, expiryDate: '2099-08-30' }),
          ],
        }),
        undefined,
        USER,
      )
      .catch((e) => e);
    expect(err.getResponse()).toMatchObject({
      code: 'EXPIRY_BATCH_MISMATCH',
      message: expect.stringContaining('Label 2'),
    });
  });

  it('accepts a later-expiring batch chosen by the pharmacist in the legacy path (stock is deducted per product)', async () => {
    const db = withBatches([
      batch({ id: BATCH_B, batch_number: 'PA-0', expiry_date: '2098-01-31' }),
      batch(),
    ]);
    await serviceFor(db).create(
      rx({ items: [item(printed)] }),
      undefined,
      USER,
    );
    expect(
      db.table('prescription_items')[0].instructions_json.expiryBatch
        .batchNumber,
    ).toBe('PA-1');
  });

  describe('transactional mode (earliest-expiry-first)', () => {
    const ok = () => ({
      data: {
        id: 'rx-1',
        prescriptionNumber: 'RX-1',
        status: 'COMPLETED',
        customerName: 'x',
        customerPhone: null,
        itemCount: 1,
        createdAt: 'now',
      },
      error: null,
    });

    it('accepts the printed batch when it supplies every unit', async () => {
      const db = withBatches([batch()]);
      let args: any;
      db.rpcHandlers.create_prescription = (a) => ((args = a), ok());
      await transactional(db).create(
        rx({ items: [item(printed)] }),
        undefined,
        USER,
      );
      expect(args.p_payload.items[0].instructions_json.expiryBatch).toEqual({
        id: BATCH_A,
        batchNumber: 'PA-1',
        expiryDate: '2099-08-31',
      });
    });

    it.each([
      [
        'an earlier-expiring batch would be used first',
        [
          batch({
            id: BATCH_B,
            batch_number: 'PA-0',
            expiry_date: '2098-01-31',
          }),
          batch(),
        ],
        [item(printed)],
      ],
      [
        'the printed batch runs out part-way',
        [
          batch({ quantity_available: 6 }),
          batch({
            id: BATCH_B,
            batch_number: 'PA-2',
            expiry_date: '2099-12-31',
          }),
        ],
        [item(printed)],
      ],
      [
        'an earlier label uses up the printed batch',
        [
          batch({ quantity_available: 12 }),
          batch({
            id: BATCH_B,
            batch_number: 'PA-2',
            expiry_date: '2099-12-31',
          }),
        ],
        [item(), item(printed)],
      ],
    ])('refuses before writing when %s', async (_name, batches, items) => {
      const db = withBatches(batches as Record<string, unknown>[]);
      const called = jest.fn();
      db.rpcHandlers.create_prescription = () => (called(), ok());
      const err = await transactional(db)
        .create(rx({ items }), undefined, USER)
        .catch((e) => e);
      expect(err).toBeInstanceOf(ConflictException);
      expect(err.getResponse()).toMatchObject({
        code: 'EXPIRY_BATCH_ALLOCATION_MISMATCH',
      });
      expect(called).not.toHaveBeenCalled();
    });
  });
});
