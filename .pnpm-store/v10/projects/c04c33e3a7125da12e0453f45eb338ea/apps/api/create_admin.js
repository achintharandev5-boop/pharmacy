// One-off script to create an admin user in Supabase Auth.
// Credentials are read from the environment; nothing is hardcoded.
//
// Usage (from apps/api):
//   ADMIN_EMAIL=... ADMIN_PASSWORD=... node --env-file=.env create_admin.js
//
// Required: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ADMIN_EMAIL, ADMIN_PASSWORD
const { createClient } = require('@supabase/supabase-js');

const required = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'ADMIN_EMAIL', 'ADMIN_PASSWORD'];
const missing = required.filter((name) => !process.env[name]);
if (missing.length > 0) {
  console.error(`Missing required environment variables: ${missing.join(', ')}`);
  process.exit(1);
}

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    realtime: { transport: require('ws') }
  }
);

async function createAdmin() {
  const { data, error } = await supabase.auth.admin.createUser({
    email: process.env.ADMIN_EMAIL,
    password: process.env.ADMIN_PASSWORD,
    email_confirm: true
  });
  if (error) {
    console.error('Failed to create admin user:', error.message);
    process.exit(1);
  }
  console.log('Admin user created:', data.user.email);
}

createAdmin();
