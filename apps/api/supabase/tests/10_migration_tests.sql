-- LOCAL TEST DATABASE ONLY. Run by run-migration-tests.sh after all migrations are applied.
-- Every check raises an exception on failure, which stops psql (ON_ERROR_STOP).
\set ON_ERROR_STOP on
SET client_min_messages = notice;

CREATE FUNCTION pg_temp.check(ok BOOLEAN, what TEXT) RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
  IF ok IS NOT TRUE THEN RAISE EXCEPTION 'CHECK FAILED: %', what; END IF;
  RAISE NOTICE 'ok - %', what;
END $$;

-- Runs SQL that must fail; returns the HINT (or SQLSTATE when there is no hint).
CREATE FUNCTION pg_temp.fails(stmt TEXT) RETURNS TEXT LANGUAGE plpgsql AS $$
DECLARE v_hint TEXT; v_state TEXT;
BEGIN
  BEGIN
    EXECUTE stmt;
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_hint = PG_EXCEPTION_HINT, v_state = RETURNED_SQLSTATE;
    RETURN coalesce(nullif(v_hint, ''), v_state);
  END;
  RETURN 'NO ERROR';
END $$;

-- ---------------------------------------------------------------------------
-- Fixtures (test-only identifiers)
--   P1 batched product, P2 legacy product with unbatched stock, U user, S supplier
-- ---------------------------------------------------------------------------
INSERT INTO auth.users (id, email) VALUES ('bbbbbbbb-0000-4000-8000-000000000001', 'user@test.invalid');
INSERT INTO suppliers (id, name) VALUES ('cccccccc-0000-4000-8000-000000000001', 'Test Supplier');
INSERT INTO products (id, name, barcode, stock_quantity, expiry_date, batch_number, reorder_level, minimum_stock) VALUES
  ('aaaaaaaa-0000-4000-8000-000000000001', 'Batched Tablet', 'T-1', 0, '2099-01-01', 'N/A', 10, 2),
  ('aaaaaaaa-0000-4000-8000-000000000002', 'Legacy Syrup', 'T-2', 20, '2099-01-01', 'L-1', 5, 1);
INSERT INTO customers (id, name, phone_number) VALUES ('dddddddd-0000-4000-8000-000000000001', 'Test Patient', '0700000000');

-- ---------------------------------------------------------------------------
-- 1. Schema
-- ---------------------------------------------------------------------------
SELECT pg_temp.check(
  (SELECT allergy_status FROM customers WHERE id = 'dddddddd-0000-4000-8000-000000000001') = 'UNKNOWN',
  'existing and new patients default to allergy status UNKNOWN, never "none"');
SELECT pg_temp.check(
  pg_temp.fails($$UPDATE customers SET allergy_status = 'NONE' WHERE id = 'dddddddd-0000-4000-8000-000000000001'$$) = '23514',
  'allergy status is restricted to known values');
SELECT pg_temp.check(
  pg_temp.fails($$UPDATE customers SET allergy_status = 'HAS_ALLERGIES' WHERE id = 'dddddddd-0000-4000-8000-000000000001'$$) = '23514',
  'HAS_ALLERGIES requires the allergies to be listed');
SELECT pg_temp.check(
  pg_temp.fails($$UPDATE products SET stock_quantity = -1 WHERE id = 'aaaaaaaa-0000-4000-8000-000000000002'$$) = '23514',
  'product stock cannot go negative (NOT VALID constraints still apply to new writes)');
SELECT pg_temp.check(
  pg_temp.fails($$INSERT INTO inventory_movements (product_id, movement_type, quantity, stock_before, stock_after)
                  VALUES ('aaaaaaaa-0000-4000-8000-000000000002', 'DISPENSE', -1, 10, 5)$$) = '23514',
  'movement ledger rows must balance (after = before + quantity)');
SELECT pg_temp.check(
  pg_temp.fails($$INSERT INTO prescriptions (prescription_number, customer_name_text, status) VALUES ('X', 'A', 'BOGUS')$$) = '23514',
  'prescription status is restricted');

INSERT INTO products (name, barcode) VALUES ('Catalogue Only', 'T-NEW');
SELECT pg_temp.check(
  (SELECT expiry_date IS NULL AND stock_quantity = 0 FROM products WHERE barcode = 'T-NEW'),
  'a medicine can be added without inventing an expiry date or batch');

UPDATE customers SET name = 'Test Patient Renamed' WHERE id = 'dddddddd-0000-4000-8000-000000000001';
SELECT pg_temp.check(
  (SELECT changed_fields FROM audit_log WHERE entity_type = 'customers' AND action = 'UPDATE' ORDER BY id DESC LIMIT 1) = ARRAY['name'],
  'audit log records which patient fields changed');
SELECT pg_temp.check(
  NOT EXISTS (SELECT 1 FROM audit_log WHERE array_to_string(changed_fields, ',') LIKE '%Renamed%'),
  'audit log does not copy patient values');
SELECT pg_temp.check(
  (SELECT updated_at > created_at FROM customers WHERE id = 'dddddddd-0000-4000-8000-000000000001'),
  'updated_at trigger maintains timestamps');
SELECT pg_temp.check((SELECT count(*) = 1 FROM pharmacy_settings), 'exactly one settings row');
SELECT pg_temp.check((SELECT pharmacy_name IS NULL AND phone IS NULL FROM pharmacy_settings), 'no pharmacy details are invented');
SELECT pg_temp.check(pg_temp.fails($$INSERT INTO pharmacy_settings (id) VALUES (FALSE)$$) = '23514', 'settings table cannot hold a second row');

-- ---------------------------------------------------------------------------
-- 2. receive_stock
-- ---------------------------------------------------------------------------
SELECT pg_temp.check(
  (receive_stock(
    '{"supplier_id":"cccccccc-0000-4000-8000-000000000001","invoice_number":"INV-1","items":[
       {"product_id":"aaaaaaaa-0000-4000-8000-000000000001","batch_number":"B-LATE","quantity":10,"unit_cost":2,"retail_price":3,"expiry_date":"2099-06-30"},
       {"product_id":"aaaaaaaa-0000-4000-8000-000000000001","batch_number":"B-EARLY","quantity":5,"unit_cost":2,"expiry_date":"2098-01-31"}]}',
    'bbbbbbbb-0000-4000-8000-000000000001', 'grn-key-1') ->> 'unit_count')::numeric = 15,
  'receive_stock records a two-line receipt');
SELECT pg_temp.check((SELECT stock_quantity FROM products WHERE id = 'aaaaaaaa-0000-4000-8000-000000000001') = 15, 'product total increased by received units');
SELECT pg_temp.check((SELECT count(*) FROM product_batches WHERE product_id = 'aaaaaaaa-0000-4000-8000-000000000001') = 2, 'one batch per batch number');
SELECT pg_temp.check((SELECT total_cost FROM stock_receipts WHERE invoice_number = 'INV-1') = 30, 'receipt total cost computed');
SELECT pg_temp.check(
  (SELECT count(*) FROM inventory_movements WHERE movement_type = 'STOCK_RECEIVED' AND created_by = 'bbbbbbbb-0000-4000-8000-000000000001') = 2,
  'each received line is in the ledger, attributed to the user');

SELECT receive_stock('{"supplier_id":"cccccccc-0000-4000-8000-000000000001","invoice_number":"INV-1","items":[
  {"product_id":"aaaaaaaa-0000-4000-8000-000000000001","batch_number":"B-LATE","quantity":10,"unit_cost":2,"expiry_date":"2099-06-30"}]}',
  'bbbbbbbb-0000-4000-8000-000000000001', 'grn-key-1');
SELECT pg_temp.check((SELECT stock_quantity FROM products WHERE id = 'aaaaaaaa-0000-4000-8000-000000000001') = 15,
  'retrying with the same idempotency key does not receive stock twice');

SELECT pg_temp.check(
  pg_temp.fails($$SELECT receive_stock('{"supplier_id":"cccccccc-0000-4000-8000-000000000001","items":[
     {"product_id":"aaaaaaaa-0000-4000-8000-000000000001","batch_number":"B-OK","quantity":3,"unit_cost":1,"expiry_date":"2099-01-01"},
     {"product_id":"aaaaaaaa-0000-4000-8000-000000000001","batch_number":"B-OLD","quantity":3,"unit_cost":1,"expiry_date":"2001-01-01"}]}',
     'bbbbbbbb-0000-4000-8000-000000000001')$$) = 'EXPIRED_BATCH',
  'expired stock cannot be received');
SELECT pg_temp.check(
  (SELECT stock_quantity FROM products WHERE id = 'aaaaaaaa-0000-4000-8000-000000000001') = 15
  AND NOT EXISTS (SELECT 1 FROM product_batches WHERE batch_number = 'B-OK'),
  'a failed line rolls back the whole receipt, including earlier lines');
SELECT pg_temp.check(
  pg_temp.fails($$SELECT receive_stock('{"supplier_id":"cccccccc-0000-4000-8000-000000000001","items":[
     {"product_id":"aaaaaaaa-0000-4000-8000-000000000001","batch_number":"B-LATE","quantity":1,"unit_cost":1,"expiry_date":"2099-07-01"}]}',
     'bbbbbbbb-0000-4000-8000-000000000001')$$) = 'BATCH_EXPIRY_MISMATCH',
  'an existing batch number with a different expiry is rejected');
SELECT pg_temp.check(
  pg_temp.fails($$SELECT receive_stock('{"items":[]}', 'bbbbbbbb-0000-4000-8000-000000000001')$$) = 'VALIDATION',
  'a supplier is required');

-- ---------------------------------------------------------------------------
-- 3. adjust_stock
-- ---------------------------------------------------------------------------
SELECT pg_temp.check(
  pg_temp.fails($$SELECT adjust_stock('aaaaaaaa-0000-4000-8000-000000000001',
     (SELECT id FROM product_batches WHERE batch_number = 'B-EARLY'), 'DAMAGED', 6, 'Broken', 'bbbbbbbb-0000-4000-8000-000000000001')$$)
  = 'INSUFFICIENT_STOCK',
  'cannot remove more than the batch holds');
SELECT pg_temp.check((SELECT quantity_available FROM product_batches WHERE batch_number = 'B-EARLY') = 5, 'failed adjustment changed nothing');
SELECT adjust_stock('aaaaaaaa-0000-4000-8000-000000000001',
  (SELECT id FROM product_batches WHERE batch_number = 'B-EARLY'), 'DAMAGED', 5, 'Water damage', 'bbbbbbbb-0000-4000-8000-000000000001');
SELECT pg_temp.check(
  (SELECT status = 'DEPLETED' AND quantity_available = 0 FROM product_batches WHERE batch_number = 'B-EARLY')
  AND (SELECT stock_quantity FROM products WHERE id = 'aaaaaaaa-0000-4000-8000-000000000001') = 10,
  'adjustment updates batch and product total together');
SELECT pg_temp.check(
  (SELECT reason = 'Water damage' AND quantity = -5 AND stock_before = 15 AND stock_after = 10
   FROM inventory_movements WHERE movement_type = 'DAMAGED'),
  'adjustment is in the ledger with its reason');
SELECT pg_temp.check(
  pg_temp.fails($$SELECT adjust_stock('aaaaaaaa-0000-4000-8000-000000000002',
     (SELECT id FROM product_batches WHERE batch_number = 'B-LATE'), 'ADJUSTMENT_IN', 1, 'Count', 'bbbbbbbb-0000-4000-8000-000000000001')$$)
  = 'NOT_FOUND',
  'a batch from another product is rejected');
SELECT pg_temp.check(
  pg_temp.fails($$SELECT adjust_stock('aaaaaaaa-0000-4000-8000-000000000002', NULL, 'ADJUSTMENT_IN', 1, '', 'bbbbbbbb-0000-4000-8000-000000000001')$$) = 'VALIDATION',
  'a reason is required');
SELECT pg_temp.check(
  pg_temp.fails($$SELECT adjust_stock('aaaaaaaa-0000-4000-8000-000000000002', NULL, 'ADJUSTMENT_IN', 1, 'Count', NULL)$$) = 'VALIDATION',
  'an adjustment must be attributed to a user');
SELECT pg_temp.check(
  pg_temp.fails($$SELECT adjust_stock('aaaaaaaa-0000-4000-8000-000000000002', NULL, 'ADJUSTMENT_OUT', 21, 'Count', 'bbbbbbbb-0000-4000-8000-000000000001')$$)
  = 'INSUFFICIENT_STOCK',
  'product total cannot go negative (no silent clamping to zero)');

-- ---------------------------------------------------------------------------
-- 4. create_prescription (FEFO)
-- ---------------------------------------------------------------------------
-- P1 now: B-LATE 10 units (exp 2099-06-30). Add an earlier batch and an expired batch.
INSERT INTO product_batches (product_id, batch_number, quantity_received, quantity_available, expiry_date, status) VALUES
  ('aaaaaaaa-0000-4000-8000-000000000001', 'B-SOON', 4, 4, '2097-01-01', 'ACTIVE'),
  ('aaaaaaaa-0000-4000-8000-000000000001', 'B-EXPIRED', 3, 3, '2001-01-01', 'ACTIVE');
UPDATE products SET stock_quantity = 17 WHERE id = 'aaaaaaaa-0000-4000-8000-000000000001';

SELECT create_prescription('{"customer_name":"Walk-in Patient","items":[
  {"product_id":"aaaaaaaa-0000-4000-8000-000000000001","quantity":6,"morning_qty":1,"night_qty":1,"final_instruction_text":"t"}]}',
  'bbbbbbbb-0000-4000-8000-000000000001', 'rx-key-1');
SELECT pg_temp.check(
  (SELECT quantity_available FROM product_batches WHERE batch_number = 'B-SOON') = 0
  AND (SELECT quantity_available FROM product_batches WHERE batch_number = 'B-LATE') = 8
  AND (SELECT quantity_available FROM product_batches WHERE batch_number = 'B-EXPIRED') = 3,
  'FEFO: earliest unexpired batch used first, expired batch never used');
SELECT pg_temp.check((SELECT stock_quantity FROM products WHERE id = 'aaaaaaaa-0000-4000-8000-000000000001') = 11, 'product total reduced by dispensed units');
SELECT pg_temp.check(
  (SELECT count(*) FROM inventory_movements WHERE movement_type = 'DISPENSE' AND product_id = 'aaaaaaaa-0000-4000-8000-000000000001') = 2,
  'one ledger row per batch allocation');

SELECT create_prescription('{"customer_name":"Walk-in Patient","items":[
  {"product_id":"aaaaaaaa-0000-4000-8000-000000000001","quantity":6,"final_instruction_text":"t"}]}',
  'bbbbbbbb-0000-4000-8000-000000000001', 'rx-key-1');
SELECT pg_temp.check((SELECT count(*) FROM prescriptions) = 1, 'same idempotency key does not create a second prescription');

SELECT pg_temp.check(
  pg_temp.fails($$SELECT create_prescription('{"customer_name":"A","items":[
     {"product_id":"aaaaaaaa-0000-4000-8000-000000000001","quantity":10,"final_instruction_text":"t"}]}',
     'bbbbbbbb-0000-4000-8000-000000000001')$$) = 'INSUFFICIENT_STOCK',
  'expired units do not count towards available stock');
SELECT pg_temp.check((SELECT count(*) FROM prescriptions) = 1 AND (SELECT quantity_available FROM product_batches WHERE batch_number = 'B-LATE') = 8,
  'a rejected prescription leaves no partial records');

SELECT create_prescription('{"customer_name":"B","items":[
  {"product_id":"aaaaaaaa-0000-4000-8000-000000000002","quantity":4,"final_instruction_text":"t"},
  {"alternative_product_name":"Own supply","quantity":1,"final_instruction_text":"t"}]}',
  'bbbbbbbb-0000-4000-8000-000000000001');
SELECT pg_temp.check((SELECT stock_quantity FROM products WHERE id = 'aaaaaaaa-0000-4000-8000-000000000002') = 16,
  'stock recorded without batches can still be dispensed');
SELECT pg_temp.check(
  pg_temp.fails($$SELECT create_prescription('{"customer_name":"C","items":[{"quantity":1}]}', 'bbbbbbbb-0000-4000-8000-000000000001')$$) = 'MEDICINE_REQUIRED',
  'a label needs a catalogue medicine or a name');

-- ---------------------------------------------------------------------------
-- 5. Row Level Security and privileges
-- ---------------------------------------------------------------------------
SET ROLE anon;
SELECT pg_temp.check((SELECT count(*) FROM customers) = 0, 'anon cannot read patients');
SELECT pg_temp.check((SELECT count(*) FROM prescriptions) = 0, 'anon cannot read prescriptions');
RESET ROLE;
SELECT pg_temp.check(
  (SELECT pg_temp.fails($$SET LOCAL ROLE anon; INSERT INTO customers (name, phone_number) VALUES ('x', '0700000001')$$)) = '42501',
  'anon cannot insert patients');
SELECT pg_temp.check(
  (SELECT pg_temp.fails($$SET LOCAL ROLE authenticated; UPDATE products SET stock_quantity = 999 RETURNING 1$$)) IN ('NO ERROR', '42501')
  AND (SELECT stock_quantity FROM products WHERE id = 'aaaaaaaa-0000-4000-8000-000000000002') = 16,
  'authenticated users cannot change stock directly');
SELECT pg_temp.check(
  (SELECT pg_temp.fails($$SET LOCAL ROLE anon; SELECT adjust_stock('aaaaaaaa-0000-4000-8000-000000000002', NULL, 'ADJUSTMENT_IN', 1, 'x y z', 'bbbbbbbb-0000-4000-8000-000000000001')$$)) = '42501',
  'anon cannot execute stock functions');
SELECT pg_temp.check(
  (SELECT pg_temp.fails($$SET LOCAL ROLE authenticated; SELECT receive_stock('{}', NULL)$$)) = '42501',
  'authenticated cannot execute stock functions');
SET ROLE service_role;
SELECT pg_temp.check((SELECT count(*) FROM customers) = 1, 'service_role (the API) reads patients');
SELECT pg_temp.check(
  (adjust_stock('aaaaaaaa-0000-4000-8000-000000000002', NULL, 'ADJUSTMENT_IN', 1, 'Recount', 'bbbbbbbb-0000-4000-8000-000000000001')->>'stock_after')::numeric = 17,
  'service_role executes stock functions');
RESET ROLE;
SELECT pg_temp.check(
  (SELECT bool_and(relrowsecurity) FROM pg_class WHERE relnamespace = 'public'::regnamespace AND relkind = 'r'),
  'every public table has RLS enabled');

-- ---------------------------------------------------------------------------
-- 6. Deferred validation of NOT VALID constraints succeeds on clean data
-- ---------------------------------------------------------------------------
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT conrelid::regclass AS tbl, conname FROM pg_constraint WHERE NOT convalidated AND connamespace = 'public'::regnamespace LOOP
    EXECUTE format('ALTER TABLE %s VALIDATE CONSTRAINT %I', r.tbl, r.conname);
  END LOOP;
END $$;
SELECT pg_temp.check(NOT EXISTS (SELECT 1 FROM pg_constraint WHERE NOT convalidated AND connamespace = 'public'::regnamespace),
  'all NOT VALID constraints validate on consistent data');

\echo 'ALL MIGRATION TESTS PASSED'
