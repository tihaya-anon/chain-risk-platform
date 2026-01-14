# Full Stack Smoke Test

Quick guide to start all services for smoke testing.

---

## Service Inventory

### Infrastructure (docker-compose)

| Service | Port |
|---------|------|
| PostgreSQL | 15432 |
| Neo4j | 17474/17687 |
| Kafka | 19092 |
| Redis | 16379 |
| Nacos | 18848 |
| Trino | 18081 |
| MinIO | 19000/19001 |
| Prometheus | 19090 |
| Grafana | 13001 |

### Application Services

| Service | Port | Tech | Start Command |
|---------|------|------|---------------|
| Query Service | 8081 | Go/Gin | `make query-run` |
| Risk Service | 8082 | Python/FastAPI | `make risk-run` |
| Alert Service | 8083 | Go/Gin | `make alert-run` |
| Graph Service | 8084 | Java/Spring | `make graph-run` |
| BFF | 3001 | TypeScript/NestJS | `make bff-run` |

### Processing

| Service | Tech | Start Command |
|---------|------|---------------|
| Stream Processor | Flink | `make flink-run` |
| Batch Processor | Spark | `make batch-archive` |
| Data Generator | Go | `make generator-run` |

---

## Quick Start

```bash
# 1. Check infrastructure
make infra-check

# 2. Build services
make build-all

# 3. Start services
make run-svc

# 4. Start Flink
make flink-run

# 5. Run generator (smoke test)
make generator-run TPS=5 DURATION=60
```

---

## Smoke Test Checklist

```bash
# Health checks
curl http://localhost:8081/health  # Query
curl http://localhost:8082/health  # Risk
curl http://localhost:8083/health  # Alert
curl http://localhost:8084/actuator/health  # Graph
curl http://localhost:3001/health  # BFF

# API test
curl http://localhost:3001/api/v1/addresses/0x0000000000000000000000000000000000000000
```

---

## Stop All

```bash
make stop-svc
make flink-stop
```
