import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  PreconditionFailedException,
} from '@nestjs/common';
import type { Category, MenuItem, MenuSnapshot } from '../domain/models.js';
import {
  MenuRepository,
  type MenuItemInput,
  type VersionedWrite,
} from '../domain/ports.js';
import type {
  CategoryDto,
  MenuItemDto,
  UpdateCategoryDto,
  UpdateMenuItemDto,
} from './menu.dto.js';

@Injectable()
export class MenuService {
  /** Events are written by the repository together with each change (transactional outbox). */
  constructor(private readonly menu: MenuRepository) {}

  getSnapshot(): Promise<MenuSnapshot> {
    return this.menu.getSnapshot();
  }

  async createCategory(dto: CategoryDto): Promise<Category> {
    const category = await this.menu.createCategory({
      name: dto.name,
      sortOrder: dto.sortOrder ?? (await this.nextSortOrder()),
    });
    return category;
  }

  async updateCategory(
    id: string,
    dto: UpdateCategoryDto,
    expectedVersion: number,
  ): Promise<Category> {
    const current = this.checkVersion(await this.menu.findCategory(id), expectedVersion, categoryNotFound);
    const category = this.unwrap(
      await this.menu.updateCategory(
        id,
        { name: dto.name ?? current.name, sortOrder: dto.sortOrder ?? current.sortOrder },
        expectedVersion,
      ),
      categoryNotFound,
    );
    return category;
  }

  async deleteCategory(id: string, expectedVersion: number): Promise<void> {
    this.checkVersion(await this.menu.findCategory(id), expectedVersion, categoryNotFound);
    if ((await this.menu.countItemsInCategory(id)) > 0) {
      throw new ConflictException({
        code: 'CATEGORY_NOT_EMPTY',
        message: 'Move or delete the items of this category first.',
      });
    }
    this.unwrap(await this.menu.deleteCategory(id, expectedVersion), categoryNotFound);
  }

  async createItem(dto: MenuItemDto): Promise<MenuItem> {
    const input = await this.validateItem({
      categoryId: dto.categoryId,
      name: dto.name,
      description: dto.description ?? '',
      price: dto.price ?? null,
      available: dto.available ?? true,
      openPrice: dto.openPrice ?? false,
    });
    const item = await this.menu.createItem(input);
    return item;
  }

  async updateItem(
    id: string,
    dto: UpdateMenuItemDto,
    expectedVersion: number,
  ): Promise<MenuItem> {
    const current = this.checkVersion(await this.menu.findItem(id), expectedVersion, itemNotFound);
    const input = await this.validateItem(
      {
        categoryId: dto.categoryId ?? current.categoryId,
        name: dto.name ?? current.name,
        description: dto.description ?? current.description,
        price: dto.price !== undefined ? dto.price : current.price,
        available: dto.available ?? current.available,
        openPrice: dto.openPrice ?? current.openPrice,
      },
      current.categoryId,
    );
    const item = this.unwrap(await this.menu.updateItem(id, input, expectedVersion), itemNotFound);
    return item;
  }

  async deleteItem(id: string, expectedVersion: number): Promise<void> {
    this.unwrap(await this.menu.deleteItem(id, expectedVersion), itemNotFound);
  }

  /** Fails fast before validation; the repository repeats the check atomically on write. */
  private checkVersion<T extends Category | MenuItem>(
    current: T | null,
    expectedVersion: number,
    notFound: () => NotFoundException,
  ): T {
    if (!current) throw notFound();
    if (current.version !== expectedVersion) throw versionConflict(current);
    return current;
  }

  private unwrap<T extends Category | MenuItem>(result: VersionedWrite<T>, notFound: () => NotFoundException): T {
    switch (result.status) {
      case 'ok':
        return result.value;
      case 'not_found':
        throw notFound();
      case 'conflict':
        throw versionConflict(result.current);
    }
  }

  private async validateItem(
    input: MenuItemInput,
    knownCategoryId?: string,
  ): Promise<MenuItemInput> {
    if (!input.openPrice && input.price === null) {
      throw new BadRequestException({
        code: 'PRICE_REQUIRED',
        message: 'A price is required unless the item is open-price.',
      });
    }
    if (
      input.categoryId !== knownCategoryId &&
      !(await this.menu.findCategory(input.categoryId))
    ) {
      throw categoryNotFound();
    }
    return input;
  }

  private async nextSortOrder(): Promise<number> {
    const { categories } = await this.menu.getSnapshot();
    return categories.reduce((max, c) => Math.max(max, c.sortOrder + 1), 0);
  }
}

const categoryNotFound = (): NotFoundException =>
  new NotFoundException({ code: 'CATEGORY_NOT_FOUND', message: 'Category not found.' });
const itemNotFound = (): NotFoundException =>
  new NotFoundException({ code: 'ITEM_NOT_FOUND', message: 'Menu item not found.' });

/** 412: the client's copy is outdated. The current state lets it show what changed. */
const versionConflict = (current: Category | MenuItem): PreconditionFailedException =>
  new PreconditionFailedException({
    code: 'VERSION_CONFLICT',
    message: 'Someone else changed this in the meantime. The latest version is shown now.',
    current,
  });
