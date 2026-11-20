import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { Server } from 'http';
import request from 'supertest';
import { AppModule } from '../app.module';
import { SupabaseService } from '../supabase/supabase.service';

/**
 * Boots the real application and checks every registered route for each kind of signed-in
 * account. The database is never reached on a refused request (it throws if touched), so a 403
 * proves the guard refused before any query ran.
 */
describe('Route authorization by role', () => {
  let app: INestApplication;
  const PUBLIC_ROUTES = new Set(['GET /health', 'POST /auth/login']);
  /** Routes a cashier may use: the point of sale and their own identity. */
  const CASHIER_ROUTES = new Set([
    'GET /pos/catalog',
    'GET /pos/customers',
    'GET /auth/me',
  ]);
  /** Routes an account without a recognised role may use. */
  const ROLELESS_ROUTES = new Set(['GET /auth/me']);
  const ROLE_BY_TOKEN: Record<string, string | undefined> = {
    cashier: 'cashier',
    none: undefined,
    unknown: 'superuser',
    staff: 'staff',
    pharmacist: 'pharmacist',
    admin: 'admin',
  };
  let dbReached = 0;

  beforeAll(async () => {
    process.env.SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key-not-real';

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(SupabaseService)
      .useValue({
        getClient: () => ({
          auth: {
            getUser: (token: string) => {
              if (!(token in ROLE_BY_TOKEN))
                return Promise.resolve({
                  data: { user: null },
                  error: { status: 401, message: 'bad' },
                });
              const role = ROLE_BY_TOKEN[token];
              return Promise.resolve({
                data: {
                  user: {
                    id: `user-${token}`,
                    email: null,
                    app_metadata: role ? { role } : {},
                  },
                },
                error: null,
              });
            },
          },
          from: () => {
            dbReached++;
            throw new Error('database reached');
          },
          rpc: () => {
            dbReached++;
            throw new Error('database reached');
          },
        }),
        createSessionClient: () => ({}),
      })
      .compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    // Silence the expected "database reached" errors from allowed routes.
    app.useLogger(false);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  interface RouterLayer {
    route?: { path: string; methods: Record<string, boolean> };
  }

  function routes(): { method: string; path: string; key: string }[] {
    const express = app.getHttpAdapter().getInstance() as {
      router: { stack: RouterLayer[] };
    };
    return express.router.stack.flatMap(({ route }) =>
      route
        ? Object.keys(route.methods).map((m) => {
            const method = m.toUpperCase();
            const path = route.path.replace(/\/$/, '') || '/';
            return { method, path, key: `${method} ${path}` };
          })
        : [],
    );
  }

  async function statusFor(
    token: string,
    method: string,
    path: string,
  ): Promise<number> {
    const url = path.replace(/:[^/]+/g, '00000000-0000-4000-8000-000000000000');
    const agent = request(app.getHttpServer() as Server);
    const verb = method.toLowerCase();
    const req =
      verb === 'post'
        ? agent.post(url)
        : verb === 'patch'
          ? agent.patch(url)
          : verb === 'delete'
            ? agent.delete(url)
            : agent.get(url);
    const res = await req.set('Authorization', `Bearer ${token}`).send({});
    return res.status;
  }

  it('enumerates the POS routes', () => {
    const keys = routes().map((r) => r.key);
    for (const key of CASHIER_ROUTES) expect(keys).toContain(key);
  });

  it.each([
    ['cashier', CASHIER_ROUTES],
    ['none', ROLELESS_ROUTES],
    ['unknown', ROLELESS_ROUTES],
  ])(
    'refuses the %s account on every route outside its allowlist, before the database',
    async (token, allowed) => {
      const leaked: string[] = [];
      for (const { method, path, key } of routes()) {
        if (PUBLIC_ROUTES.has(key) || allowed.has(key)) continue;
        const before = dbReached;
        const status = await statusFor(token, method, path);
        if (status !== 403 || dbReached !== before)
          leaked.push(`${key} -> ${status}`);
      }
      expect(leaked).toEqual([]);
    },
  );

  it.each(['cashier', 'none'])(
    'lets the %s account read its own identity',
    async (token) => {
      expect(await statusFor(token, 'GET', '/auth/me')).toBe(200);
    },
  );

  it('lets a cashier reach the POS catalogue and the minimal patient lookup', async () => {
    expect(await statusFor('cashier', 'GET', '/pos/catalog?q=pan')).not.toBe(
      403,
    );
    expect(
      await statusFor('cashier', 'GET', '/pos/customers?phone=0771234567'),
    ).not.toBe(403);
  });

  it.each([
    ['GET', '/customers'],
    ['GET', '/customers/search?phone=077'],
    ['POST', '/customers'],
    ['PATCH', '/customers/:id'],
    ['GET', '/customers/duplicates?phone=0771234567'],
    ['GET', '/admin/patients/:id'],
    ['GET', '/admin/prescriptions'],
    ['POST', '/admin/prescriptions/:id/reprint'],
    ['POST', '/prescriptions'],
    ['POST', '/labels'],
    [
      'GET',
      '/inventory/dispensing-batches?productId=00000000-0000-4000-8000-000000000000',
    ],
    ['POST', '/inventory/adjustments'],
    ['POST', '/inventory/receipts'],
    ['POST', '/products'],
    ['GET', '/reasons'],
    ['GET', '/admin/settings'],
    ['PATCH', '/admin/settings'],
  ])('refuses a cashier: %s %s', async (method, path) => {
    expect(await statusFor('cashier', method, path)).toBe(403);
  });

  it.each(['staff', 'pharmacist'])(
    'lets %s read the pharmacy settings but not change them',
    async (token) => {
      expect(await statusFor(token, 'GET', '/admin/settings')).not.toBe(403);
      const before = dbReached;
      expect(await statusFor(token, 'PATCH', '/admin/settings')).toBe(403);
      expect(dbReached).toBe(before);
    },
  );

  it('lets an administrator change the pharmacy settings', async () => {
    expect(await statusFor('admin', 'PATCH', '/admin/settings')).not.toBe(403);
  });

  it('registers only read routes for the audit log', () => {
    const audit = routes()
      .filter((r) => r.path.startsWith('/admin/audit-log'))
      .map((r) => r.key)
      .sort();
    expect(audit).toEqual(['GET /admin/audit-log', 'GET /admin/audit-log/:id']);
  });

  it.each(['staff', 'pharmacist', 'cashier', 'none', 'unknown'])(
    'refuses the %s account on the audit log, before the database',
    async (token) => {
      const before = dbReached;
      expect(await statusFor(token, 'GET', '/admin/audit-log')).toBe(403);
      expect(await statusFor(token, 'GET', '/admin/audit-log/1')).toBe(403);
      expect(dbReached).toBe(before);
    },
  );

  it('refuses the audit log without a valid token', async () => {
    expect(await statusFor('expired', 'GET', '/admin/audit-log')).toBe(401);
    const res = await request(app.getHttpServer() as Server).get(
      '/admin/audit-log',
    );
    expect(res.status).toBe(401);
  });

  it('lets an administrator read the audit log', async () => {
    expect(await statusFor('admin', 'GET', '/admin/audit-log')).not.toBe(403);
    expect(await statusFor('admin', 'GET', '/admin/audit-log/1')).not.toBe(403);
  });

  it.each(['staff', 'pharmacist', 'admin'])(
    'keeps every route without its own @Roles open to %s (pharmacy workflows unchanged)',
    async (token) => {
      const refused: string[] = [];
      for (const { method, path, key } of [
        { method: 'GET', path: '/customers', key: 'GET /customers' },
        {
          method: 'GET',
          path: '/customers/search?phone=077',
          key: 'GET /customers/search',
        },
        {
          method: 'GET',
          path: '/admin/prescriptions',
          key: 'GET /admin/prescriptions',
        },
        {
          method: 'GET',
          path: '/products/search?q=pan',
          key: 'GET /products/search',
        },
        {
          method: 'GET',
          path: '/inventory/batches',
          key: 'GET /inventory/batches',
        },
        { method: 'GET', path: '/labels', key: 'GET /labels' },
        { method: 'GET', path: '/pos/catalog?q=pan', key: 'GET /pos/catalog' },
      ]) {
        if ((await statusFor(token, method, path)) === 403) refused.push(key);
      }
      expect(refused).toEqual([]);
    },
  );
});
