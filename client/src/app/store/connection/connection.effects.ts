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

/**
 * After every (re)connect, fetch only the events missed in between, page by page,
 * instead of reloading full snapshots. Snapshots are reloaded only when the server says
 * the log no longer goes back that far (`reset`).
 */
export const replayMissedEvents = createEffect(
  (actions$ = inject(Actions), store = inject(Store), api = inject(ApiService)) =>
    actions$.pipe(
      ofType(ConnectionActions.connected),
      concatLatestFrom(() => [
        store.select(connectionFeature.selectLastSeq),
        store.select(authFeature.selectStatus),
      ]),
      // Before the first snapshot there is nothing to resume from.
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

/** If the replay itself fails, fall back to fresh snapshots. */
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
          // Opened while already offline (e.g. from the service worker cache): no event fires.
          navigator.onLine ? EMPTY : of(ConnectionActions.browserOffline()),
          fromEvent(window, 'online').pipe(map(() => ConnectionActions.browserOnline())),
          fromEvent(window, 'offline').pipe(map(() => ConnectionActions.browserOffline())),
        ),
  { functional: true },
);

/**
 * Coming back online, an old WebSocket may look alive while events were lost: reconnect
 * on purpose, which also triggers the replay of missed events.
 */
export const reconnectWhenOnline = createEffect(
  (actions$ = inject(Actions), realtime = inject(RealtimeService)) =>
    actions$.pipe(
      ofType(ConnectionActions.browserOnline),
      tap(() => realtime.reconnect()),
    ),
  { functional: true, dispatch: false },
);

