# ML Feature Pipeline

> Feature computation, label ingestion, and training data preparation

**Date**: 2026-01-05  
**Status**: ✅ Implemented

---

## Overview

The ML feature pipeline consists of three Spark batch jobs:

1. **FeatureComputeJob** - Compute features from transfers → `address_features`
2. **LabelIngestionJob** - Fetch labels from public APIs → `address_labels`
3. **TrainingDataPrepareJob** - Join features + labels → `training_dataset`

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        Batch Processing Layer (Spark)                   │
│                                                                         │
│   Hudi transfers ──▶ FeatureComputeJob ──▶ Hudi address_features       │
│                                                                         │
│   Public APIs ──▶ LabelIngestionJob ──▶ Hudi address_labels            │
│   (OFAC, Tornado Cash, Exchanges)                                       │
│                                                                         │
│   address_features + address_labels ──▶ TrainingDataPrepareJob         │
│                                        ──▶ Hudi training_dataset        │
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

## Hudi Tables

### address_features

Computed ML features for each address.

| Column | Type | Description |
|--------|------|-------------|
| address | STRING | Ethereum address |
| network | STRING | Network (ethereum) |
| tx_count | BIGINT | Total transaction count |
| sent_count | BIGINT | Sent transaction count |
| received_count | BIGINT | Received transaction count |
| unique_counterparties | BIGINT | Unique interacted addresses |
| avg_tx_value | DOUBLE | Average transaction value (ETH) |
| max_tx_value | DOUBLE | Maximum transaction value |
| tx_value_stddev | DOUBLE | Transaction value std dev |
| address_age_days | INT | Days since first seen |
| sent_ratio | DOUBLE | sent_count / tx_count |
| round_amount_ratio | DOUBLE | Ratio of round amounts |
| small_tx_ratio | DOUBLE | Ratio of small txs (<0.01 ETH) |
| large_tx_ratio | DOUBLE | Ratio of large txs (>10 ETH) |
| in_degree | BIGINT | Incoming transaction count |
| out_degree | BIGINT | Outgoing transaction count |
| in_out_ratio | DOUBLE | in_degree / out_degree |
| unique_in_neighbors | BIGINT | Unique senders |
| computed_at | TIMESTAMP | Computation timestamp |
| feature_version | STRING | Feature version (v1) |

### address_labels

Labels from public sources.

| Column | Type | Description |
|--------|------|-------------|
| address | STRING | Ethereum address |
| label_type | STRING | sanctioned, mixer, exchange |
| label | STRING | Specific label name |
| source | STRING | ofac, tornado_cash, exchange |
| confidence | DOUBLE | Label confidence (0-1) |
| fetched_at | TIMESTAMP | Fetch timestamp |

### training_dataset

Joined features and labels for ML training.

| Column | Type | Description |
|--------|------|-------------|
| address | STRING | Ethereum address |
| network | STRING | Network |
| (16 feature columns) | ... | Same as address_features |
| label | INT | 1=risky, 0=normal, NULL=unknown |
| label_type | STRING | Original label type |
| label_source | STRING | Original label source |
| created_at | TIMESTAMP | Creation timestamp |
| dataset_version | STRING | Dataset version |

---

## Usage

### Run Feature Computation

```bash
./scripts/run-feature-compute.sh

# Or with specific network
NETWORK=ethereum ./scripts/run-feature-compute.sh
```

### Run Label Ingestion

```bash
./scripts/run-label-ingestion.sh

# Or with specific sources
LABEL_SOURCES=ofac,tornado_cash ./scripts/run-label-ingestion.sh
```

### Run Training Data Preparation

```bash
./scripts/run-training-data-prep.sh
```

### Run Complete Pipeline

```bash
# 1. Compute features from transfers
./scripts/run-feature-compute.sh

# 2. Ingest labels from public sources
./scripts/run-label-ingestion.sh

# 3. Prepare training dataset
./scripts/run-training-data-prep.sh

# 4. Train models
cd ml-training
uv run python src/train_supervised.py --version v1
uv run python src/train_unsupervised.py --version v1
```

---

## Label Sources

| Source | Type | Data |
|--------|------|------|
| **OFAC** | Sanctioned | US Treasury SDN list |
| **Tornado Cash** | Mixer | Known mixer contract addresses |
| **Exchanges** | Normal | Known exchange hot wallets |

### Label Mapping

- `sanctioned`, `mixer` → label = **1** (risky)
- `exchange` → label = **0** (normal)
- No match → label = **NULL** (unknown)

---

## Files

```
processing/batch-processor/src/main/java/com/chainrisk/batch/job/
├── FeatureComputeJob.java
├── LabelIngestionJob.java
├── TrainingDataPrepareJob.java
└── fetcher/
    ├── LabelFetcher.java
    ├── OFACFetcher.java
    ├── TornadoCashFetcher.java
    └── ExchangeFetcher.java

scripts/
├── run-feature-compute.sh
├── run-label-ingestion.sh
└── run-training-data-prep.sh

ml-training/src/
├── data_loader.py      # Reads from Trino/Hudi
├── train_supervised.py
└── train_unsupervised.py
```

---

## Query Examples

```sql
-- Count features
SELECT count(*) FROM hudi.chainrisk.address_features;

-- Count labels by source
SELECT source, count(*) FROM hudi.chainrisk.address_labels GROUP BY source;

-- Training data distribution
SELECT label, count(*) FROM hudi.chainrisk.training_dataset GROUP BY label;

-- Sample training data
SELECT address, tx_count, avg_tx_value, label, label_type 
FROM hudi.chainrisk.training_dataset 
LIMIT 10;
```

---

## References

- [ML Risk Model Architecture](../architecture/ML_RISK_MODEL_ARCHITECTURE.md)
- [Hudi Batch Layer](./HUDI_BATCH_LAYER.md)
