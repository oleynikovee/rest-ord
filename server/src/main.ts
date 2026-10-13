import { NestFactory } from '@nestjs/core';
import compression from 'compression';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module.js';
import { configureApp } from './app.setup.js';
import { loadConfig } from './config.js';

async function bootstrap(): Promise<void> {
  const config = loadConfig();
  // Logs written during start-up are buffered until the pino logger takes over.
  const app = await NestFactory.create(AppModule.forRoot(config), { bufferLogs: true });
  app.useLogger(app.get(Logger));
  app.use(compression());
  configureApp(app);
  await app.listen(config.port);
}

await bootstrap();
