import { type EntityState, createEntityAdapter } from '@ngrx/entity';
import { createFeature, createReducer, on } from '@ngrx/store';
import type { ApiError } from '../../core/api-error';
import type { Category, MenuItem } from '../../core/models';
import { MenuActions, MenuLiveActions, SetupActions } from './menu.actions';

export const categoryAdapter = createEntityAdapter<Category>({
  sortComparer: (a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name),
});
export const itemAdapter = createEntityAdapter<MenuItem>();

export interface MenuState {
  categories: EntityState<Category>;
  items: EntityState<MenuItem>;
  loaded: boolean;
  loading: boolean;
  error: ApiError | null;
}

const initialState: MenuState = {
  categories: categoryAdapter.getInitialState(),
  items: itemAdapter.getInitialState(),
  loaded: false,
  loading: false,
  error: null,
};

function isStale<T extends { id: string; version: number }>(
  state: EntityState<T>,
  incoming: T,
): boolean {
  const current = state.entities[incoming.id];
  return current !== undefined && current.version > incoming.version;
}

function mergeSnapshot<T extends { id: string; version: number }>(
  state: EntityState<T>,
  incoming: T[],
): T[] {
  return incoming.map((entity) => (isStale(state, entity) ? state.entities[entity.id]! : entity));
}

export const menuFeature = createFeature({
  name: 'menu',
  reducer: createReducer(
    initialState,
    on(MenuActions.load, (state) => ({ ...state, loading: true, error: null })),
    on(MenuActions.loadSuccess, (state, { snapshot }) => ({
      ...state,
      categories: categoryAdapter.setAll(
        mergeSnapshot(state.categories, snapshot.categories),
        state.categories,
      ),
      items: itemAdapter.setAll(mergeSnapshot(state.items, snapshot.items), state.items),
      loaded: true,
      loading: false,
    })),
    on(MenuActions.loadFailure, (state, { error }) => ({ ...state, loading: false, error })),

    on(MenuLiveActions.categoryUpserted, (state, { category }) =>
      isStale(state.categories, category)
        ? state
        : { ...state, categories: categoryAdapter.upsertOne(category, state.categories) },
    ),
    on(MenuLiveActions.categoryDeleted, (state, { id }) => ({
      ...state,
      categories: categoryAdapter.removeOne(id, state.categories),
    })),
    on(MenuLiveActions.itemUpserted, (state, { item }) =>
      isStale(state.items, item)
        ? state
        : { ...state, items: itemAdapter.upsertOne(item, state.items) },
    ),
    on(MenuLiveActions.itemDeleted, (state, { id }) => ({
      ...state,
      items: itemAdapter.removeOne(id, state.items),
    })),

    on(SetupActions.updateItem, (state, { previous, changes }) => ({
      ...state,
      items: itemAdapter.updateOne({ id: previous.id, changes }, state.items),
    })),
    on(SetupActions.updateItemFailure, (state, { previous, error }) => {
      const latest = error.current && 'categoryId' in error.current ? error.current : previous;
      const current = state.items.entities[previous.id];
      if (!current || current.version > latest.version) return state;
      return { ...state, items: itemAdapter.setOne(latest, state.items) };
    }),
  ),
});
