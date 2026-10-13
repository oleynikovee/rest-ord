import {
  Injectable,
  Logger,
  type OnApplicationBootstrap,
  type OnApplicationShutdown,
} from '@nestjs/common';
import type { EventEnvelope } from '../domain/models.js';
import { EventBus, EventLog } from '../domain/ports.js';
import { MetricsService } from '../observability/metrics.service.js';

const BATCH_SIZE = 100;
const POLL_MS = 1000;
const LEADERSHIP_RETRY_MS = 3000;
const RETENTION_MS = 24 * 60 * 60 * 1000;
const PRUNE_EVERY_MS = 10 * 60 * 1000;

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
    private readonly metrics: MetricsService,
  ) {}

  onApplicationBootstrap(): void {
    void this.lead();
  }

  async onApplicationShutdown(): Promise<void> {
    this.stopped = true;
    this.timers.forEach((timer) => clearInterval(timer));
    this.unsubscribe?.();
  }

  async drain(): Promise<void> {
    if (this.draining) {
      this.again = true;
      return;
    }
    this.draining = true;
    try {
      do {
        this.again = false;
        let published: number;
        do {
          published = await this.log.publishPending((event) => this.publish(event), BATCH_SIZE);
        } while (published > 0);
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

  private async publish(event: EventEnvelope): Promise<void> {
    await this.bus.publish(event.topic, event);
    this.metrics.eventsPublished.inc();
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
