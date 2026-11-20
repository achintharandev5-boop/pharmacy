/**
 * TEST ONLY. Boots the real NestJS application against a throwaway local PostgreSQL
 * database built from every migration in supabase/migrations.
 *
 * Requires DB_TEST_URL pointing at a local, disposable PostgreSQL server with a superuser,
 * for example postgres://postgres@localhost:54330/postgres. Each test file creates and drops
 * its own database. Supabase Auth cannot run locally, so `auth` is a small stand-in that
 * maps the test tokens below to users and roles, the same way Supabase Auth returns
 * app_metadata.role. No SMS gateway, Supabase project or real credential is contacted.
 */
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { Client, Pool } from 'pg';
import { PgSupabase, assertLocal } from './pg-supabase';

export const USERS = {
  reasonsAdminA: {
    id: '0a000000-0000-4000-8000-000000000011',
    email: 'reasons-admin-a@test.invalid',
    role: 'admin',
    pharmacyId: 'f2100000-0000-4000-8000-000000000001',
  },
  reasonsAdminB: {
    id: '0a000000-0000-4000-8000-000000000012',
    email: 'reasons-admin-b@test.invalid',
    role: 'admin',
    pharmacyId: 'f2100000-0000-4000-8000-000000000002',
  },
  reasonsPharmacistA: {
    id: '0a000000-0000-4000-8000-000000000013',
    email: 'reasons-pharmacist-a@test.invalid',
    role: 'pharmacist',
    pharmacyId: 'f2100000-0000-4000-8000-000000000001',
  },
  reasonsInvalid: {
    id: '0a000000-0000-4000-8000-000000000014',
    email: 'reasons-invalid@test.invalid',
    role: 'admin',
    pharmacyId: 'invalid-assignment',
  },
  admin: {
    id: '0a000000-0000-4000-8000-000000000001',
    email: 'admin@test.invalid',
    role: 'admin',
  },
  pharmacist: {
    id: '0a000000-0000-4000-8000-000000000002',
    email: 'pharmacist@test.invalid',
    role: 'pharmacist',
  },
  staff: {
    id: '0a000000-0000-4000-8000-000000000003',
    email: 'staff@test.invalid',
    role: 'staff',
  },
  norole: {
    id: '0a000000-0000-4000-8000-000000000004',
    email: 'norole@test.invalid',
    role: undefined,
  },
} as const;
export type TestUser = keyof typeof USERS;

/** Test-only bearer tokens. */
export const TOKEN: Record<TestUser, string> = {
  reasonsAdminA: 'test-reasons-admin-a',
  reasonsAdminB: 'test-reasons-admin-b',
  reasonsPharmacistA: 'test-reasons-pharmacist-a',
  reasonsInvalid: 'test-reasons-invalid',
  admin: 'test-token-admin',
  pharmacist: 'test-token-pharmacist',
  staff: 'test-token-staff',
  norole: 'test-token-norole',
};
/** Test-only password for the sign-in stand-in. */
export const TEST_PASSWORD = 'local-test-password';

const MIGRATIONS = join(__dirname, '..', '..', 'supabase', 'migrations');

const SUPABASE_STUB = `
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN CREATE ROLE anon NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN CREATE ROLE service_role NOLOGIN BYPASSRLS; END IF;
END $$;
CREATE SCHEMA auth;
CREATE TABLE auth.users (id UUID PRIMARY KEY, email TEXT);
CREATE FUNCTION auth.uid() RETURNS UUID LANGUAGE sql STABLE AS $f$ SELECT nullif(current_setting('request.jwt.claim.sub', TRUE), '')::uuid $f$;
GRANT USAGE ON SCHEMA auth TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION auth.uid() TO anon, authenticated, service_role;
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon, authenticated, service_role;
`;

function authStandIn() {
  const byToken = new Map(
    Object.entries(TOKEN).map(([name, token]) => [
      token,
      USERS[name as TestUser],
    ]),
  );
  const user = (u: (typeof USERS)[TestUser]) => ({
    id: u.id,
    email: u.email,
    app_metadata: {
      ...(u.role ? { role: u.role } : {}),
      ...('pharmacyId' in u ? { pharmacy_id: u.pharmacyId } : {}),
    },
  });
  return {
    getUser: (token: string) => {
      const u = byToken.get(token);
      return Promise.resolve(
        u
          ? { data: { user: user(u) }, error: null }
          : {
              data: { user: null },
              error: { status: 401, message: 'invalid JWT' },
            },
      );
    },
    signInWithPassword: ({
      email,
      password,
    }: {
      email: string;
      password: string;
    }) => {
      const entry = Object.entries(USERS).find(([, u]) => u.email === email);
      if (!entry || password !== TEST_PASSWORD)
        return Promise.resolve({
          data: { session: null },
          error: { status: 400, message: 'Invalid login credentials' },
        });
      return Promise.resolve({
        data: {
          session: {
            access_token: TOKEN[entry[0] as TestUser],
            token_type: 'bearer',
            expires_in: 3600,
            expires_at: 0,
          },
        },
        error: null,
      });
    },
  };
}

export interface Harness {
  app: INestApplication;
  db: Pool;
  close: () => Promise<void>;
}

/**
 * Creates database `dbName`, applies every migration, inserts the test users, and starts the
 * application with PRESCRIPTION_WRITE_MODE as given.
 */
export async function startHarness(
  dbName: string,
  writeMode: 'legacy' | 'transactional' = 'legacy',
): Promise<Harness> {
  const runId = process.env.DB_TEST_RUN_ID;
  if (runId) {
    if (!/^[a-z0-9_]{1,20}$/.test(runId))
      throw new Error('Invalid DB_TEST_RUN_ID');
    dbName += '_' + runId;
  }
  if (!/^[a-z][a-z0-9_]{0,62}$/.test(dbName))
    throw new Error('Invalid test database name');
  const adminUrl = process.env.DB_TEST_URL;
  if (!adminUrl)
    throw new Error(
      'DB_TEST_URL is not set. These tests need a local, disposable PostgreSQL server.',
    );
  assertLocal(adminUrl);

  const admin = new Client({ connectionString: adminUrl });
  await admin.connect();
  // Fresh-only mode for approved local verification: fail rather than deleting an existing DB.
  if (process.env.DB_TEST_FRESH_ONLY !== 'true')
    await admin.query(`DROP DATABASE IF EXISTS ${dbName} WITH (FORCE)`);
  await admin.query(`CREATE DATABASE ${dbName}`);
  await admin.end();

  const url = new URL(adminUrl);
  url.pathname = `/${dbName}`;
  const db = new Pool({ connectionString: url.toString(), max: 8 });
  try {
    await db.query(SUPABASE_STUB);
    for (const file of readdirSync(MIGRATIONS)
      .filter((f) => f.endsWith('.sql'))
      .sort()) {
      await db.query(readFileSync(join(MIGRATIONS, file), 'utf8'));
    }
    for (const u of Object.values(USERS))
      await db.query('INSERT INTO auth.users (id, email) VALUES ($1, $2)', [
        u.id,
        u.email,
      ]);

    // Env is validated when AppModule is first imported, so set it before requiring the module.
    process.env.SUPABASE_URL = 'http://localhost.invalid';
    process.env.SUPABASE_SERVICE_ROLE_KEY =
      'local-test-key-not-a-real-credential';
    process.env.PRESCRIPTION_WRITE_MODE = writeMode;
    process.env.PHARMACY_TIMEZONE = 'Asia/Colombo';
    const { AppModule } =
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      require('../../src/app.module') as typeof import('../../src/app.module');
    const { SupabaseService } =
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      require('../../src/supabase/supabase.service') as typeof import('../../src/supabase/supabase.service');

    const pg = new PgSupabase(db);
    const auth = authStandIn();
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(SupabaseService)
      .useValue({
        getClient: () => pg.client(auth),
        createSessionClient: () => ({ auth }),
      })
      .compile();

    const app = moduleRef.createNestApplication({ logger: false });
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    await app.init();

    return {
      app,
      db,
      close: async () => {
        await app.close();
        await db.end();
      },
    };
  } catch (error) {
    await db.end();
    throw error;
  }
}
