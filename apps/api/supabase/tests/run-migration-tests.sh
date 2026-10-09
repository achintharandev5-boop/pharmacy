#!/usr/bin/env bash
# Applies every migration to a THROWAWAY local PostgreSQL database and runs the SQL tests.
# It never connects to Supabase.
#
# Usage: PGPORT=54329 PGHOST=localhost PGUSER=postgres apps/api/supabase/tests/run-migration-tests.sh
# Requires psql on PATH (or PSQL=/path/to/psql) and a superuser on a disposable server.
set -euo pipefail

PSQL="${PSQL:-psql}"
DB="${TEST_DB:-pharmacy_migration_test}"
HERE="$(cd "$(dirname "$0")" && pwd)"
MIGRATIONS="$HERE/../migrations"

case "${PGHOST:-localhost}" in
  localhost|127.0.0.1|::1) ;;
  *) echo "Refusing to run against non-local host '${PGHOST}'." >&2; exit 1 ;;
esac

run() { "$PSQL" -X -q -v ON_ERROR_STOP=1 "$@"; }

run -d postgres -c "DROP DATABASE IF EXISTS $DB" -c "CREATE DATABASE $DB"
# Roles are cluster-wide; ignore "already exists" on reruns.
run -d "$DB" -f "$HERE/00_supabase_stub.sql" 2>/dev/null || run -d "$DB" -c "CREATE SCHEMA IF NOT EXISTS auth" \
  -c "CREATE TABLE IF NOT EXISTS auth.users (id UUID PRIMARY KEY, email TEXT)" \
  -c "CREATE OR REPLACE FUNCTION auth.uid() RETURNS UUID LANGUAGE sql STABLE AS \$\$ SELECT nullif(current_setting('request.jwt.claim.sub', TRUE), '')::uuid \$\$" \
  -c "GRANT USAGE ON SCHEMA public, auth TO anon, authenticated, service_role" \
  -c "ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role" \
  -c "ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated, service_role" \
  -c "ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon, authenticated, service_role"

for f in "$MIGRATIONS"/*.sql; do
  echo "apply  $(basename "$f")"
  run -d "$DB" -f "$f"
done

# Migrations must be safe to re-run.
for f in "$MIGRATIONS"/20261010*.sql; do
  echo "re-run $(basename "$f")"
  run -d "$DB" -f "$f"
done

run -d "$DB" -f "$HERE/10_migration_tests.sql"
bash "$HERE/20_concurrency_test.sh"
