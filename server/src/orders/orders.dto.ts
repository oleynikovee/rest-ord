import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsUUID,
  Max,
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

  /** Cents: the price the user saw, or entered for an open-price item. */
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

  /** Fixed discount amount in cents. */
  @IsInt()
  @Min(0)
  @Max(MAX_PRICE * 100)
  discount: number;
}
