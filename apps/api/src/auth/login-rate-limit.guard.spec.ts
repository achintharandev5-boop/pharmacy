import { Controller, INestApplication, Post, UseGuards } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { Server } from 'http';
import request from 'supertest';
import { LoginRateLimitGuard } from './login-rate-limit.guard';

@Controller()
class LoginProbe {
  @Post('login')
  @UseGuards(LoginRateLimitGuard)
  login() {
    return { ok: true };
  }
}

describe('login throttling over HTTP', () => {
  let app: INestApplication;
  afterEach(async () => {
    jest.restoreAllMocks();
    await app.close();
  });
  beforeEach(async () => {
    const module = await Test.createTestingModule({
      controllers: [LoginProbe],
      providers: [LoginRateLimitGuard],
    }).compile();
    app = module.createNestApplication();
    await app.init();
  });

  it('rejects the eleventh attempt, ignores spoofed forwarding headers, and recovers after the window', async () => {
    const clock = jest.spyOn(Date, 'now').mockReturnValue(100_000);
    const server = app.getHttpServer() as Server;
    for (let i = 0; i < 10; i++) {
      await request(server)
        .post('/login')
        .set('X-Forwarded-For', `192.0.2.${i}`)
        .expect(201);
    }
    const denied = await request(server).post('/login').expect(429);
    expect(denied.headers['retry-after']).toBe('60');
    clock.mockReturnValue(160_000);
    await request(server).post('/login').expect(201);
  });
});
