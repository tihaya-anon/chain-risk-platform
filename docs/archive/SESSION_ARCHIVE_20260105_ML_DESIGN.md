# Session Archive - ML Risk Model Discussion

**Date**: 2026-01-05  
**Topic**: ML Risk Model Architecture Design & Feature Engineering Discussion

---

## Summary

This session covered two main tasks:
1. Documentation audit and updates (completed, committed)
2. ML risk model architecture discussion (design phase, not yet implemented)

---

## Part 1: Documentation Updates (Completed)

### Changes Made

| File | Change |
|------|--------|
| `README.md` | Fixed batch-processor language (Scala → Java/Spark+Hudi), added Hudi/MinIO/Trino info |
| `docs/architecture/PROJECT_OVERVIEW.md` | Fixed batch-processor description |
| `docs/development/PROGRESS.md` | Updated Phase 4 progress to 60% |
| `scripts/README.md` | Added batch processing scripts documentation |
| `docs/operations/SCRIPTS_QUICK_REFERENCE.md` | Added batch commands |
| `docs/README.md` | Added Hudi documentation reference |

### Git Commits
1. `docs: update documentation to match actual code implementation` - Documentation fixes
2. `docs: add ML risk model architecture design` - ML architecture document

---

## Part 2: ML Architecture Design Decisions

### Key Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| ML Approach | Supervised + Unsupervised | Risk ≈ Anomaly; both needed |
| Supervised Model | XGBoost / LightGBM | Proven, interpretable feature importance |
| Unsupervised Model | Isolation Forest | No labels needed, detects novel patterns |
| Feature Computation | Spark Batch Job | Fits Lambda architecture |
| Model Training | Separate `ml-training/` directory | Decoupled from inference service |
| Model Inference | `risk-ml-service` | Existing Python service |
| Graph Features | Direct Cypher to Neo4j | More flexible than Graph Engine API |
| Model Registry | MinIO | Already in stack, simple versioning |
| Feature Storage | Hudi (full) + PostgreSQL (queries) | No Redis for now (cost) |

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         ml-training/                                    │
│  Labels + Trino(Hudi) ──▶ Training ──▶ MinIO (model registry)          │
└─────────────────────────────────────────────────────────────────────────┘
                                                             │ download
                                                             ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                     risk-ml-service (Inference)                         │
│     Request ──▶ Query Features ──▶ ML Inference ──▶ Ensemble ──▶ Return │
└─────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│                     batch-processor (Spark)                             │
│     Hudi transfers ──▶ FeatureComputeJob ──▶ Hudi address_features     │
│                    + Neo4j Cypher ──▶ Graph Features                    │
└─────────────────────────────────────────────────────────────────────────┘
```

### Directory Structure (Planned)

```
chain-risk-platform/
├── ml-training/                    # NEW
│   ├── data/labels/                # OFAC, Chainalysis, exchanges
│   ├── notebooks/                  # Exploration
│   ├── src/
│   │   ├── data_loader.py          # Trino/PG/Parquet
│   │   ├── train_supervised.py     # XGBoost
│   │   ├── train_unsupervised.py   # Isolation Forest
│   │   └── model_registry.py       # MinIO upload/download
│   └── configs/
│
├── processing/batch-processor/
│   └── FeatureComputeJob.java      # NEW
│
└── services/risk-ml-service/
    └── app/ml/                     # NEW
        ├── model_loader.py
        ├── feature_client.py
        ├── neo4j_features.py
        ├── predictor.py
        └── ensemble.py
```

---

## Part 3: Feature Engineering Discussion

### Feature Categories

#### ✅ Already Available (from `chain_data.transfers`)

| Feature | Description |
|---------|-------------|
| `tx_count` | Total transaction count |
| `sent_count` | Sent transaction count |
| `received_count` | Received transaction count |
| `unique_counterparties` | Unique interacted addresses |
| `total_value_sent` | Total value sent |
| `total_value_received` | Total value received |
| `avg_tx_value` | Average transaction value |
| `max_tx_value` | Maximum single transaction |
| `min_tx_value` | Minimum single transaction |
| `tx_value_stddev` | Value standard deviation |
| `first_seen` | First activity timestamp |
| `last_seen` | Last activity timestamp |
| `address_age_days` | Address age in days |
| `active_days` | Number of active days |
| `avg_tx_per_day` | Average transactions per day |
| `round_amount_ratio` | Ratio of round amounts |
| `small_tx_ratio` | Ratio of small txs (<0.01 ETH) |
| `large_tx_ratio` | Ratio of large txs (>10 ETH) |

#### ✅ From Neo4j (Cypher queries)

| Feature | Description |
|---------|-------------|
| `in_degree` | Incoming transfer count |
| `out_degree` | Outgoing transfer count |
| `degree` | Total degree |
| `unique_in_neighbors` | Unique incoming addresses |
| `unique_out_neighbors` | Unique outgoing addresses |
| `in_out_ratio` | In/out ratio |
| `clustering_coefficient` | Local clustering |
| `pagerank` | PageRank centrality (GDS) |
| `betweenness` | Betweenness centrality (GDS) |

#### ⚠️ Requires Additional Logic

| Feature | Description | Complexity |
|---------|-------------|------------|
| `tx_time_entropy` | Time distribution entropy | Medium |
| `hour_distribution` | 24h distribution vector | Medium |
| `burst_count` | Burst transaction detection | Medium |
| `value_entropy` | Value distribution entropy | Medium |
| `counterparty_concentration` | Gini/HHI index | Medium |
| `cycle_participation` | Cycle involvement | High |

#### ⚠️ Requires External Data

| Feature | Data Source |
|---------|-------------|
| `hops_to_blacklist` | Blacklist addresses |
| `interacted_with_mixer` | Tornado Cash list |
| `is_contract` | Etherscan / chain query |
| `contract_verified` | Etherscan API |

#### ❌ Hard to Obtain

| Feature | Difficulty |
|---------|------------|
| `entity_label` | Need to purchase/scrape |
| `historical_risk_score` | Need Chainalysis API |
| `cross_chain_activity` | Need multi-chain data |

### Proposed V1 Feature Set (16 features)

```python
FEATURES_V1 = [
    # Basic stats (8)
    "tx_count",
    "sent_count", 
    "received_count",
    "unique_counterparties",
    "avg_tx_value",
    "max_tx_value",
    "tx_value_stddev",
    "address_age_days",
    
    # Ratio features (4)
    "sent_ratio",           # sent_count / tx_count
    "round_amount_ratio",
    "small_tx_ratio",
    "large_tx_ratio",
    
    # Graph features (4)
    "in_degree",
    "out_degree", 
    "in_out_ratio",
    "unique_in_neighbors",
]
```

---

## Part 4: Label Data Sources

| Source | Type | Availability |
|--------|------|--------------|
| OFAC SDN List | Sanctioned addresses | Public, free |
| Chainalysis Reports | Hacker/scam addresses | Public reports |
| Etherscan Labels | Exchange/contract labels | API or scrape |
| Tornado Cash Contracts | Mixer addresses | Public |
| Known Exchanges | Negative samples | Public |

---

## Next Steps (TODO)

1. **Finalize V1 Feature List** - Confirm or adjust the 16 proposed features
2. **Design Hudi Table Schema** - `address_features` table structure
3. **Implement FeatureComputeJob** - Spark job for feature computation
4. **Set up ml-training Directory** - Project structure, dependencies
5. **Collect Label Data** - OFAC, Tornado Cash, known exchanges
6. **Implement Model Registry** - MinIO integration for model versioning
7. **Integrate ML into risk-ml-service** - Inference pipeline

---

## Documents Created

| Document | Path |
|----------|------|
| ML Architecture Design | `docs/architecture/ML_RISK_MODEL_ARCHITECTURE.md` |
| This Session Archive | `docs/archive/SESSION_ARCHIVE_20260105_ML_DESIGN.md` |

---

## Questions for Next Session

1. Confirm V1 feature set - any additions/removals?
2. Hudi `address_features` table schema design
3. Start with which component? (FeatureComputeJob vs ml-training setup)
