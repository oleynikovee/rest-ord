import { inject } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { concatLatestFrom } from '@ngrx/operators';
import { Store } from '@ngrx/store';
import { catchError, exhaustMap, filter, map, of, switchMap, tap } from 'rxjs';
import { toApiError } from '../../core/api-error';
import { ApiService } from '../../core/api.service';
import { NotifyService } from '../../core/notify.service';
import { OrdersActions } from './orders.actions';
import { ordersFeature } from './orders.reducer';

export const loadOrders = createEffect(
  (actions$ = inject(Actions), api = inject(ApiService)) =>
    actions$.pipe(
      ofType(OrdersActions.load),
      switchMap(() =>
        api.getOrders().pipe(
          map((page) => OrdersActions.loadSuccess({ page })),
          catchError((error: unknown) => of(OrdersActions.loadFailure({ error: toApiError(error) }))),
        ),
      ),
    ),
  { functional: true },
);

export const loadMoreOrders = createEffect(
  (actions$ = inject(Actions), store = inject(Store), api = inject(ApiService)) =>
    actions$.pipe(
      ofType(OrdersActions.loadMore),
      concatLatestFrom(() => store.select(ordersFeature.selectNextCursor)),
      filter(([, cursor]) => cursor !== null),
      exhaustMap(([, cursor]) =>
        api.getOrders(cursor ?? undefined).pipe(
          map((page) => OrdersActions.loadMoreSuccess({ page })),
          catchError((error: unknown) =>
            of(OrdersActions.loadMoreFailure({ error: toApiError(error) })),
          ),
        ),
      ),
    ),
  { functional: true },
);

export const notifyLoadMoreFailure = createEffect(
  (actions$ = inject(Actions), notify = inject(NotifyService)) =>
    actions$.pipe(
      ofType(OrdersActions.loadMoreFailure),
      tap(({ error }) => notify.error(`Could not load older orders. ${error.message}`)),
    ),
  { functional: true, dispatch: false },
);
