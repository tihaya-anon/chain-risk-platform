# Query Service

RESTful API service for querying blockchain transaction data and address information.

## Features

- **Address Queries**: Get address details, transaction history, and statistics
- **Transfer Queries**: Query native and ERC20 token transfers
- **Transaction Queries**: Retrieve transaction details
- **Redis Caching**: High-performance caching layer
- **Prometheus Metrics**: Built-in metrics for monitoring
- **Nacos Integration**: Service discovery and dynamic configuration
- **Swagger API**: Interactive API documentation

## Architecture

```
Client → Query Service → PostgreSQL (OLTP)
              ↓
          Redis Cache
              ↓
          Prometheus
```

## Technology Stack

- **Language**: Go 1.23+
- **Framework**: Gin (HTTP router)
- **Database**: PostgreSQL 15+
- **Cache**: Redis 7+
- **Service Discovery**: Nacos
- **Metrics**: Prometheus
- **API Docs**: Swagger/OpenAPI

## Quick Start

### Prerequisites

- Go 1.23+
- PostgreSQL 15+
- Redis 7+
- Nacos (optional, for service discovery)

### Installation

```bash
# Install dependencies
go mod download

# Build
go build -o bin/query-service ./cmd/query

# Run
./bin/query-service
```

### Development

```bash
# Run with hot reload (if using air)
air

# Run directly
go run ./cmd/query
```

## Configuration

Configuration is loaded from:
1. `configs/config.yaml` - Default configuration
2. Environment variables (override config file)
3. Nacos (if enabled) - Dynamic configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `SERVER_PORT` | HTTP server port | 8081 |
| `POSTGRES_HOST` | PostgreSQL host | localhost |
| `POSTGRES_PORT` | PostgreSQL port | 15432 |
| `POSTGRES_DB` | Database name | chainrisk |
| `POSTGRES_USER` | Database user | chainrisk |
| `POSTGRES_PASSWORD` | Database password | chainrisk123 |
| `REDIS_HOST` | Redis host | localhost |
| `REDIS_PORT` | Redis port | 16379 |
| `REDIS_PASSWORD` | Redis password | - |
| `NACOS_SERVER_ADDR` | Nacos server address | localhost:18848 |
| `NACOS_NAMESPACE` | Nacos namespace | dev |

### Configuration File

See [configs/config.yaml](configs/config.yaml) for all available options.

## API Endpoints

### Address Endpoints

```
GET    /api/v1/addresses/:address              Get address info
GET    /api/v1/addresses/:address/transfers    Get address transfers
GET    /api/v1/addresses/:address/stats        Get address statistics
GET    /api/v1/addresses/:address/balance      Get address balance
```

### Transfer Endpoints

```
GET    /api/v1/transfers                       List transfers (paginated)
GET    /api/v1/transfers/:txHash               Get transfer by transaction hash
GET    /api/v1/transfers/block/:blockNumber    Get transfers by block
```

### Transaction Endpoints

```
GET    /api/v1/transactions/:txHash            Get transaction details
GET    /api/v1/transactions/block/:blockNumber Get transactions by block
```

### Health & Metrics

```
GET    /health                                 Health check
GET    /metrics                                Prometheus metrics
GET    /docs                                   Swagger API documentation
```

## API Examples

### Get Address Info

```bash
curl http://localhost:8081/api/v1/addresses/0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb
```

Response:
```json
{
  "address": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
  "network": "ethereum",
  "first_seen": "2024-01-01T00:00:00Z",
  "last_seen": "2024-01-30T12:00:00Z",
  "tx_count": 150,
  "total_sent": "1000000000000000000",
  "total_received": "2000000000000000000"
}
```

### Get Address Transfers

```bash
curl "http://localhost:8081/api/v1/addresses/0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb/transfers?page=1&limit=20"
```

### Get Transfer by Transaction Hash

```bash
curl http://localhost:8081/api/v1/transfers/0xabc123...
```

## Database Schema

The service queries the following PostgreSQL tables:

### transfers

| Column | Type | Description |
|--------|------|-------------|
| id | BIGSERIAL | Primary key |
| tx_hash | VARCHAR(66) | Transaction hash |
| block_number | BIGINT | Block number |
| from_address | VARCHAR(42) | Sender address |
| to_address | VARCHAR(42) | Receiver address |
| value | NUMERIC(78,0) | Transfer amount |
| token_address | VARCHAR(42) | Token contract (NULL for native) |
| transfer_type | VARCHAR(20) | native or erc20 |
| network | VARCHAR(20) | Blockchain network |
| timestamp | TIMESTAMP | Block timestamp |
| source | VARCHAR(10) | stream or batch |

### transactions

| Column | Type | Description |
|--------|------|-------------|
| tx_hash | VARCHAR(66) | Transaction hash (PK) |
| block_number | BIGINT | Block number |
| from_address | VARCHAR(42) | Sender |
| to_address | VARCHAR(42) | Receiver |
| value | NUMERIC(78,0) | Value |
| gas_used | BIGINT | Gas used |
| gas_price | NUMERIC(78,0) | Gas price |
| network | VARCHAR(20) | Network |

## Caching Strategy

### Cache Keys

- `address:{network}:{address}` - Address info (TTL: 5 minutes)
- `transfers:{network}:{address}:{page}:{limit}` - Address transfers (TTL: 2 minutes)
- `tx:{network}:{txHash}` - Transaction details (TTL: 10 minutes)

### Cache Invalidation

- Automatic expiration based on TTL
- Manual invalidation on data updates (if applicable)

## Metrics

Exposed on `/metrics` endpoint:

| Metric | Type | Description |
|--------|------|-------------|
| `query_service_requests_total` | Counter | Total HTTP requests by endpoint and status |
| `query_service_request_duration_seconds` | Histogram | Request latency distribution |
| `query_service_db_queries_total` | Counter | Database queries by table and operation |
| `query_service_db_query_duration_seconds` | Histogram | Database query latency |
| `query_service_cache_hits_total` | Counter | Cache hits |
| `query_service_cache_misses_total` | Counter | Cache misses |

## Testing

```bash
# Run unit tests
go test ./...

# Run tests with coverage
go test -cover ./...

# Run integration tests (requires PostgreSQL and Redis)
go test -tags=integration ./...
```

## Docker

```bash
# Build image
docker build -t query-service:latest .

# Run container
docker run -p 8081:8081 \
  -e POSTGRES_HOST=postgres \
  -e REDIS_HOST=redis \
  query-service:latest
```

## Troubleshooting

### Database Connection Issues

```bash
# Test PostgreSQL connection
psql -h localhost -p 15432 -U chainrisk -d chainrisk -c "SELECT 1"

# Check if schema exists
psql -h localhost -p 15432 -U chainrisk -d chainrisk -c "\dt chain_data.*"
```

### Redis Connection Issues

```bash
# Test Redis connection
redis-cli -h localhost -p 16379 ping

# Check cache keys
redis-cli -h localhost -p 16379 keys "address:*"
```

### High Latency

1. Check database query performance
2. Verify Redis cache is working
3. Check Prometheus metrics for slow queries
4. Consider adding database indexes

## Performance Tuning

### Database Connection Pool

```yaml
database:
  max_open_conns: 25
  max_idle_conns: 10
  conn_max_lifetime: 5m
```

### Redis Connection Pool

```yaml
redis:
  pool_size: 10
  min_idle_conns: 5
```

### Pagination Limits

```yaml
api:
  max_page_size: 100
  default_page_size: 20
```

## Related Services

- [BFF](../bff/README.md) - API Gateway that routes requests to this service
- [Stream Processor](../../processing/stream-processor/README.md) - Writes data to PostgreSQL
- [Batch Processor](../../processing/batch-processor/README.md) - Archives data to Hudi

## License

MIT
