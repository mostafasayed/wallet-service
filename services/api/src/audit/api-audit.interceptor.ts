import {
    Injectable,
    NestInterceptor,
    ExecutionContext,
    CallHandler,
  } from '@nestjs/common';
  import { Observable } from 'rxjs';
  import { tap, catchError } from 'rxjs/operators';
  import { ApiAuditService } from './api-audit.service';
  
  @Injectable()
  export class ApiAuditInterceptor implements NestInterceptor {
    constructor(private readonly auditService: ApiAuditService) {}
  
    intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
      const httpCtx = context.switchToHttp();
      const req = httpCtx.getRequest<Request & any>();
      const res = httpCtx.getResponse<Response & any>();
  
      const method = req.method;
      const path = req.url;
  
      const shouldAudit = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method);

      const forwarded = req.headers['x-forwarded-for'];
      const clientIp =
        (Array.isArray(forwarded) ? forwarded[0] : forwarded) ||
        req.ip ||
        req.socket?.remoteAddress ||
        null;
  
      if (!shouldAudit) {
        return next.handle();
      }
  
      const walletId =
        (req.params && req.params.id) ||
        (req.params && req.params.walletId) ||
        null;
  
      const requestId =
        (req.body && req.body.requestId) ||
        (req.headers && (req.headers['x-request-id'] as string)) ||
        null;
  
      const baseData = {
        method,
        path,
        walletId,
        requestId,
        clientIp,
        body: req.body,
        headers: req.headers,
      };
  
      return next.handle().pipe(
        tap(() => {
          this.auditService.record({
            ...baseData,
            statusCode: res.statusCode ?? null,
          });
        }),
        catchError((err) => {
          this.auditService.record({
            ...baseData,
            statusCode: res.statusCode ?? 500,
          });
          throw err;
        }),
      );
    }
  }
  