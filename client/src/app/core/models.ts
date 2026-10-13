/**
 * API contract shared with the server (server/src/domain/models.ts).
 * All money values are integer cents.
 */
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
  /** `null` only for open-price items. */
  price: Cents | null;
  available: boolean;
  openPrice: boolean;
  version: number;
}

export interface MenuSnapshot {
  categories: Category[];
  items: MenuItem[];
}

export const ORDER_STATUSES = ['NEW', 'ACCEPTED', 'COOKING', 'READY', 'COMPLETED'] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

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
  lines: OrderLine[];
  subtotal: Cents;
  discount: Cents;
  total: Cents;
  status: OrderStatus;
  createdAt: string;
  updatedAt: string;
}

export interface CreateOrderRequest {
  lines: { itemId: string; quantity: number; unitPrice: Cents; openPrice: boolean }[];
  discount: Cents;
}

export type MenuChangeKind = 'removed' | 'unavailable' | 'price_changed' | 'open_price_changed';

export interface MenuChangeIssue {
  itemId: string;
  kind: MenuChangeKind;
  item?: MenuItem;
}

export type MenuEvent =
  | { type: 'category.upserted'; category: Category }
  | { type: 'category.deleted'; id: string }
  | { type: 'item.upserted'; item: MenuItem }
  | { type: 'item.deleted'; id: string };

export interface OrderEvent {
  type: 'order.upserted';
  order: Order;
}

export type MenuItemInput = Omit<MenuItem, 'id' | 'version'>;
