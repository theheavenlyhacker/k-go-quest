import {
  ArgumentsHost,
  Catch,
  HttpException,
  Injectable,
  Logger,
  type ExceptionFilter,
  type NestMiddleware,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { QueryFailedError } from 'typeorm';

@Injectable()
export class RequestLoggingMiddleware implements NestMiddleware {
  private readonly logger = new Logger('HTTP');
  use(
    req: Request & { requestId?: string },
    res: Response,
    next: NextFunction,
  ) {
    req.requestId = randomUUID();
    res.setHeader('X-Request-ID', req.requestId);
    res.setHeader('Cache-Control', 'no-store');
    const start = Date.now();
    res.on('finish', () =>
      this.logger.log(
        JSON.stringify({
          requestId: req.requestId,
          method: req.method,
          route: req.route?.path ?? 'unmatched',
          status: res.statusCode,
          durationMs: Date.now() - start,
        }),
      ),
    );
    next();
  }
}

@Catch()
export class SafeExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('Errors');
  catch(error: unknown, host: ArgumentsHost) {
    const req = host
      .switchToHttp()
      .getRequest<Request & { requestId?: string }>();
    const res = host.switchToHttp().getResponse<Response>();
    let status = 500;
    let message: string | string[] = 'Internal server error';
    if (error instanceof HttpException) {
      status = error.getStatus();
      const response = error.getResponse();
      message =
        typeof response === 'string'
          ? response
          : ((response as { message?: string | string[] }).message ??
            error.message);
    } else if (error instanceof QueryFailedError) {
      const code = (error.driverError as { code?: string }).code;
      if (code === '23505') {
        status = 409;
        message = 'Record already exists';
      }
      if (code === '23503' || code === '23514') {
        status = 400;
        message = 'Invalid related record or value';
      }
    } else if (error && typeof error === 'object' && 'type' in error) {
      if (error.type === 'entity.too.large') {
        status = 413;
        message = 'Request body too large';
      }
      if (error.type === 'entity.parse.failed') {
        status = 400;
        message = 'Invalid JSON';
      }
    }
    if (status >= 500)
      this.logger.error(
        JSON.stringify({
          requestId: req.requestId,
          errorType: error instanceof Error ? error.name : 'Unknown',
        }),
      );
    res
      .status(status)
      .json({
        statusCode: status,
        message,
        requestId: req.requestId,
        timestamp: new Date().toISOString(),
      });
  }
}
