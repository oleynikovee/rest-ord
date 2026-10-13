import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser, Roles } from '../auth/auth.decorators.js';
import type { PromoCode, PromoQuote, User } from '../domain/models.js';
import { IfMatchVersion } from '../menu/if-match.decorator.js';
import { PromoCodeDto, ValidatePromoDto } from './promo.dto.js';
import { PromoService } from './promo.service.js';

@Controller('promo-codes')
export class PromoController {
  constructor(private readonly promos: PromoService) {}

  @Get()
  @Roles('admin')
  list(): Promise<PromoCode[]> {
    return this.promos.list();
  }

  @Post()
  @Roles('admin')
  create(@Body() dto: PromoCodeDto): Promise<PromoCode> {
    return this.promos.create(dto);
  }

  @Patch(':id')
  @Roles('admin')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: PromoCodeDto,
    @IfMatchVersion() version: number,
  ): Promise<PromoCode> {
    return this.promos.update(id, dto, version);
  }

  /** Any signed-in customer; rate-limited against guessing codes. */
  @Post('validate')
  @HttpCode(200)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  async validate(
    @CurrentUser() user: User,
    @Body() dto: ValidatePromoDto,
  ): Promise<PromoQuote> {
    return (await this.promos.quote(user, dto.code, dto.subtotal)).quote;
  }
}
