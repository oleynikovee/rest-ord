import { menuItem } from '../../testing/fixtures';
import type { CartLine } from './cart.models';
import {
  selectCanCheckout,
  selectCartLines,
  selectDiscountTooLarge,
  selectSubtotal,
  selectTotal,
} from './cart.selectors';

const line = (patch: Partial<CartLine> = {}): CartLine => ({
  lineId: 'pizza',
  itemId: 'pizza',
  name: 'Pizza',
  unitPrice: 1000,
  openPrice: false,
  quantity: 2,
  ...patch,
});

describe('cart selectors', () => {
  const entities = { pizza: menuItem() };

  it('computes totals with a fixed discount', () => {
    const lines = selectCartLines.projector([line()], entities, true);
    const subtotal = selectSubtotal.projector(lines);
    expect(subtotal).toBe(2000);
    expect(selectTotal.projector(subtotal, 500)).toBe(1500);
    expect(selectDiscountTooLarge.projector(subtotal, 2001)).toBe(true);
  });

  it('flags lines whose item changed in the menu', () => {
    const lines = selectCartLines.projector(
      [line(), line({ lineId: 'soup', itemId: 'soup' }), line({ lineId: 'tea', itemId: 'tea' })],
      {
        pizza: menuItem({ price: 1100 }),
        soup: menuItem({ id: 'soup', available: false }),
      },
      true,
    );
    expect(lines.map((l) => l.problem)).toEqual(['price_changed', 'unavailable', 'removed']);
  });

  it('does not flag anything before the menu is loaded', () => {
    const lines = selectCartLines.projector([line()], {}, false);
    expect(lines[0].problem).toBeNull();
  });

  it('allows checkout only for a valid, idle cart', () => {
    const lines = selectCartLines.projector([line()], entities, true);
    expect(selectCanCheckout.projector(lines, [], false, false, true)).toBe(true);
    expect(selectCanCheckout.projector(lines, [], false, true, true)).toBe(false);
    expect(selectCanCheckout.projector(lines, [lines[0]], false, false, true)).toBe(false);
    expect(selectCanCheckout.projector([], [], false, false, true)).toBe(false);
  });
});
