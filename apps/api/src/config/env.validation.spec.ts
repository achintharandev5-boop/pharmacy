import { validateEnv } from './env.validation';

describe('validateEnv', () => {
  const valid = { SUPABASE_URL: 'https://example.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'k'.repeat(40) };

  it('accepts a complete configuration and applies defaults', () => {
    expect(validateEnv(valid)).toEqual({
      SUPABASE_URL: valid.SUPABASE_URL,
      SUPABASE_SERVICE_ROLE_KEY: valid.SUPABASE_SERVICE_ROLE_KEY,
      PORT: 3001,
      FRONTEND_URL: 'http://localhost:3000',
      PHARMACY_TIMEZONE: 'Asia/Colombo',
    });
  });

  it('refuses to start without database credentials', () => {
    expect(() => validateEnv({})).toThrow(/SUPABASE_URL is required[\s\S]*SUPABASE_SERVICE_ROLE_KEY is required/);
  });

  it('refuses the old placeholder key', () => {
    expect(() => validateEnv({ ...valid, SUPABASE_SERVICE_ROLE_KEY: 'dummy_key' })).toThrow(/SUPABASE_SERVICE_ROLE_KEY/);
  });

  it('rejects an invalid URL, port and time zone', () => {
    expect(() => validateEnv({ ...valid, SUPABASE_URL: 'not a url' })).toThrow(/not a valid URL/);
    expect(() => validateEnv({ ...valid, PORT: '70000' })).toThrow(/PORT/);
    expect(() => validateEnv({ ...valid, PHARMACY_TIMEZONE: 'Mars/Base' })).toThrow(/PHARMACY_TIMEZONE/);
  });

  it('never includes secret values in the error', () => {
    try {
      validateEnv({ SUPABASE_URL: 'bad', SUPABASE_SERVICE_ROLE_KEY: 'dummy_key' });
    } catch (e) {
      expect(String(e)).not.toContain('dummy_key');
    }
  });
});
