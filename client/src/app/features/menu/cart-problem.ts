import type { CartLineView } from '../../store/cart/cart.models';
import { formatMoney } from '../../shared/money.pipe';

export function describeProblem(line: CartLineView): string {
  switch (line.problem) {
    case 'removed':
      return 'No longer on the menu';
    case 'unavailable':
      return 'Sold out';
    case 'price_changed':
      return `Price changed: ${formatMoney(line.unitPrice)} → ${formatMoney(line.item?.price)}`;
    case 'open_price_changed':
      return line.item?.openPrice
        ? 'Price is now set when ordering: add it again'
        : `Now has a fixed price of ${formatMoney(line.item?.price)}`;
    default:
      return '';
  }
}
