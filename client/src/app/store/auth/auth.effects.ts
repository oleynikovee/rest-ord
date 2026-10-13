import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { Actions, ROOT_EFFECTS_INIT, createEffect, ofType } from '@ngrx/effects';
import { catchError, exhaustMap, map, of, switchMap, tap } from 'rxjs';
import { toApiError } from '../../core/api-error';
import { ApiService } from '../../core/api.service';
import { NotifyService } from '../../core/notify.service';
import { RealtimeService } from '../connection/realtime.service';
import { AuthActions } from './auth.actions';

export const loadSession = createEffect(
  (actions$ = inject(Actions), api = inject(ApiService)) =>
    actions$.pipe(
      ofType(ROOT_EFFECTS_INIT),
      switchMap(() =>
        api.getSession().pipe(
          map(({ user }) => AuthActions.sessionLoaded({ user })),
          catchError((error: unknown) =>
            of(AuthActions.sessionLoadFailure({ error: toApiError(error) })),
          ),
        ),
      ),
    ),
  { functional: true },
);

export const signIn = createEffect(
  (actions$ = inject(Actions), api = inject(ApiService)) =>
    actions$.pipe(
      ofType(AuthActions.login, AuthActions.register),
      exhaustMap((action) => {
        const request$ =
          action.type === AuthActions.login.type
            ? api.login(action.request)
            : api.register(action.request);
        return request$.pipe(
          map(({ user }) => AuthActions.signInSuccess({ user, returnUrl: action.returnUrl })),
          catchError((error: unknown) => of(AuthActions.signInFailure({ error: toApiError(error) }))),
        );
      }),
    ),
  { functional: true },
);

export const navigateAfterSignIn = createEffect(
  (actions$ = inject(Actions), router = inject(Router)) =>
    actions$.pipe(
      ofType(AuthActions.signInSuccess),
      tap(({ returnUrl }) => void router.navigateByUrl(returnUrl)),
    ),
  { functional: true, dispatch: false },
);

export const logout = createEffect(
  (actions$ = inject(Actions), api = inject(ApiService)) =>
    actions$.pipe(
      ofType(AuthActions.logout),
      exhaustMap(() =>
        api.logout().pipe(
          map(() => AuthActions.logoutSuccess()),
          catchError(() => of(AuthActions.logoutSuccess())),
        ),
      ),
    ),
  { functional: true },
);

export const navigateAfterLogout = createEffect(
  (actions$ = inject(Actions), router = inject(Router)) =>
    actions$.pipe(
      ofType(AuthActions.logoutSuccess),
      tap(() => void router.navigateByUrl('/menu')),
    ),
  { functional: true, dispatch: false },
);

export const redirectOnSessionExpired = createEffect(
  (
    actions$ = inject(Actions),
    router = inject(Router),
    notify = inject(NotifyService),
  ) =>
    actions$.pipe(
      ofType(AuthActions.sessionExpired),
      tap(() => {
        notify.error('Your session has ended. Please sign in again.');
        void router.navigate(['/login'], { queryParams: { returnUrl: router.url } });
      }),
    ),
  { functional: true, dispatch: false },
);

export const reconnectRealtime = createEffect(
  (actions$ = inject(Actions), realtime = inject(RealtimeService)) =>
    actions$.pipe(
      ofType(AuthActions.signInSuccess, AuthActions.logoutSuccess, AuthActions.sessionExpired),
      tap(() => realtime.reconnect()),
    ),
  { functional: true, dispatch: false },
);
