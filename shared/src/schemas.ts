/**
 * The API contract as zod schemas: the single source of truth for the TypeScript
 * types, the OpenAPI document and runtime contract tests.
 * All money values are integer minor units (cents).
 */
import { z } from 'zod';
import { MENU_CHANGE_KINDS, ORDER_STATUSES, ORDERS_PAGE_SIZE, ROLES } from './constants.js';

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
    /** `null` only for open-price items: their price is entered when ordering. */
    price: cents.nullable(),
    available: z.boolean(),
    openPrice: z.boolean(),
    /** Incremented on every change. */
    version: z.int().min(1),
  })
  .meta({ id: 'MenuItem' });

export const MenuSnapshotSchema = z
  .object({
    categories: z.array(CategorySchema),
    items: z.array(MenuItemSchema),
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
    /** `null` only for orders created before authentication existed. */
    userId: id.nullable(),
    customerName: z.string(),
    lines: z.array(OrderLineSchema),
    subtotal: cents,
    discount: cents,
    total: cents,
    status: OrderStatusSchema,
    createdAt: timestamp,
    updatedAt: timestamp,
  })
  .meta({ id: 'Order' });

/** Cursor pagination: pass `nextCursor` as `before` to get the next (older) page. */
export const OrdersPageSchema = z
  .object({
    items: z.array(OrderSchema),
    /** Order number to continue from, `null` when there are no older orders. */
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
          /** The price the user saw, or entered for an open-price item. */
          unitPrice: cents,
          openPrice: z.boolean(),
        }),
      )
      .min(1)
      .max(100),
    discount: cents,
  })
  .meta({ id: 'CreateOrderRequest' });

export const MenuChangeIssueSchema = z
  .object({
    itemId: id,
    kind: z.enum(MENU_CHANGE_KINDS),
    /** Current menu item, absent when it was removed. */
    item: MenuItemSchema.optional(),
  })
  .meta({ id: 'MenuChangeIssue' });

export const ApiErrorBodySchema = z
  .object({
    statusCode: z.int().optional(),
    code: z.string().optional(),
    message: z.union([z.string(), z.array(z.string())]),
    issues: z.array(MenuChangeIssueSchema).optional(),
    /** With 412 VERSION_CONFLICT: the current state of the entity that was edited. */
    current: z.union([MenuItemSchema, CategorySchema]).optional(),
  })
  .meta({ id: 'ApiError' });

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
