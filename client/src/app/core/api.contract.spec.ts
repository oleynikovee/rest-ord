/**
 * Consumer contract test: every request ApiService can make must exist in the
 * published OpenAPI contract (same method and path) and send a body that matches
 * the documented request schema. Together with the provider tests on the server,
 * a breaking change on either side fails CI.
 */
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { API_OPERATIONS, SCHEMAS_BY_ID } from '@trattoria/contracts/openapi';
import type { Observable } from 'rxjs';
import { ApiService } from './api.service';
import type { PromoCodeInput } from './models';

const uuid = '0b9d7a4e-1c2f-4a3b-9d8e-7f6a5b4c3d2e';
const versioned = { id: uuid, version: 3 };
const promo: PromoCodeInput = {
  code: 'SAVE5',
  description: '',
  kind: 'FIXED',
  value: 500,
  minOrderAmount: 0,
  maxDiscount: null,
  usageLimit: null,
  perUserLimit: null,
  startsAt: null,
  expiresAt: null,
  active: true,
};

function findOperation(method: string, url: string): { path: string; op: { body?: string; ifMatch?: boolean } } | null {
  const pathname = url.split('?')[0];
  for (const [template, methods] of Object.entries(API_OPERATIONS)) {
    const pattern = new RegExp(`^${template.replace(/\{\w+\}/g, '[^/]+')}$`);
    const op = (methods as Record<string, { body?: string; ifMatch?: boolean }>)[method.toLowerCase()];
    if (pattern.test(pathname) && op) return { path: template, op };
  }
  return null;
}

describe('ApiService matches the API contract', () => {
  it('only calls documented operations, with valid bodies and headers', () => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    const api = TestBed.inject(ApiService);
    const backend = TestBed.inject(HttpTestingController);

    const calls: Observable<unknown>[] = [
      api.getSession(),
      api.login({ email: 'a@b.cd', password: 'secret' }),
      api.register({ email: 'a@b.cd', name: 'A', password: 'long-enough' }),
      api.logout(),
      api.getMenu(),
      api.getEvents(10),
      api.getOrders(),
      api.getOrders(42),
      api.placeOrder({ lines: [{ itemId: uuid, quantity: 1, unitPrice: 100, openPrice: false }], promoCode: 'SAVE5' }, 'key-12345678'),
      api.createCategory('Soups'),
      api.updateCategory(versioned, 'Soups'),
      api.deleteCategory(versioned),
      api.createItem({ categoryId: uuid, name: 'Soup', description: '', price: 500, available: true, openPrice: false }),
      api.updateItem(versioned, { available: false }),
      api.deleteItem(versioned),
      api.validatePromo({ code: 'SAVE5', subtotal: 1000 }),
      api.getPromoCodes(),
      api.createPromoCode(promo),
      api.updatePromoCode(versioned, promo),
    ];
    calls.forEach((call) => call.subscribe({ error: () => undefined }));

    const requests = backend.match(() => true);
    expect(requests).toHaveLength(calls.length);
    for (const { request } of requests) {
      const found = findOperation(request.method, request.urlWithParams);
      expect(found, `${request.method} ${request.urlWithParams} is not in the contract`).not.toBeNull();
      if (found?.op.body) {
        const result = SCHEMAS_BY_ID[found.op.body].safeParse(request.body);
        expect(result.success, `${request.method} ${found.path} body: ${JSON.stringify(result.error?.issues)}`).toBe(true);
      }
      if (found?.op.ifMatch) expect(request.headers.get('If-Match')).toBe('"3"');
    }
  });
});
