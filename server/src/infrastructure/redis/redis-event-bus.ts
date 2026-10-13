import { Logger } from '@nestjs/common';
import type { Redis } from 'ioredis';
import { EventBus } from '../../domain/ports.js';

export class RedisEventBus extends EventBus {
  private readonly logger = new Logger(RedisEventBus.name);
  private readonly handlers = new Map<string, Set<(payload: unknown) => void>>();

  constructor(
    private readonly publisher: Redis,
    private readonly subscriber: Redis,
  ) {
    super();
    this.subscriber.on('message', (topic: string, message: string) => {
      const handlers = this.handlers.get(topic);
      if (!handlers) return;
      let payload: unknown;
      try {
        payload = JSON.parse(message);
      } catch {
        this.logger.warn(`Dropped malformed message on ${topic}`);
        return;
      }
      handlers.forEach((handler) => handler(payload));
    });
  }

  async publish<T>(topic: string, payload: T): Promise<void> {
    await this.publisher.publish(topic, JSON.stringify(payload));
  }

  subscribe<T>(topic: string, handler: (payload: T) => void): () => void {
    let handlers = this.handlers.get(topic);
    if (!handlers) {
      handlers = new Set();
      this.handlers.set(topic, handlers);
      void this.subscriber.subscribe(topic);
    }
    const untyped = handler as (payload: unknown) => void;
    handlers.add(untyped);
    return () => handlers.delete(untyped);
  }
}
