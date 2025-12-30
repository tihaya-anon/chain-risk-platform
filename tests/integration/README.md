# Integration Tests

This directory contains integration tests for the Chain Risk Platform data pipeline.

## Overview

The integration test validates the complete data flow:

```
Mock Etherscan Server → data-ingestion → Kafka → stream-processor → PostgreSQL
```

## Components

### Mock Etherscan Server (`mock_server/`)

A Go HTTP server that simulates the Etherscan API, providing predictable test data.

**Features:**
- Simulates `eth_blockNumber` - returns latest block number
- Simulates `eth_getBlockByNumber` - returns mock blocks with transactions
- Generates deterministic test data based on block number
- Includes both native ETH transfers and ERC20 transfers

**Usage:**
```bash
cd mock_server
go run main.go -port 8545 -start-block 1000 -num-blocks 10
```

**Parameters:**
- `-port`: HTTP server port (default: 8545)
- `-start-block`: Starting block number (default: 1000)
- `-num-blocks`: Number of blocks to simulate (default: 10)

### Test Fixtures (`fixtures/`)

Contains predefined test data files for specific test scenarios.

### Test Scripts (`scripts/`)

#### `run_integration_test.sh`

Main integration test script that:
1. Checks prerequisites (Docker, Go, running containers)
2. Clears existing test data from PostgreSQL
3. Starts the Mock Etherscan Server
4. Runs data-ingestion service pointing to mock server
5. Runs Flink stream-processor to process Kafka messages
6. Verifies data in PostgreSQL
7. Prints sample data for inspection

## Prerequisites

1. **Docker containers running:**
   ```bash
   docker-compose up -d
   ```

2. **Go 1.21+ installed**

3. **Java 17+ and Maven installed** (for Flink)

4. **PostgreSQL client (psql) installed**

## Running Tests

### Full Integration Test

```bash
cd tests/integration/scripts
./run_integration_test.sh
```

### Manual Testing

1. **Start Mock Server:**
   ```bash
   cd tests/integration/mock_server
   go run main.go -port 8545 -start-block 1000 -num-blocks 10
   ```

2. **Run data-ingestion:**
   ```bash
   cd data-ingestion
   ETHERSCAN_BASE_URL="http://localhost:8545/api?" \
   ETHERSCAN_API_KEY="test" \
   KAFKA_BROKERS="localhost:19092" \
   go run ./cmd/ingestion
   ```

3. **Run stream-processor:**
   ```bash
   cd processing/stream-processor
   mvn clean package -DskipTests
   java -jar target/stream-processor-1.0-SNAPSHOT.jar \
     --kafka.brokers localhost:19092 \
     --jdbc.url jdbc:postgresql://localhost:15432/chainrisk
   ```

4. **Verify data:**
   ```bash
   PGPASSWORD=chainrisk123 psql -h localhost -p 15432 -U chainrisk -d chainrisk -c \
     "SELECT COUNT(*) FROM chain_data.transfers"
   ```

## Expected Results

For 10 blocks with ~3 transactions each:
- **Transfers:** ~30 records (native + ERC20)
- **Transactions:** ~30 records
- **Processing State:** 1 record per network

## Test Data Format

### Mock Block Structure
```json
{
  "number": "0x3e8",
  "hash": "0x00000000000000000000000000000000000000000000000000000000000003e8",
  "timestamp": "0x65b0a300",
  "transactions": [
    {
      "hash": "0x...",
      "from": "0x...",
      "to": "0x...",
      "value": "0xde0b6b3a7640000",
      "input": "0x"
    }
  ]
}
```

### ERC20 Transfer Detection
Transactions with `input` starting with `0xa9059cbb` (transfer method) or `0x23b872dd` (transferFrom) are parsed as ERC20 transfers.

## Troubleshooting

### Kafka Connection Issues
```bash
# Check Kafka is running
docker ps | grep kafka

# Check topic exists
docker exec -it kafka kafka-topics.sh --list --bootstrap-server localhost:9092
```

### PostgreSQL Connection Issues
```bash
# Check PostgreSQL is running
docker ps | grep postgres

# Test connection
PGPASSWORD=chainrisk123 psql -h localhost -p 15432 -U chainrisk -d chainrisk -c "SELECT 1"
```

### No Data in Database
1. Check Kafka messages:
   ```bash
   docker exec -it kafka kafka-console-consumer.sh \
     --bootstrap-server localhost:9092 \
     --topic chain-transactions \
     --from-beginning \
     --max-messages 5
   ```

2. Check Flink logs for errors

3. Verify mock server is returning data:
   ```bash
   curl "http://localhost:8545/api?module=proxy&action=eth_blockNumber"
   ```
