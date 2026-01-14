"""
Structured Logger with Trace Correlation for Python Services.

Usage:
    from core.structured_logger import get_logger
    
    logger = get_logger("risk-ml-service")
    logger.info("Risk score calculated", address="0x...", score=0.85)
"""
import json
import logging
import sys
import time
from datetime import datetime, timezone
from typing import Any, Optional
from contextvars import ContextVar

from opentelemetry import trace

# Context variable for request-scoped data
request_context: ContextVar[dict] = ContextVar("request_context", default={})


class StructuredFormatter(logging.Formatter):
    """JSON formatter with trace correlation."""
    
    def __init__(self, service: str):
        super().__init__()
        self.service = service
    
    def format(self, record: logging.LogRecord) -> str:
        entry = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "level": record.levelname,
            "service": self.service,
            "message": record.getMessage(),
        }
        
        # Add trace context
        span = trace.get_current_span()
        if span.is_recording():
            ctx = span.get_span_context()
            entry["trace_id"] = format(ctx.trace_id, "032x")
            entry["span_id"] = format(ctx.span_id, "016x")
        
        # Add extra fields
        if hasattr(record, "extra_fields"):
            entry["fields"] = record.extra_fields
        
        # Add duration if present
        if hasattr(record, "duration_ms"):
            entry["duration_ms"] = record.duration_ms
        
        # Add error details
        if record.exc_info:
            entry["error"] = self.formatException(record.exc_info)
        
        # Add request context
        ctx_data = request_context.get()
        if ctx_data:
            entry["request"] = ctx_data
        
        return json.dumps(entry, default=str)


class StructuredLogger:
    """Logger with structured JSON output and trace correlation."""
    
    def __init__(self, name: str, service: str):
        self.logger = logging.getLogger(name)
        self.logger.setLevel(logging.DEBUG)
        self.service = service
        
        # Remove existing handlers
        self.logger.handlers.clear()
        
        # Add structured handler
        handler = logging.StreamHandler(sys.stdout)
        handler.setFormatter(StructuredFormatter(service))
        self.logger.addHandler(handler)
    
    def _log(self, level: int, msg: str, **kwargs):
        extra_fields = kwargs.copy()
        duration_ms = extra_fields.pop("duration_ms", None)
        
        record = self.logger.makeRecord(
            self.logger.name,
            level,
            "",
            0,
            msg,
            (),
            None,
        )
        record.extra_fields = extra_fields if extra_fields else None
        if duration_ms is not None:
            record.duration_ms = duration_ms
        
        self.logger.handle(record)
    
    def debug(self, msg: str, **kwargs):
        """Log debug message."""
        self._log(logging.DEBUG, msg, **kwargs)
    
    def info(self, msg: str, **kwargs):
        """Log info message."""
        self._log(logging.INFO, msg, **kwargs)
    
    def warning(self, msg: str, **kwargs):
        """Log warning message."""
        self._log(logging.WARNING, msg, **kwargs)
    
    def error(self, msg: str, exc_info: bool = False, **kwargs):
        """Log error message."""
        self.logger.error(msg, exc_info=exc_info, extra={"extra_fields": kwargs})
    
    def with_duration(self, msg: str, duration_ms: float, **kwargs):
        """Log message with duration measurement."""
        self._log(logging.INFO, msg, duration_ms=duration_ms, **kwargs)


def get_logger(service: str) -> StructuredLogger:
    """Get a structured logger for the service."""
    return StructuredLogger(service, service)


def set_request_context(**kwargs):
    """Set request-scoped context data."""
    request_context.set(kwargs)


def clear_request_context():
    """Clear request-scoped context data."""
    request_context.set({})


class TimedOperation:
    """Context manager for timing operations."""
    
    def __init__(self, logger: StructuredLogger, operation: str, **kwargs):
        self.logger = logger
        self.operation = operation
        self.kwargs = kwargs
        self.start_time: float = 0
    
    def __enter__(self):
        self.start_time = time.time()
        return self
    
    def __exit__(self, exc_type, exc_val, exc_tb):
        duration_ms = (time.time() - self.start_time) * 1000
        if exc_type is not None:
            self.logger.error(
                f"{self.operation} failed",
                duration_ms=duration_ms,
                error=str(exc_val),
                **self.kwargs
            )
        else:
            self.logger.with_duration(
                f"{self.operation} completed",
                duration_ms=duration_ms,
                **self.kwargs
            )
        return False
