import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsISO8601,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import { normalizePromoCode, PROMO_KINDS, type PromoKind } from '../domain/models.js';

const toCode = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? normalizePromoCode(value) : value;

export class PromoCodeDto {
  @Transform(toCode)
  @Matches(/^[A-Z0-9_-]{3,40}$/, { message: 'Use 3-40 letters, digits, "-" or "_".' })
  code: string;

  @IsString()
  @MaxLength(200)
  description: string;

  @IsIn(PROMO_KINDS)
  kind: PromoKind;

  @IsInt()
  @Min(1)
  @Max(1_000_000)
  value: number;

  @IsInt()
  @Min(0)
  minOrderAmount: number;

  @ValidateIf((_, value) => value !== null)
  @IsInt()
  @Min(0)
  maxDiscount: number | null;

  @ValidateIf((_, value) => value !== null)
  @IsInt()
  @Min(1)
  usageLimit: number | null;

  @ValidateIf((_, value) => value !== null)
  @IsInt()
  @Min(1)
  perUserLimit: number | null;

  @ValidateIf((_, value) => value !== null)
  @IsISO8601({ strict: true })
  startsAt: string | null;

  @ValidateIf((_, value) => value !== null)
  @IsISO8601({ strict: true })
  expiresAt: string | null;

  @IsBoolean()
  active: boolean;
}

export class ValidatePromoDto {
  @IsString()
  @MaxLength(40)
  code: string;

  @IsInt()
  @Min(0)
  subtotal: number;
}
