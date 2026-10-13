import { inject } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { type Action, Store } from '@ngrx/store';
import { type Observable, catchError, concatMap, groupBy, map, mergeMap, of, switchMap, take, tap } from 'rxjs';
import { toApiError } from '../../core/api-error';
import { ApiService } from '../../core/api.service';
import { NotifyService } from '../../core/notify.service';
import { MenuActions, MenuLiveActions, SetupActions } from './menu.actions';
import { selectItemEntities } from './menu.selectors';

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
                .updateCategory(action.category, action.name)
                .pipe(map((category) => MenuLiveActions.categoryUpserted({ category })));
            case SetupActions.deleteCategory.type:
              return api
                .deleteCategory(action.category)
                .pipe(map(() => MenuLiveActions.categoryDeleted({ id: action.category.id })));
            case SetupActions.createItem.type:
              return api
                .createItem(action.input)
                .pipe(map((item) => MenuLiveActions.itemUpserted({ item })));
            case SetupActions.deleteItem.type:
              return api
                .deleteItem(action.item)
                .pipe(map(() => MenuLiveActions.itemDeleted({ id: action.item.id })));
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
  (actions$ = inject(Actions), api = inject(ApiService), store = inject(Store)) =>
    actions$.pipe(
      ofType(SetupActions.updateItem),
      groupBy(({ previous }) => previous.id),
      mergeMap((edits$) =>
        edits$.pipe(
          concatMap(({ previous, changes }) =>
            store.select(selectItemEntities).pipe(
              take(1),
              switchMap((items) =>
                api.updateItem({ id: previous.id, version: items[previous.id]?.version ?? previous.version }, changes),
              ),
              map((item) => MenuLiveActions.itemUpserted({ item })),
              catchError((error: unknown) =>
                of(SetupActions.updateItemFailure({ previous, error: toApiError(error) })),
              ),
            ),
          ),
        ),
      ),
    ),
  { functional: true },
);

export const applyConflictState = createEffect(
  (actions$ = inject(Actions)) =>
    actions$.pipe(
      ofType(SetupActions.requestFailure),
      mergeMap(({ error }) => {
        const current = error.current;
        if (current && 'categoryId' in current) return [MenuLiveActions.itemUpserted({ item: current })];
        if (current && 'sortOrder' in current) return [MenuLiveActions.categoryUpserted({ category: current })];
        return [];
      }),
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
