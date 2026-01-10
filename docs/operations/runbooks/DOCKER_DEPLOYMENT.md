# Docker Deployment Runbook

Production deployment procedures for containerized services.

---

## Quick Reference

| Command | Description |
|---------|-------------|
| `make docker-build` | Build all service images |
| `make docker-up` | Start all services |
| `make docker-down` | Stop all services |
| `make docker-logs` | View service logs |
| `make validate-phase10` | Run validation |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     chainrisk-frontend                          │
│  ┌─────────┐    ┌──────────────┐                               │
│  │   BFF   │────│ Orchestrator │                               │
│  └────┬────┘    └──────┬───────┘                               │
└───────┼────────────────┼────────────────────────────────────────┘
        │                │
┌───────┼────────────────┼────────────────────────────────────────┐
│       │    chainrisk-backend                                    │
│  ┌────┴────┐  ┌────────┴─────────────────────────┐             │
│  │         │  │                                   │             │
│  │  Query  │  │  Alert    Risk-ML    Graph       │             │
│  │ Service │  │ Service   Service   Service      │             │
│  │         │  │                                   │             │
│  └────┬────┘  └──────┬───────┬───────┬──────────┘             │
│       │              │       │       │                          │
│  ┌────┴──────────────┴───────┴───────┴──────┐                  │
│  │  Postgres   Redis   Kafka   Neo4j   Nacos │                  │
│  └──────────────────────────────────────────┘                  │
└─────────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────┼───────────────────────────────────┐
│              chainrisk-monitoring                               │
│  ┌────────────┐  ┌──────┐  ┌───────┐  ┌────────┐              │
│  │ Prometheus │  │ Loki │  │Jaeger │  │Grafana │              │
│  └────────────┘  └──────┘  └───────┘  └────────┘              │
└─────────────────────────────────────────────────────────────────┘
```

---

## Deployment Procedures

### Full Stack Deployment

```bash
# 1. Start infrastructure
make infra-up

# 2. Wait for infrastructure readiness
make infra-check

# 3. Build service images
make docker-build

# 4. Start application services
make docker-up

# 5. Validate deployment
make validate-phase10
```

### Service-Only Deployment

```bash
# Build specific service
make docker-build-query
make docker-build-alert
make docker-build-risk
make docker-build-graph
make docker-build-orchestrator
make docker-build-bff

# Restart single service
docker-compose restart query-service
```

### Rolling Update

```bash
# 1. Build new image
make docker-build-query

# 2. Stop old container
docker-compose stop query-service

# 3. Start new container
docker-compose up -d query-service

# 4. Verify health
curl http://localhost:8081/health/ready
```

---

## Health Checks

### Service Endpoints

| Service | Health | Liveness | Readiness |
|---------|--------|----------|-----------|
| query-service | :8081/health | :8081/health/live | :8081/health/ready |
| alert-service | :8083/health | :8083/health/live | :8083/health/ready |
| risk-ml-service | :8082/health | :8082/health/live | :8082/health/ready |
| graph-service | :8084/actuator/health | :8084/actuator/health/liveness | :8084/actuator/health/readiness |
| orchestrator | :8080/actuator/health | :8080/actuator/health/liveness | :8080/actuator/health/readiness |
| bff | :3001/health | :3001/health/live | :3001/health/ready |

### Check All Services

```bash
for port in 8081 8082 8083 8084 8080 3001; do
  echo "Port $port: $(curl -s http://localhost:$port/health | jq -r .status)"
done
```

---

## Troubleshooting

### Container Won't Start

```bash
# Check logs
docker logs query-service --tail 100

# Check dependencies
docker-compose ps

# Verify network connectivity
docker exec query-service wget -qO- http://postgres:5432 || echo "Cannot reach postgres"
```

### Health Check Failing

```bash
# Check readiness probe details
curl -s http://localhost:8081/health/ready | jq

# Common issues:
# - Database not ready: Check postgres container
# - Redis unavailable: Check redis container
# - Kafka disconnected: Check kafka container
```

### Service Not Discoverable

```bash
# Check Nacos registration
curl -s "http://localhost:18848/nacos/v1/ns/instance/list?serviceName=query-service"

# Verify network membership
docker network inspect chainrisk-backend | jq '.[0].Containers'
```

---

## Resource Management

### Memory Limits

Services are configured with memory limits in docker-compose:

```yaml
deploy:
  resources:
    limits:
      memory: 512M
```

### Scaling

```bash
# Scale alert-service to 3 instances
docker-compose up -d --scale alert-service=3
```

---

## Monitoring

### Prometheus Targets

Access: http://localhost:19090/targets

Verify all services appear as "UP".

### Grafana Dashboards

Access: http://localhost:13001

- Admin: admin / admin123

### Jaeger Traces

Access: http://localhost:26686

Search by service name to view traces.

### Loki Logs

Access via Grafana → Explore → Loki

Query: `{container_name="query-service"}`
