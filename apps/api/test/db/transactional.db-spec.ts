/**
 * Prescription creation through `create_prescription` (PRESCRIPTION_WRITE_MODE=transactional)
 * over HTTP against a real local PostgreSQL database. This mode is NOT enabled in any
 * environment until the pharmacist approves the allocation rules; these tests show what it
 * would do. Isolated test data only.
 */
import request from 'supertest';
import { Harness, startHarness, TOKEN, USERS } from './harness';

let h: Harness;
const auth = { Authorization: `Bearer ${TOKEN.staff}` };
const http = () => request(h.app.getHttpServer());
const one = async (sql: string, params: unknown[] = []) => (await h.db.query(sql, params)).rows[0];
const P = 'cafe0000-0000-4000-8000-000000000001';
const PATIENT = 'cafe0000-0000-4000-8000-0000000000a1';

beforeAll(async () => {
  h = await startHarness('pharmacy_e2e_transactional', 'transactional');
  await h.db.query(`INSERT INTO customers (id, name, phone_number) VALUES ($1, 'E2E FEFO Patient', '0700000009')`, [PATIENT]);
  await h.db.query(`INSERT INTO products (id, name, barcode, stock_quantity) VALUES ($1, 'E2E FEFO Tablet', 'E2E-FEFO', 0)`, [P]);
  await h.db.query(`INSERT INTO suppliers (id, name) VALUES ('cafe0000-0000-4000-8000-0000000000b1', 'E2E Supplier')`);
  await h.db.query(
    `SELECT receive_stock($1::jsonb, $2)`,
    [
      JSON.stringify({
        supplier_id: 'cafe0000-0000-4000-8000-0000000000b1',
        items: [
          { product_id: P, batch_number: 'F-LATE', quantity: 20, unit_cost: 1, expiry_date: '2099-12-31' },
          { product_id: P, batch_number: 'F-SOON', quantity: 6, unit_cost: 1, expiry_date: '2097-01-31' },
          { product_id: P, batch_number: 'F-MID', quantity: 4, unit_cost: 1, expiry_date: '2098-06-30' },
        ],
      }),
      USERS.pharmacist.id,
    ],
  );
}, 60_000);
afterAll(async () => {
  await h?.close();
});

const body = (quantity: number) => ({
  customerId: PATIENT,
  customerName: 'E2E FEFO Patient',
  items: [{ productId: P, quantity, dosage: { morning: 1, lunch: 1, night: 1 }, days: 3, finalInstructionText: 'උදේ 1 • දවල් 1 • රෑ 1' }],
});

describe('Batch-level allocation (create_prescription)', () => {
  it('takes units from the earliest-expiring eligible batches and reports them', async () => {
    const res = await http().post('/prescriptions').set(auth).set('Idempotency-Key', 'e2e-fefo-0001').send(body(9)).expect(201);
    expect(res.body.items[0].allocations.map((a: any) => [a.batchNumber, a.quantity])).toEqual([
      ['F-SOON', 6],
      ['F-MID', 3],
    ]);
    const batches = (await h.db.query(`SELECT batch_number, quantity_available, status FROM product_batches WHERE product_id = $1 ORDER BY expiry_date`, [P])).rows;
    expect(batches).toEqual([
      { batch_number: 'F-SOON', quantity_available: 0, status: 'DEPLETED' },
      { batch_number: 'F-MID', quantity_available: 1, status: 'ACTIVE' },
      { batch_number: 'F-LATE', quantity_available: 20, status: 'ACTIVE' },
    ]);
    expect((await one('SELECT stock_quantity FROM products WHERE id = $1', [P])).stock_quantity).toBe(21);
    const item = await one('SELECT final_instruction_text FROM prescription_items WHERE prescription_id = $1', [res.body.id]);
    expect(item.final_instruction_text).toBe('උදේ 1 • දවල් 1 • රෑ 1');
    const ledger = (await h.db.query(`SELECT quantity, created_by FROM inventory_movements WHERE prescription_id = $1 ORDER BY quantity`, [res.body.id])).rows;
    expect(ledger).toEqual([
      { quantity: -6, created_by: USERS.staff.id },
      { quantity: -3, created_by: USERS.staff.id },
    ]);
  });

  it('returns the first result for a retry with the same key and dispenses nothing more', async () => {
    const first = await one(`SELECT id FROM prescriptions ORDER BY created_at LIMIT 1`);
    const res = await http().post('/prescriptions').set(auth).set('Idempotency-Key', 'e2e-fefo-0001').send(body(9)).expect(201);
    expect(res.body.id).toBe(first.id);
    expect((await one('SELECT stock_quantity FROM products WHERE id = $1', [P])).stock_quantity).toBe(21);
  });

  it('skips a quarantined batch, and refuses when only quarantined units would cover the request', async () => {
    const late = (await one(`SELECT id FROM product_batches WHERE batch_number = 'F-LATE'`)).id;
    await http().post(`/inventory/batches/${late}/quarantine`).set({ Authorization: `Bearer ${TOKEN.pharmacist}` }).send({ reason: 'E2E recall notice' }).expect(201);
    const res = await http().post('/prescriptions').set(auth).send(body(2)).expect(409);
    expect(res.body.code).toBe('INSUFFICIENT_STOCK');
    expect((await one('SELECT stock_quantity FROM products WHERE id = $1', [P])).stock_quantity).toBe(21);
    const ok = await http().post('/prescriptions').set(auth).send(body(1)).expect(201);
    expect(ok.body.items[0].allocations[0].batchNumber).toBe('F-MID');
  });

  it('rolls back the whole prescription when a later label fails', async () => {
    const before = await one('SELECT count(*)::int AS n FROM prescriptions');
    await http()
      .post('/prescriptions')
      .set(auth)
      .send({ customerName: 'E2E', items: [{ alternativeProductName: 'Own supply', quantity: 1 }, { productId: P, quantity: 500 }] })
      .expect(409);
    expect(await one('SELECT count(*)::int AS n FROM prescriptions')).toEqual(before);
    expect(await one(`SELECT count(*)::int AS n FROM prescription_items WHERE alternative_product_name = 'Own supply'`)).toEqual({ n: 0 });
  });

  it('refuses an unknown patient reference', async () => {
    await http()
      .post('/prescriptions')
      .set(auth)
      .send({ customerId: 'cafe0000-0000-4000-8000-0000000000ff', customerName: 'E2E', items: [{ alternativeProductName: 'Own supply', quantity: 1 }] })
      .expect(404);
  });

  it('keeps the ledger balanced and the batches consistent with the product total', async () => {
    expect(await one('SELECT bool_and(stock_after = stock_before + quantity) AS ok FROM inventory_movements')).toEqual({ ok: true });
    const t = await one(`SELECT (SELECT stock_quantity FROM products WHERE id = $1) AS total, (SELECT sum(quantity_available)::int FROM product_batches WHERE product_id = $1) AS batches`, [P]);
    expect(t.total).toBe(t.batches);
  });
});
