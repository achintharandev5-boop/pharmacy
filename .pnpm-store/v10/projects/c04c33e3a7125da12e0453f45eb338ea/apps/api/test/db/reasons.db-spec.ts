import { readFileSync } from 'fs';
import { join } from 'path';
import type { Server } from 'http';
import request from 'supertest';
import { Harness, startHarness, TOKEN, USERS, type TestUser } from './harness';

let h: Harness;
const textA = 'පරීක්ෂණය එක';
const textB = 'පරීක්ෂණය දෙක  ';
const productId = 'f2100000-0000-4000-8000-000000000088';
const http = (
  user: TestUser,
  method: 'get' | 'post' | 'patch' | 'delete',
  path: string,
) =>
  request(h.app.getHttpServer() as Server)
    [method](path)
    .set('Authorization', `Bearer ${TOKEN[user]}`);
const list = async (user: TestUser) => {
  const response = await http(user, 'get', '/reasons').expect(200);
  return response.body as { id: string; text: string; is_active: boolean }[];
};
const create = async (user: TestUser, text: string) => {
  const response = await http(user, 'post', '/admin/reasons')
    .send({ text })
    .expect(201);
  return response.body as { id: string; text: string; is_active: boolean };
};
beforeAll(async () => {
  h = await startHarness('pharmacy_f21_reasons');
  await h.db.query(
    'INSERT INTO products(id, name, barcode, stock_quantity) VALUES ($1, $2, $3, 20)',
    [productId, 'Synthetic reasons test product', 'F21-TEST'],
  );
}, 60_000);
afterAll(async () => {
  await h?.close();
});

describe('Reasons — real local PostgreSQL with authenticated Nest HTTP and service_role queries', () => {
  it('creates scoped catalogues, preserves exact snapshots after rename/deactivate, and audits the trusted actor', async () => {
    const a = await create('reasonsAdminA', textA);
    const b = await create('reasonsAdminA', textB);
    await create('reasonsAdminB', textA); // Same wording is legal in another pharmacy.
    expect((await list('reasonsPharmacistA')).map((r) => r.text)).toEqual([
      textA,
      textB,
    ]);
    expect((await list('reasonsAdminB')).map((r) => r.text)).toEqual([textA]);

    const finalText = 'Synthetic dose\n' + textA + '\n' + textB;
    const saved = await http('reasonsPharmacistA', 'post', '/prescriptions')
      .send({
        customerName: 'Synthetic test patient',
        items: [
          {
            productId,
            quantity: 1,
            dosage: { morning: 1, lunch: 0, night: 0 },
            days: 1,
            reasons: [textA, textB],
            finalInstructionText: finalText,
          },
        ],
      })
      .expect(201);
    const prescription = saved.body as { id: string };
    const snapshot = async () =>
      (
        await h.db.query<{ reasons: string[]; final_instruction_text: string }>(
          "SELECT instructions_json->'reasons' AS reasons, final_instruction_text FROM prescription_items WHERE prescription_id = $1",
          [prescription.id],
        )
      ).rows;
    expect(await snapshot()).toEqual([
      { reasons: [textA, textB], final_instruction_text: finalText },
    ]);

    await http('reasonsAdminA', 'patch', '/admin/reasons/' + a.id)
      .send({ text: 'Renamed synthetic statement' })
      .expect(200);
    await http('reasonsAdminA', 'delete', '/admin/reasons/' + a.id).expect(200);
    expect((await list('reasonsPharmacistA')).map((r) => r.text)).toEqual([
      textB,
    ]);
    expect(await snapshot()).toEqual([
      { reasons: [textA, textB], final_instruction_text: finalText },
    ]);
    const history = await http(
      'reasonsAdminA',
      'get',
      '/admin/prescriptions/' + prescription.id,
    ).expect(200);
    expect(JSON.stringify(history.body)).toContain(textA);
    const audit = await h.db.query<{
      actor_id: string;
      action: string;
      changed_fields: string[];
    }>(
      "SELECT actor_id, action, changed_fields FROM audit_log WHERE entity_type = 'reasons' AND entity_id = $1 ORDER BY id",
      [a.id],
    );
    expect(audit.rows.map((r) => r.actor_id)).toEqual(
      Array(3).fill(USERS.reasonsAdminA.id),
    );
    expect(audit.rows.map((r) => r.action)).toEqual([
      'INSERT',
      'UPDATE',
      'UPDATE',
    ]);
    expect(audit.rows[1].changed_fields).toEqual(['text']);
    expect(audit.rows[2].changed_fields).toEqual(['is_active']);
    expect(b.is_active).toBe(true);
  });

  it('denies cross-pharmacy mutations and does not leak inactive/admin records', async () => {
    const other = (await list('reasonsAdminB'))[0];
    await http('reasonsAdminA', 'patch', '/admin/reasons/' + other.id)
      .send({ text: 'Forbidden' })
      .expect(404);
    await http('reasonsAdminA', 'delete', '/admin/reasons/' + other.id).expect(
      404,
    );
    expect(
      (await list('reasonsPharmacistA')).some((r) => r.id === other.id),
    ).toBe(false);
    const adminList = await http(
      'reasonsAdminA',
      'get',
      '/admin/reasons',
    ).expect(200);
    expect(
      (adminList.body as { id: string }[]).some((r) => r.id === other.id),
    ).toBe(false);
  });

  it('denies pharmacist mutations, missing/invalid assignments, and unauthenticated requests', async () => {
    const id = (await list('reasonsPharmacistA'))[0].id;
    for (const role of [
      'reasonsPharmacistA',
      'admin',
      'reasonsInvalid',
    ] as const) {
      const status = role === 'reasonsPharmacistA' ? 200 : 403;
      await http(role, 'get', '/reasons').expect(status);
      await http(role, 'post', '/admin/reasons')
        .send({ text: 'Forbidden' })
        .expect(403);
      await http(role, 'patch', '/admin/reasons/' + id)
        .send({ text: 'Forbidden' })
        .expect(403);
      await http(role, 'delete', '/admin/reasons/' + id).expect(403);
    }
    await request(h.app.getHttpServer() as Server)
      .get('/reasons')
      .expect(401);
    await request(h.app.getHttpServer() as Server)
      .get('/reasons')
      .set('Authorization', 'Bearer forged')
      .expect(401);
  });

  it('ignores client-controlled scope and actor, validates payloads and prevents scoped duplicates', async () => {
    const spoof = await http('reasonsAdminA', 'post', '/admin/reasons')
      .send({
        text: 'Scoped injection fixture',
        pharmacy_id: USERS.reasonsAdminB.pharmacyId,
        updated_by: USERS.reasonsAdminB.id,
      })
      .expect(201);
    const id = (spoof.body as { id: string }).id;
    const result = await h.db.query<{
      pharmacy_id: string;
      updated_by: string;
    }>('SELECT pharmacy_id, updated_by FROM reasons WHERE id = $1', [id]);
    expect(result.rows[0]).toEqual({
      pharmacy_id: USERS.reasonsAdminA.pharmacyId,
      updated_by: USERS.reasonsAdminA.id,
    });
    await http('reasonsAdminA', 'post', '/admin/reasons')
      .send({ text: textB })
      .expect(409);
    for (const text of ['', '  ', 'x'.repeat(201), 'line\nbreak']) {
      await http('reasonsAdminA', 'post', '/admin/reasons')
        .send({ text })
        .expect(400);
    }
    await http('reasonsAdminA', 'patch', '/admin/reasons/not-a-uuid')
      .send({ text: 'test' })
      .expect(400);
  });

  it('enforces RLS and grants under Supabase-like default privileges', async () => {
    const grants = await h.db.query<{
      role: string;
      can_read: boolean;
      can_insert: boolean;
      can_update: boolean;
      can_delete: boolean;
    }>(`
      SELECT role, has_table_privilege(role, 'reasons', 'SELECT') AS can_read,
        has_table_privilege(role, 'reasons', 'INSERT') AS can_insert,
        has_table_privilege(role, 'reasons', 'UPDATE') AS can_update,
        has_table_privilege(role, 'reasons', 'DELETE') AS can_delete
      FROM (VALUES ('anon'), ('authenticated'), ('service_role')) AS roles(role)`);
    expect(grants.rows).toEqual([
      {
        role: 'anon',
        can_read: false,
        can_insert: false,
        can_update: false,
        can_delete: false,
      },
      {
        role: 'authenticated',
        can_read: false,
        can_insert: false,
        can_update: false,
        can_delete: false,
      },
      {
        role: 'service_role',
        can_read: true,
        can_insert: true,
        can_update: true,
        can_delete: false,
      },
    ]);
    expect(
      (
        await h.db.query<{ relrowsecurity: boolean }>(
          "SELECT relrowsecurity FROM pg_class WHERE oid = 'public.reasons'::regclass",
        )
      ).rows[0].relrowsecurity,
    ).toBe(true);
    for (const role of ['anon', 'authenticated']) {
      const connection = await h.db.connect();
      try {
        await connection.query('BEGIN');
        await connection.query('SET LOCAL ROLE ' + role);
        await expect(
          connection.query('SELECT * FROM public.reasons'),
        ).rejects.toHaveProperty('code', '42501');
      } finally {
        await connection.query('ROLLBACK');
        connection.release();
      }
    }
  });

  it('enforces actor foreign keys, value constraints, and immutable pharmacy in real PostgreSQL', async () => {
    const insert =
      'INSERT INTO reasons(pharmacy_id, text, updated_by) VALUES ($1, $2, $3)';
    await expect(
      h.db.query(insert, [
        USERS.reasonsAdminA.pharmacyId,
        'Actor absent',
        'ffffffff-ffff-4fff-8fff-ffffffffffff',
      ]),
    ).rejects.toHaveProperty('code', '23503');
    for (const text of ['', ' ', 'x'.repeat(201), 'line\nbreak']) {
      await expect(
        h.db.query(insert, [
          USERS.reasonsAdminA.pharmacyId,
          text,
          USERS.reasonsAdminA.id,
        ]),
      ).rejects.toHaveProperty('code', '23514');
    }
    await expect(
      h.db.query('UPDATE reasons SET pharmacy_id = $1 WHERE pharmacy_id = $2', [
        USERS.reasonsAdminB.pharmacyId,
        USERS.reasonsAdminA.pharmacyId,
      ]),
    ).rejects.toHaveProperty('code', '23514');
  });

  it('rolls back a catalogue write when its audit insert cannot succeed', async () => {
    const before = await h.db.query<{ count: string }>(
      'SELECT count(*) FROM reasons',
    );
    const connection = await h.db.connect();
    try {
      await connection.query('BEGIN');
      await connection.query(
        'REVOKE INSERT ON public.audit_log FROM service_role',
      );
      await connection.query('SET LOCAL ROLE service_role');
      await expect(
        connection.query(
          'INSERT INTO reasons(pharmacy_id, text, updated_by) VALUES ($1, $2, $3)',
          [
            USERS.reasonsAdminA.pharmacyId,
            'Atomic audit failure fixture',
            USERS.reasonsAdminA.id,
          ],
        ),
      ).rejects.toHaveProperty('code', '42501');
    } finally {
      await connection.query('ROLLBACK');
      connection.release();
    }
    expect(
      (await h.db.query<{ count: string }>('SELECT count(*) FROM reasons'))
        .rows,
    ).toEqual(before.rows);
  });

  it('fails safely on migration replay without replacing existing data', async () => {
    const before = await h.db.query<{ count: string }>(
      'SELECT count(*) FROM reasons',
    );
    const connection = await h.db.connect();
    try {
      const migration = readFileSync(
        join(
          __dirname,
          '../../supabase/migrations/20261025000100_reasons_catalogue.sql',
        ),
        'utf8',
      );
      await expect(connection.query(migration)).rejects.toHaveProperty(
        'code',
        '42P07',
      );
    } finally {
      await connection.query('ROLLBACK');
      connection.release();
    }
    expect(
      (await h.db.query<{ count: string }>('SELECT count(*) FROM reasons'))
        .rows,
    ).toEqual(before.rows);
  });
});
