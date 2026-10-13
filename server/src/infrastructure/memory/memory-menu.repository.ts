import { randomUUID } from 'node:crypto';
import {
  type Category,
  type MenuEvent,
  type MenuItem,
  type MenuSnapshot,
  TOPICS,
} from '../../domain/models.js';
import {
  type CategoryInput,
  type MenuData,
  MenuRepository,
  type MenuItemInput,
  type VersionedWrite,
} from '../../domain/ports.js';
import type { MemoryEventLog } from './memory-event-log.js';

export class MemoryMenuRepository extends MenuRepository {
  constructor(private readonly log: MemoryEventLog) {
    super();
  }

  private readonly categories = new Map<string, Category>();
  private readonly items = new Map<string, MenuItem>();

  async getSnapshot(): Promise<MenuSnapshot> {
    return {
      seq: this.log.currentSeq(),
      categories: [...this.categories.values()].map((c) => ({ ...c })),
      items: [...this.items.values()].map((i) => ({ ...i })),
    };
  }

  async findItems(ids: string[]): Promise<MenuItem[]> {
    return ids.flatMap((id) => {
      const item = this.items.get(id);
      return item ? [{ ...item }] : [];
    });
  }

  async findItem(id: string): Promise<MenuItem | null> {
    const item = this.items.get(id);
    return item ? { ...item } : null;
  }

  async findCategory(id: string): Promise<Category | null> {
    const category = this.categories.get(id);
    return category ? { ...category } : null;
  }

  async countItemsInCategory(categoryId: string): Promise<number> {
    let count = 0;
    for (const item of this.items.values()) {
      if (item.categoryId === categoryId) count++;
    }
    return count;
  }

  async createCategory(input: CategoryInput): Promise<Category> {
    const category: Category = { id: randomUUID(), ...input, version: 1 };
    this.categories.set(category.id, category);
    this.log.append({ topic: TOPICS.menu, event: { type: 'category.upserted', category } });
    return { ...category };
  }

  async updateCategory(
    id: string,
    input: CategoryInput,
    expectedVersion: number,
  ): Promise<VersionedWrite<Category>> {
    return this.logged(
      this.write(this.categories, id, expectedVersion, (current) => ({
        ...current,
        ...input,
        version: current.version + 1,
      })),
      (category) => ({ type: 'category.upserted', category }),
    );
  }

  async deleteCategory(id: string, expectedVersion: number): Promise<VersionedWrite<Category>> {
    return this.logged(this.write(this.categories, id, expectedVersion, null), (category) => ({
      type: 'category.deleted',
      id: category.id,
    }));
  }

  async createItem(input: MenuItemInput): Promise<MenuItem> {
    const item: MenuItem = { id: randomUUID(), ...input, version: 1 };
    this.items.set(item.id, item);
    this.log.append({ topic: TOPICS.menu, event: { type: 'item.upserted', item } });
    return { ...item };
  }

  async updateItem(
    id: string,
    input: MenuItemInput,
    expectedVersion: number,
  ): Promise<VersionedWrite<MenuItem>> {
    return this.logged(
      this.write(this.items, id, expectedVersion, (current) => ({
        ...current,
        ...input,
        version: current.version + 1,
      })),
      (item) => ({ type: 'item.upserted', item }),
    );
  }

  async deleteItem(id: string, expectedVersion: number): Promise<VersionedWrite<MenuItem>> {
    return this.logged(this.write(this.items, id, expectedVersion, null), (item) => ({
      type: 'item.deleted',
      id: item.id,
    }));
  }

  private logged<T>(result: VersionedWrite<T>, toEvent: (value: T) => MenuEvent): VersionedWrite<T> {
    if (result.status === 'ok') this.log.append({ topic: TOPICS.menu, event: toEvent(result.value) });
    return result;
  }

  /** Compare-and-set on the version; `next = null` deletes. Synchronous, so atomic in one process. */
  private write<T extends { version: number }>(
    store: Map<string, T>,
    id: string,
    expectedVersion: number,
    next: ((current: T) => T) | null,
  ): VersionedWrite<T> {
    const current = store.get(id);
    if (!current) return { status: 'not_found' };
    if (current.version !== expectedVersion) return { status: 'conflict', current: { ...current } };
    if (next) {
      const value = next(current);
      store.set(id, value);
      return { status: 'ok', value: { ...value } };
    }
    store.delete(id);
    return { status: 'ok', value: { ...current } };
  }

  async isEmpty(): Promise<boolean> {
    return this.categories.size === 0;
  }

  async seed(data: MenuData): Promise<void> {
    for (const category of data.categories) {
      this.categories.set(category.id, { ...category });
    }
    for (const item of data.items) {
      this.items.set(item.id, { ...item });
    }
  }
}
