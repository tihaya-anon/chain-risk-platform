# Phase 10.5: Observability Completion & E2E Testing

> Complete observability gaps and add integration testing

---

## Status Assessment

| Component | Current | Gap |
|-----------|---------|-----|
| Prometheus | Config exists | Targets point to host.docker.internal, services now in Docker |
| Java OTel | Config exists | graph-service/orchestrator not sending traces |
| Cross-service trace | Not verified | No E2E trace validation |
| Frontend E2E | None | No automated UI testing |

---

## Task Breakdown

| CP | Task | Depends | Est | Parallel |
|----|------|---------|-----|----------|
| 1 | Fix Prometheus targets for Docker network | - | 0.5h | ✅ |
| 2 | Fix Java OTel in Docker containers | - | 1h | ✅ |
| 3 | Integration test script | CP-1,2 | 1h | - |
| 4 | Frontend E2E setup (Playwright) | - | 2h | ✅ |
| 5 | WebSocket E2E test | CP-4 | 1h | - |

**Parallel**: CP-1, CP-2, CP-4 can run concurrently

---

## DAG

```
[CP-1 Prometheus]─────┐
                      │
[CP-2 Java OTel]──────┼──────▶[CP-3 Integration Test]
                      │
[CP-4 Playwright]─────┴──────▶[CP-5 WebSocket E2E]
```

---

## CP-1: Fix Prometheus Targets

**Problem**: prometheus.yml uses `host.docker.internal`, but services are now Docker containers.

**Fix**: Update targets to use Docker service names.

```yaml
# Before
- targets: ["host.docker.internal:8081"]

# After
- targets: ["query-service:8081"]
```

**Validation**:
```bash
curl http://localhost:19090/api/v1/targets | grep -c '"health":"up"'
# Should return 6+ (all services)
```

---

## CP-2: Fix Java OTel in Containers

**Problem**: Java services (graph-service, orchestrator) not sending traces.

**Cause**: Dockerfiles don't include OTel agent.

**Fix**: Update Dockerfiles to download and configure OTel agent.

```dockerfile
# Add to graph-service/Dockerfile
RUN curl -L -o /app/opentelemetry-javaagent.jar \
    https://github.com/open-telemetry/opentelemetry-java-instrumentation/releases/download/v2.10.0/opentelemetry-javaagent.jar

ENV JAVA_TOOL_OPTIONS="-javaagent:/app/opentelemetry-javaagent.jar"
ENV OTEL_SERVICE_NAME=graph-service
ENV OTEL_EXPORTER_OTLP_ENDPOINT=http://jaeger:4317
```

**Validation**:
```bash
curl http://localhost:26686/api/services
# Should include: graph-service, orchestrator
```

---

## CP-3: Integration Test Script

**Goal**: Verify cross-service calls produce complete traces.

**Test Flow**:
```
1. Call BFF API (e.g., /api/risk/address/:addr)
2. Extract trace_id from response header
3. Wait 5s for propagation
4. Query Jaeger for trace_id
5. Verify spans from all services in chain
```

**Script**: `scripts/integration-test.sh`

```bash
# Expected trace chain:
BFF → Orchestrator → RiskMLService → QueryService → PostgreSQL
                  └→ GraphService → Neo4j
```

**Success Criteria**:
- Trace contains spans from ≥3 services
- No orphan spans (all have parent except root)

---

## CP-4: Playwright Setup

**Goal**: Automated frontend testing.

**Structure**:
```
tests/
├── e2e/
│   ├── playwright.config.ts
│   ├── fixtures/
│   └── specs/
│       ├── login.spec.ts
│       ├── dashboard.spec.ts
│       └── search.spec.ts
```

**Test Cases**:
| Test | Description |
|------|-------------|
| login | Login form, error handling |
| dashboard | Dashboard loads, charts render |
| search | Address search, results display |
| alerts | Alert list, filter, detail |

---

## CP-5: WebSocket E2E Test

**Goal**: Verify real-time alert push.

**Flow**:
```
1. Connect WebSocket to BFF
2. Inject alert event to Kafka
3. Verify WebSocket receives alert within 5s
```

---

## Execution Order

```bash
# Day 1 (parallel)
make fix-prometheus-targets  # CP-1
make fix-java-otel          # CP-2
make setup-playwright       # CP-4

# Day 1.5 (after CP-1, CP-2)
make integration-test       # CP-3

# Day 2 (after CP-4)
make e2e-websocket          # CP-5
make e2e-all                # Full E2E suite
```

---

## Commands Reference

```bash
# Prometheus
make prometheus-targets-check   # List target status

# Tracing
make jaeger-services            # List services in Jaeger
make jaeger-trace TRACE_ID=xxx  # Get specific trace

# Integration
make integration-test           # Run integration tests

# E2E
make e2e-setup                  # Install Playwright
make e2e-test                   # Run all E2E tests
make e2e-test-ui                # Run with UI (headed)
```

---

## Success Criteria

- [ ] All Prometheus targets UP (6 services)
- [ ] Jaeger shows all 6 services
- [ ] Integration test passes (cross-service trace verified)
- [ ] Playwright tests pass (4 specs)
- [ ] WebSocket E2E passes

---

## Notes

- CP-1, CP-2, CP-4 are independent and can be done in parallel
- CP-3 requires CP-1, CP-2 to complete first
- CP-5 requires CP-4 (Playwright) to be set up
- Total estimate: ~1 day with parallelization
