/** All money values are integer minor units (cents) to avoid floating point errors. */
export type Cents = number;

export interface Category {
  id: string;
  name: string;
  sortOrder: number;
  version: number;
}

export interface MenuItem {
  id: string;
  categoryId: string;
  name: string;
  description: string;
  /** `null` only for open-price items: their price is entered when ordering. */
  price: Cents | null;
  available: boolean;
  openPrice: boolean;
  /** Incremented on every change so clients can drop stale real-time events. */
  version: number;
}

export interface MenuSnapshot {
  categories: Category[];
  items: MenuItem[];
}

export const ORDER_STATUSES = [
  'NEW',
  'ACCEPTED',
  'COOKING',
  'READY',
  'COMPLETED',
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

/** A snapshot of the menu item at the moment of ordering. */
export interface OrderLine {
  itemId: string;
  name: string;
  unitPrice: Cents;
  quantity: number;
  openPrice: boolean;
  lineTotal: Cents;
}

export interface Order {
  id: string;
  number: number;
  /** Owner of the order; `null` only for orders created before authentication existed. */
  userId: string | null;
  customerName: string;
  lines: OrderLine[];
  subtotal: Cents;
  discount: Cents;
  total: Cents;
  status: OrderStatus;
  createdAt: string;
  updatedAt: string;
}

export type NewOrder = Pick<
  Order,
  'userId' | 'customerName' | 'lines' | 'subtotal' | 'discount' | 'total'
>;

export const ROLES = ['admin', 'customer'] as const;
export type Role = (typeof ROLES)[number];

/** What the API and tokens expose about a user: never the password hash. */
export interface User {
  id: string;
  email: string;
  name: string;
  role: Role;
}

export interface UserRecord extends User {
  passwordHash: string;
}

export type MenuChangeIssueKind =
  | 'removed'
  | 'unavailable'
  | 'price_changed'
  | 'open_price_changed';

export interface MenuChangeIssue {
  itemId: string;
  kind: MenuChangeIssueKind;
  /** Current menu item, absent when it was removed. */
  item?: MenuItem;
}

export const TOPICS = {
  menu: 'menu.changes.v1',
  orders: 'order.lifecycle.v1',
} as const;

export type MenuEvent =
  | { type: 'category.upserted'; category: Category }
  | { type: 'category.deleted'; id: string }
  | { type: 'item.upserted'; item: MenuItem }
  | { type: 'item.deleted'; id: string };

export type OrderEvent = { type: 'order.upserted'; order: Order };

export function nextStatus(status: OrderStatus): OrderStatus | null {
  const index = ORDER_STATUSES.indexOf(status);
  return ORDER_STATUSES[index + 1] ?? null;
}
