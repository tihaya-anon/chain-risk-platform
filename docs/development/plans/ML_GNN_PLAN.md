# ML with GNN Integration Plan

## Overview

This document outlines the integration of Graph Neural Networks (GNN) into the Chain Risk Platform's ML pipeline, complementing existing XGBoost and Isolation Forest models with graph-based deep learning for enhanced risk detection.

## Motivation

### Why GNN for Blockchain Risk Analysis?

Traditional ML models (XGBoost, Isolation Forest) operate on **tabular features** and cannot directly model **graph structure**. Blockchain transactions form a natural graph where:

- **Nodes**: Addresses
- **Edges**: Transactions (directed, weighted)
- **Node Features**: Transaction statistics, balance, age
- **Edge Features**: Transaction value, timestamp, gas

**GNN Advantages**:
1. **Structure-aware**: Learns from graph topology
2. **Propagation**: Captures multi-hop risk propagation
3. **Representation learning**: Generates address embeddings
4. **End-to-end**: Joint feature learning and classification

### Use Cases

| Use Case | Description | GNN Benefit |
|----------|-------------|-------------|
| Risk propagation | Detect risk spreading through transaction chains | Multi-hop message passing |
| Entity clustering | Identify related addresses (wallets, exchanges) | Node embedding similarity |
| Anomaly detection | Find unusual transaction patterns | Graph structure deviation |
| Money laundering | Detect layering and integration patterns | Subgraph pattern matching |

## Architecture

### Extended ML Pipeline

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Data Layer                                  │
│                                                                     │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐          │
│  │ PostgreSQL   │    │    Neo4j     │    │     Hudi     │          │
│  │ (transfers)  │───▶│  (graph DB)  │───▶│  (features)  │          │
│  └──────────────┘    └──────────────┘    └──────────────┘          │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    Feature Engineering                              │
│                                                                     │
│  ┌────────────────┐  ┌────────────────┐  ┌────────────────┐        │
│  │  Statistical   │  │  Graph Stats   │  │  GNN Graph     │        │
│  │  Features      │  │  (PageRank,    │  │  Construction  │        │
│  │  (Spark)       │  │   Centrality)  │  │  (PyG format)  │        │
│  └────────────────┘  └────────────────┘  └────────────────┘        │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      ML Training (ml-training/)                     │
│                                                                     │
│  ┌────────────────┐  ┌────────────────┐  ┌────────────────┐        │
│  │   XGBoost      │  │ Isolation      │  │      GNN       │        │
│  │  (Supervised)  │  │   Forest       │  │  (GraphSAGE/   │        │
│  │                │  │ (Unsupervised) │  │    GCN/GAT)    │        │
│  └────────────────┘  └────────────────┘  └────────────────┘        │
│                                                  │                  │
│                                                  ▼                  │
│                                          ┌────────────────┐         │
│                                          │ Node Embeddings│         │
│                                          │   (MinIO)      │         │
│                                          └────────────────┘         │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                  Inference (risk-ml-service)                        │
│                                                                     │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │                    Ensemble Model                              │ │
│  │                                                                │ │
│  │  XGBoost + IsolationForest + GNN + Rule Engine                 │ │
│  │                                                                │ │
│  │  Final Score = w1*xgb + w2*if + w3*gnn + w4*rule               │ │
│  └────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
```

## Tech Stack

### GNN Framework Selection

| Framework | Pros | Cons | Decision |
|-----------|------|------|----------|
| **PyTorch Geometric (PyG)** | - Rich GNN layers<br>- Active community<br>- Easy integration with PyTorch<br>- Good documentation | - Requires PyTorch | ✅ **Selected** |
| DGL (Deep Graph Library) | - Efficient for large graphs<br>- Multi-framework support | - Steeper learning curve | Alternative |
| Spektral (TensorFlow) | - TensorFlow ecosystem | - Smaller community | Not chosen |

### Dependencies

```toml
# pyproject.toml
[project]
dependencies = [
    "torch>=2.0.0",
    "torch-geometric>=2.4.0",
    "torch-scatter>=2.1.0",
    "torch-sparse>=0.6.0",
    "networkx>=3.0",
    "scikit-learn>=1.3.0",
    "neo4j>=5.0.0",
]
```

## GNN Models

### Model Selection

| Model | Description | Use Case | Priority |
|-------|-------------|----------|----------|
| **GraphSAGE** | Inductive learning, scalable | Node classification, large graphs | ✅ Primary |
| **GCN** | Classic GNN, transductive | Small-medium graphs, baseline | ✅ Baseline |
| **GAT** | Attention mechanism | Important neighbor weighting | ⏳ Future |
| **GIN** | Graph isomorphism | Subgraph pattern detection | ⏳ Future |

### GraphSAGE Architecture

**Why GraphSAGE?**
- **Inductive**: Can generalize to unseen nodes (new addresses)
- **Scalable**: Mini-batch training via neighbor sampling
- **Flexible**: Supports various aggregation functions

**Architecture**:
```python
class GraphSAGERiskModel(nn.Module):
    def __init__(self, in_channels, hidden_channels, out_channels, num_layers=3):
        super().__init__()
        
        self.convs = nn.ModuleList()
        self.convs.append(SAGEConv(in_channels, hidden_channels))
        
        for _ in range(num_layers - 2):
            self.convs.append(SAGEConv(hidden_channels, hidden_channels))
        
        self.convs.append(SAGEConv(hidden_channels, out_channels))
        
        self.dropout = nn.Dropout(0.5)
        
    def forward(self, x, edge_index):
        for i, conv in enumerate(self.convs[:-1]):
            x = conv(x, edge_index)
            x = F.relu(x)
            x = self.dropout(x)
        
        x = self.convs[-1](x, edge_index)
        return x
```

**Hyperparameters**:
```yaml
model:
  type: graphsage
  in_channels: 16          # Node feature dimension
  hidden_channels: 64
  out_channels: 32         # Embedding dimension
  num_layers: 3
  dropout: 0.5
  aggregator: mean         # mean, max, lstm

training:
  epochs: 100
  batch_size: 512
  learning_rate: 0.001
  weight_decay: 5e-4
  neighbor_samples: [10, 5]  # 2-hop sampling
```

## Data Pipeline

### Graph Construction

**Source**: Neo4j → PyTorch Geometric

```python
# ml-training/src/graph_loader.py

import torch
from torch_geometric.data import Data
from neo4j import GraphDatabase

class Neo4jGraphLoader:
    def __init__(self, uri, user, password):
        self.driver = GraphDatabase.driver(uri, auth=(user, password))
    
    def load_graph(self, limit=None):
        """
        Load graph from Neo4j and convert to PyG Data object.
        """
        with self.driver.session() as session:
            # Load nodes
            query_nodes = """
            MATCH (a:Address)
            RETURN a.address AS address, 
                   a.tx_count AS tx_count,
                   a.total_sent AS total_sent,
                   a.total_received AS total_received,
                   a.first_seen AS first_seen
            LIMIT $limit
            """
            nodes = session.run(query_nodes, limit=limit).data()
            
            # Load edges
            query_edges = """
            MATCH (a:Address)-[t:TRANSFER]->(b:Address)
            RETURN a.address AS from, 
                   b.address AS to,
                   t.value AS value,
                   t.timestamp AS timestamp
            LIMIT $limit
            """
            edges = session.run(query_edges, limit=limit).data()
        
        return self._build_pyg_data(nodes, edges)
    
    def _build_pyg_data(self, nodes, edges):
        # Build address to index mapping
        address_to_idx = {node['address']: i for i, node in enumerate(nodes)}
        
        # Node features
        node_features = []
        for node in nodes:
            features = [
                node['tx_count'],
                node['total_sent'],
                node['total_received'],
                # ... more features
            ]
            node_features.append(features)
        
        x = torch.tensor(node_features, dtype=torch.float)
        
        # Edge index
        edge_index = []
        edge_attr = []
        for edge in edges:
            from_idx = address_to_idx.get(edge['from'])
            to_idx = address_to_idx.get(edge['to'])
            
            if from_idx is not None and to_idx is not None:
                edge_index.append([from_idx, to_idx])
                edge_attr.append([edge['value']])
        
        edge_index = torch.tensor(edge_index, dtype=torch.long).t().contiguous()
        edge_attr = torch.tensor(edge_attr, dtype=torch.float)
        
        # Labels (if available)
        y = self._load_labels(nodes)
        
        return Data(x=x, edge_index=edge_index, edge_attr=edge_attr, y=y)
    
    def _load_labels(self, nodes):
        # Load labels from label files or Neo4j tags
        labels = []
        for node in nodes:
            # Check if address is in label dataset
            label = self._check_label(node['address'])
            labels.append(label)
        
        return torch.tensor(labels, dtype=torch.long)
```

### Node Features

**Feature Engineering**:

| Category | Features | Source |
|----------|----------|--------|
| **Transaction Stats** | tx_count, sent_count, received_count, avg_value | Hudi |
| **Balance** | current_balance, max_balance | Hudi |
| **Temporal** | address_age_days, last_active_days | Hudi |
| **Graph Stats** | in_degree, out_degree, pagerank, clustering_coef | Neo4j |
| **Ratios** | sent_ratio, round_amount_ratio | Hudi |

**Feature Normalization**:
```python
from sklearn.preprocessing import StandardScaler

scaler = StandardScaler()
x_normalized = scaler.fit_transform(x)
```

### Train/Val/Test Split

**Strategy**: Temporal split (realistic for time-series data)

```python
# Split by timestamp
train_mask = data.timestamp < '2024-01-01'
val_mask = (data.timestamp >= '2024-01-01') & (data.timestamp < '2024-07-01')
test_mask = data.timestamp >= '2024-07-01'

data.train_mask = train_mask
data.val_mask = val_mask
data.test_mask = test_mask
```

## Training Pipeline

### Supervised Training (Node Classification)

**Task**: Binary classification (risky vs. normal)

```python
# ml-training/src/train_gnn.py

import torch
import torch.nn.functional as F
from torch_geometric.loader import NeighborLoader
from sklearn.metrics import roc_auc_score, precision_recall_fscore_support

def train_graphsage(model, data, config):
    optimizer = torch.optim.Adam(
        model.parameters(), 
        lr=config['learning_rate'],
        weight_decay=config['weight_decay']
    )
    
    # Mini-batch training
    train_loader = NeighborLoader(
        data,
        num_neighbors=config['neighbor_samples'],
        batch_size=config['batch_size'],
        input_nodes=data.train_mask,
    )
    
    for epoch in range(config['epochs']):
        model.train()
        total_loss = 0
        
        for batch in train_loader:
            optimizer.zero_grad()
            
            out = model(batch.x, batch.edge_index)
            loss = F.cross_entropy(out[batch.train_mask], batch.y[batch.train_mask])
            
            loss.backward()
            optimizer.step()
            
            total_loss += loss.item()
        
        # Validation
        val_auc = evaluate(model, data, data.val_mask)
        
        print(f'Epoch {epoch+1}: Loss={total_loss:.4f}, Val AUC={val_auc:.4f}')
    
    return model

def evaluate(model, data, mask):
    model.eval()
    
    with torch.no_grad():
        out = model(data.x, data.edge_index)
        pred = F.softmax(out, dim=1)[:, 1]  # Probability of risky class
        
        y_true = data.y[mask].cpu().numpy()
        y_pred = pred[mask].cpu().numpy()
        
        auc = roc_auc_score(y_true, y_pred)
    
    return auc
```

### Unsupervised Training (Node Embedding)

**Task**: Learn node embeddings without labels (for anomaly detection)

```python
# ml-training/src/train_gnn_unsupervised.py

from torch_geometric.nn import Node2Vec

def train_node2vec(data, config):
    """
    Alternative: Node2Vec for unsupervised embeddings
    """
    model = Node2Vec(
        data.edge_index,
        embedding_dim=config['embedding_dim'],
        walk_length=config['walk_length'],
        context_size=config['context_size'],
        walks_per_node=config['walks_per_node'],
    )
    
    loader = model.loader(batch_size=config['batch_size'], shuffle=True)
    optimizer = torch.optim.Adam(model.parameters(), lr=config['learning_rate'])
    
    for epoch in range(config['epochs']):
        model.train()
        total_loss = 0
        
        for pos_rw, neg_rw in loader:
            optimizer.zero_grad()
            loss = model.loss(pos_rw, neg_rw)
            loss.backward()
            optimizer.step()
            
            total_loss += loss.item()
        
        print(f'Epoch {epoch+1}: Loss={total_loss:.4f}')
    
    # Generate embeddings
    embeddings = model()
    return embeddings
```

### Self-Supervised Training (Contrastive Learning)

**Task**: Learn representations via graph augmentation

```python
# Future enhancement: GraphCL, SimCLR for graphs
```

## Model Serving

### Embedding Generation

**Batch Process**: Generate embeddings for all addresses

```python
# processing/batch-processor/src/main/python/gnn_embedding_job.py

from pyspark.sql import SparkSession
import torch

def generate_embeddings_batch(model_path, graph_path, output_path):
    # Load model
    model = torch.load(model_path)
    model.eval()
    
    # Load graph
    data = torch.load(graph_path)
    
    # Generate embeddings
    with torch.no_grad():
        embeddings = model(data.x, data.edge_index)
    
    # Convert to DataFrame
    embedding_df = pd.DataFrame(
        embeddings.cpu().numpy(),
        columns=[f'emb_{i}' for i in range(embeddings.shape[1])]
    )
    embedding_df['address'] = data.addresses
    
    # Write to Hudi
    spark = SparkSession.builder.getOrCreate()
    spark_df = spark.createDataFrame(embedding_df)
    
    spark_df.write.format("hudi") \
        .option("hoodie.table.name", "address_embeddings") \
        .mode("overwrite") \
        .save(output_path)
```

### Real-time Inference

**Challenge**: GNN requires graph structure (neighbors)

**Solution 1**: Pre-computed embeddings (fast, but static)
```python
# risk-ml-service/app/ml/gnn_predictor.py

class GNNPredictor:
    def __init__(self, embedding_store):
        self.embedding_store = embedding_store  # Redis or PostgreSQL
    
    async def predict(self, address: str) -> float:
        # Fetch pre-computed embedding
        embedding = await self.embedding_store.get(address)
        
        if embedding is None:
            return None
        
        # Use embedding for downstream task (e.g., MLP classifier)
        risk_score = self.classifier(embedding)
        return risk_score
```

**Solution 2**: Online inference with neighbor sampling (slower, but dynamic)
```python
class GNNOnlinePredictor:
    def __init__(self, model, neo4j_client):
        self.model = model
        self.neo4j_client = neo4j_client
    
    async def predict(self, address: str) -> float:
        # Fetch k-hop neighbors from Neo4j
        subgraph = await self.neo4j_client.get_subgraph(address, hops=2)
        
        # Convert to PyG Data
        data = self._to_pyg_data(subgraph)
        
        # Inference
        with torch.no_grad():
            out = self.model(data.x, data.edge_index)
            risk_score = F.softmax(out, dim=1)[0, 1].item()
        
        return risk_score
```

**Recommendation**: Use Solution 1 (pre-computed embeddings) for production, Solution 2 for experiments.

## Ensemble Strategy

### Multi-Model Fusion

```python
# risk-ml-service/app/ml/ensemble.py

class MultiModelEnsemble:
    def __init__(self, xgb_model, if_model, gnn_model, rule_engine):
        self.xgb = xgb_model
        self.isolation_forest = if_model
        self.gnn = gnn_model
        self.rule_engine = rule_engine
    
    async def predict(self, address: str) -> dict:
        # Fetch features
        features = await self.feature_client.get_features(address)
        
        # XGBoost
        xgb_score = self.xgb.predict_proba(features)[0, 1] if features else None
        
        # Isolation Forest
        if_score = self.isolation_forest.score_samples(features)[0] if features else None
        if_score = self._normalize_if_score(if_score)
        
        # GNN
        gnn_score = await self.gnn.predict(address)
        
        # Rule Engine
        rule_score = await self.rule_engine.evaluate(address)
        
        # Ensemble
        final_score = self._weighted_average(
            xgb_score, if_score, gnn_score, rule_score
        )
        
        return {
            'final_score': final_score,
            'xgb_score': xgb_score,
            'if_score': if_score,
            'gnn_score': gnn_score,
            'rule_score': rule_score,
        }
    
    def _weighted_average(self, xgb, if_score, gnn, rule):
        weights = {'xgb': 0.3, 'if': 0.2, 'gnn': 0.3, 'rule': 0.2}
        
        scores = []
        ws = []
        
        if xgb is not None:
            scores.append(xgb)
            ws.append(weights['xgb'])
        if if_score is not None:
            scores.append(if_score)
            ws.append(weights['if'])
        if gnn is not None:
            scores.append(gnn)
            ws.append(weights['gnn'])
        if rule is not None:
            scores.append(rule)
            ws.append(weights['rule'])
        
        if not scores:
            return None
        
        # Normalize weights
        ws = [w / sum(ws) for w in ws]
        
        return sum(s * w for s, w in zip(scores, ws))
```

## Development Phases

### Phase 1: Infrastructure Setup (Week 1)

- [ ] Install PyTorch Geometric
- [ ] Set up `ml-training/src/gnn/` directory
- [ ] Neo4j to PyG data loader
- [ ] Feature engineering pipeline
- [ ] Train/val/test split

**Deliverables**:
- Graph data loader working
- PyG Data object created

### Phase 2: Baseline GNN Model (Week 2)

- [ ] Implement GCN baseline
- [ ] Implement GraphSAGE
- [ ] Training script
- [ ] Evaluation metrics (AUC, Precision, Recall)
- [ ] Model checkpointing

**Deliverables**:
- Trained GNN models
- Performance benchmarks

### Phase 3: Embedding Generation (Week 3)

- [ ] Batch embedding generation (Spark/Python)
- [ ] Store embeddings in Hudi
- [ ] Embedding API (query by address)
- [ ] Embedding visualization (t-SNE)

**Deliverables**:
- Address embeddings in Hudi
- Embedding query API

### Phase 4: Model Serving (Week 4)

- [ ] GNN predictor in risk-ml-service
- [ ] Pre-computed embedding lookup
- [ ] Online inference (optional)
- [ ] Model registry (MinIO)
- [ ] Hot reload mechanism

**Deliverables**:
- GNN inference in production
- Model versioning

### Phase 5: Ensemble Integration (Week 5)

- [ ] Multi-model ensemble
- [ ] Weighted averaging
- [ ] A/B testing framework
- [ ] Performance comparison

**Deliverables**:
- Ensemble model in production
- Performance metrics

### Phase 6: Advanced Features (Week 6+)

- [ ] GAT (attention mechanism)
- [ ] Temporal GNN (dynamic graphs)
- [ ] Explainability (GNNExplainer)
- [ ] Subgraph pattern detection
- [ ] Continuous learning

**Deliverables**:
- Advanced GNN models
- Explainability tools

## Directory Structure

```
ml-training/
├── src/
│   ├── gnn/                          # NEW: GNN module
│   │   ├── __init__.py
│   │   ├── models.py                 # GraphSAGE, GCN, GAT
│   │   ├── graph_loader.py           # Neo4j → PyG
│   │   ├── feature_builder.py        # Node feature engineering
│   │   ├── train_supervised.py       # Supervised training
│   │   ├── train_unsupervised.py     # Node2Vec, GraphCL
│   │   ├── evaluate.py               # Evaluation metrics
│   │   └── embedding_generator.py    # Batch embedding generation
│   │
│   ├── data_loader.py                # Existing: Trino/PG loader
│   ├── train_supervised.py           # Existing: XGBoost
│   └── train_unsupervised.py         # Existing: Isolation Forest
│
├── configs/
│   ├── training_config.yaml          # Existing config
│   └── gnn_config.yaml               # NEW: GNN config
│
├── notebooks/
│   ├── 04_gnn_experiments.ipynb      # NEW: GNN experiments
│   └── 05_embedding_visualization.ipynb
│
└── models/
    ├── xgboost/
    ├── isolation_forest/
    └── gnn/                          # NEW: GNN models
        ├── graphsage/
        │   ├── v1/
        │   │   ├── model.pt
        │   │   └── metadata.json
        │   └── latest.json
        └── gcn/

services/risk-ml-service/
└── app/
    └── ml/
        ├── gnn_predictor.py          # NEW: GNN inference
        ├── embedding_store.py        # NEW: Embedding cache
        └── ensemble.py               # UPDATED: Add GNN

processing/batch-processor/
└── src/main/python/                  # NEW: Python Spark jobs
    ├── gnn_embedding_job.py          # Batch embedding generation
    └── gnn_inference_job.py          # Batch risk scoring
```

## Configuration

### gnn_config.yaml

```yaml
data:
  neo4j_uri: bolt://localhost:17687
  neo4j_user: neo4j
  neo4j_password: chainrisk123
  graph_limit: 100000           # Number of nodes to load
  feature_dim: 16               # Node feature dimension

model:
  type: graphsage               # graphsage, gcn, gat
  hidden_channels: 64
  out_channels: 32              # Embedding dimension
  num_layers: 3
  dropout: 0.5
  aggregator: mean              # mean, max, lstm

training:
  epochs: 100
  batch_size: 512
  learning_rate: 0.001
  weight_decay: 5e-4
  neighbor_samples: [10, 5]     # 2-hop sampling
  early_stopping_patience: 10

evaluation:
  metrics:
    - auc
    - precision
    - recall
    - f1

output:
  model_path: models/gnn/graphsage/v1/model.pt
  embedding_path: data/embeddings/graphsage_v1.pt
  hudi_path: s3://ml-models/embeddings/
```

## Evaluation Metrics

### Node Classification

```python
from sklearn.metrics import (
    roc_auc_score, 
    precision_recall_fscore_support,
    confusion_matrix
)

def evaluate_classification(y_true, y_pred, y_prob):
    auc = roc_auc_score(y_true, y_prob)
    precision, recall, f1, _ = precision_recall_fscore_support(
        y_true, y_pred, average='binary'
    )
    cm = confusion_matrix(y_true, y_pred)
    
    return {
        'auc': auc,
        'precision': precision,
        'recall': recall,
        'f1': f1,
        'confusion_matrix': cm,
    }
```

### Embedding Quality

```python
from sklearn.metrics import silhouette_score

def evaluate_embeddings(embeddings, labels):
    # Silhouette score (higher is better)
    silhouette = silhouette_score(embeddings, labels)
    
    # Embedding visualization
    from sklearn.manifold import TSNE
    tsne = TSNE(n_components=2, random_state=42)
    embeddings_2d = tsne.fit_transform(embeddings)
    
    return {
        'silhouette_score': silhouette,
        'embeddings_2d': embeddings_2d,
    }
```

## Challenges & Solutions

### Challenge 1: Large Graph Scalability

**Problem**: Full graph doesn't fit in GPU memory

**Solutions**:
1. **Mini-batch training**: NeighborLoader with sampling
2. **Graph partitioning**: Cluster-GCN
3. **Sampling strategies**: GraphSAINT, FastGCN

### Challenge 2: Dynamic Graph

**Problem**: Graph changes over time (new transactions)

**Solutions**:
1. **Periodic retraining**: Daily/weekly batch retraining
2. **Incremental learning**: Fine-tune on new data
3. **Temporal GNN**: TGN, TGAT (future work)

### Challenge 3: Label Scarcity

**Problem**: Limited labeled risky addresses

**Solutions**:
1. **Semi-supervised learning**: Use unlabeled data
2. **Self-supervised learning**: Contrastive learning
3. **Active learning**: Prioritize labeling high-uncertainty nodes
4. **Data augmentation**: Graph augmentation techniques

### Challenge 4: Real-time Inference

**Problem**: GNN inference requires neighbors (slow)

**Solutions**:
1. **Pre-computed embeddings**: Batch generation + cache
2. **Approximate inference**: Sampling fewer neighbors
3. **Model distillation**: Distill GNN to MLP

## Monitoring & Metrics

### Training Metrics

```python
# Track in MLflow or TensorBoard
metrics = {
    'train_loss': train_loss,
    'val_loss': val_loss,
    'val_auc': val_auc,
    'val_precision': val_precision,
    'val_recall': val_recall,
    'epoch_time': epoch_time,
}
```

### Inference Metrics

```python
# Prometheus metrics
gnn_inference_latency = Histogram(
    'gnn_inference_duration_seconds',
    'GNN inference latency'
)

gnn_predictions_total = Counter(
    'gnn_predictions_total',
    'Total GNN predictions'
)
```

## Future Enhancements

- [ ] Temporal GNN (TGN, TGAT) for dynamic graphs
- [ ] Heterogeneous GNN (address, transaction, contract nodes)
- [ ] Explainability (GNNExplainer, PGExplainer)
- [ ] Subgraph pattern mining (gSpan, FFSM)
- [ ] Graph generation (VAE, GAN) for synthetic data
- [ ] Federated learning for privacy-preserving training
- [ ] Graph reinforcement learning for active defense

## References

### Papers

- GraphSAGE: [Hamilton et al., 2017](https://arxiv.org/abs/1706.02216)
- GCN: [Kipf & Welling, 2017](https://arxiv.org/abs/1609.02907)
- GAT: [Veličković et al., 2018](https://arxiv.org/abs/1710.10903)
- Node2Vec: [Grover & Leskovec, 2016](https://arxiv.org/abs/1607.00653)

### Documentation

- [PyTorch Geometric](https://pytorch-geometric.readthedocs.io/)
- [ML Risk Model Architecture](../architecture/ML_RISK_MODEL_ARCHITECTURE.md)
- [Development Plan](./DEVELOPMENT_PLAN.md)

---

**Last Updated**: 2026-01-09
