BEGIN;

-- Update users
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'ACTIVE',
ADD COLUMN IF NOT EXISTS fcm_token TEXT,
ADD COLUMN IF NOT EXISTS apns_token TEXT;

UPDATE users SET status = 'PENDING' 
WHERE role = 'SUPERMARKET' AND (latitude IS NULL OR longitude IS NULL);

CREATE INDEX IF NOT EXISTS idx_users_location ON users(latitude, longitude);
CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);

-- Update products - remove stock
ALTER TABLE products 
DROP COLUMN IF EXISTS in_stock,
DROP COLUMN IF EXISTS stock_count,
ADD COLUMN IF NOT EXISTS is_global BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS global_product_id UUID,
ADD COLUMN IF NOT EXISTS image TEXT;

CREATE INDEX IF NOT EXISTS idx_products_global ON products(is_global);
DROP INDEX IF EXISTS idx_products_stock;

-- Create global_products
CREATE TABLE IF NOT EXISTS global_products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  image TEXT,
  category_id UUID REFERENCES categories(id),
  brand VARCHAR(100),
  weight VARCHAR(50),
  nutritional_info JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Threads: ensure sellerId exists (camelCase) to match current entity and queries
ALTER TABLE threads ADD COLUMN IF NOT EXISTS "sellerId" UUID;
-- Backfill sellerId from marketplace_items.ownerId when possible
UPDATE threads t
SET "sellerId" = mi."ownerId"
FROM marketplace_items mi
WHERE t."itemId" = mi.id AND t."sellerId" IS NULL;

COMMIT;