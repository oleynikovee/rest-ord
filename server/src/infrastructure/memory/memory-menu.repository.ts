import { randomUUID } from 'node:crypto';
import type { Category, MenuItem, MenuSnapshot } from '../../domain/models.js';
import {
  type CategoryInput,
  MenuRepository,
  type MenuItemInput,
} from '../../domain/ports.js';

export class MemoryMenuRepository extends MenuRepository {
  private readonly categories = new Map<string, Category>();
  private readonly items = new Map<string, MenuItem>();

  async getSnapshot(): Promise<MenuSnapshot> {
    return {
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
    return { ...category };
  }

  async updateCategory(
    id: string,
    input: CategoryInput,
  ): Promise<Category | null> {
    const current = this.categories.get(id);
    if (!current) return null;
    const next: Category = { ...current, ...input, version: current.version + 1 };
    this.categories.set(id, next);
    return { ...next };
  }

  async deleteCategory(id: string): Promise<boolean> {
    return this.categories.delete(id);
  }

  async createItem(input: MenuItemInput): Promise<MenuItem> {
    const item: MenuItem = { id: randomUUID(), ...input, version: 1 };
    this.items.set(item.id, item);
    return { ...item };
  }

  async updateItem(id: string, input: MenuItemInput): Promise<MenuItem | null> {
    const current = this.items.get(id);
    if (!current) return null;
    const next: MenuItem = { ...current, ...input, version: current.version + 1 };
    this.items.set(id, next);
    return { ...next };
  }

  async deleteItem(id: string): Promise<boolean> {
    return this.items.delete(id);
  }

  async isEmpty(): Promise<boolean> {
    return this.categories.size === 0;
  }

  async seed(snapshot: MenuSnapshot): Promise<void> {
    for (const category of snapshot.categories) {
      this.categories.set(category.id, { ...category });
    }
    for (const item of snapshot.items) {
      this.items.set(item.id, { ...item });
    }
  }
}
