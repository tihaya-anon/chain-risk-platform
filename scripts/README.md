# Scripts

Utility scripts for Chain Risk Platform.

## Directory Structure

```
scripts/
├── common.sh              # Shared functions (logging, env loading)
├── load-env.sh            # Environment variable loader
├── check-infra.sh         # Infrastructure health check
├── cleanup.sh             # Clean all data (Kafka, PostgreSQL, Neo4j, Hudi)
├── run-flink.sh           # Start Flink stream processor
├── run-batch-processor.sh # Run Spark batch jobs
├── trino-query.sh         # Execute Trino SQL queries
├── update-api-specs.sh    # Generate OpenAPI specs
├── test/                  # Integration test scripts
│   ├── run-integration-test.sh
│   ├── test-integration-phase1.sh
│   ├── test-integration-phase2.sh
│   └── test-integration-phase3.sh
└── archive/               # Archived/deprecated scripts
```

## Usage

Most scripts are invoked via Makefile:

```bash
# Infrastructure
make infra-check      # Check all services
make cleanup          # Clean all data (interactive)
make cleanup-all      # Clean all data (no prompt)

# Stream Processing
make flink-run        # Start Flink (tmux)
make flink-stop       # Stop Flink

# Batch Processing
make batch-archive    # PostgreSQL → Hudi
make batch-features   # Compute ML features
make batch-labels     # Ingest label data
make batch-training   # Prepare training dataset
make batch-neo4j      # Sync to Neo4j

# Testing
make test-integration         # Full test
make test-integration-phase1  # Ingestion → Kafka
make test-integration-phase2  # Flink → PostgreSQL
make test-integration-phase3  # Batch → Hudi + Neo4j

# Trino queries
make trino Q="SELECT COUNT(*) FROM hudi.datalake.transfers"
```

## Cleanup Script

Clean all test data:

```bash
# Interactive (asks for confirmation)
./scripts/cleanup.sh

# Clean specific targets
./scripts/cleanup.sh --kafka
./scripts/cleanup.sh --postgres
./scripts/cleanup.sh --neo4j
./scripts/cleanup.sh --hudi

# Dry run (show what would be cleaned)
./scripts/cleanup.sh --all --dry-run

# Skip confirmation
./scripts/cleanup.sh --all -y
```

Requirements:
- `kcat` for Kafka topic verification
- `psql` for PostgreSQL
- `cypher-shell` or `curl` for Neo4j
- `mc` (MinIO client) for Hudi/MinIO
