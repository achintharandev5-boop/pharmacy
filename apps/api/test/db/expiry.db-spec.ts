/**
 * Feature #22, Add Expiry Date, over HTTP against a real local PostgreSQL database with every
 * migration applied: GRN batch expiry lookup, save-time revalidation and the saved record, in
 * both write modes. Isolated test data only; nothing leaves this machine.
 */
import request from 'supertest';
import { Harness, startHarness, TOKEN, USERS } from './harness';

const P = 'e0e00000-0000-4000-8000-000000000001';
const OTHER = 'e0e00000-0000-4000-8000-000000000002';
const SUPPLIER = 'e0e00000-0000-4000-8000-0000000000b1';
const auth = { Authorization: `Bearer ${TOKEN.staff}` };

async function seed(h: Harness) {
  await h.db.query(
    `INSERT INTO products (id, name, barcode, stock_quantity) VALUES ($1, 'E2E Expiry Tablet', 'E2E-EXP-1', 0), ($2, 'E2E Other Tablet', 'E2E-EXP-2', 0)`,
    [P, OTHER],
  );
  await h.db.query(
    `INSERT INTO suppliers (id, name) VALUES ($1, 'E2E Expiry Supplier')`,
    [SUPPLIER],
  );
  await h.db.query(`SELECT receive_stock($1::jsonb, $2)`, [
    JSON.stringify({
      supplier_id: SUPPLIER,
      items: [
        {
          product_id: P,
          batch_number: 'X-SOON',
          quantity: 5,
          unit_cost: 1,
          expiry_date: '2097-01-31',
        },
        {
          product_id: P,
          batch_number: 'X-LATE',
          quantity: 40,
          unit_cost: 1,
          expiry_date: '2099-08-31',
        },
        {
          product_id: OTHER,
          batch_number: 'O-1',
          quantity: 10,
          unit_cost: 1,
          expiry_date: '2098-03-31',
        },
      ],
    }),
    USERS.pharmacist.id,
  ]);
  const batch = async (n: string) =>
    (
      await h.db.query(
        `SELECT id FROM product_batches WHERE batch_number = $1`,
        [n],
      )
    ).rows[0].id as string;
  return {
    soon: await batch('X-SOON'),
    late: await batch('X-LATE'),
    other: await batch('O-1'),
  };
}

const rx = (item: Record<string, unknown>) => ({
  customerName: 'E2E Expiry Patient',
  items: [
    {
      productId: P,
      quantity: 4,
      dosage: { morning: 1, lunch: 0, night: 1 },
      days: 2,
      finalInstructionText: 'උදේ 1 • රෑ 1 ',
      ...item,
    },
  ],
});

describe('Add Expiry Date (legacy write path)', () => {
  let h: Harness;
  let b: Awaited<ReturnType<typeof seed>>;
  const http = () => request(h.app.getHttpServer());
  beforeAll(async () => {
    h = await startHarness('pharmacy_e2e_expiry', 'legacy');
    b = await seed(h);
  }, 60_000);
  afterAll(async () => {
    await h?.close();
  });

  it('lists the dispensable batches of the medicine with the exact GRN calendar dates', async () => {
    await h.db.query(
      `INSERT INTO product_batches (product_id, batch_number, quantity_received, quantity_available, expiry_date, status) VALUES ($1, 'X-OLD', 3, 3, '2020-01-31', 'ACTIVE')`,
      [P],
    );
    const res = await http()
      .get('/inventory/dispensing-batches')
      .query({ productId: P })
      .set(auth)
      .expect(200);
    expect(res.body).toEqual({
      productId: P,
      batches: [
        {
          id: b.soon,
          batchNumber: 'X-SOON',
          expiryDate: '2097-01-31',
          quantityAvailable: 5,
        },
        {
          id: b.late,
          batchNumber: 'X-LATE',
          expiryDate: '2099-08-31',
          quantityAvailable: 40,
        },
      ],
      excludedBatchCount: 1,
    });
  });

  it('requires a token and a valid medicine id', async () => {
    await http()
      .get('/inventory/dispensing-batches')
      .query({ productId: P })
      .expect(401);
    await http()
      .get('/inventory/dispensing-batches')
      .query({ productId: 'nope' })
      .set(auth)
      .expect(400);
    await http()
      .get('/inventory/dispensing-batches')
      .query({ productId: 'e0e00000-0000-4000-8000-0000000000ff' })
      .set(auth)
      .expect(404);
  });

  it('saves the printed batch expiry exactly, keeping the instruction text byte for byte', async () => {
    const res = await http()
      .post('/prescriptions')
      .set(auth)
      .send(rx({ expiryDate: '2099-08-31', expiryBatchId: b.late }))
      .expect(201);
    const item = (
      await h.db.query(
        `SELECT expiry_date::text AS expiry, instructions_json, final_instruction_text FROM prescription_items WHERE prescription_id = $1`,
        [res.body.id],
      )
    ).rows[0];
    expect(item.expiry).toBe('2099-08-31');
    expect(item.instructions_json.labelExpiryText).toBe('2099-08-31');
    expect(item.instructions_json.expiryBatch).toEqual({
      id: b.late,
      batchNumber: 'X-LATE',
      expiryDate: '2099-08-31',
    });
    expect(item.final_instruction_text).toBe('උදේ 1 • රෑ 1 ');
  });

  it.each([
    [
      'typed date without a batch',
      () => ({ expiryDate: '2099-08-31' }),
      'EXPIRY_BATCH_REQUIRED',
    ],
    [
      'batch of another medicine',
      () => ({ expiryDate: '2098-03-31', expiryBatchId: b.other }),
      'EXPIRY_BATCH_MISMATCH',
    ],
    [
      'date that differs from the GRN record',
      () => ({ expiryDate: '2099-09-30', expiryBatchId: b.late }),
      'EXPIRY_BATCH_MISMATCH',
    ],
  ])('refuses a %s and saves nothing', async (_name, over, code) => {
    const before = (
      await h.db.query(`SELECT count(*)::int AS n FROM prescriptions`)
    ).rows[0].n;
    const res = await http()
      .post('/prescriptions')
      .set(auth)
      .send(rx(over()))
      .expect(400);
    expect(res.body.code).toBe(code);
    expect(
      (await h.db.query(`SELECT count(*)::int AS n FROM prescriptions`)).rows[0]
        .n,
    ).toBe(before);
  });

  it('refuses a stale reference to a batch quarantined after the label was prepared', async () => {
    await http()
      .post(`/inventory/batches/${b.soon}/quarantine`)
      .set({ Authorization: `Bearer ${TOKEN.pharmacist}` })
      .send({ reason: 'E2E expiry recall' })
      .expect(201);
    const res = await http()
      .post('/prescriptions')
      .set(auth)
      .send(
        rx({ quantity: 1, expiryDate: '2097-01-31', expiryBatchId: b.soon }),
      )
      .expect(400);
    expect(res.body.code).toBe('EXPIRY_BATCH_MISMATCH');
    const list = await http()
      .get('/inventory/dispensing-batches')
      .query({ productId: P })
      .set(auth)
      .expect(200);
    expect(list.body.batches.map((x: any) => x.batchNumber)).toEqual([
      'X-LATE',
    ]);
  });
});
