import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { Store } from '@ngrx/store';
import {
  catchError,
  debounceTime,
  exhaustMap,
  filter,
  from,
  map,
  of,
  retry,
  switchMap,
  tap,
  throwError,
  timer,
} from 'rxjs';
import { concatLatestFrom } from '@ngrx/operators';
import { isTransient, toApiError } from '../../core/api-error';
import { ApiService } from '../../core/api.service';
import type { CreateOrderRequest } from '../../core/models';
import { NotifyService } from '../../core/notify.service';
import { MenuLiveActions } from '../menu/menu.actions';
import { CartActions } from './cart.actions';
import { CART_STORAGE_KEY, cartFeature } from './cart.reducer';

/**
 * `exhaustMap` ignores repeated clicks while a request is in flight, and the
 * idempotency key makes automatic retries after network errors safe.
 */
export const checkout = createEffect(
  (actions$ = inject(Actions), store = inject(Store), api = inject(ApiService)) =>
    actions$.pipe(
      ofType(CartActions.checkout),
      concatLatestFrom(() => store.select(cartFeature.selectCartState)),
      exhaustMap(([, cart]) => {
        const request: CreateOrderRequest = {
          lines: cart.lines.map(({ itemId, quantity, unitPrice, openPrice }) => ({
            itemId,
            quantity,
            unitPrice,
            openPrice,
          })),
          discount: cart.discount,
        };
        return api.placeOrder(request, cart.checkoutKey!).pipe(
          retry({
            count: 3,
            delay: (error: unknown, attempt) => {
              const apiError = toApiError(error);
              const retryable = isTransient(apiError) || apiError.code === 'ORDER_IN_PROGRESS';
              return retryable ? timer(1000 * 2 ** (attempt - 1)) : throwError(() => error);
            },
          }),
          map((order) => CartActions.checkoutSuccess({ order })),
          catchError((error: unknown) =>
            of(CartActions.checkoutFailure({ error: toApiError(error) })),
          ),
        );
      }),
    ),
  { functional: true },
);

/** The server's 409 carries the current state of changed items: apply it to the menu right away. */
export const syncMenuFromCheckoutIssues = createEffect(
  (actions$ = inject(Actions)) =>
    actions$.pipe(
      ofType(CartActions.checkoutFailure),
      switchMap(({ error }) =>
        from(error.issues ?? []).pipe(
          map((issue) =>
            issue.item
              ? MenuLiveActions.itemUpserted({ item: issue.item })
              : MenuLiveActions.itemDeleted({ id: issue.itemId }),
          ),
        ),
      ),
    ),
  { functional: true },
);

export const notifyCheckoutSuccess = createEffect(
  (actions$ = inject(Actions), notify = inject(NotifyService), router = inject(Router)) =>
    actions$.pipe(
      ofType(CartActions.checkoutSuccess),
      // switchMap: the previous snack bar is replaced, so its action stream is dropped too.
      switchMap(({ order }) =>
        notify.info(`Order #${order.number} placed`, 'View orders').onAction(),
      ),
      tap(() => void router.navigate(['/orders'])),
    ),
  { functional: true, dispatch: false },
);

export const notifyCheckoutFailure = createEffect(
  (actions$ = inject(Actions), notify = inject(NotifyService)) =>
    actions$.pipe(
      ofType(CartActions.checkoutFailure),
      tap((action) => {
        if (action.error.code === 'MENU_CHANGED') {
          notify.error('The menu changed while you were ordering. Please review your cart.');
        } else if (isTransient(action.error)) {
          notify.error(
            `${action.error.message} Your cart is saved: try again, the order will not be placed twice.`,
          );
        } else {
          notify.error(action.error.message);
        }
      }),
    ),
  { functional: true, dispatch: false },
);

export const persistCart = createEffect(
  (store = inject(Store)) =>
    store.select(cartFeature.selectCartState).pipe(
      debounceTime(200),
      map(({ lines, discount, checkoutKey }) => JSON.stringify({ lines, discount, checkoutKey })),
      filter(Boolean),
      tap((json) => {
        try {
          localStorage.setItem(CART_STORAGE_KEY, json);
        } catch {
          // Storage may be full or disabled (private mode): the cart still works in memory.
        }
      }),
    ),
  { functional: true, dispatch: false },
);
