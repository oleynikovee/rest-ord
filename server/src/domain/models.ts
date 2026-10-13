/**
 * The API contract (entities, events, constants) comes from the shared package,
 * so the server and the client cannot drift apart. Server-only types live here.
 */
import type { Order, User } from '@trattoria/contracts';

export * from '@trattoria/contracts';

/** What the repository needs to create an order. */
export type NewOrder = Pick<
  Order,
  'userId' | 'customerName' | 'lines' | 'subtotal' | 'discount' | 'total'
>;

/** Stored user, including the password hash that never leaves the server. */
export interface UserRecord extends User {
  passwordHash: string;
}

/** Event bus topics (internal, versioned). */
export const TOPICS = {
  menu: 'menu.changes.v1',
  orders: 'order.lifecycle.v1',
} as const;
