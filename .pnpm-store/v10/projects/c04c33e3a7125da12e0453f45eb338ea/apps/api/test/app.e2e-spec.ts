import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { SupabaseService } from './../src/supabase/supabase.service';

describe('AppController (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    // The module validates its environment at startup; no real database is contacted here.
    process.env.SUPABASE_URL ??= 'https://example.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY ??= 'e2e-placeholder-not-a-real-key';

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(SupabaseService)
      .useValue({ getClient: jest.fn(), createSessionClient: jest.fn() })
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  it('/health (GET) is public', () => {
    return request(app.getHttpServer()).get('/health').expect(200).expect({ status: 'ok' });
  });

  it('/customers (GET) requires authentication', () => {
    return request(app.getHttpServer()).get('/customers').expect(401);
  });

  afterEach(async () => {
    await app.close();
  });
});
