# Phase 13 Follow-up: Security Integration Guide

> **Purpose**: Guide for completing security component integration  
> **Priority**: Should be addressed in subsequent phases

---

## Overview

Phase 13 delivered security infrastructure and component packages. This document outlines remaining integration work.

---

## 1. TLS Integration

### Current State
- TLS configuration packages created for all languages
- Certificates can be generated via Vault PKI
- Docker Compose TLS overlay ready

### Required Integration

#### Go Services (query-service, alert-service)

```go
// cmd/main.go - Add TLS server initialization
import "github.com/.../pkg/tls"

func main() {
    // Load TLS config
    tlsCfg, err := tls.NewConfig(tls.Options{
        CertPath: os.Getenv("TLS_CERT_PATH"),
        KeyPath:  os.Getenv("TLS_KEY_PATH"),
        CAPath:   os.Getenv("TLS_CA_PATH"),
        MTLSMode: os.Getenv("TLS_MTLS_MODE"),
    })
    
    // Create TLS server
    srv := tls.NewServer(router, tlsCfg, ":8444")
    srv.ListenAndServeTLS()
}
```

#### Java Services (orchestrator, graph-service)

```yaml
# Enable TLS profile in docker-compose or environment
SPRING_PROFILES_ACTIVE: tls

# application-tls.yml is already configured
# Just activate the profile
```

#### Python Service (risk-ml-service)

```python
# app/main.py - Add SSL context
from app.core.tls import create_ssl_context, TLSConfig

if os.getenv("TLS_ENABLED") == "true":
    ssl_context = create_ssl_context(TLSConfig(
        cert_path=os.getenv("TLS_CERT_PATH"),
        key_path=os.getenv("TLS_KEY_PATH"),
        ca_path=os.getenv("TLS_CA_PATH"),
    ))
    uvicorn.run(app, host="0.0.0.0", port=8445, ssl=ssl_context)
```

#### TypeScript Service (bff)

```typescript
// src/main.ts - Add HTTPS server
import { TLSConfig } from './config/tls';

if (process.env.TLS_ENABLED === 'true') {
    const tlsConfig = new TLSConfig();
    const httpsOptions = tlsConfig.getHttpsOptions();
    await app.listen(3443, '0.0.0.0', httpsOptions);
}
```

---

## 2. Rate Limiting Integration

### Current State
- Rate limiting middleware packages created
- Configuration structures defined
- Not yet wired into service routers

### Required Integration

#### Go Services

```go
// internal/router/router.go
import "github.com/.../pkg/ratelimit"

func SetupRouter() *gin.Engine {
    r := gin.New()
    
    // Add rate limit middleware
    limiter := ratelimit.NewMiddleware(ratelimit.Config{
        RequestsPerSecond: 100,
        BurstSize:         200,
    })
    r.Use(limiter.Handler())
    
    // ... routes
}
```

#### Java Services

```java
// Already configured via RateLimitConfig.java
// Register RateLimitFilter in filter chain:
@Bean
public FilterRegistrationBean<RateLimitFilter> rateLimitFilter() {
    FilterRegistrationBean<RateLimitFilter> bean = new FilterRegistrationBean<>();
    bean.setFilter(new RateLimitFilter(rateLimiterRegistry));
    bean.addUrlPatterns("/api/*");
    return bean;
}
```

#### Python Service

```python
# app/main.py
from app.middleware.ratelimit import RateLimitMiddleware

app.add_middleware(RateLimitMiddleware, requests_per_minute=600)
```

#### TypeScript Service

```typescript
// src/app.module.ts
import { RateLimitGuard } from './common/guards/rate-limit.guard';

@Module({
    providers: [
        { provide: APP_GUARD, useClass: RateLimitGuard },
    ],
})
```

---

## 3. Audit Logging Integration

### Current State
- Audit logger and middleware packages created
- Loki dashboard configured
- Not yet wired into service request handlers

### Required Integration

#### Go Services

```go
// internal/router/router.go
import "github.com/.../pkg/audit"

func SetupRouter() *gin.Engine {
    r := gin.New()
    
    auditLogger := audit.NewLogger(audit.Config{
        ServiceName: "query-service",
    })
    r.Use(audit.Middleware(auditLogger))
    
    // ... routes
}
```

#### Java Services

```java
// AuditFilter already created
// Register in SecurityConfig or WebConfig:
@Bean
public FilterRegistrationBean<AuditFilter> auditFilter() {
    FilterRegistrationBean<AuditFilter> bean = new FilterRegistrationBean<>();
    bean.setFilter(new AuditFilter(auditLogger));
    bean.setOrder(Ordered.HIGHEST_PRECEDENCE + 1);
    return bean;
}
```

---

## 4. Testing After Integration

```bash
# 1. Generate certificates
make security-up
./scripts/certs/generate-service-cert.sh --all

# 2. Start services with TLS
docker-compose -f infra/compose/base.yml \
               -f infra/compose/infra.yml \
               -f infra/compose/services.yml \
               -f infra/compose/services-tls.yml up -d

# 3. Run TLS test suite
./tests/security/tls-suite.sh

# 4. Run rate limit tests
k6 run tests/security/k6/rate-limit.test.js

# 5. Verify audit logs
./tests/security/audit-verify.sh
```

---

## 5. Recommended Timeline

| Task | Estimated Effort | Priority |
|------|------------------|----------|
| TLS integration (Go) | 2h | High |
| TLS integration (Java) | 1h | High |
| TLS integration (Python/TS) | 2h | High |
| Rate limiting wiring | 2h | Medium |
| Audit logging wiring | 2h | Medium |
| E2E security testing | 4h | High |

**Total**: ~13h (1.5-2 days)

---

## Files Reference

| Component | Location |
|-----------|----------|
| Go TLS | `services/*/pkg/tls/` |
| Go RateLimit | `services/*/pkg/ratelimit/` |
| Go Audit | `services/*/pkg/audit/` |
| Java TLS | `services/*/src/main/resources/application-tls.yml` |
| Java RateLimit | `services/*/src/main/java/.../config/RateLimitConfig.java` |
| Java Audit | `services/*/src/main/java/.../audit/` |
| Python TLS | `services/risk-ml-service/app/core/tls.py` |
| Python Middleware | `services/risk-ml-service/app/middleware/` |
| TypeScript TLS | `services/bff/src/config/tls.ts` |
| TypeScript Guards | `services/bff/src/common/guards/` |
| Docker TLS Overlay | `infra/compose/services-tls.yml` |

---

**Document Version**: 1.0  
**Created**: 2026-01-12
