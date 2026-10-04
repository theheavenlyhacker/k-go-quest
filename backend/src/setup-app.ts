import { type INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { json, urlencoded } from 'express';
import helmet from 'helmet';
import { RequestLoggingMiddleware, SafeExceptionFilter } from './common/http';

export function setupApp(app: INestApplication) {
  const config = app.get(ConfigService);
  app.setGlobalPrefix('api/v1');
  const logging = app.get(RequestLoggingMiddleware);
  app.use(logging.use.bind(logging));
  app.use(helmet());
  app.use(json({ limit: '256kb' }));
  app.use(urlencoded({ extended: false, limit: '256kb' }));
  const express = app.getHttpAdapter().getInstance() as {
    disable(name: string): void;
    set(name: string, value: unknown): void;
  };
  express.disable('x-powered-by');
  const proxyHops = config.getOrThrow<number>('TRUST_PROXY_HOPS');
  express.set('trust proxy', proxyHops === 0 ? false : proxyHops);
  app.enableCors({
    origin: String(config.getOrThrow<string>('CORS_ORIGINS'))
      .split(',')
      .map((s) => s.trim()),
    methods: ['GET', 'HEAD', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    exposedHeaders: ['X-Request-ID'],
    credentials: false,
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      forbidUnknownValues: true,
      transform: true,
      transformOptions: { enableImplicitConversion: false },
    }),
  );
  app.useGlobalFilters(new SafeExceptionFilter());
  app.enableShutdownHooks();
  if (config.get<boolean>('SWAGGER_ENABLED')) {
    const builder = new DocumentBuilder()
      .setTitle('K-Go Quests API')
      .setDescription(
        'Students, Teachers, and LGU Admins. Offline sync and prototype learning estimates.',
      )
      .setVersion('1.0')
      .addBearerAuth()
      .build();
    SwaggerModule.setup(
      'api/docs',
      app,
      SwaggerModule.createDocument(app, builder),
      { swaggerOptions: { persistAuthorization: false } },
    );
  }
}
