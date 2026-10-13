import { inject } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import type { Action } from '@ngrx/store';
import { type Observable, catchError, map, mergeMap, of, switchMap, tap } from 'rxjs';
import { toApiError } from '../../core/api-error';
import { ApiService } from '../../core/api.service';
import { NotifyService } from '../../core/notify.service';
import { MenuActions, MenuLiveActions, SetupActions } from './menu.actions';

export const loadMenu = createEffect(
  (actions$ = inject(Actions), api = inject(ApiService)) =>
    actions$.pipe(
      ofType(MenuActions.load),
      switchMap(() =>
        api.getMenu().pipe(
          map((snapshot) => MenuActions.loadSuccess({ snapshot })),
          catchError((error: unknown) => of(MenuActions.loadFailure({ error: toApiError(error) }))),
        ),
      ),
    ),
  { functional: true },
);

/**
 * Successful responses are applied right away (not only via WebSocket), so the
 * admin sees the result even while the live connection is down.
 */
export const setupRequests = createEffect(
  (actions$ = inject(Actions), api = inject(ApiService)) =>
    actions$.pipe(
      ofType(
        SetupActions.createCategory,
        SetupActions.renameCategory,
        SetupActions.deleteCategory,
        SetupActions.createItem,
        SetupActions.deleteItem,
      ),
      mergeMap((action) => {
        const request$ = ((): Observable<Action> => {
          switch (action.type) {
            case SetupActions.createCategory.type:
              return api
                .createCategory(action.name)
                .pipe(map((category) => MenuLiveActions.categoryUpserted({ category })));
            case SetupActions.renameCategory.type:
              return api
                .updateCategory(action.id, action.name)
                .pipe(map((category) => MenuLiveActions.categoryUpserted({ category })));
            case SetupActions.deleteCategory.type:
              return api
                .deleteCategory(action.id)
                .pipe(map(() => MenuLiveActions.categoryDeleted({ id: action.id })));
            case SetupActions.createItem.type:
              return api
                .createItem(action.input)
                .pipe(map((item) => MenuLiveActions.itemUpserted({ item })));
            case SetupActions.deleteItem.type:
              return api
                .deleteItem(action.id)
                .pipe(map(() => MenuLiveActions.itemDeleted({ id: action.id })));
          }
        })();
        return request$.pipe(
          catchError((error: unknown) =>
            of(SetupActions.requestFailure({ error: toApiError(error) })),
          ),
        );
      }),
    ),
  { functional: true },
);

export const updateItem = createEffect(
  (actions$ = inject(Actions), api = inject(ApiService)) =>
    actions$.pipe(
      ofType(SetupActions.updateItem),
      mergeMap(({ previous, changes }) =>
        api.updateItem(previous.id, changes).pipe(
          map((item) => MenuLiveActions.itemUpserted({ item })),
          catchError((error: unknown) =>
            of(SetupActions.updateItemFailure({ previous, error: toApiError(error) })),
          ),
        ),
      ),
    ),
  { functional: true },
);

export const notifySetupFailures = createEffect(
  (actions$ = inject(Actions), notify = inject(NotifyService)) =>
    actions$.pipe(
      ofType(SetupActions.requestFailure, SetupActions.updateItemFailure),
      tap(({ error }) => notify.error(error.message)),
    ),
  { functional: true, dispatch: false },
);

export const notifyLoadFailure = createEffect(
  (actions$ = inject(Actions), notify = inject(NotifyService)) =>
    actions$.pipe(
      ofType(MenuActions.loadFailure),
      tap(({ error }) => notify.error(`Could not load the menu. ${error.message}`)),
    ),
  { functional: true, dispatch: false },
);
