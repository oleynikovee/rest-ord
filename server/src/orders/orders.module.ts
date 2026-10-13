import { Module } from '@nestjs/common';
import { OrderStatusSimulator } from './order-status.simulator.js';
import { OrdersController } from './orders.controller.js';
import { OrdersService } from './orders.service.js';

@Module({
  controllers: [OrdersController],
  providers: [OrdersService, OrderStatusSimulator],
})
export class OrdersModule {}
