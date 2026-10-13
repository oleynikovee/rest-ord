import { createActionGroup, emptyProps, props } from '@ngrx/store';
import type { ApiError } from '../../core/api-error';
import type { Order, OrdersPage } from '../../core/models';

export const OrdersActions = createActionGroup({
  source: 'Orders',
  events: {
    Load: emptyProps(),
    'Load Success': props<{ page: OrdersPage }>(),
    'Load Failure': props<{ error: ApiError }>(),
    'Load More': emptyProps(),
    'Load More Success': props<{ page: OrdersPage }>(),
    'Load More Failure': props<{ error: ApiError }>(),
    'Order Upserted': props<{ order: Order }>(),
  },
});
