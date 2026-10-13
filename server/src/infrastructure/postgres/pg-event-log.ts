import { Logger } from '@nestjs/common';
import type pg from 'pg';
import type { EventEnvelope, LoggedEvent } from '../../domain/models.js';
import { EventLog } from '../../domain/ports.js';
import type { PgDatabase } from './pg-database.js';

/** Serialises outbox appends so `seq` order equals commit order (no "holes" a reader could skip). */
const APPEND_LOCK_ID = 42_002;
/** Held by the single instance that publishes the outbox. */
const RELAY_LOCK_ID = 42_003;
const CHANNEL = 'outbox_appended';

interface OutboxRow {
  seq: string;
  topic: EventEnvelope['topic'];
  payload: EventEnvelope['event'];
}

const toEnvelope = (row: OutboxRow): EventEnvelope =>
  ({ seq: Number(row.seq), topic: row.topic, event: row.payload }) as EventEnvelope;

/**
 * Writes the event inside the caller's transaction. The advisory lock is taken at the
 * end of the transaction's work and released by COMMIT/ROLLBACK, which keeps it short.
 */
export async function appendEvent(client: pg.PoolClient, event: LoggedEvent): Promise<void> {
  await client.query('SELECT pg_advisory_xact_lock($1)', [APPEND_LOCK_ID]);
  await client.query('INSERT INTO outbox (topic, payload) VALUES ($1, $2)', [
    event.topic,
    JSON.stringify(event.event),
  ]);
  await client.query(`SELECT pg_notify('${CHANNEL}', '')`);
}

export class PgEventLog extends EventLog {
  private readonly logger = new Logger(PgEventLog.name);
  /** Dedicated connection: holds the relay lock and LISTENs for new events. */
  private leaderClient: pg.PoolClient | null = null;
  private readonly listeners = new Set<() => void>();

  constructor(private readonly db: PgDatabase) {
    super();
  }

  async latestSeq(): Promise<number> {
    const { rows } = await this.db.pool.query<{ seq: string | null }>('SELECT max(seq) AS seq FROM outbox');
    return Number(rows[0]?.seq ?? 0);
  }

  async readAfter(
    after: number,
    limit: number,
  ): Promise<{ events: EventEnvelope[]; oldestSeq: number | null }> {
    const [events, oldest] = await Promise.all([
      this.db.pool.query<OutboxRow>(
        'SELECT seq, topic, payload FROM outbox WHERE seq > $1 ORDER BY seq LIMIT $2',
        [after, limit],
      ),
      this.db.pool.query<{ seq: string | null }>('SELECT min(seq) AS seq FROM outbox'),
    ]);
    const oldestSeq = oldest.rows[0]?.seq;
    return { events: events.rows.map(toEnvelope), oldestSeq: oldestSeq ? Number(oldestSeq) : null };
  }

  async publishPending(
    publish: (event: EventEnvelope) => Promise<void>,
    batchSize: number,
  ): Promise<number> {
    return this.db.transaction(async (client) => {
      const { rows } = await client.query<OutboxRow>(
        `SELECT seq, topic, payload FROM outbox
         WHERE published_at IS NULL ORDER BY seq LIMIT $1 FOR UPDATE`,
        [batchSize],
      );
      for (const row of rows) await publish(toEnvelope(row));
      if (rows.length) {
        await client.query('UPDATE outbox SET published_at = now() WHERE seq = ANY($1::bigint[])', [
          rows.map((r) => r.seq),
        ]);
      }
      return rows.length;
    });
  }

  async tryLead(): Promise<boolean> {
    if (this.leaderClient) return true;
    const client = await this.db.pool.connect();
    try {
      const { rows } = await client.query<{ locked: boolean }>(
        'SELECT pg_try_advisory_lock($1) AS locked',
        [RELAY_LOCK_ID],
      );
      if (!rows[0]?.locked) {
        client.release();
        return false;
      }
      // If this connection dies, Postgres releases the lock and another instance takes over.
      client.on('error', (error) => {
        this.logger.warn(`Relay connection lost: ${error.message}`);
        this.leaderClient = null;
      });
      client.on('notification', () => this.listeners.forEach((listener) => listener()));
      await client.query(`LISTEN ${CHANNEL}`);
      this.leaderClient = client;
      this.logger.log('This instance publishes the outbox');
      return true;
    } catch (error) {
      client.release();
      throw error;
    }
  }

  onAppended(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  async pendingStats(): Promise<{ pending: number; oldestAgeSeconds: number }> {
    const { rows } = await this.db.pool.query<{ pending: string; age: number | null }>(
      `SELECT count(*) AS pending, extract(epoch FROM now() - min(created_at))::float AS age
       FROM outbox WHERE published_at IS NULL`,
    );
    return { pending: Number(rows[0]?.pending ?? 0), oldestAgeSeconds: rows[0]?.age ?? 0 };
  }

  async prune(olderThanMs: number): Promise<number> {
    const { rowCount } = await this.db.pool.query(
      `DELETE FROM outbox
       WHERE published_at IS NOT NULL
         AND created_at < now() - make_interval(secs => $1::double precision / 1000)`,
      [olderThanMs],
    );
    return rowCount ?? 0;
  }

  async close(): Promise<void> {
    this.listeners.clear();
    if (!this.leaderClient) return;
    await this.leaderClient.query('SELECT pg_advisory_unlock($1)', [RELAY_LOCK_ID]).catch(() => undefined);
    this.leaderClient.release();
    this.leaderClient = null;
  }
}
