# ML Risk Model Architecture

## Overview

This document describes the machine learning architecture for risk scoring in the Chain Risk Platform. The system combines supervised learning (risk identification) and unsupervised learning (anomaly detection) with the existing rule engine.

## Architecture Design

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         ml-training/                                    │
│                                                                         │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────────────┐   │
│  │ Label    │    │ Trino    │    │ Training │    │ MinIO            │   │
│  │ Data     │───▶│ ──────▶  │───▶│ XGB + IF │───▶│   ml-models/     │   │
│  │ (csv)    │    │ Features │    └──────────┘    │   Upload Model   │   │
│  └──────────┘    └──────────┘                    └──────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
                                                             │
                                                             │ Download
                                                             ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                     risk-ml-service (Inference)                         │
│                                                                         │
│     Request ──▶ Query Features ──▶ ML Inference ──▶ Ensemble ──▶ Return │
│                 (Trino/PG)                          + Rules             │
└─────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│                     batch-processor (Spark)                             │
│                                                                         │
│     Hudi transfers ──▶ FeatureComputeJob ──▶ Hudi address_features      │
│                              │                                          │
│                              ▼                                          │
│                    Neo4j (Cypher) ──▶ Graph Features                    │
└─────────────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component           | Responsibility                                  |
| ------------------- | ----------------------------------------------- |
| **ml-training/**    | Offline model training, experiments, evaluation |
| **batch-processor** | Feature computation (Spark + Cypher)            |
| **risk-ml-service** | Real-time and batch inference                   |
| **MinIO**           | Model registry and versioning                   |
| **Hudi**            | Feature store (full dataset)                    |
| **PostgreSQL**      | Query results, risk scores persistence          |

## ML Approach

### Dual-Model Strategy

1. **Supervised Learning (XGBoost/LightGBM)**
   - Direct risk identification
   - Requires labeled data (malicious vs. normal addresses)
   - Higher precision on known risk patterns

2. **Unsupervised Learning (Isolation Forest)**
   - Anomaly detection
   - No labels required
   - Discovers novel attack patterns

### Score Ensemble

```
Final Score = Ensemble(Rule Score, XGBoost Score, IsolationForest Score)
```

Ensemble strategies:
- Weighted average: `w1 * rule + w2 * xgb + w3 * if`
- Max (conservative): `max(rule, xgb, if)`
- Stacking: meta-model combines all scores

## Directory Structure

```
chain-risk-platform/
├── ml-training/                    # NEW: Training pipeline
│   ├── data/
│   │   ├── labels/                 # Label datasets
│   │   │   ├── ofac_addresses.csv
│   │   │   ├── chainalysis_sanctions.csv
│   │   │   └── known_exchanges.csv # Negative samples
│   │   └── features/               # Exported features (local dev)
│   │
│   ├── notebooks/                  # Exploratory analysis
│   │   ├── 01_data_exploration.ipynb
│   │   ├── 02_feature_engineering.ipynb
│   │   └── 03_model_experiments.ipynb
│   │
│   ├── src/
│   │   ├── data_loader.py          # Load from Hudi/Trino/PG
│   │   ├── feature_builder.py      # Feature construction
│   │   ├── train_supervised.py     # XGBoost training
│   │   ├── train_unsupervised.py   # Isolation Forest training
│   │   ├── evaluate.py             # Model evaluation
│   │   └── model_registry.py       # MinIO upload/download
│   │
│   ├── models/                     # Local model output
│   ├── configs/
│   │   └── training_config.yaml
│   └── pyproject.toml
│
├── processing/batch-processor/
│   └── src/.../batch/
│       └── FeatureComputeJob.java  # NEW: Feature computation
│
└── services/risk-ml-service/
    ├── app/
    │   ├── ml/                     # NEW: ML inference
    │   │   ├── model_loader.py     # Load models from MinIO
    │   │   ├── feature_client.py   # Query precomputed features
    │   │   ├── neo4j_features.py   # Cypher queries for graph features
    │   │   ├── predictor.py        # Unified inference interface
    │   │   └── ensemble.py         # Score combination
    │   │
    │   ├── rules/                  # Existing rule engine
    │   └── services/
    │       └── risk_service.py     # Integrate ML inference
    │
    └── models/                     # Downloaded models (runtime)
```

## Data Flow

### 1. Feature Computation (Batch)

**Trigger**: Daily batch job (e.g., 03:00 UTC), after HudiBatchCorrectionJob

**Process**:
1. Read transfers from Hudi
2. Aggregate by address, compute statistical features
3. Connect to Neo4j, execute Cypher for graph features
4. Merge all features
5. Write to Hudi `address_features` table

### 2. Model Training (Offline)

**Trigger**: Manual or scheduled (weekly/monthly)

**Process**:
```bash
cd ml-training

# Load features from Trino (production) or Parquet (local dev)
python src/train_supervised.py --config configs/training_config.yaml
python src/train_unsupervised.py --config configs/training_config.yaml

# Evaluate
python src/evaluate.py

# Upload to MinIO
python src/model_registry.py upload --model xgboost --version v2
```

### 3. Real-time Inference

```python
async def score_address(address):
    # 1. Query precomputed features
    features = await feature_client.get_features(address)
    
    if features:
        # 2a. ML inference
        ml_score = predictor.predict(features)
    else:
        # 2b. Fallback to rule engine only
        ml_score = None
    
    # 3. Rule engine (always executed)
    rule_score = await rule_engine.evaluate(address)
    
    # 4. Ensemble
    final_score = ensemble.combine(ml_score, rule_score)
    
    return final_score
```

### 4. Batch Inference

For bulk scoring of all addresses:
1. Load all features from Hudi
2. Batch inference with ML models
3. Write results to `risk.address_scores` table

## Model Registry (MinIO)

### Structure

```
Bucket: ml-models/
├── xgboost/
│   ├── v1/
│   │   ├── model.pkl
│   │   └── metadata.json
│   ├── v2/
│   │   ├── model.pkl
│   │   └── metadata.json
│   └── latest.json          # Points to current version
├── isolation_forest/
│   ├── v1/
│   │   ├── model.pkl
│   │   └── metadata.json
│   └── latest.json
└── registry.json            # Global metadata
```

### Metadata Schema

```json
{
  "model_name": "xgboost",
  "version": "v2",
  "created_at": "2026-01-05T10:00:00Z",
  "metrics": {
    "auc": 0.92,
    "precision": 0.85,
    "recall": 0.78
  },
  "features": ["tx_count", "avg_value", "degree", "..."],
  "training_samples": 50000,
  "hyperparameters": { "..." }
}
```

### Hot Reload

Risk ML Service checks for new model versions periodically:
- On startup: download latest models
- Every N minutes: check `latest.json`, reload if changed

## Storage Decisions

| Storage        | Purpose                                    |
| -------------- | ------------------------------------------ |
| **Hudi**       | Feature store (full), training data source |
| **PostgreSQL** | Risk scores persistence, real-time queries |
| **MinIO**      | Model files, versioning                    |

Note: Redis caching deferred until architecture stabilizes and slow queries identified.

## Label Data Sources

| Source                 | Data Type                 | Availability    |
| ---------------------- | ------------------------- | --------------- |
| OFAC SDN List          | Sanctioned addresses      | Public, free    |
| Chainalysis Reports    | Hacker/scam addresses     | Public reports  |
| Etherscan Labels       | Exchange/contract labels  | API or scraping |
| Tornado Cash Contracts | Mixer addresses           | Public          |
| Known Exchanges        | Negative samples (normal) | Public          |

## Next Steps

1. Define feature list (statistical, temporal, graph features)
2. Design Hudi `address_features` table schema
3. Implement FeatureComputeJob (Spark)
4. Set up ml-training directory structure
5. Implement model registry with MinIO
6. Integrate ML inference into risk-ml-service

## References

- [Lambda Architecture](./LAMBDA_ARCHITECTURE.md)
- [Hudi Batch Layer](../development/HUDI_BATCH_LAYER.md)
- [Project Overview](./PROJECT_OVERVIEW.md)
