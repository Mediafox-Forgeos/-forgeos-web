import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { Response } from 'express';
import type { Observable } from 'rxjs';

import type { RequestWithContext } from '../request-context';

/**
 * Assigns a correlation id to each request (respecting an inbound
 * X-Correlation-Id header) and echoes it back on the response.
 */
@Injectable()
export class CorrelationIdInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const request = http.getRequest<RequestWithContext>();
    const response = http.getResponse<Response>();

    const header = request.headers['x-correlation-id'];
    const correlationId =
      typeof header === 'string' && header.length > 0 ? header : randomUUID();

    request.correlationId = correlationId;
    response.setHeader('X-Correlation-Id', correlationId);

    return next.handle();
  }
}
