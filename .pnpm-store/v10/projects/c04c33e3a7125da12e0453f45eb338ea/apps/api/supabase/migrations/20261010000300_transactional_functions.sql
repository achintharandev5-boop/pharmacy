-- Migration: transactional stock functions (Phase 3)
--
-- Each function runs in a single transaction: either every row change (receipt, batch,
-- product total, movement ledger) is committed, or none is. Rows are locked with
-- SELECT ... FOR UPDATE so concurrent requests cannot spend the same stock.
--
-- Errors meant for the user are raised with SQLSTATE P0001 and a machine-readable HINT,
-- which the API maps to an HTTP status (apps/api/src/common/db.ts).
--
-- Execution is restricted to service_role (the API). Browsers cannot call these.
--
--   receive_stock        used by POST /inventory/receipts
--   adjust_stock         used by POST /inventory/adjustments
--   create_prescription  NOT YET USED by the API. Proposed replacement for the
--                        application-level write sequence in PrescriptionsService, with
--                        FEFO batch allocation. Needs pharmacist sign-off (see
--                        DATABASE_MIGRATION_PLAN.md, "Decisions needed").

BEGIN;

-- ---------------------------------------------------------------------------
-- receive_stock
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
    SELECT response_payload INTO v_existing FROM idempotency_keys WHERE key = v_key;
    IF FOUND THEN RETURN v_existing; END IF;
  END IF;

  IF v_supplier IS NULL THEN
    RAISE EXCEPTION 'Select the supplier for this delivery.' USING HINT = 'VALIDATION';
  END IF;
  PERFORM 1 FROM suppliers WHERE id = v_supplier;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'The selected supplier does not exist.' USING HINT = 'NOT_FOUND';
  END IF;
  IF jsonb_typeof(p_payload->'items') <> 'array' OR jsonb_array_length(p_payload->'items') = 0 THEN
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
    -- A concurrent request with the same key fails here and its whole transaction rolls back.
    INSERT INTO idempotency_keys (key, response_payload) VALUES (v_key, v_result);
  END IF;
  RETURN v_result;
END $$;

-- ---------------------------------------------------------------------------
-- adjust_stock
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
    SELECT response_payload INTO v_existing FROM idempotency_keys WHERE key = v_key;
    IF FOUND THEN RETURN v_existing; END IF;
  END IF;

  IF p_type NOT IN ('ADJUSTMENT_IN', 'ADJUSTMENT_OUT', 'EXPIRED', 'DAMAGED', 'RETURNED') THEN
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

  -- RETURNED adds stock, matching the existing application behaviour.
  v_delta := CASE WHEN p_type IN ('ADJUSTMENT_OUT', 'EXPIRED', 'DAMAGED') THEN -p_quantity ELSE p_quantity END;

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
      -- Keep available <= received: an increase beyond the received total is recorded as received.
      UPDATE product_batches SET quantity_received = v_new_batch WHERE id = p_batch_id;
    END IF;
    UPDATE product_batches SET
      quantity_available = v_new_batch,
      status = CASE
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
          'ADJUSTMENT', btrim(p_reason), p_user_id)
  RETURNING id INTO v_movement;

  v_result := jsonb_build_object('movement_id', v_movement, 'stock_before', v_product.stock_quantity, 'stock_after', v_new_stock);
  IF v_key IS NOT NULL THEN
    INSERT INTO idempotency_keys (key, response_payload) VALUES (v_key, v_result);
  END IF;
  RETURN v_result;
END $$;

-- ---------------------------------------------------------------------------
-- create_prescription (proposed; not yet called by the API)
-- ---------------------------------------------------------------------------
-- Payload: { customer_id?, customer_name, customer_phone?, items: [ { product_id?, quantity,
--   product_name?, alternative_product_name?, days?, morning_qty, lunch_qty, night_qty,
--   frequency_type?, frequency_qty?, stat_qty?, stat_follow_up?, expiry_date?, show_address,
--   instructions_json, final_instruction_text } ] }
--
-- Stock allocation for catalogue items is First-Expiry-First-Out: units come from
-- non-expired batches with stock, earliest expiry first. Units the batch records cannot
-- cover are taken from the product total only if that total covers them (stock recorded
-- before batch tracking). Expired batches are never allocated.
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
  v_batch RECORD;
  v_count INTEGER := 0;
  v_result JSONB;
BEGIN
  PERFORM set_config('app.user_id', coalesce(p_user_id::text, ''), TRUE);

  IF v_key IS NOT NULL THEN
    SELECT response_payload INTO v_existing FROM idempotency_keys WHERE key = v_key;
    IF FOUND THEN RETURN v_existing; END IF;
  END IF;

  IF coalesce(btrim(p_payload->>'customer_name'), '') = '' THEN
    RAISE EXCEPTION 'Patient name is required.' USING HINT = 'VALIDATION';
  END IF;
  IF jsonb_typeof(p_payload->'items') <> 'array' OR jsonb_array_length(p_payload->'items') = 0 THEN
    RAISE EXCEPTION 'A prescription needs at least one label.' USING HINT = 'VALIDATION';
  END IF;

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
    IF v_qty IS NULL OR v_qty <= 0 THEN
      RAISE EXCEPTION 'Label %: quantity must be greater than zero.', v_count USING HINT = 'VALIDATION';
    END IF;

    v_product := NULL;
    IF nullif(v_item->>'product_id', '') IS NOT NULL THEN
      SELECT * INTO v_product FROM products WHERE id = (v_item->>'product_id')::uuid FOR UPDATE;
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
        SELECT id, quantity_available FROM product_batches
        WHERE product_id = v_product.id AND quantity_available > 0
          AND (expiry_date IS NULL OR expiry_date >= v_today)
          AND status NOT IN ('QUARANTINED', 'EXPIRED')
        ORDER BY expiry_date NULLS LAST, received_at, id
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
        v_stock := v_stock - v_take;
        v_remaining := v_remaining - v_take;
      END LOOP;

      IF v_remaining > 0 THEN
        -- Units not covered by batch records: only from stock recorded without a batch.
        IF (v_stock - coalesce((SELECT sum(quantity_available) FROM product_batches WHERE product_id = v_product.id), 0)) < v_remaining THEN
          RAISE EXCEPTION 'Not enough unexpired stock of % to dispense % unit(s).', v_product.name, v_qty
            USING HINT = 'INSUFFICIENT_STOCK';
        END IF;
        INSERT INTO inventory_movements (product_id, prescription_id, prescription_item_id, movement_type,
                                         quantity, stock_before, stock_after, created_by)
        VALUES (v_product.id, v_rx.id, v_item_id, 'DISPENSE', -v_remaining, v_stock, v_stock - v_remaining, p_user_id);
        v_stock := v_stock - v_remaining;
      END IF;

      UPDATE products SET stock_quantity = v_stock::integer WHERE id = v_product.id;
    END IF;
  END LOOP;

  INSERT INTO prescription_events (prescription_id, event_type, user_id, metadata)
  VALUES (v_rx.id, 'CREATED', p_user_id, jsonb_build_object('itemCount', v_count));

  v_result := jsonb_build_object(
    'id', v_rx.id, 'prescriptionNumber', v_rx.prescription_number, 'status', v_rx.status,
    'customerName', v_rx.customer_name_text, 'customerPhone', v_rx.customer_phone,
    'itemCount', v_count, 'createdAt', v_rx.created_at
  );
  IF v_key IS NOT NULL THEN
    INSERT INTO idempotency_keys (key, response_payload) VALUES (v_key, v_result);
  END IF;
  RETURN v_result;
END $$;

-- ---------------------------------------------------------------------------
-- Execution rights: the API (service_role) only.
-- ---------------------------------------------------------------------------
REVOKE ALL ON FUNCTION receive_stock(JSONB, UUID, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION adjust_stock(UUID, UUID, TEXT, NUMERIC, TEXT, UUID, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION create_prescription(JSONB, UUID, TEXT) FROM PUBLIC;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON FUNCTION receive_stock(JSONB, UUID, TEXT) FROM anon, authenticated;
    REVOKE ALL ON FUNCTION adjust_stock(UUID, UUID, TEXT, NUMERIC, TEXT, UUID, TEXT) FROM anon, authenticated;
    REVOKE ALL ON FUNCTION create_prescription(JSONB, UUID, TEXT) FROM anon, authenticated;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    GRANT EXECUTE ON FUNCTION receive_stock(JSONB, UUID, TEXT) TO service_role;
    GRANT EXECUTE ON FUNCTION adjust_stock(UUID, UUID, TEXT, NUMERIC, TEXT, UUID, TEXT) TO service_role;
    GRANT EXECUTE ON FUNCTION create_prescription(JSONB, UUID, TEXT) TO service_role;
  END IF;
END $$;

COMMIT;
