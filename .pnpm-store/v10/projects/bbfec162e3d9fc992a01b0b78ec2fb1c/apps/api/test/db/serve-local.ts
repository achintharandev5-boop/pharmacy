// Local-only (run from apps/api: DB_TEST_URL=postgres://postgres@localhost:54331/postgres npx ts-node --transpile-only -P tsconfig.json test/db/serve-local.ts): runs the real API (test harness: throwaway local Postgres, auth stand-in) on :3001
// (LOCAL_API_PORT to change it) so a scratch copy of the web app can save prescriptions end to end. Never touches Supabase.
import { startHarness } from './harness';

async function main() {
  const h = await startHarness('label_print_e2e', 'legacy');
  const port = Number(process.env.LOCAL_API_PORT || 3001);
  await h.app.listen(port);
  console.log(`API (local harness) listening on ${port}`);
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
