-- Migration: Row Level Security (Phase 3)
--
-- Architecture: browsers never query the database. All reads and writes go through the
-- NestJS API, which uses the service-role key (that role bypasses RLS) and enforces
-- authentication and roles itself.
--
-- Without RLS, every table in the `public` schema is readable and writable through the
-- Supabase REST API by anyone holding the project's publishable/anon key, which is public by
-- design. Enabling RLS with no policies denies the `anon` and `authenticated` roles all
-- access, closing that path. The API is unaffected.
--
-- If a future feature needs direct browser access, add narrowly scoped policies for that
-- table; do not disable RLS.

BEGIN;

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'customers', 'products', 'labels', 'label_sessions',
    'prescriptions', 'prescription_items', 'prescription_events', 'inventory_movements', 'idempotency_keys',
    'suppliers', 'product_batches', 'stock_receipts', 'stock_receipt_items',
    'user_profiles', 'pharmacy_settings', 'sms_messages', 'audit_log'
  ]
  LOOP
    -- ENABLE, not FORCE: FORCE would also restrict the table owner used for migrations and
    -- maintenance. anon/authenticated are not owners and are denied; service_role bypasses.
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
  END LOOP;
END $$;

-- Sequences and helper functions are likewise not for direct client use.
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON SEQUENCE grn_number_seq, prescription_number_seq FROM anon, authenticated;
    REVOKE ALL ON FUNCTION pharmacy_today() FROM anon, authenticated;
  END IF;
END $$;

-- A staff member may read their own profile (for a future "my account" screen). Nothing else.
DROP POLICY IF EXISTS user_profiles_self_read ON user_profiles;
CREATE POLICY user_profiles_self_read ON user_profiles
  FOR SELECT TO authenticated
  USING (id = auth.uid());

COMMIT;
