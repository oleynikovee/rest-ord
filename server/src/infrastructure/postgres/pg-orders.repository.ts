import { randomUUID } from 'node:crypto';
import type {
  NewOrder,
  Order,
  OrderLine,
  OrderStatus,
} from '../../domain/models.js';
import { OrdersRepository } from '../../domain/ports.js';
import type { PgDatabase } from './pg-database.js';

interface OrderRow {
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
  status: row.status,
  createdAt: row.created_at.toISOString(),
  updatedAt: row.updated_at.toISOString(),
});

export class PgOrdersRepository extends OrdersRepository {
  constructor(private readonly db: PgDatabase) {
    super();
  }

  async list(limit: number, userId?: string): Promise<Order[]> {
    const { rows } = await this.db.pool.query<OrderRow>(
      `SELECT * FROM orders
       WHERE $2::uuid IS NULL OR user_id = $2::uuid
       ORDER BY number DESC LIMIT $1`,
      [limit, userId ?? null],
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

  async create(order: NewOrder, idempotencyKey: string): Promise<Order> {
    // The unique constraint is the last line of defence against double orders,
    // even if the Redis lock was lost.
    const { rows } = await this.db.pool.query<OrderRow>(
      `INSERT INTO orders
         (id, idempotency_key, user_id, customer_name, lines, subtotal, discount, total, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'NEW')
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
      ],
    );
    if (rows[0]) return toOrder(rows[0]);
    const existing = await this.findByIdempotencyKey(idempotencyKey);
    if (!existing) throw new Error('Order vanished after idempotency conflict');
    return existing;
  }

  async advanceStale(olderThanMs: number): Promise<Order[]> {
    // A single atomic UPDATE: safe to run from several server instances at once.
    const { rows } = await this.db.pool.query<OrderRow>(
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
    return rows.map(toOrder);
  }
}
