# Risk ML Service

Risk scoring service with rule engine and ML models for blockchain address analysis.

## Features

- **Rule-based Risk Scoring**: Evaluate addresses against multiple risk rules
- **Batch Processing**: Score multiple addresses in a single request
- **Caching**: Redis caching for improved performance
- **Extensible**: Easy to add new rules or ML models

## Risk Rules

| Rule | Description | Weight |
|------|-------------|--------|
| `blacklist_check` | Known malicious address check | 2.0 |
| `high_frequency` | High transaction frequency detection | 1.0 |
| `large_transaction` | Large transaction detection | 1.2 |
| `new_address` | New address with high activity | 0.8 |
| `round_amounts` | Round transaction amount detection | 0.6 |

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/risk/score` | Score single address |
| POST | `/api/v1/risk/batch` | Score multiple addresses |
| GET | `/api/v1/risk/rules` | List all rules |
| GET | `/health` | Health check |
| GET | `/docs` | Swagger UI (dev only) |

## Setup

```bash
# Install dependencies
pip install -e .

# Or with ML dependencies
pip install -e ".[ml]"

# Run service
uvicorn app.main:app --reload --port 8082
```

## Configuration

Environment variables:

| Variable | Default | Description |
|----------|---------|-------------|
| `APP_ENV` | development | Environment (development/production) |
| `PORT` | 8082 | Service port |
| `POSTGRES_HOST` | localhost | PostgreSQL host |
| `POSTGRES_PORT` | 15432 | PostgreSQL port |
| `REDIS_HOST` | localhost | Redis host |
| `REDIS_PORT` | 16379 | Redis port |
| `QUERY_SERVICE_URL` | http://localhost:8081 | Query Service URL |
| `HIGH_RISK_THRESHOLD` | 0.7 | High risk score threshold |
| `MEDIUM_RISK_THRESHOLD` | 0.4 | Medium risk score threshold |
| `CACHE_TTL` | 300 | Cache TTL in seconds |

## Example Request

```bash
# Single address scoring
curl -X POST "http://localhost:8082/api/v1/risk/score" \
  -H "Content-Type: application/json" \
  -d '{"address": "0x742d35Cc6634C0532925a3b844Bc9e7595f1b7E0"}'

# Batch scoring
curl -X POST "http://localhost:8082/api/v1/risk/batch" \
  -H "Content-Type: application/json" \
  -d '{"addresses": ["0x742d35Cc6634C0532925a3b844Bc9e7595f1b7E0", "0x..."]}'
```
