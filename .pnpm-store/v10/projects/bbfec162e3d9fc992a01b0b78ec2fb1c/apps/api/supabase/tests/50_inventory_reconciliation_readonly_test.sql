-- Disposable fixture test for inventory_reconciliation_readonly.sql.
-- Run with psql only. The application-shaped tables below are connection-local TEMP tables;
-- fixture rows are rolled back. No application or production table is written.
\set ON_ERROR_STOP on
BEGIN;

CREATE TEMP TABLE products (
  id uuid PRIMARY KEY,
  name text NOT NULL,
  stock_quantity numeric NOT NULL
) ON COMMIT DROP;
CREATE TEMP TABLE product_batches (
  id uuid PRIMARY KEY,
  product_id uuid NOT NULL,
  batch_number text NOT NULL,
  quantity_received numeric NOT NULL,
  quantity_available numeric NOT NULL,
  status text NOT NULL,
  expiry_date date
) ON COMMIT DROP;
CREATE TEMP TABLE stock_receipts (
  id uuid PRIMARY KEY,
  receipt_number text NOT NULL
) ON COMMIT DROP;
CREATE TEMP TABLE stock_receipt_items (
  receipt_id uuid NOT NULL,
  product_id uuid NOT NULL,
  batch_id uuid,
  quantity numeric NOT NULL
) ON COMMIT DROP;
CREATE TEMP TABLE inventory_movements (
  id uuid PRIMARY KEY,
  product_id uuid NOT NULL,
  batch_id uuid,
  movement_type text NOT NULL,
  quantity numeric NOT NULL,
  stock_before numeric NOT NULL,
  stock_after numeric NOT NULL,
  created_at timestamptz NOT NULL,
  reference_type text,
  reference_id text
) ON COMMIT DROP;

INSERT INTO products VALUES
  ('10000000-0000-4000-8000-000000000001', 'Batch total mismatch', 100),
  ('10000000-0000-4000-8000-000000000002', 'Legacy unbatched', 12),
  ('10000000-0000-4000-8000-000000000003', 'Negative aggregate', -1),
  ('10000000-0000-4000-8000-000000000004', 'Expired and quarantined', 9),
  ('10000000-0000-4000-8000-000000000005', 'GRN and ledger mismatch', 8),
  ('10000000-0000-4000-8000-000000000006', 'Ledger sequence mismatch', 1);

INSERT INTO product_batches VALUES
  ('20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'M-A', 45, 45, 'ACTIVE', '2098-01-01'),
  ('20000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000001', 'M-B', 35, 35, 'ACTIVE', '2099-01-01'),
  ('20000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000004', 'OLD', 5, 5, 'ACTIVE', '2001-01-01'),
  ('20000000-0000-4000-8000-000000000004', '10000000-0000-4000-8000-000000000004', 'Q', 4, 4, 'QUARANTINED', '2099-01-01'),
  ('20000000-0000-4000-8000-000000000005', '10000000-0000-4000-8000-000000000005', 'GRN-B', 10, 8, 'ACTIVE', '2099-01-01'),
  ('20000000-0000-4000-8000-000000000006', '10000000-0000-4000-8000-000000000006', 'LEDGER-B', 5, 1, 'ACTIVE', '2099-01-01');

INSERT INTO stock_receipts VALUES ('30000000-0000-4000-8000-000000000001', 'GRN-FIXTURE-1');
INSERT INTO stock_receipt_items VALUES
  ('30000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000005', '20000000-0000-4000-8000-000000000005', 10);

INSERT INTO inventory_movements VALUES
  ('40000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000002', NULL, 'DISPENSE', -3, 15, 12, '2026-10-01 08:00:00+00', NULL, NULL),
  ('40000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000003', NULL, 'DISPENSE', -1, 0, -1, '2026-10-01 08:01:00+00', NULL, NULL),
  ('40000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000005', '20000000-0000-4000-8000-000000000005', 'STOCK_RECEIVED', 8, 0, 8, '2026-10-01 08:02:00+00', 'GRN', '30000000-0000-4000-8000-000000000001'),
  ('40000000-0000-4000-8000-000000000004', '10000000-0000-4000-8000-000000000006', '20000000-0000-4000-8000-000000000006', 'STOCK_RECEIVED', 5, 0, 5, '2026-10-01 08:03:00+00', NULL, NULL),
  ('40000000-0000-4000-8000-000000000005', '10000000-0000-4000-8000-000000000006', '20000000-0000-4000-8000-000000000006', 'DISPENSE', -1, 2, 1, '2026-10-01 08:04:00+00', NULL, NULL),
  ('40000000-0000-4000-8000-000000000006', '10000000-0000-4000-8000-000000000005', '20000000-0000-4000-8000-000000000005', 'ADJUSTMENT', -1, 8, 6, '2026-10-01 08:05:00+00', NULL, NULL);

-- Execute the exact read-only diagnostic against the temporary fixtures. Inspect result sets
-- in psql output; these SELECTs intentionally only report discrepancies.
\ir ../diagnostics/inventory_reconciliation_readonly.sql

DO $$
BEGIN
  IF (SELECT stock_quantity - SUM(b.quantity_available)
      FROM products p JOIN product_batches b ON b.product_id = p.id
      WHERE p.name = 'Batch total mismatch'
      GROUP BY p.stock_quantity) <> 20 THEN
    RAISE EXCEPTION 'Product/batch mismatch fixture was not detectable';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM products p WHERE p.stock_quantity > 0 AND NOT EXISTS
      (SELECT 1 FROM product_batches b WHERE b.product_id = p.id) AND p.name = 'Legacy unbatched') THEN
    RAISE EXCEPTION 'Positive product without batch rows was not detectable';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM products WHERE stock_quantity < 0 AND name = 'Negative aggregate') THEN
    RAISE EXCEPTION 'Negative product balance fixture was not detectable';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM product_batches WHERE expiry_date < CURRENT_DATE AND product_id = '10000000-0000-4000-8000-000000000004')
     OR NOT EXISTS (SELECT 1 FROM product_batches WHERE status = 'QUARANTINED' AND product_id = '10000000-0000-4000-8000-000000000004') THEN
    RAISE EXCEPTION 'Expired/quarantined batch fixtures were not detectable';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM inventory_movements WHERE movement_type = 'DISPENSE' AND batch_id IS NULL
                 AND product_id = '10000000-0000-4000-8000-000000000002') THEN
    RAISE EXCEPTION 'Legacy unbatched dispense evidence was not detectable';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM stock_receipt_items i
    JOIN inventory_movements m ON m.reference_type = 'GRN' AND m.reference_id = i.receipt_id::text
      AND m.product_id = i.product_id AND m.batch_id IS NOT DISTINCT FROM i.batch_id
    WHERE i.quantity <> m.quantity AND i.product_id = '10000000-0000-4000-8000-000000000005'
  ) THEN
    RAISE EXCEPTION 'GRN receipt/movement discrepancy fixture was not detectable';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM inventory_movements WHERE stock_after <> stock_before + quantity)
     OR NOT EXISTS (
       SELECT 1 FROM (
         SELECT stock_before, LAG(stock_after) OVER (PARTITION BY product_id ORDER BY created_at, id) AS previous_after
         FROM inventory_movements WHERE product_id = '10000000-0000-4000-8000-000000000006'
       ) sequence_check WHERE previous_after IS NOT NULL AND stock_before <> previous_after
     ) THEN
    RAISE EXCEPTION 'Ledger arithmetic/sequence fixture was not detectable';
  END IF;

  RAISE NOTICE 'Inventory reconciliation diagnostic fixture checks passed; no balance was changed.';
END $$;

ROLLBACK;
