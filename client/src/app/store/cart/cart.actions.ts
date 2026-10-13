import { createActionGroup, emptyProps, props } from '@ngrx/store';
import type { ApiError } from '../../core/api-error';
import type { Cents, MenuItem, Order } from '../../core/models';

export const CartActions = createActionGroup({
  source: 'Cart',
  events: {
    /** `unitPrice` is required for open-price items. */
    'Add Item': props<{ item: MenuItem; quantity: number; unitPrice?: Cents }>(),
    'Set Quantity': props<{ lineId: string; quantity: number }>(),
    'Remove Line': props<{ lineId: string }>(),
    'Set Discount': props<{ discount: Cents }>(),
    /** Brings the cart in line with the current menu after the user reviewed the changes. */
    'Apply Menu Changes': props<{ items: Record<string, MenuItem | undefined> }>(),
    Clear: emptyProps(),
    /** `key` is used only if no checkout attempt for this exact cart is pending. */
    Checkout: props<{ key: string }>(),
    'Checkout Success': props<{ order: Order }>(),
    'Checkout Failure': props<{ error: ApiError }>(),
  },
});
