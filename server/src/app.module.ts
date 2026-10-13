import { type DynamicModule, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ServeStaticModule } from '@nestjs/serve-static';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import type { AppConfig } from './config.js';
import { HealthController } from './health/health.controller.js';
import { InfrastructureModule } from './infrastructure/infrastructure.module.js';
import { MenuModule } from './menu/menu.module.js';
import { OrdersModule } from './orders/orders.module.js';
import { RealtimeGateway } from './realtime/realtime.gateway.js';

@Module({})
export class AppModule {
  static forRoot(config: AppConfig): DynamicModule {
    return {
      module: AppModule,
      imports: [
        InfrastructureModule.forRoot(config),
        ThrottlerModule.forRoot([{ name: 'default', ttl: 60_000, limit: 300 }]),
        MenuModule,
        OrdersModule,
        ...(config.clientDist
          ? [
              ServeStaticModule.forRoot({
                rootPath: config.clientDist,
                exclude: ['/api/{*path}'],
              }),
            ]
          : []),
      ],
      controllers: [HealthController],
      providers: [RealtimeGateway, { provide: APP_GUARD, useClass: ThrottlerGuard }],
    };
  }
}
