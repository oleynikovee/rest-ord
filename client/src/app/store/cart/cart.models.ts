import type { Cents, MenuChangeKind, MenuItem } from '../../core/models';

export interface CartLine {
  lineId: string;
  itemId: string;
  name: string;
  unitPrice: Cents;
  openPrice: boolean;
  quantity: number;
}

export interface CartLineView extends CartLine {
  lineTotal: Cents;
  problem: MenuChangeKind | null;
  item: MenuItem | undefined;
}

export const MAX_QUANTITY = 99;

export function lineIdFor(item: MenuItem, unitPrice: Cents): string {
  return item.openPrice ? `${item.id}:${unitPrice}` : item.id;
}

export function lineProblem(line: CartLine, item: MenuItem | undefined): MenuChangeKind | null {
  if (!item) return 'removed';
  if (!item.available) return 'unavailable';
  if (item.openPrice !== line.openPrice) return 'open_price_changed';
  if (!item.openPrice && item.price !== line.unitPrice) return 'price_changed';
  return null;
}
