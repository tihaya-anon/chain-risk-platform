# Integration Testing Environment

> Persistent integration testing environment with data generator and rolling cleanup.

## Overview

This document describes the integration testing strategy for Chain Risk Platform, enabling continuous backend logic testing, monitoring integration (Grafana, Jaeger), and E2E validation.

### Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                     Remote Infrastructure (Windows WSL)                     │
│                                                                             │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                    docker-compose services                           │   │
│  │                                                                      │   │
│  │  Message Queue:     Kafka (:19092), Zookeeper (:12181)              │   │
│  │  Databases:         PostgreSQL (:15432), Neo4j (:17687), Redis      │   │
│  │  Data Lake:         MinIO (:19000), Hive Metastore, Trino (:18081)  │   │
│  │  Service Discovery: Nacos (:18848)                                   │   │
│  │  Monitoring:        Prometheus (:19090), Grafana (:13001)           │   │
│  │  Tracing:           Jaeger (:26686)                                  │   │
│  │  UI Tools:          pgAdmin, RedisInsight, Kafka-UI                  │   │
│  │                                                                      │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                    │                                        │
└────────────────────────────────────┼────────────────────────────────────────┘
                                     │ Network
┌────────────────────────────────────┼────────────────────────────────────────┐
│                        Dev Machine (macOS)                                  │
│                                    │                                        │
│  ┌─────────────────────────────────▼─────────────────────────────────────┐  │
│  │                     Application Services                              │  │
│  │                                                                       │  │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  │  │
│  │  │Data Ingestion│  │Query Service│  │Risk Service │  │Alert Service│  │  │
│  │  │   (Go)      │  │    (Go)     │  │  (Python)   │  │    (Go)     │  │  │
│  │  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘  │  │
│  │                                                                       │  │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                   │  │
│  │  │Graph Service│  │Orchestrator │  │     BFF     │                   │  │
│  │  │   (Java)    │  │   (Java)    │  │ (TypeScript)│                   │  │
│  │  └─────────────┘  └─────────────┘  └─────────────┘                   │  │
│  │                                                                       │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Remote Infrastructure Connection

### Environment Setup

Create environment file for remote infrastructure:

```bash
# scripts/env-remote.sh
export REMOTE_HOST="${1:-192.168.1.100}"  # Your Windows WSL IP

# Kafka
export KAFKA_BROKERS="${REMOTE_HOST}:19092"

# Databases
export POSTGRES_HOST="${REMOTE_HOST}"
export POSTGRES_PORT="15432"
export POSTGRES_URL="jdbc:postgresql://${REMOTE_HOST}:15432/chainrisk"
export NEO4J_URI="bolt://${REMOTE_HOST}:17687"
export REDIS_HOST="${REMOTE_HOST}"
export REDIS_PORT="16379"

# Data Lake
export MINIO_ENDPOINT="http://${REMOTE_HOST}:19000"
export HIVE_METASTORE_URI="thrift://${REMOTE_HOST}:19083"
export TRINO_URL="http://${REMOTE_HOST}:18081"

# Service Discovery
export NACOS_SERVER="${REMOTE_HOST}:18848"

# Monitoring
export PROMETHEUS_URL="http://${REMOTE_HOST}:19090"
export GRAFANA_URL="http://${REMOTE_HOST}:13001"
export JAEGER_URL="http://${REMOTE_HOST}:26686"
```

### Usage

```bash
# Source environment
source scripts/env-remote.sh 192.168.1.100

# Verify connectivity
make infra-check-remote
```

## Port Reference

| Service | Port | URL |
|---------|------|-----|
| **Message Queue** |||
| Kafka | 19092 | `${REMOTE_HOST}:19092` |
| Zookeeper | 12181 | `${REMOTE_HOST}:12181` |
| Kafka UI | 18080 | `http://${REMOTE_HOST}:18080` |
| **Databases** |||
| PostgreSQL | 15432 | `${REMOTE_HOST}:15432` |
| Neo4j HTTP | 17474 | `http://${REMOTE_HOST}:17474` |
| Neo4j Bolt | 17687 | `bolt://${REMOTE_HOST}:17687` |
| Redis | 16379 | `${REMOTE_HOST}:16379` |
| **Data Lake** |||
| MinIO API | 19000 | `http://${REMOTE_HOST}:19000` |
| MinIO Console | 19001 | `http://${REMOTE_HOST}:19001` |
| Hive Metastore | 19083 | `thrift://${REMOTE_HOST}:19083` |
| Trino | 18081 | `http://${REMOTE_HOST}:18081` |
| **Service Discovery** |||
| Nacos | 18848 | `http://${REMOTE_HOST}:18848/nacos` |
| **Monitoring** |||
| Prometheus | 19090 | `http://${REMOTE_HOST}:19090` |
| Grafana | 13001 | `http://${REMOTE_HOST}:13001` |
| Jaeger | 26686 | `http://${REMOTE_HOST}:26686` |
| **UI Tools** |||
| pgAdmin | 15050 | `http://${REMOTE_HOST}:15050` |
| RedisInsight | 15540 | `http://${REMOTE_HOST}:15540` |

### Credentials

| Service | Username | Password |
|---------|----------|----------|
| PostgreSQL | chainrisk | chainrisk123 |
| Neo4j | neo4j | chainrisk123 |
| Grafana | admin | admin123 |
| MinIO | minioadmin | minioadmin123 |
| pgAdmin | admin@chainrisk.com | admin123 |

## Data Generator

### Overview

The Data Generator continuously produces realistic blockchain transaction data for testing.

```
┌─────────────────────────────────────────────────────────────────────┐
│                      Data Generator                                 │
├─────────────────────────────────────────────────────────────────────┤
│  Modes:                                                             │
│  ├── scenario: Play predefined test scenarios                       │
│  ├── random:   Generate random transactions                         │
│  └── hybrid:   Mix of scenarios and random data                     │
│                                                                     │
│  Scenarios:                                                         │
│  ├── normal_traffic     - Regular transactions                      │
│  ├── high_risk_cluster  - High-risk address cluster activity        │
│  ├── tornado_cash       - Mixing service patterns                   │
│  ├── whale_movement     - Large value transfers                     │
│  └── stress_test        - High throughput scenario                  │
└─────────────────────────────────────────────────────────────────────┘
```

### Configuration

```yaml
# data-ingestion/configs/generator.yaml
generator:
  mode: scenario          # scenario | random | hybrid
  speed_ratio: 1.0        # Playback speed (1.0 = realtime, 10.0 = 10x)
  
  scenarios:
    - name: normal_traffic
      weight: 70          # 70% normal transactions
      tps: 5              # 5 transactions per second
    - name: high_risk_cluster
      weight: 20
      tps: 2
    - name: whale_movement
      weight: 10
      tps: 0.5

  random:
    address_pool_size: 1000
    value_range:
      min: 0.001
      max: 1000.0
    risk_distribution:
      low: 0.7
      medium: 0.2
      high: 0.1
```

### Running Data Generator

```bash
# Start data generator in scenario mode
make run-generator MODE=scenario

# Start with specific scenarios
make run-generator SCENARIOS="normal_traffic,high_risk_cluster"

# High-speed mode for stress testing
make run-generator MODE=random SPEED=10
```

## Data Rolling Cleanup

### Strategy

| Storage | Strategy | Retention | Implementation |
|---------|----------|-----------|----------------|
| PostgreSQL | Time-based partition | 7 days | `pg_partman` + auto drop |
| Neo4j | TTL property + cron | 7 days | Cypher cleanup job |
| Redis | Native TTL | 1 day | Key expiration |
| Kafka | Log retention | 3 days | `retention.ms` |
| Hudi | Native clean | 30 days | Hudi cleaner |
| MinIO | Lifecycle policy | 30 days | Bucket lifecycle |

### PostgreSQL Partitioning

```sql
-- Enable pg_partman extension
CREATE EXTENSION IF NOT EXISTS pg_partman;

-- Create partitioned transfers table
CREATE TABLE transfers (
    id BIGSERIAL,
    tx_hash VARCHAR(66) NOT NULL,
    from_address VARCHAR(42) NOT NULL,
    to_address VARCHAR(42) NOT NULL,
    value NUMERIC(38, 18) NOT NULL,
    block_number BIGINT NOT NULL,
    block_timestamp TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) PARTITION BY RANGE (block_timestamp);

-- Setup automatic partitioning (daily, 7-day retention)
SELECT partman.create_parent(
    p_parent_table := 'public.transfers',
    p_control := 'block_timestamp',
    p_type := 'native',
    p_interval := 'daily',
    p_premake := 3
);

-- Configure retention
UPDATE partman.part_config 
SET retention = '7 days', retention_keep_table = false
WHERE parent_table = 'public.transfers';
```

### Neo4j Cleanup

```cypher
// Cleanup script (run via cron job)
// Delete nodes older than 7 days
CALL apoc.periodic.iterate(
  "MATCH (n) WHERE n.created_at < datetime() - duration('P7D') RETURN n",
  "DETACH DELETE n",
  {batchSize: 1000, parallel: false}
)
```

### Cleanup Cron Jobs

```bash
# infra/scripts/cleanup-cron.sh

# PostgreSQL partition maintenance (daily at 3 AM)
0 3 * * * psql -h $POSTGRES_HOST -U chainrisk -c "SELECT partman.run_maintenance();"

# Neo4j cleanup (daily at 4 AM)
0 4 * * * cypher-shell -a $NEO4J_URI -u neo4j -p chainrisk123 < /scripts/neo4j-cleanup.cypher

# Hudi compaction and clean (daily at 2 AM)
0 2 * * * spark-submit --class com.chainrisk.batch.HudiMaintenanceJob batch-processor.jar
```

## Monitoring Integration

### Prometheus Targets

All services export metrics to Prometheus:

```yaml
# infra/prometheus/prometheus.yml
scrape_configs:
  - job_name: 'kafka'
    static_configs:
      - targets: ['kafka-exporter:9308']
      
  - job_name: 'postgres'
    static_configs:
      - targets: ['postgres-exporter:9187']
      
  - job_name: 'query-service'
    static_configs:
      - targets: ['host.docker.internal:8081']
      
  - job_name: 'risk-service'
    static_configs:
      - targets: ['host.docker.internal:8082']
      
  - job_name: 'alert-service'
    static_configs:
      - targets: ['host.docker.internal:8083']
```

### Grafana Dashboards

Pre-configured dashboards:

| Dashboard | Description |
|-----------|-------------|
| Data Pipeline Overview | Kafka lag, throughput, error rates |
| Service Health | Service status, latency, error rates |
| Database Metrics | PostgreSQL, Neo4j, Redis stats |
| Alert System | Alert triggers, notification status |

### Jaeger Tracing

Services instrumented with OpenTelemetry:

```go
// Go services
import "go.opentelemetry.io/otel"

tracer := otel.Tracer("query-service")
ctx, span := tracer.Start(ctx, "GetAddress")
defer span.End()
```

```python
# Python services
from opentelemetry import trace

tracer = trace.get_tracer("risk-service")
with tracer.start_as_current_span("calculate_risk"):
    # ...
```

## Testing Workflows

### 1. Service Development Testing

```bash
# 1. Connect to remote infra
source scripts/env-remote.sh 192.168.1.100

# 2. Start data generator (low volume)
make run-generator MODE=scenario SPEED=0.1

# 3. Run your service locally
cd services/query-service && go run ./cmd/main.go

# 4. Verify in Grafana
open http://${REMOTE_HOST}:13001
```

### 2. Integration Testing

```bash
# 1. Start all services
make run-svc

# 2. Run data generator
make run-generator MODE=hybrid SPEED=1

# 3. Monitor pipeline
open http://${REMOTE_HOST}:13001/d/pipeline-overview

# 4. Check traces
open http://${REMOTE_HOST}:26686
```

### 3. E2E Testing

```bash
# 1. Run specific scenario
make run-generator SCENARIOS=high_risk_cluster SPEED=1

# 2. Verify alert triggers
curl http://localhost:8083/api/v1/alerts/history

# 3. Check graph updates
curl http://localhost:8084/api/v1/clusters

# 4. Validate risk scores
curl http://localhost:8082/api/v1/risk/address/0x...
```

### 4. Stress Testing

```bash
# High-throughput test
make run-generator MODE=stress SPEED=10

# Monitor system resources
open http://${REMOTE_HOST}:13001/d/system-resources

# Check Kafka lag
open http://${REMOTE_HOST}:18080
```

## Troubleshooting

### Cannot connect to remote infrastructure

```bash
# Check network connectivity
ping ${REMOTE_HOST}

# Test specific port
nc -zv ${REMOTE_HOST} 19092

# Check Docker network on WSL
wsl -d Ubuntu docker network ls
```

### Kafka connection issues

```bash
# Verify Kafka is accessible
kafkacat -b ${REMOTE_HOST}:19092 -L

# Check advertised listeners in docker-compose
# KAFKA_ADVERTISED_LISTENERS should include external IP
```

### Data not flowing through pipeline

```bash
# Check Kafka topics
kafka-topics.sh --list --bootstrap-server ${REMOTE_HOST}:19092

# Check consumer groups
kafka-consumer-groups.sh --list --bootstrap-server ${REMOTE_HOST}:19092

# View Kafka UI for message inspection
open http://${REMOTE_HOST}:18080
```

## References

- [Martin Fowler - Testing Strategies in Microservices](https://martinfowler.com/articles/microservice-testing/)
- [Google Cloud - Dataflow Testing Best Practices](https://cloud.google.com/dataflow/docs/guides/develop-and-test-pipelines)
- [Apache Flink - Testing Documentation](https://nightlies.apache.org/flink/flink-docs-master/docs/dev/configuration/testing/)
