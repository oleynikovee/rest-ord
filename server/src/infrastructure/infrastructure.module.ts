import {
  type DynamicModule,
  Global,
  Inject,
  Injectable,
  Logger,
  Module,
  type OnApplicationShutdown,
  type OnModuleInit,
  type Provider,
} from '@nestjs/common';
import type { Redis } from 'ioredis';
import { APP_CONFIG, type AppConfig } from '../config.js';
import {
  EventBus,
  EventLog,
  IdempotencyStore,
  MenuRepository,
  OrdersRepository,
  PromoRepository,
  UsersRepository,
} from '../domain/ports.js';
import { MemoryEventBus } from './memory/memory-event-bus.js';
import { MemoryEventLog } from './memory/memory-event-log.js';
import { MemoryIdempotencyStore } from './memory/memory-idempotency.store.js';
import { MemoryMenuRepository } from './memory/memory-menu.repository.js';
import { MemoryOrdersRepository } from './memory/memory-orders.repository.js';
import { MemoryPromoRepository } from './memory/memory-promo.repository.js';
import { MemoryUsersRepository } from './memory/memory-users.repository.js';
import { PgDatabase } from './postgres/pg-database.js';
import { PgEventLog } from './postgres/pg-event-log.js';
import { PgMenuRepository } from './postgres/pg-menu.repository.js';
import { PgOrdersRepository } from './postgres/pg-orders.repository.js';
import { PgPromoRepository } from './postgres/pg-promo.repository.js';
import { PgUsersRepository } from './postgres/pg-users.repository.js';
import { createRedis } from './redis/redis-connection.js';
import { RedisEventBus } from './redis/redis-event-bus.js';
import { RedisIdempotencyStore } from './redis/redis-idempotency.store.js';
import { generateSeedMenu } from './seed.js';

const PG = Symbol('PG');
const REDIS = Symbol('REDIS');

interface RedisClients {
  main: Redis;
  subscriber: Redis;
}

/** Connects storage, seeds an empty menu and closes connections on shutdown. */
@Injectable()
class InfrastructureLifecycle implements OnModuleInit, OnApplicationShutdown {
  private readonly logger = new Logger('Infrastructure');

  constructor(
    @Inject(PG) private readonly pg: PgDatabase | null,
    @Inject(REDIS) private readonly redis: RedisClients | null,
    private readonly menu: MenuRepository,
    private readonly log: EventLog,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.pg?.init();
    this.logger.log(
      `Storage: ${this.pg ? 'PostgreSQL' : 'in-memory'}, events/idempotency: ${this.redis ? 'Redis' : 'in-process'}`,
    );
    if (await this.menu.isEmpty()) {
      await this.menu.seed(generateSeedMenu());
      this.logger.log('Seeded demo menu');
    }
  }

  async onApplicationShutdown(): Promise<void> {
    await this.log.close();
    await this.pg?.close();
    this.redis?.main.disconnect();
    this.redis?.subscriber.disconnect();
  }
}

@Global()
@Module({})
export class InfrastructureModule {
  static forRoot(config: AppConfig): DynamicModule {
    const providers: Provider[] = [
      { provide: APP_CONFIG, useValue: config },
      {
        provide: PG,
        useFactory: () =>
          config.databaseUrl ? new PgDatabase(config.databaseUrl) : null,
      },
      {
        provide: REDIS,
        useFactory: (): RedisClients | null =>
          config.redisUrl
            ? {
                main: createRedis(config.redisUrl, 'main'),
                subscriber: createRedis(config.redisUrl, 'subscriber'),
              }
            : null,
      },
      {
        provide: EventLog,
        inject: [PG],
        useFactory: (pg: PgDatabase | null) => (pg ? new PgEventLog(pg) : new MemoryEventLog()),
      },
      {
        provide: MenuRepository,
        inject: [PG, EventLog],
        useFactory: (pg: PgDatabase | null, log: EventLog) =>
          pg ? new PgMenuRepository(pg) : new MemoryMenuRepository(log as MemoryEventLog),
      },
      {
        provide: PromoRepository,
        inject: [PG],
        useFactory: (pg: PgDatabase | null) =>
          pg ? new PgPromoRepository(pg) : new MemoryPromoRepository(),
      },
      {
        provide: OrdersRepository,
        inject: [PG, PromoRepository, EventLog],
        // In memory, redemption shares the promo store; in Postgres it is a transaction.
        useFactory: (pg: PgDatabase | null, promos: PromoRepository, log: EventLog) =>
          pg
            ? new PgOrdersRepository(pg)
            : new MemoryOrdersRepository(promos as MemoryPromoRepository, log as MemoryEventLog),
      },
      {
        provide: UsersRepository,
        inject: [PG],
        useFactory: (pg: PgDatabase | null) =>
          pg ? new PgUsersRepository(pg) : new MemoryUsersRepository(),
      },
      {
        provide: IdempotencyStore,
        inject: [REDIS],
        useFactory: (redis: RedisClients | null) =>
          redis ? new RedisIdempotencyStore(redis.main) : new MemoryIdempotencyStore(),
      },
      {
        provide: EventBus,
        inject: [REDIS],
        useFactory: (redis: RedisClients | null) =>
          redis
            ? new RedisEventBus(redis.main, redis.subscriber)
            : new MemoryEventBus(),
      },
      InfrastructureLifecycle,
    ];

    return {
      module: InfrastructureModule,
      providers,
      exports: [
        APP_CONFIG,
        MenuRepository,
        OrdersRepository,
        PromoRepository,
        UsersRepository,
        IdempotencyStore,
        EventBus,
        EventLog,
      ],
    };
  }
}
