import { createSelector } from '@ngrx/store';
import type { Category, MenuItem } from '../../core/models';
import { categoryAdapter, itemAdapter, menuFeature } from './menu.reducer';

const categorySelectors = categoryAdapter.getSelectors();
const itemSelectors = itemAdapter.getSelectors();

export const selectCategories = createSelector(
  menuFeature.selectCategories,
  categorySelectors.selectAll,
);
export const selectItemEntities = createSelector(
  menuFeature.selectItems,
  itemSelectors.selectEntities,
);
export const selectAllItems = createSelector(menuFeature.selectItems, itemSelectors.selectAll);

/** Items grouped by category in menu order, each group sorted by name. */
export const selectMenuSections = createSelector(
  selectCategories,
  selectAllItems,
  (categories, items): { category: Category; items: MenuItem[] }[] => {
    const byCategory = new Map<string, MenuItem[]>();
    for (const item of items) {
      const list = byCategory.get(item.categoryId);
      if (list) list.push(item);
      else byCategory.set(item.categoryId, [item]);
    }
    return categories.map((category) => ({
      category,
      items: (byCategory.get(category.id) ?? []).sort((a, b) => a.name.localeCompare(b.name)),
    }));
  },
);
