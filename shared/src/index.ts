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
  EventEnvelopeSchema,
  EventsPageSchema,
  OrderLineSchema,
  OrderSchema,
  OrdersPageSchema,
  OrdersQuerySchema,
  PromoCodeInputSchema,
  PromoCodeSchema,
  PromoQuoteSchema,
  PromoRuleSchema,
  RegisterRequestSchema,
  SessionResponseSchema,
  UserSchema,
  ValidatePromoRequestSchema,
} from './schemas.js';
import { MENU_CHANGE_KINDS, ORDER_STATUSES, PROMO_KINDS, ROLES } from './constants.js';

export * from './constants.js';

export type Cents = number;

export type Category = z.infer<typeof CategorySchema>;
export type MenuItem = z.infer<typeof MenuItemSchema>;
export type MenuSnapshot = z.infer<typeof MenuSnapshotSchema>;
export type OrderStatus = (typeof ORDER_STATUSES)[number];
export type OrderLine = z.infer<typeof OrderLineSchema>;
export type Order = z.infer<typeof OrderSchema>;
export type OrdersPage = z.infer<typeof OrdersPageSchema>;
export type OrdersQuery = z.infer<typeof OrdersQuerySchema>;
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
export type PromoKind = (typeof PROMO_KINDS)[number];
export type PromoRule = z.infer<typeof PromoRuleSchema>;
export type PromoCode = z.infer<typeof PromoCodeSchema>;
export type PromoCodeInput = z.infer<typeof PromoCodeInputSchema>;
export type ValidatePromoRequest = z.infer<typeof ValidatePromoRequestSchema>;
export type PromoQuote = z.infer<typeof PromoQuoteSchema>;
export type MenuEvent = z.infer<typeof MenuEventSchema>;
export type OrderEvent = z.infer<typeof OrderEventSchema>;
export type EventEnvelope = z.infer<typeof EventEnvelopeSchema>;
export type EventsPage = z.infer<typeof EventsPageSchema>;

export function nextStatus(status: OrderStatus): OrderStatus | null {
  return ORDER_STATUSES[ORDER_STATUSES.indexOf(status) + 1] ?? null;
}

export function computeDiscount(rule: PromoRule, subtotal: Cents): Cents {
  if (subtotal < rule.minOrderAmount) return 0;
  const raw = rule.kind === 'FIXED' ? rule.value : Math.floor((subtotal * rule.value) / 100);
  const capped = rule.maxDiscount === null ? raw : Math.min(raw, rule.maxDiscount);
  return Math.max(0, Math.min(capped, subtotal));
}

export function normalizePromoCode(code: string): string {
  return code.trim().toUpperCase();
}
