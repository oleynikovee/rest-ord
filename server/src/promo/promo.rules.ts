import { type Cents, computeDiscount, PROMO_ERRORS, type PromoCode } from '../domain/models.js';

export type PromoCheck =
  | { ok: true; discount: Cents }
  | { ok: false; code: (typeof PROMO_ERRORS)[keyof typeof PROMO_ERRORS]; message: string };

export function checkPromo(
  promo: PromoCode | null,
  subtotal: Cents,
  redeemedByUser: number,
  now: Date = new Date(),
): PromoCheck {
  if (!promo) return { ok: false, code: PROMO_ERRORS.notFound, message: 'This promo code does not exist.' };
  if (!promo.active) return { ok: false, code: PROMO_ERRORS.inactive, message: 'This promo code is no longer active.' };
  if (promo.startsAt && now < new Date(promo.startsAt)) {
    return { ok: false, code: PROMO_ERRORS.notStarted, message: 'This promo code is not active yet.' };
  }
  if (promo.expiresAt && now >= new Date(promo.expiresAt)) {
    return { ok: false, code: PROMO_ERRORS.expired, message: 'This promo code has expired.' };
  }
  if (promo.usageLimit !== null && promo.usedCount >= promo.usageLimit) {
    return { ok: false, code: PROMO_ERRORS.exhausted, message: 'This promo code has been fully used.' };
  }
  if (promo.perUserLimit !== null && redeemedByUser >= promo.perUserLimit) {
    return { ok: false, code: PROMO_ERRORS.alreadyUsed, message: 'You have already used this promo code.' };
  }
  if (subtotal < promo.minOrderAmount) {
    return {
      ok: false,
      code: PROMO_ERRORS.minOrder,
      message: `This promo code needs an order of at least $${(promo.minOrderAmount / 100).toFixed(2)}.`,
    };
  }
  return { ok: true, discount: computeDiscount(promo, subtotal) };
}
