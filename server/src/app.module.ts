import { type DynamicModule, Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ServeStaticModule } from '@nestjs/serve-static';
import { SentryGlobalFilter, SentryModule } from '@sentry/nestjs/setup';
import { LoggerModule } from 'nestjs-pino';
import { ThrottlerGuard, ThrottlerModule, type ThrottlerStorage } from '@nestjs/throttler';
import { AuthModule } from './auth/auth.module.js';
import type { AppConfig } from './config.js';
import { EventsModule } from './events/events.module.js';
import { ConfigController } from './health/config.controller.js';
import { HealthController } from './health/health.controller.js';
import { InfrastructureModule, RATE_LIMIT_STORAGE } from './infrastructure/infrastructure.module.js';
import { MenuModule } from './menu/menu.module.js';
import { loggingParams } from './observability/logging.js';
import { ObservabilityModule } from './observability/observability.module.js';
import { OrdersModule } from './orders/orders.module.js';
import { RealtimeGateway } from './realtime/realtime.gateway.js';

@Module({})
export class AppModule {
  static forRoot(config: AppConfig): DynamicModule {
    return {
      module: AppModule,
      imports: [
        SentryModule.forRoot(),
        LoggerModule.forRoot(loggingParams()),
        InfrastructureModule.forRoot(config),
        ObservabilityModule,
        ThrottlerModule.forRootAsync({
          inject: [RATE_LIMIT_STORAGE],
          useFactory: (storage: ThrottlerStorage | null) => ({
            throttlers: [{ name: 'default', ttl: 60_000, limit: 300 }],
            storage: storage ?? undefined,
          }),
        }),
        AuthModule,
        MenuModule,
        OrdersModule,
        EventsModule,
        ...(config.clientDist
          ? [
              ServeStaticModule.forRoot({
                rootPath: config.clientDist,
                exclude: ['/api/{*path}'],
              }),
            ]
          : []),
      ],
      controllers: [HealthController, ConfigController],
      providers: [
        RealtimeGateway,
        { provide: APP_GUARD, useClass: ThrottlerGuard },
        { provide: APP_FILTER, useClass: SentryGlobalFilter },
      ],
    };
  }
}
