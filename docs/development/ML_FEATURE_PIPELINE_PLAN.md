# ML Feature Pipeline Development Plan

> Phase 1 & Phase 2: Feature Computation and Label Data Preparation

**Date**: 2026-01-05  
**Status**: Planning

---

## Overview

This document outlines the development plan for:
- **Phase 1**: Hudi `address_features` table and `FeatureComputeJob`
- **Phase 2**: Label data preparation (public datasets)

---

## Test Data Summary

Located at `tests/integration/fixtures/ethereum/`:

| Data | Count | Description |
|------|-------|-------------|
| Blocks | 3 | 24154086, 24154087, 24154088 |
| Transactions | 856 | From 3 blocks |
| Unique Addresses | ~700 | Senders and receivers |
| Internal Txs | 856 files | Per-transaction internal calls |

This is **real Ethereum mainnet data** fetched via Etherscan API.

---

## Development Environment

### Local (macOS)

- Python 3.9 (system)
- uv 0.9.21 for environment management
- Scripts in `scripts/` for client operations (psql, trino, etc.)

### Remote (WSL2 Linux)

- Python 3.12
- uv 0.9.21
- Docker containers running all infrastructure
- Access via: `ssh dev-win "command"`
- Code sync via Git push/pull
- Repo path: `/home/smsmu/chain-risk-platform`

### Key Commands

```bash
# Local: use scripts
./scripts/trino-query.sh "SELECT * FROM ..."

# Remote: direct docker exec
ssh dev-win "docker exec -i chainrisk-trino trino --execute 'SELECT ...'"

# Sync code to remote
git push && ssh dev-win "cd /home/smsmu/chain-risk-platform && git pull"
```

---

## Phase 1: Feature Computation Pipeline

### 1.1 Hudi `address_features` Table

**Schema**:

```sql
CREATE TABLE address_features (
    address VARCHAR(42) PRIMARY KEY,
    network VARCHAR(20),
    
    -- Transaction stats (8)
    tx_count BIGINT,
    sent_count BIGINT,
    received_count BIGINT,
    unique_counterparties BIGINT,
    avg_tx_value DOUBLE,
    max_tx_value DOUBLE,
    tx_value_stddev DOUBLE,
    address_age_days INT,
    
    -- Ratios (4)
    sent_ratio DOUBLE,
    round_amount_ratio DOUBLE,
    small_tx_ratio DOUBLE,
    large_tx_ratio DOUBLE,
    
    -- Graph features (4)
    in_degree BIGINT,
    out_degree BIGINT,
    in_out_ratio DOUBLE,
    unique_in_neighbors BIGINT,
    
    -- Metadata
    computed_at TIMESTAMP,
    feature_version VARCHAR(10)
)
PARTITIONED BY (network, dt)
```

### 1.2 FeatureComputeJob.java

**Location**: `processing/batch-processor/src/main/java/com/chainrisk/batch/job/`

**Input**: Hudi `transfers` table

**Output**: Hudi `address_features` table

**Logic**:
1. Read transfers from Hudi
2. Aggregate by address using Spark SQL
3. Compute all 16 V1 features
4. Write to `address_features` table (upsert)

**Note**: Graph features (in_degree, out_degree, etc.) can be computed from transfers directly without Neo4j for V1.

### 1.3 Tasks

| # | Task | Description |
|---|------|-------------|
| 1.1 | Create table DDL | Define Hudi table in `infra/init-scripts/` |
| 1.2 | Implement FeatureComputeJob | Spark job for feature computation |
| 1.3 | Add run script | `scripts/run-feature-compute.sh` |
| 1.4 | Test with fixture data | Load fixture → Archive → Compute features |
| 1.5 | Verify via Trino | Query `address_features` table |

---

## Phase 2: Label Data Preparation

### 2.1 Data Sources

| Source | Type | URL | Format |
|--------|------|-----|--------|
| OFAC SDN | Sanctioned | treasury.gov | XML/CSV |
| Tornado Cash | Mixer | GitHub lists | JSON/TXT |
| Etherscan Labels | Exchange/Contract | etherscan.io | API/Scrape |

### 2.2 Implementation

**Location**: `ml-training/src/label_fetcher.py`

**Features**:
- Download from public sources
- Parse various formats (XML, JSON, CSV)
- Normalize to standard format: `address, label, source, category`
- Match against test data addresses
- Export to `ml-training/data/labels/`

### 2.3 Label Matching Strategy

Since we're using real Ethereum mainnet data (blocks 24154086-24154088):

1. Extract all addresses from test fixtures
2. Check each address against public label sources
3. For addresses without public labels:
   - Use heuristics (contract detection, exchange patterns)
   - Leave as "unknown" for unsupervised learning

### 2.4 Tasks

| # | Task | Description |
|---|------|-------------|
| 2.1 | Implement label_fetcher.py | Download and parse public label data |
| 2.2 | Add OFAC fetcher | Parse treasury.gov SDN list |
| 2.3 | Add Tornado Cash fetcher | Parse known mixer addresses |
| 2.4 | Add exchange address fetcher | Common exchange hot wallets |
| 2.5 | Match with test data | Find labeled addresses in fixtures |
| 2.6 | Generate label CSVs | Output to `data/labels/` |

---

## Execution Order

```
Phase 1 and Phase 2 can run in parallel

Phase 1:                          Phase 2:
┌─────────────────────┐           ┌─────────────────────┐
│ 1.1 Table DDL       │           │ 2.1 label_fetcher   │
└─────────┬───────────┘           └─────────┬───────────┘
          ▼                                 ▼
┌─────────────────────┐           ┌─────────────────────┐
│ 1.2 FeatureCompute  │           │ 2.2-2.4 Fetchers    │
│     Job             │           │ (OFAC, Tornado, etc)│
└─────────┬───────────┘           └─────────┬───────────┘
          ▼                                 ▼
┌─────────────────────┐           ┌─────────────────────┐
│ 1.3 Run script      │           │ 2.5 Match test data │
└─────────┬───────────┘           └─────────┬───────────┘
          ▼                                 ▼
┌─────────────────────┐           ┌─────────────────────┐
│ 1.4-1.5 Test        │           │ 2.6 Generate CSVs   │
└─────────────────────┘           └─────────────────────┘
          │                                 │
          └────────────┬────────────────────┘
                       ▼
              ┌─────────────────┐
              │ End-to-end test │
              │ (Train models)  │
              └─────────────────┘
```

---

## Important Notes (From Discussion)

### Environment

1. **Use uv** for Python environment management (both local and remote)
2. **Remote execution** via `ssh dev-win "..."` - minimize frequency due to latency
3. **Code sync** via Git: local push → remote pull
4. **Local Python 3.9** may have library compatibility issues → use remote for execution

### Data

1. **Test fixtures** are real Ethereum mainnet data (blocks 24154086-24154088)
2. **Label preparation** must target addresses in test fixtures
3. **Public data download** implemented in Python (reusable logic, not ad-hoc curl)

### Architecture

1. **Feature computation** in Spark batch job (not Python)
2. **Model training** in `ml-training/` directory
3. **Model inference** in `risk-ml-service`
4. **Graph features** via direct Cypher queries (not Graph Engine API)
5. **No Redis** until architecture stabilizes

### Storage

1. **Hudi** for feature storage (full dataset, training source)
2. **PostgreSQL** for real-time queries, risk scores
3. **MinIO** for model registry

---

## Files to Create/Modify

### Phase 1

```
infra/init-scripts/hudi/
└── create-address-features.sql       # NEW: Table DDL

processing/batch-processor/
└── src/main/java/com/chainrisk/batch/job/
    └── FeatureComputeJob.java        # NEW: Spark job

scripts/
└── run-feature-compute.sh            # NEW: Run script
```

### Phase 2

```
ml-training/
├── src/
│   └── label_fetcher.py              # NEW: Download public labels
└── data/labels/
    ├── ofac_addresses.csv            # Generated
    ├── tornado_cash.csv              # Generated
    ├── known_exchanges.csv           # Generated
    └── test_data_labels.csv          # Matched labels for test fixtures
```

---

## Success Criteria

### Phase 1

- [ ] `address_features` table exists in Hudi
- [ ] FeatureComputeJob runs without errors
- [ ] Can query features via Trino: `SELECT * FROM hudi.chainrisk.address_features LIMIT 10`
- [ ] Features computed for test fixture addresses (~700 addresses)

### Phase 2

- [ ] label_fetcher.py downloads OFAC, Tornado Cash, exchange data
- [ ] Label CSVs generated in `data/labels/`
- [ ] At least some test fixture addresses have labels (even if most are "unknown")
- [ ] Can load labels in training pipeline: `DataLoader().load_labels()`

### Integration

- [ ] Can run full pipeline: Fixture → Archive → Features → Train
- [ ] XGBoost/IsolationForest training completes (even with limited labels)

---

## References

- [ML Risk Model Architecture](./architecture/ML_RISK_MODEL_ARCHITECTURE.md)
- [Hudi Batch Layer](./development/HUDI_BATCH_LAYER.md)
- [Integration Test README](../tests/integration/README.md)
