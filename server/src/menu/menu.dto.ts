import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export const MAX_PRICE = 1_000_000; // 10 000.00

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class CategoryDto {
  @Transform(trim)
  @IsString()
  @Length(1, 60)
  name: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}

export class UpdateCategoryDto {
  @IsOptional()
  @Transform(trim)
  @IsString()
  @Length(1, 60)
  name?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}

export class MenuItemDto {
  @IsUUID()
  categoryId: string;

  @Transform(trim)
  @IsString()
  @Length(1, 100)
  name: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(300)
  description?: string;

  /** Cents. May be null for open-price items. */
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(MAX_PRICE)
  price?: number | null;

  @IsOptional()
  @IsBoolean()
  available?: boolean;

  @IsOptional()
  @IsBoolean()
  openPrice?: boolean;
}

/** Partial update: only the sent fields change (e.g. a single availability toggle). */
export class UpdateMenuItemDto {
  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @Length(1, 100)
  name?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(300)
  description?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(MAX_PRICE)
  price?: number | null;

  @IsOptional()
  @IsBoolean()
  available?: boolean;

  @IsOptional()
  @IsBoolean()
  openPrice?: boolean;
}
