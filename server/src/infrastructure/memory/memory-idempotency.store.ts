import {
  IdempotencyStore,
  type IdempotencyState,
} from '../../domain/ports.js';

const TTL_MS = 24 * 60 * 60 * 1000;
const PENDING = '__pending__';

/** Single-process equivalent of Redis `SET key value NX EX ttl`. */
export class MemoryIdempotencyStore extends IdempotencyStore {
  private readonly entries = new Map<string, { value: string; expiresAt: number }>();

  async acquire(key: string): Promise<IdempotencyState> {
    const entry = this.entries.get(key);
    if (entry && entry.expiresAt > Date.now()) {
      return entry.value === PENDING
        ? { kind: 'in_progress' }
        : { kind: 'completed', orderId: entry.value };
    }
    this.entries.set(key, { value: PENDING, expiresAt: Date.now() + TTL_MS });
    return { kind: 'acquired' };
  }

  async complete(key: string, orderId: string): Promise<void> {
    this.entries.set(key, { value: orderId, expiresAt: Date.now() + TTL_MS });
  }

  async release(key: string): Promise<void> {
    this.entries.delete(key);
  }
}
