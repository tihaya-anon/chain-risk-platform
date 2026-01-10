# Full Stack Smoke Test

Quick guide to start all services for smoke testing.

---

## Service Inventory

### Infrastructure (docker-compose)

| Service | Port | Status |
|---------|------|--------|
| PostgreSQL | 15432 | ✅ Running |
| Neo4j | 17474/17687 | ✅ Running |
| Kafka | 19092 | ✅ Running |
| Redis | 16379 | ✅ Running |
| Nacos | 18848 | ✅ Running |
| Trino | 18081 | ✅ Running |
| Hive Metastore | 19083 | ✅ Running |
| MinIO | 19000/19001 | ✅ Running |
| Prometheus | 19090 | ✅ Running |
| Grafana | 13001 | ✅ Running |

### Application Services

| Service | Port | Tech | Start Command |
|---------|------|------|---------------|
| Query Service | 8081 | Go/Gin | `make query-run` |
| Risk Service | 8082 | Python/FastAPI | `make risk-run` |
| Graph Service | 8084 | Java/Spring | `make graph-run` |
| Alert Service | 8085 | Go/Gin | `make alert-run` |
| BFF | 3001 | TypeScript/NestJS | `make bff-run` |
| Orchestrator | 8083 | Java/Spring | `make orchestrator-run` |

### Processing

| Service | Tech | Start Command |
|---------|------|---------------|
| Stream Processor | Flink | `make flink-run` |
| Batch Processor | Spark | `make batch-archive` / `make batch-correct` |
| Data Generator | Go | `make generator-run` |

---

## Quick Start

```bash
# 1. Ensure infrastructure is up
make infra-check

# 2. Build all services
make build-all

# 3. Start all application services
make run-svc

# 4. Start Flink stream processor
make flink-run

# 5. Run data generator (low TPS for smoke test)
make generator-run TPS=5 DURATION=60

# 6. Check logs
make logs-all
```

---

## Smoke Test Checklist

```bash
# Health checks
curl http://localhost:8081/health  # Query
curl http://localhost:8082/health  # Risk
curl http://localhost:8084/actuator/health  # Graph
curl http://localhost:8085/health  # Alert
curl http://localhost:3001/health  # BFF

# API smoke test
curl http://localhost:3001/api/addresses/0x0000000000000000000000000000000000000000
curl http://localhost:3001/api/alerts/rules
```

---

## Stop All

```bash
make stop-svc
make flink-stop
```
