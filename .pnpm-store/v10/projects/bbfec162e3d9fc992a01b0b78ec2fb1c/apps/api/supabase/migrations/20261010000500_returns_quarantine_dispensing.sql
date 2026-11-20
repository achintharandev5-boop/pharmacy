-- Migration: returns, quarantine and dispensing safety (Phase 4)
--
-- Prepared for review; NOT applied to Supabase. Depends on 000100–000400.
--
--   1. Reorder thresholds: removes the invented column defaults (15 / 5 / 500). Existing
--      values are left as they are; SUPABASE_DEPLOYMENT_GUIDE.md shows how to review them.
--   2. Returns are split into three separate concepts:
--        * patient return   -> recorded in patient_returns, held for review, NEVER added to
--                              dispensable stock
--        * supplier return  -> adjust_stock type SUPPLIER_RETURN, removes units from a batch
--        * stock correction -> ADJUSTMENT_IN / ADJUSTMENT_OUT, reason and user required
--      The old type RETURNED (which added stock) is no longer accepted for new adjustments.
--      Historical RETURNED movements are kept.
--   3. Quarantine: quarantine_batch / release_batch. A quarantined batch keeps its units on
--      record but is never allocated for dispensing, and receiving cannot silently
--      reactivate it.
--   4. Dispensing (create_prescription, still NOT called by the API unless the pharmacist
--      approves and PRESCRIPTION_WRITE_MODE=transactional is set):
--        * products locked in a fixed order (no deadlock between two prescriptions)
--        * the same idempotency key is serialised, so a retry returns the first result
--        * patient reference checked
--        * batches with an unknown expiry date are not allocated
--        * stock recorded without a batch is used only if the product's own expiry date is
--          known and not passed
--        * the result lists the batches each label was allocated from
--
-- Every statement is idempotent.

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Reorder thresholds: no invented defaults
-- ---------------------------------------------------------------------------
ALTER TABLE products ALTER COLUMN reorder_level DROP DEFAULT;
ALTER TABLE products ALTER COLUMN minimum_stock DROP DEFAULT;
ALTER TABLE products ALTER COLUMN maximum_stock DROP DEFAULT;

-- ---------------------------------------------------------------------------
-- 2. Movement types: add SUPPLIER_RETURN (RETURNED stays valid for historical rows)
-- ---------------------------------------------------------------------------
DO $$
DECLARE v_was_valid BOOLEAN;
BEGIN
  SELECT convalidated INTO v_was_valid FROM pg_constraint
  WHERE conname = 'inventory_movements_type_check' AND conrelid = 'inventory_movements'::regclass;

  ALTER TABLE inventory_movements DROP CONSTRAINT IF EXISTS inventory_movements_type_check;
  ALTER TABLE inventory_movements ADD CONSTRAINT inventory_movements_type_check
    CHECK (movement_type IN (
      'DISPENSE', 'STOCK_RECEIVED', 'ADJUSTMENT_IN', 'ADJUSTMENT_OUT', 'EXPIRED', 'DAMAGED', 'SUPPLIER_RETURN',
      'RETURNED', 'ADJUSTMENT', 'RESTOCK', 'RETURN'
    )) NOT VALID;
  -- Keep the constraint validated if it already was (the new list is a superset).
  IF v_was_valid THEN
    ALTER TABLE inventory_movements VALIDATE CONSTRAINT inventory_movements_type_check;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 3. Quarantine details on batches
-- ---------------------------------------------------------------------------
ALTER TABLE product_batches ADD COLUMN IF NOT EXISTS quarantine_reason TEXT;
ALTER TABLE product_batches ADD COLUMN IF NOT EXISTS quarantined_at TIMESTAMPTZ;
ALTER TABLE product_batches ADD COLUMN IF NOT EXISTS quarantined_by UUID;

-- ---------------------------------------------------------------------------
-- 4. Patient returns: recorded, held for review, never put back into dispensable stock
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS patient_returns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES products (id) ON DELETE RESTRICT,
  product_name_text TEXT NOT NULL CHECK (btrim(product_name_text) <> ''),
  batch_number TEXT,
  prescription_id UUID REFERENCES prescriptions (id) ON DELETE SET NULL,
  customer_id UUID REFERENCES customers (id) ON DELETE SET NULL,
  quantity NUMERIC NOT NULL CHECK (quantity > 0),
  reason TEXT NOT NULL CHECK (length(btrim(reason)) >= 3),
  status TEXT NOT NULL DEFAULT 'HELD_FOR_REVIEW' CHECK (status IN ('HELD_FOR_REVIEW', 'DISPOSED')),
  disposal_note TEXT,
  disposed_at TIMESTAMPTZ,
  disposed_by UUID,
  recorded_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT patient_returns_disposal_complete CHECK (
    status <> 'DISPOSED' OR (disposed_at IS NOT NULL AND disposed_by IS NOT NULL AND length(btrim(coalesce(disposal_note, ''))) >= 3)
  )
);
CREATE INDEX IF NOT EXISTS idx_patient_returns_status ON patient_returns (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_patient_returns_product ON patient_returns (product_id);

DROP TRIGGER IF EXISTS trg_patient_returns_updated_at ON patient_returns;
CREATE TRIGGER trg_patient_returns_updated_at BEFORE UPDATE ON patient_returns
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS trg_patient_returns_audit ON patient_returns;
CREATE TRIGGER trg_patient_returns_audit AFTER INSERT OR UPDATE OR DELETE ON patient_returns
  FOR EACH ROW EXECUTE FUNCTION audit_row_change();

ALTER TABLE patient_returns ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- 5. receive_stock: never reactivate a quarantined batch; serialise idempotency keys
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION receive_stock(p_payload JSONB, p_user_id UUID, p_idempotency_key TEXT DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_key TEXT := CASE WHEN p_idempotency_key IS NULL THEN NULL ELSE 'grn:' || p_idempotency_key END;
  v_existing JSONB;
  v_supplier UUID := nullif(p_payload->>'supplier_id', '')::uuid;
  v_receipt_id UUID;
  v_number TEXT;
  v_item JSONB;
  v_product_id UUID;
  v_batch_no TEXT;
  v_qty NUMERIC;
  v_cost NUMERIC;
  v_retail NUMERIC;
  v_expiry DATE;
  v_batch product_batches%ROWTYPE;
  v_stock_after INTEGER;
  v_lines INTEGER := 0;
  v_units NUMERIC := 0;
  v_total NUMERIC := 0;
  v_result JSONB;
BEGIN
  PERFORM set_config('app.user_id', coalesce(p_user_id::text, ''), TRUE);

  IF v_key IS NOT NULL THEN
    -- A second request with the same key waits here, then returns the first one's result.
    PERFORM pg_advisory_xact_lock(hashtextextended(v_key, 0));
    SELECT response_payload INTO v_existing FROM idempotency_keys WHERE key = v_key;
    IF FOUND THEN RETURN v_existing; END IF;
  END IF;

  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'Goods receipts must be attributed to a user.' USING HINT = 'VALIDATION';
  END IF;
  IF v_supplier IS NULL THEN
    RAISE EXCEPTION 'Select the supplier for this delivery.' USING HINT = 'VALIDATION';
  END IF;
  PERFORM 1 FROM suppliers WHERE id = v_supplier;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'The selected supplier does not exist.' USING HINT = 'NOT_FOUND';
  END IF;
  IF jsonb_typeof(p_payload->'items') IS DISTINCT FROM 'array' OR jsonb_array_length(p_payload->'items') = 0 THEN
    RAISE EXCEPTION 'A goods receipt needs at least one line.' USING HINT = 'VALIDATION';
  END IF;

  v_number := coalesce(
    nullif(btrim(p_payload->>'grn_number'), ''),
    'GRN-' || to_char(pharmacy_today(), 'YYYYMMDD') || '-' || lpad(nextval('grn_number_seq')::text, 5, '0')
  );

  INSERT INTO stock_receipts (receipt_number, supplier_id, invoice_number, grn_number, received_date, status, total_cost, notes, created_by)
  VALUES (
    v_number, v_supplier, nullif(p_payload->>'invoice_number', ''), v_number,
    coalesce(nullif(p_payload->>'received_date', '')::date, pharmacy_today()),
    'COMPLETED', 0, nullif(p_payload->>'notes', ''), p_user_id
  )
  RETURNING id INTO v_receipt_id;

  FOR v_item IN SELECT value FROM jsonb_array_elements(p_payload->'items') LOOP
    v_lines := v_lines + 1;
    v_product_id := (v_item->>'product_id')::uuid;
    v_batch_no := btrim(v_item->>'batch_number');
    v_qty := (v_item->>'quantity')::numeric;
    v_cost := (v_item->>'unit_cost')::numeric;
    v_retail := nullif(v_item->>'retail_price', '')::numeric;
    v_expiry := nullif(v_item->>'expiry_date', '')::date;

    IF v_batch_no IS NULL OR v_batch_no = '' THEN
      RAISE EXCEPTION 'Line %: batch number is required.', v_lines USING HINT = 'VALIDATION';
    END IF;
    IF v_qty IS NULL OR v_qty <= 0 OR v_qty <> trunc(v_qty) THEN
      RAISE EXCEPTION 'Line %: quantity must be a whole number greater than zero.', v_lines USING HINT = 'VALIDATION';
    END IF;
    IF v_cost IS NULL OR v_cost < 0 THEN
      RAISE EXCEPTION 'Line %: unit cost is required.', v_lines USING HINT = 'VALIDATION';
    END IF;
    IF v_expiry IS NULL THEN
      RAISE EXCEPTION 'Line %: expiry date is required.', v_lines USING HINT = 'VALIDATION';
    END IF;
    IF v_expiry < pharmacy_today() THEN
      RAISE EXCEPTION 'Line %: batch % expired on %; expired stock cannot be received.', v_lines, v_batch_no, v_expiry
        USING HINT = 'EXPIRED_BATCH';
    END IF;

    PERFORM 1 FROM products WHERE id = v_product_id FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Line %: the medicine does not exist.', v_lines USING HINT = 'NOT_FOUND';
    END IF;

    SELECT * INTO v_batch FROM product_batches
    WHERE product_id = v_product_id AND batch_number = v_batch_no
    FOR UPDATE;

    IF FOUND THEN
      IF v_batch.expiry_date IS NOT NULL AND v_batch.expiry_date <> v_expiry THEN
        RAISE EXCEPTION 'Line %: batch % is already recorded with expiry %, not %. Check the pack.',
          v_lines, v_batch_no, v_batch.expiry_date, v_expiry USING HINT = 'BATCH_EXPIRY_MISMATCH';
      END IF;
      IF v_batch.status = 'QUARANTINED' THEN
        RAISE EXCEPTION 'Line %: batch % is quarantined. Release or write it off before receiving more of it.',
          v_lines, v_batch_no USING HINT = 'BATCH_QUARANTINED';
      END IF;
      UPDATE product_batches SET
        quantity_received = quantity_received + v_qty,
        quantity_available = quantity_available + v_qty,
        purchase_cost = v_cost,
        retail_price = coalesce(v_retail, retail_price),
        expiry_date = coalesce(expiry_date, v_expiry),
        supplier_id = coalesce(supplier_id, v_supplier),
        status = 'ACTIVE'
      WHERE id = v_batch.id
      RETURNING * INTO v_batch;
    ELSE
      INSERT INTO product_batches (product_id, batch_number, supplier_id, quantity_received, quantity_available,
                                   purchase_cost, retail_price, manufactured_date, expiry_date, status, created_by)
      VALUES (v_product_id, v_batch_no, v_supplier, v_qty, v_qty, v_cost, v_retail,
              nullif(v_item->>'manufactured_date', '')::date, v_expiry, 'ACTIVE', p_user_id)
      RETURNING * INTO v_batch;
    END IF;

    INSERT INTO stock_receipt_items (receipt_id, product_id, batch_id, quantity, unit_cost, retail_price, expiry_date)
    VALUES (v_receipt_id, v_product_id, v_batch.id, v_qty, v_cost, v_retail, v_expiry);

    UPDATE products SET
      stock_quantity = stock_quantity + v_qty::integer,
      purchase_cost = v_cost,
      retail_price = coalesce(v_retail, retail_price)
    WHERE id = v_product_id
    RETURNING stock_quantity INTO v_stock_after;

    INSERT INTO inventory_movements (product_id, batch_id, movement_type, quantity, stock_before, stock_after,
                                     reference_type, reference_id, reason, created_by)
    VALUES (v_product_id, v_batch.id, 'STOCK_RECEIVED', v_qty, v_stock_after - v_qty, v_stock_after,
            'GRN', v_receipt_id::text, 'Received via ' || v_number, p_user_id);

    v_units := v_units + v_qty;
    v_total := v_total + v_qty * v_cost;
  END LOOP;

  UPDATE stock_receipts SET total_cost = v_total WHERE id = v_receipt_id;

  v_result := jsonb_build_object(
    'receipt_id', v_receipt_id, 'receipt_number', v_number,
    'line_count', v_lines, 'unit_count', v_units, 'total_cost', v_total
  );
  IF v_key IS NOT NULL THEN
    INSERT INTO idempotency_keys (key, response_payload) VALUES (v_key, v_result);
  END IF;
  RETURN v_result;
END $$;

-- ---------------------------------------------------------------------------
-- 6. adjust_stock: corrections, write-offs and supplier returns (no RETURNED)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION adjust_stock(
  p_product_id UUID,
  p_batch_id UUID,
  p_type TEXT,
  p_quantity NUMERIC,
  p_reason TEXT,
  p_user_id UUID,
  p_idempotency_key TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_key TEXT := CASE WHEN p_idempotency_key IS NULL THEN NULL ELSE 'adj:' || p_idempotency_key END;
  v_existing JSONB;
  v_delta NUMERIC;
  v_product products%ROWTYPE;
  v_batch product_batches%ROWTYPE;
  v_new_batch NUMERIC;
  v_new_stock NUMERIC;
  v_movement UUID;
  v_result JSONB;
BEGIN
  PERFORM set_config('app.user_id', coalesce(p_user_id::text, ''), TRUE);

  IF v_key IS NOT NULL THEN
    PERFORM pg_advisory_xact_lock(hashtextextended(v_key, 0));
    SELECT response_payload INTO v_existing FROM idempotency_keys WHERE key = v_key;
    IF FOUND THEN RETURN v_existing; END IF;
  END IF;

  IF p_type = 'RETURNED' THEN
    RAISE EXCEPTION 'Returns are recorded separately: use a patient return (held for review, not added to stock) or a supplier return (removes units from a batch).'
      USING HINT = 'VALIDATION';
  END IF;
  IF p_type IS NULL OR p_type NOT IN ('ADJUSTMENT_IN', 'ADJUSTMENT_OUT', 'EXPIRED', 'DAMAGED', 'SUPPLIER_RETURN') THEN
    RAISE EXCEPTION 'Unknown adjustment type.' USING HINT = 'VALIDATION';
  END IF;
  IF p_quantity IS NULL OR p_quantity <= 0 OR p_quantity <> trunc(p_quantity) THEN
    RAISE EXCEPTION 'Quantity must be a whole number greater than zero.' USING HINT = 'VALIDATION';
  END IF;
  IF p_reason IS NULL OR length(btrim(p_reason)) < 3 THEN
    RAISE EXCEPTION 'A reason is required for every stock adjustment.' USING HINT = 'VALIDATION';
  END IF;
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'Stock adjustments must be attributed to a user.' USING HINT = 'VALIDATION';
  END IF;
  IF p_type = 'SUPPLIER_RETURN' AND p_batch_id IS NULL THEN
    RAISE EXCEPTION 'Select the batch being returned to the supplier.' USING HINT = 'VALIDATION';
  END IF;

  v_delta := CASE WHEN p_type = 'ADJUSTMENT_IN' THEN p_quantity ELSE -p_quantity END;

  SELECT * INTO v_product FROM products WHERE id = p_product_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'The medicine does not exist.' USING HINT = 'NOT_FOUND';
  END IF;

  IF p_batch_id IS NOT NULL THEN
    SELECT * INTO v_batch FROM product_batches WHERE id = p_batch_id AND product_id = p_product_id FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'That batch does not belong to this medicine.' USING HINT = 'NOT_FOUND';
    END IF;
    v_new_batch := v_batch.quantity_available + v_delta;
    IF v_new_batch < 0 THEN
      RAISE EXCEPTION 'Only % unit(s) are available in batch %.', v_batch.quantity_available, v_batch.batch_number
        USING HINT = 'INSUFFICIENT_STOCK';
    END IF;
    IF v_new_batch > v_batch.quantity_received THEN
      UPDATE product_batches SET quantity_received = v_new_batch WHERE id = p_batch_id;
    END IF;
    UPDATE product_batches SET
      quantity_available = v_new_batch,
      status = CASE
        WHEN status = 'QUARANTINED' THEN status          -- only release_batch lifts a quarantine
        WHEN v_new_batch = 0 THEN 'DEPLETED'
        WHEN p_type = 'EXPIRED' THEN 'EXPIRED'
        WHEN status = 'DEPLETED' THEN 'ACTIVE'
        ELSE status
      END
    WHERE id = p_batch_id;
  END IF;

  v_new_stock := v_product.stock_quantity + v_delta;
  IF v_new_stock < 0 THEN
    RAISE EXCEPTION 'Only % unit(s) of % are recorded in stock.', v_product.stock_quantity, v_product.name
      USING HINT = 'INSUFFICIENT_STOCK';
  END IF;
  UPDATE products SET stock_quantity = v_new_stock::integer WHERE id = p_product_id;

  INSERT INTO inventory_movements (product_id, batch_id, movement_type, quantity, stock_before, stock_after,
                                   reference_type, reason, created_by)
  VALUES (p_product_id, p_batch_id, p_type, v_delta, v_product.stock_quantity, v_new_stock,
          CASE WHEN p_type = 'SUPPLIER_RETURN' THEN 'SUPPLIER_RETURN' ELSE 'ADJUSTMENT' END, btrim(p_reason), p_user_id)
  RETURNING id INTO v_movement;

  v_result := jsonb_build_object('movement_id', v_movement, 'stock_before', v_product.stock_quantity, 'stock_after', v_new_stock);
  IF v_key IS NOT NULL THEN
    INSERT INTO idempotency_keys (key, response_payload) VALUES (v_key, v_result);
  END IF;
  RETURN v_result;
END $$;

-- ---------------------------------------------------------------------------
-- 7. Quarantine and release
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION quarantine_batch(p_batch_id UUID, p_reason TEXT, p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE v_batch product_batches%ROWTYPE;
BEGIN
  PERFORM set_config('app.user_id', coalesce(p_user_id::text, ''), TRUE);
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'A quarantine must be attributed to a user.' USING HINT = 'VALIDATION';
  END IF;
  IF p_reason IS NULL OR length(btrim(p_reason)) < 3 THEN
    RAISE EXCEPTION 'A reason is required to quarantine a batch.' USING HINT = 'VALIDATION';
  END IF;
  SELECT * INTO v_batch FROM product_batches WHERE id = p_batch_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'The batch does not exist.' USING HINT = 'NOT_FOUND';
  END IF;
  IF v_batch.status = 'QUARANTINED' THEN
    RAISE EXCEPTION 'Batch % is already quarantined.', v_batch.batch_number USING HINT = 'VALIDATION';
  END IF;
  UPDATE product_batches SET
    status = 'QUARANTINED', quarantine_reason = btrim(p_reason), quarantined_at = now(), quarantined_by = p_user_id
  WHERE id = p_batch_id;
  RETURN jsonb_build_object('batch_id', p_batch_id, 'status', 'QUARANTINED');
END $$;

CREATE OR REPLACE FUNCTION release_batch(p_batch_id UUID, p_reason TEXT, p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_batch product_batches%ROWTYPE;
  v_status TEXT;
BEGIN
  PERFORM set_config('app.user_id', coalesce(p_user_id::text, ''), TRUE);
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'A release must be attributed to a user.' USING HINT = 'VALIDATION';
  END IF;
  IF p_reason IS NULL OR length(btrim(p_reason)) < 3 THEN
    RAISE EXCEPTION 'A reason is required to release a batch.' USING HINT = 'VALIDATION';
  END IF;
  SELECT * INTO v_batch FROM product_batches WHERE id = p_batch_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'The batch does not exist.' USING HINT = 'NOT_FOUND';
  END IF;
  IF v_batch.status <> 'QUARANTINED' THEN
    RAISE EXCEPTION 'Batch % is not quarantined.', v_batch.batch_number USING HINT = 'VALIDATION';
  END IF;
  IF v_batch.expiry_date IS NULL THEN
    RAISE EXCEPTION 'Batch % has no expiry date recorded and cannot be released for dispensing.', v_batch.batch_number
      USING HINT = 'EXPIRY_UNKNOWN';
  END IF;
  IF v_batch.expiry_date < pharmacy_today() THEN
    RAISE EXCEPTION 'Batch % expired on %; write it off instead of releasing it.', v_batch.batch_number, v_batch.expiry_date
      USING HINT = 'EXPIRED_BATCH';
  END IF;
  v_status := CASE WHEN v_batch.quantity_available = 0 THEN 'DEPLETED' ELSE 'ACTIVE' END;
  UPDATE product_batches SET
    status = v_status,
    quarantine_reason = coalesce(quarantine_reason, '') || ' | released: ' || btrim(p_reason),
    quarantined_at = NULL, quarantined_by = NULL
  WHERE id = p_batch_id;
  RETURN jsonb_build_object('batch_id', p_batch_id, 'status', v_status);
END $$;

-- ---------------------------------------------------------------------------
-- 8. create_prescription: FEFO among eligible batches only (still not called by default)
-- ---------------------------------------------------------------------------
-- Eligible batch: quantity_available > 0, expiry date known and not passed, status not
-- QUARANTINED or EXPIRED. Allocation order: earliest expiry, then earliest received.
-- Units not covered by batch records come from stock recorded without a batch, and only if
-- the product's own expiry date is known and not passed.
CREATE OR REPLACE FUNCTION create_prescription(p_payload JSONB, p_user_id UUID, p_idempotency_key TEXT DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_key TEXT := CASE WHEN p_idempotency_key IS NULL THEN NULL ELSE 'rx:' || p_idempotency_key END;
  v_existing JSONB;
  v_today DATE := pharmacy_today();
  v_rx prescriptions%ROWTYPE;
  v_item JSONB;
  v_item_id UUID;
  v_product products%ROWTYPE;
  v_qty NUMERIC;
  v_remaining NUMERIC;
  v_take NUMERIC;
  v_stock NUMERIC;
  v_unbatched NUMERIC;
  v_batch RECORD;
  v_count INTEGER := 0;
  v_alloc JSONB;
  v_items JSONB := '[]'::jsonb;
  v_result JSONB;
BEGIN
  PERFORM set_config('app.user_id', coalesce(p_user_id::text, ''), TRUE);

  IF v_key IS NOT NULL THEN
    PERFORM pg_advisory_xact_lock(hashtextextended(v_key, 0));
    SELECT response_payload INTO v_existing FROM idempotency_keys WHERE key = v_key;
    IF FOUND THEN RETURN v_existing; END IF;
  END IF;

  IF coalesce(btrim(p_payload->>'customer_name'), '') = '' THEN
    RAISE EXCEPTION 'Patient name is required.' USING HINT = 'VALIDATION';
  END IF;
  IF jsonb_typeof(p_payload->'items') IS DISTINCT FROM 'array' OR jsonb_array_length(p_payload->'items') = 0 THEN
    RAISE EXCEPTION 'A prescription needs at least one label.' USING HINT = 'VALIDATION';
  END IF;
  IF nullif(p_payload->>'customer_id', '') IS NOT NULL THEN
    PERFORM 1 FROM customers WHERE id = (p_payload->>'customer_id')::uuid;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'The selected patient record does not exist.' USING HINT = 'NOT_FOUND';
    END IF;
  END IF;

  -- Lock every catalogue product up front, in id order, so two prescriptions that share
  -- medicines queue behind each other instead of deadlocking.
  PERFORM 1 FROM products
  WHERE id IN (
    SELECT DISTINCT (value->>'product_id')::uuid FROM jsonb_array_elements(p_payload->'items')
    WHERE nullif(value->>'product_id', '') IS NOT NULL
  )
  ORDER BY id
  FOR UPDATE;

  INSERT INTO prescriptions (prescription_number, customer_id, customer_name_text, customer_phone, status, created_by)
  VALUES (
    'RX-' || to_char(v_today, 'YYYYMMDD') || '-' || lpad(nextval('prescription_number_seq')::text, 6, '0'),
    nullif(p_payload->>'customer_id', '')::uuid,
    btrim(p_payload->>'customer_name'),
    nullif(p_payload->>'customer_phone', ''),
    'COMPLETED',
    p_user_id
  )
  RETURNING * INTO v_rx;

  FOR v_item IN SELECT value FROM jsonb_array_elements(p_payload->'items') LOOP
    v_count := v_count + 1;
    v_qty := (v_item->>'quantity')::numeric;
    v_alloc := '[]'::jsonb;
    IF v_qty IS NULL OR v_qty <= 0 THEN
      RAISE EXCEPTION 'Label %: quantity must be greater than zero.', v_count USING HINT = 'VALIDATION';
    END IF;

    v_product := NULL;
    IF nullif(v_item->>'product_id', '') IS NOT NULL THEN
      SELECT * INTO v_product FROM products WHERE id = (v_item->>'product_id')::uuid;
      IF NOT FOUND THEN
        RAISE EXCEPTION 'Label %: the selected medicine is no longer in the catalogue.', v_count USING HINT = 'PRODUCT_NOT_FOUND';
      END IF;
      IF v_product.is_active IS FALSE THEN
        RAISE EXCEPTION '% is inactive and cannot be dispensed.', v_product.name USING HINT = 'PRODUCT_INACTIVE';
      END IF;
      IF v_qty <> trunc(v_qty) THEN
        RAISE EXCEPTION '%: dispensed quantity must be a whole number of units.', v_product.name USING HINT = 'INVALID_QUANTITY';
      END IF;
      IF v_product.stock_quantity < v_qty THEN
        RAISE EXCEPTION 'Insufficient stock for %. Requested: %, available: %.', v_product.name, v_qty, v_product.stock_quantity
          USING HINT = 'INSUFFICIENT_STOCK';
      END IF;
    ELSIF coalesce(btrim(v_item->>'alternative_product_name'), '') = '' THEN
      RAISE EXCEPTION 'Label %: select a medicine or enter its name.', v_count USING HINT = 'MEDICINE_REQUIRED';
    END IF;

    INSERT INTO prescription_items (
      prescription_id, product_id, product_name_snapshot, alternative_product_name, quantity, days,
      morning_qty, lunch_qty, night_qty, frequency_type, frequency_qty, stat_qty, stat_follow_up,
      expiry_date, show_address, instructions_json, final_instruction_text
    ) VALUES (
      v_rx.id, v_product.id, coalesce(v_product.name, btrim(v_item->>'alternative_product_name')),
      nullif(btrim(v_item->>'alternative_product_name'), ''), v_qty, nullif(v_item->>'days', '')::integer,
      coalesce((v_item->>'morning_qty')::numeric, 0), coalesce((v_item->>'lunch_qty')::numeric, 0),
      coalesce((v_item->>'night_qty')::numeric, 0), nullif(v_item->>'frequency_type', ''),
      nullif(v_item->>'frequency_qty', '')::numeric, nullif(v_item->>'stat_qty', '')::numeric,
      nullif(v_item->>'stat_follow_up', ''), nullif(v_item->>'expiry_date', '')::date,
      coalesce((v_item->>'show_address')::boolean, TRUE), coalesce(v_item->'instructions_json', '{}'::jsonb),
      v_item->>'final_instruction_text'
    )
    RETURNING id INTO v_item_id;

    IF v_product.id IS NOT NULL THEN
      v_remaining := v_qty;
      v_stock := v_product.stock_quantity;

      FOR v_batch IN
        SELECT id, batch_number, expiry_date, quantity_available FROM product_batches
        WHERE product_id = v_product.id AND quantity_available > 0
          AND expiry_date IS NOT NULL AND expiry_date >= v_today
          AND status NOT IN ('QUARANTINED', 'EXPIRED')
        ORDER BY expiry_date, received_at, id
        FOR UPDATE
      LOOP
        EXIT WHEN v_remaining = 0;
        v_take := least(v_remaining, v_batch.quantity_available);
        UPDATE product_batches SET
          quantity_available = quantity_available - v_take,
          status = CASE WHEN quantity_available - v_take = 0 THEN 'DEPLETED' ELSE status END
        WHERE id = v_batch.id;
        INSERT INTO inventory_movements (product_id, batch_id, prescription_id, prescription_item_id, movement_type,
                                         quantity, stock_before, stock_after, created_by)
        VALUES (v_product.id, v_batch.id, v_rx.id, v_item_id, 'DISPENSE', -v_take, v_stock, v_stock - v_take, p_user_id);
        v_alloc := v_alloc || jsonb_build_object('batchId', v_batch.id, 'batchNumber', v_batch.batch_number,
                                                 'expiryDate', v_batch.expiry_date, 'quantity', v_take);
        v_stock := v_stock - v_take;
        v_remaining := v_remaining - v_take;
      END LOOP;

      IF v_remaining > 0 THEN
        -- Stock recorded without a batch (before batch tracking): product total minus all batch units.
        v_unbatched := v_stock - coalesce((SELECT sum(quantity_available) FROM product_batches WHERE product_id = v_product.id), 0);
        IF v_unbatched < v_remaining THEN
          RAISE EXCEPTION 'Not enough dispensable stock of % for % unit(s). Expired, quarantined or undated batches are never dispensed.',
            v_product.name, v_qty USING HINT = 'INSUFFICIENT_STOCK';
        END IF;
        IF v_product.expiry_date IS NULL OR v_product.expiry_date < v_today THEN
          RAISE EXCEPTION '% has % unit(s) recorded without a batch and without a valid expiry date. Receive the stock against a batch before dispensing it.',
            v_product.name, v_unbatched USING HINT = 'EXPIRY_UNKNOWN';
        END IF;
        INSERT INTO inventory_movements (product_id, prescription_id, prescription_item_id, movement_type,
                                         quantity, stock_before, stock_after, created_by)
        VALUES (v_product.id, v_rx.id, v_item_id, 'DISPENSE', -v_remaining, v_stock, v_stock - v_remaining, p_user_id);
        v_alloc := v_alloc || jsonb_build_object('batchId', NULL, 'batchNumber', NULL,
                                                 'expiryDate', v_product.expiry_date, 'quantity', v_remaining);
        v_stock := v_stock - v_remaining;
      END IF;

      UPDATE products SET stock_quantity = v_stock::integer WHERE id = v_product.id;
    END IF;

    v_items := v_items || jsonb_build_object('itemId', v_item_id, 'productId', v_product.id, 'allocations', v_alloc);
  END LOOP;

  INSERT INTO prescription_events (prescription_id, event_type, user_id, metadata)
  VALUES (v_rx.id, 'CREATED', p_user_id, jsonb_build_object('itemCount', v_count, 'writeMode', 'transactional'));

  v_result := jsonb_build_object(
    'id', v_rx.id, 'prescriptionNumber', v_rx.prescription_number, 'status', v_rx.status,
    'customerName', v_rx.customer_name_text, 'customerPhone', v_rx.customer_phone,
    'itemCount', v_count, 'createdAt', v_rx.created_at, 'items', v_items
  );
  IF v_key IS NOT NULL THEN
    INSERT INTO idempotency_keys (key, response_payload) VALUES (v_key, v_result);
  END IF;
  RETURN v_result;
END $$;

-- ---------------------------------------------------------------------------
-- 9. Execution rights: the API (service_role) only
-- ---------------------------------------------------------------------------
REVOKE ALL ON FUNCTION quarantine_batch(UUID, TEXT, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION release_batch(UUID, TEXT, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION receive_stock(JSONB, UUID, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION adjust_stock(UUID, UUID, TEXT, NUMERIC, TEXT, UUID, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION create_prescription(JSONB, UUID, TEXT) FROM PUBLIC;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON FUNCTION quarantine_batch(UUID, TEXT, UUID) FROM anon, authenticated;
    REVOKE ALL ON FUNCTION release_batch(UUID, TEXT, UUID) FROM anon, authenticated;
    REVOKE ALL ON FUNCTION receive_stock(JSONB, UUID, TEXT) FROM anon, authenticated;
    REVOKE ALL ON FUNCTION adjust_stock(UUID, UUID, TEXT, NUMERIC, TEXT, UUID, TEXT) FROM anon, authenticated;
    REVOKE ALL ON FUNCTION create_prescription(JSONB, UUID, TEXT) FROM anon, authenticated;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    GRANT EXECUTE ON FUNCTION quarantine_batch(UUID, TEXT, UUID) TO service_role;
    GRANT EXECUTE ON FUNCTION release_batch(UUID, TEXT, UUID) TO service_role;
    GRANT EXECUTE ON FUNCTION receive_stock(JSONB, UUID, TEXT) TO service_role;
    GRANT EXECUTE ON FUNCTION adjust_stock(UUID, UUID, TEXT, NUMERIC, TEXT, UUID, TEXT) TO service_role;
    GRANT EXECUTE ON FUNCTION create_prescription(JSONB, UUID, TEXT) TO service_role;
  END IF;
END $$;

COMMIT;
