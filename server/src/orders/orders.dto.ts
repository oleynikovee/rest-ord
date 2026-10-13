import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { MAX_PRICE } from '../menu/menu.dto.js';

export class OrderLineDto {
  @IsUUID()
  itemId: string;

  @IsInt()
  @Min(1)
  @Max(99)
  quantity: number;

  @IsInt()
  @Min(0)
  @Max(MAX_PRICE)
  unitPrice: number;

  @IsBoolean()
  openPrice: boolean;
}

export class CreateOrderDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => OrderLineDto)
  lines: OrderLineDto[];

  @IsOptional()
  @IsString()
  @MaxLength(40)
  promoCode?: string;
}
