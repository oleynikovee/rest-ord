import {
  Inject,
  Injectable,
  Logger,
  type OnApplicationBootstrap,
  type OnApplicationShutdown,
} from '@nestjs/common';
import { APP_CONFIG, type AppConfig } from '../config.js';
import { OrdersRepository } from '../domain/ports.js';
import { OrdersService } from './orders.service.js';

/**
 * Stands in for the kitchen: periodically moves every unfinished order one
 * status forward so the Orders page has real-time updates to show.
 */
@Injectable()
export class OrderStatusSimulator
  implements OnApplicationBootstrap, OnApplicationShutdown
{
  private readonly logger = new Logger(OrderStatusSimulator.name);
  private timer?: NodeJS.Timeout;
  private running = false;

  constructor(
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    private readonly repository: OrdersRepository,
    private readonly orders: OrdersService,
  ) {}

  onApplicationBootstrap(): void {
    if (this.config.statusStepMs <= 0) return;
    const interval = Math.max(500, Math.min(2000, this.config.statusStepMs / 4));
    this.timer = setInterval(() => void this.tick(), interval);
  }

  onApplicationShutdown(): void {
    clearInterval(this.timer);
  }

  async tick(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      const advanced = await this.repository.advanceStale(this.config.statusStepMs);
      await Promise.all(advanced.map((order) => this.orders.publish(order)));
    } catch (error) {
      this.logger.warn(`Status update failed: ${(error as Error).message}`);
    } finally {
      this.running = false;
    }
  }
}
