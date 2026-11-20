-- LOCAL TEST DATABASE ONLY. Tests for migration 20261010000500 (returns, quarantine,
-- dispensing safety). Run by run-migration-tests.sh after 10_migration_tests.sql.
\set ON_ERROR_STOP on
SET client_min_messages = notice;

CREATE FUNCTION pg_temp.check(ok BOOLEAN, what TEXT) RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
  IF ok IS NOT TRUE THEN RAISE EXCEPTION 'CHECK FAILED: %', what; END IF;
  RAISE NOTICE 'ok - %', what;
END $$;

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

-- Fixtures (test-only identifiers). U and S come from 10_migration_tests.sql.
--   Q1 batched product, Q2 unbatched stock without expiry, Q3 unbatched stock with a past expiry
INSERT INTO products (id, name, barcode, stock_quantity) VALUES
  ('eeeeeeee-0000-4000-8000-000000000001', 'Quarantine Test Tablet', 'Q-1', 0),
  ('eeeeeeee-0000-4000-8000-000000000002', 'Undated Legacy Cream', 'Q-2', 5),
  ('eeeeeeee-0000-4000-8000-000000000003', 'Expired Legacy Drops', 'Q-3', 5);
UPDATE products SET expiry_date = '2001-01-01' WHERE id = 'eeeeeeee-0000-4000-8000-000000000003';

SELECT receive_stock('{"supplier_id":"cccccccc-0000-4000-8000-000000000001","items":[
  {"product_id":"eeeeeeee-0000-4000-8000-000000000001","batch_number":"Q-A","quantity":10,"unit_cost":1,"expiry_date":"2098-01-01"},
  {"product_id":"eeeeeeee-0000-4000-8000-000000000001","batch_number":"Q-B","quantity":10,"unit_cost":1,"expiry_date":"2099-01-01"}]}',
  'bbbbbbbb-0000-4000-8000-000000000001');

-- ---------------------------------------------------------------------------
-- 1. Reorder thresholds are never invented
-- ---------------------------------------------------------------------------
SELECT pg_temp.check(
  (SELECT bool_and(column_default IS NULL) FROM information_schema.columns
   WHERE table_name = 'products' AND column_name IN ('reorder_level', 'minimum_stock', 'maximum_stock')),
  'threshold columns have no default value');
SELECT pg_temp.check(
  (SELECT reorder_level IS NULL AND minimum_stock IS NULL AND maximum_stock IS NULL FROM products WHERE barcode = 'Q-1'),
  'a new medicine has no threshold until one is configured');
SELECT pg_temp.check(
  (SELECT reorder_level = 10 AND minimum_stock = 2 FROM products WHERE barcode = 'T-1'),
  'existing configured thresholds are kept');

-- ---------------------------------------------------------------------------
-- 2. Returns are separate concepts
-- ---------------------------------------------------------------------------
SELECT pg_temp.check(
  pg_temp.fails($$SELECT adjust_stock('eeeeeeee-0000-4000-8000-000000000001', NULL, 'RETURNED', 1, 'Patient brought back', 'bbbbbbbb-0000-4000-8000-000000000001')$$) = 'VALIDATION',
  'the ambiguous RETURNED type is refused');
SELECT pg_temp.check((SELECT stock_quantity FROM products WHERE barcode = 'Q-1') = 20, 'refused return changed nothing');

SELECT pg_temp.check(
  pg_temp.fails($$SELECT adjust_stock('eeeeeeee-0000-4000-8000-000000000001', NULL, 'SUPPLIER_RETURN', 2, 'Recall', 'bbbbbbbb-0000-4000-8000-000000000001')$$) = 'VALIDATION',
  'a supplier return names the batch');
SELECT pg_temp.check(
  pg_temp.fails($$SELECT adjust_stock('eeeeeeee-0000-4000-8000-000000000001', (SELECT id FROM product_batches WHERE batch_number = 'Q-B'),
     'SUPPLIER_RETURN', 11, 'Recall', 'bbbbbbbb-0000-4000-8000-000000000001')$$) = 'INSUFFICIENT_STOCK',
  'a supplier return cannot exceed the batch');
SELECT adjust_stock('eeeeeeee-0000-4000-8000-000000000001', (SELECT id FROM product_batches WHERE batch_number = 'Q-B'),
  'SUPPLIER_RETURN', 2, 'Short-dated, returned to supplier', 'bbbbbbbb-0000-4000-8000-000000000001');
SELECT pg_temp.check(
  (SELECT quantity_available FROM product_batches WHERE batch_number = 'Q-B') = 8
  AND (SELECT stock_quantity FROM products WHERE barcode = 'Q-1') = 18,
  'a supplier return removes units from the batch and the product total');
SELECT pg_temp.check(
  (SELECT quantity = -2 AND reference_type = 'SUPPLIER_RETURN' AND created_by IS NOT NULL
   FROM inventory_movements WHERE movement_type = 'SUPPLIER_RETURN'),
  'the supplier return is in the ledger, attributed to the user');

INSERT INTO patient_returns (product_id, product_name_text, batch_number, quantity, reason, recorded_by)
VALUES ('eeeeeeee-0000-4000-8000-000000000001', 'Quarantine Test Tablet', 'Q-A', 3, 'Patient stopped treatment', 'bbbbbbbb-0000-4000-8000-000000000001');
SELECT pg_temp.check(
  (SELECT stock_quantity FROM products WHERE barcode = 'Q-1') = 18
  AND (SELECT quantity_available FROM product_batches WHERE batch_number = 'Q-A') = 10,
  'a patient return does not add to dispensable stock');
SELECT pg_temp.check((SELECT status FROM patient_returns) = 'HELD_FOR_REVIEW', 'a patient return is held for review');
SELECT pg_temp.check(
  pg_temp.fails($$UPDATE patient_returns SET status = 'DISPOSED'$$) = '23514',
  'disposal requires who, when and a note');
SELECT pg_temp.check(
  (SELECT count(*) FROM audit_log WHERE entity_type = 'patient_returns' AND action = 'INSERT') = 1,
  'patient returns are audited');
SELECT pg_temp.check(
  pg_temp.fails($$INSERT INTO patient_returns (product_name_text, quantity, reason, recorded_by) VALUES ('X', 1, 'ok reason', NULL)$$) = '23502',
  'a patient return is attributed to a user');

-- ---------------------------------------------------------------------------
-- 3. Quarantine
-- ---------------------------------------------------------------------------
SELECT pg_temp.check(
  pg_temp.fails($$SELECT quarantine_batch((SELECT id FROM product_batches WHERE batch_number = 'Q-A'), '', 'bbbbbbbb-0000-4000-8000-000000000001')$$) = 'VALIDATION',
  'quarantine requires a reason');
SELECT pg_temp.check(
  pg_temp.fails($$SELECT quarantine_batch((SELECT id FROM product_batches WHERE batch_number = 'Q-A'), 'Damaged seal', NULL)$$) = 'VALIDATION',
  'quarantine requires a user');
SELECT quarantine_batch((SELECT id FROM product_batches WHERE batch_number = 'Q-A'), 'Damaged seal on carton', 'bbbbbbbb-0000-4000-8000-000000000001');
SELECT pg_temp.check(
  (SELECT status = 'QUARANTINED' AND quarantined_by IS NOT NULL AND quarantine_reason = 'Damaged seal on carton'
   FROM product_batches WHERE batch_number = 'Q-A'),
  'quarantine records status, user and reason');
SELECT pg_temp.check(
  (SELECT 'status' = ANY (changed_fields) AND actor_id = 'bbbbbbbb-0000-4000-8000-000000000001'
   FROM audit_log WHERE entity_type = 'product_batches' AND action = 'UPDATE' ORDER BY id DESC LIMIT 1),
  'quarantine is in the audit log with the user');

SELECT pg_temp.check(
  pg_temp.fails($$SELECT receive_stock('{"supplier_id":"cccccccc-0000-4000-8000-000000000001","items":[
     {"product_id":"eeeeeeee-0000-4000-8000-000000000001","batch_number":"Q-A","quantity":1,"unit_cost":1,"expiry_date":"2098-01-01"}]}',
     'bbbbbbbb-0000-4000-8000-000000000001')$$) = 'BATCH_QUARANTINED',
  'receiving cannot reactivate a quarantined batch');
SELECT adjust_stock('eeeeeeee-0000-4000-8000-000000000001', (SELECT id FROM product_batches WHERE batch_number = 'Q-A'),
  'ADJUSTMENT_OUT', 1, 'Recount of quarantined stock', 'bbbbbbbb-0000-4000-8000-000000000001');
SELECT pg_temp.check((SELECT status FROM product_batches WHERE batch_number = 'Q-A') = 'QUARANTINED',
  'an adjustment does not lift a quarantine');

-- Q1: Q-A 9 units quarantined (exp 2098), Q-B 8 units (exp 2099). Total 17, dispensable 8.
SELECT pg_temp.check(
  pg_temp.fails($$SELECT create_prescription('{"customer_name":"Q","items":[
     {"product_id":"eeeeeeee-0000-4000-8000-000000000001","quantity":9,"final_instruction_text":"t"}]}',
     'bbbbbbbb-0000-4000-8000-000000000001')$$) = 'INSUFFICIENT_STOCK',
  'quarantined units are never dispensed');
SELECT pg_temp.check(
  (SELECT (create_prescription('{"customer_name":"Q","items":[
     {"product_id":"eeeeeeee-0000-4000-8000-000000000001","quantity":3,"final_instruction_text":"t"}]}',
     'bbbbbbbb-0000-4000-8000-000000000001') #>> '{items,0,allocations,0,batchNumber}')) = 'Q-B',
  'FEFO skips the quarantined earlier batch and reports the batch used');
SELECT pg_temp.check((SELECT quantity_available FROM product_batches WHERE batch_number = 'Q-A') = 9, 'quarantined batch untouched by dispensing');

SELECT pg_temp.check(
  pg_temp.fails($$SELECT release_batch((SELECT id FROM product_batches WHERE batch_number = 'Q-B'), 'Checked', 'bbbbbbbb-0000-4000-8000-000000000001')$$) = 'VALIDATION',
  'only a quarantined batch can be released');
SELECT release_batch((SELECT id FROM product_batches WHERE batch_number = 'Q-A'), 'Seal checked by pharmacist', 'bbbbbbbb-0000-4000-8000-000000000001');
SELECT pg_temp.check((SELECT status FROM product_batches WHERE batch_number = 'Q-A') = 'ACTIVE', 'a released batch is dispensable again');

INSERT INTO product_batches (product_id, batch_number, quantity_received, quantity_available, expiry_date, status)
VALUES ('eeeeeeee-0000-4000-8000-000000000001', 'Q-OLD', 2, 0, '2001-01-01', 'QUARANTINED');
SELECT pg_temp.check(
  pg_temp.fails($$SELECT release_batch((SELECT id FROM product_batches WHERE batch_number = 'Q-OLD'), 'Try again', 'bbbbbbbb-0000-4000-8000-000000000001')$$) = 'EXPIRED_BATCH',
  'an expired batch cannot be released from quarantine');

-- ---------------------------------------------------------------------------
-- 4. Dispensing never uses stock of unknown or past expiry
-- ---------------------------------------------------------------------------
INSERT INTO product_batches (product_id, batch_number, quantity_received, quantity_available, expiry_date, status)
VALUES ('eeeeeeee-0000-4000-8000-000000000002', 'Q-UNDATED', 5, 5, NULL, 'ACTIVE');
UPDATE products SET stock_quantity = 10 WHERE barcode = 'Q-2';
SELECT pg_temp.check(
  pg_temp.fails($$SELECT create_prescription('{"customer_name":"Q","items":[
     {"product_id":"eeeeeeee-0000-4000-8000-000000000002","quantity":6,"final_instruction_text":"t"}]}',
     'bbbbbbbb-0000-4000-8000-000000000001')$$) IN ('INSUFFICIENT_STOCK', 'EXPIRY_UNKNOWN'),
  'a batch without an expiry date is not allocated');
SELECT pg_temp.check(
  pg_temp.fails($$SELECT create_prescription('{"customer_name":"Q","items":[
     {"product_id":"eeeeeeee-0000-4000-8000-000000000002","quantity":1,"final_instruction_text":"t"}]}',
     'bbbbbbbb-0000-4000-8000-000000000001')$$) = 'EXPIRY_UNKNOWN',
  'unbatched stock without an expiry date is not dispensed');
SELECT pg_temp.check(
  pg_temp.fails($$SELECT create_prescription('{"customer_name":"Q","items":[
     {"product_id":"eeeeeeee-0000-4000-8000-000000000003","quantity":1,"final_instruction_text":"t"}]}',
     'bbbbbbbb-0000-4000-8000-000000000001')$$) = 'EXPIRY_UNKNOWN',
  'unbatched stock whose expiry has passed is not dispensed');
SELECT pg_temp.check(
  (SELECT stock_quantity FROM products WHERE barcode = 'Q-2') = 10 AND (SELECT stock_quantity FROM products WHERE barcode = 'Q-3') = 5,
  'refused dispensing changed no stock');

SELECT pg_temp.check(
  pg_temp.fails($$SELECT create_prescription('{"customer_id":"dddddddd-0000-4000-8000-0000000000ff","customer_name":"Q","items":[
     {"alternative_product_name":"Own supply","quantity":1,"final_instruction_text":"t"}]}',
     'bbbbbbbb-0000-4000-8000-000000000001')$$) = 'NOT_FOUND',
  'an unknown patient reference is refused');

-- Allocation across two batches, earliest expiry first, with the ledger balanced per row.
SELECT pg_temp.check(
  (SELECT jsonb_array_length(create_prescription('{"customer_name":"Q","items":[
     {"product_id":"eeeeeeee-0000-4000-8000-000000000001","quantity":12,"final_instruction_text":"t"}]}',
     'bbbbbbbb-0000-4000-8000-000000000001') #> '{items,0,allocations}')) = 2,
  'a label larger than one batch is split across batches');
SELECT pg_temp.check(
  (SELECT quantity_available FROM product_batches WHERE batch_number = 'Q-A') = 0
  AND (SELECT quantity_available FROM product_batches WHERE batch_number = 'Q-B') = 2
  AND (SELECT stock_quantity FROM products WHERE barcode = 'Q-1') = 2,
  'earliest expiry emptied first; batches and product total agree');
SELECT pg_temp.check(
  (SELECT bool_and(stock_after = stock_before + quantity) FROM inventory_movements),
  'every ledger row balances');

-- ---------------------------------------------------------------------------
-- 5. Privileges and RLS on the new objects
-- ---------------------------------------------------------------------------
SET ROLE anon;
SELECT pg_temp.check((SELECT count(*) FROM patient_returns) = 0, 'anon cannot read patient returns');
SELECT pg_temp.check(
  pg_temp.fails($$SELECT quarantine_batch((SELECT id FROM product_batches LIMIT 1), 'x y z', 'bbbbbbbb-0000-4000-8000-000000000001')$$) = '42501',
  'anon cannot quarantine a batch');
RESET ROLE;
SET ROLE authenticated;
SELECT pg_temp.check(
  pg_temp.fails($$SELECT release_batch(NULL, 'x y z', NULL)$$) = '42501',
  'authenticated cannot release a batch');
SELECT pg_temp.check(
  pg_temp.fails($$INSERT INTO patient_returns (product_name_text, quantity, reason, recorded_by) VALUES ('X', 1, 'abc', 'bbbbbbbb-0000-4000-8000-000000000001')$$) = '42501',
  'authenticated cannot write patient returns');
RESET ROLE;
SET ROLE service_role;
SELECT pg_temp.check((SELECT count(*) FROM patient_returns) = 1, 'service_role reads patient returns');
RESET ROLE;
SELECT pg_temp.check(
  (SELECT bool_and(relrowsecurity) FROM pg_class WHERE relnamespace = 'public'::regnamespace AND relkind = 'r'),
  'every public table, including patient_returns, has RLS enabled');

\echo 'RETURNS AND DISPENSING TESTS PASSED'
