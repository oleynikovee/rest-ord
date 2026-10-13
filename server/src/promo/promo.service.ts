import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  type OnApplicationBootstrap,
  PreconditionFailedException,
  UnprocessableEntityException,
} from '@nestjs/common';
import {
  type Cents,
  normalizePromoCode,
  type PromoCode,
  type PromoCodeInput,
  type PromoQuote,
  type User,
} from '../domain/models.js';
import { PromoRepository } from '../domain/ports.js';
import { checkPromo } from './promo.rules.js';

const DEMO_PROMOS: PromoCodeInput[] = [
  {
    code: 'WELCOME10',
    description: '10% off your first order, up to $5',
    kind: 'PERCENT',
    value: 10,
    minOrderAmount: 0,
    maxDiscount: 500,
    usageLimit: null,
    perUserLimit: 1,
    startsAt: null,
    expiresAt: null,
    active: true,
  },
  {
    code: 'SAVE5',
    description: '$5 off orders from $30',
    kind: 'FIXED',
    value: 500,
    minOrderAmount: 3000,
    maxDiscount: null,
    usageLimit: 100,
    perUserLimit: null,
    startsAt: null,
    expiresAt: null,
    active: true,
  },
];

@Injectable()
export class PromoService implements OnApplicationBootstrap {
  private readonly logger = new Logger(PromoService.name);

  constructor(private readonly promos: PromoRepository) {}

  async onApplicationBootstrap(): Promise<void> {
    if ((await this.promos.list()).length > 0) return;
    for (const promo of DEMO_PROMOS) await this.promos.create(promo);
    this.logger.log('Created demo promo codes');
  }

  list(): Promise<PromoCode[]> {
    return this.promos.list();
  }

  async create(input: PromoCodeInput): Promise<PromoCode> {
    const created = await this.promos.create(this.validated(input));
    if (!created) throw codeTaken();
    return created;
  }

  async update(
    id: string,
    input: PromoCodeInput,
    expectedVersion: number,
  ): Promise<PromoCode> {
    const result = await this.promos
      .update(id, this.validated(input), expectedVersion)
      .catch((error: { code?: string }) => {
        if (error.code === '23505') throw codeTaken();
        throw error;
      });
    switch (result.status) {
      case 'ok':
        return result.value;
      case 'not_found':
        throw new NotFoundException({ code: 'PROMO_NOT_FOUND', message: 'Promo code not found.' });
      case 'conflict':
        throw new PreconditionFailedException({
          code: 'VERSION_CONFLICT',
          message: 'Someone else changed this promo code in the meantime.',
          current: result.current,
        });
    }
  }

  async quote(
    user: User,
    code: string,
    subtotal: Cents,
  ): Promise<{ quote: PromoQuote; promo: PromoCode }> {
    const promo = await this.promos.findByCode(normalizePromoCode(code));
    const redeemed = promo ? await this.promos.countRedemptions(promo.id, user.id) : 0;
    const check = checkPromo(promo, subtotal, redeemed);
    if (!check.ok || !promo) {
      throw new UnprocessableEntityException({
        code: check.ok ? 'PROMO_NOT_FOUND' : check.code,
        message: check.ok ? 'This promo code does not exist.' : check.message,
      });
    }
    const { code: normalized, kind, value, minOrderAmount, maxDiscount } = promo;
    return {
      promo,
      quote: {
        rule: { code: normalized, kind, value, minOrderAmount, maxDiscount },
        description: promo.description,
        discount: check.discount,
      },
    };
  }

  private validated(input: PromoCodeInput): PromoCodeInput {
    if (input.kind === 'PERCENT' && input.value > 100) {
      throw new BadRequestException({ code: 'INVALID_PERCENT', message: 'A percentage cannot be more than 100.' });
    }
    if (input.startsAt && input.expiresAt && input.startsAt >= input.expiresAt) {
      throw new BadRequestException({ code: 'INVALID_DATES', message: 'The end date must be after the start date.' });
    }
    return input;
  }
}

const codeTaken = (): ConflictException =>
  new ConflictException({ code: 'PROMO_CODE_TAKEN', message: 'A promo code with this name already exists.' });
