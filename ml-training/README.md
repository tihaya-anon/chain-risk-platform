# ML Training

ML training pipeline for Chain Risk Platform risk scoring models.

## Setup

```bash
cd ml-training
uv sync
```

## Directory Structure

```
ml-training/
├── configs/
│   └── training_config.yaml    # Training configuration
├── data/
│   ├── labels/                 # Label datasets (CSV)
│   └── features/               # Exported features (Parquet)
├── models/                     # Trained model outputs
├── notebooks/                  # Jupyter notebooks
└── src/
    ├── data_loader.py          # Load data from Trino/PG/Parquet
    ├── feature_builder.py      # Feature computation logic
    ├── model_registry.py       # MinIO model storage
    ├── train_supervised.py     # XGBoost training
    └── train_unsupervised.py   # Isolation Forest training
```

## Usage

### Train XGBoost (Supervised)

```bash
cd ml-training
uv run python src/train_supervised.py --version v1

# With MinIO upload
uv run python src/train_supervised.py --version v1 --upload
```

### Train Isolation Forest (Unsupervised)

```bash
uv run python src/train_unsupervised.py --version v1

# With MinIO upload
uv run python src/train_unsupervised.py --version v1 --upload
```

## Data Sources

### Features

Configure data source in `configs/training_config.yaml`:

- **trino**: Query Hudi tables via Trino (production)
- **postgres**: Query PostgreSQL directly
- **parquet**: Local Parquet files (development)

### Labels

Place CSV files in `data/labels/`:

| File | Description | Label |
|------|-------------|-------|
| `ofac_addresses.csv` | OFAC sanctioned addresses | 1 (risky) |
| `chainalysis_sanctions.csv` | Chainalysis flagged addresses | 1 |
| `tornado_cash.csv` | Tornado Cash related addresses | 1 |
| `known_exchanges.csv` | Known exchange addresses | 0 (normal) |

CSV format: `address` column required.

## Model Registry (MinIO)

Models are stored in MinIO bucket `ml-models/`:

```
ml-models/
├── xgboost/
│   ├── v1/
│   │   ├── model.pkl
│   │   └── metadata.json
│   └── latest.json
└── isolation_forest/
    ├── v1/
    │   ├── model.pkl
    │   └── metadata.json
    └── latest.json
```

## Features (V1)

16 features used for initial model:

| Category | Features |
|----------|----------|
| Transaction Stats | tx_count, sent_count, received_count, unique_counterparties |
| Value Stats | avg_tx_value, max_tx_value, tx_value_stddev |
| Time | address_age_days |
| Ratios | sent_ratio, round_amount_ratio, small_tx_ratio, large_tx_ratio |
| Graph | in_degree, out_degree, in_out_ratio, unique_in_neighbors |
