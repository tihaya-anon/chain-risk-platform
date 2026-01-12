"""
Audit logging middleware for FastAPI
"""
import time
from typing import Callable

from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware

from app.audit.logger import audit, Status


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


def get_user_id(request: Request) -> str:
    """Extract user ID from request"""
    # Try X-User-Id header
    user_id = request.headers.get("x-user-id")
    if user_id:
        return user_id
    
    # Try to get from state (set by auth middleware)
    if hasattr(request.state, "user_id"):
        return request.state.user_id
    
    return "anonymous"


class AuditMiddleware(BaseHTTPMiddleware):
    """Middleware for audit logging all API requests"""
    
    # Paths to skip audit logging
    SKIP_PATHS = {"/health", "/metrics", "/", "/docs", "/openapi.json", "/redoc"}
    
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        # Skip certain paths
        if request.url.path in self.SKIP_PATHS:
            return await call_next(request)
        
        start_time = time.time()
        
        response = await call_next(request)
        
        # Calculate response time
        response_time_ms = int((time.time() - start_time) * 1000)
        
        # Extract request info
        user_id = get_user_id(request)
        ip_address = get_client_ip(request)
        method = request.method
        path = request.url.path
        status_code = response.status_code
        
        # Log audit event
        audit.log_api_request(
            user_id=user_id,
            ip_address=ip_address,
            method=method,
            path=path,
            status_code=status_code,
            response_time_ms=response_time_ms,
        )
        
        return response


class SensitiveOperationAuditMiddleware(BaseHTTPMiddleware):
    """Middleware for audit logging only sensitive operations"""
    
    # Sensitive path patterns
    SENSITIVE_PATTERNS = [
        "/api/v1/risk",
        "/api/v1/score",
        "/api/v1/batch",
    ]
    
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        # Check if this is a sensitive path
        path = request.url.path
        is_sensitive = any(path.startswith(pattern) for pattern in self.SENSITIVE_PATTERNS)
        
        if not is_sensitive:
            return await call_next(request)
        
        start_time = time.time()
        
        response = await call_next(request)
        
        response_time_ms = int((time.time() - start_time) * 1000)
        
        user_id = get_user_id(request)
        ip_address = get_client_ip(request)
        method = request.method
        status_code = response.status_code
        
        audit.log_api_request(
            user_id=user_id,
            ip_address=ip_address,
            method=method,
            path=path,
            status_code=status_code,
            response_time_ms=response_time_ms,
        )
        
        return response
