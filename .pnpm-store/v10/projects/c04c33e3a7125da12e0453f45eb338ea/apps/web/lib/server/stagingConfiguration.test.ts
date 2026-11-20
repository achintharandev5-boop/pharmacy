import { describe, expect, it } from 'vitest';
import { validateStagingConfiguration } from './stagingConfiguration';
import { stagingGatewayHeaders } from './stagingGateway';

const env: NodeJS.ProcessEnv = { NODE_ENV: 'test', DEPLOYMENT_PROFILE: 'synthetic-staging', NEXT_PUBLIC_DEPLOYMENT_PROFILE: 'synthetic-staging',
  STAGING_DATA_POLICY: 'synthetic-only', STAGING_GATEWAY_TOKEN: 'a'.repeat(64), SMS_ENABLED: 'false',
  API_URL: 'https://api.example.invalid', PILOT_API_URL: 'https://api.example.invalid' };
describe('staging configuration and server-only gateway headers', () => {
  it('accepts matched configuration and forwards the machine credential separately from user authentication', () => {
    expect(() => validateStagingConfiguration(env)).not.toThrow();
    expect(stagingGatewayHeaders(env)).toEqual({ 'X-Staging-Gateway-Token': env.STAGING_GATEWAY_TOKEN });
    expect(stagingGatewayHeaders({ NODE_ENV: 'test' })).toEqual({});
  });
  it.each([
    { NEXT_PUBLIC_DEPLOYMENT_PROFILE: '' }, { DEPLOYMENT_PROFILE: '' },
    { SMS_ENABLED: 'true' }, { STAGING_DATA_POLICY: 'live' }, { NEXT_PUBLIC_UI_TEST_MODE: 'true' },
    { STAGING_GATEWAY_TOKEN: '' }, { API_URL: 'http://localhost:3001' },
    { SUPABASE_SERVICE_ROLE_KEY: 'synthetic-forbidden-value' },
    { NEXT_PUBLIC_STAGING_GATEWAY_TOKEN: 'synthetic-forbidden-value' },
  ])('fails closed on %j', (override) => {
    expect(() => validateStagingConfiguration({ ...env, ...override })).toThrow();
  });
  it('never forwards an absent or invalid gateway token', () => {
    expect(() => stagingGatewayHeaders({ ...env, STAGING_GATEWAY_TOKEN: '' })).toThrow();
  });
});
