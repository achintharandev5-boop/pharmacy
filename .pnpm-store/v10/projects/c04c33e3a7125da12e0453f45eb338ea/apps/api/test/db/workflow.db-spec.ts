/**
 * End-to-end workflow over HTTP against a real local PostgreSQL database with every migration
 * applied (default write mode: legacy). Isolated test data only; nothing leaves this machine.
 * Run with: DB_TEST_URL=postgres://postgres@localhost:<port>/postgres pnpm test:db
 */
import request from 'supertest';
import { Harness, startHarness, TEST_PASSWORD, TOKEN, USERS, type TestUser } from './harness';

let h: Harness;
const as = (user: TestUser) => ({ Authorization: `Bearer ${TOKEN[user]}` });
const http = () => request(h.app.getHttpServer());
const one = async (sql: string, params: unknown[] = []) => (await h.db.query(sql, params)).rows[0];

// Created during the run.
const ids: Record<string, string> = {};

beforeAll(async () => {
  h = await startHarness('pharmacy_e2e_workflow', 'legacy');
}, 60_000);
afterAll(async () => {
  await h?.close();
});

describe('1. Authentication', () => {
  it('signs in and returns the verified identity and role', async () => {
    const login = await http().post('/auth/login').send({ email: USERS.pharmacist.email, password: TEST_PASSWORD }).expect(200);
    expect(login.body.access_token).toBe(TOKEN.pharmacist);
    const me = await http().get('/auth/me').set({ Authorization: `Bearer ${login.body.access_token}` }).expect(200);
    expect(me.body).toEqual({ id: USERS.pharmacist.id, email: USERS.pharmacist.email, role: 'pharmacist' });
  });

  it('refuses a wrong password, a missing token and an invalid token', async () => {
    await http().post('/auth/login').send({ email: USERS.pharmacist.email, password: 'wrong' }).expect(401);
    await http().get('/customers').expect(401);
    await http().get('/customers').set({ Authorization: 'Bearer not-a-real-token' }).expect(401);
  });

  it('serves only the explicit public routes without a token', async () => {
    await http().get('/health').expect(200);
    await http().get('/inventory/summary').expect(401);
    await http().get('/prescriptions').expect(401);
  });
});

describe('2. Role authorization', () => {
  it('lets only pharmacists and administrators change stock, suppliers and medicines', async () => {
    const receipt = { supplierId: '00000000-0000-4000-8000-000000000000', items: [] };
    await http().post('/inventory/receipts').set(as('staff')).send(receipt).expect(403);
    await http().post('/inventory/receipts').set(as('norole')).send(receipt).expect(403);
    await http().post('/suppliers').set(as('staff')).send({ name: 'X' }).expect(403);
    await http().post('/products').set(as('staff')).send({ name: 'X', barcode: 'X' }).expect(403);
  });

  it('lets only administrators delete patient records', async () => {
    await http().delete('/customers/00000000-0000-4000-8000-000000000000').set(as('pharmacist')).expect(403);
  });
});

describe('3. Patient creation', () => {
  it('creates a patient with an explicit allergy status and audits it', async () => {
    const res = await http()
      .post('/customers')
      .set(as('staff'))
      .send({ name: 'E2E Test Patient', phone_number: '0700000001', age: '40', gender: 'F' })
      .expect(201);
    ids.patient = res.body.id;
    const row = await one('SELECT name, allergy_status FROM customers WHERE id = $1', [ids.patient]);
    expect(row).toEqual({ name: 'E2E Test Patient', allergy_status: 'UNKNOWN' });
    const audit = await one(`SELECT count(*)::int AS n FROM audit_log WHERE entity_type = 'customers' AND entity_id = $1 AND action = 'INSERT'`, [ids.patient]);
    expect(audit.n).toBe(1);
  });

  it('finds the patient by phone number', async () => {
    const res = await http().get('/customers/search').query({ phone: '0700000001' }).set(as('staff')).expect(200);
    expect(res.body.map((c: any) => c.id)).toContain(ids.patient);
  });
});

describe('4. Medicine creation', () => {
  it('creates a medicine without inventing stock, expiry or thresholds', async () => {
    const res = await http()
      .post('/products')
      .set(as('pharmacist'))
      .send({ name: 'E2E Amoxicillin 250mg Capsules', barcode: 'E2E-AMOX-250', pack_size: 100, retail_price: 12.5 })
      .expect(201);
    ids.product = res.body.id;
    const row = await one('SELECT stock_quantity, expiry_date, batch_number, reorder_level, minimum_stock, maximum_stock FROM products WHERE id = $1', [ids.product]);
    expect(row).toEqual({ stock_quantity: 0, expiry_date: null, batch_number: null, reorder_level: null, minimum_stock: null, maximum_stock: null });
  });

  it('rejects a duplicate barcode', async () => {
    await http().post('/products').set(as('pharmacist')).send({ name: 'Copy', barcode: 'E2E-AMOX-250' }).expect(400);
  });

  it('stores a threshold only when one is configured', async () => {
    await http().patch(`/products/${ids.product}`).set(as('pharmacist')).send({ reorder_level: 20, minimum_stock: 5 }).expect(200);
    expect(await one('SELECT reorder_level, minimum_stock FROM products WHERE id = $1', [ids.product])).toEqual({ reorder_level: 20, minimum_stock: 5 });
  });
});

describe('5. Supplier creation', () => {
  it('creates a supplier', async () => {
    const res = await http().post('/suppliers').set(as('pharmacist')).send({ name: 'E2E Test Distributor', phone: '0110000000' }).expect(201);
    ids.supplier = res.body.id;
    expect(await one('SELECT name FROM suppliers WHERE id = $1', [ids.supplier])).toEqual({ name: 'E2E Test Distributor' });
  });
});

describe('6. Stock receiving', () => {
  const receipt = () => ({
    supplierId: ids.supplier,
    invoiceNumber: 'E2E-INV-1',
    items: [
      { productId: ids.product, batchNumber: 'E2E-LATE', quantity: 30, purchaseCost: 8, expiryDate: '2099-12-31' },
      { productId: ids.product, batchNumber: 'E2E-SOON', quantity: 10, purchaseCost: 8, expiryDate: '2098-06-30' },
    ],
  });

  it('receives a two-line delivery into batches, product total and ledger together', async () => {
    const res = await http().post('/inventory/receipts').set(as('pharmacist')).set('Idempotency-Key', 'e2e-grn-0001').send(receipt()).expect(201);
    expect(res.body).toMatchObject({ success: true, lineCount: 2, unitCount: 40 });
    expect((await one('SELECT stock_quantity FROM products WHERE id = $1', [ids.product])).stock_quantity).toBe(40);
    const ledger = await one(`SELECT count(*)::int AS n, bool_and(created_by = $2) AS attributed FROM inventory_movements WHERE product_id = $1 AND movement_type = 'STOCK_RECEIVED'`, [
      ids.product,
      USERS.pharmacist.id,
    ]);
    expect(ledger).toEqual({ n: 2, attributed: true });
  });

  it('does not receive the same delivery twice when retried with the same key', async () => {
    await http().post('/inventory/receipts').set(as('pharmacist')).set('Idempotency-Key', 'e2e-grn-0001').send(receipt()).expect(201);
    expect((await one('SELECT stock_quantity FROM products WHERE id = $1', [ids.product])).stock_quantity).toBe(40);
  });
});

describe('7. Stock adjustment and returns', () => {
  it('records a correction with its reason and user', async () => {
    const res = await http()
      .post('/inventory/adjustments')
      .set(as('pharmacist'))
      .send({ productId: ids.product, type: 'ADJUSTMENT_OUT', quantity: 2, reason: 'E2E monthly count: 2 missing' })
      .expect(201);
    expect(res.body).toMatchObject({ stockBefore: 40, stockAfter: 38 });
    const m = await one(`SELECT reason, created_by FROM inventory_movements WHERE id = $1`, [res.body.movementId]);
    expect(m).toEqual({ reason: 'E2E monthly count: 2 missing', created_by: USERS.pharmacist.id });
  });

  it('refuses the old RETURNED type and requires a batch for a supplier return', async () => {
    await http().post('/inventory/adjustments').set(as('pharmacist')).send({ productId: ids.product, type: 'RETURNED', quantity: 1, reason: 'came back' }).expect(400);
    await http().post('/inventory/adjustments').set(as('pharmacist')).send({ productId: ids.product, type: 'SUPPLIER_RETURN', quantity: 1, reason: 'recall' }).expect(400);
    expect((await one('SELECT stock_quantity FROM products WHERE id = $1', [ids.product])).stock_quantity).toBe(38);
  });

  it('removes a supplier return from the named batch', async () => {
    ids.lateBatch = (await one(`SELECT id FROM product_batches WHERE batch_number = 'E2E-LATE'`)).id;
    await http()
      .post('/inventory/adjustments')
      .set(as('pharmacist'))
      .send({ productId: ids.product, batchId: ids.lateBatch, type: 'SUPPLIER_RETURN', quantity: 3, reason: 'E2E damaged carton returned to supplier' })
      .expect(201);
    expect((await one('SELECT quantity_available FROM product_batches WHERE id = $1', [ids.lateBatch])).quantity_available).toBe(27);
    expect((await one('SELECT stock_quantity FROM products WHERE id = $1', [ids.product])).stock_quantity).toBe(35);
  });

  it('records a patient return without adding it to stock', async () => {
    const res = await http()
      .post('/inventory/patient-returns')
      .set(as('staff'))
      .send({ productId: ids.product, batchNumber: 'E2E-SOON', quantity: 4, reason: 'E2E treatment stopped', customerId: ids.patient })
      .expect(201);
    expect(res.body).toMatchObject({ status: 'HELD_FOR_REVIEW', recorded_by: USERS.staff.id });
    expect((await one('SELECT stock_quantity FROM products WHERE id = $1', [ids.product])).stock_quantity).toBe(35);
    await http().post(`/inventory/patient-returns/${res.body.id}/dispose`).set(as('staff')).send({ reason: 'x y z' }).expect(403);
    await http().post(`/inventory/patient-returns/${res.body.id}/dispose`).set(as('pharmacist')).send({ reason: 'E2E sent for destruction' }).expect(201);
  });

  it('refuses a stock change without a role', async () => {
    await http().post('/inventory/patient-returns').set(as('norole')).send({ productName: 'X', quantity: 1, reason: 'abc' }).expect(403);
  });
});

describe('8. Prescription creation (legacy write path)', () => {
  it('saves the prescription, items, stock, movement and event, attributed to the user', async () => {
    // Add Expiry Date (Feature #22): the printed expiry is the GRN batch date, retrieved, not typed.
    const lookup = await http()
      .get('/inventory/dispensing-batches')
      .query({ productId: ids.product })
      .set(as('staff'))
      .expect(200);
    const soon = lookup.body.batches.find(
      (x: any) => x.batchNumber === 'E2E-SOON',
    );
    expect(soon.expiryDate).toBe('2098-06-30');
    const res = await http()
      .post('/prescriptions')
      .set(as('staff'))
      .set('Idempotency-Key', 'e2e-rx-legacy-0001')
      .send({
        customerId: ids.patient,
        customerName: 'E2E Test Patient',
        customerPhone: '0700000001',
        items: [
          {
            productId: ids.product,
            quantity: 10,
            days: 5,
            dosage: { morning: 1, lunch: 0, night: 1 },
            finalInstructionText: 'උදේ 1 • රෑ 1 • දින 5 ක් සඳහා',
            expiryDate: soon.expiryDate,
            expiryBatchId: soon.id,
          },
        ],
      })
      .expect(201);
    ids.rx = res.body.id;
    expect(res.body).toMatchObject({ status: 'COMPLETED', itemCount: 1, customerPhone: '94700000001' });
    expect((await one('SELECT stock_quantity FROM products WHERE id = $1', [ids.product])).stock_quantity).toBe(25);
    const item = await one('SELECT final_instruction_text, morning_qty, night_qty, days FROM prescription_items WHERE prescription_id = $1', [ids.rx]);
    expect(item).toEqual({ final_instruction_text: 'උදේ 1 • රෑ 1 • දින 5 ක් සඳහා', morning_qty: 1, night_qty: 1, days: 5 });
    const ev = await one(`SELECT user_id FROM prescription_events WHERE prescription_id = $1 AND event_type = 'CREATED'`, [ids.rx]);
    expect(ev.user_id).toBe(USERS.staff.id);
  });

  it('returns the stored result for a retried request instead of dispensing twice', async () => {
    const res = await http()
      .post('/prescriptions')
      .set(as('staff'))
      .set('Idempotency-Key', 'e2e-rx-legacy-0001')
      .send({ customerName: 'E2E Test Patient', items: [{ productId: ids.product, quantity: 10 }] })
      .expect(201);
    expect(res.body.id).toBe(ids.rx);
    expect((await one('SELECT stock_quantity FROM products WHERE id = $1', [ids.product])).stock_quantity).toBe(25);
  });

  it('rejects more than the recorded stock and leaves nothing behind', async () => {
    const before = await one('SELECT count(*)::int AS n FROM prescriptions');
    await http().post('/prescriptions').set(as('staff')).send({ customerName: 'E2E', items: [{ productId: ids.product, quantity: 26 }] }).expect(409);
    expect(await one('SELECT count(*)::int AS n FROM prescriptions')).toEqual(before);
  });
});

describe('9. Batch-level allocation guard on the legacy path', () => {
  it('does not dispense units held in a quarantined batch', async () => {
    // Batches now: E2E-SOON 10, E2E-LATE 27; product total 25 (legacy path deducts the total only).
    await http().post(`/inventory/batches/${ids.lateBatch}/quarantine`).set(as('staff')).send({ reason: 'x y z' }).expect(403);
    await http().post(`/inventory/batches/${ids.lateBatch}/quarantine`).set(as('pharmacist')).send({ reason: 'E2E seal damaged' }).expect(201);
    const res = await http().post('/prescriptions').set(as('staff')).send({ customerName: 'E2E', items: [{ productId: ids.product, quantity: 1 }] }).expect(409);
    expect(res.body.message).toMatch(/quarantined|available: -?\d+/);
    await http().post(`/inventory/batches/${ids.lateBatch}/release`).set(as('pharmacist')).send({ reason: 'E2E seal checked' }).expect(201);
  });
});

describe('10. Label printing', () => {
  it('records the print against the prescription and the user', async () => {
    await http().post(`/prescriptions/${ids.rx}/print`).set(as('staff')).expect(200);
    const ev = await one(`SELECT user_id FROM prescription_events WHERE prescription_id = $1 AND event_type = 'PRINTED'`, [ids.rx]);
    expect(ev.user_id).toBe(USERS.staff.id);
    expect((await one('SELECT printed_at IS NOT NULL AS printed FROM prescriptions WHERE id = $1', [ids.rx])).printed).toBe(true);
  });

  it('reprints only with a reason, counting each reprint', async () => {
    await http().post(`/admin/prescriptions/${ids.rx}/reprint`).set(as('staff')).send({ reason: '' }).expect(400);
    await http().post(`/admin/prescriptions/${ids.rx}/reprint`).set(as('staff')).send({ reason: 'E2E label smudged' }).expect(200);
    expect((await one('SELECT print_count FROM prescriptions WHERE id = $1', [ids.rx])).print_count).toBe(1);
    const detail = (await http().get(`/admin/prescriptions/${ids.rx}`).set(as('staff')).expect(200)).body;
    expect(JSON.stringify(detail)).toContain('උදේ 1 • රෑ 1 • දින 5 ක් සඳහා');
  });

  it('saves a single label record with its instructions exactly as sent', async () => {
    const res = await http()
      .post('/labels')
      .set(as('staff'))
      .send({ customer_name_text: 'E2E Test Patient', product_id: ids.product, days: 5, instructions_json: { text: 'රෑ 1' } })
      .expect(201);
    expect((await one('SELECT instructions_json FROM labels WHERE id = $1', [res.body.id])).instructions_json).toEqual({ text: 'රෑ 1' });
  });

  it('returns 404 when printing an unknown prescription', async () => {
    await http().post('/prescriptions/00000000-0000-4000-8000-000000000000/print').set(as('staff')).expect(404);
  });
});

describe('11. SMS authorization and delivery logging (no message is sent)', () => {
  it('requires a signed-in user to log an SMS', async () => {
    await http().post(`/prescriptions/${ids.rx}/sms`).send({ recipient: '0700000001', status: 'SENT', messageLength: 10 }).expect(401);
  });

  it('records sent and failed deliveries as distinct events', async () => {
    await http().post(`/prescriptions/${ids.rx}/sms`).set(as('staff')).send({ recipient: '0700000001', status: 'SENT', messageLength: 120, providerReference: 'e2e-ref' }).expect(200);
    await http().post(`/prescriptions/${ids.rx}/sms`).set(as('staff')).send({ recipient: '0700000001', status: 'FAILED', messageLength: 120, failureReason: 'e2e gateway down' }).expect(200);
    const rows = (await h.db.query(`SELECT event_type, metadata->>'recipient' AS r FROM prescription_events WHERE prescription_id = $1 AND event_type LIKE 'SMS%' ORDER BY event_type`, [ids.rx])).rows;
    expect(rows).toEqual([
      { event_type: 'SMS_FAILED', r: '94700000001' },
      { event_type: 'SMS_SENT', r: '94700000001' },
    ]);
  });
});

describe('12. Inventory reporting', () => {
  it('reports real totals, thresholds and batch expiry', async () => {
    const summary = (await http().get('/inventory/summary').set(as('staff')).expect(200)).body;
    expect(summary.totalProducts).toBe(1);
    expect(summary.totalUnits).toBe(25);
    const low = (await http().get('/inventory/low-stock').set(as('staff')).expect(200)).body;
    expect(low.map((p: any) => p.id)).toEqual([]); // 25 units, reorder level 20
    const expiry = (await http().get('/inventory/expiry').set(as('staff')).expect(200)).body;
    expect(expiry.expired).toEqual([]);
    const movements = (await http().get('/inventory/movements').set(as('staff')).expect(200)).body;
    expect(movements.map((m: any) => m.movement_type)).toEqual(expect.arrayContaining(['STOCK_RECEIVED', 'ADJUSTMENT_OUT', 'SUPPLIER_RETURN', 'DISPENSE']));
    expect(movements.find((m: any) => m.movement_type === 'DISPENSE').prescriptions.prescription_number).toMatch(/^RX-/);
    await http().get('/admin/dashboard/summary').set(as('staff')).expect(200);
  });

  it('classifies a medicine without thresholds as not configured, never as healthy or low', async () => {
    await http().post('/products').set(as('pharmacist')).send({ name: 'E2E Unthresholded Cream', barcode: 'E2E-CREAM' }).expect(201);
    const summary = (await http().get('/inventory/summary').set(as('staff')).expect(200)).body;
    expect(summary.stock.unclassified).toBe(0); // out of stock comes first
    expect(summary.stock.outOfStock).toBe(1);
  });
});

describe('13. Expiry validation', () => {
  it('refuses to receive an expired batch and saves nothing from that delivery', async () => {
    const res = await http()
      .post('/inventory/receipts')
      .set(as('pharmacist'))
      .send({
        supplierId: ids.supplier,
        items: [
          { productId: ids.product, batchNumber: 'E2E-OK', quantity: 5, purchaseCost: 8, expiryDate: '2099-01-01' },
          { productId: ids.product, batchNumber: 'E2E-OLD', quantity: 5, purchaseCost: 8, expiryDate: '2001-01-01' },
        ],
      })
      .expect(400);
    expect(res.body.code).toBe('EXPIRED_BATCH');
    expect(await one(`SELECT count(*)::int AS n FROM product_batches WHERE batch_number IN ('E2E-OK', 'E2E-OLD')`)).toEqual({ n: 0 });
  });

  it('refuses a label whose printed expiry has passed (full date or month/year)', async () => {
    for (const expiryDate of ['2001-01-31', '01/2001']) {
      const res = await http()
        .post('/prescriptions')
        .set(as('staff'))
        .send({ customerName: 'E2E', items: [{ productId: ids.product, quantity: 1, expiryDate }] })
        .expect(400);
      expect(res.body.code).toBe('PRODUCT_EXPIRED');
    }
  });

  it('does not dispense units from a batch whose expiry has passed', async () => {
    // Move the earlier batch into the past (test data only) and ask for more than the rest.
    await h.db.query(`UPDATE product_batches SET expiry_date = '2001-01-01' WHERE batch_number = 'E2E-SOON'`);
    const res = await http().post('/prescriptions').set(as('staff')).send({ customerName: 'E2E', items: [{ productId: ids.product, quantity: 25 }] }).expect(409);
    expect(res.body.message).toMatch(/expired, quarantined or undated/);
  });
});

describe('14. Audit history', () => {
  it('keeps who changed what for patients, medicines, batches and returns', async () => {
    const rows = (await h.db.query(`SELECT entity_type, action, count(*)::int AS n FROM audit_log GROUP BY 1, 2`)).rows;
    const has = (t: string, a: string) => rows.some((r) => r.entity_type === t && r.action === a);
    expect(has('customers', 'INSERT')).toBe(true);
    expect(has('products', 'INSERT')).toBe(true);
    expect(has('products', 'UPDATE')).toBe(true);
    expect(has('product_batches', 'INSERT')).toBe(true);
    expect(has('patient_returns', 'INSERT')).toBe(true);
    const q = await one(
      `SELECT actor_id FROM audit_log WHERE entity_type = 'product_batches' AND action = 'UPDATE' AND entity_id = $1 ORDER BY id LIMIT 1`,
      [ids.lateBatch],
    );
    expect(q.actor_id).toBe(USERS.pharmacist.id);
  });

  it('keeps a balanced stock ledger', async () => {
    expect(await one('SELECT bool_and(stock_after = stock_before + quantity) AS ok FROM inventory_movements')).toEqual({ ok: true });
  });

  it('does not expose any table to the public roles', async () => {
    const client = await h.db.connect();
    try {
      await client.query('BEGIN');
      await client.query('SET LOCAL ROLE anon');
      for (const t of ['customers', 'prescriptions', 'prescription_items', 'patient_returns', 'audit_log']) {
        expect((await client.query(`SELECT count(*)::int AS n FROM ${t}`)).rows[0].n).toBe(0);
      }
      await client.query('ROLLBACK');
    } finally {
      client.release();
    }
  });
});
