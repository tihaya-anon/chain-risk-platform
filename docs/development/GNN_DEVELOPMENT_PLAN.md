# GNN Development Plan

> Graph Neural Network integration for blockchain address risk analysis

**Created**: 2026-01-09  
**Status**: Planning  
**Branch**: `feature/gnn-development`

---

## Overview

Integrate Graph Neural Networks (GNN) into the existing ML pipeline to leverage graph topology for risk prediction. GNN captures relational patterns that traditional tabular models (XGBoost) cannot.

### Goals

1. Build GNN training pipeline in `ml-training/`
2. Support node-level risk classification
3. Generate address embeddings as features for ensemble
4. Integrate GNN inference into `risk-ml-service`

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         Data Sources                                    │
│                                                                         │
│   Neo4j (Graph)              Hudi (Features)           Labels           │
│   ├─ Nodes: addresses        ├─ address_features       ├─ OFAC          │
│   └─ Edges: transfers        └─ 16 features            ├─ Tornado Cash  │
│                                                        └─ Exchanges     │
└───────────────┬─────────────────────┬─────────────────────┬─────────────┘
                │                     │                     │
                └──────────┬──────────┴──────────┬──────────┘
                           │                     │
                           ▼                     ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                      ml-training/src/gnn/                               │
│                                                                         │
│   ┌──────────────┐    ┌──────────────┐    ┌──────────────┐              │
│   │ GraphBuilder │───▶│  GNN Models  │───▶│   Trainer    │              │
│   │ (Neo4j→PyG)  │    │ GCN/GAT/SAGE │    │              │              │
│   └──────────────┘    └──────────────┘    └──────┬───────┘              │
│                                                  │                      │
│                                                  ▼                      │
│                                           ┌──────────────┐              │
│                                           │    MinIO     │              │
│                                           │  (Registry)  │              │
│                                           └──────────────┘              │
└─────────────────────────────────────────────────────────────────────────┘
                                                  │
                                                  │ Download
                                                  ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                     risk-ml-service/app/ml/                             │
│                                                                         │
│   Request ──▶ Load Graph ──▶ GNN Inference ──▶ Ensemble ──▶ Response    │
│              (subgraph)      (embedding)       + XGBoost                │
│                                                + Rules                  │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Development Phases

### Phase 1: Data Layer (Week 1)

Build graph data loading and preprocessing infrastructure.

| Task | Description | Dependency |
|------|-------------|------------|
| 1.1 | Neo4j graph exporter | None |
| 1.2 | PyTorch Geometric data converter | 1.1 |
| 1.3 | Feature alignment (Hudi → node features) | 1.1 |
| 1.4 | Label alignment (training_dataset → node labels) | 1.1 |
| 1.5 | Train/val/test split strategy | 1.2, 1.3, 1.4 |

**Deliverables**:
- `ml-training/src/gnn/graph_builder.py`
- `ml-training/src/gnn/data_utils.py`

---

### Phase 2: Model Implementation (Week 2)

Implement core GNN architectures.

| Task | Description | Dependency |
|------|-------------|------------|
| 2.1 | Base GNN model class | Phase 1 |
| 2.2 | GCN (Graph Convolutional Network) | 2.1 |
| 2.3 | GAT (Graph Attention Network) | 2.1 |
| 2.4 | GraphSAGE (inductive learning) | 2.1 |
| 2.5 | Model configuration system | 2.2, 2.3, 2.4 |

**Deliverables**:
- `ml-training/src/gnn/models/base.py`
- `ml-training/src/gnn/models/gcn.py`
- `ml-training/src/gnn/models/gat.py`
- `ml-training/src/gnn/models/sage.py`

---

### Phase 3: Training Pipeline (Week 3)

Build end-to-end training workflow.

| Task | Description | Dependency |
|------|-------------|------------|
| 3.1 | Training loop implementation | Phase 2 |
| 3.2 | Evaluation metrics (AUC, F1, Precision, Recall) | 3.1 |
| 3.3 | Early stopping & checkpointing | 3.1 |
| 3.4 | Hyperparameter configuration | 3.1 |
| 3.5 | Training logging & visualization | 3.2 |
| 3.6 | Model export (state_dict + config) | 3.3 |

**Deliverables**:
- `ml-training/src/gnn/trainer.py`
- `ml-training/src/gnn/evaluate.py`
- `ml-training/configs/gnn_config.yaml`
- `ml-training/src/train_gnn.py` (entry point)

---

### Phase 4: Model Registry Integration (Week 4)

Integrate with existing MinIO model registry.

| Task | Description | Dependency |
|------|-------------|------------|
| 4.1 | GNN model serialization format | Phase 3 |
| 4.2 | Upload to MinIO with versioning | 4.1 |
| 4.3 | Metadata schema (architecture, hyperparams, metrics) | 4.1 |
| 4.4 | Download & load utility | 4.2 |

**Deliverables**:
- Update `ml-training/src/model_registry.py`
- GNN models in `s3://ml-models/gnn/`

---

### Phase 5: Inference Service (Week 5)

Integrate GNN into risk-ml-service.

| Task | Description | Dependency |
|------|-------------|------------|
| 5.1 | GNN model loader | Phase 4 |
| 5.2 | Subgraph extraction (k-hop neighbors) | 5.1 |
| 5.3 | Real-time inference pipeline | 5.2 |
| 5.4 | Embedding extraction mode | 5.3 |
| 5.5 | Ensemble integration (GNN + XGBoost + Rules) | 5.4 |
| 5.6 | API endpoint updates | 5.5 |

**Deliverables**:
- `services/risk-ml-service/app/ml/gnn_predictor.py`
- `services/risk-ml-service/app/ml/graph_client.py`
- `services/risk-ml-service/app/ml/ensemble.py`
- Update `services/risk-ml-service/app/services/risk_service.py`

---

### Phase 6: Testing & Optimization (Week 6)

Validation and performance tuning.

| Task | Description | Dependency |
|------|-------------|------------|
| 6.1 | Unit tests for GNN modules | Phase 5 |
| 6.2 | Integration tests | 6.1 |
| 6.3 | Performance benchmarking | 6.2 |
| 6.4 | Inference latency optimization | 6.3 |
| 6.5 | Documentation | 6.4 |

**Deliverables**:
- `ml-training/tests/test_gnn_*.py`
- `services/risk-ml-service/tests/test_gnn_*.py`
- `docs/architecture/GNN_ARCHITECTURE.md`

---

## Technical Specifications

### Graph Schema

```
Node (Address):
  - address: string (primary key)
  - network: string
  - features: float[16] (from address_features)
  - label: int (0=normal, 1=risky, null=unknown)

Edge (Transfer):
  - from_address → to_address
  - value: float (ETH)
  - timestamp: long
  - tx_hash: string
```

### Model Architectures

| Model | Use Case | Pros | Cons |
|-------|----------|------|------|
| **GCN** | Baseline | Simple, fast | Limited expressiveness |
| **GAT** | Attention-based | Learns edge importance | Higher memory |
| **GraphSAGE** | Inductive | Works on unseen nodes | Sampling overhead |

**Recommended**: Start with GraphSAGE for production (supports new addresses without retraining).

### Hyperparameters (Default)

```yaml
model:
  type: sage
  hidden_dim: 128
  num_layers: 2
  dropout: 0.3
  aggregator: mean

training:
  epochs: 200
  lr: 0.001
  weight_decay: 5e-4
  batch_size: 512  # for mini-batch training
  patience: 20     # early stopping
```

### Inference Modes

| Mode | Description | Latency |
|------|-------------|---------|
| **Direct** | Full GNN forward pass | ~50ms |
| **Embedding** | Pre-computed embeddings + MLP | ~5ms |
| **Hybrid** | Cached embeddings + incremental update | ~10ms |

---

## Directory Structure

```
ml-training/
├── src/
│   ├── gnn/
│   │   ├── __init__.py
│   │   ├── graph_builder.py      # Neo4j → PyG conversion
│   │   ├── data_utils.py         # Dataset utilities
│   │   ├── models/
│   │   │   ├── __init__.py
│   │   │   ├── base.py           # Base GNN class
│   │   │   ├── gcn.py
│   │   │   ├── gat.py
│   │   │   └── sage.py
│   │   ├── trainer.py            # Training loop
│   │   └── evaluate.py           # Metrics
│   ├── train_gnn.py              # Entry point
│   └── ...
├── configs/
│   ├── training_config.yaml
│   └── gnn_config.yaml           # NEW
└── ...

services/risk-ml-service/
├── app/
│   ├── ml/                       # NEW directory
│   │   ├── __init__.py
│   │   ├── model_loader.py       # Load models from MinIO
│   │   ├── gnn_predictor.py      # GNN inference
│   │   ├── graph_client.py       # Neo4j subgraph extraction
│   │   ├── xgb_predictor.py      # XGBoost inference
│   │   └── ensemble.py           # Score combination
│   ├── services/
│   │   └── risk_service.py       # Updated with ML
│   └── ...
└── ...
```

---

## Dependencies

### ml-training (Python)

```toml
# pyproject.toml additions
[project.optional-dependencies]
gnn = [
    "torch>=2.0.0",
    "torch-geometric>=2.4.0",
    "torch-scatter",
    "torch-sparse",
    "neo4j>=5.0.0",
    "networkx>=3.0",
]
```

### risk-ml-service (Python)

```toml
# pyproject.toml additions
[project.optional-dependencies]
ml = [
    "torch>=2.0.0",
    "torch-geometric>=2.4.0",
    "xgboost>=2.0.0",
    "joblib>=1.3.0",
    "neo4j>=5.0.0",
]
```

---

## Risk & Mitigation

| Risk | Impact | Mitigation |
|------|--------|------------|
| Large graph memory | High | Mini-batch sampling (GraphSAGE) |
| Cold start (new addresses) | Medium | Inductive model + fallback to rules |
| Inference latency | Medium | Pre-compute embeddings, caching |
| Label imbalance | Medium | Class weights, oversampling |
| Graph quality (noise) | Low | Edge filtering, confidence threshold |

---

## Success Metrics

| Metric | Target | Current (XGBoost) |
|--------|--------|-------------------|
| AUC-ROC | > 0.90 | ~0.85 |
| Precision@0.5 | > 0.80 | ~0.75 |
| Recall@0.5 | > 0.75 | ~0.70 |
| Inference P95 | < 100ms | N/A |

---

## Timeline Summary

| Week | Phase | Focus |
|------|-------|-------|
| 1 | Data Layer | Graph building, feature alignment |
| 2 | Models | GCN, GAT, GraphSAGE implementation |
| 3 | Training | Pipeline, evaluation, export |
| 4 | Registry | MinIO integration, versioning |
| 5 | Inference | Service integration, ensemble |
| 6 | Testing | Tests, benchmarks, docs |

---

## References

- [ML Risk Model Architecture](../architecture/ML_RISK_MODEL_ARCHITECTURE.md)
- [ML Feature Pipeline](./ML_FEATURE_PIPELINE.md)
- [Project Overview](../architecture/PROJECT_OVERVIEW.md)
- [PyTorch Geometric Docs](https://pytorch-geometric.readthedocs.io/)
