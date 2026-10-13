import { Logger } from '@nestjs/common';
import pg from 'pg';

const SCHEMA = `
CREATE TABLE IF NOT EXISTS categories (
  id uuid PRIMARY KEY,
  name text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  version integer NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS menu_items (
  id uuid PRIMARY KEY,
  category_id uuid NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  price integer CHECK (price >= 0),
  available boolean NOT NULL DEFAULT true,
  open_price boolean NOT NULL DEFAULT false,
  version integer NOT NULL DEFAULT 1,
  CHECK (open_price OR price IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS menu_items_category_idx ON menu_items (category_id);

CREATE TABLE IF NOT EXISTS orders (
  id uuid PRIMARY KEY,
  number serial UNIQUE,
  idempotency_key text NOT NULL UNIQUE,
  lines jsonb NOT NULL,
  subtotal integer NOT NULL,
  discount integer NOT NULL,
  total integer NOT NULL,
  status text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS orders_active_idx ON orders (updated_at) WHERE status <> 'COMPLETED';

CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY,
  email text NOT NULL UNIQUE,
  name text NOT NULL,
  role text NOT NULL CHECK (role IN ('admin', 'customer')),
  password_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Added with authentication; nullable so databases created earlier keep working.
ALTER TABLE orders ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES users(id);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_name text;
CREATE INDEX IF NOT EXISTS orders_user_idx ON orders (user_id, number DESC);

CREATE TABLE IF NOT EXISTS promo_codes (
  id uuid PRIMARY KEY,
  code text NOT NULL UNIQUE,
  description text NOT NULL DEFAULT '',
  kind text NOT NULL CHECK (kind IN ('FIXED', 'PERCENT')),
  value integer NOT NULL CHECK (value > 0),
  min_order_amount integer NOT NULL DEFAULT 0 CHECK (min_order_amount >= 0),
  max_discount integer CHECK (max_discount >= 0),
  usage_limit integer CHECK (usage_limit > 0),
  per_user_limit integer CHECK (per_user_limit > 0),
  used_count integer NOT NULL DEFAULT 0,
  starts_at timestamptz,
  expires_at timestamptz,
  active boolean NOT NULL DEFAULT true,
  version integer NOT NULL DEFAULT 1,
  CHECK (kind <> 'PERCENT' OR value <= 100),
  CHECK (usage_limit IS NULL OR used_count <= usage_limit)
);

CREATE TABLE IF NOT EXISTS promo_redemptions (
  promo_id uuid NOT NULL REFERENCES promo_codes(id),
  user_id uuid NOT NULL REFERENCES users(id),
  order_id uuid NOT NULL UNIQUE REFERENCES orders(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS promo_redemptions_user_idx ON promo_redemptions (promo_id, user_id);

ALTER TABLE orders ADD COLUMN IF NOT EXISTS promo_code text;

-- Transactional outbox: events are written with the change they describe.
CREATE TABLE IF NOT EXISTS outbox (
  seq bigserial PRIMARY KEY,
  topic text NOT NULL,
  payload jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  published_at timestamptz
);
CREATE INDEX IF NOT EXISTS outbox_pending_idx ON outbox (seq) WHERE published_at IS NULL;
`;

/** Arbitrary constant for pg_advisory_lock so concurrent instances migrate one at a time. */
const MIGRATION_LOCK_ID = 42_001;

export class PgDatabase {
  private readonly logger = new Logger(PgDatabase.name);
  readonly pool: pg.Pool;

  constructor(connectionString: string) {
    this.pool = new pg.Pool({ connectionString, max: 10 });
    // An idle client losing its connection must not crash the process.
    this.pool.on('error', (error) =>
      this.logger.error(`Idle client error: ${error.message}`),
    );
  }

  /** Waits for the database (it may still be starting in Docker) and applies the schema. */
  async init(attempts = 15): Promise<void> {
    for (let attempt = 1; ; attempt++) {
      try {
        const client = await this.pool.connect();
        try {
          await client.query('SELECT pg_advisory_lock($1)', [MIGRATION_LOCK_ID]);
          await client.query(SCHEMA);
          await client.query('SELECT pg_advisory_unlock($1)', [MIGRATION_LOCK_ID]);
        } finally {
          client.release();
        }
        this.logger.log('Connected, schema is up to date');
        return;
      } catch (error) {
        if (attempt >= attempts) throw error;
        this.logger.warn(
          `Database not ready (attempt ${attempt}/${attempts}): ${(error as Error).message}`,
        );
        await new Promise((resolve) => setTimeout(resolve, 1000 * Math.min(attempt, 5)));
      }
    }
  }

  /** Runs `work` in a transaction on one connection; rolls back if it throws. */
  async transaction<T>(work: (client: pg.PoolClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await work(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK').catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}
