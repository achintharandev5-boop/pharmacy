// Assigns an application role to an existing Supabase Auth user.
//
// The role is stored in app_metadata, which only the service-role key can write; users
// cannot change it themselves. The API reads it on every request (see src/auth/roles.ts).
//
// Usage (from apps/api):
//   node --env-file=.env scripts/set-user-role.js <email> <admin|pharmacist|staff>
//
// Required environment: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
const { createClient } = require('@supabase/supabase-js');

const ROLES = ['admin', 'pharmacist', 'staff'];
const [email, role] = process.argv.slice(2);

if (!email || !ROLES.includes(role)) {
  console.error(`Usage: node --env-file=.env scripts/set-user-role.js <email> <${ROLES.join('|')}>`);
  process.exit(1);
}
for (const name of ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY']) {
  if (!process.env[name]) {
    console.error(`Missing required environment variable: ${name}`);
    process.exit(1);
  }
}

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
  realtime: { transport: require('ws') },
});

async function main() {
  // listUsers is paginated; search every page for the address.
  let user = null;
  for (let page = 1; !user; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw new Error(`Could not list users: ${error.message}`);
    user = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase()) ?? null;
    if (data.users.length < 200) break;
  }
  if (!user) throw new Error(`No user with email ${email}`);

  const { error } = await supabase.auth.admin.updateUserById(user.id, {
    app_metadata: { ...user.app_metadata, role },
  });
  if (error) throw new Error(`Could not update role: ${error.message}`);
  console.log(`Role for ${email} set to ${role}. The user must sign in again for the change to apply in the web app.`);
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
