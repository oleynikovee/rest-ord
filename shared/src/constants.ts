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

/** Header used to make order creation idempotent. */
export const IDEMPOTENCY_HEADER = 'Idempotency-Key';
export const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9_-]{8,128}$/;

/** Socket.IO event names. */
export const SOCKET_EVENTS = {
  menu: 'menu',
  order: 'order',
} as const;
