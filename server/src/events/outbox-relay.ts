import {
  Injectable,
  Logger,
  type OnApplicationBootstrap,
  type OnApplicationShutdown,
} from '@nestjs/common';
import type { EventEnvelope } from '../domain/models.js';
import { EventBus, EventLog } from '../domain/ports.js';

const BATCH_SIZE = 100;
/** Fallback when a notification is missed; LISTEN/NOTIFY normally wakes the relay at once. */
const POLL_MS = 1000;
const LEADERSHIP_RETRY_MS = 3000;
const RETENTION_MS = 24 * 60 * 60 * 1000;
const PRUNE_EVERY_MS = 10 * 60 * 1000;

/**
 * Moves committed events from the outbox to the bus (Redis Pub/Sub). Exactly one
 * instance publishes at a time (leader lock), so subscribers get events in `seq` order.
 * Delivery is at-least-once: a crash after publishing but before marking may resend a
 * batch, which clients ignore thanks to `seq` and entity versions.
 */
@Injectable()
export class OutboxRelay implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger(OutboxRelay.name);
  private readonly timers: NodeJS.Timeout[] = [];
  private unsubscribe?: () => void;
  private draining = false;
  private again = false;
  private stopped = false;

  constructor(
    private readonly log: EventLog,
    private readonly bus: EventBus,
  ) {}

  onApplicationBootstrap(): void {
    void this.lead();
  }

  async onApplicationShutdown(): Promise<void> {
    this.stopped = true;
    this.timers.forEach((timer) => clearInterval(timer));
    this.unsubscribe?.();
  }

  /** Drains until the outbox is empty; concurrent wake-ups are coalesced. */
  async drain(): Promise<void> {
    if (this.draining) {
      this.again = true;
      return;
    }
    this.draining = true;
    try {
      do {
        this.again = false;
        while ((await this.log.publishPending((event) => this.publish(event), BATCH_SIZE)) > 0) {
          // keep going while full batches come back
        }
      } while (this.again && !this.stopped);
    } catch (error) {
      this.logger.warn(`Outbox publish failed, will retry: ${(error as Error).message}`);
    } finally {
      this.draining = false;
    }
  }

  private async lead(): Promise<void> {
    while (!this.stopped) {
      try {
        if (await this.log.tryLead()) break;
      } catch (error) {
        this.logger.warn(`Leadership check failed: ${(error as Error).message}`);
      }
      await new Promise((resolve) => setTimeout(resolve, LEADERSHIP_RETRY_MS));
    }
    if (this.stopped) return;
    this.unsubscribe = this.log.onAppended(() => void this.drain());
    this.timers.push(
      setInterval(() => void this.drain(), POLL_MS),
      setInterval(() => void this.prune(), PRUNE_EVERY_MS),
    );
    void this.drain();
  }

  private publish(event: EventEnvelope): Promise<void> {
    return this.bus.publish(event.topic, event);
  }

  private async prune(): Promise<void> {
    try {
      const removed = await this.log.prune(RETENTION_MS);
      if (removed) this.logger.log(`Pruned ${removed} published events`);
    } catch (error) {
      this.logger.warn(`Outbox prune failed: ${(error as Error).message}`);
    }
  }
}
