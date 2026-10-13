import type {
  Category,
  MenuItem,
  MenuSnapshot,
  NewOrder,
  Order,
  UserRecord,
} from './models.js';

/**
 * Storage and infrastructure ports. Abstract classes double as Nest DI tokens,
 * so services do not know whether Postgres/Redis or the in-memory fallback is used.
 */

export type CategoryInput = Pick<Category, 'name' | 'sortOrder'>;
export type MenuItemInput = Omit<MenuItem, 'id' | 'version'>;

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
  ): Promise<Category | null>;
  abstract deleteCategory(id: string): Promise<boolean>;
  abstract createItem(input: MenuItemInput): Promise<MenuItem>;
  abstract updateItem(id: string, input: MenuItemInput): Promise<MenuItem | null>;
  abstract deleteItem(id: string): Promise<boolean>;
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

export abstract class OrdersRepository {
  /** Newest first; only the given user's orders when `userId` is set. */
  abstract list(limit: number, userId?: string): Promise<Order[]>;
  abstract findById(id: string): Promise<Order | null>;
  abstract findByIdempotencyKey(key: string): Promise<Order | null>;
  /** Must be atomic per idempotency key: a duplicate key returns the existing order. */
  abstract create(order: NewOrder, idempotencyKey: string): Promise<Order>;
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
