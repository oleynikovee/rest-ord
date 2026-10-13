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
}

export interface AuthConfig {
  /** Signs session tokens. Generated per process when not set (development only). */
  jwtSecret?: string;
  sessionTtlSeconds: number;
  /** `Secure` cookie flag: enable whenever the app is served over HTTPS. */
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
