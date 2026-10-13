/**
 * Runtime-free entry point: constants and types only, so the client bundle does
 * not include zod. Schemas live in `@trattoria/contracts/schemas`.
 */
import type { z } from 'zod';
import type {
  ApiErrorBodySchema,
  CategorySchema,
  CreateOrderRequestSchema,
  CurrentSessionResponseSchema,
  LoginRequestSchema,
  MenuChangeIssueSchema,
  MenuEventSchema,
  MenuItemSchema,
  MenuSnapshotSchema,
  OrderEventSchema,
  OrderLineSchema,
  OrderSchema,
  RegisterRequestSchema,
  SessionResponseSchema,
  UserSchema,
} from './schemas.js';
import { MENU_CHANGE_KINDS, ORDER_STATUSES, ROLES } from './constants.js';

export * from './constants.js';

/** Integer minor units: 1999 means 19.99. */
export type Cents = number;

export type Category = z.infer<typeof CategorySchema>;
export type MenuItem = z.infer<typeof MenuItemSchema>;
export type MenuSnapshot = z.infer<typeof MenuSnapshotSchema>;
export type OrderStatus = (typeof ORDER_STATUSES)[number];
export type OrderLine = z.infer<typeof OrderLineSchema>;
export type Order = z.infer<typeof OrderSchema>;
export type CreateOrderRequest = z.infer<typeof CreateOrderRequestSchema>;
export type MenuChangeKind = (typeof MENU_CHANGE_KINDS)[number];
export type MenuChangeIssue = z.infer<typeof MenuChangeIssueSchema>;
export type ApiErrorBody = z.infer<typeof ApiErrorBodySchema>;
export type Role = (typeof ROLES)[number];
export type User = z.infer<typeof UserSchema>;
export type LoginRequest = z.infer<typeof LoginRequestSchema>;
export type RegisterRequest = z.infer<typeof RegisterRequestSchema>;
export type SessionResponse = z.infer<typeof SessionResponseSchema>;
export type CurrentSessionResponse = z.infer<typeof CurrentSessionResponseSchema>;
export type MenuEvent = z.infer<typeof MenuEventSchema>;
export type OrderEvent = z.infer<typeof OrderEventSchema>;

export function nextStatus(status: OrderStatus): OrderStatus | null {
  return ORDER_STATUSES[ORDER_STATUSES.indexOf(status) + 1] ?? null;
}
