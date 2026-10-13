import { type INestApplication, ValidationPipe } from '@nestjs/common';
import { SwaggerModule, type OpenAPIObject } from '@nestjs/swagger';
import { buildOpenApiDocument } from '@trattoria/contracts/openapi';
import cookieParser from 'cookie-parser';

/** Shared between main.ts and e2e tests so both run the same pipeline. */
export function configureApp(app: INestApplication): void {
  app.use(cookieParser());
  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  );
  app.enableShutdownHooks();
  // The contract is generated from the shared zod schemas (single source of truth).
  SwaggerModule.setup('api/docs', app, buildOpenApiDocument() as unknown as OpenAPIObject, {
    jsonDocumentUrl: 'api/openapi.json',
  });
}
