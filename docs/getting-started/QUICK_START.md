# Quick Start Guide

## Prerequisites

| Tool | Version | Check |
|------|---------|-------|
| Go | 1.21+ | `go version` |
| Java | 17+ | `java -version` |
| Python | 3.11+ | `python3 --version` |
| Node.js | 18+ | `node --version` |
| Docker | 24+ | `docker --version` |
| Make | any | `make --version` |

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│              Remote Server (Windows WSL / Linux)            │
│                                                             │
│   Docker Compose Services:                                  │
│   - Kafka, PostgreSQL, Neo4j, Redis, MinIO                 │
│   - Prometheus, Grafana, Jaeger, Loki                      │
│   - Nacos, Airflow, Flink                                  │
│                                                             │
└─────────────────────────────────┬───────────────────────────┘
                                  │ Network (SSH / Ports)
┌─────────────────────────────────▼───────────────────────────┐
│                   Local Machine (macOS)                     │
│                                                             │
│   Application Services (run locally for development):       │
│   - query-service, risk-ml-service, alert-service          │
│   - graph-service, orchestrator, bff                       │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## Setup Steps

### 1. Clone Repository

```bash
git clone <repo-url>
cd chain-risk-platform
```

### 2. Configure Remote Infrastructure

Create `.env.local` with your remote server IP:

```bash
echo "DOCKER_HOST_IP=192.168.x.x" > .env.local
```

### 3. SSH Config (Recommended)

Add to `~/.ssh/config`:

```
Host dev-win
    HostName 192.168.x.x
    User your-username
    IdentityFile ~/.ssh/id_rsa
```

### 4. Verify Connectivity

```bash
# Load environment variables
source scripts/load-env.sh

# Check all infrastructure services
make infra-check
```

Expected output:
```
Checking infrastructure connectivity...
✓ Kafka (19092)
✓ PostgreSQL (15432)
✓ Neo4j (17687)
✓ Redis (16379)
✓ Nacos (18848)
...
All checks passed!
```

### 5. Run Your First Service

```bash
# Terminal 1: Run query-service
make query-run

# Terminal 2: Test the API
curl http://localhost:8081/health
```

## Service Commands

| Service | Run | Build | Test |
|---------|-----|-------|------|
| query-service | `make query-run` | `make query-build` | `make query-test` |
| risk-ml-service | `make risk-run` | - | `make risk-test` |
| alert-service | `make alert-run` | `make alert-build` | `make alert-test` |
| graph-service | `make graph-run` | `make graph-build` | `make graph-test` |
| orchestrator | `make orch-run` | `make orch-build` | - |
| bff | `make bff-run` | `make bff-build` | - |

## Common Tasks

### View Logs

```bash
# Service logs (local)
make logs-query
make logs-risk

# Infrastructure logs (remote)
ssh dev-win "cd ~/chain-risk-platform && docker logs kafka"
```

### Access UIs

| UI | URL | Credentials |
|----|-----|-------------|
| Grafana | `http://<remote>:13001` | admin / admin123 |
| Jaeger | `http://<remote>:26686` | - |
| Kafka UI | `http://<remote>:18080` | - |
| Nacos | `http://<remote>:18848/nacos` | nacos / nacos |
| Airflow | `http://<remote>:18088` | admin / admin |

### Run Tests

```bash
# Unit tests
make test-unit

# Integration tests (requires remote infra)
make test-integration

# E2E tests
make test-e2e
```

## Troubleshooting

### Cannot connect to remote services

```bash
# Check SSH connection
ssh dev-win "echo OK"

# Check specific port
nc -zv $DOCKER_HOST_IP 19092

# Verify environment loaded
echo $KAFKA_BROKERS
```

### Service fails to start

```bash
# Check if port is in use
lsof -i :8081

# Check Nacos registration
curl "http://$DOCKER_HOST_IP:18848/nacos/v1/ns/instance/list?serviceName=query-service"
```

## Next Steps

1. Read [Development Workflow](./DEVELOPMENT_WORKFLOW.md) for daily dev process
2. Read [Project Overview](../architecture/overview/PROJECT_OVERVIEW.md) for system design
3. Check [Development Plan](../development/plans/DEVELOPMENT_PLAN.md) for current tasks
