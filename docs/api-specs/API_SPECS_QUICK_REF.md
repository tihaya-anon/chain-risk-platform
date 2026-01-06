# API Specification Quick Reference

## Quick Commands

```bash
make api-update            # Update all services
make api-update-query      # Query Service
make api-update-bff        # BFF
make api-update-risk       # Risk ML Service
make api-update-orch       # Orchestrator
make api-update-graph      # Graph Service
```

## Service Endpoints

| Service | Swagger UI | Port |
|---------|-----------|------|
| Query Service | :8081/swagger/index.html | 8081 |
| BFF | :3001/docs | 3001 |
| Risk ML | :8082/docs | 8082 |
| Orchestrator | :8080/swagger-ui.html | 8080 |
| Graph Service | :8084/swagger-ui.html | 8084 |

## Generated Files

```
docs/api-specs/
├── query-service.openapi.json
├── bff.openapi.json
├── risk-ml-service.openapi.json
├── orchestrator.openapi.json
└── graph-service.openapi.json
```

## Troubleshooting

```bash
# swag not found
go install github.com/swaggo/swag/cmd/swag@latest

# Service not running
make <service>-run

# Port conflict
lsof -i :<port>
```

See [API_SPECS_GUIDE.md](./API_SPECS_GUIDE.md) for details.
