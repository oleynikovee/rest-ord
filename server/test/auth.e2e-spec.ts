import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import type { MenuSnapshot, Order, OrdersPage } from '../src/domain/models.js';
import { ADMIN, CUSTOMER, createTestApp, signIn } from './helpers.js';

describe('Authentication and authorization (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    app = await createTestApp();
  });

  afterEach(async () => {
    await app.close();
  });

  it('sets an httpOnly, SameSite=Strict session cookie on login', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send(CUSTOMER)
      .expect(200);
    const cookie = String(res.headers['set-cookie']);
    expect(cookie).toContain('session=');
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('SameSite=Strict');
    expect(res.body).toMatchObject({ user: { email: CUSTOMER.email, role: 'customer' } });
    expect(JSON.stringify(res.body)).not.toContain('passwordHash');
  });

  it('rejects wrong credentials with one generic message', async () => {
    const wrongPassword = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: CUSTOMER.email, password: 'nope-nope' })
      .expect(401);
    const unknownEmail = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'nobody@test.local', password: 'nope-nope' })
      .expect(401);
    expect(wrongPassword.body).toEqual(unknownEmail.body);
  });

  it('registers customers, refuses duplicates and short passwords', async () => {
    const agent = request.agent(app.getHttpServer());
    await agent
      .post('/api/auth/register')
      .send({ email: 'New@Test.Local', name: 'New', password: 'long-enough' })
      .expect(201);
    const me = await agent.get('/api/auth/me').expect(200);
    expect(me.body).toMatchObject({ user: { email: 'new@test.local', role: 'customer' } });

    await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({ email: 'new@test.local', name: 'Again', password: 'long-enough' })
      .expect(409);
    await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({ email: 'other@test.local', name: 'Short', password: 'short' })
      .expect(400);
  });

  it('cannot register as admin', async () => {
    await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({ email: 'evil@test.local', name: 'Evil', password: 'long-enough', role: 'admin' })
      .expect(400);
  });

  it('keeps the menu public but protects everything else', async () => {
    const anonymous = request(app.getHttpServer());
    await anonymous.get('/api/menu').expect(200);
    await anonymous.get('/api/health').expect(200);
    await anonymous.get('/api/auth/me').expect(200, { user: null });
    await anonymous.get('/api/orders').expect(401);
    await anonymous.post('/api/orders').set('Idempotency-Key', 'anonymous-key').send({}).expect(401);
    await anonymous.post('/api/categories').send({ name: 'Hack' }).expect(401);
  });

  it('rejects forged and tampered tokens', async () => {
    await request(app.getHttpServer())
      .get('/api/orders')
      .set('Cookie', 'session=eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ4Iiwicm9sZSI6ImFkbWluIn0.forged')
      .expect(401);
  });

  it('allows menu management to admins only', async () => {
    const customer = await signIn(app, CUSTOMER.email, CUSTOMER.password);
    const admin = await signIn(app, ADMIN.email, ADMIN.password);
    const { items } = (await customer.get('/api/menu').expect(200)).body as MenuSnapshot;

    await customer.patch(`/api/items/${items[0].id}`).set('If-Match', '1').send({ available: false }).expect(403);
    await customer.post('/api/categories').send({ name: 'Hack' }).expect(403);
    await admin.patch(`/api/items/${items[0].id}`).set('If-Match', '1').send({ available: false }).expect(200);
  });

  it('shows customers only their own orders and admins all of them', async () => {
    const { items } = (await request(app.getHttpServer()).get('/api/menu')).body as MenuSnapshot;
    const item = items.find((i) => i.available && !i.openPrice)!;
    const order = {
      lines: [{ itemId: item.id, quantity: 1, unitPrice: item.price, openPrice: false }],
      discount: 0,
    };

    const alice = request.agent(app.getHttpServer());
    await alice
      .post('/api/auth/register')
      .send({ email: 'alice@test.local', name: 'Alice', password: 'alice-password' })
      .expect(201);
    const bob = await signIn(app, CUSTOMER.email, CUSTOMER.password);
    const admin = await signIn(app, ADMIN.email, ADMIN.password);

    const aliceOrder = (await alice.post('/api/orders').set('Idempotency-Key', 'shared-key-1').send(order).expect(201)).body as Order;
    // The same client key from another user is a different order, never Alice's one.
    const bobOrder = (await bob.post('/api/orders').set('Idempotency-Key', 'shared-key-1').send(order).expect(201)).body as Order;
    expect(bobOrder.id).not.toBe(aliceOrder.id);
    expect(aliceOrder).toMatchObject({ customerName: 'Alice' });

    const aliceList = ((await alice.get('/api/orders').expect(200)).body as OrdersPage).items;
    const adminList = ((await admin.get('/api/orders').expect(200)).body as OrdersPage).items;
    expect(aliceList.map((o) => o.id)).toEqual([aliceOrder.id]);
    expect(adminList.map((o) => o.id).sort()).toEqual([aliceOrder.id, bobOrder.id].sort());
  });

  it('ends the session on logout', async () => {
    const customer = await signIn(app, CUSTOMER.email, CUSTOMER.password);
    await customer.get('/api/orders').expect(200);
    await customer.post('/api/auth/logout').expect(204);
    await customer.get('/api/orders').expect(401);
  });
});
