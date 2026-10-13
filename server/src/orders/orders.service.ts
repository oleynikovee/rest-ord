import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { type Order, type OrderEvent, TOPICS, type User } from '../domain/models.js';
import {
  EventBus,
  IdempotencyStore,
  MenuRepository,
  OrdersRepository,
} from '../domain/ports.js';
import type { CreateOrderDto } from './orders.dto.js';
import { priceOrder } from './pricing.js';

export interface PlaceOrderResult {
  order: Order;
  /** True when the same idempotency key was already used: nothing new was created. */
  replayed: boolean;
}

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    private readonly orders: OrdersRepository,
    private readonly menu: MenuRepository,
    private readonly idempotency: IdempotencyStore,
    private readonly bus: EventBus,
  ) {}

  /** Admins see every order, customers only their own. */
  list(user: User, limit = 200): Promise<Order[]> {
    return this.orders.list(limit, user.role === 'admin' ? undefined : user.id);
  }

  async place(
    user: User,
    clientKey: string,
    dto: CreateOrderDto,
  ): Promise<PlaceOrderResult> {
    // Keys are scoped per user: another user's key can never return someone else's order.
    const idempotencyKey = `${user.id}:${clientKey}`;
    const state = await this.idempotency.acquire(idempotencyKey);

    if (state.kind === 'completed') {
      const order = await this.orders.findById(state.orderId);
      if (order) return { order, replayed: true };
    }
    if (state.kind === 'in_progress') {
      throw new ConflictException({
        code: 'ORDER_IN_PROGRESS',
        message: 'This order is already being placed.',
      });
    }

    try {
      const existing = await this.orders.findByIdempotencyKey(idempotencyKey);
      if (existing) {
        await this.idempotency.complete(idempotencyKey, existing.id);
        return { order: existing, replayed: true };
      }

      const items = await this.menu.findItems([
        ...new Set(dto.lines.map((line) => line.itemId)),
      ]);
      const result = priceOrder(
        dto.lines,
        dto.discount,
        new Map(items.map((item) => [item.id, item])),
      );

      if (!result.ok) {
        switch (result.reason) {
          case 'menu_changed':
            throw new ConflictException({
              code: 'MENU_CHANGED',
              message: 'Some items changed since you added them to the cart.',
              issues: result.issues,
            });
          case 'discount_too_large':
            throw new BadRequestException({
              code: 'DISCOUNT_TOO_LARGE',
              message: 'The discount cannot exceed the order subtotal.',
            });
          case 'invalid_open_price':
            throw new BadRequestException({
              code: 'INVALID_OPEN_PRICE',
              message: 'Enter a price greater than zero for open-price items.',
            });
        }
      }

      const order = await this.orders.create(
        { ...result.order, userId: user.id, customerName: user.name },
        idempotencyKey,
      );
      await this.idempotency.complete(idempotencyKey, order.id);
      this.logger.log(`Order #${order.number} placed, total ${order.total}`);
      // The order is already stored: a failed broadcast must not turn it into an error.
      await this.publish(order).catch((error: Error) =>
        this.logger.warn(`Order #${order.number} broadcast failed: ${error.message}`),
      );
      return { order, replayed: false };
    } catch (error) {
      // Free the key so the user can fix the cart and retry with the same key.
      await this.idempotency.release(idempotencyKey).catch(() => undefined);
      throw error;
    }
  }

  publish(order: Order): Promise<void> {
    const event: OrderEvent = { type: 'order.upserted', order };
    return this.bus.publish(TOPICS.orders, event);
  }
}
