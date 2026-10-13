import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import compression from 'compression';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module.js';
import { configureApp } from './app.setup.js';
import { loadConfig } from './config.js';

async function bootstrap(): Promise<void> {
  const config = loadConfig();
  // Logs written during start-up are buffered until the pino logger takes over.
  const app = await NestFactory.create<NestExpressApplication>(AppModule.forRoot(config), {
    bufferLogs: true,
  });
  // Behind the edge proxy: trust one hop for the client IP (rate limits) and the protocol (Secure cookies).
  app.set('trust proxy', config.trustProxy);
  app.useLogger(app.get(Logger));
  app.use(compression());
  configureApp(app);
  await app.listen(config.port);
}

await bootstrap();
