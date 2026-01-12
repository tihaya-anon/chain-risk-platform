# CP4: Audit Logging

> **Worker**: W2  
> **Estimate**: 1 day  
> **Dependencies**: None  
> **Parallel Group**: A

---

## Objective

Implement structured audit logging for sensitive operations with Loki integration.

---

## Tasks

### 4.1 Audit Event Schema

```json
{
  "timestamp": "2026-01-12T10:30:00Z",
  "event_type": "ADDRESS_QUERY",
  "user_id": "user-123",
  "ip_address": "192.168.1.1",
  "resource": "/api/v1/address/0x...",
  "action": "READ",
  "status": "SUCCESS",
  "metadata": {
    "address": "0x...",
    "response_time_ms": 45
  }
}
```

---

### 4.2 Auditable Events

| Event Type | Service | Description |
|------------|---------|-------------|
| AUTH_LOGIN | orchestrator | User login |
| AUTH_LOGOUT | orchestrator | User logout |
| AUTH_FAILED | orchestrator | Failed login attempt |
| ADDRESS_QUERY | query-service | Address lookup |
| RISK_SCORE | risk-ml-service | Risk scoring request |
| ALERT_CREATE | alert-service | New alert rule created |
| ALERT_DELETE | alert-service | Alert rule deleted |
| GRAPH_QUERY | graph-service | Graph traversal |
| CONFIG_CHANGE | all | Config modification |

---

### 4.3 Implementation

#### Go Services

```go
// pkg/audit/logger.go
type AuditLogger struct {
    logger *slog.Logger
}

type AuditEvent struct {
    Timestamp  time.Time      `json:"timestamp"`
    EventType  string         `json:"event_type"`
    UserID     string         `json:"user_id"`
    IPAddress  string         `json:"ip_address"`
    Resource   string         `json:"resource"`
    Action     string         `json:"action"`
    Status     string         `json:"status"`
    Metadata   map[string]any `json:"metadata"`
}

func (a *AuditLogger) Log(event AuditEvent) {
    event.Timestamp = time.Now().UTC()
    a.logger.Info("AUDIT",
        slog.String("event_type", event.EventType),
        slog.String("user_id", event.UserID),
        slog.String("ip_address", event.IPAddress),
        slog.String("resource", event.Resource),
        slog.String("action", event.Action),
        slog.String("status", event.Status),
        slog.Any("metadata", event.Metadata),
    )
}

// Middleware
func AuditMiddleware(auditLog *AuditLogger) gin.HandlerFunc {
    return func(c *gin.Context) {
        start := time.Now()
        c.Next()
        auditLog.Log(AuditEvent{
            EventType: "API_REQUEST",
            UserID:    c.GetString("user_id"),
            IPAddress: c.ClientIP(),
            Resource:  c.Request.URL.Path,
            Action:    c.Request.Method,
            Status:    statusFromCode(c.Writer.Status()),
            Metadata: map[string]any{
                "response_time_ms": time.Since(start).Milliseconds(),
                "status_code":      c.Writer.Status(),
            },
        })
    }
}
```

#### Java Services

```java
// audit/AuditLogger.java
@Component
public class AuditLogger {
    private static final Logger logger = LoggerFactory.getLogger("AUDIT");

    public void log(AuditEvent event) {
        MDC.put("event_type", event.getEventType());
        MDC.put("user_id", event.getUserId());
        MDC.put("ip_address", event.getIpAddress());
        MDC.put("resource", event.getResource());
        MDC.put("action", event.getAction());
        MDC.put("status", event.getStatus());
        logger.info("Audit event: {}", event.getEventType());
        MDC.clear();
    }
}

// AuditAspect.java
@Aspect
@Component
public class AuditAspect {
    @Around("@annotation(Audited)")
    public Object audit(ProceedingJoinPoint pjp) throws Throwable {
        // Pre-execution audit
        Object result = pjp.proceed();
        // Post-execution audit
        return result;
    }
}
```

#### Python Service

```python
# app/audit/logger.py
import structlog
from datetime import datetime, timezone

audit_logger = structlog.get_logger("audit")

class AuditLogger:
    def log(self, event_type: str, user_id: str, ip_address: str, 
            resource: str, action: str, status: str, metadata: dict = None):
        audit_logger.info(
            "AUDIT",
            timestamp=datetime.now(timezone.utc).isoformat(),
            event_type=event_type,
            user_id=user_id,
            ip_address=ip_address,
            resource=resource,
            action=action,
            status=status,
            metadata=metadata or {}
        )

# FastAPI middleware
@app.middleware("http")
async def audit_middleware(request: Request, call_next):
    start = time.time()
    response = await call_next(request)
    audit.log(
        event_type="API_REQUEST",
        user_id=request.state.user_id if hasattr(request.state, 'user_id') else "anonymous",
        ip_address=request.client.host,
        resource=str(request.url.path),
        action=request.method,
        status="SUCCESS" if response.status_code < 400 else "FAILURE",
        metadata={"response_time_ms": int((time.time() - start) * 1000)}
    )
    return response
```

#### TypeScript Service

```typescript
// src/common/audit/audit.service.ts
@Injectable()
export class AuditService {
  private readonly logger = new Logger('AUDIT');

  log(event: AuditEvent): void {
    this.logger.log(JSON.stringify({
      timestamp: new Date().toISOString(),
      ...event,
    }));
  }
}

// AuditInterceptor
@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(private auditService: AuditService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const start = Date.now();

    return next.handle().pipe(
      tap(() => {
        this.auditService.log({
          eventType: 'API_REQUEST',
          userId: request.user?.id || 'anonymous',
          ipAddress: request.ip,
          resource: request.url,
          action: request.method,
          status: 'SUCCESS',
          metadata: { responseTimeMs: Date.now() - start },
        });
      }),
    );
  }
}
```

---

### 4.4 Loki Query Examples

```logql
# All audit events
{job="chainrisk"} |= "AUDIT"

# Failed login attempts
{job="chainrisk"} |= "AUDIT" | json | event_type="AUTH_FAILED"

# High-risk address queries
{job="chainrisk"} |= "AUDIT" | json | event_type="ADDRESS_QUERY" | metadata_risk_score > 80

# Events by user
{job="chainrisk"} |= "AUDIT" | json | user_id="user-123"
```

---

### 4.5 Retention Policy

| Log Type | Retention | Storage |
|----------|-----------|---------|
| Audit logs | 90 days | Loki + S3 |
| Security events | 1 year | Loki + S3 |
| Compliance logs | 7 years | S3 Glacier |

---

## Deliverables

| Artifact | Path |
|----------|------|
| Go audit package | `services/query-service/pkg/audit/` |
| Java audit component | `services/orchestrator/.../audit/` |
| Python audit module | `services/risk-ml-service/app/audit/` |
| TS audit service | `services/bff/src/common/audit/` |
| Loki config update | `infra/compose/loki.yml` |
| Grafana audit dashboard | `infra/grafana/dashboards/audit.json` |

---

## Validation

| Check | Method |
|-------|--------|
| Audit log generated | Trigger API call → check Loki |
| Event schema valid | JSON schema validation |
| User ID captured | Authenticated request → user_id present |
| IP address captured | Check ip_address field |
| Loki query works | Run sample queries |

---

## Completion Criteria

- [ ] Audit middleware in all services
- [ ] Structured JSON logging
- [ ] User ID extraction from JWT
- [ ] IP address capture
- [ ] Loki queries functional
- [ ] Grafana dashboard created
- [ ] Retention policy documented

---

## Handoff

Upon completion:
1. Merge `feature/cp4-audit-logging` → `develop/phase13`
2. Notify W1 of completion status

---

**Branch**: `feature/cp4-audit-logging`
