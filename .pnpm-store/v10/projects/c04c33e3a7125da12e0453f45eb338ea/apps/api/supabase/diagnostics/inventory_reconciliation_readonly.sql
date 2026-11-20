-- READ-ONLY INVENTORY DIAGNOSTICS
-- Run against an isolated staging clone or disposable local database only.
-- This file contains SELECT statements only; it does not repair or mutate inventory.

-- 1. Aggregate products compared with recorded batch balances.
WITH batch_totals AS (
  SELECT
    product_id,
    COALESCE(SUM(quantity_available), 0) AS batch_available_sum,
    COUNT(*) AS batch_count,
    COUNT(*) FILTER (WHERE quantity_available < 0) AS negative_batch_count,
    COALESCE(SUM(quantity_available) FILTER (WHERE status = 'QUARANTINED'), 0) AS quarantined_quantity,
    COALESCE(SUM(quantity_available) FILTER (WHERE status = 'EXPIRED'), 0) AS expired_status_quantity,
    COALESCE(SUM(quantity_available) FILTER (WHERE expiry_date < CURRENT_DATE), 0) AS expired_by_date_quantity,
    COALESCE(SUM(quantity_available) FILTER (WHERE expiry_date IS NULL), 0) AS undated_quantity
  FROM product_batches
  GROUP BY product_id
)
SELECT
  p.id AS product_id,
  p.name,
  p.stock_quantity AS product_stock_quantity,
  COALESCE(b.batch_available_sum, 0) AS batch_available_sum,
  p.stock_quantity - COALESCE(b.batch_available_sum, 0) AS product_minus_batches,
  COALESCE(b.batch_count, 0) AS batch_count,
  COALESCE(b.negative_batch_count, 0) AS negative_batch_count,
  COALESCE(b.quarantined_quantity, 0) AS quarantined_quantity,
  COALESCE(b.expired_status_quantity, 0) AS expired_status_quantity,
  COALESCE(b.expired_by_date_quantity, 0) AS expired_by_date_quantity,
  COALESCE(b.undated_quantity, 0) AS undated_quantity
FROM products p
LEFT JOIN batch_totals b ON b.product_id = p.id
ORDER BY
  (p.stock_quantity < 0 OR COALESCE(b.negative_batch_count, 0) > 0) DESC,
  (p.stock_quantity > 0 AND COALESCE(b.batch_count, 0) = 0) DESC,
  ABS(p.stock_quantity - COALESCE(b.batch_available_sum, 0)) DESC,
  p.name;

-- 1a. Explicit review flags. A positive aggregate with no batch row is missing batch
-- coverage; a positive difference with some batches is only an unallocated-stock candidate,
-- not proof of a legitimate opening balance.
WITH batch_totals AS (
  SELECT product_id, SUM(quantity_available) AS batch_available_sum, COUNT(*) AS batch_count
  FROM product_batches
  GROUP BY product_id
)
SELECT
  p.id AS product_id,
  p.name,
  p.stock_quantity,
  COALESCE(b.batch_available_sum, 0) AS batch_available_sum,
  CASE
    WHEN p.stock_quantity < 0 THEN 'NEGATIVE_PRODUCT_BALANCE'
    WHEN COALESCE(b.batch_count, 0) = 0 AND p.stock_quantity > 0 THEN 'POSITIVE_STOCK_WITH_NO_BATCH_ROWS'
    WHEN p.stock_quantity < COALESCE(b.batch_available_sum, 0) THEN 'BATCH_TOTAL_EXCEEDS_PRODUCT_TOTAL'
    WHEN p.stock_quantity > COALESCE(b.batch_available_sum, 0) THEN 'UNALLOCATED_STOCK_CANDIDATE_BASELINE_UNKNOWN'
    ELSE 'PRODUCT_AND_BATCH_TOTALS_MATCH'
  END AS reconciliation_flag
FROM products p
LEFT JOIN batch_totals b ON b.product_id = p.id
WHERE p.stock_quantity < 0
   OR (p.stock_quantity > 0 AND COALESCE(b.batch_count, 0) = 0)
   OR ABS(p.stock_quantity - COALESCE(b.batch_available_sum, 0)) > 0.000001
ORDER BY p.name;

-- 2. Batch evidence. A nonzero receipt/movement delta is not proof of an error unless the
-- opening quantity and complete history for that batch are independently established.
WITH receipt_totals AS (
  SELECT batch_id, SUM(quantity) AS receipt_item_quantity
  FROM stock_receipt_items
  WHERE batch_id IS NOT NULL
  GROUP BY batch_id
), movement_totals AS (
  SELECT batch_id, SUM(quantity) AS signed_movement_quantity, COUNT(*) AS movement_count
  FROM inventory_movements
  WHERE batch_id IS NOT NULL
  GROUP BY batch_id
)
SELECT
  b.product_id,
  b.id AS batch_id,
  b.batch_number,
  b.quantity_received,
  b.quantity_available,
  b.status,
  b.expiry_date,
  (b.expiry_date < CURRENT_DATE) AS expired_by_date,
  (b.status = 'QUARANTINED') AS quarantined,
  COALESCE(r.receipt_item_quantity, 0) AS receipt_item_quantity,
  b.quantity_received - COALESCE(r.receipt_item_quantity, 0) AS received_quantity_minus_receipt_lines,
  COALESCE(m.signed_movement_quantity, 0) AS signed_movement_quantity,
  COALESCE(m.movement_count, 0) AS movement_count,
  'Opening quantity/history completeness not inferred by this query' AS baseline_note
FROM product_batches b
LEFT JOIN receipt_totals r ON r.batch_id = b.id
LEFT JOIN movement_totals m ON m.batch_id = b.id
ORDER BY b.product_id, b.expiry_date NULLS LAST, b.batch_number;

-- 3. Movement arithmetic and product-level sequence continuity. Identical timestamps are
-- deterministically ordered by id for diagnosis; concurrent history may still need review.
WITH ordered AS (
  SELECT
    m.*,
    LAG(m.stock_after) OVER (PARTITION BY m.product_id ORDER BY m.created_at, m.id) AS previous_stock_after
  FROM inventory_movements m
)
SELECT
  id AS movement_id,
  product_id,
  batch_id,
  movement_type,
  quantity,
  stock_before,
  stock_after,
  created_at,
  CASE WHEN ABS(stock_after - (stock_before + quantity)) > 0.000001 THEN 'ARITHMETIC_MISMATCH' END AS arithmetic_issue,
  CASE WHEN previous_stock_after IS NOT NULL AND ABS(stock_before - previous_stock_after) > 0.000001 THEN 'SEQUENCE_GAP_OR_OVERLAP' END AS continuity_issue
FROM ordered
  WHERE ABS(stock_after - (stock_before + quantity)) > 0.000001
   OR (previous_stock_after IS NOT NULL AND ABS(stock_before - previous_stock_after) > 0.000001)
   OR stock_before < 0
   OR stock_after < 0
ORDER BY product_id, created_at, id;

-- 4. Latest recorded product movement balance compared with the live aggregate. This is a
-- diagnostic flag only: unlogged edits or incomplete history can explain the difference.
WITH latest AS (
  SELECT DISTINCT ON (product_id)
    product_id, id AS movement_id, movement_type, stock_after, created_at
  FROM inventory_movements
  ORDER BY product_id, created_at DESC, id DESC
)
SELECT
  p.id AS product_id,
  p.name,
  p.stock_quantity AS current_product_stock,
  l.stock_after AS latest_movement_stock_after,
  l.movement_id AS latest_movement_id,
  l.movement_type AS latest_movement_type,
  l.created_at AS latest_movement_at,
  p.stock_quantity - l.stock_after AS current_minus_latest_movement
FROM products p
JOIN latest l ON l.product_id = p.id
WHERE ABS(p.stock_quantity - l.stock_after) > 0.000001
ORDER BY p.name;

-- 5. GRN receipt lines compared with movements that carry the matching GRN reference.
-- Older rows without reference_type/reference_id cannot be safely matched here.
WITH receipt_lines AS (
  SELECT r.id AS receipt_id, r.receipt_number, i.batch_id, i.product_id, SUM(i.quantity) AS line_quantity
  FROM stock_receipts r
  JOIN stock_receipt_items i ON i.receipt_id = r.id
  GROUP BY r.id, r.receipt_number, i.batch_id, i.product_id
), grn_movements AS (
  SELECT reference_id::uuid AS receipt_id, product_id, batch_id, SUM(quantity) AS movement_quantity
  FROM inventory_movements
  WHERE movement_type = 'STOCK_RECEIVED'
    AND reference_type = 'GRN'
    AND reference_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  GROUP BY reference_id::uuid, product_id, batch_id
)
SELECT
  COALESCE(rl.receipt_id, gm.receipt_id) AS receipt_id,
  rl.receipt_number,
  COALESCE(rl.product_id, gm.product_id) AS product_id,
  COALESCE(rl.batch_id, gm.batch_id) AS batch_id,
  rl.line_quantity,
  gm.movement_quantity AS linked_movement_quantity,
  COALESCE(rl.line_quantity, 0) - COALESCE(gm.movement_quantity, 0) AS line_minus_movement,
  CASE
    WHEN rl.receipt_id IS NULL THEN 'GRN_MOVEMENT_WITHOUT_RECEIPT_LINE'
    WHEN gm.receipt_id IS NULL THEN 'RECEIPT_LINE_WITHOUT_LINKED_MOVEMENT'
    WHEN ABS(rl.line_quantity - gm.movement_quantity) > 0.000001 THEN 'GRN_QUANTITY_MISMATCH'
  END AS reconciliation_flag
FROM receipt_lines rl
FULL OUTER JOIN grn_movements gm
  ON gm.receipt_id = rl.receipt_id
 AND gm.product_id = rl.product_id
 AND gm.batch_id IS NOT DISTINCT FROM rl.batch_id
WHERE rl.receipt_id IS NULL
   OR gm.receipt_id IS NULL
   OR ABS(rl.line_quantity - gm.movement_quantity) > 0.000001
ORDER BY receipt_number NULLS LAST, product_id;

-- 6. Legacy dispensing is explicitly visible as product-level dispense movements without a
-- batch reference. This proves the write-path shape, not the true quantity on any batch.
SELECT
  product_id,
  COUNT(*) AS unbatched_dispense_movement_count,
  SUM(quantity) AS signed_unbatched_dispense_quantity,
  MIN(created_at) AS first_unbatched_dispense_at,
  MAX(created_at) AS latest_unbatched_dispense_at
FROM inventory_movements
WHERE movement_type = 'DISPENSE'
  AND batch_id IS NULL
GROUP BY product_id
ORDER BY product_id;
