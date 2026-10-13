import { Module } from '@nestjs/common';
import { PromoController } from './promo.controller.js';
import { PromoService } from './promo.service.js';

@Module({
  controllers: [PromoController],
  providers: [PromoService],
  exports: [PromoService],
})
export class PromoModule {}
