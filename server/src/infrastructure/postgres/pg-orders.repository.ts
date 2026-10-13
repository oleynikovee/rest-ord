import { randomUUID } from 'node:crypto';
import type { PoolClient } from 'pg';
import {
  type CreateOrderResult,
  type NewOrder,
  type Order,
  type OrderLine,
  type OrderStatus,
  type PromoRedemption,
  TOPICS,
} from '../../domain/models.js';
import { type OrdersListQuery, OrdersRepository } from '../../domain/ports.js';
import type { PgDatabase } from './pg-database.js';
import { appendEvent } from './pg-event-log.js';
import type { PromoRow } from './pg-promo.repository.js';

interface OrderRow {
  promo_code: string | null;
  id: string;
  number: number;
  user_id: string | null;
  customer_name: string | null;
  lines: OrderLine[];
  subtotal: number;
  discount: number;
  total: number;
  status: OrderStatus;
  created_at: Date;
  updated_at: Date;
}

const toOrder = (row: OrderRow): Order => ({
  id: row.id,
  number: row.number,
  userId: row.user_id,
  customerName: row.customer_name ?? '',
  lines: row.lines,
  subtotal: row.subtotal,
  discount: row.discount,
  total: row.total,
  promoCode: row.promo_code,
  status: row.status,
  createdAt: row.created_at.toISOString(),
  updatedAt: row.updated_at.toISOString(),
});

export class PgOrdersRepository extends OrdersRepository {
  constructor(private readonly db: PgDatabase) {
    super();
  }

  async list({ limit, userId, before }: OrdersListQuery): Promise<Order[]> {
    const { rows } = await this.db.pool.query<OrderRow>(
      `SELECT * FROM orders
       WHERE ($2::uuid IS NULL OR user_id = $2::uuid)
         AND ($3::int IS NULL OR number < $3::int)
       ORDER BY number DESC LIMIT $1`,
      [limit, userId ?? null, before ?? null],
    );
    return rows.map(toOrder);
  }

  async findById(id: string): Promise<Order | null> {
    const { rows } = await this.db.pool.query<OrderRow>(
      'SELECT * FROM orders WHERE id = $1',
      [id],
    );
    return rows[0] ? toOrder(rows[0]) : null;
  }

  async findByIdempotencyKey(key: string): Promise<Order | null> {
    const { rows } = await this.db.pool.query<OrderRow>(
      'SELECT * FROM orders WHERE idempotency_key = $1',
      [key],
    );
    return rows[0] ? toOrder(rows[0]) : null;
  }

  async create(
    order: NewOrder,
    idempotencyKey: string,
    redemption?: PromoRedemption,
  ): Promise<CreateOrderResult> {
    const client = await this.db.pool.connect();
    try {
      await client.query('BEGIN');
      const inserted = await client.query<OrderRow>(
        `INSERT INTO orders
           (id, idempotency_key, user_id, customer_name, lines, subtotal, discount, total, promo_code, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'NEW')
         ON CONFLICT (idempotency_key) DO NOTHING
         RETURNING *`,
        [
          randomUUID(),
          idempotencyKey,
          order.userId,
          order.customerName,
          JSON.stringify(order.lines),
          order.subtotal,
          order.discount,
          order.total,
          order.promoCode,
        ],
      );
      const created = inserted.rows[0];
      if (!created) {
        await client.query('ROLLBACK');
        const existing = await this.findByIdempotencyKey(idempotencyKey);
        if (!existing) throw new Error('Order vanished after idempotency conflict');
        return { status: 'duplicate', order: existing };
      }

      if (redemption) {
        const outcome = await this.redeem(client, redemption, created.id);
        if (outcome !== 'ok') {
          await client.query('ROLLBACK');
          return { status: outcome === 'exhausted' ? 'promo_exhausted' : 'promo_already_used' };
        }
      }

      const stored = toOrder(created);
      await appendEvent(client, { topic: TOPICS.orders, event: { type: 'order.upserted', order: stored } });
      await client.query('COMMIT');
      return { status: 'created', order: stored };
    } catch (error) {
      await client.query('ROLLBACK').catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }

  private async redeem(
    client: PoolClient,
    { promoId, userId }: PromoRedemption,
    orderId: string,
  ): Promise<'ok' | 'exhausted' | 'already_used'> {
    const { rows } = await client.query<PromoRow>('SELECT * FROM promo_codes WHERE id = $1 FOR UPDATE', [promoId]);
    const promo = rows[0];
    if (!promo || (promo.usage_limit !== null && promo.used_count >= promo.usage_limit)) return 'exhausted';
    if (promo.per_user_limit !== null) {
      const used = await client.query<{ count: string }>(
        'SELECT count(*) FROM promo_redemptions WHERE promo_id = $1 AND user_id = $2',
        [promoId, userId],
      );
      if (Number(used.rows[0]?.count ?? 0) >= promo.per_user_limit) return 'already_used';
    }
    await client.query('UPDATE promo_codes SET used_count = used_count + 1 WHERE id = $1', [promoId]);
    await client.query(
      'INSERT INTO promo_redemptions (promo_id, user_id, order_id) VALUES ($1, $2, $3)',
      [promoId, userId, orderId],
    );
    return 'ok';
  }

  async advanceStale(olderThanMs: number): Promise<Order[]> {
    return this.db.transaction(async (client) => {
      const { rows } = await client.query<OrderRow>(
        `UPDATE orders
         SET status = CASE status
               WHEN 'NEW' THEN 'ACCEPTED'
               WHEN 'ACCEPTED' THEN 'COOKING'
               WHEN 'COOKING' THEN 'READY'
               WHEN 'READY' THEN 'COMPLETED'
             END,
             updated_at = now()
         WHERE status <> 'COMPLETED'
           AND updated_at < now() - make_interval(secs => $1::double precision / 1000)
         RETURNING *`,
        [olderThanMs],
      );
      const orders = rows.map(toOrder);
      for (const order of orders) {
        await appendEvent(client, { topic: TOPICS.orders, event: { type: 'order.upserted', order } });
      }
      return orders;
    });
  }

}
