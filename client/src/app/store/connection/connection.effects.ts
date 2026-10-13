import { inject } from '@angular/core';
import { Actions, ROOT_EFFECTS_INIT, createEffect, ofType } from '@ngrx/effects';
import { concatLatestFrom } from '@ngrx/operators';
import { type Action, Store } from '@ngrx/store';
import { filter, fromEvent, map, merge, mergeMap, of, switchMap } from 'rxjs';
import { AuthActions } from '../auth/auth.actions';
import { authFeature } from '../auth/auth.reducer';
import { MenuActions, MenuLiveActions } from '../menu/menu.actions';
import { OrdersActions } from '../orders/orders.actions';
import { ConnectionActions } from './connection.actions';
import { RealtimeService } from './realtime.service';

/** Initial data is loaded over HTTP so the app works even if WebSockets are blocked. */
export const loadInitialData = createEffect(
  (actions$ = inject(Actions)) =>
    actions$.pipe(
      ofType(ROOT_EFFECTS_INIT),
      map(() => MenuActions.load()),
    ),
  { functional: true },
);

/** Orders need a session: load them once it is known, and again after every sign-in. */
export const loadOrdersForSession = createEffect(
  (actions$ = inject(Actions)) =>
    actions$.pipe(
      ofType(AuthActions.sessionLoaded, AuthActions.signInSuccess),
      filter((action) => action.user !== null),
      map(() => OrdersActions.load()),
    ),
  { functional: true },
);

export const realtimeEvents = createEffect(
  (actions$ = inject(Actions), realtime = inject(RealtimeService)) =>
    actions$.pipe(
      ofType(ROOT_EFFECTS_INIT),
      switchMap(() => realtime.events$),
      map((message): Action => {
        switch (message.kind) {
          case 'connected':
            return ConnectionActions.connected({ reconnect: message.reconnect });
          case 'disconnected':
            return ConnectionActions.disconnected();
          case 'order':
            return OrdersActions.orderUpserted({ order: message.event.order });
          case 'menu': {
            const event = message.event;
            switch (event.type) {
              case 'category.upserted':
                return MenuLiveActions.categoryUpserted({ category: event.category });
              case 'category.deleted':
                return MenuLiveActions.categoryDeleted({ id: event.id });
              case 'item.upserted':
                return MenuLiveActions.itemUpserted({ item: event.item });
              case 'item.deleted':
                return MenuLiveActions.itemDeleted({ id: event.id });
            }
          }
        }
      }),
    ),
  { functional: true },
);

/** Events missed while disconnected are recovered by re-fetching the snapshots. */
export const resyncAfterReconnect = createEffect(
  (actions$ = inject(Actions), store = inject(Store)) =>
    actions$.pipe(
      ofType(ConnectionActions.connected),
      filter(({ reconnect }) => reconnect),
      concatLatestFrom(() => store.select(authFeature.selectStatus)),
      mergeMap(([, status]) =>
        status === 'authenticated' ? [MenuActions.load(), OrdersActions.load()] : [MenuActions.load()],
      ),
    ),
  { functional: true },
);

export const browserConnectivity = createEffect(
  () =>
    typeof window === 'undefined'
      ? of()
      : merge(
          fromEvent(window, 'online').pipe(map(() => ConnectionActions.browserOnline())),
          fromEvent(window, 'offline').pipe(map(() => ConnectionActions.browserOffline())),
        ),
  { functional: true },
);
