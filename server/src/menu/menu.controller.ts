import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import type { Category, MenuItem, MenuSnapshot } from '../domain/models.js';
import {
  CategoryDto,
  MenuItemDto,
  UpdateCategoryDto,
  UpdateMenuItemDto,
} from './menu.dto.js';
import { MenuService } from './menu.service.js';

@Controller()
export class MenuController {
  constructor(private readonly menu: MenuService) {}

  @Get('menu')
  getMenu(): Promise<MenuSnapshot> {
    return this.menu.getSnapshot();
  }

  @Post('categories')
  createCategory(@Body() dto: CategoryDto): Promise<Category> {
    return this.menu.createCategory(dto);
  }

  @Patch('categories/:id')
  updateCategory(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCategoryDto,
  ): Promise<Category> {
    return this.menu.updateCategory(id, dto);
  }

  @Delete('categories/:id')
  @HttpCode(204)
  deleteCategory(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.menu.deleteCategory(id);
  }

  @Post('items')
  createItem(@Body() dto: MenuItemDto): Promise<MenuItem> {
    return this.menu.createItem(dto);
  }

  @Patch('items/:id')
  updateItem(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateMenuItemDto,
  ): Promise<MenuItem> {
    return this.menu.updateItem(id, dto);
  }

  @Delete('items/:id')
  @HttpCode(204)
  deleteItem(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.menu.deleteItem(id);
  }
}
