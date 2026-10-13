import { type INestApplication, ValidationPipe } from '@nestjs/common';

/** Shared between main.ts and e2e tests so both run the same pipeline. */
export function configureApp(app: INestApplication): void {
  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  );
  app.enableShutdownHooks();
}
