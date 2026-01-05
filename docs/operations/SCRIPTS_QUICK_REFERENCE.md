# Scripts Quick Reference

## Common Commands

### Infrastructure
```bash
make infra-up          # Start infrastructure
make infra-down        # Stop infrastructure
make infra-check       # Check infrastructure status
```

### Services (Background)
```bash
make run-svc           # Start all services (background)
make logs-all          # View all logs
make logs-query        # View query service logs
make logs-risk         # View risk service logs
make stop-svc          # Stop all services
```

### Individual Services
```bash
# Start
make query-run         # Query Service
make risk-run          # Risk ML Service
make bff-run           # BFF Service
make graph-run         # Graph Engine
make flink-run         # Flink Processor

# Stop
make stop-query
make stop-risk
make stop-bff
make graph-stop
make flink-stop
```

### Batch Processing (Hudi)
```bash
make batch-build       # Build batch processor
make batch-archive     # Archive cold data (PostgreSQL → Hudi)
make batch-correct     # Run batch correction job
make batch-run         # Run full pipeline (archive + correct)
make batch-stop        # Stop batch processor
make batch-logs        # View batch logs
```

### Testing
```bash
make test-integration  # Integration test
make test-all          # All unit tests
./scripts/test-e2e.sh  # End-to-end test
```

### Build & Clean
```bash
make init-all          # Initialize all services
make build-all         # Build all services
make clean-all         # Clean all build artifacts
```

### API Documentation
```bash
make api-update        # Update all API specs
make api-update-query  # Update Query Service API
make api-update-bff    # Update BFF API
```

## Script Direct Calls

### Infrastructure Check
```bash
./scripts/check-infra.sh              # Local check
./scripts/check-infra.sh 192.168.1.100  # Remote check
```

### Service Startup
```bash
./scripts/run-graph-engine.sh         # Start Graph Engine
./scripts/run-graph-engine.sh --build # Force rebuild
./scripts/run-flink.sh                # Start Flink
```

### Batch Jobs
```bash
# Archive job
./scripts/run-archive-job.sh
RETENTION_DAYS=0 ./scripts/run-archive-job.sh  # Archive all

# Correction job
./scripts/run-batch-correction.sh
START_DATE=2026-01-01 END_DATE=2026-01-03 ./scripts/run-batch-correction.sh

# Query Hudi data
./scripts/trino-query.sh "SELECT count(*) FROM hudi.chainrisk.transfers"
./scripts/trino-query.sh "SELECT risk_category, count(*) FROM hudi.chainrisk.transfers GROUP BY risk_category"
```

### Testing
```bash
./scripts/run-integration-test.sh     # Integration test
./scripts/test-e2e.sh                 # E2E test
./scripts/test-e2e.sh --remote-ip     # Remote Docker test
```

### API Specs
```bash
./scripts/update-api-specs.sh --all   # Update all
./scripts/update-api-specs.sh --query # Update Query Service
```

## New Script Template

```bash
#!/bin/bash
# ============================================================
# Script Description
# ============================================================
# Usage: ./script.sh [options]
# ============================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

source "$SCRIPT_DIR/common.sh"
load_env "$PROJECT_ROOT" || exit 1

log_info "Starting process..."

# Your code here

log_success "Process completed"
```

## Common Utility Functions

```bash
source scripts/common.sh

# Logging
log_info "Information message"
log_success "Success message"
log_warn "Warning message"
log_error "Error message"
log_section "Section Title"

# Environment
load_env                              # Load .env.local
setup_java17                          # Set Java 17

# Utilities
command_exists mvn                    # Check command exists
check_port localhost 8080             # Check port
wait_for_service "API" "http://..."   # Wait for service
kill_by_pattern "my-service"          # Stop process

# Build
build_go_service "path" "binary"      # Build Go service
build_java_service "path"             # Build Java service
```

## Troubleshooting

### Service Won't Start
```bash
# 1. Check infrastructure
make infra-check

# 2. Check environment config
cat .env.local

# 3. View service logs
make logs-query
make logs-risk
make logs-bff
```

### Port In Use
```bash
# Check port usage
lsof -i :8081  # Query Service
lsof -i :8082  # Risk Service
lsof -i :3001  # BFF Service
lsof -i :8084  # Graph Engine

# Stop services
make stop-svc
```

### Clean Restart
```bash
# 1. Stop all services
make stop-svc
make infra-down

# 2. Clean build artifacts
make clean-all

# 3. Restart
make infra-up
make infra-check
make run-svc
```

## Environment Variables

Required in `.env.local`:

```bash
DOCKER_HOST_IP=192.168.1.100    # Docker host IP
ETHERSCAN_API_KEY=your-key      # Etherscan API Key (optional)
```

Auto-configured:

```bash
POSTGRES_HOST=$DOCKER_HOST_IP
POSTGRES_PORT=15432
REDIS_HOST=$DOCKER_HOST_IP
REDIS_PORT=16379
KAFKA_BROKERS=$DOCKER_HOST_IP:19092
NEO4J_URI=bolt://$DOCKER_HOST_IP:17687
MINIO_ENDPOINT=http://$DOCKER_HOST_IP:19000
HIVE_METASTORE_URI=thrift://$DOCKER_HOST_IP:19083
```

## Documentation Links

- 📖 [Full Scripts Guide](../../scripts/README.md)
- 📦 [Hudi Batch Layer](../development/HUDI_BATCH_LAYER.md)
- 📝 [Scripts Refactoring](./SCRIPTS_REFACTORING.md)
- 📋 [Changelog](../changelog/CHANGELOG_SCRIPTS.md)
- 📦 [Archived Scripts](../../scripts/archive/README.md)

## Quick Start

```bash
# 1. Configure environment
cp .env.example .env.local
# Edit .env.local

# 2. Start infrastructure
make infra-up && make infra-check

# 3. Initialize services
make init-all

# 4. Start services
make run-svc

# 5. View logs
make logs-all

# 6. Run tests
make test-integration

# 7. Stop services
make stop-svc
```

---

💡 **Tip**: Use `make help` to view all available commands
