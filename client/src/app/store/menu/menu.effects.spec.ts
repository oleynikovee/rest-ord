import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { provideMockActions } from '@ngrx/effects/testing';
import type { Action } from '@ngrx/store';
import { MockStore, provideMockStore } from '@ngrx/store/testing';
import { Subject, firstValueFrom, take, throwError, toArray } from 'rxjs';
import { ApiService } from '../../core/api.service';
import type { MenuItem } from '../../core/models';
import { menuItem } from '../../testing/fixtures';
import { MenuLiveActions, SetupActions } from './menu.actions';
import { updateItem } from './menu.effects';
import { selectItemEntities } from './menu.selectors';

describe('menu effects: optimistic locking', () => {
  let actions$: Subject<Action>;
  let store: MockStore;
  const api = { updateItem: vi.fn() };

  beforeEach(() => {
    actions$ = new Subject<Action>();
    api.updateItem.mockReset();
    TestBed.configureTestingModule({
      providers: [
        provideMockActions(() => actions$),
        provideMockStore(),
        { provide: ApiService, useValue: api },
      ],
    });
    store = TestBed.inject(MockStore);
  });

  it('sends quick edits of one item one by one, each with the latest version', async () => {
    const pizza = menuItem({ version: 3 });
    store.overrideSelector(selectItemEntities, { pizza });
    const responses = [new Subject<MenuItem>(), new Subject<MenuItem>()];
    api.updateItem.mockReturnValueOnce(responses[0]).mockReturnValueOnce(responses[1]);
    const result = firstValueFrom(TestBed.runInInjectionContext(() => updateItem()).pipe(take(2), toArray()));

    actions$.next(SetupActions.updateItem({ previous: pizza, changes: { available: false } }));
    actions$.next(SetupActions.updateItem({ previous: pizza, changes: { available: true } }));
    expect(api.updateItem).toHaveBeenCalledTimes(1);
    expect(api.updateItem.mock.calls[0][0]).toEqual({ id: 'pizza', version: 3 });

    store.overrideSelector(selectItemEntities, { pizza: { ...pizza, version: 4 } });
    store.refreshState();
    responses[0].next({ ...pizza, available: false, version: 4 });
    responses[0].complete();

    expect(api.updateItem).toHaveBeenCalledTimes(2);
    expect(api.updateItem.mock.calls[1][0]).toEqual({ id: 'pizza', version: 4 });
    responses[1].next({ ...pizza, version: 5 });
    responses[1].complete();
    expect((await result).map((a) => a.type)).toEqual([
      MenuLiveActions.itemUpserted.type,
      MenuLiveActions.itemUpserted.type,
    ]);
  });

  it('reports a conflict together with the current state', async () => {
    const pizza = menuItem({ version: 3 });
    const theirs = { ...pizza, price: 1500, version: 4 };
    store.overrideSelector(selectItemEntities, { pizza });
    api.updateItem.mockReturnValue(
      throwError(() => new HttpErrorResponse({ status: 412, error: { code: 'VERSION_CONFLICT', message: 'x', current: theirs } })),
    );
    const result = firstValueFrom(TestBed.runInInjectionContext(() => updateItem()));
    actions$.next(SetupActions.updateItem({ previous: pizza, changes: { price: 900 } }));

    const action = (await result) as ReturnType<typeof SetupActions.updateItemFailure>;
    expect(action.type).toBe(SetupActions.updateItemFailure.type);
    expect(action.error).toMatchObject({ status: 412, code: 'VERSION_CONFLICT', current: theirs });
  });
});
