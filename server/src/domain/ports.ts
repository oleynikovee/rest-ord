import type {
  Category,
  MenuItem,
  MenuSnapshot,
  NewOrder,
  CreateOrderResult,
  Order,
  PromoCode,
  PromoCodeInput,
  PromoRedemption,
  UserRecord,
} from './models.js';

/**
 * Storage and infrastructure ports. Abstract classes double as Nest DI tokens,
 * so services do not know whether Postgres/Redis or the in-memory fallback is used.
 */

export type CategoryInput = Pick<Category, 'name' | 'sortOrder'>;
export type MenuItemInput = Omit<MenuItem, 'id' | 'version'>;

/**
 * Result of a conditional (optimistically locked) write: it only applies when the
 * stored version still equals the version the client based its change on.
 */
export type VersionedWrite<T> =
  | { status: 'ok'; value: T }
  | { status: 'not_found' }
  | { status: 'conflict'; current: T };

export abstract class MenuRepository {
  abstract getSnapshot(): Promise<MenuSnapshot>;
  abstract findItems(ids: string[]): Promise<MenuItem[]>;
  abstract findItem(id: string): Promise<MenuItem | null>;
  abstract findCategory(id: string): Promise<Category | null>;
  abstract countItemsInCategory(categoryId: string): Promise<number>;
  abstract createCategory(input: CategoryInput): Promise<Category>;
  abstract updateCategory(
    id: string,
    input: CategoryInput,
    expectedVersion: number,
  ): Promise<VersionedWrite<Category>>;
  abstract deleteCategory(id: string, expectedVersion: number): Promise<VersionedWrite<Category>>;
  abstract createItem(input: MenuItemInput): Promise<MenuItem>;
  abstract updateItem(
    id: string,
    input: MenuItemInput,
    expectedVersion: number,
  ): Promise<VersionedWrite<MenuItem>>;
  abstract deleteItem(id: string, expectedVersion: number): Promise<VersionedWrite<MenuItem>>;
  abstract isEmpty(): Promise<boolean>;
  abstract seed(snapshot: MenuSnapshot): Promise<void>;
}

export abstract class UsersRepository {
  abstract findById(id: string): Promise<UserRecord | null>;
  /** Case-insensitive: emails are stored lower-cased. */
  abstract findByEmail(email: string): Promise<UserRecord | null>;
  /** Returns `null` when the email is already taken. */
  abstract create(user: Omit<UserRecord, 'id'>): Promise<UserRecord | null>;
}

export interface OrdersListQuery {
  limit: number;
  userId?: string;
  before?: number;
}

export abstract class OrdersRepository {
  /**
   * Newest first. Only the given user's orders when `userId` is set; only orders
   * numbered below `before` when it is set (cursor pagination).
   */
  abstract list(query: OrdersListQuery): Promise<Order[]>;
  abstract findById(id: string): Promise<Order | null>;
  abstract findByIdempotencyKey(key: string): Promise<Order | null>;
  /**
   * Atomic: stores the order and, when given, redeems the promo code (checking its
   * total and per-customer limits under a lock) in one transaction. A reused
   * idempotency key returns the existing order.
   */
  abstract create(
    order: NewOrder,
    idempotencyKey: string,
    redemption?: PromoRedemption,
  ): Promise<CreateOrderResult>;
  /** Moves every unfinished order not touched for `olderThanMs` one status forward. */
  abstract advanceStale(olderThanMs: number): Promise<Order[]>;
}

export type IdempotencyState =
  | { kind: 'acquired' }
  | { kind: 'in_progress' }
  | { kind: 'completed'; orderId: string };

export abstract class IdempotencyStore {
  abstract acquire(key: string): Promise<IdempotencyState>;
  abstract complete(key: string, orderId: string): Promise<void>;
  abstract release(key: string): Promise<void>;
}

export abstract class EventBus {
  abstract publish<T>(topic: string, payload: T): Promise<void>;
  /** Returns an unsubscribe function. */
  abstract subscribe<T>(topic: string, handler: (payload: T) => void): () => void;
}

export abstract class PromoRepository {
  abstract list(): Promise<PromoCode[]>;
  /** `code` must already be normalized (upper-case). */
  abstract findByCode(code: string): Promise<PromoCode | null>;
  abstract countRedemptions(promoId: string, userId: string): Promise<number>;
  /** Returns `null` when the code is already taken. */
  abstract create(input: PromoCodeInput): Promise<PromoCode | null>;
  abstract update(
    id: string,
    input: PromoCodeInput,
    expectedVersion: number,
  ): Promise<VersionedWrite<PromoCode>>;
}

