import { createSelector } from '@ngrx/store';
import { computeDiscount } from '../../core/models';
import { menuFeature } from '../menu/menu.reducer';
import { selectItemEntities } from '../menu/menu.selectors';
import { type CartLineView, lineProblem } from './cart.models';
import { cartFeature } from './cart.reducer';

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

export const selectDiscount = createSelector(selectSubtotal, cartFeature.selectPromo, (subtotal, promo) =>
  promo ? computeDiscount(promo.rule, subtotal) : 0,
);

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

export const selectQuantityByItem = createSelector(cartFeature.selectLines, (lines) => {
  const quantities = new Map<string, number>();
  for (const line of lines) {
    quantities.set(line.itemId, (quantities.get(line.itemId) ?? 0) + line.quantity);
  }
  return quantities;
});
