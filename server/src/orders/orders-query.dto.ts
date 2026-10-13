import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';
import { ORDERS_PAGE_SIZE } from '../domain/models.js';

export class OrdersQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(ORDERS_PAGE_SIZE.max)
  limit?: number;

  /** Cursor: the `nextCursor` of the previous page. */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  before?: number;
}
