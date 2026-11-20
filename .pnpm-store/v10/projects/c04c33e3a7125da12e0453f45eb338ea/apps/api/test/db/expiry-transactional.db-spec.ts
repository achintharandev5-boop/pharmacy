/**
 * Feature #22, Add Expiry Date, over HTTP against a real local PostgreSQL database with every
 * migration applied, in transactional mode (earliest-expiry-first; not enabled anywhere until the
 * pharmacist approves it): a printed batch expiry must match the batch actually dispensed.
 * Isolated test data only; nothing leaves this machine.
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

describe('Add Expiry Date (transactional write path, earliest-expiry-first)', () => {
  let h: Harness;
  let b: Awaited<ReturnType<typeof seed>>;
  const http = () => request(h.app.getHttpServer());
  beforeAll(async () => {
    h = await startHarness('pharmacy_e2e_expiry_tx', 'transactional');
    b = await seed(h);
  }, 60_000);
  afterAll(async () => {
    await h?.close();
  });

  it('refuses a label printed with a batch the allocation would not use, and dispenses nothing', async () => {
    const res = await http()
      .post('/prescriptions')
      .set(auth)
      .send(rx({ expiryDate: '2099-08-31', expiryBatchId: b.late }))
      .expect(409);
    expect(res.body.code).toBe('EXPIRY_BATCH_ALLOCATION_MISMATCH');
    expect(
      (
        await h.db.query(
          `SELECT quantity_available::int AS q FROM product_batches WHERE id = $1`,
          [b.soon],
        )
      ).rows[0].q,
    ).toBe(5);
  });

  it('saves when the printed batch is the batch actually dispensed', async () => {
    const res = await http()
      .post('/prescriptions')
      .set(auth)
      .send(rx({ expiryDate: '2097-01-31', expiryBatchId: b.soon }))
      .expect(201);
    expect(res.body.items[0].allocations).toEqual([
      expect.objectContaining({
        batchId: b.soon,
        batchNumber: 'X-SOON',
        expiryDate: '2097-01-31',
        quantity: 4,
      }),
    ]);
    const item = (
      await h.db.query(
        `SELECT expiry_date::text AS expiry, instructions_json FROM prescription_items WHERE prescription_id = $1`,
        [res.body.id],
      )
    ).rows[0];
    expect(item.expiry).toBe('2097-01-31');
    expect(item.instructions_json.expiryBatch.batchNumber).toBe('X-SOON');
  });

  it('refuses when the printed batch would run out part-way through the label', async () => {
    // One unit left in X-SOON; four requested would also draw from X-LATE.
    const res = await http()
      .post('/prescriptions')
      .set(auth)
      .send(rx({ expiryDate: '2097-01-31', expiryBatchId: b.soon }))
      .expect(409);
    expect(res.body.code).toBe('EXPIRY_BATCH_ALLOCATION_MISMATCH');
  });
});
