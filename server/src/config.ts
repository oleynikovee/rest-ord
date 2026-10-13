export interface AppConfig {
  port: number;
  /** Postgres is used when set, otherwise the in-memory store. */
  databaseUrl?: string;
  /** Redis is used when set, otherwise in-process idempotency and event bus. */
  redisUrl?: string;
  /** How long an order stays in one status before the kitchen simulator advances it. */
  statusStepMs: number;
  /** Built Angular app to serve as static files (production / Docker). */
  clientDist?: string;
  auth: AuthConfig;
  /** Express `trust proxy`: number of proxies in front of the app (0 when exposed directly). */
  trustProxy: number;
  /** Internal port for Prometheus `/metrics`; 0 disables it. */
  metricsPort: number;
  /** Values the browser app needs at runtime (served by GET /api/config). */
  client: ClientConfig;
}

export interface ClientConfig {
  /** Sentry DSN for the browser (public by design); `null` disables error reporting. */
  sentryDsn: string | null;
  environment: string;
  release: string | null;
}

export interface AuthConfig {
  /** Signs session tokens. Generated per process when not set (development only). */
  jwtSecret?: string;
  sessionTtlSeconds: number;
  /** Force the `Secure` cookie flag; otherwise it follows the request protocol (HTTPS => Secure). */
  cookieSecure: boolean;
  adminEmail: string;
  adminPassword: string;
  /** Creates a demo customer account so the app can be tried right away. */
  seedDemoCustomer: boolean;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  return {
    port: Number(env.PORT ?? 3000),
    databaseUrl: env.DATABASE_URL || undefined,
    redisUrl: env.REDIS_URL || undefined,
    statusStepMs: Number(env.STATUS_STEP_SECONDS ?? 8) * 1000,
    clientDist: env.CLIENT_DIST || undefined,
    trustProxy: Number(env.TRUST_PROXY ?? 0),
    metricsPort: Number(env.METRICS_PORT ?? 9464),
    client: {
      sentryDsn: env.SENTRY_DSN_CLIENT || null,
      environment: env.SENTRY_ENVIRONMENT ?? env.NODE_ENV ?? 'development',
      release: env.APP_VERSION || null,
    },
    auth: {
      jwtSecret: env.JWT_SECRET || undefined,
      sessionTtlSeconds: Number(env.SESSION_TTL_HOURS ?? 12) * 3600,
      cookieSecure: env.COOKIE_SECURE === 'true',
      adminEmail: env.ADMIN_EMAIL ?? 'admin@trattoria.local',
      adminPassword: env.ADMIN_PASSWORD ?? 'admin12345',
      seedDemoCustomer: env.SEED_DEMO_CUSTOMER !== 'false',
    },
  };
}

export const APP_CONFIG = Symbol('APP_CONFIG');
