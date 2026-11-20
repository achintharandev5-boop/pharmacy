import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { Server } from 'node:http';
import { AppModule } from '../app.module';
import { SupabaseService } from '../supabase/supabase.service';

describe('Synthetic staging HTTP boundary', () => {
  let app: INestApplication;
  const original = { ...process.env };
  const gateway = 'a'.repeat(64); // Public synthetic fixture; never a deployment token.
  const pharmacy = '10000000-0000-4000-8000-000000000001';
  const getUser = jest.fn();
  const from = jest.fn(() => {
    throw new Error('Database must not be reached');
  });

  beforeAll(async () => {
    Object.assign(process.env, {
      DEPLOYMENT_PROFILE: 'synthetic-staging',
      STAGING_DATA_POLICY: 'synthetic-only',
      STAGING_GATEWAY_TOKEN: gateway,
      SMS_ENABLED: 'false',
      SUPABASE_URL: 'https://staging.example.invalid',
      STAGING_SUPABASE_URL: 'https://staging.example.invalid',
      PILOT_SUPABASE_URL: 'https://staging.example.invalid',
      PILOT_PHARMACY_ID: pharmacy,
      SUPABASE_SERVICE_ROLE_KEY: 'synthetic-service-fixture',
      FRONTEND_URL: 'https://web.example.invalid',
    });
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(SupabaseService)
      .useValue({ getClient: () => ({ auth: { getUser }, from }) })
      .compile();
    app = module.createNestApplication();
    app.useLogger(false);
    await app.init();
  });
  beforeEach(() => {
    getUser.mockReset();
    from.mockClear();
  });
  afterAll(async () => {
    await app.close();
    process.env = original;
  });
  const server = () => app.getHttpServer() as Server;

  it.each([
    '/',
    '/health',
    '/health/db',
    '/auth/login',
    '/customers',
    '/prescriptions',
    '/inventory',
    '/admin/settings',
    '/unknown',
  ])('requires machine authentication on %s', async (path) => {
    await request(server()).get(path).expect(401);
    expect(getUser).not.toHaveBeenCalled();
    expect(from).not.toHaveBeenCalled();
  });
  it.each(['b'.repeat(64), 'é'.repeat(64), 'short'])(
    'refuses malformed/wrong gateway tokens safely',
    async (value) => {
      await request(server())
        .get('/health')
        .set('X-Staging-Gateway-Token', value)
        .expect(401);
    },
  );
  it('lets the authenticated gateway check liveness only', async () => {
    await request(server())
      .get('/health')
      .set('X-Staging-Gateway-Token', gateway)
      .expect(200, { status: 'ok' });
  });
  it('still requires user authentication after gateway authentication', async () => {
    await request(server())
      .get('/customers')
      .set('X-Staging-Gateway-Token', gateway)
      .expect(401);
    expect(from).not.toHaveBeenCalled();
  });
  it('rejects an account without the staging marker even with a valid gateway', async () => {
    getUser.mockResolvedValue({
      data: {
        user: {
          id: 'test',
          app_metadata: { role: 'admin', pharmacy_id: pharmacy },
        },
      },
      error: null,
    });
    await request(server())
      .get('/auth/me')
      .set('X-Staging-Gateway-Token', gateway)
      .set('Authorization', 'Bearer synthetic')
      .expect(403);
  });
  it('rejects an invalid bearer token after gateway authentication', async () => {
    getUser.mockResolvedValue({ data: { user: null }, error: { status: 401 } });
    await request(server())
      .get('/auth/me')
      .set('X-Staging-Gateway-Token', gateway)
      .set('Authorization', 'Bearer invalid')
      .expect(401);
  });
  it('accepts a dedicated test account and preserves its cashier role boundary', async () => {
    getUser.mockResolvedValue({
      data: {
        user: {
          id: 'test',
          app_metadata: {
            role: 'cashier',
            pharmacy_id: pharmacy,
            environment: 'synthetic-staging',
          },
        },
      },
      error: null,
    });
    await request(server())
      .get('/auth/me')
      .set('X-Staging-Gateway-Token', gateway)
      .set('Authorization', 'Bearer synthetic')
      .expect(200);
    await request(server())
      .get('/customers')
      .set('X-Staging-Gateway-Token', gateway)
      .set('Authorization', 'Bearer synthetic')
      .expect(403);
    expect(from).not.toHaveBeenCalled();
  });
  it.each([
    '/prescriptions/test/print',
    '/admin/prescriptions/test/reprint',
    '/prescriptions/test/sms',
    '/pos/checkout',
    '/payments',
    '/auth/signup',
  ])('blocks issuance and external side effects on %s', async (path) => {
    await request(server())
      .post(path)
      .set('X-Staging-Gateway-Token', gateway)
      .expect(403);
    expect(from).not.toHaveBeenCalled();
  });
});
