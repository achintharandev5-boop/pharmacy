// Imported before AppModule, whose ConfigModule validates during module evaluation.
// Tests never inherit a developer's database credentials or staging gateway policy.
process.env.NODE_ENV = 'test';
process.env.SUPABASE_URL = 'https://synthetic.example.invalid';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'synthetic-service-fixture';
for (const name of [
  'DEPLOYMENT_PROFILE',
  'STAGING_GATEWAY_TOKEN',
  'STAGING_DATA_POLICY',
  'STAGING_SUPABASE_URL',
  'PILOT_SUPABASE_URL',
  'PILOT_PHARMACY_ID',
])
  delete process.env[name];
