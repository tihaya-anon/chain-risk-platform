# Phase 10: Production Hardening

> Service containerization, security, persistence, real-time features

---

## Goals

1. **Containerize Services** - Full Docker deployment for log-trace correlation
2. **Security Hardening** - Authentication, authorization, secrets management
3. **Data Persistence** - Jaeger Elasticsearch, reliable storage
4. **Real-time Features** - WebSocket alerts, live dashboard updates
5. **Operational Excellence** - Health checks, graceful shutdown, resource limits

---

## Status (Pre-Phase)

| Component | Current | Target |
|-----------|---------|--------|
| Service Deployment | Host-based | Full Docker containers |
| Authentication | Basic (gateway only) | JWT + RBAC |
| Secrets | Plain text / env vars | HashiCorp Vault |
| Jaeger Storage | In-memory | Elasticsearch |
| Real-time Alerts | Polling only | WebSocket push |
| Health Checks | Basic /health | Liveness + Readiness probes |

---

## Assignment Table

| CP | Task | Worker | Depends | Notify | Est |
|----|------|--------|---------|--------|-----|
| **Track A: Containerization** |||||
| 1 | Service Dockerfiles | W1 | - | W1(2) | 1d |
| 2 | Docker Compose Services | W1 | CP-1 | W1(3), W2(8) | 0.5d |
| 3 | Service Network Config | W1 | CP-2 | W1(15) | 0.5d |
| **Track B: Security** |||||
| 4 | Vault Deployment | W2 | - | W2(5,6) | 0.5d |
| 5 | Vault Secret Migration | W2 | CP-4 | W2(7) | 1d |
| 6 | JWT Enhancement | W2 | CP-4 | W2(7) | 1d |
| 7 | RBAC Implementation | W2 | CP-5,6 | W1(15) | 1d |
| **Track C: Persistence** |||||
| 8 | Elasticsearch Deployment | W3 | - | W3(9) | 0.5d |
| 9 | Jaeger ES Backend | W3 | CP-8 | W3(10) | 0.5d |
| 10 | Trace Retention Policy | W3 | CP-9 | W1(15) | 0.25d |
| **Track D: Real-time** |||||
| 11 | WebSocket Gateway | W3 | - | W3(12) | 1d |
| 12 | Alert Push Service | W3 | CP-11 | W3(13) | 1d |
| 13 | Frontend WS Integration | W3 | CP-12 | W1(15) | 0.5d |
| **Track E: Operations** |||||
| 14 | Health Check Enhancement | W1 | CP-2 | W1(15) | 0.5d |
| 15 | Integration Validation | W1 | CP-3,7,10,13,14 | - | 1d |
| 16 | Documentation Update | W1 | CP-15 | - | 0.5d |

**Total Estimate**: ~11 days (parallel: ~5 days with 3 workers)

---

## Execution Schedule

| Day | W1 (Containerization) | W2 (Security) | W3 (Persistence + RT) |
|-----|----------------------|---------------|----------------------|
| 1 | CP-1 Dockerfiles | CP-4 Vault | CP-8 Elasticsearch |
| 2 | CP-2 Compose | CP-5 Secrets | CP-9 Jaeger ES |
| 2.5 | CP-3 Network | CP-6 JWT | CP-10 Retention |
| 3 | CP-14 Health | CP-6 JWT (cont) | CP-11 WebSocket |
| 4 | - | CP-7 RBAC | CP-12 Alert Push |
| 5 | CP-15 Integration | CP-7 RBAC (cont) | CP-13 Frontend WS |
| 6 | CP-16 Docs | - | - |

**Critical Path**: CP-1 → CP-2 → CP-3 → CP-15 → CP-16

---

## DAG

```
Track A (W1)              Track B (W2)              Track C (W3)           Track D (W3)
─────────────             ─────────────             ─────────────          ─────────────
[CP-1 Dockerfiles]        [CP-4 Vault]              [CP-8 Elasticsearch]   [CP-11 WebSocket]
        │                   │     │                        │                      │
        ▼                   ▼     ▼                        ▼                      ▼
[CP-2 Compose]────────▶[CP-5 Secrets][CP-6 JWT]    [CP-9 Jaeger ES]       [CP-12 Alert Push]
        │                   │         │                    │                      │
        ▼                   └────┬────┘                    ▼                      ▼
[CP-3 Network]                  ▼                  [CP-10 Retention]       [CP-13 Frontend]
        │                 [CP-7 RBAC]                      │                      │
        │                       │                          │                      │
        ▼                       │                          │                      │
[CP-14 Health]                  │                          │                      │
        │                       │                          │                      │
        └───────────────────────┴──────────────────────────┴──────────────────────┘
                                              │
                                              ▼
                                     [CP-15 Integration]
                                              │
                                              ▼
                                     [CP-16 Documentation]
```

---

## Checkpoint Details

### Track A: Service Containerization

#### CP-1: Service Dockerfiles (W1)

Create production-ready Dockerfiles for all services:

```dockerfile
# services/query-service/Dockerfile
FROM golang:1.21-alpine AS builder
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 go build -o /query-service ./cmd/server

FROM alpine:3.19
RUN apk --no-cache add ca-certificates
COPY --from=builder /query-service /usr/local/bin/
EXPOSE 8081
HEALTHCHECK --interval=30s --timeout=3s \
  CMD wget -qO- http://localhost:8081/health || exit 1
ENTRYPOINT ["query-service"]
```

**Services**:
- query-service (Go)
- alert-service (Go)
- risk-ml-service (Python)
- graph-service (Java)
- orchestrator (Java)
- bff (TypeScript)

**Done when**: All images build successfully with `make docker-build`

---

#### CP-2: Docker Compose Services (W1)

Add application services to docker-compose:

```yaml
# docker-compose.yml (additions)
services:
  query-service:
    build: ./services/query-service
    container_name: query-service
    environment:
      - POSTGRES_HOST=postgres
      - REDIS_HOST=redis
      - NACOS_SERVER=nacos:8848
      - OTEL_EXPORTER_OTLP_ENDPOINT=http://jaeger:4317
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_started
      nacos:
        condition: service_healthy
    healthcheck:
      test: ["CMD", "wget", "-qO-", "http://localhost:8081/health"]
      interval: 30s
      timeout: 5s
      retries: 3
    restart: unless-stopped
    
  # Similar for other services...
```

**Done when**: `docker-compose up -d` starts all services

---

#### CP-3: Service Network Config (W1)

Configure inter-service communication:

```yaml
# Network configuration
networks:
  frontend:
    name: chainrisk-frontend
  backend:
    name: chainrisk-backend
  monitoring:
    name: chainrisk-monitoring

services:
  orchestrator:
    networks:
      - frontend
      - backend
  query-service:
    networks:
      - backend
  prometheus:
    networks:
      - backend
      - monitoring
```

**Done when**: Services communicate via internal DNS names

---

### Track B: Security Hardening

#### CP-4: Vault Deployment (W2)

Deploy HashiCorp Vault for secrets management:

```yaml
# docker-compose.yml
vault:
  image: hashicorp/vault:1.15
  container_name: vault
  cap_add:
    - IPC_LOCK
  environment:
    VAULT_DEV_ROOT_TOKEN_ID: dev-root-token
    VAULT_DEV_LISTEN_ADDRESS: 0.0.0.0:8200
  ports:
    - "18200:8200"
  volumes:
    - vault_data:/vault/file
  healthcheck:
    test: ["CMD", "vault", "status"]
    interval: 10s
    timeout: 5s
    retries: 3
```

```bash
# infra/vault/init.sh
vault secrets enable -path=chainrisk kv-v2
vault kv put chainrisk/database \
  postgres_password=chainrisk123 \
  redis_password="" \
  neo4j_password=chainrisk123
```

**Done when**: Vault UI accessible at :18200

---

#### CP-5: Vault Secret Migration (W2)

Migrate all secrets to Vault:

```yaml
# Secrets to migrate
chainrisk/database:
  postgres_user: chainrisk
  postgres_password: chainrisk123
  neo4j_user: neo4j
  neo4j_password: chainrisk123
  redis_password: ""

chainrisk/services:
  jwt_secret: <generate>
  api_keys: <generate>

chainrisk/integrations:
  etherscan_api_key: <existing>
  slack_webhook: <existing>
  smtp_password: <existing>
```

**Service integration**:
```go
// Go services
import vault "github.com/hashicorp/vault/api"

func getSecret(path, key string) string {
    client, _ := vault.NewClient(vault.DefaultConfig())
    secret, _ := client.Logical().Read("chainrisk/data/" + path)
    return secret.Data["data"].(map[string]interface{})[key].(string)
}
```

**Done when**: No plain-text secrets in docker-compose or env files

---

#### CP-6: JWT Enhancement (W2)

Enhance JWT with refresh tokens and claims:

```java
// orchestrator JWT config
@Configuration
public class JwtConfig {
    @Value("${jwt.secret}") // From Vault
    private String secret;
    
    @Value("${jwt.access-expiration}")
    private long accessExpiration = 900; // 15 min
    
    @Value("${jwt.refresh-expiration}")
    private long refreshExpiration = 604800; // 7 days
}

// JWT claims structure
{
  "sub": "user_id",
  "username": "admin",
  "roles": ["ADMIN", "ANALYST"],
  "permissions": ["read:risk", "write:alerts"],
  "iat": 1234567890,
  "exp": 1234568790
}
```

**Endpoints**:
- POST /auth/login → access_token + refresh_token
- POST /auth/refresh → new access_token
- POST /auth/logout → invalidate refresh_token

**Done when**: Token refresh flow works end-to-end

---

#### CP-7: RBAC Implementation (W2)

Implement role-based access control:

```yaml
# roles.yaml
roles:
  ADMIN:
    permissions:
      - "*"
  ANALYST:
    permissions:
      - "read:*"
      - "write:alerts"
      - "write:subscriptions"
  VIEWER:
    permissions:
      - "read:risk"
      - "read:transfers"
      - "read:graph"

# Permission mapping
endpoints:
  GET /api/risk/*: read:risk
  POST /api/alerts: write:alerts
  DELETE /api/alerts/*: delete:alerts
  GET /api/admin/*: admin:*
```

```java
// Spring Security filter
@PreAuthorize("hasPermission('read:risk')")
@GetMapping("/api/risk/{address}")
public RiskResponse getRisk(@PathVariable String address) { ... }
```

**Done when**: Unauthorized requests return 403

---

### Track C: Data Persistence

#### CP-8: Elasticsearch Deployment (W3)

Deploy Elasticsearch for Jaeger storage:

```yaml
# docker-compose.yml
elasticsearch:
  image: docker.elastic.co/elasticsearch/elasticsearch:8.11.0
  container_name: elasticsearch
  environment:
    - discovery.type=single-node
    - xpack.security.enabled=false
    - "ES_JAVA_OPTS=-Xms512m -Xmx512m"
  ports:
    - "19200:9200"
  volumes:
    - elasticsearch_data:/usr/share/elasticsearch/data
  healthcheck:
    test: ["CMD", "curl", "-f", "http://localhost:9200/_cluster/health"]
    interval: 30s
    timeout: 10s
    retries: 5
  ulimits:
    memlock:
      soft: -1
      hard: -1
```

**Done when**: ES cluster health is green/yellow

---

#### CP-9: Jaeger ES Backend (W3)

Configure Jaeger to use Elasticsearch:

```yaml
# docker-compose.yml
jaeger:
  image: jaegertracing/all-in-one:1.50
  environment:
    COLLECTOR_OTLP_ENABLED: "true"
    SPAN_STORAGE_TYPE: elasticsearch
    ES_SERVER_URLS: http://elasticsearch:9200
    ES_INDEX_PREFIX: jaeger
  depends_on:
    elasticsearch:
      condition: service_healthy
```

**Done when**: Traces persist across Jaeger restarts

---

#### CP-10: Trace Retention Policy (W3)

Configure index lifecycle management:

```json
// PUT _ilm/policy/jaeger-traces-policy
{
  "policy": {
    "phases": {
      "hot": {
        "min_age": "0ms",
        "actions": {
          "rollover": {
            "max_age": "1d",
            "max_size": "5gb"
          }
        }
      },
      "warm": {
        "min_age": "7d",
        "actions": {
          "shrink": { "number_of_shards": 1 },
          "forcemerge": { "max_num_segments": 1 }
        }
      },
      "delete": {
        "min_age": "30d",
        "actions": { "delete": {} }
      }
    }
  }
}
```

**Done when**: Old indices auto-deleted after 30 days

---

### Track D: Real-time Features

#### CP-11: WebSocket Gateway (W3)

Add WebSocket support to BFF:

```typescript
// services/bff/src/gateways/alerts.gateway.ts
@WebSocketGateway({ 
  namespace: '/alerts',
  cors: { origin: '*' }
})
export class AlertsGateway {
  @WebSocketServer()
  server: Server;

  @SubscribeMessage('subscribe')
  handleSubscribe(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { topics: string[] }
  ) {
    data.topics.forEach(topic => client.join(topic));
    return { event: 'subscribed', data: { topics: data.topics } };
  }

  broadcastAlert(alert: AlertDto) {
    this.server.to(`severity:${alert.severity}`).emit('alert', alert);
    this.server.to(`type:${alert.type}`).emit('alert', alert);
  }
}
```

```typescript
// services/bff/src/app.module.ts
@Module({
  imports: [
    // ... existing
    AlertsGateway,
  ],
})
```

**Done when**: WebSocket connects at ws://bff:3001/alerts

---

#### CP-12: Alert Push Service (W3)

Connect alert-service to WebSocket:

```go
// services/alert-service/internal/ws/client.go
type WSClient struct {
    conn *websocket.Conn
    url  string
}

func (c *WSClient) PushAlert(alert *model.Alert) error {
    msg := AlertMessage{
        Type:     "alert",
        Severity: alert.Severity,
        Data:     alert,
    }
    return c.conn.WriteJSON(msg)
}

// In alert engine
func (e *Engine) processAlert(alert *model.Alert) {
    // Existing notification channels
    e.dispatcher.SendAll(ctx, alert, subs)
    
    // Real-time push
    e.wsClient.PushAlert(alert)
}
```

**Done when**: Alerts appear in WebSocket within 1s

---

#### CP-13: Frontend WebSocket Integration (W3)

Add real-time alerts to frontend:

```typescript
// frontend/src/hooks/useAlertSocket.ts
export function useAlertSocket() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  
  useEffect(() => {
    const socket = io(`${WS_URL}/alerts`);
    
    socket.emit('subscribe', { 
      topics: ['severity:critical', 'severity:high'] 
    });
    
    socket.on('alert', (alert: Alert) => {
      setAlerts(prev => [alert, ...prev].slice(0, 100));
      
      // Show notification
      if (alert.severity === 'critical') {
        notification.error({
          message: 'Critical Alert',
          description: alert.message,
        });
      }
    });
    
    return () => socket.disconnect();
  }, []);
  
  return { alerts };
}
```

**Done when**: Toast notifications appear on new alerts

---

### Track E: Operations

#### CP-14: Health Check Enhancement (W1)

Add comprehensive health checks:

```go
// Liveness: Is the process running?
// GET /health/live
func LivenessHandler(w http.ResponseWriter, r *http.Request) {
    w.WriteHeader(http.StatusOK)
    json.NewEncoder(w).Encode(map[string]string{"status": "alive"})
}

// Readiness: Can the service handle requests?
// GET /health/ready
func ReadinessHandler(w http.ResponseWriter, r *http.Request) {
    checks := []HealthCheck{
        {Name: "postgres", Check: checkPostgres},
        {Name: "redis", Check: checkRedis},
        {Name: "kafka", Check: checkKafka},
    }
    
    allHealthy := true
    results := make(map[string]string)
    
    for _, c := range checks {
        if err := c.Check(); err != nil {
            results[c.Name] = err.Error()
            allHealthy = false
        } else {
            results[c.Name] = "ok"
        }
    }
    
    status := http.StatusOK
    if !allHealthy {
        status = http.StatusServiceUnavailable
    }
    
    w.WriteHeader(status)
    json.NewEncoder(w).Encode(results)
}
```

**Done when**: K8s probes work with new endpoints

---

#### CP-15: Integration Validation (W1)

End-to-end validation checklist:

```bash
#!/bin/bash
# scripts/validate-phase10.sh

echo "=== Phase 10 Validation ==="

# Track A: Containerization
echo "Checking containerized services..."
for svc in query-service alert-service risk-ml-service graph-service orchestrator bff; do
  docker ps | grep -q $svc && echo "✓ $svc running" || echo "✗ $svc NOT running"
done

# Track B: Security
echo "Checking Vault..."
curl -s http://localhost:18200/v1/sys/health | jq -e '.sealed == false' && echo "✓ Vault unsealed"

echo "Checking JWT..."
TOKEN=$(curl -s -X POST http://localhost:8080/auth/login -d '{"username":"test","password":"test"}' | jq -r '.access_token')
[ -n "$TOKEN" ] && echo "✓ JWT working"

# Track C: Persistence
echo "Checking Elasticsearch..."
curl -s http://localhost:19200/_cluster/health | jq -e '.status != "red"' && echo "✓ ES healthy"

echo "Checking Jaeger persistence..."
curl -s "http://localhost:26686/api/services" | jq -e '.data | length > 0' && echo "✓ Jaeger has data"

# Track D: Real-time
echo "Checking WebSocket..."
# wscat test or similar

echo "=== Validation Complete ==="
```

**Done when**: All checks pass

---

#### CP-16: Documentation Update (W1)

Update documentation:

- [ ] Architecture diagram with new components
- [ ] Security configuration guide
- [ ] WebSocket API documentation
- [ ] Operations runbook updates
- [ ] Development workflow updates

---

## Success Criteria

- [ ] All services running in Docker containers
- [ ] Logs appear in Loki with trace_id correlation
- [ ] Secrets managed via Vault (no plain text)
- [ ] JWT refresh flow working
- [ ] RBAC enforced on all endpoints
- [ ] Traces persist in Elasticsearch (30-day retention)
- [ ] WebSocket alerts working in frontend
- [ ] Health checks pass for all services
- [ ] Integration validation script passes

---

## Risk Mitigation

| Risk | Impact | Mitigation |
|------|--------|------------|
| Vault complexity | High | Start with dev mode, add HA later |
| ES resource usage | Medium | Start with minimal config, tune later |
| WebSocket scaling | Medium | Use Redis adapter for multi-instance |
| Migration downtime | High | Blue-green deployment strategy |

---

## Rollback Plan

1. **Containerization**: Keep host-based scripts as backup
2. **Vault**: Env vars fallback if Vault unavailable
3. **ES/Jaeger**: Fall back to in-memory storage
4. **WebSocket**: Disable feature flag, use polling
