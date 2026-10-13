import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  UnprocessableEntityException,
} from '@nestjs/common';
import {
  ORDERS_PAGE_SIZE,
  type Order,
  PROMO_ERRORS,
  type OrdersPage,
  type OrdersQuery,
  type User,
} from '../domain/models.js';
import {
  IdempotencyStore,
  MenuRepository,
  OrdersRepository,
} from '../domain/ports.js';
import type { CreateOrderDto } from './orders.dto.js';
import { PromoService } from '../promo/promo.service.js';
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
    private readonly promos: PromoService,
  ) {}

  /** Admins see every order, customers only their own. */
  async list(user: User, query: OrdersQuery): Promise<OrdersPage> {
    const limit = query.limit ?? ORDERS_PAGE_SIZE.default;
    // One extra row tells whether an older page exists without a COUNT query.
    const rows = await this.orders.list({
      limit: limit + 1,
      userId: user.role === 'admin' ? undefined : user.id,
      before: query.before,
    });
    const items = rows.slice(0, limit);
    return { items, nextCursor: rows.length > limit ? items[items.length - 1].number : null };
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
      const result = priceOrder(dto.lines, new Map(items.map((item) => [item.id, item])));

      if (!result.ok) {
        switch (result.reason) {
          case 'menu_changed':
            throw new ConflictException({
              code: 'MENU_CHANGED',
              message: 'Some items changed since you added them to the cart.',
              issues: result.issues,
            });
          case 'invalid_open_price':
            throw new BadRequestException({
              code: 'INVALID_OPEN_PRICE',
              message: 'Enter a price greater than zero for open-price items.',
            });
        }
      }

      // The client never sends a discount amount: it is computed from the code here.
      const promo = dto.promoCode
        ? await this.promos.quote(user, dto.promoCode, result.order.subtotal)
        : null;
      const discount = promo?.quote.discount ?? 0;
      const created = await this.orders.create(
        {
          ...result.order,
          discount,
          total: result.order.subtotal - discount,
          promoCode: promo?.promo.code ?? null,
          userId: user.id,
          customerName: user.name,
        },
        idempotencyKey,
        promo ? { promoId: promo.promo.id, userId: user.id } : undefined,
      );
      switch (created.status) {
        case 'duplicate':
          await this.idempotency.complete(idempotencyKey, created.order.id);
          return { order: created.order, replayed: true };
        case 'promo_exhausted':
          throw new UnprocessableEntityException({
            code: PROMO_ERRORS.exhausted,
            message: 'This promo code has just been fully used.',
          });
        case 'promo_already_used':
          throw new UnprocessableEntityException({
            code: PROMO_ERRORS.alreadyUsed,
            message: 'You have already used this promo code.',
          });
      }
      const order = created.order;
      await this.idempotency.complete(idempotencyKey, order.id);
      // Its event was written in the same transaction; the outbox relay broadcasts it.
      this.logger.log(`Order #${order.number} placed, total ${order.total}`);
      return { order, replayed: false };
    } catch (error) {
      // Free the key so the user can fix the cart and retry with the same key.
      await this.idempotency.release(idempotencyKey).catch(() => undefined);
      throw error;
    }
  }
}
