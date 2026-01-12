# Worker 2 Prompt - Application Track

## Context

You are implementing Phase 13 (Security Hardening) for Chain Risk Platform. Your track focuses on **application-level security**: rate limiting, input validation, and audit logging.

**Repo**: `tihaya-anon/chain-risk-platform`

---

## Setup

```bash
git fetch origin develop/phase13
git checkout develop/phase13
```

---

## Your Tasks

### Task 1: CP3 - API Hardening (Day 1-2)

**Branch**: `feature/cp3-api-hardening`

**Objective**: Implement rate limiting, input validation, and request sanitization.

**Deliverables**:

| Service | Files |
|---------|-------|
| query-service | `pkg/ratelimit/middleware.go`, `pkg/validation/address.go` |
| alert-service | `pkg/ratelimit/middleware.go`, `pkg/validation/` |
| orchestrator | `src/.../config/RateLimitConfig.java`, `src/.../validation/` |
| graph-service | `src/.../config/RateLimitConfig.java` |
| risk-ml-service | `app/middleware/ratelimit.py`, `app/middleware/validation.py` |
| bff | `src/common/guards/rate-limit.guard.ts`, `src/common/pipes/sanitize.pipe.ts` |

**Rate Limit Config**:
| Endpoint Pattern | Limit | Scope |
|-----------------|-------|-------|
| `/api/v1/address/*` | 100/min | Per IP |
| `/api/v1/risk/*` | 50/min | Per IP |
| `/api/v1/graph/*` | 30/min | Per IP |
| `/api/v1/alerts/*` | 60/min | Per IP |

**Request Size Limits**: 1MB body, 2048 URL length

**Validation Rules**:
- Ethereum address: `^0x[a-fA-F0-9]{40}$`
- Reject SQL injection patterns
- Sanitize HTML/XSS in BFF

**Implementation Guide**:

Go (Gin):
```go
func PerIPRateLimiter(rps int) gin.HandlerFunc {
    limiters := sync.Map{}
    return func(c *gin.Context) {
        ip := c.ClientIP()
        l, _ := limiters.LoadOrStore(ip, rate.NewLimiter(rate.Limit(rps), rps*2))
        if !l.(*rate.Limiter).Allow() {
            c.AbortWithStatusJSON(429, gin.H{"error": "rate limit exceeded"})
            return
        }
        c.Next()
    }
}
```

Java (Spring):
```java
@Bean
public RateLimiter rateLimiter() {
    return RateLimiter.of("api", RateLimiterConfig.custom()
        .limitRefreshPeriod(Duration.ofSeconds(1))
        .limitForPeriod(100)
        .build());
}
```

Python (FastAPI):
```python
from slowapi import Limiter
limiter = Limiter(key_func=get_remote_address)

@app.get("/api/v1/score")
@limiter.limit("50/minute")
async def score(request: Request): ...
```

TypeScript (NestJS):
```typescript
@Injectable()
export class RateLimitGuard implements CanActivate {
  private limiter = new RateLimiterMemory({ points: 100, duration: 60 });
  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const ip = ctx.switchToHttp().getRequest().ip;
    await this.limiter.consume(ip);
    return true;
  }
}
```

**Validation**:
```bash
# Should return 429 after limit
for i in {1..110}; do curl -s http://localhost:8081/api/v1/address/0x...; done

# Should return 400
curl http://localhost:8081/api/v1/address/invalid
curl http://localhost:8081/api/v1/address/"'; DROP TABLE--"
```

**On completion**: Merge to `develop/phase13`, start CP4.

---

### Task 2: CP4 - Audit Logging (Day 2-3)

**Branch**: `feature/cp4-audit-logging`

**Objective**: Structured audit logging for sensitive operations.

**Deliverables**:

| Service | Files |
|---------|-------|
| query-service | `pkg/audit/logger.go`, `pkg/audit/middleware.go` |
| alert-service | `pkg/audit/logger.go`, `pkg/audit/middleware.go` |
| orchestrator | `src/.../audit/AuditLogger.java`, `src/.../audit/AuditAspect.java` |
| graph-service | `src/.../audit/AuditLogger.java` |
| risk-ml-service | `app/audit/logger.py`, `app/audit/middleware.py` |
| bff | `src/common/audit/audit.service.ts`, `src/common/audit/audit.interceptor.ts` |

**Audit Event Schema**:
```json
{
  "timestamp": "2026-01-12T10:30:00Z",
  "event_type": "ADDRESS_QUERY",
  "user_id": "user-123",
  "ip_address": "192.168.1.1",
  "resource": "/api/v1/address/0x...",
  "action": "READ",
  "status": "SUCCESS",
  "metadata": {}
}
```

**Auditable Events**:
| Event Type | Service |
|------------|---------|
| AUTH_LOGIN, AUTH_FAILED | orchestrator |
| ADDRESS_QUERY | query-service |
| RISK_SCORE | risk-ml-service |
| ALERT_CREATE, ALERT_DELETE | alert-service |
| GRAPH_QUERY | graph-service |

**Implementation Guide**:

Go:
```go
type AuditEvent struct {
    Timestamp time.Time      `json:"timestamp"`
    EventType string         `json:"event_type"`
    UserID    string         `json:"user_id"`
    IPAddress string         `json:"ip_address"`
    Resource  string         `json:"resource"`
    Action    string         `json:"action"`
    Status    string         `json:"status"`
    Metadata  map[string]any `json:"metadata"`
}

func (a *AuditLogger) Log(event AuditEvent) {
    a.logger.Info("AUDIT", slog.Any("event", event))
}
```

Python:
```python
audit_logger = structlog.get_logger("audit")

def log_audit(event_type: str, user_id: str, ip: str, resource: str, action: str, status: str):
    audit_logger.info("AUDIT", event_type=event_type, user_id=user_id, 
                      ip_address=ip, resource=resource, action=action, status=status)
```

**Loki Queries** (for verification):
```logql
{job="chainrisk"} |= "AUDIT" | json | event_type="ADDRESS_QUERY"
{job="chainrisk"} |= "AUDIT" | json | status="FAILURE"
```

**Validation**:
```bash
# Trigger event
curl http://localhost:8081/api/v1/address/0x...

# Check Loki
curl "http://localhost:3100/loki/api/v1/query_range" \
  --data-urlencode 'query={job="chainrisk"} |= "AUDIT"'
```

**On completion**: Merge to `develop/phase13`, notify W1.

---

## Reference Docs

- [CP3_API_HARDENING.md](./CP3_API_HARDENING.md)
- [CP4_AUDIT_LOGGING.md](./CP4_AUDIT_LOGGING.md)

---

## Tech Stack Reference

| Service | Language | Framework | Rate Limit Lib |
|---------|----------|-----------|----------------|
| query-service | Go | Gin | golang.org/x/time/rate |
| alert-service | Go | Gin | golang.org/x/time/rate |
| orchestrator | Java | Spring Boot | resilience4j |
| graph-service | Java | Spring Boot | resilience4j |
| risk-ml-service | Python | FastAPI | slowapi |
| bff | TypeScript | NestJS | rate-limiter-flexible |

---

## Communication

- Notify W1 when both CP3 and CP4 complete
- Escalate blockers immediately
