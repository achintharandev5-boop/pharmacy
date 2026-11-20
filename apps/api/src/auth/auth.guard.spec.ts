import { Controller, Get, INestApplication, Post } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import type { Server } from 'http';
import request from 'supertest';
import { SupabaseService } from '../supabase/supabase.service';
import { AuthGuard } from './auth.guard';
import { AnyAuthenticatedUser, CurrentUser, Public, Roles } from './decorators';
import { Role, STOCK_MANAGERS, type AuthUser } from './roles';
import { RolesGuard } from './roles.guard';

@Controller()
class ProbeController {
  @Public()
  @Get('open')
  open() {
    return { ok: true };
  }

  @Get('closed')
  closed(@CurrentUser() user: AuthUser) {
    return user;
  }

  @AnyAuthenticatedUser()
  @Get('whoami')
  whoami(@CurrentUser() user: AuthUser) {
    return user;
  }

  @Roles(...STOCK_MANAGERS)
  @Post('stock')
  stock() {
    return { ok: true };
  }

  @Roles(Role.Admin)
  @Post('admin-only')
  adminOnly() {
    return { ok: true };
  }
}

describe('Authentication and authorization (HTTP)', () => {
  let app: INestApplication;
  const getUser = jest.fn();
  const configGet = jest.fn();
  const originalEnv = process.env.NODE_ENV;

  const userWithRole = (role?: string) => ({
    data: {
      user: {
        id: 'user-1',
        email: 'user@example.test',
        app_metadata: role ? { role } : {},
      },
    },
    error: null,
  });

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [ProbeController],
      providers: [
        { provide: ConfigService, useValue: { get: configGet } },
        {
          provide: SupabaseService,
          useValue: { getClient: () => ({ auth: { getUser } }) },
        },
        { provide: APP_GUARD, useClass: AuthGuard },
        { provide: APP_GUARD, useClass: RolesGuard },
      ],
    }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    process.env.NODE_ENV = originalEnv;
    await app.close();
  });

  const server = () => app.getHttpServer() as Server;
  type Body = { role?: string | null; message?: string };

  beforeEach(() => {
    getUser.mockReset();
    configGet.mockReset();
  });

  describe('fails closed', () => {
    it.each([
      ['unset', undefined],
      ['development', 'development'],
      ['production', 'production'],
    ])(
      'rejects a request without a token when NODE_ENV is %s',
      async (_label, env) => {
        if (env === undefined) delete process.env.NODE_ENV;
        else process.env.NODE_ENV = env;

        await request(server()).get('/closed').expect(401);
        expect(getUser).not.toHaveBeenCalled();
      },
    );

    it('rejects a malformed authorization header', async () => {
      await request(server())
        .get('/closed')
        .set('Authorization', 'Token abc')
        .expect(401);
      await request(server())
        .get('/closed')
        .set('Authorization', 'Bearer')
        .expect(401);
      await request(server())
        .get('/closed')
        .set('Authorization', 'Bearer token trailing-data')
        .expect(401);
      expect(getUser).not.toHaveBeenCalled();
    });

    it('rejects an invalid token', async () => {
      getUser.mockResolvedValue({
        data: { user: null },
        error: { status: 403, message: 'invalid JWT' },
      });
      await request(server())
        .get('/closed')
        .set('Authorization', 'Bearer not-a-jwt')
        .expect(401);
    });

    it('rejects an expired token', async () => {
      getUser.mockResolvedValue({
        data: { user: null },
        error: { status: 401, message: 'JWT expired' },
      });
      await request(server())
        .get('/closed')
        .set('Authorization', 'Bearer expired')
        .expect(401);
    });

    it('does not let a user through when the auth service is down', async () => {
      getUser.mockResolvedValue({
        data: { user: null },
        error: { status: undefined, message: 'fetch failed' },
      });
      await request(server())
        .get('/closed')
        .set('Authorization', 'Bearer t')
        .expect(503);

      getUser.mockRejectedValue(new Error('ECONNREFUSED'));
      await request(server())
        .get('/closed')
        .set('Authorization', 'Bearer t')
        .expect(503);
    });
  });

  it('allows explicitly public routes without a token', async () => {
    await request(server()).get('/open').expect(200);
  });

  it.each([undefined, '10000000-0000-4000-8000-000000000002', 'invalid'])(
    'refuses a pilot account with a missing or different pharmacy assignment: %s',
    async (assignment) => {
      configGet.mockReturnValue('10000000-0000-4000-8000-000000000001');
      const response = userWithRole('admin');
      Object.assign(response.data.user.app_metadata, {
        pharmacy_id: assignment,
      });
      getUser.mockResolvedValue(response);
      await request(server())
        .get('/closed')
        .set('Authorization', 'Bearer good')
        .expect(403);
      await request(server())
        .get('/whoami')
        .set('Authorization', 'Bearer good')
        .expect(403);
    },
  );

  it('admits an assigned pilot pharmacist after token verification', async () => {
    const pharmacyId = '10000000-0000-4000-8000-000000000001';
    configGet.mockReturnValue(pharmacyId);
    const response = userWithRole('pharmacist');
    Object.assign(response.data.user.app_metadata, { pharmacy_id: pharmacyId });
    getUser.mockResolvedValue(response);
    await request(server())
      .get('/closed')
      .set('Authorization', 'Bearer good')
      .expect(200);
  });

  it('attaches the verified user, with the role taken from app_metadata', async () => {
    getUser.mockResolvedValue(userWithRole('pharmacist'));
    const res = await request(server())
      .get('/closed')
      .set('Authorization', 'Bearer good')
      .expect(200);
    expect(res.body).toEqual({
      id: 'user-1',
      email: 'user@example.test',
      role: 'pharmacist',
    });
    expect(getUser).toHaveBeenCalledWith('good');
  });

  it('ignores an unknown role value', async () => {
    getUser.mockResolvedValue(userWithRole('superuser'));
    const res = await request(server())
      .get('/whoami')
      .set('Authorization', 'Bearer good')
      .expect(200);
    expect((res.body as Body).role).toBeNull();
    // An unrecognised role grants nothing.
    await request(server())
      .get('/closed')
      .set('Authorization', 'Bearer good')
      .expect(403);
  });

  describe('routes without @Roles fail closed', () => {
    it.each(['admin', 'pharmacist', 'staff'])(
      'admits the pharmacy role %s',
      async (role) => {
        getUser.mockResolvedValue(userWithRole(role));
        await request(server())
          .get('/closed')
          .set('Authorization', 'Bearer t')
          .expect(200);
      },
    );

    it('refuses an account with no role and explains why', async () => {
      getUser.mockResolvedValue(userWithRole());
      const res = await request(server())
        .get('/closed')
        .set('Authorization', 'Bearer t')
        .expect(403);
      expect((res.body as Body).message).toMatch(/no role assigned/);
    });

    it('refuses the POS-only cashier role', async () => {
      getUser.mockResolvedValue(userWithRole('cashier'));
      await request(server())
        .get('/closed')
        .set('Authorization', 'Bearer t')
        .expect(403);
    });

    it('lets any signed-in account read its own identity, but still requires a valid token', async () => {
      getUser.mockResolvedValue(userWithRole());
      const res = await request(server())
        .get('/whoami')
        .set('Authorization', 'Bearer t')
        .expect(200);
      expect((res.body as Body).role).toBeNull();
      await request(server()).get('/whoami').expect(401);
    });
  });

  describe('role enforcement', () => {
    it('lets stock managers change stock', async () => {
      getUser.mockResolvedValue(userWithRole('pharmacist'));
      await request(server())
        .post('/stock')
        .set('Authorization', 'Bearer t')
        .expect(201);
    });

    it('forbids staff from changing stock', async () => {
      getUser.mockResolvedValue(userWithRole('staff'));
      await request(server())
        .post('/stock')
        .set('Authorization', 'Bearer t')
        .expect(403);
    });

    it('forbids a signed-in user with no role from protected actions', async () => {
      getUser.mockResolvedValue(userWithRole());
      const res = await request(server())
        .post('/stock')
        .set('Authorization', 'Bearer t')
        .expect(403);
      expect((res.body as Body).message).toMatch(/no role assigned/);
    });

    it('limits admin-only routes to administrators', async () => {
      getUser.mockResolvedValue(userWithRole('pharmacist'));
      await request(server())
        .post('/admin-only')
        .set('Authorization', 'Bearer t')
        .expect(403);
      getUser.mockResolvedValue(userWithRole('admin'));
      await request(server())
        .post('/admin-only')
        .set('Authorization', 'Bearer t')
        .expect(201);
    });

    it('checks authentication before roles', async () => {
      await request(server()).post('/stock').expect(401);
    });
  });
});
