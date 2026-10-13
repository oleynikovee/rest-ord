import { z } from 'zod';
import { MENU_CHANGE_KINDS, ORDER_STATUSES, ORDERS_PAGE_SIZE, PROMO_KINDS, ROLES, TOPICS } from './constants.js';

const id = z.uuid();
const cents = z.int().min(0);
const timestamp = z.iso.datetime({ offset: true });

export const CategorySchema = z
  .object({
    id,
    name: z.string().min(1).max(60),
    sortOrder: z.int().min(0),
    version: z.int().min(1),
  })
  .meta({ id: 'Category' });

export const MenuItemSchema = z
  .object({
    id,
    categoryId: id,
    name: z.string().min(1).max(100),
    description: z.string().max(300),
    price: cents.nullable(),
    available: z.boolean(),
    openPrice: z.boolean(),
    version: z.int().min(1),
  })
  .meta({ id: 'MenuItem' });

export const CategoryInputSchema = z
  .object({
    name: z.string().min(1).max(60),
    sortOrder: z.int().min(0).optional(),
  })
  .meta({ id: 'CategoryInput' });

export const CategoryPatchSchema = CategoryInputSchema.partial().meta({ id: 'CategoryPatch' });

export const MenuItemInputSchema = z
  .object({
    categoryId: id,
    name: z.string().min(1).max(100),
    description: z.string().max(300).optional(),
    price: cents.max(1_000_000).nullable().optional(),
    available: z.boolean().optional(),
    openPrice: z.boolean().optional(),
  })
  .meta({ id: 'MenuItemInput' });

export const MenuItemPatchSchema = MenuItemInputSchema.partial().meta({ id: 'MenuItemPatch' });

export const ClientConfigSchema = z
  .object({
    sentryDsn: z.string().nullable(),
    environment: z.string(),
    release: z.string().nullable(),
  })
  .meta({ id: 'ClientConfig' });

export const MenuSnapshotSchema = z
  .object({
    categories: z.array(CategorySchema),
    items: z.array(MenuItemSchema),
    seq: z.int().min(0),
  })
  .meta({ id: 'MenuSnapshot' });

export const OrderStatusSchema = z.enum(ORDER_STATUSES);

export const OrderLineSchema = z
  .object({
    itemId: id,
    name: z.string(),
    unitPrice: cents,
    quantity: z.int().min(1).max(99),
    openPrice: z.boolean(),
    lineTotal: cents,
  })
  .meta({ id: 'OrderLine' });

export const OrderSchema = z
  .object({
    id,
    number: z.int().min(1),
    userId: id.nullable(),
    customerName: z.string(),
    lines: z.array(OrderLineSchema),
    subtotal: cents,
    discount: cents,
    total: cents,
    promoCode: z.string().nullable(),
    status: OrderStatusSchema,
    createdAt: timestamp,
    updatedAt: timestamp,
  })
  .meta({ id: 'Order' });

export const OrdersPageSchema = z
  .object({
    items: z.array(OrderSchema),
    nextCursor: z.int().min(1).nullable(),
  })
  .meta({ id: 'OrdersPage' });

export const OrdersQuerySchema = z
  .object({
    limit: z.coerce.number().int().min(1).max(ORDERS_PAGE_SIZE.max).optional(),
    before: z.coerce.number().int().min(1).optional(),
  })
  .meta({ id: 'OrdersQuery' });

export const CreateOrderRequestSchema = z
  .object({
    lines: z
      .array(
        z.object({
          itemId: id,
          quantity: z.int().min(1).max(99),
          unitPrice: cents,
          openPrice: z.boolean(),
        }),
      )
      .min(1)
      .max(100),
    promoCode: z.string().min(1).max(40).optional(),
  })
  .meta({ id: 'CreateOrderRequest' });

const promoCode = z
  .string()
  .regex(/^[A-Z0-9_-]{3,40}$/, 'Use 3-40 letters, digits, "-" or "_"');

export const PromoRuleSchema = z
  .object({
    code: promoCode,
    kind: z.enum(PROMO_KINDS),
    value: z.int().min(1),
    minOrderAmount: cents,
    maxDiscount: cents.nullable(),
  })
  .meta({ id: 'PromoRule' });

export const PromoCodeSchema = PromoRuleSchema.extend({
  id,
  description: z.string().max(200),
  usageLimit: z.int().min(1).nullable(),
  perUserLimit: z.int().min(1).nullable(),
  usedCount: z.int().min(0),
  startsAt: timestamp.nullable(),
  expiresAt: timestamp.nullable(),
  active: z.boolean(),
  version: z.int().min(1),
}).meta({ id: 'PromoCode' });

export const PromoCodeInputSchema = PromoCodeSchema.omit({
  id: true,
  usedCount: true,
  version: true,
}).meta({ id: 'PromoCodeInput' });

export const ValidatePromoRequestSchema = z
  .object({
    code: z.string().min(1).max(40),
    subtotal: cents,
  })
  .meta({ id: 'ValidatePromoRequest' });

export const PromoQuoteSchema = z
  .object({
    rule: PromoRuleSchema,
    description: z.string(),
    discount: cents,
  })
  .meta({ id: 'PromoQuote' });

export const MenuChangeIssueSchema = z
  .object({
    itemId: id,
    kind: z.enum(MENU_CHANGE_KINDS),
    item: MenuItemSchema.optional(),
  })
  .meta({ id: 'MenuChangeIssue' });

export const RoleSchema = z.enum(ROLES);

export const UserSchema = z
  .object({
    id,
    email: z.email(),
    name: z.string().min(1).max(60),
    role: RoleSchema,
  })
  .meta({ id: 'User' });

export const LoginRequestSchema = z
  .object({
    email: z.email(),
    password: z.string().min(1).max(200),
  })
  .meta({ id: 'LoginRequest' });

export const RegisterRequestSchema = z
  .object({
    email: z.email(),
    name: z.string().min(1).max(60),
    password: z.string().min(8).max(200),
  })
  .meta({ id: 'RegisterRequest' });

export const SessionResponseSchema = z
  .object({
    user: UserSchema,
  })
  .meta({ id: 'SessionResponse' });

export const CurrentSessionResponseSchema = z
  .object({
    user: UserSchema.nullable(),
  })
  .meta({ id: 'CurrentSessionResponse' });

export const MenuEventSchema = z
  .discriminatedUnion('type', [
    z.object({ type: z.literal('category.upserted'), category: CategorySchema }),
    z.object({ type: z.literal('category.deleted'), id }),
    z.object({ type: z.literal('item.upserted'), item: MenuItemSchema }),
    z.object({ type: z.literal('item.deleted'), id }),
  ])
  .meta({ id: 'MenuEvent' });

export const OrderEventSchema = z
  .object({
    type: z.literal('order.upserted'),
    order: OrderSchema,
  })
  .meta({ id: 'OrderEvent' });

export const EventEnvelopeSchema = z
  .discriminatedUnion('topic', [
    z.object({ seq: z.int().min(1), topic: z.literal(TOPICS.menu), event: MenuEventSchema }),
    z.object({ seq: z.int().min(1), topic: z.literal(TOPICS.orders), event: OrderEventSchema }),
  ])
  .meta({ id: 'EventEnvelope' });

export const EventsPageSchema = z
  .object({
    events: z.array(EventEnvelopeSchema),
    nextAfter: z.int().min(0),
    hasMore: z.boolean(),
    reset: z.boolean(),
  })
  .meta({ id: 'EventsPage' });

export const EventsQuerySchema = z
  .object({
    after: z.coerce.number().int().min(0),
  })
  .meta({ id: 'EventsQuery' });

export const ApiErrorBodySchema = z
  .object({
    statusCode: z.int().optional(),
    code: z.string().optional(),
    message: z.union([z.string(), z.array(z.string())]),
    issues: z.array(MenuChangeIssueSchema).optional(),
    current: z.union([MenuItemSchema, CategorySchema, PromoCodeSchema]).optional(),
  })
  .meta({ id: 'ApiError' });
