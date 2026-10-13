import { Global, Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { MetricsInterceptor } from './metrics.interceptor.js';
import { MetricsServer } from './metrics.server.js';
import { MetricsService } from './metrics.service.js';

@Global()
@Module({
  providers: [MetricsService, MetricsServer, { provide: APP_INTERCEPTOR, useClass: MetricsInterceptor }],
  exports: [MetricsService],
})
export class ObservabilityModule {}
