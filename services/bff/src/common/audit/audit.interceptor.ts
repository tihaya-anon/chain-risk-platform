import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from "@nestjs/common";
import { Observable } from "rxjs";
import { tap } from "rxjs/operators";
import { Request, Response } from "express";
import { AuditService, Status } from "./audit.service";

/**
 * Interceptor for automatic audit logging of API requests
 */
@Injectable()
export class AuditInterceptor implements NestInterceptor {
  // Paths to skip audit logging
  private readonly skipPaths = new Set([
    "/health",
    "/metrics",
    "/admin/status",
    "/admin/ws/stats",
  ]);

  constructor(private readonly auditService: AuditService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();

    // Skip certain paths
    if (this.skipPaths.has(request.path)) {
      return next.handle();
    }

    const startTime = Date.now();

    return next.handle().pipe(
      tap({
        next: () => {
          this.logRequest(request, response, startTime);
        },
        error: (error) => {
          // Log even on error
          this.logRequest(request, response, startTime, error);
        },
      }),
    );
  }

  private logRequest(
    request: Request,
    response: Response,
    startTime: number,
    error?: Error,
  ): void {
    const responseTime = Date.now() - startTime;
    const userId = this.extractUserId(request);
    const ipAddress = this.extractIpAddress(request);
    const method = request.method;
    const path = request.path;
    const statusCode = error ? 500 : response.statusCode;

    this.auditService.logApiRequest(
      userId,
      ipAddress,
      method,
      path,
      statusCode,
      responseTime,
    );
  }

  private extractUserId(request: Request): string {
    // Try to get from header
    const userId = request.headers["x-user-id"];
    if (userId) {
      return Array.isArray(userId) ? userId[0] : userId;
    }

    // Try to get from user object (set by auth guard)
    if ((request as any).user?.id) {
      return (request as any).user.id;
    }

    return "anonymous";
  }

  private extractIpAddress(request: Request): string {
    // Check X-Forwarded-For header
    const forwarded = request.headers["x-forwarded-for"];
    if (forwarded) {
      const ips = Array.isArray(forwarded) ? forwarded[0] : forwarded;
      return ips.split(",")[0].trim();
    }

    // Check X-Real-IP header
    const realIp = request.headers["x-real-ip"];
    if (realIp) {
      return Array.isArray(realIp) ? realIp[0] : realIp;
    }

    // Fall back to request IP
    return request.ip || "unknown";
  }
}

/**
 * Interceptor for audit logging only sensitive operations
 */
@Injectable()
export class SensitiveOperationAuditInterceptor implements NestInterceptor {
  // Sensitive path patterns
  private readonly sensitivePatterns = [
    "/api/v1/auth",
    "/api/v1/risk",
    "/api/v1/alerts",
  ];

  constructor(private readonly auditService: AuditService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();

    // Check if this is a sensitive path
    const isSensitive = this.sensitivePatterns.some((pattern) =>
      request.path.startsWith(pattern),
    );

    if (!isSensitive) {
      return next.handle();
    }

    const startTime = Date.now();

    return next.handle().pipe(
      tap({
        next: () => {
          this.logSensitiveOperation(request, response, startTime);
        },
        error: (error) => {
          this.logSensitiveOperation(request, response, startTime, error);
        },
      }),
    );
  }

  private logSensitiveOperation(
    request: Request,
    response: Response,
    startTime: number,
    error?: Error,
  ): void {
    const responseTime = Date.now() - startTime;
    const userId = this.extractUserId(request);
    const ipAddress = this.extractIpAddress(request);
    const method = request.method;
    const path = request.path;
    const statusCode = error ? 500 : response.statusCode;

    this.auditService.logApiRequest(
      userId,
      ipAddress,
      method,
      path,
      statusCode,
      responseTime,
    );
  }

  private extractUserId(request: Request): string {
    const userId = request.headers["x-user-id"];
    if (userId) {
      return Array.isArray(userId) ? userId[0] : userId;
    }
    if ((request as any).user?.id) {
      return (request as any).user.id;
    }
    return "anonymous";
  }

  private extractIpAddress(request: Request): string {
    const forwarded = request.headers["x-forwarded-for"];
    if (forwarded) {
      const ips = Array.isArray(forwarded) ? forwarded[0] : forwarded;
      return ips.split(",")[0].trim();
    }
    return request.ip || "unknown";
  }
}
