import { createActionGroup, emptyProps, props } from '@ngrx/store';
import type { ApiError } from '../../core/api-error';
import type { Order, OrdersPage } from '../../core/models';

export const OrdersActions = createActionGroup({
  source: 'Orders',
  events: {
    /** First (newest) page. */
    Load: emptyProps(),
    'Load Success': props<{ page: OrdersPage }>(),
    'Load Failure': props<{ error: ApiError }>(),
    /** Next (older) page, from the stored cursor. */
    'Load More': emptyProps(),
    'Load More Success': props<{ page: OrdersPage }>(),
    'Load More Failure': props<{ error: ApiError }>(),
    'Order Upserted': props<{ order: Order }>(),
  },
});
