import { randomUUID } from 'node:crypto';
import type { Category, MenuItem, MenuSnapshot } from '../../domain/models.js';
import {
  type CategoryInput,
  MenuRepository,
  type MenuItemInput,
  type VersionedWrite,
} from '../../domain/ports.js';
import type { PgDatabase } from './pg-database.js';

interface CategoryRow {
  id: string;
  name: string;
  sort_order: number;
  version: number;
}

interface ItemRow {
  id: string;
  category_id: string;
  name: string;
  description: string;
  price: number | null;
  available: boolean;
  open_price: boolean;
  version: number;
}

const toCategory = (row: CategoryRow): Category => ({
  id: row.id,
  name: row.name,
  sortOrder: row.sort_order,
  version: row.version,
});

const toItem = (row: ItemRow): MenuItem => ({
  id: row.id,
  categoryId: row.category_id,
  name: row.name,
  description: row.description,
  price: row.price,
  available: row.available,
  openPrice: row.open_price,
  version: row.version,
});

export class PgMenuRepository extends MenuRepository {
  constructor(private readonly db: PgDatabase) {
    super();
  }

  async getSnapshot(): Promise<MenuSnapshot> {
    const [categories, items] = await Promise.all([
      this.db.pool.query<CategoryRow>('SELECT * FROM categories'),
      this.db.pool.query<ItemRow>('SELECT * FROM menu_items'),
    ]);
    return {
      categories: categories.rows.map(toCategory),
      items: items.rows.map(toItem),
    };
  }

  async findItems(ids: string[]): Promise<MenuItem[]> {
    const { rows } = await this.db.pool.query<ItemRow>(
      'SELECT * FROM menu_items WHERE id = ANY($1::uuid[])',
      [ids],
    );
    return rows.map(toItem);
  }

  async findItem(id: string): Promise<MenuItem | null> {
    const [item] = await this.findItems([id]);
    return item ?? null;
  }

  async findCategory(id: string): Promise<Category | null> {
    const { rows } = await this.db.pool.query<CategoryRow>(
      'SELECT * FROM categories WHERE id = $1',
      [id],
    );
    return rows[0] ? toCategory(rows[0]) : null;
  }

  async countItemsInCategory(categoryId: string): Promise<number> {
    const { rows } = await this.db.pool.query<{ count: string }>(
      'SELECT count(*) FROM menu_items WHERE category_id = $1',
      [categoryId],
    );
    return Number(rows[0]?.count ?? 0);
  }

  async createCategory(input: CategoryInput): Promise<Category> {
    const { rows } = await this.db.pool.query<CategoryRow>(
      'INSERT INTO categories (id, name, sort_order) VALUES ($1, $2, $3) RETURNING *',
      [randomUUID(), input.name, input.sortOrder],
    );
    return toCategory(rows[0]);
  }

  async updateCategory(
    id: string,
    input: CategoryInput,
    expectedVersion: number,
  ): Promise<VersionedWrite<Category>> {
    const { rows } = await this.db.pool.query<CategoryRow>(
      `UPDATE categories SET name = $2, sort_order = $3, version = version + 1
       WHERE id = $1 AND version = $4 RETURNING *`,
      [id, input.name, input.sortOrder, expectedVersion],
    );
    return rows[0] ? { status: 'ok', value: toCategory(rows[0]) } : this.categoryMiss(id);
  }

  async deleteCategory(id: string, expectedVersion: number): Promise<VersionedWrite<Category>> {
    const { rows } = await this.db.pool.query<CategoryRow>(
      'DELETE FROM categories WHERE id = $1 AND version = $2 RETURNING *',
      [id, expectedVersion],
    );
    return rows[0] ? { status: 'ok', value: toCategory(rows[0]) } : this.categoryMiss(id);
  }

  async createItem(input: MenuItemInput): Promise<MenuItem> {
    const { rows } = await this.db.pool.query<ItemRow>(
      `INSERT INTO menu_items (id, category_id, name, description, price, available, open_price)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [
        randomUUID(),
        input.categoryId,
        input.name,
        input.description,
        input.price,
        input.available,
        input.openPrice,
      ],
    );
    return toItem(rows[0]);
  }

  /** The version check is part of the UPDATE itself, so concurrent edits cannot both win. */
  async updateItem(
    id: string,
    input: MenuItemInput,
    expectedVersion: number,
  ): Promise<VersionedWrite<MenuItem>> {
    const { rows } = await this.db.pool.query<ItemRow>(
      `UPDATE menu_items
       SET category_id = $2, name = $3, description = $4, price = $5,
           available = $6, open_price = $7, version = version + 1
       WHERE id = $1 AND version = $8 RETURNING *`,
      [
        id,
        input.categoryId,
        input.name,
        input.description,
        input.price,
        input.available,
        input.openPrice,
        expectedVersion,
      ],
    );
    return rows[0] ? { status: 'ok', value: toItem(rows[0]) } : this.itemMiss(id);
  }

  async deleteItem(id: string, expectedVersion: number): Promise<VersionedWrite<MenuItem>> {
    const { rows } = await this.db.pool.query<ItemRow>(
      'DELETE FROM menu_items WHERE id = $1 AND version = $2 RETURNING *',
      [id, expectedVersion],
    );
    return rows[0] ? { status: 'ok', value: toItem(rows[0]) } : this.itemMiss(id);
  }

  /** No row matched: tell "gone" apart from "changed by someone else". */
  private async categoryMiss(id: string): Promise<VersionedWrite<Category>> {
    const current = await this.findCategory(id);
    return current ? { status: 'conflict', current } : { status: 'not_found' };
  }

  private async itemMiss(id: string): Promise<VersionedWrite<MenuItem>> {
    const current = await this.findItem(id);
    return current ? { status: 'conflict', current } : { status: 'not_found' };
  }

  async isEmpty(): Promise<boolean> {
    const { rows } = await this.db.pool.query(
      'SELECT 1 FROM categories LIMIT 1',
    );
    return rows.length === 0;
  }

  async seed(snapshot: MenuSnapshot): Promise<void> {
    const client = await this.db.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        `INSERT INTO categories (id, name, sort_order, version)
         SELECT id, name, "sortOrder", version
         FROM jsonb_to_recordset($1::jsonb)
           AS x(id uuid, name text, "sortOrder" int, version int)
         ON CONFLICT (id) DO NOTHING`,
        [JSON.stringify(snapshot.categories)],
      );
      await client.query(
        `INSERT INTO menu_items (id, category_id, name, description, price, available, open_price, version)
         SELECT id, "categoryId", name, description, price, available, "openPrice", version
         FROM jsonb_to_recordset($1::jsonb)
           AS x(id uuid, "categoryId" uuid, name text, description text, price int,
                available boolean, "openPrice" boolean, version int)
         ON CONFLICT (id) DO NOTHING`,
        [JSON.stringify(snapshot.items)],
      );
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}
