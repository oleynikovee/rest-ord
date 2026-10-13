import { createSelector } from '@ngrx/store';
import { menuFeature } from '../menu/menu.reducer';
import { selectItemEntities } from '../menu/menu.selectors';
import { type CartLineView, lineProblem } from './cart.models';
import { cartFeature } from './cart.reducer';

/** Cart lines checked live against the current menu. */
export const selectCartLines = createSelector(
  cartFeature.selectLines,
  selectItemEntities,
  menuFeature.selectLoaded,
  (lines, items, menuLoaded): CartLineView[] =>
    lines.map((line) => {
      const item = items[line.itemId];
      return {
        ...line,
        item,
        lineTotal: line.unitPrice * line.quantity,
        // Until the menu is loaded we cannot tell, so do not flag anything yet.
        problem: menuLoaded ? lineProblem(line, item) : null,
      };
    }),
);

export const selectCartProblems = createSelector(selectCartLines, (lines) =>
  lines.filter((line) => line.problem !== null),
);

export const selectCartCount = createSelector(cartFeature.selectLines, (lines) =>
  lines.reduce((sum, line) => sum + line.quantity, 0),
);

export const selectSubtotal = createSelector(selectCartLines, (lines) =>
  lines.reduce((sum, line) => sum + line.lineTotal, 0),
);

export const selectDiscountTooLarge = createSelector(
  selectSubtotal,
  cartFeature.selectDiscount,
  (subtotal, discount) => discount > subtotal,
);

export const selectTotal = createSelector(
  selectSubtotal,
  cartFeature.selectDiscount,
  (subtotal, discount) => Math.max(0, subtotal - discount),
);

export const selectCanCheckout = createSelector(
  selectCartLines,
  selectCartProblems,
  selectDiscountTooLarge,
  cartFeature.selectSubmitting,
  menuFeature.selectLoaded,
  (lines, problems, discountTooLarge, submitting, menuLoaded) =>
    menuLoaded && lines.length > 0 && problems.length === 0 && !discountTooLarge && !submitting,
);

/** Quantity of each menu item in the cart, for the steppers in the menu list. */
export const selectQuantityByItem = createSelector(cartFeature.selectLines, (lines) => {
  const quantities = new Map<string, number>();
  for (const line of lines) {
    quantities.set(line.itemId, (quantities.get(line.itemId) ?? 0) + line.quantity);
  }
  return quantities;
});
