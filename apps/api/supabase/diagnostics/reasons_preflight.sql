-- READ ONLY. Connect only after independent project identity verification.
-- This query cannot prove that a project is non-production.
\set ON_ERROR_STOP on
BEGIN READ ONLY;
SELECT current_database() AS database_name, current_user AS database_role,
       inet_server_addr() AS server_address, version() AS server_version;
SELECT to_regclass('public.reasons') AS existing_reasons,
       to_regclass('public.audit_log') AS required_audit_log,
       to_regclass('auth.users') AS required_auth_users,
       to_regclass('supabase_migrations.schema_migrations') AS migration_history;
SELECT rolname, rolbypassrls FROM pg_roles
 WHERE rolname IN ('anon', 'authenticated', 'service_role');
DO $$
BEGIN
  IF to_regclass('public.reasons') IS NOT NULL THEN
    RAISE EXCEPTION 'Reasons already exists. Inspect history and schema; do not overwrite it.';
  END IF;
  IF to_regclass('public.audit_log') IS NULL OR to_regclass('auth.users') IS NULL THEN
    RAISE EXCEPTION 'Required baseline tables are absent. Stop and review earlier migrations.';
  END IF;
  IF to_regprocedure('public.audit_reason_catalogue_change()') IS NOT NULL THEN
    RAISE EXCEPTION 'Audit function name already exists. Inspect before applying.';
  END IF;
END $$;
COMMIT;

