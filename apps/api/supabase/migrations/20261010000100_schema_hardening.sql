-- Migration: Schema hardening (Phase 3)
--
-- Additive and non-destructive:
--   * adds columns the application already writes (customers demographics, allergy status)
--   * adds CHECK constraints as NOT VALID, so existing rows are not rejected; run the
--     VALIDATE statements at the end of DATABASE_MIGRATION_PLAN.md after checking the data
--   * adds indexes, updated_at triggers and number sequences
-- No table, column or row is dropped or rewritten.

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Patients (customers)
-- ---------------------------------------------------------------------------
-- The API has been writing these columns since the patient form was added; on a database
-- built only from the init migration those inserts fail.
ALTER TABLE customers ADD COLUMN IF NOT EXISTS age TEXT;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS gender TEXT;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS medical_notes TEXT;

-- Allergy status is explicit. Existing patients become UNKNOWN: an empty field never means
-- "no known allergies".
ALTER TABLE customers ADD COLUMN IF NOT EXISTS allergy_status TEXT NOT NULL DEFAULT 'UNKNOWN';
ALTER TABLE customers ADD COLUMN IF NOT EXISTS allergies TEXT;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS allergy_status_updated_at TIMESTAMPTZ;

DO $$ BEGIN
  ALTER TABLE customers ADD CONSTRAINT customers_allergy_status_check
    CHECK (allergy_status IN ('UNKNOWN', 'NONE_KNOWN', 'HAS_ALLERGIES'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE customers ADD CONSTRAINT customers_allergies_required_check
    CHECK (allergy_status <> 'HAS_ALLERGIES' OR coalesce(btrim(allergies), '') <> '');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE customers ADD CONSTRAINT customers_name_not_blank CHECK (btrim(name) <> '') NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS idx_customers_name ON customers (lower(name));

-- ---------------------------------------------------------------------------
-- 2. Medicines (products)
-- ---------------------------------------------------------------------------
-- Columns the workstation reads but no migration created.
ALTER TABLE products ADD COLUMN IF NOT EXISTS pack_size INTEGER;
ALTER TABLE products ADD COLUMN IF NOT EXISTS product_type TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS unit_of_measure TEXT;

DO $$ BEGIN
  ALTER TABLE products ADD CONSTRAINT products_stock_non_negative CHECK (stock_quantity >= 0) NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE products ADD CONSTRAINT products_prices_non_negative
    CHECK (retail_price >= 0 AND coalesce(purchase_cost, 0) >= 0) NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE products ADD CONSTRAINT products_thresholds_valid
    CHECK (
      coalesce(minimum_stock, 0) >= 0
      AND coalesce(reorder_level, 0) >= 0
      AND (maximum_stock IS NULL OR maximum_stock >= coalesce(reorder_level, 0))
    ) NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE products ADD CONSTRAINT products_pack_size_positive CHECK (pack_size IS NULL OR pack_size > 0) NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS idx_products_name_lower ON products (lower(name));
CREATE INDEX IF NOT EXISTS idx_products_active ON products (is_active);

-- ---------------------------------------------------------------------------
-- 3. Batches, receipts and the stock ledger
-- ---------------------------------------------------------------------------
DO $$ BEGIN
  ALTER TABLE product_batches ADD CONSTRAINT product_batches_status_check
    CHECK (status IN ('ACTIVE', 'LOW_STOCK', 'EXPIRES_SOON', 'EXPIRED', 'DEPLETED', 'QUARANTINED')) NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE product_batches ADD CONSTRAINT product_batches_available_le_received
    CHECK (quantity_available <= quantity_received) NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- FEFO lookups: batches with stock for a product, earliest expiry first.
CREATE INDEX IF NOT EXISTS idx_product_batches_fefo
  ON product_batches (product_id, expiry_date NULLS LAST, received_at)
  WHERE quantity_available > 0;

DO $$ BEGIN
  ALTER TABLE stock_receipts ADD CONSTRAINT stock_receipts_status_check
    CHECK (status IN ('DRAFT', 'COMPLETED', 'CANCELLED')) NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Movement types: the names written today plus the legacy names from the V2 migration.
DO $$ BEGIN
  ALTER TABLE inventory_movements ADD CONSTRAINT inventory_movements_type_check
    CHECK (movement_type IN (
      'DISPENSE', 'STOCK_RECEIVED', 'ADJUSTMENT_IN', 'ADJUSTMENT_OUT', 'EXPIRED', 'DAMAGED', 'RETURNED',
      'ADJUSTMENT', 'RESTOCK', 'RETURN'
    )) NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE inventory_movements ADD CONSTRAINT inventory_movements_quantity_nonzero CHECK (quantity <> 0) NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE inventory_movements ADD CONSTRAINT inventory_movements_balance
    CHECK (stock_after = stock_before + quantity) NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS idx_inventory_movements_created_at ON inventory_movements (created_at DESC);

-- ---------------------------------------------------------------------------
-- 4. Prescriptions and dispensing
-- ---------------------------------------------------------------------------
DO $$ BEGIN
  ALTER TABLE prescriptions ADD CONSTRAINT prescriptions_status_check
    CHECK (status IN ('DRAFT', 'COMPLETED', 'CANCELLED')) NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE prescriptions ADD CONSTRAINT prescriptions_print_count_non_negative CHECK (print_count >= 0) NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE prescription_items ADD CONSTRAINT prescription_items_quantity_positive CHECK (quantity > 0) NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE prescription_items ADD CONSTRAINT prescription_items_dosage_non_negative
    CHECK (morning_qty >= 0 AND lunch_qty >= 0 AND night_qty >= 0) NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE prescription_events ADD CONSTRAINT prescription_events_type_check
    CHECK (event_type IN ('CREATED', 'PRINTED', 'REPRINTED', 'SMS_SENT', 'SMS_FAILED', 'CANCELLED')) NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS idx_prescriptions_status ON prescriptions (status);
CREATE INDEX IF NOT EXISTS idx_prescription_items_created_at ON prescription_items (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_prescription_events_type_created ON prescription_events (event_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_prescription_events_created_at ON prescription_events (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_idempotency_keys_created_at ON idempotency_keys (created_at);

-- Number sequences for the transactional functions (migration 000300).
CREATE SEQUENCE IF NOT EXISTS grn_number_seq;
CREATE SEQUENCE IF NOT EXISTS prescription_number_seq;
-- Continue after the prescriptions that already exist, so numbers never repeat.
SELECT setval('prescription_number_seq', greatest((SELECT count(*) FROM prescriptions), 1), (SELECT count(*) FROM prescriptions) > 0);

-- ---------------------------------------------------------------------------
-- 5. updated_at maintenance
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END $$;

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['customers', 'products', 'labels', 'label_sessions', 'prescriptions', 'prescription_items',
                           'suppliers', 'product_batches', 'stock_receipts']
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_%1$s_updated_at ON %1$I', t);
    EXECUTE format('CREATE TRIGGER trg_%1$s_updated_at BEFORE UPDATE ON %1$I FOR EACH ROW EXECUTE FUNCTION set_updated_at()', t);
  END LOOP;
END $$;

COMMIT;
