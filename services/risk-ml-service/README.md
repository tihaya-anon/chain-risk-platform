# Risk ML Service

Machine learning-based risk scoring service for blockchain addresses.

## Features

- **Rule-Based Scoring**: Configurable risk rules with weighted scoring
- **ML Model Integration**: Support for scikit-learn, XGBoost, and PyTorch models
- **Async Processing**: High-performance async API with FastAPI
- **Model Registry**: Load models from MinIO object storage
- **Feature Engineering**: Real-time feature computation
- **Batch Scoring**: Score multiple addresses in parallel
- **Caching**: Redis caching for computed scores
- **Prometheus Metrics**: Built-in metrics for monitoring
- **OpenTelemetry**: Distributed tracing support
- **Nacos Integration**: Service discovery and dynamic configuration

## Architecture

```
Client → Risk ML Service → PostgreSQL (features)
              ↓
          Redis Cache
              ↓
        MinIO (models)
              ↓
          Prometheus
```

## Technology Stack

- **Language**: Python 3.10+
- **Framework**: FastAPI (async)
- **ML Libraries**: scikit-learn, XGBoost, PyTorch, PyTorch Geometric
- **Database**: PostgreSQL (via asyncpg + SQLAlchemy)
- **Cache**: Redis
- **Model Storage**: MinIO
- **Service Discovery**: Nacos
- **Metrics**: Prometheus
- **Tracing**: OpenTelemetry
- **Package Manager**: uv

## Quick Start

### Prerequisites

- Python 3.10-3.12
- PostgreSQL 15+
- Redis 7+
- MinIO (for model storage)
- Nacos (optional, for service discovery)

### Installation

```bash
# Install uv (if not already installed)
curl -LsSf https://astral.sh/uv/install.sh | sh

# Install dependencies
uv sync

# Install with ML dependencies
uv sync --extra ml

# Install with dev dependencies
uv sync --extra dev
```

### Configuration

Configuration is loaded from:
1. `configs/config.yaml` - Default configuration
2. Environment variables (override config file)
3. Nacos (if enabled) - Dynamic configuration

### Running

```bash
# Development
uv run uvicorn app.main:app --reload --host 0.0.0.0 --port 8082

# Production
uv run uvicorn app.main:app --host 0.0.0.0 --port 8082 --workers 4
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `SERVER_PORT` | HTTP server port | 8082 |
| `POSTGRES_HOST` | PostgreSQL host | localhost |
| `POSTGRES_PORT` | PostgreSQL port | 15432 |
| `POSTGRES_DB` | Database name | chainrisk |
| `POSTGRES_USER` | Database user | chainrisk |
| `POSTGRES_PASSWORD` | Database password | chainrisk123 |
| `REDIS_HOST` | Redis host | localhost |
| `REDIS_PORT` | Redis port | 16379 |
| `MINIO_ENDPOINT` | MinIO endpoint | localhost:19000 |
| `MINIO_ACCESS_KEY` | MinIO access key | minioadmin |
| `MINIO_SECRET_KEY` | MinIO secret key | minioadmin123 |
| `NACOS_SERVER_ADDR` | Nacos server address | localhost:18848 |
| `NACOS_NAMESPACE` | Nacos namespace | dev |

## API Endpoints

### Risk Scoring

```
POST   /api/v1/risk/score              Score single address
POST   /api/v1/risk/score/batch        Score multiple addresses
GET    /api/v1/risk/rules              Get risk rules
POST   /api/v1/risk/rules              Create risk rule
PUT    /api/v1/risk/rules/:id          Update risk rule
DELETE /api/v1/risk/rules/:id          Delete risk rule
```

### Model Management

```
GET    /api/v1/models                  List available models
GET    /api/v1/models/:name            Get model info
POST   /api/v1/models/:name/load       Load model from MinIO
POST   /api/v1/models/:name/predict    Predict with specific model
```

### Health & Metrics

```
GET    /health                         Health check
GET    /metrics                        Prometheus metrics
GET    /docs                           Swagger API documentation
```

## API Examples

### Score Single Address

```bash
curl -X POST http://localhost:8082/api/v1/risk/score \
  -H "Content-Type: application/json" \
  -d '{
    "address": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
    "network": "ethereum",
    "includeFactors": true
  }'
```

Response:
```json
{
  "address": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
  "network": "ethereum",
  "score": 0.75,
  "category": "HIGH",
  "factors": {
    "transaction_volume": 0.8,
    "counterparty_risk": 0.7,
    "address_age": 0.3,
    "tag_risk": 0.9
  },
  "model_version": "v1.0",
  "computed_at": "2024-01-30T12:00:00Z"
}
```

### Batch Scoring

```bash
curl -X POST http://localhost:8082/api/v1/risk/score/batch \
  -H "Content-Type: application/json" \
  -d '{
    "addresses": [
      "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
      "0xdAC17F958D2ee523a2206206994597C13D831ec7"
    ],
    "network": "ethereum"
  }'
```

## Risk Scoring Methods

### 1. Rule-Based Scoring

Configurable rules with weighted scoring:

```yaml
rules:
  - name: high_transaction_volume
    weight: 0.3
    condition: tx_count > 1000
    score: 0.8

  - name: sanctioned_counterparty
    weight: 0.5
    condition: has_sanctioned_interaction
    score: 1.0

  - name: mixer_usage
    weight: 0.4
    condition: has_mixer_interaction
    score: 0.9
```

### 2. ML Model Scoring

Supports multiple model types:

#### XGBoost Model
```python
# Load model from MinIO
model = load_model("xgboost_v1")

# Compute features
features = compute_features(address)

# Predict
score = model.predict(features)
```

#### PyTorch Neural Network
```python
# Load model
model = load_model("neural_net_v1")

# Predict
score = model(features).item()
```

#### Graph Neural Network (PyTorch Geometric)
```python
# Load GNN model
model = load_model("gnn_v1")

# Get graph data from Neo4j
graph_data = get_graph_data(address)

# Predict
score = model(graph_data).item()
```

## Feature Engineering

### Address Features (16 features)

| Category | Features |
|----------|----------|
| **Transaction Stats** | tx_count, sent_count, received_count, unique_counterparties |
| **Value Stats** | avg_tx_value, max_tx_value, tx_value_stddev |
| **Time** | address_age_days, days_since_last_tx |
| **Ratios** | sent_ratio, round_amount_ratio, small_tx_ratio, large_tx_ratio |
| **Graph** | in_degree, out_degree, in_out_ratio, unique_in_neighbors |

### Feature Computation

```python
# Fetch from PostgreSQL
features = await compute_features(address, network)

# Cache in Redis (TTL: 5 minutes)
await cache.set(f"features:{address}", features, ttl=300)
```

## Model Registry

Models are stored in MinIO bucket `ml-models/`:

```
ml-models/
├── xgboost/
│   ├── v1/
│   │   ├── model.pkl
│   │   └── metadata.json
│   └── latest.json
├── neural_net/
│   ├── v1/
│   │   ├── model.pt
│   │   └── metadata.json
│   └── latest.json
└── gnn/
    ├── v1/
    │   ├── model.pt
    │   └── metadata.json
    └── latest.json
```

## Caching Strategy

### Cache Keys

- `risk_score:{network}:{address}` - Risk score (TTL: 5 minutes)
- `features:{network}:{address}` - Computed features (TTL: 5 minutes)
- `model:{name}:{version}` - Loaded model (TTL: 1 hour)

## Metrics

Exposed on `/metrics` endpoint:

| Metric | Type | Description |
|--------|------|-------------|
| `risk_service_requests_total` | Counter | Total HTTP requests |
| `risk_service_request_duration_seconds` | Histogram | Request latency |
| `risk_service_score_computations_total` | Counter | Risk score computations |
| `risk_service_model_predictions_total` | Counter | ML model predictions |
| `risk_service_cache_hits_total` | Counter | Cache hits |
| `risk_service_cache_misses_total` | Counter | Cache misses |

## Testing

```bash
# Run unit tests
uv run pytest

# Run tests with coverage
uv run pytest --cov=app --cov-report=html

# Run specific test
uv run pytest tests/test_risk_scoring.py
```

## Docker

```bash
# Build image
docker build -t risk-ml-service:latest .

# Run container
docker run -p 8082:8082 \
  -e POSTGRES_HOST=postgres \
  -e REDIS_HOST=redis \
  -e MINIO_ENDPOINT=minio:9000 \
  risk-ml-service:latest
```

## Related Services

- [BFF](../bff/README.md) - API Gateway
- [Query Service](../query-service/README.md) - Provides address data
- [Graph Service](../graph-service/README.md) - Provides graph features
- [ML Training](../../ml-training/README.md) - Model training pipeline

## License

MIT
