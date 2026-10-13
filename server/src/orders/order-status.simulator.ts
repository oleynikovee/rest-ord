import {
  Inject,
  Injectable,
  Logger,
  type OnApplicationBootstrap,
  type OnApplicationShutdown,
} from '@nestjs/common';
import { APP_CONFIG, type AppConfig } from '../config.js';
import { OrdersRepository } from '../domain/ports.js';

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
      await this.repository.advanceStale(this.config.statusStepMs);
    } catch (error) {
      this.logger.warn(`Status update failed: ${(error as Error).message}`);
    } finally {
      this.running = false;
    }
  }
}
