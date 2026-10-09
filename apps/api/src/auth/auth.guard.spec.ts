import { Controller, Get, INestApplication, Post } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { SupabaseService } from '../supabase/supabase.service';
import { AuthGuard } from './auth.guard';
import { CurrentUser, Public, Roles } from './decorators';
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
  const originalEnv = process.env.NODE_ENV;

  const userWithRole = (role?: string) => ({
    data: { user: { id: 'user-1', email: 'user@example.test', app_metadata: role ? { role } : {} } },
    error: null,
  });

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [ProbeController],
      providers: [
        { provide: SupabaseService, useValue: { getClient: () => ({ auth: { getUser } }) } },
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

  beforeEach(() => getUser.mockReset());

  describe('fails closed', () => {
    it.each([
      ['unset', undefined],
      ['development', 'development'],
      ['production', 'production'],
    ])('rejects a request without a token when NODE_ENV is %s', async (_label, env) => {
      if (env === undefined) delete process.env.NODE_ENV;
      else process.env.NODE_ENV = env;

      await request(app.getHttpServer()).get('/closed').expect(401);
      expect(getUser).not.toHaveBeenCalled();
    });

    it('rejects a malformed authorization header', async () => {
      await request(app.getHttpServer()).get('/closed').set('Authorization', 'Token abc').expect(401);
      await request(app.getHttpServer()).get('/closed').set('Authorization', 'Bearer').expect(401);
      expect(getUser).not.toHaveBeenCalled();
    });

    it('rejects an invalid token', async () => {
      getUser.mockResolvedValue({ data: { user: null }, error: { status: 403, message: 'invalid JWT' } });
      await request(app.getHttpServer()).get('/closed').set('Authorization', 'Bearer not-a-jwt').expect(401);
    });

    it('rejects an expired token', async () => {
      getUser.mockResolvedValue({ data: { user: null }, error: { status: 401, message: 'JWT expired' } });
      await request(app.getHttpServer()).get('/closed').set('Authorization', 'Bearer expired').expect(401);
    });

    it('does not let a user through when the auth service is down', async () => {
      getUser.mockResolvedValue({ data: { user: null }, error: { status: undefined, message: 'fetch failed' } });
      await request(app.getHttpServer()).get('/closed').set('Authorization', 'Bearer t').expect(503);

      getUser.mockRejectedValue(new Error('ECONNREFUSED'));
      await request(app.getHttpServer()).get('/closed').set('Authorization', 'Bearer t').expect(503);
    });
  });

  it('allows explicitly public routes without a token', async () => {
    await request(app.getHttpServer()).get('/open').expect(200);
  });

  it('attaches the verified user, with the role taken from app_metadata', async () => {
    getUser.mockResolvedValue(userWithRole('pharmacist'));
    const res = await request(app.getHttpServer()).get('/closed').set('Authorization', 'Bearer good').expect(200);
    expect(res.body).toEqual({ id: 'user-1', email: 'user@example.test', role: 'pharmacist' });
    expect(getUser).toHaveBeenCalledWith('good');
  });

  it('ignores an unknown role value', async () => {
    getUser.mockResolvedValue(userWithRole('superuser'));
    const res = await request(app.getHttpServer()).get('/closed').set('Authorization', 'Bearer good').expect(200);
    expect(res.body.role).toBeNull();
  });

  describe('role enforcement', () => {
    it('lets stock managers change stock', async () => {
      getUser.mockResolvedValue(userWithRole('pharmacist'));
      await request(app.getHttpServer()).post('/stock').set('Authorization', 'Bearer t').expect(201);
    });

    it('forbids staff from changing stock', async () => {
      getUser.mockResolvedValue(userWithRole('staff'));
      await request(app.getHttpServer()).post('/stock').set('Authorization', 'Bearer t').expect(403);
    });

    it('forbids a signed-in user with no role from protected actions', async () => {
      getUser.mockResolvedValue(userWithRole());
      const res = await request(app.getHttpServer()).post('/stock').set('Authorization', 'Bearer t').expect(403);
      expect(res.body.message).toMatch(/no role assigned/);
    });

    it('limits admin-only routes to administrators', async () => {
      getUser.mockResolvedValue(userWithRole('pharmacist'));
      await request(app.getHttpServer()).post('/admin-only').set('Authorization', 'Bearer t').expect(403);
      getUser.mockResolvedValue(userWithRole('admin'));
      await request(app.getHttpServer()).post('/admin-only').set('Authorization', 'Bearer t').expect(201);
    });

    it('checks authentication before roles', async () => {
      await request(app.getHttpServer()).post('/stock').expect(401);
    });
  });
});
