import { randomUUID } from 'node:crypto';
import {
  type CreateOrderResult,
  type NewOrder,
  nextStatus,
  type Order,
  type PromoRedemption,
  TOPICS,
} from '../../domain/models.js';
import { type OrdersListQuery, OrdersRepository } from '../../domain/ports.js';
import type { MemoryEventLog } from './memory-event-log.js';
import type { MemoryPromoRepository } from './memory-promo.repository.js';

export class MemoryOrdersRepository extends OrdersRepository {
  constructor(
    private readonly promos: MemoryPromoRepository,
    private readonly log: MemoryEventLog,
  ) {
    super();
  }

  private readonly orders = new Map<string, Order>();
  private readonly byKey = new Map<string, string>();
  private sequence = 0;

  async list({ limit, userId, before }: OrdersListQuery): Promise<Order[]> {
    return [...this.orders.values()]
      .filter((order) => userId === undefined || order.userId === userId)
      .filter((order) => before === undefined || order.number < before)
      .sort((a, b) => b.number - a.number)
      .slice(0, limit)
      .map(clone);
  }

  async findById(id: string): Promise<Order | null> {
    const order = this.orders.get(id);
    return order ? clone(order) : null;
  }

  async findByIdempotencyKey(key: string): Promise<Order | null> {
    const id = this.byKey.get(key);
    return id ? this.findById(id) : null;
  }

  async create(
    input: NewOrder,
    idempotencyKey: string,
    redemption?: PromoRedemption,
  ): Promise<CreateOrderResult> {
    const existingId = this.byKey.get(idempotencyKey);
    if (existingId) return { status: 'duplicate', order: clone(this.orders.get(existingId)!) };
    if (redemption) {
      const result = this.promos.redeem(redemption);
      if (result === 'exhausted') return { status: 'promo_exhausted' };
      if (result === 'already_used') return { status: 'promo_already_used' };
    }

    const now = new Date().toISOString();
    const order: Order = {
      ...clone(input as Order),
      id: randomUUID(),
      number: ++this.sequence,
      status: 'NEW',
      createdAt: now,
      updatedAt: now,
    };
    this.orders.set(order.id, order);
    this.byKey.set(idempotencyKey, order.id);
    this.log.append({ topic: TOPICS.orders, event: { type: 'order.upserted', order: clone(order) } });
    return { status: 'created', order: clone(order) };
  }

  async advanceStale(olderThanMs: number): Promise<Order[]> {
    const threshold = Date.now() - olderThanMs;
    const advanced: Order[] = [];
    for (const order of this.orders.values()) {
      const status = nextStatus(order.status);
      if (!status || Date.parse(order.updatedAt) > threshold) continue;
      order.status = status;
      order.updatedAt = new Date().toISOString();
      this.log.append({ topic: TOPICS.orders, event: { type: 'order.upserted', order: clone(order) } });
      advanced.push(clone(order));
    }
    return advanced;
  }
}

function clone<T>(value: T): T {
  return structuredClone(value);
}
