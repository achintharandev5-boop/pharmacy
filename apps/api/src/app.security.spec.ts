import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from './app.module';
import { SupabaseService } from './supabase/supabase.service';

/**
 * Boots the real application module and checks every registered route: only the explicit
 * allowlist may answer without a token, regardless of NODE_ENV.
 */
describe('Application route protection', () => {
  let app: INestApplication;
  const PUBLIC_ROUTES = new Set(['GET /health', 'POST /auth/login']);
  const dbCalls = jest.fn();

  beforeAll(async () => {
    process.env.SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key-not-real';
    delete process.env.NODE_ENV;

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(SupabaseService)
      .useValue({
        getClient: () => {
          dbCalls();
          return {
            auth: { getUser: async () => ({ data: { user: null }, error: { status: 401, message: 'bad' } }) },
            from: () => {
              throw new Error('database must not be reached');
            },
          };
        },
        createSessionClient: () => ({
          auth: { signInWithPassword: async () => ({ data: { session: null }, error: { status: 400, message: 'invalid' } }) },
        }),
      })
      .compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  function routes(): { method: string; path: string }[] {
    const router = app.getHttpAdapter().getInstance().router;
    return router.stack
      .filter((layer: any) => layer.route)
      .flatMap((layer: any) =>
        Object.keys(layer.route.methods).map((m) => ({ method: m.toUpperCase(), path: layer.route.path as string })),
      );
  }

  it('registers the expected routes', () => {
    expect(routes().length).toBeGreaterThan(30);
  });

  it('rejects every non-public route without a token', async () => {
    const unprotected: string[] = [];
    for (const { method, path } of routes()) {
      const key = `${method} ${path}`;
      if (PUBLIC_ROUTES.has(key)) continue;
      const url = path.replace(/:[^/]+/g, '00000000-0000-4000-8000-000000000000');
      const res = await (request(app.getHttpServer()) as any)[method.toLowerCase()](url).send({});
      if (res.status !== 401) unprotected.push(`${key} -> ${res.status}`);
    }
    expect(unprotected).toEqual([]);
  });

  it('rejects every non-public route with an invalid token', async () => {
    for (const { method, path } of routes()) {
      if (PUBLIC_ROUTES.has(`${method} ${path}`)) continue;
      const url = path.replace(/:[^/]+/g, '00000000-0000-4000-8000-000000000000');
      await (request(app.getHttpServer()) as any)[method.toLowerCase()](url).set('Authorization', 'Bearer forged').expect(401);
    }
  });

  it('keeps the public routes reachable', async () => {
    await request(app.getHttpServer()).get('/health').expect(200, { status: 'ok' });
    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'someone@example.test', password: 'wrong' })
      .expect(401);
    expect(res.body.message).toBe('Invalid email or password');
  });

  it('validates the login body before contacting the auth service', async () => {
    await request(app.getHttpServer()).post('/auth/login').send({ email: 'not-an-email' }).expect(400);
  });
});
