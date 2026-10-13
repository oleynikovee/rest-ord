import { inject } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { catchError, map, of, switchMap } from 'rxjs';
import { toApiError } from '../../core/api-error';
import { ApiService } from '../../core/api.service';
import { OrdersActions } from './orders.actions';

export const loadOrders = createEffect(
  (actions$ = inject(Actions), api = inject(ApiService)) =>
    actions$.pipe(
      ofType(OrdersActions.load),
      switchMap(() =>
        api.getOrders().pipe(
          map((orders) => OrdersActions.loadSuccess({ orders })),
          catchError((error: unknown) =>
            of(OrdersActions.loadFailure({ error: toApiError(error) })),
          ),
        ),
      ),
    ),
  { functional: true },
);
