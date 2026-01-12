"""
Rate limiting middleware for Risk ML Service
Uses slowapi for FastAPI-compatible rate limiting
"""
import time
from collections import defaultdict
from functools import wraps
from typing import Callable, Optional

from fastapi import HTTPException, Request, Response
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

from app.core.logging import get_logger

logger = get_logger(__name__)


class RateLimitExceeded(HTTPException):
    """Exception raised when rate limit is exceeded"""
    def __init__(self, detail: str = "Rate limit exceeded"):
        super().__init__(status_code=429, detail=detail)


class TokenBucket:
    """Token bucket rate limiter"""
    
    def __init__(self, rate: float, capacity: int):
        """
        Initialize token bucket.
        
        Args:
            rate: Tokens per second
            capacity: Maximum tokens (burst size)
        """
        self.rate = rate
        self.capacity = capacity
        self.tokens = capacity
        self.last_update = time.monotonic()
    
    def consume(self, tokens: int = 1) -> bool:
        """
        Try to consume tokens.
        
        Returns:
            True if tokens were consumed, False if rate limit exceeded
        """
        now = time.monotonic()
        elapsed = now - self.last_update
        self.last_update = now
        
        # Add tokens based on elapsed time
        self.tokens = min(self.capacity, self.tokens + elapsed * self.rate)
        
        if self.tokens >= tokens:
            self.tokens -= tokens
            return True
        return False


class InMemoryRateLimiter:
    """In-memory per-IP rate limiter"""
    
    def __init__(
        self,
        requests_per_minute: int = 50,
        burst_size: Optional[int] = None,
    ):
        """
        Initialize rate limiter.
        
        Args:
            requests_per_minute: Max requests per minute per IP
            burst_size: Max burst size (defaults to requests_per_minute / 5)
        """
        self.requests_per_minute = requests_per_minute
        self.burst_size = burst_size or max(requests_per_minute // 5, 1)
        self.rate = requests_per_minute / 60.0
        self.buckets: dict[str, TokenBucket] = {}
        self._cleanup_counter = 0
    
    def is_allowed(self, key: str) -> bool:
        """Check if request is allowed for the given key (usually IP)"""
        if key not in self.buckets:
            self.buckets[key] = TokenBucket(self.rate, self.burst_size)
        
        # Periodic cleanup
        self._cleanup_counter += 1
        if self._cleanup_counter >= 1000:
            self._cleanup()
            self._cleanup_counter = 0
        
        return self.buckets[key].consume()
    
    def _cleanup(self):
        """Remove stale entries (buckets at full capacity)"""
        stale_keys = [
            key for key, bucket in self.buckets.items()
            if bucket.tokens >= bucket.capacity - 1
        ]
        for key in stale_keys[:len(stale_keys) // 2]:  # Remove half of stale entries
            del self.buckets[key]


# Route-specific rate limits
ROUTE_LIMITS = {
    "/api/v1/risk": 50,      # Risk scoring - 50/min
    "/api/v1/score": 50,     # Score endpoint - 50/min
    "/api/v1/batch": 20,     # Batch scoring - 20/min (expensive)
    "/health": 1000,         # Health check - 1000/min
    "/metrics": 1000,        # Metrics - 1000/min
}

# Default rate limiter
default_limiter = InMemoryRateLimiter(requests_per_minute=50)

# Route-specific limiters
route_limiters: dict[str, InMemoryRateLimiter] = {}


def get_route_limiter(path: str) -> InMemoryRateLimiter:
    """Get rate limiter for a specific route"""
    # Find matching route pattern
    for pattern, limit in ROUTE_LIMITS.items():
        if path.startswith(pattern):
            if pattern not in route_limiters:
                route_limiters[pattern] = InMemoryRateLimiter(requests_per_minute=limit)
            return route_limiters[pattern]
    return default_limiter


def get_client_ip(request: Request) -> str:
    """Extract client IP from request"""
    # Check X-Forwarded-For header
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    
    # Check X-Real-IP header
    real_ip = request.headers.get("x-real-ip")
    if real_ip:
        return real_ip
    
    # Fall back to client host
    if request.client:
        return request.client.host
    return "unknown"


class RateLimitMiddleware(BaseHTTPMiddleware):
    """Rate limiting middleware for FastAPI"""
    
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        path = request.url.path
        client_ip = get_client_ip(request)
        
        limiter = get_route_limiter(path)
        key = f"{path}:{client_ip}"
        
        if not limiter.is_allowed(key):
            logger.warning(
                "Rate limit exceeded",
                client_ip=client_ip,
                path=path,
            )
            return JSONResponse(
                status_code=429,
                content={
                    "error": "rate_limit_exceeded",
                    "message": "Too many requests. Please try again later.",
                },
            )
        
        return await call_next(request)


def rate_limit(requests_per_minute: int = 50):
    """
    Decorator for rate limiting specific endpoints.
    
    Usage:
        @app.get("/api/v1/score")
        @rate_limit(50)
        async def score_address(request: Request): ...
    """
    limiter = InMemoryRateLimiter(requests_per_minute=requests_per_minute)
    
    def decorator(func: Callable):
        @wraps(func)
        async def wrapper(request: Request, *args, **kwargs):
            client_ip = get_client_ip(request)
            
            if not limiter.is_allowed(client_ip):
                raise RateLimitExceeded()
            
            return await func(request, *args, **kwargs)
        return wrapper
    return decorator
