#!/usr/bin/env bash
# Two sessions try to take 10 units each from a product holding fewer than 20, at the same
# time. Row locking must let exactly one succeed; the other must fail cleanly, with no lost
# update and a balanced ledger. Runs after 10_migration_tests.sql on the same local database.
set -euo pipefail

PSQL="${PSQL:-psql}"
DB="${TEST_DB:-pharmacy_migration_test}"
P='aaaaaaaa-0000-4000-8000-000000000002'
U='bbbbbbbb-0000-4000-8000-000000000001'
q() { "$PSQL" -X -q -tA -v ON_ERROR_STOP=1 -d "$DB" "$@"; }

q -c "UPDATE products SET stock_quantity = 15 WHERE id = '$P'"

# Session A holds its lock for two seconds before committing.
q -c "BEGIN" \
  -c "SELECT adjust_stock('$P', NULL, 'ADJUSTMENT_OUT', 10, 'Session A', '$U')" \
  -c "SELECT pg_sleep(2)" \
  -c "COMMIT" >/dev/null 2>&1 &
A=$!
sleep 0.5
# Session B starts while A is still open and must wait for A's row lock.
if q -c "SELECT adjust_stock('$P', NULL, 'ADJUSTMENT_OUT', 10, 'Session B', '$U')" >/dev/null 2>"${TMPDIR:-/tmp}/b.err"; then
  B_RESULT=succeeded
else
  B_RESULT=failed
fi
wait $A

STOCK=$(q -c "SELECT stock_quantity FROM products WHERE id = '$P'")
ROWS=$(q -c "SELECT count(*) FROM inventory_movements WHERE product_id = '$P' AND reason IN ('Session A', 'Session B')")
BALANCED=$(q -c "SELECT bool_and(stock_after = stock_before + quantity) FROM inventory_movements WHERE product_id = '$P'")

echo "session B: $B_RESULT; final stock: $STOCK; ledger rows: $ROWS; ledger balanced: $BALANCED"
grep -q INSUFFICIENT_STOCK "${TMPDIR:-/tmp}/b.err" 2>/dev/null || grep -q "recorded in stock" "${TMPDIR:-/tmp}/b.err"
[ "$B_RESULT" = failed ] && [ "$STOCK" = 5 ] && [ "$ROWS" = 1 ] && [ "$BALANCED" = t ]
echo 'CONCURRENCY TEST PASSED'
