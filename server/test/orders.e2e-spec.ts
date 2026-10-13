import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';
import { loadConfig } from '../src/config.js';
import type { MenuItem, MenuSnapshot, Order } from '../src/domain/models.js';
import { OrderStatusSimulator } from '../src/orders/order-status.simulator.js';

describe('Menu and orders (e2e, in-memory storage)', () => {
  let app: INestApplication<App>;
  let item: MenuItem;

  beforeEach(async () => {
    const config = { ...loadConfig({}), statusStepMs: 0 };
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule.forRoot(config)],
    }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();

    const menu = await request(app.getHttpServer()).get('/api/menu').expect(200);
    const snapshot = menu.body as MenuSnapshot;
    item = snapshot.items.find((i) => i.available && !i.openPrice)!;
  });

  afterEach(async () => {
    await app.close();
  });

  const placeOrder = (key: string, unitPrice = item.price!) =>
    request(app.getHttpServer())
      .post('/api/orders')
      .set('Idempotency-Key', key)
      .send({
        lines: [{ itemId: item.id, quantity: 2, unitPrice, openPrice: false }],
        discount: 100,
      });

  it('seeds a large menu', async () => {
    const res = await request(app.getHttpServer()).get('/api/menu').expect(200);
    expect((res.body as MenuSnapshot).items.length).toBeGreaterThan(500);
  });

  it('places an order exactly once for repeated requests with the same key', async () => {
    const first = await placeOrder('checkout-key-1').expect(201);
    const second = await placeOrder('checkout-key-1').expect(200);

    expect((second.body as Order).id).toBe((first.body as Order).id);
    expect((first.body as Order).total).toBe(item.price! * 2 - 100);

    const orders = await request(app.getHttpServer()).get('/api/orders').expect(200);
    expect(orders.body).toHaveLength(1);
  });

  it('creates a single order for concurrent double submits', async () => {
    const responses = await Promise.all(
      Array.from({ length: 5 }, () => placeOrder('checkout-key-concurrent')),
    );
    expect(responses.filter((r) => r.status === 201)).toHaveLength(1);
    responses.forEach((r) => expect([200, 201, 409]).toContain(r.status));

    const orders = await request(app.getHttpServer()).get('/api/orders').expect(200);
    expect(orders.body).toHaveLength(1);
  });

  it('refuses the order with details when an item became unavailable', async () => {
    await request(app.getHttpServer())
      .patch(`/api/items/${item.id}`)
      .send({ available: false })
      .expect(200);

    const res = await placeOrder('checkout-key-2').expect(409);
    expect(res.body).toMatchObject({
      code: 'MENU_CHANGED',
      issues: [{ itemId: item.id, kind: 'unavailable' }],
    });

    // The key is released, so the same checkout can be retried after the fix.
    await request(app.getHttpServer())
      .patch(`/api/items/${item.id}`)
      .send({ available: true })
      .expect(200);
    await placeOrder('checkout-key-2').expect(201);
  });

  it('refuses the order when the price changed', async () => {
    await placeOrder('checkout-key-3', item.price! + 1).expect(409);
  });

  it('requires an idempotency key', async () => {
    await request(app.getHttpServer())
      .post('/api/orders')
      .send({ lines: [], discount: 0 })
      .expect(400);
  });

  it('validates menu items', async () => {
    await request(app.getHttpServer())
      .post('/api/items')
      .send({ categoryId: item.categoryId, name: 'No price', openPrice: false })
      .expect(400);
    const created = await request(app.getHttpServer())
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

    const orders = await request(app.getHttpServer()).get('/api/orders').expect(200);
    expect((orders.body as Order[]).find((o) => o.id === created.id)?.status).toBe('ACCEPTED');
  });
});
