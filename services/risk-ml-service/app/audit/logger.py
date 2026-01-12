"""
Audit logging for Risk ML Service
Provides structured audit events for security monitoring
"""
import json
import time
from datetime import datetime, timezone
from enum import Enum
from typing import Any, Optional

import structlog

from app.core.logging import get_logger

# Configure audit logger
audit_logger = structlog.get_logger("audit")
logger = get_logger(__name__)


class EventType(str, Enum):
    """Types of auditable events"""
    RISK_SCORE = "RISK_SCORE"
    BATCH_SCORE = "BATCH_SCORE"
    MODEL_INFERENCE = "MODEL_INFERENCE"
    FEATURE_EXTRACTION = "FEATURE_EXTRACTION"
    CONFIG_CHANGE = "CONFIG_CHANGE"
    API_REQUEST = "API_REQUEST"
    RATE_LIMITED = "RATE_LIMITED"


class Action(str, Enum):
    """Action types"""
    READ = "READ"
    WRITE = "WRITE"
    DELETE = "DELETE"
    CREATE = "CREATE"
    UPDATE = "UPDATE"


class Status(str, Enum):
    """Status types"""
    SUCCESS = "SUCCESS"
    FAILURE = "FAILURE"
    DENIED = "DENIED"


class AuditEvent:
    """Structured audit event"""
    
    def __init__(
        self,
        event_type: EventType,
        user_id: str,
        ip_address: str,
        resource: str,
        action: Action,
        status: Status,
        status_code: Optional[int] = None,
        metadata: Optional[dict[str, Any]] = None,
        trace_id: Optional[str] = None,
    ):
        self.timestamp = datetime.now(timezone.utc).isoformat()
        self.event_type = event_type
        self.user_id = user_id
        self.ip_address = ip_address
        self.resource = resource
        self.action = action
        self.status = status
        self.status_code = status_code
        self.service_name = "risk-ml-service"
        self.metadata = metadata or {}
        self.trace_id = trace_id
    
    def to_dict(self) -> dict[str, Any]:
        return {
            "timestamp": self.timestamp,
            "event_type": self.event_type.value,
            "user_id": self.user_id,
            "ip_address": self.ip_address,
            "resource": self.resource,
            "action": self.action.value,
            "status": self.status.value,
            "status_code": self.status_code,
            "service_name": self.service_name,
            "trace_id": self.trace_id,
            "metadata": self.metadata,
        }


class AuditLogger:
    """Audit logger for risk-ml-service"""
    
    def __init__(self, service_name: str = "risk-ml-service"):
        self.service_name = service_name
    
    def log(self, event: AuditEvent) -> None:
        """Log an audit event"""
        event_dict = event.to_dict()
        
        audit_logger.info(
            "AUDIT",
            **event_dict,
        )
    
    def log_risk_score(
        self,
        user_id: str,
        ip_address: str,
        address: str,
        risk_score: float,
        status: Status,
        response_time_ms: int,
        model_version: Optional[str] = None,
    ) -> None:
        """Log risk score calculation"""
        self.log(AuditEvent(
            event_type=EventType.RISK_SCORE,
            user_id=user_id,
            ip_address=ip_address,
            resource=f"/api/v1/risk/{address}",
            action=Action.READ,
            status=status,
            status_code=200 if status == Status.SUCCESS else 500,
            metadata={
                "address": address,
                "risk_score": risk_score,
                "response_time_ms": response_time_ms,
                "model_version": model_version,
            },
        ))
    
    def log_batch_score(
        self,
        user_id: str,
        ip_address: str,
        address_count: int,
        status: Status,
        response_time_ms: int,
    ) -> None:
        """Log batch risk score calculation"""
        self.log(AuditEvent(
            event_type=EventType.BATCH_SCORE,
            user_id=user_id,
            ip_address=ip_address,
            resource="/api/v1/risk/batch",
            action=Action.READ,
            status=status,
            status_code=200 if status == Status.SUCCESS else 500,
            metadata={
                "address_count": address_count,
                "response_time_ms": response_time_ms,
            },
        ))
    
    def log_model_inference(
        self,
        address: str,
        model_name: str,
        inference_time_ms: int,
        status: Status,
    ) -> None:
        """Log model inference event"""
        self.log(AuditEvent(
            event_type=EventType.MODEL_INFERENCE,
            user_id="system",
            ip_address="internal",
            resource=f"/ml/models/{model_name}",
            action=Action.READ,
            status=status,
            metadata={
                "address": address,
                "model_name": model_name,
                "inference_time_ms": inference_time_ms,
            },
        ))
    
    def log_rate_limited(
        self,
        ip_address: str,
        resource: str,
    ) -> None:
        """Log rate limit event"""
        self.log(AuditEvent(
            event_type=EventType.RATE_LIMITED,
            user_id="anonymous",
            ip_address=ip_address,
            resource=resource,
            action=Action.READ,
            status=Status.DENIED,
            status_code=429,
            metadata={
                "reason": "rate_limit_exceeded",
            },
        ))
    
    def log_api_request(
        self,
        user_id: str,
        ip_address: str,
        method: str,
        path: str,
        status_code: int,
        response_time_ms: int,
    ) -> None:
        """Log generic API request"""
        action_map = {
            "GET": Action.READ,
            "POST": Action.CREATE,
            "PUT": Action.UPDATE,
            "PATCH": Action.UPDATE,
            "DELETE": Action.DELETE,
        }
        
        status = Status.SUCCESS if status_code < 400 else Status.FAILURE
        
        self.log(AuditEvent(
            event_type=EventType.API_REQUEST,
            user_id=user_id or "anonymous",
            ip_address=ip_address,
            resource=path,
            action=action_map.get(method, Action.READ),
            status=status,
            status_code=status_code,
            metadata={
                "method": method,
                "response_time_ms": response_time_ms,
            },
        ))


# Global audit logger instance
audit = AuditLogger()
