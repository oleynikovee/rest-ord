import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import {
  type EventEnvelope,
  type EventsPage,
  type MenuSnapshot,
  TOPICS,
} from '../src/domain/models.js';
import { EventBus, EventLog } from '../src/domain/ports.js';
import { OutboxRelay } from '../src/events/outbox-relay.js';
import { ADMIN, CUSTOMER, createTestApp, signIn } from './helpers.js';

describe('Event log: outbox and replay (e2e)', () => {
  let app: INestApplication<App>;
  let admin: ReturnType<typeof request.agent>;
  let customer: ReturnType<typeof request.agent>;
  let snapshot: MenuSnapshot;

  beforeEach(async () => {
    app = await createTestApp();
    admin = await signIn(app, ADMIN.email, ADMIN.password);
    customer = await signIn(app, CUSTOMER.email, CUSTOMER.password);
    snapshot = (await request(app.getHttpServer()).get('/api/menu').expect(200)).body as MenuSnapshot;
  });

  afterEach(async () => {
    await app.close();
  });

  const replay = async (agent: ReturnType<typeof request.agent>, after: number): Promise<EventsPage> =>
    (await agent.get(`/api/events?after=${after}`).expect(200)).body as EventsPage;

  const placeOrder = (agent: ReturnType<typeof request.agent>, key: string): request.Test => {
    const item = snapshot.items.slice(5).find((i) => i.available && !i.openPrice)!;
    return agent
      .post('/api/orders')
      .set('Idempotency-Key', key)
      .send({ lines: [{ itemId: item.id, quantity: 1, unitPrice: item.price, openPrice: false }] });
  };

  it('logs every change with increasing seq and replays what came after a snapshot', async () => {
    const item = snapshot.items[0];
    await admin.patch(`/api/items/${item.id}`).set('If-Match', `"${item.version}"`).send({ price: 4242 }).expect(200);
    await placeOrder(customer, 'event-order-1').expect(201);

    const page = await replay(customer, snapshot.seq);
    expect(page).toMatchObject({ reset: false, hasMore: false });
    expect(page.events.map((e) => e.topic)).toEqual([TOPICS.menu, TOPICS.orders]);
    expect(page.events[0]).toMatchObject({ seq: snapshot.seq + 1, event: { type: 'item.upserted', item: { price: 4242 } } });
    expect(page.nextAfter).toBe(snapshot.seq + 2);

    const later = (await request(app.getHttpServer()).get('/api/menu')).body as MenuSnapshot;
    expect(later.seq).toBe(snapshot.seq + 2);
    expect(later.items.find((i) => i.id === item.id)?.price).toBe(4242);
    expect((await replay(customer, later.seq)).events).toEqual([]);
  });

  it('does not log failed writes', async () => {
    const item = snapshot.items[0];
    await admin.patch(`/api/items/${item.id}`).set('If-Match', '"999"').send({ price: 1 }).expect(412);
    expect((await replay(admin, snapshot.seq)).events).toEqual([]);
  });

  it('replays order events only to their owner and admins', async () => {
    await placeOrder(customer, 'event-order-2').expect(201);
    const other = request.agent(app.getHttpServer());
    await other.post('/api/auth/register').send({ email: 'other@test.local', name: 'Other', password: 'other-password' }).expect(201);

    expect((await replay(customer, snapshot.seq)).events).toHaveLength(1);
    expect((await replay(admin, snapshot.seq)).events).toHaveLength(1);
    expect((await replay(other, snapshot.seq)).events).toHaveLength(0);
    expect((await replay(request(app.getHttpServer()), snapshot.seq)).events).toHaveLength(0);
  });

  it('relays logged events to the bus in order', async () => {
    const received: number[] = [];
    app.get(EventBus).subscribe<EventEnvelope>(TOPICS.menu, (e) => received.push(e.seq));
    const relay = app.get(OutboxRelay);

    let item = snapshot.items[1];
    for (const price of [101, 102, 103]) {
      item = (await admin.patch(`/api/items/${item.id}`).set('If-Match', `"${item.version}"`).send({ price }).expect(200)).body;
    }
    await relay.drain();
    expect(received).toEqual([snapshot.seq + 1, snapshot.seq + 2, snapshot.seq + 3]);
  });

  it('asks for a reload when the log no longer goes back far enough', async () => {
    const item = snapshot.items[0];
    await admin.patch(`/api/items/${item.id}`).set('If-Match', `"${item.version}"`).send({ price: 5 }).expect(200);
    const log = app.get(EventLog);
    await app.get(OutboxRelay).drain();
    await log.prune(-1);
    const page = await replay(admin, 0);
    expect(page).toMatchObject({ reset: true, events: [] });
  });
});
