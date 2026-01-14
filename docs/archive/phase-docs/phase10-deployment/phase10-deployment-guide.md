# Phase 10: Production Hardening - Deployment Guide

## Overview

This document records all deployment operations performed during Phase 10 containerization work.

## Environment

- **Remote Machine**: Windows with WSL2 (Ubuntu 24.04)
  - CPU: 14-core i7-13620H
  - RAM: 20GB
  - Docker Desktop for Windows

- **Directory**: `~/chain-risk-platform`
- **Branch**: `develop/phase10`

---

## 1. Infrastructure Setup

### 1.1 Start Core Infrastructure

```bash
cd ~/chain-risk-platform
make infra-up
```

Services started: zookeeper, kafka, postgres, neo4j, redis, nacos

### 1.2 Start Data Lake

```bash
make datalake-up
```

Services started: minio, hive-metastore, trino

### 1.3 Start Monitoring Stack

```bash
make monitoring-up
```

Services started: prometheus, grafana, loki, elasticsearch, jaeger

### 1.4 Start Security (Vault)

```bash
make security-up
```

---

## 2. Vault Initialization

Vault requires manual initialization after first start.

### 2.1 Fix Data Directory Permissions

```bash
docker exec -u root vault chown -R vault:vault /vault/data
```

### 2.2 Initialize Vault

```bash
docker exec vault vault operator init -key-shares=1 -key-threshold=1 -format=json
```

**Output (SAVE THESE SECURELY):**
```json
{
  "unseal_keys_b64": ["<UNSEAL_KEY>"],
  "root_token": "<ROOT_TOKEN>"
}
```

> ⚠️ **IMPORTANT**: Store the unseal key and root token securely. They are required to unseal Vault after restart.

### 2.3 Unseal Vault

```bash
docker exec vault vault operator unseal <UNSEAL_KEY>
```

### 2.4 Verify Status

```bash
docker exec vault vault status
```

Expected: `Sealed: false`

---

## 3. Network Configuration

The infrastructure and application services run in separate Docker Compose projects, requiring manual network bridging.

### 3.1 Connect Infrastructure to Backend Network

```bash
docker network connect chainrisk-backend postgres
docker network connect chainrisk-backend redis
docker network connect chainrisk-backend kafka
docker network connect chainrisk-backend neo4j
docker network connect chainrisk-backend nacos
```

This allows application services to reach infrastructure containers by hostname.

---

## 4. Build Docker Images

### 4.1 Build All Service Images

```bash
make docker-build-query
make docker-build-alert
make docker-build-risk
make docker-build-graph
make docker-build-bff
```

Or build all at once:
```bash
make docker-build-all
```

### 4.2 Verify Images

```bash
docker images | grep chainrisk
```

Expected output:
```
chainrisk/bff               latest   338MB
chainrisk/graph-service     latest   240MB
chainrisk/risk-ml-service   latest   283MB
chainrisk/alert-service     latest   39MB
chainrisk/query-service     latest   49MB
```

---

## 5. Start Application Services

### 5.1 Use Standalone Compose File

```bash
docker-compose -f infra/compose/services-standalone.yml up -d
```

This file:
- Uses pre-built images (no build step)
- References external networks (`chainrisk-backend`, `chainrisk-frontend`)
- Mounts Docker-specific config files for Go services
- Sets environment variables for Java/Python services

### 5.2 Verify All Services

```bash
docker ps --format 'table {{.Names}}\t{{.Status}}'
```

Expected (all healthy):
```
query-service       Up X minutes (healthy)
alert-service       Up X minutes (healthy)
risk-ml-service     Up X minutes (healthy)
graph-service       Up X minutes (healthy)
bff                 Up X minutes (healthy)
```

---

## 6. Service Ports

| Service | Internal Port | External Port | Protocol |
|---------|---------------|---------------|----------|
| query-service | 8081 | 8081 | HTTP |
| risk-ml-service | 8082 | 8082 | HTTP |
| alert-service | 8083 | 8083 | HTTP |
| graph-service | 8084 | 8084 | HTTP |
| bff | 3001 | 3001 | HTTP/WS |

Infrastructure ports:
| Service | Port |
|---------|------|
| Nacos | 18848 |
| Kafka | 19092 |
| PostgreSQL | 15432 |
| Neo4j | 17687 (Bolt), 17474 (HTTP) |
| Redis | 16379 |
| Vault | 18200 |
| Prometheus | 19090 |
| Grafana | 13001 |
| Jaeger | 26686 |
| Elasticsearch | 19200 |

---

## 7. Health Check Endpoints

```bash
# BFF
curl http://localhost:3001/health

# Query Service
curl http://localhost:8081/health

# Risk ML Service
curl http://localhost:8082/health

# Alert Service
curl http://localhost:8083/health

# Graph Service
curl http://localhost:8084/actuator/health
```

---

## 8. Nacos Service Registry

Check registered services:
```bash
curl 'http://localhost:18848/nacos/v1/ns/service/list?pageNo=1&pageSize=20'
```

### Registered Services

| Service | Language | Nacos Registration |
|---------|----------|-------------------|
| graph-service | Java/Spring | ✅ Auto (Spring Cloud) |
| bff | TypeScript | ✅ `nacos.service.ts` |
| query-service | Go | ✅ `internal/nacos/` |
| alert-service | Go | ✅ `internal/nacos/` |
| risk-ml-service | Python | ✅ `app/core/nacos.py` |

**Environment Variables** (required for Nacos registration):
```bash
NACOS_SERVER=nacos:8848
SERVICE_IP=<container_ip>  # optional, defaults to 127.0.0.1
NACOS_NAMESPACE=           # optional
NACOS_USERNAME=            # optional
NACOS_PASSWORD=            # optional
```

---

## 9. Troubleshooting

### 9.1 Service Cannot Connect to Database

Ensure infrastructure containers are in the backend network:
```bash
docker network inspect chainrisk-backend
```

If missing, reconnect:
```bash
docker network connect chainrisk-backend postgres
```

### 9.2 Vault Shows Unhealthy

Vault may be sealed after restart. Unseal it:
```bash
docker exec vault vault operator unseal <UNSEAL_KEY>
```

### 9.3 Service Logs

```bash
docker logs <service-name> -f --tail 100
```

### 9.4 Restart Single Service

```bash
docker-compose -f infra/compose/services-standalone.yml restart <service-name>
```

---

## 10. Shutdown

### Stop Application Services Only
```bash
docker-compose -f infra/compose/services-standalone.yml down
```

### Stop Everything
```bash
make down-all
```

---

## Appendix: Key Fixes Applied

| Issue | Fix | Commit |
|-------|-----|--------|
| Go version 1.25.5 invalid | Changed to 1.23 | c6d99bf |
| go.mod needs tidy | Added `go mod tidy` in Dockerfile | 88dd403 |
| Python missing README.md | Added README.md, fixed .dockerignore | 3cae196, 0f12516 |
| BFF uid 1000 conflict | Use built-in `node` user | b6c496c |
| Logs directory permission | Create /app/logs in all Dockerfiles | c10203f |
| Go config field mismatch | Use `dbname` not `database` | 17ba7c1 |
| Java env var name | NACOS_SERVER not NACOS_SERVER_ADDR | d33acf0 |
| Java Redis connection | Add REDIS_HOST env var | 7acbffb |
| BFF circular dependency | Lazy load logger in config/vault | c982187 |
| Jaeger ES 8.x incompatible | Upgrade Jaeger 1.50 → 1.53 | 156c095 |
