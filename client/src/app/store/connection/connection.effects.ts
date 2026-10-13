import { inject } from '@angular/core';
import { Actions, ROOT_EFFECTS_INIT, createEffect, ofType } from '@ngrx/effects';
import { concatLatestFrom } from '@ngrx/operators';
import { type Action, Store } from '@ngrx/store';
import { EMPTY, catchError, expand, filter, fromEvent, map, merge, mergeMap, of, switchMap, tap } from 'rxjs';
import { toApiError } from '../../core/api-error';
import { ApiService } from '../../core/api.service';
import { AuthActions } from '../auth/auth.actions';
import { authFeature } from '../auth/auth.reducer';
import { MenuActions } from '../menu/menu.actions';
import { OrdersActions } from '../orders/orders.actions';
import { ConnectionActions } from './connection.actions';
import { connectionFeature } from './connection.reducer';
import { envelopeToActions } from './event-actions';
import { RealtimeService } from './realtime.service';

export const loadInitialData = createEffect(
  (actions$ = inject(Actions)) =>
    actions$.pipe(
      ofType(ROOT_EFFECTS_INIT),
      map(() => MenuActions.load()),
    ),
  { functional: true },
);

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
      mergeMap((message): Action[] => {
        switch (message.kind) {
          case 'connected':
            return [ConnectionActions.connected({ reconnect: message.reconnect })];
          case 'disconnected':
            return [ConnectionActions.disconnected()];
          case 'event':
            return envelopeToActions(message.envelope);
        }
      }),
    ),
  { functional: true },
);

export const replayMissedEvents = createEffect(
  (actions$ = inject(Actions), store = inject(Store), api = inject(ApiService)) =>
    actions$.pipe(
      ofType(ConnectionActions.connected),
      concatLatestFrom(() => [
        store.select(connectionFeature.selectLastSeq),
        store.select(authFeature.selectStatus),
      ]),
      filter(([, lastSeq]) => lastSeq > 0),
      switchMap(([, lastSeq, authStatus]) =>
        api.getEvents(lastSeq).pipe(
          expand((page) => (page.hasMore ? api.getEvents(page.nextAfter) : EMPTY)),
          mergeMap((page): Action[] =>
            page.reset
              ? authStatus === 'authenticated'
                ? [MenuActions.load(), OrdersActions.load()]
                : [MenuActions.load()]
              : [
                  ...page.events.flatMap(envelopeToActions),
                  ConnectionActions.seqAdvanced({ seq: page.nextAfter }),
                ],
          ),
          catchError((error: unknown) => of(ConnectionActions.replayFailure({ error: toApiError(error) }))),
        ),
      ),
    ),
  { functional: true },
);

export const reloadAfterReplayFailure = createEffect(
  (actions$ = inject(Actions), store = inject(Store)) =>
    actions$.pipe(
      ofType(ConnectionActions.replayFailure),
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
          navigator.onLine ? EMPTY : of(ConnectionActions.browserOffline()),
          fromEvent(window, 'online').pipe(map(() => ConnectionActions.browserOnline())),
          fromEvent(window, 'offline').pipe(map(() => ConnectionActions.browserOffline())),
        ),
  { functional: true },
);

export const reconnectWhenOnline = createEffect(
  (actions$ = inject(Actions), realtime = inject(RealtimeService)) =>
    actions$.pipe(
      ofType(ConnectionActions.browserOnline),
      tap(() => realtime.reconnect()),
    ),
  { functional: true, dispatch: false },
);

