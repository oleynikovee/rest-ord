import { createServer, type Server } from 'node:http';
import {
  Inject,
  Injectable,
  Logger,
  type OnApplicationBootstrap,
  type OnApplicationShutdown,
} from '@nestjs/common';
import { APP_CONFIG, type AppConfig } from '../config.js';
import { EventLog } from '../domain/ports.js';
import { MetricsService } from './metrics.service.js';

/** `/metrics` on an internal port that only Prometheus (backend network) can reach. */
@Injectable()
export class MetricsServer implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger(MetricsServer.name);
  private server?: Server;

  constructor(
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    private readonly metrics: MetricsService,
    private readonly log: EventLog,
  ) {}

  onApplicationBootstrap(): void {
    if (!this.config.metricsPort) return;
    this.server = createServer((request, response) => {
      if (request.url !== '/metrics') {
        response.writeHead(404).end();
        return;
      }
      void this.render()
        .then((body) => response.writeHead(200, { 'Content-Type': this.metrics.registry.contentType }).end(body))
        .catch((error: Error) => response.writeHead(500).end(error.message));
    });
    this.server.listen(this.config.metricsPort, () =>
      this.logger.log(`Metrics on :${this.config.metricsPort}/metrics`),
    );
  }

  onApplicationShutdown(): void {
    this.server?.close();
  }

  private async render(): Promise<string> {
    // Outbox health is read at scrape time, so it is fresh and costs nothing in between.
    const { pending, oldestAgeSeconds } = await this.log.pendingStats();
    this.metrics.outboxPending.set(pending);
    this.metrics.outboxOldestPendingAge.set(oldestAgeSeconds);
    return this.metrics.registry.metrics();
  }
}
