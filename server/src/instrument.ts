/**
 * Preloaded before the app (`node --import ./dist/instrument.js dist/main.js`), because
 * tracing has to patch http, express, pg and ioredis before they are first imported.
 * Everything here is opt-in through environment variables.
 */
import { register } from 'node:module';

const otlpEndpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT;
const sentryDsn = process.env.SENTRY_DSN;

if (otlpEndpoint) {
  // ESM modules can only be instrumented through a loader hook.
  register('@opentelemetry/instrumentation/hook.mjs', import.meta.url);
  const { NodeSDK } = await import('@opentelemetry/sdk-node');
  const { getNodeAutoInstrumentations } = await import('@opentelemetry/auto-instrumentations-node');
  const { OTLPTraceExporter } = await import('@opentelemetry/exporter-trace-otlp-http');
  const sdk = new NodeSDK({
    serviceName: process.env.OTEL_SERVICE_NAME ?? 'trattoria-api',
    traceExporter: new OTLPTraceExporter({ url: `${otlpEndpoint.replace(/\/$/, '')}/v1/traces` }),
    instrumentations: [
      getNodeAutoInstrumentations({
        // Noisy and not useful for request traces.
        '@opentelemetry/instrumentation-fs': { enabled: false },
        '@opentelemetry/instrumentation-dns': { enabled: false },
        '@opentelemetry/instrumentation-net': { enabled: false },
      }),
    ],
  });
  sdk.start();
  process.once('SIGTERM', () => void sdk.shutdown());
}

if (sentryDsn) {
  const Sentry = await import('@sentry/nestjs');
  Sentry.init({
    dsn: sentryDsn,
    environment: process.env.SENTRY_ENVIRONMENT ?? process.env.NODE_ENV ?? 'development',
    release: process.env.APP_VERSION,
    // Tracing is done by OpenTelemetry above; Sentry only reports errors.
    enableOpenTelemetrySetup: false,
    tracesSampleRate: 0,
  });
}
