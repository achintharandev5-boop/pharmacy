-- Migration: Complete Pharmacy Inventory Management System (V2)
-- Enables multi-batch FEFO tracking, supplier management, GRN stock receiving, manual stock adjustments, and expiry tracking.

-- 1. SUPPLIERS TABLE
CREATE TABLE IF NOT EXISTS suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  contact_person TEXT,
  phone TEXT,
  email TEXT,
  address TEXT,
  registration_number TEXT,
  notes TEXT,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_suppliers_name ON suppliers(name);
CREATE INDEX IF NOT EXISTS idx_suppliers_active ON suppliers(active);

-- 2. ENHANCE PRODUCTS TABLE WITH PHARMACY METADATA
ALTER TABLE products ADD COLUMN IF NOT EXISTS generic_name TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS brand_name TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS category TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS dosage_form TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS strength TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS sku TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS manufacturer TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS purchase_cost NUMERIC DEFAULT 0;
ALTER TABLE products ADD COLUMN IF NOT EXISTS reorder_level INTEGER DEFAULT 15;
ALTER TABLE products ADD COLUMN IF NOT EXISTS minimum_stock INTEGER DEFAULT 5;
ALTER TABLE products ADD COLUMN IF NOT EXISTS maximum_stock INTEGER DEFAULT 500;
ALTER TABLE products ADD COLUMN IF NOT EXISTS batch_tracking_enabled BOOLEAN DEFAULT TRUE;
ALTER TABLE products ADD COLUMN IF NOT EXISTS expiry_tracking_enabled BOOLEAN DEFAULT TRUE;
ALTER TABLE products ADD COLUMN IF NOT EXISTS rx_required BOOLEAN DEFAULT TRUE;
ALTER TABLE products ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;

CREATE INDEX IF NOT EXISTS idx_products_generic_name ON products(generic_name);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku);

-- 3. PRODUCT BATCHES TABLE (FEFO & MULTI-BATCH SUPPORT)
CREATE TABLE IF NOT EXISTS product_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  batch_number TEXT NOT NULL,
  supplier_id UUID REFERENCES suppliers(id) ON DELETE SET NULL,
  quantity_received NUMERIC NOT NULL CHECK (quantity_received >= 0),
  quantity_available NUMERIC NOT NULL CHECK (quantity_available >= 0),
  purchase_cost NUMERIC NOT NULL DEFAULT 0 CHECK (purchase_cost >= 0),
  retail_price NUMERIC CHECK (retail_price >= 0),
  manufactured_date DATE,
  expiry_date DATE,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID,
  status TEXT NOT NULL DEFAULT 'ACTIVE', -- ACTIVE, LOW_STOCK, EXPIRES_SOON, EXPIRED, DEPLETED, QUARANTINED
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_product_batch UNIQUE (product_id, batch_number)
);

CREATE INDEX IF NOT EXISTS idx_product_batches_product_id ON product_batches(product_id);
CREATE INDEX IF NOT EXISTS idx_product_batches_expiry_date ON product_batches(expiry_date ASC);
CREATE INDEX IF NOT EXISTS idx_product_batches_status ON product_batches(status);

-- 4. STOCK RECEIPTS & GOODS RECEIVED NOTE (GRN) TABLES
CREATE TABLE IF NOT EXISTS stock_receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  receipt_number TEXT UNIQUE NOT NULL, -- e.g. GRN-20261005-0001
  supplier_id UUID REFERENCES suppliers(id) ON DELETE SET NULL,
  invoice_number TEXT,
  grn_number TEXT,
  received_date DATE NOT NULL DEFAULT CURRENT_DATE,
  status TEXT NOT NULL DEFAULT 'COMPLETED', -- DRAFT, COMPLETED, CANCELLED
  total_cost NUMERIC NOT NULL DEFAULT 0,
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_stock_receipts_number ON stock_receipts(receipt_number);
CREATE INDEX IF NOT EXISTS idx_stock_receipts_supplier_id ON stock_receipts(supplier_id);

CREATE TABLE IF NOT EXISTS stock_receipt_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  receipt_id UUID NOT NULL REFERENCES stock_receipts(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  batch_id UUID REFERENCES product_batches(id) ON DELETE SET NULL,
  quantity NUMERIC NOT NULL CHECK (quantity > 0),
  unit_cost NUMERIC NOT NULL DEFAULT 0 CHECK (unit_cost >= 0),
  retail_price NUMERIC CHECK (retail_price >= 0),
  expiry_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_stock_receipt_items_receipt_id ON stock_receipt_items(receipt_id);
CREATE INDEX IF NOT EXISTS idx_stock_receipt_items_product_id ON stock_receipt_items(product_id);

-- 5. ENHANCE INVENTORY MOVEMENTS AUDIT LEDGER
ALTER TABLE inventory_movements ADD COLUMN IF NOT EXISTS batch_id UUID REFERENCES product_batches(id) ON DELETE SET NULL;
ALTER TABLE inventory_movements ADD COLUMN IF NOT EXISTS reference_type TEXT;
ALTER TABLE inventory_movements ADD COLUMN IF NOT EXISTS reference_id TEXT;
ALTER TABLE inventory_movements ADD COLUMN IF NOT EXISTS reason TEXT;

CREATE INDEX IF NOT EXISTS idx_inventory_movements_batch_id ON inventory_movements(batch_id);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_type ON inventory_movements(movement_type);
