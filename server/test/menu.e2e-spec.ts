import type { INestApplication } from '@nestjs/common';
import type request from 'supertest';
import type { App } from 'supertest/types.js';
import type { Category, MenuItem, MenuSnapshot } from '../src/domain/models.js';
import { ADMIN, createTestApp, signIn } from './helpers.js';

describe('Menu management with optimistic locking (e2e)', () => {
  let app: INestApplication<App>;
  let alice: ReturnType<typeof request.agent>;
  let bob: ReturnType<typeof request.agent>;
  let item: MenuItem;

  beforeEach(async () => {
    app = await createTestApp();
    alice = await signIn(app, ADMIN.email, ADMIN.password);
    bob = await signIn(app, ADMIN.email, ADMIN.password);
    item = ((await alice.get('/api/menu').expect(200)).body as MenuSnapshot).items[0];
  });

  afterEach(async () => {
    await app.close();
  });

  it('requires the edited version', async () => {
    const res = await alice.patch(`/api/items/${item.id}`).send({ price: 100 }).expect(428);
    expect(res.body).toMatchObject({ code: 'VERSION_REQUIRED' });
    await alice.delete(`/api/items/${item.id}`).expect(428);
  });

  it('rejects the second of two concurrent edits and returns the winner', async () => {
    const first = await alice
      .patch(`/api/items/${item.id}`)
      .set('If-Match', `"${item.version}"`)
      .send({ price: 1111 })
      .expect(200);
    expect((first.body as MenuItem).version).toBe(item.version + 1);

    const second = await bob
      .patch(`/api/items/${item.id}`)
      .set('If-Match', `"${item.version}"`)
      .send({ price: 2222 })
      .expect(412);
    expect(second.body).toMatchObject({
      code: 'VERSION_CONFLICT',
      current: { id: item.id, price: 1111, version: item.version + 1 },
    });

    await bob
      .patch(`/api/items/${item.id}`)
      .set('If-Match', `W/"${item.version + 1}"`)
      .send({ price: 2222 })
      .expect(200);
  });

  it('lets exactly one of many simultaneous edits win', async () => {
    const results = await Promise.all(
      [1, 2, 3, 4, 5].map((n) =>
        (n % 2 ? alice : bob)
          .patch(`/api/items/${item.id}`)
          .set('If-Match', `"${item.version}"`)
          .send({ price: n * 100 }),
      ),
    );
    expect(results.filter((r) => r.status === 200)).toHaveLength(1);
    expect(results.filter((r) => r.status === 412)).toHaveLength(4);
  });

  it('does not delete what someone else just changed', async () => {
    await alice.patch(`/api/items/${item.id}`).set('If-Match', `"${item.version}"`).send({ available: false }).expect(200);
    await bob.delete(`/api/items/${item.id}`).set('If-Match', `"${item.version}"`).expect(412);
    await bob.delete(`/api/items/${item.id}`).set('If-Match', `"${item.version + 1}"`).expect(204);
    await bob.delete(`/api/items/${item.id}`).set('If-Match', `"${item.version + 1}"`).expect(404);
  });

  it('versions categories too', async () => {
    const category = (await alice.post('/api/categories').send({ name: 'Specials' }).expect(201)).body as Category;
    await alice.patch(`/api/categories/${category.id}`).set('If-Match', '1').send({ name: 'Chef specials' }).expect(200);
    await bob.patch(`/api/categories/${category.id}`).set('If-Match', '1').send({ name: 'Other' }).expect(412);
    await bob.delete(`/api/categories/${category.id}`).set('If-Match', '2').expect(204);
  });
});
