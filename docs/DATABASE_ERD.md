# Database ERD

Entity-relationship diagram of the schema after the Phase 3 migrations. Tables marked `(new)` are created by `20261010000200`. Column lists show keys and the fields that matter for relationships; see `DATABASE_SCHEMA.md` for every column.

```mermaid
erDiagram
    AUTH_USERS ||--o| USER_PROFILES : "has (new)"
    CUSTOMERS ||--o{ PRESCRIPTIONS : "receives"
    PRESCRIPTIONS ||--|{ PRESCRIPTION_ITEMS : "has labels"
    PRESCRIPTIONS ||--o{ PRESCRIPTION_EVENTS : "history"
    PRODUCTS ||--o{ PRESCRIPTION_ITEMS : "dispensed as"
    PRODUCTS ||--o{ PRODUCT_BATCHES : "stocked in"
    SUPPLIERS ||--o{ PRODUCT_BATCHES : "supplied"
    SUPPLIERS ||--o{ STOCK_RECEIPTS : "delivers"
    STOCK_RECEIPTS ||--|{ STOCK_RECEIPT_ITEMS : "lines"
    PRODUCTS ||--o{ STOCK_RECEIPT_ITEMS : "received"
    PRODUCT_BATCHES ||--o{ STOCK_RECEIPT_ITEMS : "received into"
    PRODUCTS ||--o{ INVENTORY_MOVEMENTS : "ledger"
    PRODUCT_BATCHES ||--o{ INVENTORY_MOVEMENTS : "ledger"
    PRESCRIPTIONS ||--o{ INVENTORY_MOVEMENTS : "dispensing"
    PRESCRIPTION_ITEMS ||--o{ INVENTORY_MOVEMENTS : "dispensing"
    PRESCRIPTIONS ||--o{ SMS_MESSAGES : "notified (new)"
    CUSTOMERS ||--o{ SMS_MESSAGES : "notified (new)"
    CUSTOMERS ||--o{ LABELS : "legacy"
    PRODUCTS ||--o{ LABELS : "legacy"

    AUTH_USERS {
        uuid id PK
        text email
        jsonb app_metadata "role: admin | pharmacist | staff"
    }
    USER_PROFILES {
        uuid id PK "FK auth.users"
        text full_name
        bool is_active
    }
    CUSTOMERS {
        uuid id PK
        text name
        text phone_number
        text allergy_status "UNKNOWN | NONE_KNOWN | HAS_ALLERGIES"
        text allergies
    }
    PRODUCTS {
        uuid id PK
        text name
        text barcode UK
        int stock_quantity "total on hand, >= 0"
        int reorder_level
        bool is_active
    }
    PRODUCT_BATCHES {
        uuid id PK
        uuid product_id FK
        uuid supplier_id FK
        text batch_number "UK with product_id"
        num quantity_available
        date expiry_date
        text status
    }
    SUPPLIERS {
        uuid id PK
        text name
        bool active
    }
    STOCK_RECEIPTS {
        uuid id PK
        text receipt_number UK
        uuid supplier_id FK
        uuid created_by
    }
    STOCK_RECEIPT_ITEMS {
        uuid id PK
        uuid receipt_id FK
        uuid product_id FK
        uuid batch_id FK
        num quantity
    }
    PRESCRIPTIONS {
        uuid id PK
        text prescription_number UK
        uuid customer_id FK "null = walk-in"
        text status
        uuid created_by
    }
    PRESCRIPTION_ITEMS {
        uuid id PK
        uuid prescription_id FK
        uuid product_id FK "null = manual medicine"
        num quantity
        text final_instruction_text "as printed"
    }
    PRESCRIPTION_EVENTS {
        uuid id PK
        uuid prescription_id FK
        text event_type "CREATED PRINTED REPRINTED SMS_*"
        uuid user_id
    }
    INVENTORY_MOVEMENTS {
        uuid id PK
        uuid product_id FK
        uuid batch_id FK
        uuid prescription_id FK
        text movement_type
        num quantity "signed"
        num stock_before
        num stock_after
        uuid created_by
    }
    SMS_MESSAGES {
        uuid id PK
        uuid prescription_id FK
        uuid customer_id FK
        text status "QUEUED SENT DELIVERED FAILED"
        text provider_reference
    }
    LABELS {
        uuid id PK
        uuid customer_id FK
        uuid product_id FK
    }
```

Standalone tables (no foreign keys): `idempotency_keys`, `audit_log` (references rows by type and id text so history survives deletion), `pharmacy_settings` (single row; `updated_by` → `auth.users`), `label_sessions` (legacy).

## Delete behaviour

| Parent deleted | Effect on children |
|---|---|
| customer | prescriptions, labels, SMS keep their rows; `customer_id` set to null (name snapshot kept) |
| product | **blocked** while batches, receipt lines or ledger rows reference it (RESTRICT); prescription items keep their name snapshot |
| prescription | items and events deleted (CASCADE); ledger rows keep their history with `prescription_id` set to null |
| supplier | batches and receipts keep their rows; `supplier_id` set to null |
| stock receipt | its lines deleted (CASCADE) |
| auth user | profile deleted (CASCADE); `created_by` columns keep the id |

The application never deletes products, prescriptions, batches or receipts. Only an administrator can delete a patient record.
