/**
 * Provider contract tests: the running API must match the published contract.
 * 1. Every route the server exposes is documented in the OpenAPI document, and vice versa.
 * 2. Real responses (success and error) validate against the documented schemas.
 */
import type { INestApplication } from '@nestjs/common';
import { METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants.js';
import { RequestMethod } from '@nestjs/common';
import { MetadataScanner, ModulesContainer } from '@nestjs/core';
import { API_OPERATIONS, SCHEMAS_BY_ID, buildOpenApiDocument } from '@trattoria/contracts/openapi';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import type { z } from 'zod';
import type { MenuSnapshot, PromoCode } from '../src/domain/models.js';
import { ADMIN, CUSTOMER, createTestApp, signIn } from './helpers.js';

const schema = (id: string): z.ZodType => {
  const found = SCHEMAS_BY_ID[id];
  if (!found) throw new Error(`No schema ${id}`);
  return found;
};

/** Validates and returns a readable error instead of a huge zod dump. */
function conforms(id: string, body: unknown): void {
  const result = schema(id).safeParse(body);
  if (!result.success) {
    throw new Error(`${id} contract violated: ${JSON.stringify(result.error.issues.slice(0, 3))}`);
  }
}

describe('API contract (provider side)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    app = await createTestApp();
  });

  afterEach(async () => {
    await app.close();
  });

  it('documents exactly the routes the server exposes', () => {
    const scanner = new MetadataScanner();
    const served = new Set<string>();
    const controllers = [...app.get(ModulesContainer).values()].flatMap((module) => [...module.controllers.values()]);
    for (const wrapper of controllers) {
      const instance = wrapper.instance as object | undefined;
      if (!instance || !wrapper.metatype) continue;
      const base = String(Reflect.getMetadata(PATH_METADATA, wrapper.metatype) ?? '');
      for (const name of scanner.getAllMethodNames(Object.getPrototypeOf(instance))) {
        const handler = (instance as Record<string, unknown>)[name] as object;
        const path = Reflect.getMetadata(PATH_METADATA, handler) as string | undefined;
        const method = Reflect.getMetadata(METHOD_METADATA, handler) as RequestMethod | undefined;
        if (path === undefined || method === undefined) continue;
        const full = `/api/${[base, path].filter((p) => p && p !== '/').join('/')}`.replace(/:(\w+)/g, '{$1}');
        served.add(`${RequestMethod[method].toLowerCase()} ${full.replace(/\/$/, '')}`);
      }
    }
    const documented = new Set(
      Object.entries(API_OPERATIONS).flatMap(([path, methods]) => Object.keys(methods).map((m) => `${m} ${path}`)),
    );
    expect([...served].sort()).toEqual([...documented].sort());
  });

  it('publishes a valid OpenAPI 3.1 document with resolvable references', async () => {
    const doc = (await request(app.getHttpServer()).get('/api/openapi.json').expect(200)).body as ReturnType<
      typeof buildOpenApiDocument
    > & { components: { schemas: Record<string, unknown> } };
    expect(doc.openapi).toBe('3.1.0');
    const refs = [...JSON.stringify(doc).matchAll(/"\$ref":"#\/components\/schemas\/([^"]+)"/g)].map((m) => m[1]);
    for (const id of new Set(refs)) expect(doc.components.schemas).toHaveProperty(id);
    await request(app.getHttpServer()).get('/api/docs').expect(200);
  });

  it('returns responses that match the documented schemas', async () => {
    const anonymous = request(app.getHttpServer());
    conforms('ClientConfig', (await anonymous.get('/api/config').expect(200)).body);
    conforms('CurrentSessionResponse', (await anonymous.get('/api/auth/me').expect(200)).body);
    const menu = (await anonymous.get('/api/menu').expect(200)).body as MenuSnapshot;
    conforms('MenuSnapshot', menu);

    const admin = await signIn(app, ADMIN.email, ADMIN.password);
    const customer = await signIn(app, CUSTOMER.email, CUSTOMER.password);
    conforms('CurrentSessionResponse', (await customer.get('/api/auth/me').expect(200)).body);

    const category = (await admin.post('/api/categories').send({ name: 'Contract' }).expect(201)).body;
    conforms('Category', category);
    const item = (await admin.post('/api/items').send({ categoryId: category.id, name: 'Contract dish', price: 1500 }).expect(201)).body;
    conforms('MenuItem', item);
    conforms('MenuItem', (await admin.patch(`/api/items/${item.id}`).set('If-Match', '1').send({ price: 1600 }).expect(200)).body);

    const order = await customer
      .post('/api/orders')
      .set('Idempotency-Key', 'contract-order-1')
      .send({ lines: [{ itemId: item.id, quantity: 2, unitPrice: 1600, openPrice: false }], promoCode: 'WELCOME10' })
      .expect(201);
    conforms('Order', order.body);
    conforms('OrdersPage', (await customer.get('/api/orders?limit=5').expect(200)).body);
    conforms('EventsPage', (await customer.get(`/api/events?after=${menu.seq}`).expect(200)).body);

    const promos = (await admin.get('/api/promo-codes').expect(200)).body as PromoCode[];
    promos.forEach((promo) => conforms('PromoCode', promo));
    conforms('PromoQuote', (await customer.post('/api/promo-codes/validate').send({ code: 'SAVE5', subtotal: 5000 }).expect(200)).body);
  });

  it('returns error bodies that match ApiError, including their extra fields', async () => {
    const anonymous = request(app.getHttpServer());
    const admin = await signIn(app, ADMIN.email, ADMIN.password);
    const customer = await signIn(app, CUSTOMER.email, CUSTOMER.password);
    const menu = (await anonymous.get('/api/menu')).body as MenuSnapshot;
    const item = menu.items.find((i) => i.available && !i.openPrice)!;

    const errors = [
      (await anonymous.get('/api/orders').expect(401)).body,
      (await customer.post('/api/categories').send({ name: 'x' }).expect(403)).body,
      (await admin.patch(`/api/items/${item.id}`).send({ price: 1 }).expect(428)).body,
      (await anonymous.post('/api/auth/login').send({ email: 'bad' }).expect(400)).body,
      (await customer.post('/api/promo-codes/validate').send({ code: 'NOPE', subtotal: 100 }).expect(422)).body,
    ];
    errors.forEach((body) => conforms('ApiError', body));

    const conflict = (await admin.patch(`/api/items/${item.id}`).set('If-Match', '"99"').send({ price: 1 }).expect(412)).body;
    conforms('ApiError', conflict);
    expect(conflict.current).toMatchObject({ id: item.id });

    const changed = (
      await customer
        .post('/api/orders')
        .set('Idempotency-Key', 'contract-order-2')
        .send({ lines: [{ itemId: item.id, quantity: 1, unitPrice: (item.price ?? 0) + 1, openPrice: false }] })
        .expect(409)
    ).body;
    conforms('ApiError', changed);
    expect(changed.issues).toHaveLength(1);
  });
});
