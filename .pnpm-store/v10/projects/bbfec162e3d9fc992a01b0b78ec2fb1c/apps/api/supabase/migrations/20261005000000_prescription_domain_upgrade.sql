-- Migration: Prescription Domain Upgrade (V2)
-- Enables parent prescription tracking, atomic multi-item dispensing, inventory movement audit logs, and idempotency key locks.

-- 1. PRESCRIPTIONS TABLE
CREATE TABLE IF NOT EXISTS prescriptions (
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

CREATE INDEX IF NOT EXISTS idx_prescriptions_number ON prescriptions(prescription_number);
CREATE INDEX IF NOT EXISTS idx_prescriptions_customer_id ON prescriptions(customer_id);
CREATE INDEX IF NOT EXISTS idx_prescriptions_created_at ON prescriptions(created_at DESC);

-- 2. PRESCRIPTION ITEMS TABLE
CREATE TABLE IF NOT EXISTS prescription_items (
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

CREATE INDEX IF NOT EXISTS idx_prescription_items_prescription_id ON prescription_items(prescription_id);
CREATE INDEX IF NOT EXISTS idx_prescription_items_product_id ON prescription_items(product_id);

-- 3. INVENTORY MOVEMENTS AUDIT LOG TABLE
CREATE TABLE IF NOT EXISTS inventory_movements (
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

CREATE INDEX IF NOT EXISTS idx_inventory_movements_product_id ON inventory_movements(product_id);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_prescription_id ON inventory_movements(prescription_id);

-- 4. PRESCRIPTION EVENTS AUDIT LOG TABLE
CREATE TABLE IF NOT EXISTS prescription_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prescription_id UUID NOT NULL REFERENCES prescriptions(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL, -- CREATED, PRINTED, REPRINTED, SMS_SENT, SMS_FAILED, CANCELLED
  user_id UUID,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_prescription_events_prescription_id ON prescription_events(prescription_id);

-- 5. IDEMPOTENCY KEYS TABLE
CREATE TABLE IF NOT EXISTS idempotency_keys (
  key TEXT PRIMARY KEY,
  response_payload JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
