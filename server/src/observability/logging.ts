import { randomUUID } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { trace } from '@opentelemetry/api';
import type { Params } from 'nestjs-pino';
import type { User } from '../domain/models.js';

export function loggingParams(env: NodeJS.ProcessEnv = process.env): Params {
  const level = env.LOG_LEVEL ?? (env.NODE_ENV === 'test' ? 'silent' : 'info');
  return {
    pinoHttp: {
      level,
      transport: env.LOG_PRETTY === 'true' ? { target: 'pino-pretty', options: { singleLine: true } } : undefined,
      genReqId: (request: IncomingMessage, response: ServerResponse) => {
        const incoming = request.headers['x-request-id'];
        const id = typeof incoming === 'string' && /^[\w-]{1,64}$/.test(incoming) ? incoming : randomUUID();
        response.setHeader('X-Request-Id', id);
        return id;
      },
      customProps: (request: IncomingMessage) => ({
        userId: (request as IncomingMessage & { user?: User }).user?.id,
      }),
      mixin: () => {
        const span = trace.getActiveSpan()?.spanContext();
        return span ? { traceId: span.traceId, spanId: span.spanId } : {};
      },
      redact: {
        paths: ['req.headers.cookie', 'req.headers.authorization', 'res.headers["set-cookie"]'],
        censor: '[redacted]',
      },
      autoLogging: { ignore: (request: IncomingMessage) => request.url === '/api/health' },
      serializers: {
        req: (request: { id: string; method: string; url: string }) => ({
          id: request.id,
          method: request.method,
          url: request.url,
        }),
        res: (response: { statusCode: number }) => ({ statusCode: response.statusCode }),
      },
    },
  };
}
