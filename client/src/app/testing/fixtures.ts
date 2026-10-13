import type { MenuItem, Order } from '../core/models';

export const menuItem = (patch: Partial<MenuItem> = {}): MenuItem => ({
  id: 'pizza',
  categoryId: 'c1',
  name: 'Pizza',
  description: '',
  price: 1000,
  available: true,
  openPrice: false,
  version: 1,
  ...patch,
});

export const order = (patch: Partial<Order> = {}): Order => ({
  id: 'o1',
  number: 1,
  lines: [],
  subtotal: 1000,
  discount: 0,
  total: 1000,
  status: 'NEW',
  createdAt: '2026-01-01T10:00:00.000Z',
  updatedAt: '2026-01-01T10:00:00.000Z',
  ...patch,
});
