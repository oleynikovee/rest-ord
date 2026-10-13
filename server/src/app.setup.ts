import { type INestApplication, ValidationPipe } from '@nestjs/common';
import { SwaggerModule, type OpenAPIObject } from '@nestjs/swagger';
import { buildOpenApiDocument } from '@trattoria/contracts/openapi';
import cookieParser from 'cookie-parser';

export function configureApp(app: INestApplication): void {
  app.use(cookieParser());
  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  );
  app.enableShutdownHooks();
  SwaggerModule.setup('api/docs', app, buildOpenApiDocument() as unknown as OpenAPIObject, {
    jsonDocumentUrl: 'api/openapi.json',
  });
}
