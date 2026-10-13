import type { MenuItem } from '@trattoria/contracts';

export * from '@trattoria/contracts';

export type MenuItemInput = Omit<MenuItem, 'id' | 'version'>;
