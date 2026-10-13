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
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  return {
    port: Number(env.PORT ?? 3000),
    databaseUrl: env.DATABASE_URL || undefined,
    redisUrl: env.REDIS_URL || undefined,
    statusStepMs: Number(env.STATUS_STEP_SECONDS ?? 8) * 1000,
    clientDist: env.CLIENT_DIST || undefined,
  };
}

export const APP_CONFIG = Symbol('APP_CONFIG');
