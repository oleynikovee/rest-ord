import type { MenuEvent, Order, OrderEvent, TOPICS, User } from '@trattoria/contracts';

export * from '@trattoria/contracts';

export type NewOrder = Pick<
  Order,
  'userId' | 'customerName' | 'lines' | 'subtotal' | 'discount' | 'total' | 'promoCode'
>;

export interface PromoRedemption {
  promoId: string;
  userId: string;
}

export type CreateOrderResult =
  | { status: 'created'; order: Order }
  | { status: 'duplicate'; order: Order }
  | { status: 'promo_exhausted' }
  | { status: 'promo_already_used' };

export interface UserRecord extends User {
  passwordHash: string;
}

export type LoggedEvent =
  | { topic: typeof TOPICS.menu; event: MenuEvent }
  | { topic: typeof TOPICS.orders; event: OrderEvent };
