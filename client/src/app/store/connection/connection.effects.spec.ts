import { TestBed } from '@angular/core/testing';
import { provideMockActions } from '@ngrx/effects/testing';
import type { Action } from '@ngrx/store';
import { provideMockStore } from '@ngrx/store/testing';
import { Subject, firstValueFrom, of, toArray } from 'rxjs';
import { ApiService } from '../../core/api.service';
import { type EventsPage, TOPICS } from '../../core/models';
import { menuItem } from '../../testing/fixtures';
import { MenuActions, MenuLiveActions } from '../menu/menu.actions';
import { ConnectionActions } from './connection.actions';
import { replayMissedEvents } from './connection.effects';
import { connectionReducerFor } from '../../testing/store-state';

describe('replayMissedEvents', () => {
  let actions$: Subject<Action>;
  const api = { getEvents: vi.fn() };

  const setup = (lastSeq: number): void => {
    actions$ = new Subject<Action>();
    api.getEvents.mockReset();
    TestBed.configureTestingModule({
      providers: [
        provideMockActions(() => actions$),
        provideMockStore({ initialState: connectionReducerFor(lastSeq) }),
        { provide: ApiService, useValue: api },
      ],
    });
  };

  const run = async (): Promise<Action[]> => {
    const result = firstValueFrom(TestBed.runInInjectionContext(() => replayMissedEvents()).pipe(toArray()));
    actions$.next(ConnectionActions.connected({ reconnect: true }));
    actions$.complete();
    return result;
  };

  it('fetches only the missed events, page by page', async () => {
    setup(10);
    const item = menuItem({ version: 2 });
    const first: EventsPage = {
      events: [{ seq: 11, topic: TOPICS.menu, event: { type: 'item.upserted', item } }],
      nextAfter: 11,
      hasMore: true,
      reset: false,
    };
    const second: EventsPage = {
      events: [{ seq: 13, topic: TOPICS.menu, event: { type: 'item.deleted', id: 'x' } }],
      nextAfter: 14,
      hasMore: false,
      reset: false,
    };
    api.getEvents.mockImplementation((after: number) => of(after === 10 ? first : second));

    const actions = await run();
    expect(api.getEvents.mock.calls.map((c) => c[0])).toEqual([10, 11]);
    expect(actions).toContainEqual(MenuLiveActions.itemUpserted({ item }));
    expect(actions).toContainEqual(MenuLiveActions.itemDeleted({ id: 'x' }));
    // Even events this user may not see move the position forward.
    expect(actions.at(-1)).toEqual(ConnectionActions.seqAdvanced({ seq: 14 }));
    expect(actions).not.toContainEqual(MenuActions.load());
  });

  it('reloads snapshots when the log was pruned', async () => {
    setup(10);
    api.getEvents.mockReturnValue(of({ events: [], nextAfter: 99, hasMore: false, reset: true }));
    expect(await run()).toEqual([MenuActions.load()]);
  });

  it('does nothing before the first snapshot', async () => {
    setup(0);
    expect(await run()).toEqual([]);
    expect(api.getEvents).not.toHaveBeenCalled();
  });
});
