import {
  Injectable,
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
} from "@nestjs/common";
import { Request } from "express";
import { logger } from "../logger";

/**
 * Token bucket rate limiter
 */
class TokenBucket {
  private tokens: number;
  private lastUpdate: number;

  constructor(
    private readonly rate: number,
    private readonly capacity: number,
  ) {
    this.tokens = capacity;
    this.lastUpdate = Date.now();
  }

  consume(tokens: number = 1): boolean {
    const now = Date.now();
    const elapsed = (now - this.lastUpdate) / 1000;
    this.lastUpdate = now;

    // Add tokens based on elapsed time
    this.tokens = Math.min(this.capacity, this.tokens + elapsed * this.rate);

    if (this.tokens >= tokens) {
      this.tokens -= tokens;
      return true;
    }
    return false;
  }
}

/**
 * Route-specific rate limit configurations
 */
const ROUTE_LIMITS: Record<string, number> = {
  "/api/v1/addresses": 100, // Address queries - 100/min
  "/api/v1/risk": 50, // Risk scoring - 50/min
  "/api/v1/graph": 30, // Graph queries - 30/min
  "/api/v1/alerts": 60, // Alert operations - 60/min
  "/api/v1/auth": 20, // Auth endpoints - 20/min (prevent brute force)
  "/health": 1000, // Health check - 1000/min
  default: 100, // Default rate limit
};

/**
 * Per-IP rate limit guard using token bucket algorithm
 */
@Injectable()
export class RateLimitGuard implements CanActivate {
  private readonly buckets: Map<string, TokenBucket> = new Map();
  private cleanupCounter = 0;

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const clientIp = this.getClientIp(request);
    const path = request.path;
    const routePattern = this.getRoutePattern(path);
    const limit = ROUTE_LIMITS[routePattern] || ROUTE_LIMITS["default"];

    const key = `${routePattern}:${clientIp}`;

    if (!this.buckets.has(key)) {
      const rate = limit / 60; // Convert to per-second
      const burst = Math.max(Math.floor(limit / 5), 1);
      this.buckets.set(key, new TokenBucket(rate, burst));
    }

    const bucket = this.buckets.get(key)!;
    const allowed = bucket.consume();

    // Periodic cleanup
    this.cleanupCounter++;
    if (this.cleanupCounter >= 1000) {
      this.cleanup();
      this.cleanupCounter = 0;
    }

    if (!allowed) {
      logger.warn("Rate limit exceeded", {
        clientIp,
        path,
        routePattern,
        limit,
      });

      throw new HttpException(
        {
          error: "rate_limit_exceeded",
          message: "Too many requests. Please try again later.",
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    return true;
  }

  private getClientIp(request: Request): string {
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

  private getRoutePattern(path: string): string {
    // Find matching route pattern
    for (const pattern of Object.keys(ROUTE_LIMITS)) {
      if (pattern !== "default" && path.startsWith(pattern)) {
        return pattern;
      }
    }
    return "default";
  }

  private cleanup(): void {
    // Remove entries older than 5 minutes with full capacity
    // This is a simplified cleanup - in production use TTL-based eviction
    if (this.buckets.size > 10000) {
      const toDelete: string[] = [];
      let count = 0;
      for (const key of this.buckets.keys()) {
        if (count++ > 1000) {
          toDelete.push(key);
        }
      }
      toDelete.forEach((key) => this.buckets.delete(key));
      logger.info("Rate limiter cleanup", { removed: toDelete.length });
    }
  }
}

/**
 * Global rate limit guard with configurable limits
 */
@Injectable()
export class GlobalRateLimitGuard implements CanActivate {
  private readonly limiter: Map<string, TokenBucket> = new Map();
  private readonly defaultRate: number;
  private readonly defaultBurst: number;

  constructor(requestsPerMinute: number = 100) {
    this.defaultRate = requestsPerMinute / 60;
    this.defaultBurst = Math.max(Math.floor(requestsPerMinute / 5), 1);
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const clientIp = this.getClientIp(request);

    if (!this.limiter.has(clientIp)) {
      this.limiter.set(
        clientIp,
        new TokenBucket(this.defaultRate, this.defaultBurst),
      );
    }

    const bucket = this.limiter.get(clientIp)!;

    if (!bucket.consume()) {
      throw new HttpException(
        {
          error: "rate_limit_exceeded",
          message: "Too many requests. Please try again later.",
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    return true;
  }

  private getClientIp(request: Request): string {
    const forwarded = request.headers["x-forwarded-for"];
    if (forwarded) {
      const ips = Array.isArray(forwarded) ? forwarded[0] : forwarded;
      return ips.split(",")[0].trim();
    }
    return request.ip || "unknown";
  }
}
