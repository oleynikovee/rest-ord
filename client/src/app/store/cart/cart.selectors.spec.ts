import { menuItem } from '../../testing/fixtures';
import type { CartLine } from './cart.models';
import {
  selectCanCheckout,
  selectCartLines,
  selectDiscount,
  selectPromoShortfall,
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

  it('computes the promo discount live from the subtotal', () => {
    const lines = selectCartLines.projector([line()], entities, true);
    const subtotal = selectSubtotal.projector(lines);
    expect(subtotal).toBe(2000);

    const percent = {
      rule: { code: 'TEN', kind: 'PERCENT' as const, value: 10, minOrderAmount: 0, maxDiscount: 150 },
      description: '',
      discount: 0,
    };
    expect(selectDiscount.projector(subtotal, percent)).toBe(150); // 10% = 200, capped at 150
    expect(selectTotal.projector(subtotal, 150)).toBe(1850);

    const minimum = { ...percent, rule: { ...percent.rule, minOrderAmount: 3000 } };
    expect(selectDiscount.projector(subtotal, minimum)).toBe(0);
    expect(selectPromoShortfall.projector(subtotal, minimum)).toBe(1000);
    expect(selectDiscount.projector(subtotal, null)).toBe(0);
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
