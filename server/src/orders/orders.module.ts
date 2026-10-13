import { Module } from '@nestjs/common';
import { PromoModule } from '../promo/promo.module.js';
import { OrderStatusSimulator } from './order-status.simulator.js';
import { OrdersController } from './orders.controller.js';
import { OrdersService } from './orders.service.js';

@Module({
  imports: [PromoModule],
  controllers: [OrdersController],
  providers: [OrdersService, OrderStatusSimulator],
})
export class OrdersModule {}
