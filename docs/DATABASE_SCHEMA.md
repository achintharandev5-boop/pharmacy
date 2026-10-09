# Database Schema

Supabase PostgreSQL, schema `public`. This describes the schema **after** the four Phase 3 migrations (`2026101000xx`). Items marked *(new)* exist only once those are applied; see `DATABASE_MIGRATION_PLAN.md`. Diagram: `DATABASE_ERD.md`.

Existing tables were kept and extended rather than replaced, so the current application and data continue to work.

## Access model

- Browsers never query the database. The NestJS API is the only client and uses the service-role key.
- The API authenticates every request (Supabase Auth token) and enforces roles from `auth.users.app_metadata.role`: `admin`, `pharmacist`, `staff`.
- RLS is enabled on every table with no policies for `anon`/`authenticated` *(new)*, so the public REST endpoint returns nothing.
- Stock-changing operations run inside database functions that lock the rows they change.

## Domains

| Domain | Tables |
|---|---|
| Users and roles | `auth.users` (Supabase; role in `app_metadata`), `user_profiles` *(new)* |
| Audit | `audit_log` *(new)*, `prescription_events`, `inventory_movements` |
| Patients | `customers` |
| Medicines | `products` |
| Inventory | `product_batches`, `inventory_movements` |
| Suppliers and receiving | `suppliers`, `stock_receipts`, `stock_receipt_items` |
| Prescriptions and dispensing | `prescriptions`, `prescription_items`, `prescription_events` |
| Labels | `prescription_items` (one label per item; printed text in `final_instruction_text`), print history in `prescription_events` (`PRINTED`, `REPRINTED`), legacy `labels`, `label_sessions` |
| SMS | `sms_messages` *(new)*, `prescription_events` (`SMS_SENT`, `SMS_FAILED`) |
| Settings | `pharmacy_settings` *(new)* |
| Retries | `idempotency_keys` |

## Tables

Types abbreviated: `uuid`, `text`, `num` (numeric), `int`, `bool`, `date`, `ts` (timestamptz). **PK** primary key, **FK** foreign key, **U** unique, **NN** not null.

### customers (patients)
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| name | text NN | CHECK not blank *(new)* |
| phone_number | text NN | indexed; not unique (family members share phones) |
| age, gender, address, medical_notes | text | *(new columns; the app already writes them)* |
| allergy_status | text NN default `UNKNOWN` | *(new)* `UNKNOWN` · `NONE_KNOWN` · `HAS_ALLERGIES`. An empty field never means "no allergies" |
| allergies | text | *(new)* required when `HAS_ALLERGIES` |
| allergy_status_updated_at | ts | *(new)* |
| created_at, updated_at | ts NN | `updated_at` trigger *(new)* |

### products (medicines)
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| name | text NN | the name printed on labels |
| barcode | text U NN | |
| generic_name, brand_name, category, dosage_form, strength, sku, manufacturer | text | |
| pack_size | int | *(new)* > 0 |
| product_type, unit_of_measure | text | *(new)* |
| stock_quantity | int NN | **total units on hand**, kept equal to batch quantities plus any stock recorded before batch tracking. CHECK ≥ 0 *(new)* |
| expiry_date, batch_number | date / text | legacy single-batch fields from the first schema; batches supersede them |
| retail_price, purchase_cost | num | CHECK ≥ 0 *(new)* |
| reorder_level, minimum_stock, maximum_stock | int | low-stock thresholds. When both reorder level and minimum are null, the product is "no threshold", not "healthy" |
| batch_tracking_enabled, expiry_tracking_enabled, rx_required, is_active | bool | inactive products are excluded from search and cannot be dispensed |

Note: the V2 migration gave `reorder_level`/`minimum_stock`/`maximum_stock` defaults of 15/5/500. Those defaults were applied to every existing product when the columns were added; review them per product.

### product_batches
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| product_id | uuid FK → products, NN, ON DELETE RESTRICT | |
| batch_number | text NN | U (product_id, batch_number) |
| supplier_id | uuid FK → suppliers | |
| quantity_received, quantity_available | num NN | CHECK ≥ 0; available ≤ received *(new)* |
| purchase_cost, retail_price | num | |
| manufactured_date, expiry_date | date | the receiving function requires expiry |
| received_at | ts NN | FEFO tie-break |
| status | text NN | `ACTIVE` · `LOW_STOCK` · `EXPIRES_SOON` · `EXPIRED` · `DEPLETED` · `QUARANTINED` *(CHECK new)* |
| created_by | uuid | |

Index `idx_product_batches_fefo (product_id, expiry_date, received_at) WHERE quantity_available > 0` *(new)*.

### inventory_movements (stock ledger)
Append-only record of every stock change.

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| product_id | uuid FK → products NN, RESTRICT | |
| batch_id | uuid FK → product_batches | |
| prescription_id, prescription_item_id | uuid FK | dispensing only |
| movement_type | text NN | `DISPENSE` · `STOCK_RECEIVED` · `ADJUSTMENT_IN` · `ADJUSTMENT_OUT` · `EXPIRED` · `DAMAGED` · `RETURNED` (+ legacy names) *(CHECK new)* |
| quantity | num NN | signed; ≠ 0 *(new)* |
| stock_before, stock_after | num NN | product total; CHECK after = before + quantity *(new)* |
| reference_type, reference_id, reason | text | reason required for adjustments |
| created_by | uuid | the acting user |

### suppliers
`id` PK, `name` NN, `contact_person`, `phone`, `email`, `address`, `registration_number`, `notes`, `active` NN, timestamps.

### stock_receipts (goods received notes)
`id` PK, `receipt_number` U NN (`GRN-YYYYMMDD-nnnnn` from `grn_number_seq` unless supplied), `supplier_id` FK, `invoice_number`, `grn_number`, `received_date` NN, `status` (CHECK *(new)*), `total_cost`, `notes`, `created_by`, timestamps.

### stock_receipt_items
`id` PK, `receipt_id` FK → stock_receipts NN CASCADE, `product_id` FK NN RESTRICT, `batch_id` FK, `quantity` > 0, `unit_cost` ≥ 0, `retail_price`, `expiry_date`.

### prescriptions
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| prescription_number | text U NN | `RX-YYYYMMDD-nnnnnn` |
| customer_id | uuid FK → customers, ON DELETE SET NULL | null for walk-in patients |
| customer_name_text, customer_phone | text | snapshot at dispensing time |
| status | text NN | `DRAFT` · `COMPLETED` · `CANCELLED` *(CHECK new)* |
| created_by | uuid | dispensing user (recorded since Phase 1) |
| printed_at, print_count | ts / int | |
| created_at, updated_at, completed_at | ts | |

### prescription_items (one label each)
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| prescription_id | uuid FK NN CASCADE | |
| product_id | uuid FK → products, SET NULL | null for a manually named medicine (no stock deducted) |
| product_name_snapshot, alternative_product_name | text | |
| quantity | num NN | > 0 *(new)* |
| days | int | |
| morning_qty, lunch_qty, night_qty | num NN | ≥ 0 *(new)* |
| frequency_type, frequency_qty, stat_qty, stat_follow_up | | |
| expiry_date | date | only an unambiguous date (`YYYY-MM-DD`); the text actually printed is in `instructions_json.labelExpiryText` |
| show_address | bool NN | |
| instructions_json | jsonb NN | `instructions`, `reasons`, `selectedDaysOfWeek`, `labelExpiryText`, `stat` |
| final_instruction_text | text NN | the Sinhala instruction text exactly as printed (sent by the workstation since Phase 1) |

### prescription_events (dispensing, print and SMS history)
`id` PK, `prescription_id` FK NN CASCADE, `event_type` (`CREATED` · `PRINTED` · `REPRINTED` · `SMS_SENT` · `SMS_FAILED` · `CANCELLED`, CHECK *(new)*), `user_id`, `metadata` jsonb (reprint reason, SMS gateway reference), `created_at`.

### idempotency_keys
`key` text PK, `response_payload` jsonb NN, `created_at`. Keys are namespaced by operation (`rx:`, `grn:`, `adj:` in the database functions). The API reserves a key with `{"status":"PENDING"}` before writing a prescription.

### user_profiles *(new)*
`id` PK = FK → `auth.users` CASCADE, `full_name`, `registration_number`, `is_active`, timestamps. The role is **not** stored here; it lives in `app_metadata` so there is one source of truth.

### pharmacy_settings *(new)*
Single row (`id boolean PK CHECK (id)`): `pharmacy_name`, `address`, `phone` (all null until entered: nothing is invented), `timezone` (default `Asia/Colombo`), `label_width_mm`, `label_height_mm`, `printer_name`, `sms_enabled`, `sms_sender_id`, `low_stock_alerts_enabled`, `expiry_alert_days`, `updated_at`, `updated_by`.

### sms_messages *(new)*
`id` PK, `prescription_id` FK, `customer_id` FK, `recipient` (digits only), `message_length`, `status` (`QUEUED` · `SENT` · `DELIVERED` · `FAILED`), `provider`, `provider_reference`, `failure_reason` (required when FAILED), `attempt_count`, `idempotency_key` U, `sent_at`, `delivered_at`, `created_by`, `created_at`. `SENT` means the gateway accepted the message; only a delivery report sets `DELIVERED`. The message body is not stored.

### audit_log *(new)*
`id` bigserial PK, `occurred_at`, `actor_id`, `action` (INSERT/UPDATE/DELETE), `entity_type`, `entity_id`, `changed_fields text[]`. Written by triggers on `customers`, `products`, `suppliers`, `product_batches`, `pharmacy_settings`, `user_profiles`. It records which fields changed, never their values, so patient details are not duplicated.

### labels, label_sessions (legacy)
From the first schema. `GET /labels` still reads `labels`; the workstation saves prescriptions instead. Kept for existing data.

## Database functions *(new)*

| Function | Used by | Behaviour |
|---|---|---|
| `receive_stock(payload, user_id, idempotency_key)` | `POST /inventory/receipts` | One transaction: receipt, batch (create or top up), receipt line, product total, ledger row per line. Refuses expired stock and a batch number already recorded with a different expiry |
| `adjust_stock(product_id, batch_id, type, qty, reason, user_id, idempotency_key)` | `POST /inventory/adjustments` | Locks product and batch; refuses to go below zero (no silent clamping); reason and user required |
| `create_prescription(payload, user_id, idempotency_key)` | not yet (decision needed) | One transaction with FEFO batch allocation; never uses expired batches |
| `pharmacy_today()` | functions | the pharmacy's calendar date |

User-facing errors are raised as SQLSTATE `P0001` with a `HINT` code (`INSUFFICIENT_STOCK`, `EXPIRED_BATCH`, `BATCH_EXPIRY_MISMATCH`, `VALIDATION`, `NOT_FOUND`, …) that the API turns into 400/404/409.

## Not modelled (deliberately)

POS, sales, payments, invoicing and accounting are out of scope. `retail_price` and `purchase_cost` exist only for stock valuation.
