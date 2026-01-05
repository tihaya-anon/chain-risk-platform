# ML Feature Pipeline Development Plan

> Phase 1: Feature Computation | Phase 2: Label Data Ingestion

**Date**: 2026-01-05  
**Status**: Planning

---

## Overview

Build the ML feature pipeline with data stored in Hudi:

- **Phase 1**: Compute address features from transfers → `address_features` table
- **Phase 2**: Ingest label data from public APIs → `address_labels` table
- **Integration**: Join features + labels → `training_dataset` table

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        Batch Processing Layer (Spark)                   │
│                                                                         │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │ Phase 1: Feature Computation                                      │  │
│  │                                                                   │  │
│  │   Hudi transfers ──▶ FeatureComputeJob ──▶ Hudi address_features │  │
│  └───────────────────────────────────────────────────────────────────┘  │
│                                                                         │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │ Phase 2: Label Ingestion                                          │  │
│  │                                                                   │  │
│  │   Public APIs ──▶ LabelIngestionJob ──▶ Hudi address_labels      │  │
│  │   - OFAC SDN List                                                 │  │
│  │   - Tornado Cash addresses                                        │  │
│  │   - Known exchange addresses                                      │  │
│  └───────────────────────────────────────────────────────────────────┘  │
│                                                                         │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │ Integration: Training Data Preparation                            │  │
│  │                                                                   │  │
│  │   address_features + address_labels ──▶ training_dataset          │  │
│  └───────────────────────────────────────────────────────────────────┘  │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                        ML Training (Python)                             │
│                                                                         │
│   Trino ──▶ training_dataset ──▶ XGBoost / IsolationForest ──▶ MinIO  │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Test Data

Located at `tests/integration/fixtures/ethereum/`:

| Data | Count |
|------|-------|
| Blocks | 3 (24154086-24154088) |
| Transactions | 856 |
| Unique Addresses | ~700 |

Real Ethereum mainnet data from Etherscan API.

---

## Development Environment

| Environment | Python | Usage |
|-------------|--------|-------|
| Local (macOS) | 3.9 + uv | Code editing, Git operations |
| Remote (WSL2) | 3.12 + uv | Execution, testing |

```bash
# Sync code to remote
git push && ssh dev-win "cd /home/smsmu/chain-risk-platform && git pull"

# Remote execution
ssh dev-win "cd /home/smsmu/chain-risk-platform && uv run ..."
```

---

## Phase 1: Feature Computation

### 1.1 Hudi Table: `address_features`

```sql
CREATE TABLE address_features (
    address VARCHAR(42),
    network VARCHAR(20),
    
    -- Transaction stats
    tx_count BIGINT,
    sent_count BIGINT,
    received_count BIGINT,
    unique_counterparties BIGINT,
    avg_tx_value DOUBLE,
    max_tx_value DOUBLE,
    tx_value_stddev DOUBLE,
    address_age_days INT,
    
    -- Ratios
    sent_ratio DOUBLE,
    round_amount_ratio DOUBLE,
    small_tx_ratio DOUBLE,
    large_tx_ratio DOUBLE,
    
    -- Graph features (from transfers, not Neo4j for V1)
    in_degree BIGINT,
    out_degree BIGINT,
    in_out_ratio DOUBLE,
    unique_in_neighbors BIGINT,
    
    -- Metadata
    computed_at TIMESTAMP,
    feature_version VARCHAR(10),
    
    PRIMARY KEY (address, network)
)
PARTITIONED BY (network)
```

### 1.2 FeatureComputeJob

**Location**: `processing/batch-processor/src/main/java/com/chainrisk/batch/job/FeatureComputeJob.java`

**Logic**:
1. Read from Hudi `transfers`
2. Aggregate by address (SQL window functions)
3. Compute 16 V1 features
4. Upsert to `address_features`

### 1.3 Tasks

| # | Task | Output |
|---|------|--------|
| 1.1 | Hudi table DDL | `infra/init-scripts/hudi/create-address-features.sql` |
| 1.2 | FeatureComputeJob | `FeatureComputeJob.java` |
| 1.3 | Run script | `scripts/run-feature-compute.sh` |
| 1.4 | Test | Query via Trino |

---

## Phase 2: Label Data Ingestion

### 2.1 Free Data Sources

| Source | URL | Format | Update Frequency |
|--------|-----|--------|------------------|
| **OFAC SDN** | https://sanctionslist.ofac.treas.gov/ | XML | Weekly |
| **Tornado Cash** | GitHub (tornado-cash/docs) | Static list | Rare |
| **Known Exchanges** | Public lists (Etherscan, etc.) | CSV/JSON | Manual |

### 2.2 Hudi Table: `address_labels`

```sql
CREATE TABLE address_labels (
    address VARCHAR(42),
    label_type VARCHAR(50),      -- 'sanctioned', 'mixer', 'exchange'
    label VARCHAR(100),          -- Specific label name
    source VARCHAR(50),          -- 'ofac', 'tornado_cash', 'etherscan'
    confidence DOUBLE,           -- 1.0 for official sources
    fetched_at TIMESTAMP,
    
    PRIMARY KEY (address, source)
)
PARTITIONED BY (source)
```

### 2.3 LabelIngestionJob

**Location**: `processing/batch-processor/src/main/java/com/chainrisk/batch/job/LabelIngestionJob.java`

**Logic**:
1. Fetch data from public APIs/files
2. Parse (XML, JSON, CSV)
3. Normalize to common schema
4. Upsert to `address_labels`

**Sub-components** (fetchers):
- `OFACFetcher` - Parse OFAC SDN XML
- `TornadoCashFetcher` - Parse GitHub list
- `ExchangeFetcher` - Parse known exchange addresses

### 2.4 Tasks

| # | Task | Output |
|---|------|--------|
| 2.1 | Hudi table DDL | `infra/init-scripts/hudi/create-address-labels.sql` |
| 2.2 | LabelIngestionJob | `LabelIngestionJob.java` |
| 2.3 | OFACFetcher | Fetch & parse OFAC SDN |
| 2.4 | TornadoCashFetcher | Fetch & parse Tornado Cash |
| 2.5 | ExchangeFetcher | Fetch known exchanges |
| 2.6 | Run script | `scripts/run-label-ingestion.sh` |
| 2.7 | Test | Query via Trino |

---

## Integration: Training Dataset

### 3.1 Hudi Table: `training_dataset`

```sql
CREATE TABLE training_dataset (
    address VARCHAR(42),
    network VARCHAR(20),
    
    -- Features (copied from address_features)
    tx_count BIGINT,
    sent_count BIGINT,
    received_count BIGINT,
    unique_counterparties BIGINT,
    avg_tx_value DOUBLE,
    max_tx_value DOUBLE,
    tx_value_stddev DOUBLE,
    address_age_days INT,
    sent_ratio DOUBLE,
    round_amount_ratio DOUBLE,
    small_tx_ratio DOUBLE,
    large_tx_ratio DOUBLE,
    in_degree BIGINT,
    out_degree BIGINT,
    in_out_ratio DOUBLE,
    unique_in_neighbors BIGINT,
    
    -- Label
    label INT,                   -- 1=risky, 0=normal, NULL=unknown
    label_type VARCHAR(50),
    label_source VARCHAR(50),
    
    -- Metadata
    created_at TIMESTAMP,
    dataset_version VARCHAR(10),
    
    PRIMARY KEY (address, network)
)
```

### 3.2 TrainingDataPrepareJob

**Location**: `processing/batch-processor/src/main/java/com/chainrisk/batch/job/TrainingDataPrepareJob.java`

**Logic**:
```sql
SELECT 
    f.*,
    CASE 
        WHEN l.label_type IN ('sanctioned', 'mixer') THEN 1
        WHEN l.label_type = 'exchange' THEN 0
        ELSE NULL
    END as label,
    l.label_type,
    l.source as label_source
FROM address_features f
LEFT JOIN address_labels l ON f.address = l.address
```

### 3.3 Update ml-training

Modify `data_loader.py` to read from Trino/Hudi instead of CSV:

```python
def load_training_data(self) -> pd.DataFrame:
    """Load from Hudi training_dataset table."""
    query = "SELECT * FROM hudi.chainrisk.training_dataset"
    return self._load_from_trino(query)
```

### 3.4 Tasks

| # | Task | Output |
|---|------|--------|
| 3.1 | Hudi table DDL | `create-training-dataset.sql` |
| 3.2 | TrainingDataPrepareJob | Join features + labels |
| 3.3 | Update data_loader.py | Read from Hudi |
| 3.4 | Run script | `scripts/run-training-data-prep.sh` |

---

## Execution Order

```
Phase 1                           Phase 2
┌─────────────────────┐           ┌─────────────────────┐
│ 1.1 address_features│           │ 2.1 address_labels  │
│     table DDL       │           │     table DDL       │
└─────────┬───────────┘           └─────────┬───────────┘
          ▼                                 ▼
┌─────────────────────┐           ┌─────────────────────┐
│ 1.2 FeatureCompute  │           │ 2.2-2.5 Label       │
│     Job             │           │ IngestionJob        │
└─────────┬───────────┘           └─────────┬───────────┘
          ▼                                 ▼
┌─────────────────────┐           ┌─────────────────────┐
│ 1.3-1.4 Test        │           │ 2.6-2.7 Test        │
└─────────┬───────────┘           └─────────┬───────────┘
          │                                 │
          └────────────┬────────────────────┘
                       ▼
          ┌─────────────────────┐
          │ 3.1-3.4 Integration │
          │ TrainingDataPrep    │
          └─────────────────────┘
                       │
                       ▼
          ┌─────────────────────┐
          │ ML Training Test    │
          └─────────────────────┘
```

---

## Files to Create

### Phase 1

```
infra/init-scripts/hudi/
└── create-address-features.sql

processing/batch-processor/src/main/java/com/chainrisk/batch/job/
└── FeatureComputeJob.java

scripts/
└── run-feature-compute.sh
```

### Phase 2

```
infra/init-scripts/hudi/
└── create-address-labels.sql

processing/batch-processor/src/main/java/com/chainrisk/batch/job/
├── LabelIngestionJob.java
└── fetcher/
    ├── OFACFetcher.java
    ├── TornadoCashFetcher.java
    └── ExchangeFetcher.java

scripts/
└── run-label-ingestion.sh
```

### Integration

```
infra/init-scripts/hudi/
└── create-training-dataset.sql

processing/batch-processor/src/main/java/com/chainrisk/batch/job/
└── TrainingDataPrepareJob.java

ml-training/src/
└── data_loader.py  (modify)

scripts/
└── run-training-data-prep.sh
```

---

## Success Criteria

### Phase 1
- [ ] `address_features` table in Hudi
- [ ] FeatureComputeJob completes
- [ ] ~700 addresses with features (from test fixtures)
- [ ] Query works: `SELECT * FROM hudi.chainrisk.address_features LIMIT 10`

### Phase 2
- [ ] `address_labels` table in Hudi
- [ ] LabelIngestionJob fetches OFAC, Tornado Cash, exchanges
- [ ] Labels stored in Hudi
- [ ] Query works: `SELECT * FROM hudi.chainrisk.address_labels`

### Integration
- [ ] `training_dataset` table in Hudi
- [ ] Features joined with labels
- [ ] `data_loader.py` reads from Trino
- [ ] ML training runs end-to-end

---

## Important Notes

### Architecture Decisions
- **Label data in Hudi**, not CSV files (big data platform approach)
- **Spark batch jobs** for label ingestion (not Kafka/Flink - low frequency data)
- **Graph features from transfers** for V1 (direct Cypher for V2)
- **No Redis caching** until architecture stabilizes

### Environment
- **uv** for Python environment (local and remote)
- **ssh dev-win** for remote execution
- **Git push/pull** for code sync

### Test Data
- Use real Ethereum fixtures (blocks 24154086-24154088)
- ~700 addresses to compute features
- Match labels against these addresses

---

## References

- [ML Risk Model Architecture](../architecture/ML_RISK_MODEL_ARCHITECTURE.md)
- [Hudi Batch Layer](./HUDI_BATCH_LAYER.md)
- [Integration Test README](../../tests/integration/README.md)
