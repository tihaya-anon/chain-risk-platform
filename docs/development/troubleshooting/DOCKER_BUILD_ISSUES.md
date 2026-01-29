# Docker Build Issues - Phase 19

**Date**: 2026-01-29
**Status**: 🔄 In Progress
**Progress**: 2/6 services building successfully

---

## Build Test Results

### ✅ Passing (2/6)

| Service | Language | Status | Image Size | Notes |
|---------|----------|--------|------------|-------|
| query-service | Go | ✅ SUCCESS | 50.9MB | Fixed with GOTOOLCHAIN=auto |
| risk-ml-service | Python | ✅ SUCCESS | - | No issues |

---

## ❌ Failing (4/6)

### 1. alert-service (Go) - Code Issue

**Error**:
```
internal/service/alert_service.go:136:28: cannot use (*AlertService)(nil)
as "github.com/chain-risk-platform/alert-service/internal/kafka".EventHandler
value in variable declaration: *AlertService does not implement
"github.com/chain-risk-platform/alert-service/internal/kafka".EventHandler
(missing method HandleMevAlertEvent)
```

**Root Cause**: Phase 18 added MEV alert functionality but didn't implement the required interface method.

**Solution**:
- Add `HandleMevAlertEvent` method to AlertService
- Location: `services/alert-service/internal/service/alert_service.go`
- Reference: `services/alert-service/internal/kafka/event_handler.go`

**Priority**: HIGH (blocks service startup)

---

### 2. mempool-collector (Go) - CGO Linking Issue

**Error**:
```
undefined reference to `__rawmemchr'
undefined reference to `__strdup'
```

**Root Cause**: Using glibc-compiled library (librdkafka) with musl libc (Alpine)

**Solution Options**:

**Option A**: Use Debian-based image instead of Alpine
```dockerfile
FROM golang:1.23 AS builder  # Use Debian instead of Alpine
```

**Option B**: Build librdkafka from source for musl
```dockerfile
RUN apk add --no-cache build-base librdkafka-dev
```

**Option C**: Use pure Go Kafka client (no CGO)
- Replace `confluent-kafka-go` with `segmentio/kafka-go`
- Requires code changes

**Recommended**: Option A (simplest, most reliable)

**Priority**: MEDIUM (service exists but needs rebuild)

---

### 3. bff (TypeScript) - Network Issue

**Error**:
```
npm error network In most cases you are behind a proxy or have bad network settings.
```

**Root Cause**: Network connectivity issue during `npm ci`

**Solution Options**:

**Option A**: Retry build (transient network issue)
```bash
docker build --no-cache -t chainrisk/bff:latest services/bff
```

**Option B**: Use npm mirror
```dockerfile
RUN npm config set registry https://registry.npmmirror.com
RUN npm ci
```

**Option C**: Copy node_modules from local
```dockerfile
COPY node_modules ./node_modules
```

**Recommended**: Option A first, then Option B if persistent

**Priority**: MEDIUM (likely transient)

---

### 4. graph-service (Java) - Missing Annotation

**Error**:
```
[ERROR] /app/src/main/java/com/chainrisk/graph/config/MetricsConfig.java:[32,6]
cannot find symbol
[ERROR]   symbol:   class PostConstruct
```

**Root Cause**: Missing `javax.annotation-api` dependency

**Solution**:
Add dependency to `pom.xml`:
```xml
<dependency>
    <groupId>javax.annotation</groupId>
    <artifactId>javax.annotation-api</artifactId>
    <version>1.3.2</version>
</dependency>
```

Or use Jakarta EE annotation:
```xml
<dependency>
    <groupId>jakarta.annotation</groupId>
    <artifactId>jakarta.annotation-api</artifactId>
    <version>2.1.1</version>
</dependency>
```

**Priority**: HIGH (blocks service startup)

---

## Action Plan

### Immediate (Today)

1. **Fix alert-service** (30 min)
   - Implement HandleMevAlertEvent method
   - Test build
   - Commit fix

2. **Fix graph-service** (15 min)
   - Add javax.annotation-api dependency
   - Test build
   - Commit fix

3. **Retry bff build** (5 min)
   - Simple retry, likely transient issue

### Next Session

4. **Fix mempool-collector** (30 min)
   - Switch to Debian-based image
   - Test build
   - Commit fix

5. **Verify all builds** (15 min)
   - Run complete build test
   - Document final results

---

## Progress Tracking

- [x] Identify all build issues
- [x] Document root causes and solutions
- [ ] Fix alert-service
- [ ] Fix graph-service
- [ ] Retry bff build
- [ ] Fix mempool-collector
- [ ] All services building successfully

---

## Related Files

- Build test script: `scripts/test-docker-builds.sh`
- Build logs: `/tmp/docker-build-*.log`
- Progress doc: `docs/development/plans/PHASE19_PROGRESS.md`

---

**Last Updated**: 2026-01-29
**Next Update**: After fixing alert-service and graph-service
