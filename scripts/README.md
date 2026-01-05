# Scripts Directory

This directory contains various script tools for the Chain Risk Platform project.

## Directory Structure

```
scripts/
├── common.sh               # Common utility functions (recommended)
├── load-env.sh             # Environment variable loading
├── check-infra.sh          # Infrastructure health check
├── run-graph-engine.sh     # Graph Engine startup
├── run-flink.sh            # Flink Stream Processor startup
├── run-archive-job.sh      # Batch archive job (PostgreSQL → Hudi)
├── run-batch-correction.sh # Batch correction job (Hudi)
├── trino-query.sh          # Query Hudi via Trino
├── run-integration-test.sh # Integration test
├── test-integration-phase1.sh # Phase 1 integration test
├── test-integration-phase2.sh # Phase 2 integration test
├── test-integration-phase3.sh # Phase 3 integration test
├── test-e2e.sh             # End-to-end test
├── update-api-specs.sh     # API specification update
└── archive/                # Archived one-time scripts
    ├── init-project.sh     # Project initialization (first use only)
    ├── setup-hosts.sh      # Host mapping setup (optional)
    └── sparse-clone.sh     # Sparse clone (deployment)
```

## Core Scripts

### common.sh - Common Utility Library

Provides reusable utility functions:

- **Logging**: `log_info`, `log_success`, `log_warn`, `log_error`, `log_section`
- **Environment**: `load_env` - Load environment from .env.local
- **Java Setup**: `setup_java17` - Configure Java 17 environment
- **Utilities**: `command_exists`, `check_port`, `wait_for_service`
- **Process Management**: `kill_by_pattern` - Stop processes by pattern
- **Build Functions**: `build_go_service`, `build_java_service`

**Usage**:
```bash
#!/bin/bash
source scripts/common.sh

load_env || exit 1
log_info "Starting service..."
```

### check-infra.sh - Infrastructure Health Check

Check all Docker infrastructure service health.

**Usage**:
```bash
# Local check
./scripts/check-infra.sh

# Remote check
./scripts/check-infra.sh 192.168.1.100
```

**Checked services**:
- PostgreSQL (15432)
- Redis (16379)
- Kafka (19092)
- Neo4j (17474)
- Nacos (18848)
- MinIO (19000)
- Trino (18081)
- Prometheus (19090)
- Grafana (13001)
- Jaeger (26686)

### run-graph-engine.sh - Graph Engine Startup

Start Graph Engine service (Java Spring Boot).

```bash
./scripts/run-graph-engine.sh
./scripts/run-graph-engine.sh --build  # Force rebuild
```

**Or use Makefile**:
```bash
make graph-run
```

### run-flink.sh - Flink Stream Processor

Start Flink stream processor.

```bash
./scripts/run-flink.sh
```

**Or use Makefile**:
```bash
make flink-run
```

### run-archive-job.sh - Archive Job

Archive cold data from PostgreSQL to Hudi data lake.

```bash
# Archive data older than RETENTION_DAYS (default: 7)
./scripts/run-archive-job.sh

# Archive all data (for testing)
RETENTION_DAYS=0 ./scripts/run-archive-job.sh
```

**Or use Makefile**:
```bash
make batch-archive
```

### run-batch-correction.sh - Batch Correction Job

Apply risk scoring and corrections to Hudi data.

```bash
# Correct all data
./scripts/run-batch-correction.sh

# Correct specific date range
START_DATE=2026-01-01 END_DATE=2026-01-03 ./scripts/run-batch-correction.sh
```

**Or use Makefile**:
```bash
make batch-correct
```

### trino-query.sh - Trino Query

Query Hudi data via Trino SQL engine.

```bash
# Count records
./scripts/trino-query.sh "SELECT count(*) FROM hudi.chainrisk.transfers"

# Risk distribution
./scripts/trino-query.sh "SELECT risk_category, count(*) FROM hudi.chainrisk.transfers GROUP BY risk_category"
```

### run-integration-test.sh - Integration Test

Run complete data pipeline integration test:
1. Start Mock Etherscan Server
2. Run data ingestion
3. Run stream processing
4. Validate database results

```bash
./scripts/run-integration-test.sh
```

**Or use Makefile**:
```bash
make test-integration
```

### test-e2e.sh - End-to-End Test

Test infrastructure and data flow end-to-end.

```bash
# Local Docker
./scripts/test-e2e.sh

# Remote Docker
./scripts/test-e2e.sh --remote user@host

# Skip processor check
./scripts/test-e2e.sh --skip-processor
```

### update-api-specs.sh - API Specification Update

Fetch OpenAPI specs from running services and save to `docs/api-specs/`.

```bash
./scripts/update-api-specs.sh --all
./scripts/update-api-specs.sh --query --bff
```

**Or use Makefile**:
```bash
make api-update
make api-update-query
```

## Archived Scripts

Moved to `archive/` as they are one-time use or rarely used.

### init-project.sh
Initialize project directory structure. First-time use only.

### setup-hosts.sh
Configure /etc/hosts mapping for development.

### sparse-clone.sh
Sparse clone repository. For Docker deployment.

## Recommended Workflow

### 1. First-time Setup
```bash
# 1. Create environment config
cp .env.example .env.local
# Edit .env.local to set DOCKER_HOST_IP

# 2. Start infrastructure
make infra-up

# 3. Check infrastructure
make infra-check

# 4. Initialize all services
make init-all
```

### 2. Daily Development
```bash
# Start all backend services (background)
make run-svc

# View logs
make logs-all

# Stop all services
make stop-svc
```

### 3. Batch Processing
```bash
# Build batch processor
make batch-build

# Run archive job
make batch-archive

# Run correction job
make batch-correct

# Run full pipeline
make batch-run
```

### 4. Testing
```bash
# Integration test
make test-integration

# E2E test
./scripts/test-e2e.sh
```

## Writing New Scripts - Best Practices

1. **Use common.sh**
   ```bash
   #!/bin/bash
   source "$(dirname "$0")/common.sh"
   load_env || exit 1
   ```

2. **Add help information**
   ```bash
   # Usage: ./script.sh [options]
   ```

3. **Error handling**
   ```bash
   set -e  # Exit on error
   ```

4. **Logging**
   ```bash
   log_info "Starting process..."
   log_success "Process completed"
   log_error "Error occurred"
   ```

5. **Cleanup**
   ```bash
   cleanup() {
       log_info "Cleaning up..."
   }
   trap cleanup EXIT
   ```

## Related Documentation

- [Makefile Usage](../README.md)
- [Scripts Quick Reference](../docs/operations/SCRIPTS_QUICK_REFERENCE.md)
- [Hudi Batch Layer](../docs/development/HUDI_BATCH_LAYER.md)

## FAQ

### Q: Why use common.sh?
A: Provides unified utility functions, avoiding code duplication.

### Q: How to stop background services?
A: Use `make stop-svc` or specific commands like `make stop-query`.

### Q: Why are some scripts in archive?
A: One-time or rarely used scripts, keeping main directory clean.
