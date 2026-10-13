import type {
  Category,
  MenuItem,
  MenuSnapshot,
  NewOrder,
  CreateOrderResult,
  EventEnvelope,
  Order,
  PromoCode,
  PromoCodeInput,
  PromoRedemption,
  UserRecord,
} from './models.js';

export type CategoryInput = Pick<Category, 'name' | 'sortOrder'>;
export type MenuItemInput = Omit<MenuItem, 'id' | 'version'>;
export type MenuData = Omit<MenuSnapshot, 'seq'>;

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
  abstract seed(data: MenuData): Promise<void>;
}

export abstract class UsersRepository {
  abstract findById(id: string): Promise<UserRecord | null>;
  abstract findByEmail(email: string): Promise<UserRecord | null>;
  abstract create(user: Omit<UserRecord, 'id'>): Promise<UserRecord | null>;
}

export interface OrdersListQuery {
  limit: number;
  userId?: string;
  before?: number;
}

export abstract class OrdersRepository {
  abstract list(query: OrdersListQuery): Promise<Order[]>;
  abstract findById(id: string): Promise<Order | null>;
  abstract findByIdempotencyKey(key: string): Promise<Order | null>;
  abstract create(
    order: NewOrder,
    idempotencyKey: string,
    redemption?: PromoRedemption,
  ): Promise<CreateOrderResult>;
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
  abstract subscribe<T>(topic: string, handler: (payload: T) => void): () => void;
}

export abstract class PromoRepository {
  abstract list(): Promise<PromoCode[]>;
  abstract findByCode(code: string): Promise<PromoCode | null>;
  abstract countRedemptions(promoId: string, userId: string): Promise<number>;
  abstract create(input: PromoCodeInput): Promise<PromoCode | null>;
  abstract update(
    id: string,
    input: PromoCodeInput,
    expectedVersion: number,
  ): Promise<VersionedWrite<PromoCode>>;
}

export abstract class EventLog {
  abstract latestSeq(): Promise<number>;
  abstract readAfter(
    after: number,
    limit: number,
  ): Promise<{ events: EventEnvelope[]; oldestSeq: number | null }>;
  abstract publishPending(
    publish: (event: EventEnvelope) => Promise<void>,
    batchSize: number,
  ): Promise<number>;
  abstract tryLead(): Promise<boolean>;
  abstract onAppended(listener: () => void): () => void;
  abstract pendingStats(): Promise<{ pending: number; oldestAgeSeconds: number }>;
  abstract prune(olderThanMs: number): Promise<number>;
  abstract close(): Promise<void>;
}

