import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { Server } from 'http';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { SupabaseService } from '../supabase/supabase.service';
import { FakeSupabase } from '../test-utils/fake-supabase';
import { AuditController } from './audit.controller';
import { AuditService } from './audit.service';

const ADMIN_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const PHARMACIST_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const PATIENT_ID = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';

interface Row {
  id: number;
  occurred_at: string;
  actor_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  changed_fields: string[] | null;
  [extra: string]: unknown;
}
let nextId = 1;
const event = (over: Partial<Row> = {}): Row => ({
  id: nextId++,
  occurred_at: '2026-10-30T08:00:00+00:00',
  actor_id: null,
  action: 'UPDATE',
  entity_type: 'customers',
  entity_id: PATIENT_ID,
  changed_fields: ['name'],
  ...over,
});

interface Event {
  id: string;
  occurred_at: string;
  action: string;
  entity_type: string;
  module: string | null;
  entity_id: string | null;
  changed_fields: string[] | null;
  withheld_fields: number;
  actor: { id: string; name: string | null } | null;
  [extra: string]: unknown;
}
interface Page {
  items: Event[];
  total: number;
  page: number;
  pageSize: number;
  code?: string;
  message?: unknown;
}
const page = (res: { body: unknown }) => res.body as Page;
const ids = (res: { body: unknown }) => page(res).items.map((e) => e.id);

describe('Audit log HTTP', () => {
  let app: INestApplication<Server>;
  let db: FakeSupabase;
  let role: string | undefined;
  let tokenValid: boolean;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [AuditController],
      providers: [
        AuditService,
        { provide: ConfigService, useValue: { get: () => undefined } },
        {
          provide: SupabaseService,
          useValue: {
            getClient: () => ({
              ...db.client(),
              auth: {
                getUser: () =>
                  Promise.resolve(
                    tokenValid
                      ? {
                          data: {
                            user: {
                              id: ADMIN_ID,
                              app_metadata: role ? { role } : {},
                            },
                          },
                          error: null,
                        }
                      : {
                          data: { user: null },
                          error: { status: 401, message: 'bad' },
                        },
                  ),
              },
            }),
          },
        },
        { provide: APP_GUARD, useClass: AuthGuard },
        { provide: APP_GUARD, useClass: RolesGuard },
      ],
    }).compile();
    app = module.createNestApplication();
    app.useLogger(false);
    // Same options as main.ts.
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: false,
        transform: true,
      }),
    );
    await app.init();
  });
  afterAll(() => app.close());
  beforeEach(() => {
    role = 'admin';
    tokenValid = true;
    nextId = 1;
    db = new FakeSupabase({ audit_log: [], user_profiles: [] });
  });

  const list = (qs = '') =>
    request(app.getHttpServer())
      .get(`/admin/audit-log${qs}`)
      .set('Authorization', 'Bearer t');
  const detail = (id: string) =>
    request(app.getHttpServer())
      .get(`/admin/audit-log/${id}`)
      .set('Authorization', 'Bearer t');
  const seed = (...rows: Row[]) => db.table('audit_log').push(...rows);
  const writes = () => db.calls.filter((c) => c.op !== 'select');

  describe('authorization', () => {
    it('lets an administrator read the log and an event', async () => {
      seed(event());
      await list().expect(200);
      await detail('1').expect(200);
    });

    it.each([
      ['pharmacist', 'pharmacist'],
      ['staff', 'staff'],
      ['cashier', 'cashier'],
      ['an unknown role', 'superuser'],
      ['an account without a role', undefined],
    ])(
      'refuses %s on the list and the details, before the database',
      async (_label, r) => {
        role = r;
        seed(event());
        await list().expect(403);
        await detail('1').expect(403);
        expect(db.calls).toEqual([]);
      },
    );

    it('refuses an anonymous request', async () => {
      await request(app.getHttpServer()).get('/admin/audit-log').expect(401);
      await request(app.getHttpServer()).get('/admin/audit-log/1').expect(401);
      expect(db.calls).toEqual([]);
    });

    it('refuses an invalid or expired token', async () => {
      tokenValid = false;
      await list().expect(401);
      expect(db.calls).toEqual([]);
    });
  });

  describe('read-only', () => {
    it.each(['post', 'patch', 'put', 'delete'] as const)(
      'has no %s route for audit events',
      async (verb) => {
        seed(event());
        await request(app.getHttpServer())
          [verb]('/admin/audit-log/1')
          .set('Authorization', 'Bearer t')
          .send({})
          .expect(404);
        await request(app.getHttpServer())
          [verb]('/admin/audit-log')
          .set('Authorization', 'Bearer t')
          .send({})
          .expect(404);
        expect(db.table('audit_log')).toHaveLength(1);
      },
    );

    it('never writes while listing or opening events', async () => {
      seed(event({ actor_id: ADMIN_ID }), event());
      await list().expect(200);
      await detail('1').expect(200);
      expect(writes()).toEqual([]);
    });
  });

  describe('pagination and sorting', () => {
    it('returns one bounded page with the total', async () => {
      for (let i = 0; i < 30; i++)
        seed(
          event({
            occurred_at: `2026-10-01T08:${String(i).padStart(2, '0')}:00+00:00`,
          }),
        );
      const first = await list().expect(200);
      expect(page(first)).toMatchObject({ total: 30, page: 1, pageSize: 25 });
      expect(page(first).items).toHaveLength(25);

      const third = await list('?page=3&pageSize=10').expect(200);
      expect(page(third)).toMatchObject({ total: 30, page: 3, pageSize: 10 });
      // Newest first: ids 30..1, so page 3 of 10 is ids 10..1.
      expect(ids(third)).toEqual([
        '10',
        '9',
        '8',
        '7',
        '6',
        '5',
        '4',
        '3',
        '2',
        '1',
      ]);
    });

    it('sorts newest first and breaks ties by id so pages never overlap', async () => {
      seed(
        event({ occurred_at: '2026-10-30T08:00:00+00:00' }),
        event({ occurred_at: '2026-10-30T09:00:00+00:00' }),
        event({ occurred_at: '2026-10-30T08:00:00+00:00' }),
        event({ occurred_at: '2026-10-29T08:00:00+00:00' }),
      );
      expect(ids(await list())).toEqual(['2', '3', '1', '4']);
      const a = ids(await list('?pageSize=2&page=1'));
      const b = ids(await list('?pageSize=2&page=2'));
      expect([...a, ...b]).toEqual(['2', '3', '1', '4']);
    });

    it('returns an empty page, not an error, when nothing matches', async () => {
      const res = await list('?entity=suppliers').expect(200);
      expect(page(res)).toEqual({ items: [], total: 0, page: 1, pageSize: 25 });
    });

    it('returns an empty page beyond the last one', async () => {
      seed(event());
      const res = await list('?page=5').expect(200);
      expect(page(res)).toMatchObject({ items: [], total: 1, page: 5 });
    });
  });

  describe('filters', () => {
    beforeEach(() => {
      seed(
        // 1: 30 Oct 00:30 in Colombo (still 29 Oct in UTC).
        event({ occurred_at: '2026-10-29T19:00:00+00:00', actor_id: ADMIN_ID }),
        // 2: 29 Oct 23:59 in Colombo.
        event({
          occurred_at: '2026-10-29T18:29:00+00:00',
          action: 'INSERT',
          entity_type: 'products',
          entity_id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
          changed_fields: null,
        }),
        // 3: 31 Oct 10:00 in Colombo.
        event({
          occurred_at: '2026-10-31T04:30:00+00:00',
          entity_type: 'pharmacy_settings',
          entity_id: 'true',
          changed_fields: ['phone', 'updated_by'],
          actor_id: PHARMACIST_ID,
        }),
      );
    });

    it('filters by local calendar days in the pharmacy time zone', async () => {
      expect(ids(await list('?from=2026-10-30&to=2026-10-30'))).toEqual(['1']);
      expect(ids(await list('?to=2026-10-29'))).toEqual(['2']);
      expect(ids(await list('?from=2026-10-30'))).toEqual(['3', '1']);
    });

    it('filters by action', async () => {
      expect(ids(await list('?action=INSERT'))).toEqual(['2']);
      expect(page(await list('?action=DELETE')).total).toBe(0);
    });

    it('filters by module', async () => {
      expect(ids(await list('?entity=pharmacy_settings'))).toEqual(['3']);
    });

    it('filters by user, including changes recorded without a user', async () => {
      expect(ids(await list(`?actor=${ADMIN_ID.toUpperCase()}`))).toEqual([
        '1',
      ]);
      expect(ids(await list('?actor=none'))).toEqual(['2']);
    });

    it('filters by exact record reference', async () => {
      expect(ids(await list(`?record=${PATIENT_ID}`))).toEqual(['1']);
      expect(ids(await list('?record=true'))).toEqual(['3']);
    });

    it('combines filters', async () => {
      expect(
        ids(await list('?entity=customers&action=UPDATE&from=2026-10-30')),
      ).toEqual(['1']);
      expect(page(await list('?entity=customers&action=INSERT')).total).toBe(0);
    });
  });

  describe('invalid parameters', () => {
    it.each([
      ['page 0', '?page=0'],
      ['a page beyond the limit', '?page=201'],
      ['a fractional page', '?page=1.5'],
      ['a page that is not a number', '?page=two'],
      ['a page size over 100', '?pageSize=101'],
      ['a page size of 0', '?pageSize=0'],
      ['an impossible date', '?from=2026-02-30'],
      ['a date in another format', '?to=30/10/2026'],
      ['a timestamp instead of a date', '?from=2026-10-30T00:00:00Z'],
      ['an unknown action', '?action=TRUNCATE'],
      ['a lower-case action', '?action=update'],
      ['an unaudited table', '?entity=sms_messages'],
      ['an actor that is not a user id', '?actor=admin'],
      ['a record reference with filter syntax', '?record=a,b'],
      ['a record reference with wildcards', '?record=%25'],
    ])('rejects %s with 400, before the database', async (_label, qs) => {
      await list(qs).expect(400);
      expect(db.calls).toEqual([]);
    });

    it('rejects a start date after the end date', async () => {
      const res = await list('?from=2026-10-30&to=2026-10-29').expect(400);
      expect(page(res).code).toBe('INVALID_RANGE');
      expect(db.calls).toEqual([]);
    });

    it.each(['abc', '0', '-1', '1.5', '1234567890123456'])(
      'rejects the event id %s with 400',
      async (id) => {
        await detail(id).expect(400);
        expect(db.calls).toEqual([]);
      },
    );
  });

  describe('sensitive data', () => {
    it('returns only the audit columns, never extra stored columns', async () => {
      seed(
        event({
          old_values: { name: 'Previous Name', allergies: 'Penicillin' },
          new_values: { name: 'New Name' },
          password: 'secret',
          access_token: 'tok',
        }),
      );
      const res = await list().expect(200);
      const item = page(res).items[0];
      expect(Object.keys(item).sort()).toEqual(
        [
          'action',
          'actor',
          'changed_fields',
          'entity_id',
          'entity_type',
          'id',
          'module',
          'occurred_at',
          'withheld_fields',
        ].sort(),
      );
      const text = JSON.stringify(res.body);
      for (const secret of [
        'Previous Name',
        'Penicillin',
        'New Name',
        'secret',
        'tok',
      ])
        expect(text).not.toContain(secret);

      const one = await detail('1').expect(200);
      expect(JSON.stringify(one.body)).not.toContain('Penicillin');
    });

    it('withholds changed-field entries that are not column names', async () => {
      seed(
        event({
          changed_fields: [
            'name',
            'Renamed Person',
            '0771234567',
            'phone_number',
          ],
        }),
      );
      const item = page(await list()).items[0];
      expect(item.changed_fields).toEqual(['name', 'phone_number']);
      expect(item.withheld_fields).toBe(2);
    });

    it('withholds a record reference that is not an id', async () => {
      seed(event({ entity_id: 'Kamal Perera 0771234567' }));
      expect(page(await list()).items[0].entity_id).toBeNull();
    });
  });

  describe('presentation', () => {
    it('labels modules and resolves user names where a profile exists', async () => {
      db.table('user_profiles').push(
        { id: ADMIN_ID, full_name: 'Nimal Admin' },
        { id: PHARMACIST_ID, full_name: null },
      );
      seed(
        event({ actor_id: ADMIN_ID }),
        event({ actor_id: PHARMACIST_ID, entity_type: 'reasons' }),
        event({ actor_id: null, entity_type: 'some_future_table' }),
      );
      const items = page(await list()).items;
      expect(items.map((e) => [e.id, e.module, e.actor])).toEqual([
        ['3', null, null],
        ['2', 'Edit reasons', { id: PHARMACIST_ID, name: null }],
        ['1', 'Patients', { id: ADMIN_ID, name: 'Nimal Admin' }],
      ]);
    });

    it('still returns events identified by user id when names cannot be loaded', async () => {
      db.fail('user_profiles', 'select');
      seed(event({ actor_id: ADMIN_ID }));
      const items = page(await list().expect(200)).items;
      expect(items[0].actor).toEqual({ id: ADMIN_ID, name: null });
    });

    it('does not look up names when no event has a user', async () => {
      seed(event());
      await list().expect(200);
      expect(db.calls.some((c) => c.table === 'user_profiles')).toBe(false);
    });
  });

  describe('details', () => {
    it('returns the recorded event', async () => {
      seed(
        event(),
        event({
          occurred_at: '2026-10-31T04:30:00+00:00',
          entity_type: 'pharmacy_settings',
          entity_id: 'true',
          changed_fields: ['address', 'phone', 'updated_by'],
          actor_id: ADMIN_ID,
        }),
      );
      const res = await detail('2').expect(200);
      expect(res.body).toEqual({
        id: '2',
        occurred_at: '2026-10-31T04:30:00+00:00',
        action: 'UPDATE',
        entity_type: 'pharmacy_settings',
        module: 'Pharmacy settings',
        entity_id: 'true',
        changed_fields: ['address', 'phone', 'updated_by'],
        withheld_fields: 0,
        actor: { id: ADMIN_ID, name: null },
      });
    });

    it('returns 404 for an event that does not exist', async () => {
      seed(event());
      const res = await detail('99').expect(404);
      expect(page(res).code).toBe('NOT_FOUND');
    });
  });

  describe('database failures', () => {
    it('reports a failed page load as 503, never as an empty log', async () => {
      seed(event());
      db.fail('audit_log', 'select', { message: 'fetch failed' }, 2);
      const res = await list().expect(503);
      expect(page(res).code).toBe('DATABASE_UNAVAILABLE');
      expect(page(res).items).toBeUndefined();
    });

    it('reports a failed count as 503', async () => {
      seed(event());
      db.fail('audit_log', 'select', { message: 'fetch failed' }, 1);
      await list().expect(503);
    });

    it('reports a missing table as a pending migration', async () => {
      db.fail('audit_log', 'select', { code: '42P01', message: 'relation' });
      const res = await list().expect(503);
      expect(page(res).code).toBe('SCHEMA_OUT_OF_DATE');
    });

    it('reports a failed detail load as 503', async () => {
      db.fail('audit_log', 'select');
      await detail('1').expect(503);
    });

    it('does not leak database messages', async () => {
      db.fail('audit_log', 'select', {
        code: 'XX000',
        message: 'row contains Kamal Perera',
      });
      const res = await list().expect(503);
      expect(JSON.stringify(res.body)).not.toContain('Kamal');
    });
  });
});
