import { randomUUID } from 'node:crypto';
import type pg from 'pg';
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
import type { PgDatabase } from './pg-database.js';
import { appendEvent } from './pg-event-log.js';

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

const itemParams = (input: MenuItemInput): unknown[] => [
  input.categoryId,
  input.name,
  input.description,
  input.price,
  input.available,
  input.openPrice,
];

/** Every write commits together with its event in the outbox (see PgEventLog). */
export class PgMenuRepository extends MenuRepository {
  constructor(private readonly db: PgDatabase) {
    super();
  }

  /** One consistent snapshot: the data and the log position it corresponds to. */
  async getSnapshot(): Promise<MenuSnapshot> {
    const client = await this.db.pool.connect();
    try {
      await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
      const seq = await client.query<{ seq: string | null }>('SELECT max(seq) AS seq FROM outbox');
      const categories = await client.query<CategoryRow>('SELECT * FROM categories');
      const items = await client.query<ItemRow>('SELECT * FROM menu_items');
      await client.query('COMMIT');
      return {
        categories: categories.rows.map(toCategory),
        items: items.rows.map(toItem),
        seq: Number(seq.rows[0]?.seq ?? 0),
      };
    } catch (error) {
      await client.query('ROLLBACK').catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
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
    const { rows } = await this.db.pool.query<CategoryRow>('SELECT * FROM categories WHERE id = $1', [id]);
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
    return this.db.transaction(async (client) => {
      const { rows } = await client.query<CategoryRow>(
        'INSERT INTO categories (id, name, sort_order) VALUES ($1, $2, $3) RETURNING *',
        [randomUUID(), input.name, input.sortOrder],
      );
      const category = toCategory(rows[0]);
      await this.log(client, { type: 'category.upserted', category });
      return category;
    });
  }

  async updateCategory(
    id: string,
    input: CategoryInput,
    expectedVersion: number,
  ): Promise<VersionedWrite<Category>> {
    return this.versioned(
      (client) =>
        client.query<CategoryRow>(
          `UPDATE categories SET name = $2, sort_order = $3, version = version + 1
           WHERE id = $1 AND version = $4 RETURNING *`,
          [id, input.name, input.sortOrder, expectedVersion],
        ),
      toCategory,
      (category) => ({ type: 'category.upserted', category }),
      () => this.findCategory(id),
    );
  }

  async deleteCategory(id: string, expectedVersion: number): Promise<VersionedWrite<Category>> {
    return this.versioned(
      (client) =>
        client.query<CategoryRow>('DELETE FROM categories WHERE id = $1 AND version = $2 RETURNING *', [
          id,
          expectedVersion,
        ]),
      toCategory,
      (category) => ({ type: 'category.deleted', id: category.id }),
      () => this.findCategory(id),
    );
  }

  async createItem(input: MenuItemInput): Promise<MenuItem> {
    return this.db.transaction(async (client) => {
      const { rows } = await client.query<ItemRow>(
        `INSERT INTO menu_items (id, category_id, name, description, price, available, open_price)
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
        [randomUUID(), ...itemParams(input)],
      );
      const item = toItem(rows[0]);
      await this.log(client, { type: 'item.upserted', item });
      return item;
    });
  }

  /** The version check is part of the UPDATE itself, so concurrent edits cannot both win. */
  async updateItem(
    id: string,
    input: MenuItemInput,
    expectedVersion: number,
  ): Promise<VersionedWrite<MenuItem>> {
    return this.versioned(
      (client) =>
        client.query<ItemRow>(
          `UPDATE menu_items
           SET category_id = $2, name = $3, description = $4, price = $5,
               available = $6, open_price = $7, version = version + 1
           WHERE id = $1 AND version = $8 RETURNING *`,
          [id, ...itemParams(input), expectedVersion],
        ),
      toItem,
      (item) => ({ type: 'item.upserted', item }),
      () => this.findItem(id),
    );
  }

  async deleteItem(id: string, expectedVersion: number): Promise<VersionedWrite<MenuItem>> {
    return this.versioned(
      (client) =>
        client.query<ItemRow>('DELETE FROM menu_items WHERE id = $1 AND version = $2 RETURNING *', [
          id,
          expectedVersion,
        ]),
      toItem,
      (item) => ({ type: 'item.deleted', id: item.id }),
      () => this.findItem(id),
    );
  }

  async isEmpty(): Promise<boolean> {
    const { rows } = await this.db.pool.query('SELECT 1 FROM categories LIMIT 1');
    return rows.length === 0;
  }

  async seed(data: MenuData): Promise<void> {
    await this.db.transaction(async (client) => {
      await client.query(
        `INSERT INTO categories (id, name, sort_order, version)
         SELECT id, name, "sortOrder", version
         FROM jsonb_to_recordset($1::jsonb)
           AS x(id uuid, name text, "sortOrder" int, version int)
         ON CONFLICT (id) DO NOTHING`,
        [JSON.stringify(data.categories)],
      );
      await client.query(
        `INSERT INTO menu_items (id, category_id, name, description, price, available, open_price, version)
         SELECT id, "categoryId", name, description, price, available, "openPrice", version
         FROM jsonb_to_recordset($1::jsonb)
           AS x(id uuid, "categoryId" uuid, name text, description text, price int,
                available boolean, "openPrice" boolean, version int)
         ON CONFLICT (id) DO NOTHING`,
        [JSON.stringify(data.items)],
      );
    });
  }

  /**
   * A conditional write plus its event in one transaction. No matching row means
   * either "gone" or "changed by someone else"; the current state tells which.
   */
  private async versioned<Row extends pg.QueryResultRow, T>(
    write: (client: pg.PoolClient) => Promise<pg.QueryResult<Row>>,
    map: (row: Row) => T,
    toEvent: (value: T) => MenuEvent,
    findCurrent: () => Promise<T | null>,
  ): Promise<VersionedWrite<T>> {
    const value = await this.db.transaction(async (client) => {
      const { rows } = await write(client);
      if (!rows[0]) return null;
      const written = map(rows[0]);
      await this.log(client, toEvent(written));
      return written;
    });
    if (value) return { status: 'ok', value };
    const current = await findCurrent();
    return current ? { status: 'conflict', current } : { status: 'not_found' };
  }

  private log(client: pg.PoolClient, event: MenuEvent): Promise<void> {
    return appendEvent(client, { topic: TOPICS.menu, event });
  }
}
