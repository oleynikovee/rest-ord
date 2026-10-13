/**
 * The API contract comes from the shared `@trattoria/contracts` package
 * (types and constants only: zod schemas are not bundled into the app).
 */
import type { MenuItem } from '@trattoria/contracts';

export * from '@trattoria/contracts';

export type MenuItemInput = Omit<MenuItem, 'id' | 'version'>;
