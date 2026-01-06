# API Specification Management

## Overview

All API specifications are stored in `docs/api-specs/`:

```
docs/api-specs/
├── query-service.openapi.json      # Query Service (Go)
├── bff.openapi.json                # BFF (NestJS)
├── risk-ml-service.openapi.json    # Risk ML Service (FastAPI)
├── orchestrator.openapi.json       # Orchestrator (Spring Boot)
└── graph-service.openapi.json      # Graph Service (Spring Boot)
```

## Generation Methods

| Service | Tech Stack | Command | Swagger UI |
|---------|------------|---------|------------|
| Query Service | Go/swag | `swag init` | :8081/swagger |
| BFF | NestJS | `curl :3001/docs-json` | :3001/docs |
| Risk ML | FastAPI | `curl :8082/openapi.json` | :8082/docs |
| Orchestrator | Spring Boot | `curl :8080/v3/api-docs` | :8080/swagger-ui.html |
| Graph Service | Spring Boot | `curl :8084/v3/api-docs` | :8084/swagger-ui.html |

## Update Commands

```bash
# Update all services
make api-update

# Update individual service
make api-update-query
make api-update-bff
make api-update-risk
make api-update-orch
make api-update-graph

# Using script directly
./scripts/update-api-specs.sh --all
./scripts/update-api-specs.sh --graph
```

## Workflow

1. Modify API code with annotations
2. Start service and verify via Swagger UI
3. Run `make api-update-<service>`
4. Commit both code and spec changes

## Validation

```bash
# Using OpenAPI CLI
npm install -g @redocly/cli
redocly lint docs/api-specs/query-service.openapi.json
```

## Troubleshooting

**Service not running**: Start with `make <service>-run`

**Port conflict**: Check with `lsof -i :<port>`

**swag not found**: `go install github.com/swaggo/swag/cmd/swag@latest`
