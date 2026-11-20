-- Enable moddatetime extension if you want auto-updating updated_at trigger, but here we just add standard columns.

CREATE TABLE customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_number text NOT NULL,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_customers_phone_number ON customers (phone_number);

CREATE TABLE products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  barcode text UNIQUE NOT NULL,
  retail_price numeric NOT NULL DEFAULT 0,
  stock_quantity integer NOT NULL DEFAULT 0,
  expiry_date date NOT NULL,
  batch_number text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_products_barcode ON products (barcode);

/*
  instructions_json shape:
  {
    "morning": { "qty": number, "isFraction": boolean },
    "lunch": { "qty": number, "isFraction": boolean },
    "night": { "qty": number, "isFraction": boolean },
    "stat": { "qty": number, "isFraction": boolean, "followUp": "8H" | "6H" | null },
    "additional": string[]
  }
*/
CREATE TABLE labels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid REFERENCES customers(id) ON DELETE SET NULL,
  customer_name_text text NOT NULL,
  product_id uuid REFERENCES products(id) ON DELETE SET NULL,
  alternative_product_name text,
  days integer,
  instructions_json jsonb NOT NULL,
  printed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE label_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  current_state text NOT NULL,
  payload_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

