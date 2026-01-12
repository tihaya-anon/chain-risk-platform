# GNN Development Plan

> Graph Neural Network integration for blockchain address risk analysis

**Created**: 2026-01-09  
**Updated**: 2026-01-09  
**Status**: Phase 1-5 Complete  
**Branch**: `feature/gnn-development`

---

## Overview

Integrate Graph Neural Networks (GNN) into the existing ML pipeline to leverage graph topology for risk prediction.

---

## Development Phases

### Phase 1: Data Layer ✅ Complete

| Task | Status |
|------|--------|
| Neo4j graph exporter | ✅ |
| PyTorch Geometric data converter | ✅ |
| Feature alignment (Hudi → node features) | ✅ |
| Label alignment | ✅ |
| Train/val/test split strategy | ✅ |

**Files**:
- `ml-training/src/gnn/graph_builder.py`
- `ml-training/src/gnn/data_utils.py`
- `ml-training/src/gnn/pyg_converter.py`

---

### Phase 2: Model Implementation ✅ Complete

| Task | Status |
|------|--------|
| Base GNN model class | ✅ |
| GCN implementation | ✅ |
| GAT implementation | ✅ |
| GraphSAGE implementation | ✅ |
| Model factory function | ✅ |

**Files**:
- `ml-training/src/gnn/models/base.py`
- `ml-training/src/gnn/models/gcn.py`
- `ml-training/src/gnn/models/gat.py`
- `ml-training/src/gnn/models/sage.py`

---

### Phase 3: Training Pipeline ✅ Complete

| Task | Status |
|------|--------|
| Training loop | ✅ |
| Evaluation metrics | ✅ |
| Early stopping | ✅ |
| Checkpointing | ✅ |
| Training entry point | ✅ |

**Files**:
- `ml-training/src/gnn/trainer.py`
- `ml-training/src/gnn/evaluate.py`
- `ml-training/src/train_gnn.py`
- `ml-training/configs/gnn_config.yaml`

---

### Phase 4: Model Registry ✅ Complete

| Task | Status |
|------|--------|
| GNN model serialization | ✅ |
| MinIO upload/download | ✅ |
| Metadata schema | ✅ |
| Version management | ✅ |

**Files**:
- `ml-training/src/model_registry.py` (extended)

---

### Phase 5: Inference Service ✅ Complete

| Task | Status |
|------|--------|
| Model loader | ✅ |
| Feature client | ✅ |
| GNN predictor | ✅ |
| XGBoost predictor | ✅ |
| Ensemble predictor | ✅ |
| Risk service integration | ✅ |

**Files**:
- `services/risk-ml-service/app/ml/model_loader.py`
- `services/risk-ml-service/app/ml/feature_client.py`
- `services/risk-ml-service/app/ml/gnn_models.py`
- `services/risk-ml-service/app/ml/gnn_predictor.py`
- `services/risk-ml-service/app/ml/xgb_predictor.py`
- `services/risk-ml-service/app/ml/ensemble.py`
- `services/risk-ml-service/app/services/risk_service.py`
- `services/risk-ml-service/app/core/config.py`

---

### Phase 6: Testing ⏳ Pending

| Task | Status |
|------|--------|
| Unit tests | ⏳ |
| Integration tests | ⏳ |
| Performance benchmarks | ⏳ |
| Documentation | ⏳ |

---

## Usage

### Training

```bash
cd ml-training

# Train GNN model
uv run python src/train_gnn.py \
  --config configs/gnn_config.yaml \
  --version v1 \
  --upload  # upload to MinIO
```

### Configuration

Edit `ml-training/configs/gnn_config.yaml`:

```yaml
model:
  type: sage  # gcn, gat, sage
  hidden_dim: 128
  num_layers: 2
  dropout: 0.3

training:
  epochs: 200
  lr: 0.001
  patience: 20
```

### Inference Service

The risk-ml-service automatically loads ML models on startup when `ML_ENABLED=true`.

```bash
cd services/risk-ml-service
uv run uvicorn app.main:app --port 8082
```

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         ml-training/                                    │
│                                                                         │
│   Neo4j + Trino ──▶ GraphBuilder ──▶ PyG Data ──▶ GNN Training         │
│                                                         │               │
│                                                         ▼               │
│                                                   MinIO Registry        │
└─────────────────────────────────────────────────────────────────────────┘
                                                         │
                                                         ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                     risk-ml-service                                     │
│                                                                         │
│   Request ──▶ FeatureClient ──▶ GNNPredictor ──▶ Ensemble ──▶ Response │
│                                  XGBPredictor      + Rules              │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Model Performance (Expected)

| Metric | Target | Notes |
|--------|--------|-------|
| AUC-ROC | > 0.90 | With sufficient labeled data |
| Precision@0.5 | > 0.80 | |
| Recall@0.5 | > 0.75 | |
| Inference P95 | < 100ms | Single node prediction |

---

## Dependencies Added

### ml-training

```toml
torch>=2.9.1
torch-geometric>=2.4.0
neo4j>=6.0.3
networkx>=3.0
```

### risk-ml-service (optional ml extra)

```toml
torch>=2.9.1
torch-geometric>=2.4.0
neo4j>=6.0.3
```

---

## Next Steps

1. **Populate Neo4j** with graph data via Flink stream processor
2. **Run feature pipeline** to populate address_features table
3. **Ingest labels** from OFAC, Tornado Cash, exchanges
4. **Train GNN model** with real data
5. **Write tests** for GNN module
6. **Benchmark inference** performance

---

## References

- [ML Risk Model Architecture](../architecture/ML_RISK_MODEL_ARCHITECTURE.md)
- [ML Feature Pipeline](./ML_FEATURE_PIPELINE.md)
- [PyTorch Geometric Docs](https://pytorch-geometric.readthedocs.io/)
