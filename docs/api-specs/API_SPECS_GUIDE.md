# API Specification Management

## Overview

```
docs/api-specs/
├── query-service.openapi.json      # Query Service (Go)
├── bff.openapi.json                # BFF (NestJS)
├── risk-ml-service.openapi.json    # Risk ML Service (FastAPI)
├── alert-service.openapi.json      # Alert Service (Go)
└── graph-service.openapi.json      # Graph Service (Spring Boot)
```

## Service Endpoints

| Service | Tech | Swagger UI | Port |
|---------|------|------------|------|
| Query Service | Go/Gin | :8081/swagger/index.html | 8081 |
| BFF | NestJS | :3001/docs | 3001 |
| Risk ML | FastAPI | :8082/docs | 8082 |
| Alert Service | Go/Gin | :8083/swagger/index.html | 8083 |
| Graph Service | Spring Boot | :8084/swagger-ui.html | 8084 |

## Update Commands

```bash
make api-update            # Update all services
make api-update-query      # Query Service
make api-update-bff        # BFF
make api-update-risk       # Risk ML Service
make api-update-alert      # Alert Service
make api-update-graph      # Graph Service
```

## Workflow

1. Modify API code with annotations
2. Start service and verify via Swagger UI
3. Run `make api-update-<service>`
4. Commit both code and spec changes

## Troubleshooting

```bash
# swag not found (Go services)
go install github.com/swaggo/swag/cmd/swag@latest

# Service not running
make <service>-run

# Port conflict
lsof -i :<port>
```

---

**Updated**: 2026-01-14
