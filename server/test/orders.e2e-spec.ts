import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import type { MenuItem, MenuSnapshot, Order, OrdersPage } from '../src/domain/models.js';
import { OrderStatusSimulator } from '../src/orders/order-status.simulator.js';
import { ADMIN, CUSTOMER, createTestApp, signIn } from './helpers.js';

describe('Menu and orders (e2e, in-memory storage)', () => {
  let app: INestApplication<App>;
  let item: MenuItem;
  let customer: ReturnType<typeof request.agent>;
  let admin: ReturnType<typeof request.agent>;

  beforeEach(async () => {
    app = await createTestApp();
    customer = await signIn(app, CUSTOMER.email, CUSTOMER.password);
    admin = await signIn(app, ADMIN.email, ADMIN.password);

    const menu = await request(app.getHttpServer()).get('/api/menu').expect(200);
    const snapshot = menu.body as MenuSnapshot;
    item = snapshot.items.find((i) => i.available && !i.openPrice)!;
  });

  afterEach(async () => {
    await app.close();
  });

  const placeOrder = (key: string, unitPrice = item.price!): request.Test =>
    customer
      .post('/api/orders')
      .set('Idempotency-Key', key)
      .send({
        lines: [{ itemId: item.id, quantity: 2, unitPrice, openPrice: false }],
      });

  it('seeds a large menu', async () => {
    const res = await request(app.getHttpServer()).get('/api/menu').expect(200);
    expect((res.body as MenuSnapshot).items.length).toBeGreaterThan(500);
  });

  it('places an order exactly once for repeated requests with the same key', async () => {
    const first = await placeOrder('checkout-key-1').expect(201);
    const second = await placeOrder('checkout-key-1').expect(200);

    expect((second.body as Order).id).toBe((first.body as Order).id);
    expect((first.body as Order).total).toBe(item.price! * 2);

    const orders = await customer.get('/api/orders').expect(200);
    expect((orders.body as OrdersPage).items).toHaveLength(1);
  });

  it('creates a single order for concurrent double submits', async () => {
    const responses = await Promise.all(
      Array.from({ length: 5 }, () => placeOrder('checkout-key-concurrent')),
    );
    expect(responses.filter((r) => r.status === 201)).toHaveLength(1);
    responses.forEach((r) => expect([200, 201, 409]).toContain(r.status));

    const orders = await customer.get('/api/orders').expect(200);
    expect((orders.body as OrdersPage).items).toHaveLength(1);
  });

  it('refuses the order with details when an item became unavailable', async () => {
    await admin
      .patch(`/api/items/${item.id}`)
      .set('If-Match', `"${item.version}"`)
      .send({ available: false })
      .expect(200);

    const res = await placeOrder('checkout-key-2').expect(409);
    expect(res.body).toMatchObject({
      code: 'MENU_CHANGED',
      issues: [{ itemId: item.id, kind: 'unavailable' }],
    });

    await admin
      .patch(`/api/items/${item.id}`)
      .set('If-Match', `"${item.version + 1}"`)
      .send({ available: true })
      .expect(200);
    await placeOrder('checkout-key-2').expect(201);
  });

  it('refuses the order when the price changed', async () => {
    await placeOrder('checkout-key-3', item.price! + 1).expect(409);
  });

  it('requires an idempotency key', async () => {
    await customer
      .post('/api/orders')
      .send({ lines: [] })
      .expect(400);
  });

  it('validates menu items', async () => {
    await admin
      .post('/api/items')
      .send({ categoryId: item.categoryId, name: 'No price', openPrice: false })
      .expect(400);
    const created = await admin
      .post('/api/items')
      .send({ categoryId: item.categoryId, name: 'Market fish', openPrice: true })
      .expect(201);
    expect(created.body).toMatchObject({ openPrice: true, price: null, version: 1 });
  });

  it('advances order statuses', async () => {
    const created = (await placeOrder('checkout-key-4').expect(201)).body as Order;
    const simulator = app.get(OrderStatusSimulator);
    Object.assign(simulator, { config: { statusStepMs: -1 } });
    await simulator.tick();

    const orders = await customer.get('/api/orders').expect(200);
    expect((orders.body as OrdersPage).items.find((o) => o.id === created.id)?.status).toBe('ACCEPTED');
  });

  it('pages through orders with a stable cursor', async () => {
    for (let i = 1; i <= 5; i++) await placeOrder(`page-key-${i}`).expect(201);

    const first = (await customer.get('/api/orders?limit=2').expect(200)).body as OrdersPage;
    expect(first.items.map((o) => o.number)).toEqual([5, 4]);
    expect(first.nextCursor).toBe(4);

    await placeOrder('page-key-6').expect(201);

    const second = (await customer.get(`/api/orders?limit=2&before=${first.nextCursor}`).expect(200)).body as OrdersPage;
    expect(second.items.map((o) => o.number)).toEqual([3, 2]);
    const last = (await customer.get(`/api/orders?limit=2&before=${second.nextCursor}`).expect(200)).body as OrdersPage;
    expect(last).toMatchObject({ nextCursor: null });
    expect(last.items.map((o) => o.number)).toEqual([1]);

    await customer.get('/api/orders?limit=1000').expect(400);
    await customer.get('/api/orders?before=abc').expect(400);
  });
});
