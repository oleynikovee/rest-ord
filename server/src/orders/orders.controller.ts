import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  Post,
  Res,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import type { Order } from '../domain/models.js';
import { CreateOrderDto } from './orders.dto.js';
import { OrdersService } from './orders.service.js';

const IDEMPOTENCY_KEY = /^[A-Za-z0-9_-]{8,128}$/;

@Controller('orders')
export class OrdersController {
  constructor(private readonly orders: OrdersService) {}

  @Get()
  list(): Promise<Order[]> {
    return this.orders.list();
  }

  @Post()
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  async create(
    @Headers('idempotency-key') key: string | undefined,
    @Body() dto: CreateOrderDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<Order> {
    if (!key || !IDEMPOTENCY_KEY.test(key)) {
      throw new BadRequestException({
        code: 'IDEMPOTENCY_KEY_REQUIRED',
        message: 'A valid Idempotency-Key header is required.',
      });
    }
    const { order, replayed } = await this.orders.place(key, dto);
    res.status(replayed ? 200 : 201);
    if (replayed) res.setHeader('Idempotent-Replayed', 'true');
    return order;
  }
}
