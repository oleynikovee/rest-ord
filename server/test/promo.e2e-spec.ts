import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import type { MenuItem, MenuSnapshot, Order, PromoCode, PromoCodeInput, PromoQuote } from '../src/domain/models.js';
import { ADMIN, CUSTOMER, createTestApp, signIn } from './helpers.js';

const base: PromoCodeInput = {
  code: 'TEST10',
  description: '10% off',
  kind: 'PERCENT',
  value: 10,
  minOrderAmount: 0,
  maxDiscount: null,
  usageLimit: null,
  perUserLimit: null,
  startsAt: null,
  expiresAt: null,
  active: true,
};

describe('Promo codes (e2e)', () => {
  let app: INestApplication<App>;
  let admin: ReturnType<typeof request.agent>;
  let customer: ReturnType<typeof request.agent>;
  let item: MenuItem;

  beforeEach(async () => {
    app = await createTestApp();
    admin = await signIn(app, ADMIN.email, ADMIN.password);
    customer = await signIn(app, CUSTOMER.email, CUSTOMER.password);
    const menu = (await request(app.getHttpServer()).get('/api/menu')).body as MenuSnapshot;
    item = menu.items.find((i) => i.available && !i.openPrice && (i.price ?? 0) >= 1000)!;
  });

  afterEach(async () => {
    await app.close();
  });

  const createPromo = async (patch: Partial<PromoCodeInput>): Promise<PromoCode> =>
    (await admin.post('/api/promo-codes').send({ ...base, ...patch }).expect(201)).body as PromoCode;

  const order = (
    agent: ReturnType<typeof request.agent>,
    key: string,
    promoCode?: string,
  ): request.Test =>
    agent
      .post('/api/orders')
      .set('Idempotency-Key', key)
      .send({ lines: [{ itemId: item.id, quantity: 3, unitPrice: item.price, openPrice: false }], promoCode });

  it('lets only admins manage promo codes', async () => {
    await customer.get('/api/promo-codes').expect(403);
    await customer.post('/api/promo-codes').send(base).expect(403);
    const created = await createPromo({ code: ' summer-15 ' });
    expect(created).toMatchObject({ code: 'SUMMER-15', usedCount: 0, version: 1 });
    await admin.post('/api/promo-codes').send({ ...base, code: 'summer-15' }).expect(409);
    await admin.post('/api/promo-codes').send({ ...base, code: 'BAD', value: 150 }).expect(400);
  });

  it('quotes a code for the cart and applies the same discount to the order', async () => {
    await createPromo({ value: 15, maxDiscount: 300 });
    const subtotal = item.price! * 3;
    const quote = (await customer.post('/api/promo-codes/validate').send({ code: 'test10', subtotal }).expect(200))
      .body as PromoQuote;
    const expected = Math.min(Math.floor((subtotal * 15) / 100), 300);
    expect(quote.discount).toBe(expected);

    const placed = (await order(customer, 'promo-order-1', 'test10').expect(201)).body as Order;
    expect(placed).toMatchObject({ subtotal, discount: expected, total: subtotal - expected, promoCode: 'TEST10' });
  });

  it('ignores any discount sent by the client', async () => {
    const placed = (
      await customer
        .post('/api/orders')
        .set('Idempotency-Key', 'forged-discount')
        .send({ lines: [{ itemId: item.id, quantity: 1, unitPrice: item.price, openPrice: false }], discount: 999 })
        .expect(400)
    ).body as { message: string[] };
    expect(String(placed.message)).toContain('discount should not exist');
  });

  it('rejects codes that cannot be used, with a reason', async () => {
    await createPromo({ code: 'OFF', active: false });
    await createPromo({ code: 'OLD', expiresAt: '2020-01-01T00:00:00.000Z' });
    await createPromo({ code: 'BIG', minOrderAmount: 1_000_000 });

    for (const [code, reason] of [
      ['NOPE', 'PROMO_NOT_FOUND'],
      ['OFF', 'PROMO_INACTIVE'],
      ['OLD', 'PROMO_EXPIRED'],
      ['BIG', 'PROMO_MIN_ORDER'],
    ]) {
      const res = await order(customer, `bad-code-${code}`, code).expect(422);
      expect(res.body).toMatchObject({ code: reason });
    }
  });

  it('enforces the per-customer limit', async () => {
    await createPromo({ code: 'ONCE', perUserLimit: 1 });
    await order(customer, 'once-key-1', 'ONCE').expect(201);
    const second = await order(customer, 'once-key-2', 'ONCE').expect(422);
    expect(second.body).toMatchObject({ code: 'PROMO_ALREADY_USED' });
    // A retry of the first order is not a second use.
    await order(customer, 'once-key-1', 'ONCE').expect(200);
  });

  it('never exceeds the total usage limit, even under concurrency', async () => {
    const promo = await createPromo({ code: 'FIRST3', usageLimit: 3 });
    const results = await Promise.all(
      Array.from({ length: 8 }, (_, i) => order(customer, `race-key-${i}`, 'FIRST3')),
    );
    expect(results.filter((r) => r.status === 201)).toHaveLength(3);
    expect(results.filter((r) => r.status === 422)).toHaveLength(5);

    const list = (await admin.get('/api/promo-codes').expect(200)).body as PromoCode[];
    expect(list.find((p) => p.id === promo.id)?.usedCount).toBe(3);
  });

  it('versions promo code edits', async () => {
    const promo = await createPromo({});
    await admin.patch(`/api/promo-codes/${promo.id}`).set('If-Match', '1').send({ ...base, active: false }).expect(200);
    await admin.patch(`/api/promo-codes/${promo.id}`).set('If-Match', '1').send({ ...base, value: 20 }).expect(412);
  });
});
