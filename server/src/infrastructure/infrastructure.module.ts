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
  IdempotencyStore,
  MenuRepository,
  OrdersRepository,
} from '../domain/ports.js';
import { MemoryEventBus } from './memory/memory-event-bus.js';
import { MemoryIdempotencyStore } from './memory/memory-idempotency.store.js';
import { MemoryMenuRepository } from './memory/memory-menu.repository.js';
import { MemoryOrdersRepository } from './memory/memory-orders.repository.js';
import { PgDatabase } from './postgres/pg-database.js';
import { PgMenuRepository } from './postgres/pg-menu.repository.js';
import { PgOrdersRepository } from './postgres/pg-orders.repository.js';
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
        provide: MenuRepository,
        inject: [PG],
        useFactory: (pg: PgDatabase | null) =>
          pg ? new PgMenuRepository(pg) : new MemoryMenuRepository(),
      },
      {
        provide: OrdersRepository,
        inject: [PG],
        useFactory: (pg: PgDatabase | null) =>
          pg ? new PgOrdersRepository(pg) : new MemoryOrdersRepository(),
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
      exports: [APP_CONFIG, MenuRepository, OrdersRepository, IdempotencyStore, EventBus],
    };
  }
}
