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

### Configuration

**Method 1: Using `.env.local`**

```bash
# .env.local
DOCKER_HOST_IP=192.168.1.100
```

**Method 2: Command line argument**

```bash
source scripts/load-env.sh 192.168.1.100
```

### Usage

```bash
# Load environment (reads from .env.local or argument)
source scripts/load-env.sh

# Or specify IP directly
source scripts/load-env.sh 192.168.1.100

# Verify connectivity
make infra-check
```

### Environment Variables

`scripts/load-env.sh` exports all necessary variables:

| Category | Variables |
|----------|-----------|
| **Kafka** | `KAFKA_BROKERS` |
| **PostgreSQL** | `POSTGRES_HOST`, `POSTGRES_PORT`, `POSTGRES_USER`, `POSTGRES_PASSWORD` |
| **Neo4j** | `NEO4J_URI`, `NEO4J_USER`, `NEO4J_PASSWORD` |
| **Redis** | `REDIS_HOST`, `REDIS_PORT` |
| **MinIO** | `MINIO_ENDPOINT`, `MINIO_ACCESS_KEY`, `MINIO_SECRET_KEY` |
| **Hive** | `HIVE_METASTORE_URI` |
| **Trino** | `TRINO_HOST`, `TRINO_PORT` |
| **Nacos** | `NACOS_SERVER` |
| **Jaeger** | `JAEGER_AGENT_HOST`, `JAEGER_ENDPOINT` |

## Port Reference

| Service | Port | URL |
|---------|------|-----|
| **Message Queue** |||
| Kafka | 19092 | `${DOCKER_HOST_IP}:19092` |
| Zookeeper | 12181 | `${DOCKER_HOST_IP}:12181` |
| Kafka UI | 18080 | `http://${DOCKER_HOST_IP}:18080` |
| **Databases** |||
| PostgreSQL | 15432 | `${DOCKER_HOST_IP}:15432` |
| Neo4j HTTP | 17474 | `http://${DOCKER_HOST_IP}:17474` |
| Neo4j Bolt | 17687 | `bolt://${DOCKER_HOST_IP}:17687` |
| Redis | 16379 | `${DOCKER_HOST_IP}:16379` |
| **Data Lake** |||
| MinIO API | 19000 | `http://${DOCKER_HOST_IP}:19000` |
| MinIO Console | 19001 | `http://${DOCKER_HOST_IP}:19001` |
| Hive Metastore | 19083 | `thrift://${DOCKER_HOST_IP}:19083` |
| Trino | 18081 | `http://${DOCKER_HOST_IP}:18081` |
| **Service Discovery** |||
| Nacos | 18848 | `http://${DOCKER_HOST_IP}:18848/nacos` |
| **Monitoring** |||
| Prometheus | 19090 | `http://${DOCKER_HOST_IP}:19090` |
| Grafana | 13001 | `http://${DOCKER_HOST_IP}:13001` |
| Jaeger | 26686 | `http://${DOCKER_HOST_IP}:26686` |
| **UI Tools** |||
| pgAdmin | 15050 | `http://${DOCKER_HOST_IP}:15050` |
| RedisInsight | 15540 | `http://${DOCKER_HOST_IP}:15540` |

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
# PostgreSQL partition maintenance (daily at 3 AM)
0 3 * * * psql -h $POSTGRES_HOST -U chainrisk -c "SELECT partman.run_maintenance();"

# Neo4j cleanup (daily at 4 AM)
0 4 * * * cypher-shell -a $NEO4J_URI -u neo4j -p chainrisk123 < /scripts/neo4j-cleanup.cypher

# Hudi compaction and clean (daily at 2 AM)
0 2 * * * make batch-archive
```

## Monitoring Integration

### Prometheus Targets

All services export metrics to Prometheus. Configuration in `infra/prometheus/prometheus.yml`.

### Grafana Dashboards

Pre-configured dashboards in `infra/grafana/provisioning/dashboards/`:

| Dashboard | Description |
|-----------|-------------|
| Data Pipeline Overview | Kafka lag, throughput, error rates |
| Service Health | Service status, latency, error rates |
| Database Metrics | PostgreSQL, Neo4j, Redis stats |

### Jaeger Tracing

Access Jaeger UI at `http://${DOCKER_HOST_IP}:26686` to trace requests across services.

## Testing Workflows

### 1. Service Development Testing

```bash
# 1. Configure remote infrastructure
echo "DOCKER_HOST_IP=192.168.1.100" > .env.local

# 2. Verify connectivity
make infra-check

# 3. Run your service locally
make query-run   # or risk-run, alert-run, etc.

# 4. Check Grafana
open http://192.168.1.100:13001
```

### 2. Integration Testing

```bash
# Run full integration test
make test-integration

# Or run specific phases
make test-integration-phase1  # Ingestion → Kafka
make test-integration-phase2  # Flink → PostgreSQL
make test-integration-phase3  # Batch → Hudi + Neo4j
```

### 3. Full Pipeline Testing

```bash
# 1. Start all services
make run-svc

# 2. Start Flink processor
make flink-run

# 3. Start data ingestion
make ingestion-run

# 4. Monitor pipeline in Grafana
open http://${DOCKER_HOST_IP}:13001/d/pipeline-overview

# 5. Check traces in Jaeger
open http://${DOCKER_HOST_IP}:26686
```

### 4. Cleanup Testing Environment

```bash
# Clean all data (Kafka, PostgreSQL, Neo4j, Hudi)
make cleanup

# Force clean without confirmation
make cleanup-all
```

## Troubleshooting

### Cannot connect to remote infrastructure

```bash
# Check network connectivity
ping ${DOCKER_HOST_IP}

# Test specific port
nc -zv ${DOCKER_HOST_IP} 19092

# Verify environment loaded
echo $KAFKA_BROKERS
```

### Kafka connection issues

```bash
# Verify Kafka is accessible
kafkacat -b ${DOCKER_HOST_IP}:19092 -L

# Check advertised listeners in docker-compose
# KAFKA_ADVERTISED_LISTENERS should include external IP
```

### Data not flowing through pipeline

```bash
# Check Kafka UI for topics and messages
open http://${DOCKER_HOST_IP}:18080

# View service logs
make logs-all

# Check Flink job status
make flink-logs
```

## References

- [Martin Fowler - Testing Strategies in Microservices](https://martinfowler.com/articles/microservice-testing/)
- [Google Cloud - Dataflow Testing Best Practices](https://cloud.google.com/dataflow/docs/guides/develop-and-test-pipelines)
- [Apache Flink - Testing Documentation](https://nightlies.apache.org/flink/flink-docs-master/docs/dev/configuration/testing/)
