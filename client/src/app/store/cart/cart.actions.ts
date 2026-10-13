import { createActionGroup, emptyProps, props } from '@ngrx/store';
import type { ApiError } from '../../core/api-error';
import type { Cents, MenuItem, Order, PromoQuote } from '../../core/models';

export const CartActions = createActionGroup({
  source: 'Cart',
  events: {
    'Add Item': props<{ item: MenuItem; quantity: number; unitPrice?: Cents }>(),
    'Set Quantity': props<{ lineId: string; quantity: number }>(),
    'Remove Line': props<{ lineId: string }>(),
    'Apply Promo': props<{ code: string }>(),
    'Apply Promo Success': props<{ quote: PromoQuote }>(),
    'Apply Promo Failure': props<{ error: ApiError }>(),
    'Remove Promo': emptyProps(),
    'Apply Menu Changes': props<{ items: Record<string, MenuItem | undefined> }>(),
    Clear: emptyProps(),
    Checkout: props<{ key: string }>(),
    'Checkout Success': props<{ order: Order }>(),
    'Checkout Failure': props<{ error: ApiError }>(),
  },
});
