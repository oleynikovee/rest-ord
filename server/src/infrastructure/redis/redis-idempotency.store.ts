import type { Redis } from 'ioredis';
import {
  IdempotencyStore,
  type IdempotencyState,
} from '../../domain/ports.js';

const TTL_SECONDS = 24 * 60 * 60;
const PENDING = '__pending__';
const keyOf = (key: string): string => `idempotency:order:${key}`;

/**
 * `SET NX` gives an atomic lock across all API instances: only the first request
 * with a given key proceeds, duplicates either wait-and-retry or get the stored result.
 */
export class RedisIdempotencyStore extends IdempotencyStore {
  constructor(private readonly redis: Redis) {
    super();
  }

  async acquire(key: string): Promise<IdempotencyState> {
    const ok = await this.redis.set(keyOf(key), PENDING, 'EX', TTL_SECONDS, 'NX');
    if (ok === 'OK') return { kind: 'acquired' };

    const value = await this.redis.get(keyOf(key));
    if (value === null) return this.acquire(key); // expired in between
    return value === PENDING
      ? { kind: 'in_progress' }
      : { kind: 'completed', orderId: value };
  }

  async complete(key: string, orderId: string): Promise<void> {
    await this.redis.set(keyOf(key), orderId, 'EX', TTL_SECONDS);
  }

  async release(key: string): Promise<void> {
    await this.redis.del(keyOf(key));
  }
}
