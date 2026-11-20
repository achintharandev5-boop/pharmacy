import { INestApplication, ValidationPipe } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { Server } from 'http';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { SupabaseService } from '../supabase/supabase.service';
import { FakeSupabase } from '../test-utils/fake-supabase';
import { SettingsController } from './settings.controller';
import { SettingsService } from './settings.service';

const LOADED_AT = '2026-10-30T08:00:00.000000+00:00';
const ADMIN_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

const row = () => ({
  id: true,
  pharmacy_name: 'Sample Pharmacy',
  address: 'No. 1, Main Street',
  phone: '0112345678',
  timezone: 'Asia/Colombo',
  label_width_mm: null,
  label_height_mm: null,
  printer_name: null,
  sms_enabled: false,
  sms_sender_id: null,
  low_stock_alerts_enabled: true,
  expiry_alert_days: 30,
  updated_at: LOADED_AT,
  updated_by: null,
});

interface ResponseBody {
  code?: string;
  message?: unknown;
  changed?: string[];
  settings?: Record<string, unknown>;
  pharmacy_name?: string;
}
const body = (res: { body: unknown }) => res.body as ResponseBody;

describe('Pharmacy settings HTTP', () => {
  let app: INestApplication<Server>;
  let db: FakeSupabase;
  let role: string | undefined;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [SettingsController],
      providers: [
        SettingsService,
        {
          provide: SupabaseService,
          useValue: {
            getClient: () => ({
              ...db.client(),
              auth: {
                getUser: () =>
                  Promise.resolve({
                    data: {
                      user: {
                        id: ADMIN_ID,
                        app_metadata: role ? { role } : {},
                      },
                    },
                    error: null,
                  }),
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
    db = new FakeSupabase({ pharmacy_settings: [row()] });
  });

  const get = () =>
    request(app.getHttpServer())
      .get('/admin/settings')
      .set('Authorization', 'Bearer t');
  const patch = (body: object) =>
    request(app.getHttpServer())
      .patch('/admin/settings')
      .set('Authorization', 'Bearer t')
      .send(body);
  const saved = () => db.table('pharmacy_settings')[0];
  const updates = () =>
    db.calls.filter(
      (c) => c.op === 'update' && c.table === 'pharmacy_settings',
    );

  describe('loading', () => {
    it.each(['admin', 'pharmacist', 'staff'])(
      'returns the saved settings to %s',
      async (r) => {
        role = r;
        const res = await get().expect(200);
        expect(res.body).toMatchObject({
          pharmacy_name: 'Sample Pharmacy',
          address: 'No. 1, Main Street',
          phone: '0112345678',
          printer_name: null,
          timezone: 'Asia/Colombo',
          expiry_alert_days: 30,
          low_stock_alerts_enabled: true,
          updated_at: LOADED_AT,
        });
      },
    );

    it.each([['cashier'], ['superuser'], [undefined]])(
      'refuses the %s account before the database',
      async (r) => {
        role = r;
        await get().expect(403);
        expect(db.calls).toEqual([]);
      },
    );

    it('reports a missing settings row instead of inventing one', async () => {
      db = new FakeSupabase({ pharmacy_settings: [] });
      const res = await get().expect(404);
      expect(body(res).code).toBe('SETTINGS_MISSING');
      expect(db.calls.some((c) => c.op === 'insert')).toBe(false);
    });

    it('reports a failed database request', async () => {
      db.fail('pharmacy_settings', 'select');
      const res = await get().expect(503);
      expect(body(res).code).toBe('DATABASE_UNAVAILABLE');
    });
  });

  describe('updating', () => {
    it('writes only the fields that changed and records who changed them', async () => {
      const res = await patch({
        pharmacy_name: 'Sample Pharmacy',
        phone: '011 234 5679',
        expected_updated_at: LOADED_AT,
      }).expect(200);
      expect(body(res).changed).toEqual(['phone']);
      expect(saved()).toMatchObject({
        pharmacy_name: 'Sample Pharmacy',
        address: 'No. 1, Main Street',
        phone: '011 234 5679',
        updated_by: ADMIN_ID,
        timezone: 'Asia/Colombo',
        expiry_alert_days: 30,
      });
      expect(body(res).settings?.phone).toBe('011 234 5679');
    });

    it('does not write when nothing changed', async () => {
      const res = await patch({
        pharmacy_name: '  Sample Pharmacy ',
        address: 'No. 1, Main Street',
      }).expect(200);
      expect(body(res).changed).toEqual([]);
      expect(updates()).toEqual([]);
      expect(saved().updated_by).toBeNull();
    });

    it('clears a value sent as an empty string or null', async () => {
      await patch({ address: '   ', phone: null }).expect(200);
      expect(saved()).toMatchObject({ address: null, phone: null });
    });

    it('keeps Sinhala wording exactly, trimming only surrounding spaces', async () => {
      await patch({ pharmacy_name: '  සුව ෆාමසි  ' }).expect(200);
      expect(saved().pharmacy_name).toBe('සුව ෆාමසි');
    });

    it('saves the printer reference name', async () => {
      await patch({ printer_name: 'Front counter label printer' }).expect(200);
      expect(saved().printer_name).toBe('Front counter label printer');
    });

    it('persists: a later load returns the saved values', async () => {
      await patch({ pharmacy_name: 'Renamed Pharmacy' }).expect(200);
      const res = await get().expect(200);
      expect(body(res).pharmacy_name).toBe('Renamed Pharmacy');
    });
  });

  describe('authorization', () => {
    it.each([
      ['pharmacist'],
      ['staff'],
      ['cashier'],
      ['superuser'],
      [undefined],
    ])('refuses a change by the %s account before the database', async (r) => {
      role = r;
      await patch({ pharmacy_name: 'Taken over' }).expect(403);
      expect(db.calls).toEqual([]);
      expect(saved().pharmacy_name).toBe('Sample Pharmacy');
    });
  });

  describe('validation', () => {
    it.each([
      [{ phone: 'call me' }],
      [{ phone: '12' }],
      [{ pharmacy_name: 'Line one\nLine two' }],
      [{ pharmacy_name: 'x'.repeat(121) }],
      [{ address: 'a'.repeat(301) }],
      [{ address: 'tab\there' }],
      [{ printer_name: 'p'.repeat(101) }],
      [{ pharmacy_name: 42 }],
    ])('rejects %j without writing', async (body) => {
      await patch(body).expect(400);
      expect(updates()).toEqual([]);
    });

    it.each([
      'timezone',
      'label_width_mm',
      'label_height_mm',
      'expiry_alert_days',
      'low_stock_alerts_enabled',
      'sms_enabled',
      'updated_by',
    ])('refuses to change the read-only %s setting', async (field) => {
      const res = await patch({ pharmacy_name: 'X', [field]: 1 }).expect(400);
      expect(JSON.stringify(body(res).message)).toContain(field);
      expect(updates()).toEqual([]);
      expect(saved()).toEqual(row());
    });

    it('rejects a request with no editable setting', async () => {
      const res = await patch({}).expect(400);
      expect(body(res).code).toBe('NO_SETTINGS');
    });
  });

  describe('failures and conflicts', () => {
    it('refuses a save based on settings someone else has since changed', async () => {
      const res = await patch({
        pharmacy_name: 'Mine',
        expected_updated_at: '2026-10-29T00:00:00+00:00',
      }).expect(409);
      expect(body(res).code).toBe('SETTINGS_CHANGED');
      expect(updates()).toEqual([]);
    });

    it('refuses to overwrite a save that lands between loading and writing', async () => {
      db.beforeUpdate = () => {
        Object.assign(saved(), {
          pharmacy_name: 'Theirs',
          updated_at: '2026-10-30T08:00:01+00:00',
        });
      };
      const res = await patch({ pharmacy_name: 'Mine' }).expect(409);
      expect(body(res).code).toBe('SETTINGS_CHANGED');
      expect(saved().pharmacy_name).toBe('Theirs');
    });

    it('reports a failed write and leaves the saved settings unchanged', async () => {
      db.fail('pharmacy_settings', 'update');
      const res = await patch({ pharmacy_name: 'Mine' }).expect(503);
      expect(body(res).code).toBe('DATABASE_UNAVAILABLE');
      expect(saved()).toEqual(row());
    });

    it('reports a value the database rejects', async () => {
      db.fail('pharmacy_settings', 'update', {
        code: '23514',
        message: 'check',
      });
      const res = await patch({ pharmacy_name: 'Mine' }).expect(400);
      expect(body(res).code).toBe('INVALID_VALUE');
    });
  });
});
