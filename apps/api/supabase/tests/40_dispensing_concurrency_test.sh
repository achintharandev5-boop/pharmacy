#!/usr/bin/env bash
# Concurrency checks for create_prescription (migration 000500). LOCAL TEST DATABASE ONLY.
#   1. Two requests with the same idempotency key at the same moment: one prescription, and
#      both callers receive the same result.
#   2. Two different prescriptions competing for the last units of a batch: exactly one
#      succeeds; stock never goes negative and the ledger balances.
set -euo pipefail

PSQL="${PSQL:-psql}"
DB="${TEST_DB:-pharmacy_migration_test}"
U='bbbbbbbb-0000-4000-8000-000000000001'
P='ffffffff-0000-4000-8000-000000000001'
OUT="${TMPDIR:-/tmp}"
q() { "$PSQL" -X -q -tA -v ON_ERROR_STOP=1 -d "$DB" "$@"; }

q -c "INSERT INTO products (id, name, barcode, stock_quantity) VALUES ('$P', 'Concurrency Capsule', 'C-1', 10)"
q -c "INSERT INTO product_batches (product_id, batch_number, quantity_received, quantity_available, expiry_date) VALUES ('$P', 'C-A', 10, 10, '2099-01-01')"

RX="SELECT create_prescription('{\"customer_name\":\"Concurrent Test\",\"items\":[{\"product_id\":\"$P\",\"quantity\":3,\"final_instruction_text\":\"t\"}]}', '$U', 'same-key-1')->>'id'"

# 1. Same key: A holds its transaction open; B must wait and then get A's result.
q -c "BEGIN" -c "$RX" -c "SELECT pg_sleep(2)" -c "COMMIT" > "$OUT/rx_a.out" 2>&1 &
A=$!
sleep 0.5
q -c "$RX" > "$OUT/rx_b.out"
wait $A
ID_A=$(grep -E '^[0-9a-f-]{36}$' "$OUT/rx_a.out" | head -1)
ID_B=$(grep -E '^[0-9a-f-]{36}$' "$OUT/rx_b.out" | head -1)
COUNT=$(q -c "SELECT count(*) FROM prescriptions WHERE customer_name_text = 'Concurrent Test'")
STOCK=$(q -c "SELECT stock_quantity FROM products WHERE id = '$P'")
echo "same key: A=$ID_A B=$ID_B prescriptions=$COUNT stock=$STOCK"
[ -n "$ID_A" ] && [ "$ID_A" = "$ID_B" ] && [ "$COUNT" = 1 ] && [ "$STOCK" = 7 ]

# 2. Different requests for 5 units each with 7 left: exactly one may succeed.
RX2="SELECT create_prescription('{\"customer_name\":\"Race Test\",\"items\":[{\"product_id\":\"$P\",\"quantity\":5,\"final_instruction_text\":\"t\"}]}', '$U')->>'id'"
q -c "BEGIN" -c "$RX2" -c "SELECT pg_sleep(2)" -c "COMMIT" >/dev/null 2>&1 &
A=$!
sleep 0.5
if q -c "$RX2" >/dev/null 2>"$OUT/rx_race.err"; then B_RESULT=succeeded; else B_RESULT=failed; fi
wait $A
STOCK=$(q -c "SELECT stock_quantity FROM products WHERE id = '$P'")
BATCH=$(q -c "SELECT quantity_available FROM product_batches WHERE product_id = '$P'")
BALANCED=$(q -c "SELECT bool_and(stock_after = stock_before + quantity) FROM inventory_movements WHERE product_id = '$P'")
echo "race: second request $B_RESULT; stock=$STOCK batch=$BATCH ledger balanced=$BALANCED"
grep -q INSUFFICIENT_STOCK "$OUT/rx_race.err" || grep -q "dispensable stock\|Insufficient stock" "$OUT/rx_race.err"
[ "$B_RESULT" = failed ] && [ "$STOCK" = 2 ] && [ "$BATCH" = 2 ] && [ "$BALANCED" = t ]

echo 'DISPENSING CONCURRENCY TEST PASSED'
