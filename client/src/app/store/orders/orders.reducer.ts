import { type EntityState, createEntityAdapter } from '@ngrx/entity';
import { createFeature, createReducer, createSelector, on } from '@ngrx/store';
import type { ApiError } from '../../core/api-error';
import type { Order } from '../../core/models';
import { CartActions } from '../cart/cart.actions';
import { OrdersActions } from './orders.actions';

const adapter = createEntityAdapter<Order>({ sortComparer: (a, b) => b.number - a.number });

export interface OrdersState extends EntityState<Order> {
  loaded: boolean;
  loading: boolean;
  error: ApiError | null;
}

const initialState: OrdersState = adapter.getInitialState({
  loaded: false,
  loading: false,
  error: null,
});

const isNewer = (state: OrdersState, order: Order) => {
  const current = state.entities[order.id];
  return !current || current.updatedAt <= order.updatedAt;
};

export const ordersFeature = createFeature({
  name: 'orders',
  reducer: createReducer(
    initialState,
    on(OrdersActions.load, (state) => ({ ...state, loading: true, error: null })),
    on(OrdersActions.loadSuccess, (state, { orders }) =>
      adapter.setAll(
        orders.map((order) => (isNewer(state, order) ? order : state.entities[order.id]!)),
        { ...state, loaded: true, loading: false },
      ),
    ),
    on(OrdersActions.loadFailure, (state, { error }) => ({ ...state, loading: false, error })),
    on(OrdersActions.orderUpserted, CartActions.checkoutSuccess, (state, { order }) =>
      isNewer(state, order) ? adapter.upsertOne(order, state) : state,
    ),
  ),
  extraSelectors: ({ selectOrdersState }) => ({
    selectAll: createSelector(selectOrdersState, adapter.getSelectors().selectAll),
  }),
});
