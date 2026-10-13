import { computeDiscount, type PromoCode } from '../domain/models.js';
import { checkPromo } from './promo.rules.js';

const promo = (patch: Partial<PromoCode> = {}): PromoCode => ({
  id: 'p',
  code: 'TEST',
  description: '',
  kind: 'PERCENT',
  value: 10,
  minOrderAmount: 0,
  maxDiscount: null,
  usageLimit: null,
  perUserLimit: null,
  usedCount: 0,
  startsAt: null,
  expiresAt: null,
  active: true,
  version: 1,
  ...patch,
});

describe('computeDiscount', () => {
  it('takes a percentage, rounded down to whole cents', () => {
    expect(computeDiscount(promo({ value: 15 }), 1999)).toBe(299);
  });

  it('caps a percentage with maxDiscount', () => {
    expect(computeDiscount(promo({ value: 50, maxDiscount: 500 }), 10_000)).toBe(500);
  });

  it('never discounts more than the subtotal', () => {
    expect(computeDiscount(promo({ kind: 'FIXED', value: 5000 }), 1200)).toBe(1200);
  });

  it('gives nothing below the minimum order amount', () => {
    expect(computeDiscount(promo({ kind: 'FIXED', value: 500, minOrderAmount: 3000 }), 2999)).toBe(0);
  });
});

describe('checkPromo', () => {
  const now = new Date('2026-06-01T12:00:00Z');

  it('accepts a valid code', () => {
    expect(checkPromo(promo(), 1000, 0, now)).toEqual({ ok: true, discount: 100 });
  });

  it.each([
    ['unknown', null, 'PROMO_NOT_FOUND'],
    ['inactive', promo({ active: false }), 'PROMO_INACTIVE'],
    ['not started', promo({ startsAt: '2026-07-01T00:00:00Z' }), 'PROMO_NOT_STARTED'],
    ['expired', promo({ expiresAt: '2026-06-01T12:00:00Z' }), 'PROMO_EXPIRED'],
    ['used up', promo({ usageLimit: 3, usedCount: 3 }), 'PROMO_EXHAUSTED'],
    ['below minimum', promo({ minOrderAmount: 2000 }), 'PROMO_MIN_ORDER'],
  ] as const)('rejects a code that is %s', (_, candidate, code) => {
    expect(checkPromo(candidate, 1000, 0, now)).toMatchObject({ ok: false, code });
  });

  it('enforces the per-customer limit', () => {
    expect(checkPromo(promo({ perUserLimit: 1 }), 1000, 1, now)).toMatchObject({ ok: false, code: 'PROMO_ALREADY_USED' });
  });
});
