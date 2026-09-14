-- Ryvoki store database (Cloudflare D1 / SQLite).
-- Apply locally:   npm run db:local
-- Apply to prod:   npm run db:remote

CREATE TABLE IF NOT EXISTS orders (
  id            TEXT PRIMARY KEY,            -- public order id shown to the buyer, e.g. ORD-7K2M9QX4
  product       TEXT NOT NULL,               -- slug from public/data/projects.json
  email         TEXT,                        -- optional, for key recovery
  price_usd     REAL NOT NULL,
  status        TEXT NOT NULL DEFAULT 'pending', -- pending | paid | partial | failed | expired | refunded
  provider      TEXT NOT NULL,               -- nowpayments
  invoice_id    TEXT,                        -- provider invoice id
  payment_id    TEXT,                        -- provider payment id (set by webhook)
  pay_currency  TEXT,
  actually_paid REAL,
  license_id    INTEGER,
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  paid_at       TEXT
);

CREATE TABLE IF NOT EXISTS licenses (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  key             TEXT NOT NULL UNIQUE,      -- RYV-XXXXX-XXXXX-XXXXX-XXXXX
  product         TEXT NOT NULL,
  order_id        TEXT,                      -- NULL when issued manually
  status          TEXT NOT NULL DEFAULT 'active', -- active | revoked
  max_activations INTEGER NOT NULL DEFAULT 3,
  note            TEXT,
  created_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS activations (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  license_id  INTEGER NOT NULL REFERENCES licenses(id),
  machine_id  TEXT NOT NULL,
  app_version TEXT,
  first_seen  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  last_seen   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  UNIQUE (license_id, machine_id)
);

CREATE TABLE IF NOT EXISTS webhook_log (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  provider    TEXT NOT NULL,
  order_id    TEXT,
  status      TEXT,
  valid_sig   INTEGER NOT NULL DEFAULT 0,
  body        TEXT,
  received_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_email ON orders(email);
CREATE INDEX IF NOT EXISTS idx_licenses_product ON licenses(product);
