import { createSelector } from '@ngrx/store';
import { computeDiscount } from '../../core/models';
import { menuFeature } from '../menu/menu.reducer';
import { selectItemEntities } from '../menu/menu.selectors';
import { type CartLineView, lineProblem } from './cart.models';
import { cartFeature } from './cart.reducer';

/** Cart lines checked live against the current menu. */
export const selectCartLines = createSelector(
  cartFeature.selectLines,
  selectItemEntities,
  menuFeature.selectLoaded,
  (
    lines,
    items,
    menuLoaded,
  ): CartLineView[] =>
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

/** Same function as on the server, so the cart shows exactly what will be charged. */
export const selectDiscount = createSelector(selectSubtotal, cartFeature.selectPromo, (subtotal, promo) =>
  promo ? computeDiscount(promo.rule, subtotal) : 0,
);

/** How much more to add before the applied code gives a discount (0 when it already does). */
export const selectPromoShortfall = createSelector(selectSubtotal, cartFeature.selectPromo, (subtotal, promo) =>
  promo ? Math.max(0, promo.rule.minOrderAmount - subtotal) : 0,
);

export const selectTotal = createSelector(
  selectSubtotal,
  selectDiscount,
  (subtotal, discount) => subtotal - discount,
);

export const selectCanCheckout = createSelector(
  selectCartLines,
  selectCartProblems,
  cartFeature.selectSubmitting,
  cartFeature.selectPromoPending,
  menuFeature.selectLoaded,
  (
    lines,
    problems,
    submitting,
    promoPending,
    menuLoaded,
  ) => menuLoaded && lines.length > 0 && problems.length === 0 && !submitting && !promoPending,
);

/** Quantity of each menu item in the cart, for the steppers in the menu list. */
export const selectQuantityByItem = createSelector(cartFeature.selectLines, (lines) => {
  const quantities = new Map<string, number>();
  for (const line of lines) {
    quantities.set(line.itemId, (quantities.get(line.itemId) ?? 0) + line.quantity);
  }
  return quantities;
});
