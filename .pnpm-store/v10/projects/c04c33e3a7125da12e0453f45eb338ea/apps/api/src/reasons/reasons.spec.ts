import { INestApplication, ValidationPipe } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { Server } from 'http';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { SupabaseService } from '../supabase/supabase.service';
import { FakeSupabase } from '../test-utils/fake-supabase';
import {
  ReasonsController,
  AdminReasonsController,
} from './reasons.controller';
import { ReasonsService } from './reasons.service';
const pharmacy = '11111111-1111-4111-8111-111111111111';
const other = '22222222-2222-4222-8222-222222222222';
describe('Reasons catalogue HTTP', () => {
  let app: INestApplication<Server>;
  let db: FakeSupabase;
  let metadata: Record<string, string>;
  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [ReasonsController, AdminReasonsController],
      providers: [
        ReasonsService,
        {
          provide: SupabaseService,
          useValue: {
            getClient: () => ({
              ...db.client(),
              auth: {
                getUser: () =>
                  Promise.resolve({
                    data: { user: { id: 'admin', app_metadata: metadata } },
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
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
  });
  afterAll(() => app.close());
  beforeEach(() => {
    metadata = { role: 'admin', pharmacy_id: pharmacy };
    db = new FakeSupabase({
      reasons: [
        {
          id: '33333333-3333-4333-8333-333333333333',
          pharmacy_id: pharmacy,
          text: 'පරීක්ෂණය එක',
          is_active: true,
        },
        {
          id: '44444444-4444-4444-8444-444444444444',
          pharmacy_id: other,
          text: 'Other',
          is_active: true,
        },
      ],
      prescription_items: [
        {
          instructions_json: { reasons: ['පරීක්ෂණය එක'] },
          final_instruction_text: 'පරීක්ෂණය එක',
        },
      ],
    });
    db.unique.reasons = [['pharmacy_id', 'text']];
  });
  const call = (method: 'get' | 'post' | 'patch' | 'delete', path: string) =>
    request(app.getHttpServer())
      [method](path)
      .set('Authorization', 'Bearer test');
  it('requires authentication', () =>
    request(app.getHttpServer()).get('/reasons').expect(401));
  it.each(['staff', 'pharmacist', 'unknown'])(
    'rejects every Admin operation for %s',
    async (role) => {
      metadata.role = role;
      // Reading the catalogue needs a pharmacy staff role; an unrecognised role grants nothing.
      await call('get', '/reasons').expect(role === 'unknown' ? 403 : 200);
      await call('get', '/admin/reasons').expect(403);
      await call('post', '/admin/reasons').send({ text: 'test' }).expect(403);
      await call('patch', '/admin/reasons/33333333-3333-4333-8333-333333333333')
        .send({ text: 'test' })
        .expect(403);
      await call(
        'delete',
        '/admin/reasons/33333333-3333-4333-8333-333333333333',
      ).expect(403);
    },
  );
  it('fails closed without trusted scope', async () => {
    delete metadata.pharmacy_id;
    await call('get', '/reasons').expect(403);
    await call('post', '/admin/reasons').send({ text: 'test' }).expect(403);
    expect(db.calls).toHaveLength(0);
  });
  it('records the verified actor rather than caller-supplied actor metadata', async () => {
    const created = await call('post', '/admin/reasons')
      .send({ text: 'Audit fixture' })
      .expect(201);
    const id = (created.body as { id: string }).id;
    expect(db.tables.reasons.find((r) => r.id === id)?.updated_by).toBe(
      'admin',
    );
    await call('patch', '/admin/reasons/' + id)
      .send({ text: 'Audit changed' })
      .expect(200);
    expect(db.tables.reasons.find((r) => r.id === id)?.updated_by).toBe(
      'admin',
    );
    await call('delete', '/admin/reasons/' + id).expect(200);
    expect(db.tables.reasons.find((r) => r.id === id)?.updated_by).toBe(
      'admin',
    );
    await call('post', '/admin/reasons')
      .send({ text: 'Forbidden actor', updated_by: 'attacker' })
      .expect(400);
  });
  it('creates, edits, deactivates and preserves historical wording', async () => {
    const history = JSON.stringify(db.tables.prescription_items);
    const created = await call('post', '/admin/reasons')
      .send({ text: '  Exact wording  ' })
      .expect(201);
    expect((created.body as { text: string }).text).toBe('  Exact wording  ');
    const id = '33333333-3333-4333-8333-333333333333';
    await call('patch', '/admin/reasons/' + id)
      .send({ text: 'Renamed' })
      .expect(200);
    await call('delete', '/admin/reasons/' + id).expect(200);
    const active = await call('get', '/reasons').expect(200);
    expect((active.body as { text: string }[]).map((r) => r.text)).toEqual([
      '  Exact wording  ',
    ]);
    const admin = await call('get', '/admin/reasons').expect(200);
    expect(admin.body).toHaveLength(2);
    expect(JSON.stringify(db.tables.prescription_items)).toBe(history);
  });
  it('cannot edit or deactivate another pharmacy reason', async () => {
    const path = '/admin/reasons/44444444-4444-4444-8444-444444444444';
    await call('patch', path).send({ text: 'stolen' }).expect(404);
    await call('delete', path).expect(404);
    expect(db.tables.reasons[1].text).toBe('Other');
  });
  it.each(['', '   ', 'a'.repeat(201), 'line\nbreak'])(
    'rejects invalid text %p',
    async (text) => {
      await call('post', '/admin/reasons').send({ text }).expect(400);
    },
  );
  it('rejects duplicates and caller-controlled scope', async () => {
    await call('post', '/admin/reasons')
      .send({ text: 'පරීක්ෂණය එක' })
      .expect(409);
    await call('post', '/admin/reasons')
      .send({ text: 'test', pharmacy_id: other })
      .expect(400);
  });
  it('returns a genuine empty catalogue and reports database errors', async () => {
    db.tables.reasons = [];
    expect((await call('get', '/reasons').expect(200)).body).toEqual([]);
    db.fail('reasons', 'select');
    await call('get', '/reasons').expect(503);
  });
});
