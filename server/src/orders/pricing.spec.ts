import type { MenuItem } from '../domain/models.js';
import { priceOrder } from './pricing.js';

const item = (patch: Partial<MenuItem> = {}): MenuItem => ({
  id: 'a',
  categoryId: 'c',
  name: 'Pizza',
  description: '',
  price: 1000,
  available: true,
  openPrice: false,
  version: 1,
  ...patch,
});

const menuOf = (...items: MenuItem[]) => new Map(items.map((i) => [i.id, i]));

describe('priceOrder', () => {
  it('computes subtotal, discount and total', () => {
    const result = priceOrder(
      [
        { itemId: 'a', quantity: 2, unitPrice: 1000, openPrice: false },
        { itemId: 'b', quantity: 1, unitPrice: 2550, openPrice: true },
      ],
      500,
      menuOf(item(), item({ id: 'b', openPrice: true, price: null })),
    );

    expect(result).toEqual({
      ok: true,
      order: expect.objectContaining({ subtotal: 4550, discount: 500, total: 4050 }),
    });
  });

  it('reports every item that changed since it was added to the cart', () => {
    const result = priceOrder(
      [
        { itemId: 'a', quantity: 1, unitPrice: 900, openPrice: false },
        { itemId: 'b', quantity: 1, unitPrice: 1000, openPrice: false },
        { itemId: 'gone', quantity: 1, unitPrice: 1000, openPrice: false },
        { itemId: 'd', quantity: 1, unitPrice: 1000, openPrice: false },
      ],
      0,
      menuOf(
        item(),
        item({ id: 'b', available: false }),
        item({ id: 'd', openPrice: true }),
      ),
    );

    expect(result.ok).toBe(false);
    if (result.ok || result.reason !== 'menu_changed') throw new Error('unexpected');
    expect(result.issues.map((i) => [i.itemId, i.kind])).toEqual([
      ['a', 'price_changed'],
      ['b', 'unavailable'],
      ['gone', 'removed'],
      ['d', 'open_price_changed'],
    ]);
  });

  it('rejects a discount larger than the subtotal', () => {
    const result = priceOrder(
      [{ itemId: 'a', quantity: 1, unitPrice: 1000, openPrice: false }],
      1001,
      menuOf(item()),
    );
    expect(result).toEqual({ ok: false, reason: 'discount_too_large', subtotal: 1000 });
  });

  it('requires a positive price for open-price items', () => {
    const result = priceOrder(
      [{ itemId: 'a', quantity: 1, unitPrice: 0, openPrice: true }],
      0,
      menuOf(item({ openPrice: true, price: null })),
    );
    expect(result).toEqual({ ok: false, reason: 'invalid_open_price', itemId: 'a' });
  });
});
