-- READ ONLY. No catalogue text, user identities, or patient data are returned.
\set ON_ERROR_STOP on
BEGIN READ ONLY;
SELECT column_name, data_type, is_nullable, column_default
 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'reasons'
 ORDER BY ordinal_position;
SELECT conname, pg_get_constraintdef(oid) AS definition FROM pg_constraint
 WHERE conrelid = 'public.reasons'::regclass ORDER BY conname;
SELECT indexname, indexdef FROM pg_indexes WHERE schemaname = 'public' AND tablename = 'reasons';
SELECT tgname FROM pg_trigger WHERE tgrelid = 'public.reasons'::regclass AND NOT tgisinternal;
SELECT role, has_table_privilege(role, 'public.reasons', 'SELECT') AS can_select,
 has_table_privilege(role, 'public.reasons', 'INSERT') AS can_insert,
 has_table_privilege(role, 'public.reasons', 'UPDATE') AS can_update,
 has_table_privilege(role, 'public.reasons', 'DELETE') AS can_delete
 FROM (VALUES ('anon'), ('authenticated'), ('service_role')) roles(role);
DO $$
BEGIN
  IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.reasons'::regclass) THEN
    RAISE EXCEPTION 'Reasons RLS must be enabled';
  END IF;
  IF EXISTS (
    SELECT 1 FROM (VALUES ('anon'), ('authenticated')) roles(role)
    WHERE has_table_privilege(role, 'public.reasons', 'SELECT')
       OR has_table_privilege(role, 'public.reasons', 'INSERT')
       OR has_table_privilege(role, 'public.reasons', 'UPDATE')
       OR has_table_privilege(role, 'public.reasons', 'DELETE')
  ) OR has_table_privilege('service_role', 'public.reasons', 'DELETE') THEN
    RAISE EXCEPTION 'Unexpected Reasons privileges';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid = 'public.reasons'::regclass
      AND tgname = 'trg_reasons_audit' AND tgenabled = 'O') THEN
    RAISE EXCEPTION 'Reasons audit trigger missing or disabled';
  END IF;
END $$;
COMMIT;

