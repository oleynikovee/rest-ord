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

  async close(): Promise<void> {
    await this.pool.end();
  }
}
