# Mempool Collector

Real-time Ethereum mempool collector for MEV detection.

## Features

- WebSocket subscription to `newPendingTransactions`
- Auto-reconnect with exponential backoff
- DEX swap method detection
- Kafka producer with batching
- Prometheus metrics

## Usage

```bash
# Local
go run ./cmd -config ./configs/config.yaml

# Docker
docker build -t mempool-collector .
docker run -e ETHEREUM_WS_URL=ws://geth:8546 mempool-collector
```

## Configuration

| Env | Description | Default |
|-----|-------------|---------|
| ETHEREUM_WS_URL | Geth/Erigon WebSocket URL | ws://localhost:8546 |
| KAFKA_BROKERS | Kafka brokers | localhost:19092 |

## Metrics

| Metric | Description |
|--------|-------------|
| mempool_collector_tx_received_total | Transactions received |
| mempool_collector_tx_processed_total | Transactions processed |
| mempool_collector_kafka_produced_total | Messages to Kafka |
| mempool_collector_connection_status | Connection status |

## Output

Kafka topic `mempool-pending-txs`:

```json
{
  "hash": "0x...",
  "from": "0x...",
  "to": "0x...",
  "value": "1000000000000000000",
  "gas": 21000,
  "gas_price": "50000000000",
  "input": "0x...",
  "method_id": "0x38ed1739",
  "timestamp": 1705234567890,
  "network": "ethereum"
}
```
