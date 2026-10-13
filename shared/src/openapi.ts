/**
 * OpenAPI 3.1 document generated from the zod schemas, so the published contract
 * cannot drift from the types the server and client compile against.
 */
import { z } from 'zod';
import * as schemas from './schemas.js';

/** Every named schema, by its OpenAPI component name (used by contract tests). */
export const SCHEMAS_BY_ID: Record<string, z.ZodType> = Object.fromEntries(
  (Object.values(schemas) as unknown[])
    .filter((schema): schema is z.ZodType => schema instanceof z.ZodType)
    .flatMap((schema) => {
      const id = z.globalRegistry.get(schema)?.id;
      return id ? [[id, schema]] : [];
    }),
);

type Method = 'get' | 'post' | 'patch' | 'delete';

interface Operation {
  summary: string;
  /** `public`: no session; `user`: any signed-in user; `admin`: admins only. */
  access: 'public' | 'user' | 'admin';
  body?: string;
  query?: Record<string, { schema: object; required?: boolean; description: string }>;
  ifMatch?: boolean;
  idempotencyKey?: boolean;
  responses: Record<number, { description: string; schema?: string; array?: boolean }>;
}

const ref = (id: string): object => ({ $ref: `#/components/schemas/${id}` });
const error = (description: string): { description: string; schema: string } => ({ description, schema: 'ApiError' });
const idParam = { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } };

export const API_OPERATIONS: Record<string, Partial<Record<Method, Operation>>> = {
  '/api/health': { get: { summary: 'Liveness check', access: 'public', responses: { 200: { description: 'OK' } } } },
  '/api/config': {
    get: { summary: 'Runtime configuration for the browser app', access: 'public', responses: { 200: { description: 'Config', schema: 'ClientConfig' } } },
  },
  '/api/auth/me': {
    get: { summary: 'Current session (user is null when signed out)', access: 'public', responses: { 200: { description: 'Session', schema: 'CurrentSessionResponse' } } },
  },
  '/api/auth/login': {
    post: {
      summary: 'Sign in; sets the httpOnly session cookie',
      access: 'public',
      body: 'LoginRequest',
      responses: { 200: { description: 'Signed in', schema: 'SessionResponse' }, 401: error('Invalid email or password'), 429: error('Too many attempts') },
    },
  },
  '/api/auth/register': {
    post: {
      summary: 'Create a customer account and sign in',
      access: 'public',
      body: 'RegisterRequest',
      responses: { 201: { description: 'Registered', schema: 'SessionResponse' }, 400: error('Invalid input'), 409: error('EMAIL_TAKEN') },
    },
  },
  '/api/auth/logout': { post: { summary: 'Sign out', access: 'public', responses: { 204: { description: 'Signed out' } } } },
  '/api/menu': {
    get: { summary: 'Menu snapshot with its event-log position', access: 'public', responses: { 200: { description: 'Menu', schema: 'MenuSnapshot' } } },
  },
  '/api/categories': {
    post: { summary: 'Create a category', access: 'admin', body: 'CategoryInput', responses: { 201: { description: 'Created', schema: 'Category' } } },
  },
  '/api/categories/{id}': {
    patch: {
      summary: 'Rename / reorder a category',
      access: 'admin',
      body: 'CategoryPatch',
      ifMatch: true,
      responses: { 200: { description: 'Updated', schema: 'Category' }, 404: error('Not found'), 412: error('VERSION_CONFLICT (body.current)'), 428: error('VERSION_REQUIRED') },
    },
    delete: {
      summary: 'Delete an empty category',
      access: 'admin',
      ifMatch: true,
      responses: { 204: { description: 'Deleted' }, 409: error('CATEGORY_NOT_EMPTY'), 412: error('VERSION_CONFLICT'), 428: error('VERSION_REQUIRED') },
    },
  },
  '/api/items': {
    post: { summary: 'Create a menu item', access: 'admin', body: 'MenuItemInput', responses: { 201: { description: 'Created', schema: 'MenuItem' }, 400: error('PRICE_REQUIRED') } },
  },
  '/api/items/{id}': {
    patch: {
      summary: 'Change a menu item (partial)',
      access: 'admin',
      body: 'MenuItemPatch',
      ifMatch: true,
      responses: { 200: { description: 'Updated', schema: 'MenuItem' }, 412: error('VERSION_CONFLICT (body.current)'), 428: error('VERSION_REQUIRED') },
    },
    delete: {
      summary: 'Delete a menu item',
      access: 'admin',
      ifMatch: true,
      responses: { 204: { description: 'Deleted' }, 412: error('VERSION_CONFLICT'), 428: error('VERSION_REQUIRED') },
    },
  },
  '/api/orders': {
    get: {
      summary: "Orders, newest first (customers: their own; admins: all)",
      access: 'user',
      query: {
        limit: { schema: { type: 'integer', minimum: 1, maximum: 100 }, description: 'Page size (default 20)' },
        before: { schema: { type: 'integer', minimum: 1 }, description: 'Cursor: nextCursor of the previous page' },
      },
      responses: { 200: { description: 'Page', schema: 'OrdersPage' } },
    },
    post: {
      summary: 'Place an order (idempotent per Idempotency-Key)',
      access: 'user',
      body: 'CreateOrderRequest',
      idempotencyKey: true,
      responses: {
        201: { description: 'Created', schema: 'Order' },
        200: { description: 'Same key used before: the original order', schema: 'Order' },
        409: error('MENU_CHANGED (body.issues) or ORDER_IN_PROGRESS'),
        422: error('PROMO_* — the promo code cannot be used'),
      },
    },
  },
  '/api/promo-codes': {
    get: { summary: 'All promo codes', access: 'admin', responses: { 200: { description: 'List', schema: 'PromoCode', array: true } } },
    post: { summary: 'Create a promo code', access: 'admin', body: 'PromoCodeInput', responses: { 201: { description: 'Created', schema: 'PromoCode' }, 409: error('PROMO_CODE_TAKEN') } },
  },
  '/api/promo-codes/{id}': {
    patch: {
      summary: 'Replace a promo code',
      access: 'admin',
      body: 'PromoCodeInput',
      ifMatch: true,
      responses: { 200: { description: 'Updated', schema: 'PromoCode' }, 412: error('VERSION_CONFLICT') },
    },
  },
  '/api/promo-codes/validate': {
    post: {
      summary: 'Check a code for the current subtotal',
      access: 'user',
      body: 'ValidatePromoRequest',
      responses: { 200: { description: 'Applicable', schema: 'PromoQuote' }, 422: error('PROMO_* reason') },
    },
  },
  '/api/events': {
    get: {
      summary: 'Replay of the event log after a position (what a client missed)',
      access: 'public',
      query: { after: { schema: { type: 'integer', minimum: 0 }, required: true, description: 'Last seq the client has applied' } },
      responses: { 200: { description: 'Page of events', schema: 'EventsPage' } },
    },
  },
};

export function buildOpenApiDocument(): Record<string, unknown> {
  const { schemas: components } = z.toJSONSchema(z.globalRegistry, {
    uri: (id) => `#/components/schemas/${id}`,
    unrepresentable: 'any',
  }) as { schemas: Record<string, Record<string, unknown>> };
  // Drop per-schema `$id`/`$schema` noise; references use the components path.
  for (const schema of Object.values(components)) {
    delete schema['$id'];
    delete schema['$schema'];
  }

  const paths: Record<string, Record<string, unknown>> = {};
  for (const [path, methods] of Object.entries(API_OPERATIONS)) {
    paths[path] = {};
    for (const [method, op] of Object.entries(methods) as [Method, Operation][]) {
      const parameters: object[] = [];
      if (path.includes('{id}')) parameters.push(idParam);
      for (const [name, q] of Object.entries(op.query ?? {})) {
        parameters.push({ name, in: 'query', required: q.required ?? false, schema: q.schema, description: q.description });
      }
      if (op.ifMatch) {
        parameters.push({ name: 'If-Match', in: 'header', required: true, schema: { type: 'string' }, description: 'Version being edited, e.g. "3"' });
      }
      if (op.idempotencyKey) {
        parameters.push({ name: 'Idempotency-Key', in: 'header', required: true, schema: { type: 'string', pattern: '^[A-Za-z0-9_-]{8,128}$' } });
      }
      const responses: Record<string, object> = {};
      for (const [status, r] of Object.entries(op.responses)) {
        responses[status] = r.schema
          ? { description: r.description, content: { 'application/json': { schema: r.array ? { type: 'array', items: ref(r.schema) } : ref(r.schema) } } }
          : { description: r.description };
      }
      if (op.access !== 'public') {
        responses['401'] = { description: 'Not signed in', content: { 'application/json': { schema: ref('ApiError') } } };
      }
      if (op.access === 'admin') {
        responses['403'] = { description: 'Admins only', content: { 'application/json': { schema: ref('ApiError') } } };
      }
      paths[path][method] = {
        summary: op.summary,
        tags: [path.split('/')[2]],
        security: op.access === 'public' ? [] : [{ session: [] }],
        parameters,
        ...(op.body ? { requestBody: { required: true, content: { 'application/json': { schema: ref(op.body) } } } } : {}),
        responses,
      };
    }
  }

  return {
    openapi: '3.1.0',
    info: {
      title: 'Trattoria API',
      version: '1.0.0',
      description:
        'Money values are integer cents. Real-time updates: Socket.IO at /socket.io emits `menu` and `order` ' +
        'events with EventEnvelope payloads; after a reconnect, replay with GET /api/events?after=<last seq>.',
    },
    components: {
      securitySchemes: { session: { type: 'apiKey', in: 'cookie', name: 'session' } },
      schemas: components,
    },
    paths,
  };
}
