-- LOCAL DISPOSABLE DATABASE ONLY, after the reviewed migration is applied.
\set ON_ERROR_STOP on
BEGIN;
DO $$
DECLARE p uuid := 'f2100000-0000-4000-8000-000000000061';
        actor uuid := 'f2100000-0000-4000-8000-000000000099';
BEGIN
  INSERT INTO auth.users(id, email) VALUES (actor, 'reasons-sql-test@example.invalid');
  IF has_table_privilege('anon', 'public.reasons', 'SELECT')
     OR has_table_privilege('authenticated', 'public.reasons', 'INSERT')
     OR has_table_privilege('authenticated', 'public.reasons', 'UPDATE') THEN
    RAISE EXCEPTION 'Reasons must only be accessible through the guarded API';
  END IF;
  IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.reasons'::regclass) THEN
    RAISE EXCEPTION 'Reasons RLS is required';
  END IF;
  INSERT INTO public.reasons(pharmacy_id, text, updated_by) VALUES (p, 'Synthetic test wording', actor);
  BEGIN
    INSERT INTO public.reasons(pharmacy_id, text, updated_by) VALUES (p, 'Synthetic test wording', actor);
    RAISE EXCEPTION 'Duplicate reason was accepted';
  EXCEPTION WHEN unique_violation THEN NULL;
  END;
  INSERT INTO public.reasons(pharmacy_id, text, updated_by)
    VALUES ('f2100000-0000-4000-8000-000000000062', 'Synthetic test wording', actor);
  BEGIN
    INSERT INTO public.reasons(pharmacy_id, text, updated_by) VALUES (p, '   ', actor);
    RAISE EXCEPTION 'Blank reason was accepted';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  BEGIN
    INSERT INTO public.reasons(pharmacy_id, text, updated_by) VALUES (p, E'line\nbreak', actor);
    RAISE EXCEPTION 'Multiline reason was accepted';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  BEGIN
    INSERT INTO public.reasons(pharmacy_id, text, updated_by) VALUES (p, repeat('x', 201), actor);
    RAISE EXCEPTION 'Overlong reason was accepted';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  UPDATE public.reasons SET text = 'Renamed', is_active = false WHERE pharmacy_id = p;
  IF EXISTS (SELECT 1 FROM public.reasons WHERE pharmacy_id = p AND is_active) THEN
    RAISE EXCEPTION 'Deactivation failed';
  END IF;
END $$;
ROLLBACK;
