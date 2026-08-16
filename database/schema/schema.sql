-- Iya Femi Restaurant Digital Platform - PostgreSQL schema

CREATE TABLE IF NOT EXISTS admins (
  id            SERIAL PRIMARY KEY,
  name          VARCHAR(120) NOT NULL,
  email         VARCHAR(160) NOT NULL UNIQUE,
  password_hash VARCHAR(200) NOT NULL,
  role          VARCHAR(30)  NOT NULL DEFAULT 'admin',
  active        BOOLEAN      NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS categories (
  id            SERIAL PRIMARY KEY,
  name          VARCHAR(80)  NOT NULL UNIQUE,
  slug          VARCHAR(80)  NOT NULL UNIQUE,
  display_order INTEGER      NOT NULL DEFAULT 0,
  active        BOOLEAN      NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS menu_items (
  id           SERIAL PRIMARY KEY,
  category_id  INTEGER      NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
  name         VARCHAR(140) NOT NULL,
  description  TEXT         NOT NULL DEFAULT '',
  ingredients  TEXT         NOT NULL DEFAULT '',
  portion_info VARCHAR(140) NOT NULL DEFAULT '',
  price        NUMERIC(12,2) NOT NULL CHECK (price >= 0),
  image_url    VARCHAR(300) NOT NULL DEFAULT '',
  available    BOOLEAN      NOT NULL DEFAULT TRUE,
  featured     BOOLEAN      NOT NULL DEFAULT FALSE,
  archived     BOOLEAN      NOT NULL DEFAULT FALSE,
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_menu_items_category ON menu_items(category_id);
CREATE INDEX IF NOT EXISTS idx_menu_items_available ON menu_items(available) WHERE NOT archived;

CREATE TABLE IF NOT EXISTS delivery_zones (
  id     SERIAL PRIMARY KEY,
  name   VARCHAR(120) NOT NULL,
  areas  TEXT         NOT NULL DEFAULT '',
  fee    NUMERIC(12,2) NOT NULL CHECK (fee >= 0),
  active BOOLEAN      NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS orders (
  id                    SERIAL PRIMARY KEY,
  order_number          VARCHAR(20)  NOT NULL UNIQUE,
  customer_name         VARCHAR(140) NOT NULL,
  phone                 VARCHAR(30)  NOT NULL,
  email                 VARCHAR(160) NOT NULL DEFAULT '',
  order_type            VARCHAR(20)  NOT NULL CHECK (order_type IN ('delivery','pickup','dine_in')),
  delivery_address      TEXT         NOT NULL DEFAULT '',
  delivery_instructions TEXT         NOT NULL DEFAULT '',
  delivery_zone_id      INTEGER      REFERENCES delivery_zones(id) ON DELETE SET NULL,
  delivery_fee          NUMERIC(12,2) NOT NULL DEFAULT 0,
  subtotal              NUMERIC(12,2) NOT NULL,
  discount              NUMERIC(12,2) NOT NULL DEFAULT 0,
  total                 NUMERIC(12,2) NOT NULL,
  notes                 TEXT         NOT NULL DEFAULT '',
  status                VARCHAR(30)  NOT NULL DEFAULT 'received',
  payment_method        VARCHAR(30)  NOT NULL CHECK (payment_method IN ('bank_transfer','cash')),
  payment_status        VARCHAR(20)  NOT NULL DEFAULT 'pending' CHECK (payment_status IN ('pending','paid','failed','refunded')),
  created_at            TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created ON orders(created_at);

CREATE TABLE IF NOT EXISTS order_items (
  id           SERIAL PRIMARY KEY,
  order_id     INTEGER      NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  menu_item_id INTEGER      REFERENCES menu_items(id) ON DELETE SET NULL,
  item_name    VARCHAR(140) NOT NULL,
  unit_price   NUMERIC(12,2) NOT NULL,
  quantity     INTEGER      NOT NULL CHECK (quantity > 0),
  line_total   NUMERIC(12,2) NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);

CREATE TABLE IF NOT EXISTS order_status_history (
  id         SERIAL PRIMARY KEY,
  order_id   INTEGER     NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  status     VARCHAR(30) NOT NULL,
  changed_by VARCHAR(120) NOT NULL DEFAULT 'system',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS payments (
  id         SERIAL PRIMARY KEY,
  order_id   INTEGER      NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  method     VARCHAR(30)  NOT NULL,
  amount     NUMERIC(12,2) NOT NULL,
  reference  VARCHAR(120) NOT NULL UNIQUE,
  status     VARCHAR(20)  NOT NULL DEFAULT 'verified',
  created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS reviews (
  id            SERIAL PRIMARY KEY,
  order_id      INTEGER      REFERENCES orders(id) ON DELETE SET NULL,
  customer_name VARCHAR(140) NOT NULL,
  rating        INTEGER      NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment       TEXT         NOT NULL DEFAULT '',
  approved      BOOLEAN      NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS settings (
  key   VARCHAR(80) PRIMARY KEY,
  value TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS audit_log (
  id         SERIAL PRIMARY KEY,
  admin_id   INTEGER     REFERENCES admins(id) ON DELETE SET NULL,
  action     VARCHAR(80) NOT NULL,
  details    TEXT        NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
