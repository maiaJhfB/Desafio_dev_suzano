import { INestApplication, Logger, ValidationPipe } from '@nestjs/common';
import { ValidationError } from 'class-validator';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { NextFunction, Request, Response, json } from 'express';
import { randomUUID } from 'node:crypto';
import { ApiError, ApiExceptionFilter } from './common/errors';
function validationDetails(
  errors: ValidationError[],
  parent = '',
): { field: string; reason: string }[] {
  return errors.flatMap((error) => {
    const field = parent ? `${parent}.${error.property}` : error.property;
    return [
      ...Object.values(error.constraints ?? {}).map((reason) => ({ field, reason })),
      ...validationDetails(error.children ?? [], field),
    ];
  });
}
export function setupApp(app: INestApplication) {
  const logger = new Logger('HTTP');
  app.use((request: Request, response: Response, next: NextFunction) => {
    const candidate = request.headers['x-request-id'];
    const requestId =
      typeof candidate === 'string' &&
      /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(candidate)
        ? candidate
        : randomUUID();
    response.setHeader('x-request-id', requestId);
    const start = process.hrtime.bigint();
    response.on('finish', () =>
      logger.log(
        JSON.stringify({
          request_id: requestId,
          method: request.method,
          path: request.path,
          status: response.statusCode,
          duration_ms: Math.round(Number(process.hrtime.bigint() - start) / 1e6),
        }),
      ),
    );
    next();
  });
  app.use(json({ limit: '100kb' }));
  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
      forbidUnknownValues: true,
      exceptionFactory: (errors) =>
        new ApiError(
          400,
          'VALIDATION_ERROR',
          'Os dados enviados são inválidos.',
          validationDetails(errors),
        ),
    }),
  );
  app.useGlobalFilters(new ApiExceptionFilter());
  const corsOrigins = (process.env.CORS_ORIGIN ?? 'http://localhost:3000')
    .split(',')
    .map((value) => value.trim());
  app.enableCors({
    origin: corsOrigins,
    allowedHeaders: ['Content-Type', 'X-Request-Id', 'Idempotency-Key'],
    exposedHeaders: ['x-request-id', 'Location', 'Idempotency-Replayed'],
  });
  const document = SwaggerModule.createDocument(
    app,
    new DocumentBuilder()
      .setTitle('Estoque — API')
      .setDescription(
        'Produtos e pedidos. Todos os valores monetários são inteiros em centavos. Pedidos pendentes validam estoque sem reserva; a conclusão baixa o estoque em uma transação.',
      )
      .setVersion('1.0.0')
      .build(),
  );
  SwaggerModule.setup('docs', app, document, { jsonDocumentUrl: '/docs-json' });
  return document;
}
