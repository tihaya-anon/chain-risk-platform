# CP3: API Hardening

> **Worker**: W2  
> **Estimate**: 1.5 days  
> **Dependencies**: None  
> **Parallel Group**: A

---

## Objective

Implement rate limiting, input validation, and request sanitization across all APIs.

---

## Tasks

### 3.1 Rate Limiting

#### Go Services (Gin)

```go
// pkg/ratelimit/middleware.go
func RateLimitMiddleware(rps int, burst int) gin.HandlerFunc {
    limiter := rate.NewLimiter(rate.Limit(rps), burst)
    return func(c *gin.Context) {
        if !limiter.Allow() {
            c.AbortWithStatusJSON(429, gin.H{"error": "rate limit exceeded"})
            return
        }
        c.Next()
    }
}

// Per-IP rate limiting
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

#### Java Services (Spring)

```java
// config/RateLimitConfig.java
@Configuration
public class RateLimitConfig {
    @Bean
    public RateLimiter rateLimiter() {
        return RateLimiter.of("api", RateLimiterConfig.custom()
            .limitRefreshPeriod(Duration.ofSeconds(1))
            .limitForPeriod(100)
            .timeoutDuration(Duration.ofMillis(100))
            .build());
    }
}
```

#### Python Service (FastAPI)

```python
# app/middleware/ratelimit.py
from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)

@app.get("/api/v1/score")
@limiter.limit("100/minute")
async def score_address(request: Request, address: str):
    pass
```

#### TypeScript Service (NestJS)

```typescript
// src/common/guards/rate-limit.guard.ts
@Injectable()
export class RateLimitGuard implements CanActivate {
  private rateLimiter = new RateLimiterMemory({
    points: 100,
    duration: 60,
  });

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const ip = request.ip;
    try {
      await this.rateLimiter.consume(ip);
      return true;
    } catch {
      throw new HttpException('Rate limit exceeded', 429);
    }
  }
}
```

---

### 3.2 Input Validation

#### Request Size Limits

| Service | Max Body Size | Max URL Length |
|---------|--------------|----------------|
| orchestrator | 1MB | 2048 |
| bff | 1MB | 2048 |
| query-service | 512KB | 2048 |
| risk-ml-service | 512KB | 2048 |
| alert-service | 512KB | 2048 |
| graph-service | 1MB | 2048 |

#### Address Validation (All Services)

```go
// pkg/validation/address.go
var ethAddressRegex = regexp.MustCompile(`^0x[a-fA-F0-9]{40}$`)

func ValidateAddress(addr string) error {
    if !ethAddressRegex.MatchString(addr) {
        return errors.New("invalid ethereum address")
    }
    return nil
}
```

#### SQL Injection Prevention

```go
// Use parameterized queries only
db.Where("address = ?", address).First(&record)  // ✓
db.Where("address = " + address).First(&record)  // ✗
```

#### XSS Prevention (BFF)

```typescript
// src/common/pipes/sanitize.pipe.ts
import * as sanitizeHtml from 'sanitize-html';

@Injectable()
export class SanitizePipe implements PipeTransform {
  transform(value: any) {
    if (typeof value === 'string') {
      return sanitizeHtml(value, { allowedTags: [], allowedAttributes: {} });
    }
    return value;
  }
}
```

---

### 3.3 Rate Limit Configuration

| Endpoint Pattern | Limit | Scope |
|-----------------|-------|-------|
| `/api/v1/address/*` | 100/min | Per IP |
| `/api/v1/risk/*` | 50/min | Per IP |
| `/api/v1/graph/*` | 30/min | Per IP |
| `/api/v1/alerts/*` | 60/min | Per IP |
| `/health`, `/metrics` | 1000/min | Global |

---

## Deliverables

| Artifact | Path |
|----------|------|
| Go rate limit pkg | `services/query-service/pkg/ratelimit/` |
| Go validation pkg | `services/query-service/pkg/validation/` |
| Java rate limit config | `services/orchestrator/.../config/RateLimitConfig.java` |
| Python rate limit | `services/risk-ml-service/app/middleware/ratelimit.py` |
| TS rate limit guard | `services/bff/src/common/guards/rate-limit.guard.ts` |
| TS sanitize pipe | `services/bff/src/common/pipes/sanitize.pipe.ts` |

---

## Validation

| Check | Test |
|-------|------|
| Rate limit triggers | Send 101 requests in 1 minute → 429 |
| Invalid address rejected | `GET /address/invalid` → 400 |
| XSS sanitized | Input `<script>` → stripped |
| SQL injection blocked | Input `'; DROP TABLE --` → 400 |
| Large body rejected | 2MB body → 413 |

---

## Test Script

```bash
#!/bin/bash
# tests/security/rate-limit-test.sh
for i in $(seq 1 110); do
  response=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8081/api/v1/address/0x...)
  if [ "$i" -gt 100 ] && [ "$response" != "429" ]; then
    echo "FAIL: Expected 429 at request $i"
    exit 1
  fi
done
echo "Rate limit test passed"
```

---

## Completion Criteria

- [ ] Rate limiting implemented in all services
- [ ] Per-IP rate limiting functional
- [ ] Request size limits configured
- [ ] Address validation implemented
- [ ] XSS prevention in BFF
- [ ] SQL injection tests pass
- [ ] k6 rate limit test passes

---

## Handoff

Upon completion:
1. Merge `feature/cp3-api-hardening` → `develop/phase13`
2. Start CP4 (if not already started)
3. Notify W1 of completion status

---

**Branch**: `feature/cp3-api-hardening`
