import { validateEnv } from './env.validation';

describe('validateEnv', () => {
  const valid = {
    SUPABASE_URL: 'https://example.supabase.co',
    SUPABASE_SERVICE_ROLE_KEY: 'k'.repeat(40),
  };

  it('accepts a complete configuration and applies defaults', () => {
    expect(validateEnv(valid)).toEqual({
      SUPABASE_URL: valid.SUPABASE_URL,
      SUPABASE_SERVICE_ROLE_KEY: valid.SUPABASE_SERVICE_ROLE_KEY,
      PORT: 3001,
      FRONTEND_URL: 'http://localhost:3000',
      PHARMACY_TIMEZONE: 'Asia/Colombo',
      PRESCRIPTION_WRITE_MODE: 'legacy',
    });
  });

  it('keeps prescriptions on the legacy write path unless transactional is chosen explicitly', () => {
    expect(
      validateEnv({ ...valid, PRESCRIPTION_WRITE_MODE: 'transactional' })
        .PRESCRIPTION_WRITE_MODE,
    ).toBe('transactional');
    expect(() =>
      validateEnv({ ...valid, PRESCRIPTION_WRITE_MODE: 'fefo' }),
    ).toThrow(/PRESCRIPTION_WRITE_MODE/);
  });

  it('refuses to start without database credentials', () => {
    expect(() => validateEnv({})).toThrow(
      /SUPABASE_URL is required[\s\S]*SUPABASE_SERVICE_ROLE_KEY is required/,
    );
  });

  it('refuses the old placeholder key', () => {
    expect(() =>
      validateEnv({ ...valid, SUPABASE_SERVICE_ROLE_KEY: 'dummy_key' }),
    ).toThrow(/SUPABASE_SERVICE_ROLE_KEY/);
  });

  it('rejects an invalid URL, port and time zone', () => {
    expect(() => validateEnv({ ...valid, SUPABASE_URL: 'not a url' })).toThrow(
      /not a valid URL/,
    );
    expect(() => validateEnv({ ...valid, PORT: '70000' })).toThrow(/PORT/);
    expect(() =>
      validateEnv({ ...valid, PHARMACY_TIMEZONE: 'Mars/Base' }),
    ).toThrow(/PHARMACY_TIMEZONE/);
  });

  it('never includes secret values in the error', () => {
    try {
      validateEnv({
        SUPABASE_URL: 'bad',
        SUPABASE_SERVICE_ROLE_KEY: 'dummy_key',
      });
    } catch (e) {
      expect(String(e)).not.toContain('dummy_key');
    }
  });

  const pilot = {
    ...valid,
    NODE_ENV: 'production',
    PILOT_PHARMACY_ID: '10000000-0000-4000-8000-000000000001',
    PILOT_SUPABASE_URL: valid.SUPABASE_URL,
    FRONTEND_URL: 'https://pilot.example.invalid',
  };

  it('requires an explicit deployment identity in production', () => {
    expect(() => validateEnv({ ...valid, NODE_ENV: 'production' })).toThrow(
      /PILOT_PHARMACY_ID/,
    );
    expect(validateEnv(pilot).PILOT_PHARMACY_ID).toBe(pilot.PILOT_PHARMACY_ID);
    expect(validateEnv(pilot).PRESCRIPTION_WRITE_MODE).toBe('legacy');
  });

  it.each([
    { PILOT_PHARMACY_ID: 'not-a-uuid' },
    { SUPABASE_URL: 'https://other.supabase.co' },
    { PILOT_SUPABASE_URL: 'http://example.supabase.co' },
    { PILOT_SUPABASE_URL: 'https://example.supabase.co/wrong' },
    { FRONTEND_URL: '' },
    { FRONTEND_URL: '*' },
    { FRONTEND_URL: 'http://pilot.example.invalid' },
  ])('refuses a misconfigured pilot binding: %j', (override) => {
    expect(() => validateEnv({ ...pilot, ...override })).toThrow(
      /Invalid API configuration/,
    );
  });

  const staging = {
    ...pilot,
    DEPLOYMENT_PROFILE: 'synthetic-staging',
    STAGING_DATA_POLICY: 'synthetic-only',
    STAGING_GATEWAY_TOKEN: 'a'.repeat(64),
    STAGING_SUPABASE_URL: pilot.SUPABASE_URL,
    SMS_ENABLED: 'false',
  };
  it('accepts explicit synthetic staging while preserving the stock mode', () => {
    expect(validateEnv(staging).DEPLOYMENT_PROFILE).toBe('synthetic-staging');
    expect(validateEnv(staging).PRESCRIPTION_WRITE_MODE).toBe('legacy');
  });
  it.each([
    { STAGING_GATEWAY_TOKEN: '' },
    { STAGING_GATEWAY_TOKEN: 'placeholder' },
    { STAGING_DATA_POLICY: 'live' },
    { STAGING_SUPABASE_URL: 'https://other.example.invalid' },
    { PILOT_PHARMACY_ID: '' },
    { SMS_ENABLED: 'true' },
    { DEPLOYMENT_PROFILE: 'staging-typo' },
  ])(
    'rejects unsafe staging configuration without printing values: %j',
    (override) => {
      expect(() => validateEnv({ ...staging, ...override })).toThrow(
        'Invalid API configuration',
      );
    },
  );
});
