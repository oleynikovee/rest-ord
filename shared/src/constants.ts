export const ORDER_STATUSES = [
  'NEW',
  'ACCEPTED',
  'COOKING',
  'READY',
  'COMPLETED',
] as const;

export const ROLES = [
  'admin',
  'customer',
] as const;

export const MENU_CHANGE_KINDS = [
  'removed',
  'unavailable',
  'price_changed',
  'open_price_changed',
] as const;

export const ORDERS_PAGE_SIZE = {
  default: 20,
  max: 100,
} as const;

export const PROMO_KINDS = [
  'FIXED',
  'PERCENT',
] as const;

/** Why a promo code cannot be applied (HTTP 422 `code`). */
export const PROMO_ERRORS = {
  notFound: 'PROMO_NOT_FOUND',
  inactive: 'PROMO_INACTIVE',
  notStarted: 'PROMO_NOT_STARTED',
  expired: 'PROMO_EXPIRED',
  minOrder: 'PROMO_MIN_ORDER',
  exhausted: 'PROMO_EXHAUSTED',
  alreadyUsed: 'PROMO_ALREADY_USED',
} as const;

/** Header used to make order creation idempotent. */
export const IDEMPOTENCY_HEADER = 'Idempotency-Key';
export const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9_-]{8,128}$/;

/** Topics of the event log (outbox). */
export const TOPICS = {
  menu: 'menu.changes.v1',
  orders: 'order.lifecycle.v1',
} as const;

export const EVENTS_PAGE_SIZE = 500;

/** Socket.IO event names. */
export const SOCKET_EVENTS = {
  menu: 'menu',
  order: 'order',
} as const;
