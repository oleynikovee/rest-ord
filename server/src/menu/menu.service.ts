import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  type Category,
  type MenuEvent,
  type MenuItem,
  type MenuSnapshot,
  TOPICS,
} from '../domain/models.js';
import {
  EventBus,
  MenuRepository,
  type MenuItemInput,
} from '../domain/ports.js';
import type {
  CategoryDto,
  MenuItemDto,
  UpdateCategoryDto,
  UpdateMenuItemDto,
} from './menu.dto.js';

@Injectable()
export class MenuService {
  constructor(
    private readonly menu: MenuRepository,
    private readonly bus: EventBus,
  ) {}

  getSnapshot(): Promise<MenuSnapshot> {
    return this.menu.getSnapshot();
  }

  async createCategory(dto: CategoryDto): Promise<Category> {
    const category = await this.menu.createCategory({
      name: dto.name,
      sortOrder: dto.sortOrder ?? (await this.nextSortOrder()),
    });
    await this.emit({ type: 'category.upserted', category });
    return category;
  }

  async updateCategory(id: string, dto: UpdateCategoryDto): Promise<Category> {
    const current = await this.menu.findCategory(id);
    if (!current) throw categoryNotFound();
    const category = await this.menu.updateCategory(id, {
      name: dto.name ?? current.name,
      sortOrder: dto.sortOrder ?? current.sortOrder,
    });
    if (!category) throw categoryNotFound();
    await this.emit({ type: 'category.upserted', category });
    return category;
  }

  async deleteCategory(id: string): Promise<void> {
    if ((await this.menu.countItemsInCategory(id)) > 0) {
      throw new ConflictException({
        code: 'CATEGORY_NOT_EMPTY',
        message: 'Move or delete the items of this category first.',
      });
    }
    if (!(await this.menu.deleteCategory(id))) throw categoryNotFound();
    await this.emit({ type: 'category.deleted', id });
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
    await this.emit({ type: 'item.upserted', item });
    return item;
  }

  async updateItem(id: string, dto: UpdateMenuItemDto): Promise<MenuItem> {
    const current = await this.menu.findItem(id);
    if (!current) throw itemNotFound();
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
    const item = await this.menu.updateItem(id, input);
    if (!item) throw itemNotFound();
    await this.emit({ type: 'item.upserted', item });
    return item;
  }

  async deleteItem(id: string): Promise<void> {
    if (!(await this.menu.deleteItem(id))) throw itemNotFound();
    await this.emit({ type: 'item.deleted', id });
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

  private emit(event: MenuEvent): Promise<void> {
    return this.bus.publish(TOPICS.menu, event);
  }
}

const categoryNotFound = () =>
  new NotFoundException({ code: 'CATEGORY_NOT_FOUND', message: 'Category not found.' });
const itemNotFound = () =>
  new NotFoundException({ code: 'ITEM_NOT_FOUND', message: 'Menu item not found.' });
