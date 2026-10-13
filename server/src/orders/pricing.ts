import type {
  MenuChangeIssue,
  MenuItem,
  OrderLine,
} from '../domain/models.js';

export interface RequestedLine {
  itemId: string;
  quantity: number;
  unitPrice: number;
  openPrice: boolean;
}

export interface PricedOrder {
  lines: OrderLine[];
  subtotal: number;
}

export type PricingResult =
  | { ok: true; order: PricedOrder }
  | { ok: false; reason: 'menu_changed'; issues: MenuChangeIssue[] }
  | { ok: false; reason: 'invalid_open_price'; itemId: string };

export function priceOrder(lines: RequestedLine[], menu: Map<string, MenuItem>): PricingResult {
  const issues: MenuChangeIssue[] = [];
  const orderLines: OrderLine[] = [];

  for (const line of lines) {
    const item = menu.get(line.itemId);
    if (!item) {
      issues.push({ itemId: line.itemId, kind: 'removed' });
      continue;
    }
    if (!item.available) {
      issues.push({ itemId: item.id, kind: 'unavailable', item });
      continue;
    }
    if (item.openPrice !== line.openPrice) {
      issues.push({ itemId: item.id, kind: 'open_price_changed', item });
      continue;
    }
    if (item.openPrice && line.unitPrice <= 0) {
      return { ok: false, reason: 'invalid_open_price', itemId: item.id };
    }
    if (!item.openPrice && item.price !== line.unitPrice) {
      issues.push({ itemId: item.id, kind: 'price_changed', item });
      continue;
    }

    orderLines.push({
      itemId: item.id,
      name: item.name,
      unitPrice: line.unitPrice,
      quantity: line.quantity,
      openPrice: item.openPrice,
      lineTotal: line.unitPrice * line.quantity,
    });
  }

  if (issues.length > 0) return { ok: false, reason: 'menu_changed', issues };

  const subtotal = orderLines.reduce((sum, l) => sum + l.lineTotal, 0);
  return { ok: true, order: { lines: orderLines, subtotal } };
}
