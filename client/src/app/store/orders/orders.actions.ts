import { createActionGroup, emptyProps, props } from '@ngrx/store';
import type { ApiError } from '../../core/api-error';
import type { Order } from '../../core/models';

export const OrdersActions = createActionGroup({
  source: 'Orders',
  events: {
    Load: emptyProps(),
    'Load Success': props<{ orders: Order[] }>(),
    'Load Failure': props<{ error: ApiError }>(),
    'Order Upserted': props<{ order: Order }>(),
  },
});
