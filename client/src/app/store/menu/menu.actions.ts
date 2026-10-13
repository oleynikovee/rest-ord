import { createActionGroup, emptyProps, props } from '@ngrx/store';
import type { ApiError } from '../../core/api-error';
import type { Category, MenuItem, MenuItemInput, MenuSnapshot } from '../../core/models';

export const MenuActions = createActionGroup({
  source: 'Menu',
  events: {
    Load: emptyProps(),
    'Load Success': props<{ snapshot: MenuSnapshot }>(),
    'Load Failure': props<{ error: ApiError }>(),
  },
});

export const MenuLiveActions = createActionGroup({
  source: 'Menu Live',
  events: {
    'Category Upserted': props<{ category: Category }>(),
    'Category Deleted': props<{ id: string }>(),
    'Item Upserted': props<{ item: MenuItem }>(),
    'Item Deleted': props<{ id: string }>(),
  },
});

export const SetupActions = createActionGroup({
  source: 'Setup',
  events: {
    'Create Category': props<{ name: string }>(),
    'Rename Category': props<{ category: Category; name: string }>(),
    'Delete Category': props<{ category: Category }>(),
    'Create Item': props<{ input: MenuItemInput }>(),
    'Update Item': props<{ previous: MenuItem; changes: Partial<MenuItemInput> }>(),
    'Update Item Failure': props<{ previous: MenuItem; error: ApiError }>(),
    'Delete Item': props<{ item: MenuItem }>(),
    'Request Failure': props<{ error: ApiError }>(),
  },
});
