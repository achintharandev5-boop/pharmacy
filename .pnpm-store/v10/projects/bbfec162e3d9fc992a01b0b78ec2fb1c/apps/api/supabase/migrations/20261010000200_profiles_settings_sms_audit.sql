-- Migration: user profiles, pharmacy settings, SMS log and audit log (Phase 3)
--
-- New tables only; nothing existing is changed.
-- Roles are NOT stored here: the source of truth is Supabase Auth app_metadata.role,
-- which only the service-role key can write (see apps/api/src/auth/roles.ts).

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Staff profiles (one per Supabase Auth user)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  full_name TEXT CHECK (full_name IS NULL OR btrim(full_name) <> ''),
  registration_number TEXT,          -- e.g. pharmacist council registration, if applicable
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS trg_user_profiles_updated_at ON user_profiles;
CREATE TRIGGER trg_user_profiles_updated_at BEFORE UPDATE ON user_profiles
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------------
-- 2. Pharmacy settings (exactly one row)
-- ---------------------------------------------------------------------------
-- No business values are seeded: name, address and phone stay NULL until an administrator
-- enters them. Only neutral technical defaults are set.
CREATE TABLE IF NOT EXISTS pharmacy_settings (
  id BOOLEAN PRIMARY KEY DEFAULT TRUE CHECK (id),
  pharmacy_name TEXT,
  address TEXT,
  phone TEXT,
  timezone TEXT NOT NULL DEFAULT 'Asia/Colombo',
  label_width_mm NUMERIC CHECK (label_width_mm IS NULL OR label_width_mm > 0),
  label_height_mm NUMERIC CHECK (label_height_mm IS NULL OR label_height_mm > 0),
  printer_name TEXT,
  sms_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  sms_sender_id TEXT,
  low_stock_alerts_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  expiry_alert_days INTEGER NOT NULL DEFAULT 30 CHECK (expiry_alert_days BETWEEN 1 AND 365),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES auth.users (id) ON DELETE SET NULL
);

INSERT INTO pharmacy_settings (id) VALUES (TRUE) ON CONFLICT (id) DO NOTHING;

DROP TRIGGER IF EXISTS trg_pharmacy_settings_updated_at ON pharmacy_settings;
CREATE TRIGGER trg_pharmacy_settings_updated_at BEFORE UPDATE ON pharmacy_settings
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- The pharmacy's calendar date, used for expiry checks in the database functions.
CREATE OR REPLACE FUNCTION pharmacy_today() RETURNS DATE
LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT (now() AT TIME ZONE coalesce((SELECT timezone FROM pharmacy_settings WHERE id), 'Asia/Colombo'))::date
$$;

-- ---------------------------------------------------------------------------
-- 3. SMS messages
-- ---------------------------------------------------------------------------
-- "SENT" means the gateway accepted the message; only a delivery report sets DELIVERED.
CREATE TABLE IF NOT EXISTS sms_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prescription_id UUID REFERENCES prescriptions (id) ON DELETE SET NULL,
  customer_id UUID REFERENCES customers (id) ON DELETE SET NULL,
  recipient TEXT NOT NULL CHECK (recipient ~ '^[0-9]{9,15}$'),
  message_length INTEGER NOT NULL CHECK (message_length >= 0),
  status TEXT NOT NULL DEFAULT 'QUEUED' CHECK (status IN ('QUEUED', 'SENT', 'DELIVERED', 'FAILED')),
  provider TEXT NOT NULL DEFAULT 'text.lk',
  provider_reference TEXT,
  failure_reason TEXT,
  attempt_count INTEGER NOT NULL DEFAULT 1 CHECK (attempt_count >= 1),
  idempotency_key TEXT UNIQUE,
  sent_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (status <> 'FAILED' OR failure_reason IS NOT NULL),
  CHECK (status NOT IN ('SENT', 'DELIVERED') OR sent_at IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_sms_messages_prescription ON sms_messages (prescription_id);
CREATE INDEX IF NOT EXISTS idx_sms_messages_created_at ON sms_messages (created_at DESC);

-- ---------------------------------------------------------------------------
-- 4. Audit log
-- ---------------------------------------------------------------------------
-- Records who changed which record and which fields. Values are deliberately not copied:
-- patient details stay in the patient table only.
CREATE TABLE IF NOT EXISTS audit_log (
  id BIGSERIAL PRIMARY KEY,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  actor_id UUID,
  action TEXT NOT NULL CHECK (action IN ('INSERT', 'UPDATE', 'DELETE')),
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  changed_fields TEXT[]
);

CREATE INDEX IF NOT EXISTS idx_audit_log_entity ON audit_log (entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_occurred_at ON audit_log (occurred_at DESC);

-- The acting user is taken from the transaction setting app.user_id when the API sets it
-- (the transactional functions do); otherwise it is NULL (service-role write).
CREATE OR REPLACE FUNCTION audit_row_change() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  v_actor UUID := nullif(current_setting('app.user_id', TRUE), '')::uuid;
  v_fields TEXT[];
  v_id TEXT;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    SELECT array_agg(n.key ORDER BY n.key) INTO v_fields
    FROM jsonb_each(to_jsonb(NEW)) n
    JOIN jsonb_each(to_jsonb(OLD)) o USING (key)
    WHERE n.value IS DISTINCT FROM o.value AND n.key NOT IN ('updated_at');
    IF v_fields IS NULL THEN RETURN NEW; END IF;
  END IF;
  v_id := CASE WHEN TG_OP = 'DELETE' THEN to_jsonb(OLD)->>'id' ELSE to_jsonb(NEW)->>'id' END;
  INSERT INTO audit_log (actor_id, action, entity_type, entity_id, changed_fields)
  VALUES (v_actor, TG_OP, TG_TABLE_NAME, v_id, v_fields);
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END $$;

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['customers', 'products', 'suppliers', 'product_batches', 'pharmacy_settings', 'user_profiles']
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_%1$s_audit ON %1$I', t);
    EXECUTE format('CREATE TRIGGER trg_%1$s_audit AFTER INSERT OR UPDATE OR DELETE ON %1$I FOR EACH ROW EXECUTE FUNCTION audit_row_change()', t);
  END LOOP;
END $$;

COMMIT;
