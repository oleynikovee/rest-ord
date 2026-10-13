import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';
import { loadConfig } from '../src/config.js';

export const ADMIN = { email: 'admin@test.local', password: 'admin-password' };
export const CUSTOMER = { email: 'guest@trattoria.local', password: 'guest12345' };

/** Full app on in-memory storage, with the kitchen simulator switched off. */
export async function createTestApp(): Promise<INestApplication<App>> {
  const config = loadConfig({
    ADMIN_EMAIL: ADMIN.email,
    ADMIN_PASSWORD: ADMIN.password,
    JWT_SECRET: 'test-secret',
    STATUS_STEP_SECONDS: '0',
    METRICS_PORT: '0',
  });
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule.forRoot(config)],
  }).compile();
  const app = moduleRef.createNestApplication<INestApplication<App>>();
  configureApp(app);
  await app.init();
  return app;
}

/** A supertest agent keeps the session cookie between requests, like a browser. */
export async function signIn(
  app: INestApplication<App>,
  email: string,
  password: string,
): Promise<ReturnType<typeof request.agent>> {
  const agent = request.agent(app.getHttpServer());
  await agent.post('/api/auth/login').send({ email, password }).expect(200);
  return agent;
}
