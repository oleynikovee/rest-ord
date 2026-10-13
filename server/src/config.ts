export interface AppConfig {
  port: number;
  databaseUrl?: string;
  redisUrl?: string;
  statusStepMs: number;
  clientDist?: string;
  auth: AuthConfig;
  trustProxy: number;
  metricsPort: number;
  client: ClientConfig;
}

export interface ClientConfig {
  sentryDsn: string | null;
  environment: string;
  release: string | null;
}

export interface AuthConfig {
  jwtSecret?: string;
  sessionTtlSeconds: number;
  cookieSecure: boolean;
  adminEmail: string;
  adminPassword: string;
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
