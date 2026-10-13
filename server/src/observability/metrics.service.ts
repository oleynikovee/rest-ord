import { Injectable } from '@nestjs/common';
import { Counter, collectDefaultMetrics, Gauge, Histogram, Registry } from 'prom-client';

/**
 * Prometheus metrics: process defaults, HTTP RED metrics and business counters.
 * Served on a separate internal port (see MetricsServer), never on the public API.
 */
@Injectable()
export class MetricsService {
  readonly registry = new Registry();

  readonly httpDuration = new Histogram({
    name: 'http_server_request_duration_seconds',
    help: 'HTTP request duration by route and status.',
    labelNames: ['method', 'route', 'status'] as const,
    buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
    registers: [this.registry],
  });

  readonly ordersPlaced = new Counter({
    name: 'orders_placed_total',
    help: 'Orders created (replays of an idempotency key are not counted).',
    labelNames: ['promo'] as const,
    registers: [this.registry],
  });

  readonly orderRevenue = new Counter({
    name: 'orders_revenue_cents_total',
    help: 'Sum of order totals in cents.',
    registers: [this.registry],
  });

  readonly checkoutRejections = new Counter({
    name: 'checkout_rejections_total',
    help: 'Checkouts refused, by reason code (MENU_CHANGED, PROMO_*, ...).',
    labelNames: ['reason'] as const,
    registers: [this.registry],
  });

  readonly versionConflicts = new Counter({
    name: 'menu_version_conflicts_total',
    help: 'Admin edits refused because someone else changed the entity first.',
    registers: [this.registry],
  });

  readonly logins = new Counter({
    name: 'auth_logins_total',
    help: 'Sign-in attempts by result.',
    labelNames: ['result'] as const,
    registers: [this.registry],
  });

  readonly eventsPublished = new Counter({
    name: 'outbox_events_published_total',
    help: 'Events moved from the outbox to the bus.',
    registers: [this.registry],
  });

  readonly outboxPending = new Gauge({
    name: 'outbox_pending_events',
    help: 'Committed events not yet published.',
    registers: [this.registry],
  });

  readonly outboxOldestPendingAge = new Gauge({
    name: 'outbox_oldest_pending_age_seconds',
    help: 'Age of the oldest unpublished event; grows when the relay is stuck.',
    registers: [this.registry],
  });

  readonly socketConnections = new Gauge({
    name: 'websocket_connections',
    help: 'Open Socket.IO connections on this instance.',
    registers: [this.registry],
  });

  constructor() {
    collectDefaultMetrics({ register: this.registry });
  }
}
