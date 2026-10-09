# Pharmacy System V2 Upgrade — Architectural Implementation Plan

**Author:** Senior Pharmacy Software Architect & Lead Backend Engineer  
**Date:** October 5, 2026  
**Target Core:** Production-Grade Pharmacy Dispensing, Prescription Domain Engine & Label System  

---

## 1. Current Architecture Overview

The system currently operates as a Next.js 15 App Router frontend paired with a NestJS 11 backend using Supabase (PostgreSQL).

```
Next.js Frontend (Zustand Store) ──► Server Actions ──► NestJS API ──► Supabase PostgreSQL
```

### Key Technical Gaps Being Fixed
1. **No Prescription Hierarchy:** Labels are processed as independent records in a loop. There is no parent `prescription` or `prescription_item` relational entity.
2. **Non-Atomic Persistence:** The frontend loops through labels and sends multiple `POST /labels` HTTP calls. If item #2 fails, item #1 is already committed, leaving partial state.
3. **No Stock Deduction:** `products.stock_quantity` is read but never decremented during dispensing. No inventory movements log exists.
4. **No Stock Concurrency Locking:** Concurrent users can dispense the same stock below 0.
5. **Client-Side ID & Numbering:** Prescriptions lack formal prescription numbers (`RX-YYYYMMDD-XXXXXX`).
6. **Hardcoded Fallback Masking:** Catch blocks in backend services return sample data silently when DB operations fail, masking outages in production.
7. **Unprotected API Routes:** NestJS API endpoints lack JWT guards and role authorization.
8. **Lack of Idempotency:** Double-clicking "SAVE" or network retries create duplicate database records and deduct stock multiple times.
9. **Draft Loss on Refresh:** Refreshing the browser clears all unpersisted labels from Zustand memory.

---

## 2. Target System Architecture

```
[ Next.js 15 Pharmacy UI ]
           │
           │ Idempotency-Key Header + Single Payload
           ▼
[ Typed Server Action / API Client ]
           │
           │ Bearer JWT Cookie
           ▼
[ NestJS JwtAuthGuard & RolesGuard ]
           │
           ▼
[ PrescriptionsController (POST /prescriptions) ]
           │
           ▼
[ PrescriptionDomainService ]
  ├── Domain Validation (Dosage, Admin, Meal Timing, Rules)
  └── Stock Availability & Expiry Checks
           │
           ▼
[ PostgreSQL Transaction (BEGIN ... COMMIT) ]
  ├── Lock Product Stock (FOR UPDATE / RPC)
  ├── Insert `prescriptions` Record (Auto-generate RX Number)
  ├── Insert `prescription_items` Records
  ├── Deduct `products.stock_quantity`
  ├── Insert `inventory_movements` Audit Log
  └── Insert `prescription_events` Audit Log
```

---

## 3. Proposed Database Schema

### Supabase Migration Script: `20261005000000_prescription_domain_upgrade.sql`

```sql
-- 1. Prescriptions Table
CREATE TABLE prescriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prescription_number TEXT UNIQUE NOT NULL,
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  customer_name_text TEXT NOT NULL,
  customer_phone TEXT,
  status TEXT NOT NULL DEFAULT 'COMPLETED', -- DRAFT, COMPLETED, CANCELLED
  created_by UUID,
  printed_at TIMESTAMPTZ,
  print_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_prescriptions_number ON prescriptions(prescription_number);
CREATE INDEX idx_prescriptions_customer_id ON prescriptions(customer_id);
CREATE INDEX idx_prescriptions_created_at ON prescriptions(created_at DESC);

-- 2. Prescription Items Table
CREATE TABLE prescription_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prescription_id UUID NOT NULL REFERENCES prescriptions(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  product_name_snapshot TEXT NOT NULL,
  alternative_product_name TEXT,
  quantity NUMERIC NOT NULL DEFAULT 1,
  days INTEGER,

  morning_qty NUMERIC NOT NULL DEFAULT 0,
  lunch_qty NUMERIC NOT NULL DEFAULT 0,
  night_qty NUMERIC NOT NULL DEFAULT 0,

  frequency_type TEXT,
  frequency_qty NUMERIC,

  stat_qty NUMERIC,
  stat_follow_up TEXT,

  expiry_date DATE,
  show_address BOOLEAN NOT NULL DEFAULT TRUE,

  instructions_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  final_instruction_text TEXT NOT NULL,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_prescription_items_prescription_id ON prescription_items(prescription_id);
CREATE INDEX idx_prescription_items_product_id ON prescription_items(product_id);

-- 3. Inventory Movements Table
CREATE TABLE inventory_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  prescription_id UUID REFERENCES prescriptions(id) ON DELETE SET NULL,
  prescription_item_id UUID REFERENCES prescription_items(id) ON DELETE SET NULL,
  movement_type TEXT NOT NULL, -- DISPENSE, ADJUSTMENT, RESTOCK, RETURN
  quantity NUMERIC NOT NULL,
  stock_before NUMERIC NOT NULL,
  stock_after NUMERIC NOT NULL,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_inventory_movements_product_id ON inventory_movements(product_id);
CREATE INDEX idx_inventory_movements_prescription_id ON inventory_movements(prescription_id);

-- 4. Prescription Audit Events Table
CREATE TABLE prescription_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prescription_id UUID NOT NULL REFERENCES prescriptions(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL, -- CREATED, PRINTED, REPRINTED, SMS_SENT, SMS_FAILED, CANCELLED
  user_id UUID,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_prescription_events_prescription_id ON prescription_events(prescription_id);

-- 5. Idempotency Keys Table
CREATE TABLE idempotency_keys (
  key TEXT PRIMARY KEY,
  response_payload JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

---

## 4. API Endpoints & Request/Response Specification

### `POST /prescriptions`
- **Headers:** `Authorization: Bearer <JWT>`, `Idempotency-Key: <UUID>`
- **Request Body:**
```json
{
  "customerId": "11111111-1111-1111-1111-111111111111",
  "customerName": "John Doe",
  "customerPhone": "0771234567",
  "items": [
    {
      "productId": "a1111111-1111-1111-1111-111111111111",
      "alternativeProductName": "Panadol Extra",
      "quantity": 20,
      "days": 5,
      "dosage": { "morning": 1, "lunch": 0.5, "night": 1 },
      "frequency": null,
      "stat": null,
      "expiryDate": "2027-12-31",
      "instructions": ["TAKE", "AFTER", "WITH FOOD"],
      "reasons": ["වේදනාව ඇති විට පමණක් ගන්න"],
      "selectedDaysOfWeek": ["MONDAY", "WEDNESDAY"],
      "showAddress": true
    }
  ]
}
```
- **Response (201 Created):**
```json
{
  "id": "uuid",
  "prescriptionNumber": "RX-20261005-000001",
  "status": "COMPLETED",
  "customerName": "John Doe",
  "customerPhone": "94771234567",
  "itemCount": 1,
  "createdAt": "2026-10-05T00:24:00Z"
}
```

### `POST /prescriptions/:id/print`
- Logs `PRINTED` or `REPRINTED` event in `prescription_events`, increments `print_count`.

### `POST /prescriptions/:id/sms`
- Dispatches SMS via Text.lk API using server credentials, logs `SMS_SENT` or `SMS_FAILED` in `prescription_events`.

---

## 5. Affected & New Files Inventory

### New Files to Create:
1. `apps/api/supabase/migrations/20261005000000_prescription_domain_upgrade.sql`
2. `apps/api/src/domain/prescription/prescription.rules.ts`
3. `apps/api/src/domain/prescription/instruction.rules.ts`
4. `apps/api/src/domain/prescription/dosage.rules.ts`
5. `apps/api/src/prescriptions/dto/create-prescription.dto.ts`
6. `apps/api/src/prescriptions/prescriptions.module.ts`
7. `apps/api/src/prescriptions/prescriptions.controller.ts`
8. `apps/api/src/prescriptions/prescriptions.service.ts`
9. `apps/api/src/prescriptions/prescriptions.service.spec.ts`
10. `apps/web/app/actions/prescriptions.ts`

### Existing Files to Modify:
1. `apps/api/src/app.module.ts` (Register `PrescriptionsModule`)
2. `apps/api/src/products/products.service.ts` (Remove silent production fallbacks)
3. `apps/api/src/customers/customers.service.ts` (Remove silent production fallbacks)
4. `apps/api/src/labels/labels.service.ts` (Remove silent production fallbacks)
5. `apps/web/store/labelStore.ts` (Add draft persistence via `sessionStorage` & updated handlers)
6. `apps/web/app/label/page.tsx` (Connect to single atomic `createPrescriptionRecord` action)
7. `apps/web/components/label/LabelActionPage.tsx` (Connect to `POST /prescriptions`, handle print/SMS endpoints)
8. `apps/web/app/actions/labels.ts` (Legacy support)
9. `apps/web/app/actions/sms.ts` (Secure server-side execution)

---

## 6. Migration & Backwards Compatibility Strategy

- Legacy `labels` database table is preserved.
- Old `/labels` endpoint remains available for reading past label records.
- New prescriptions use the formal `prescriptions` + `prescription_items` relational schema.

---

## 7. Security & Error Handling Upgrades

- **JWT Guard Enforced:** `JwtAuthGuard` applied across NestJS endpoints.
- **Production Error Masking Removed:** In `NODE_ENV === 'production'`, database failures return explicit HTTP errors (`503 Service Unavailable` / `409 Conflict`) instead of fake hardcoded success objects.
- **Idempotency Guard:** `Idempotency-Key` header prevents duplicate submissions.
- **Stock Lock:** PostgreSQL transaction with explicit locking prevents concurrent over-dispensing.

---

## 8. Implementation Sequence & Execution Order

- **PHASE 1:** Database Migration (`20261005000000_prescription_domain_upgrade.sql`).
- **PHASE 2:** Backend Domain Rules, DTOs & Validation Engine.
- **PHASE 3:** NestJS Prescriptions Controller, Service & Transaction Logic.
- **PHASE 4:** Error Handling, Security Guards & Production Fallback Removal.
- **PHASE 5:** Frontend Server Actions & Draft Session Storage Persistence.
- **PHASE 6:** Frontend UI & Action Page Integration.
- **PHASE 7:** Automated Unit, Integration & Concurrency Testing.
