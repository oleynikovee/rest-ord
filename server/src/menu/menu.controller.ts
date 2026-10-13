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
import { Public, Roles } from '../auth/auth.decorators.js';
import type { Category, MenuItem, MenuSnapshot } from '../domain/models.js';
import {
  CategoryDto,
  MenuItemDto,
  UpdateCategoryDto,
  UpdateMenuItemDto,
} from './menu.dto.js';
import { IfMatchVersion } from './if-match.decorator.js';
import { MenuService } from './menu.service.js';

@Controller()
export class MenuController {
  constructor(private readonly menu: MenuService) {}

  @Get('menu')
  @Public()
  getMenu(): Promise<MenuSnapshot> {
    return this.menu.getSnapshot();
  }

  @Post('categories')
  @Roles('admin')
  createCategory(@Body() dto: CategoryDto): Promise<Category> {
    return this.menu.createCategory(dto);
  }

  @Patch('categories/:id')
  @Roles('admin')
  updateCategory(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCategoryDto,
    @IfMatchVersion() version: number,
  ): Promise<Category> {
    return this.menu.updateCategory(id, dto, version);
  }

  @Delete('categories/:id')
  @Roles('admin')
  @HttpCode(204)
  deleteCategory(
    @Param('id', ParseUUIDPipe) id: string,
    @IfMatchVersion() version: number,
  ): Promise<void> {
    return this.menu.deleteCategory(id, version);
  }

  @Post('items')
  @Roles('admin')
  createItem(@Body() dto: MenuItemDto): Promise<MenuItem> {
    return this.menu.createItem(dto);
  }

  @Patch('items/:id')
  @Roles('admin')
  updateItem(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateMenuItemDto,
    @IfMatchVersion() version: number,
  ): Promise<MenuItem> {
    return this.menu.updateItem(id, dto, version);
  }

  @Delete('items/:id')
  @Roles('admin')
  @HttpCode(204)
  deleteItem(
    @Param('id', ParseUUIDPipe) id: string,
    @IfMatchVersion() version: number,
  ): Promise<void> {
    return this.menu.deleteItem(id, version);
  }
}
