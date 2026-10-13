import { menuItem } from '../../testing/fixtures';
import { MenuActions, MenuLiveActions, SetupActions } from './menu.actions';
import { menuFeature } from './menu.reducer';

const { reducer } = menuFeature;
const initial = reducer(undefined, { type: 'init' });

describe('menu reducer', () => {
  const loaded = reducer(
    initial,
    MenuActions.loadSuccess({ snapshot: { categories: [], items: [menuItem({ version: 2 })], seq: 0 } }),
  );

  it('applies newer real-time updates and ignores stale ones', () => {
    const newer = reducer(
      loaded,
      MenuLiveActions.itemUpserted({ item: menuItem({ price: 1500, version: 3 }) }),
    );
    expect(newer.items.entities['pizza']?.price).toBe(1500);

    const stale = reducer(
      newer,
      MenuLiveActions.itemUpserted({ item: menuItem({ price: 900, version: 1 }) }),
    );
    expect(stale.items.entities['pizza']?.price).toBe(1500);
  });

  it('keeps live updates that are newer than a late snapshot', () => {
    const live = reducer(
      loaded,
      MenuLiveActions.itemUpserted({ item: menuItem({ available: false, version: 5 }) }),
    );
    const resynced = reducer(
      live,
      MenuActions.loadSuccess({ snapshot: { categories: [], items: [menuItem({ version: 4 })], seq: 0 } }),
    );
    expect(resynced.items.entities['pizza']?.available).toBe(false);
  });

  it('updates optimistically and rolls back on failure', () => {
    const previous = loaded.items.entities['pizza']!;
    const optimistic = reducer(
      loaded,
      SetupActions.updateItem({ previous, changes: { available: false } }),
    );
    expect(optimistic.items.entities['pizza']?.available).toBe(false);

    const rolledBack = reducer(
      optimistic,
      SetupActions.updateItemFailure({ previous, error: { status: 500, code: 'X', message: '' } }),
    );
    expect(rolledBack.items.entities['pizza']?.available).toBe(true);
  });

  it('removes deleted items', () => {
    const state = reducer(loaded, MenuLiveActions.itemDeleted({ id: 'pizza' }));
    expect(state.items.ids).toEqual([]);
  });

  it('shows the version of the other admin after a conflict', () => {
    const previous = loaded.items.entities['pizza']!;
    const optimistic = reducer(loaded, SetupActions.updateItem({ previous, changes: { price: 900 } }));
    const theirs = menuItem({ price: 1500, version: 3 });
    const resolved = reducer(
      optimistic,
      SetupActions.updateItemFailure({ previous, error: { status: 412, code: 'VERSION_CONFLICT', message: '', current: theirs } }),
    );
    expect(resolved.items.entities['pizza']).toEqual(theirs);
  });
});
