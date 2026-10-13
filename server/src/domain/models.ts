/**
 * The API contract (entities, events, constants) comes from the shared package,
 * so the server and the client cannot drift apart. Server-only types live here.
 */
import type { Order, User } from '@trattoria/contracts';

export * from '@trattoria/contracts';

/** What the repository needs to create an order. */
export type NewOrder = Pick<
  Order,
  'userId' | 'customerName' | 'lines' | 'subtotal' | 'discount' | 'total' | 'promoCode'
>;

/** Redeeming a promo code together with the order, in the same transaction. */
export interface PromoRedemption {
  promoId: string;
  userId: string;
}

export type CreateOrderResult =
  | { status: 'created'; order: Order }
  /** The idempotency key was used before: the original order, nothing new. */
  | { status: 'duplicate'; order: Order }
  /** The promo code ran out (total or per-customer limit) at the moment of ordering. */
  | { status: 'promo_exhausted' }
  | { status: 'promo_already_used' };

/** Stored user, including the password hash that never leaves the server. */
export interface UserRecord extends User {
  passwordHash: string;
}

/** Event bus topics (internal, versioned). */
export const TOPICS = {
  menu: 'menu.changes.v1',
  orders: 'order.lifecycle.v1',
} as const;
