import { apiBaseUrl } from './apiConfiguration';

/** Build fails closed if a staging deploy loses its safety marker or gateway. */
export function validateStagingConfiguration(env: NodeJS.ProcessEnv = process.env) {
  const server = env.DEPLOYMENT_PROFILE;
  const browser = env.NEXT_PUBLIC_DEPLOYMENT_PROFILE;
  if (!server && !browser) return;
  if (server !== 'synthetic-staging' || browser !== server ||
      env.STAGING_DATA_POLICY !== 'synthetic-only' || env.SMS_ENABLED !== 'false' ||
      env.NEXT_PUBLIC_UI_TEST_MODE === 'true' ||
      !/^[a-f0-9]{64}$/.test(env.STAGING_GATEWAY_TOKEN || '')) {
    throw new Error('Invalid synthetic staging configuration; check profile, policy, SMS, UI mode and gateway variable names.');
  }
  if (env.SUPABASE_SERVICE_ROLE_KEY ||
      Object.keys(env).some((name) => /^NEXT_PUBLIC_.*(?:SECRET|SERVICE_ROLE|PASSWORD|GATEWAY_TOKEN)/.test(name))) {
    throw new Error('Privileged credentials must not be configured in the frontend environment.');
  }
  if (env.FRONTEND_ONLY_MODE !== 'true') apiBaseUrl({ ...env, NODE_ENV: 'production' });
}
