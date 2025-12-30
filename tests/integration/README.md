# Integration Tests

This directory contains integration tests for the Chain Risk Platform data pipeline.

## Overview

The integration test validates the complete data flow:

```
Mock Etherscan Server (local) → data-ingestion (local) → Kafka (remote) → stream-processor (local) → PostgreSQL (remote)
```

**Note**: The test runs services locally but connects to infrastructure (Kafka, PostgreSQL, etc.) on a remote Docker host.

## Environment Configuration

The test automatically reads configuration from:

1. **`.env.local`** - Contains `DOCKER_HOST_IP` (your remote Docker server IP)
2. **`scripts/env-remote.sh`** - Sets up all service connection URLs

Example `.env.local`:
```bash
DOCKER_HOST_IP=100.120.144.128
ETHERSCAN_API_KEY=your-api-key
```

### Remote Docker Ports

| Service    | Port  |
| ---------- | ----- |
| PostgreSQL | 15432 |
| Redis      | 16379 |
| Kafka      | 19092 |
| Neo4j HTTP | 17474 |
| Neo4j Bolt | 17687 |
| Nacos      | 18848 |

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

### Test Scripts (`scripts/`)

#### `run_integration_test.sh`

Main integration test script that:
1. Sources environment from `.env.local` and `env-remote.sh`
2. Checks prerequisites (Go, Java, Maven, psql, remote connections)
3. Clears existing test data from PostgreSQL
4. Starts the Mock Etherscan Server (locally)
5. Runs data-ingestion service pointing to mock server
6. Runs Flink stream-processor to process Kafka messages
7. Verifies data in PostgreSQL
8. Prints sample data for inspection

## Prerequisites

1. **Remote Docker containers running:**
   ```bash
   # Check infrastructure health
   ./scripts/check-infra.sh $DOCKER_HOST_IP
   ```

2. **Go 1.21+ installed**

3. **Java 17+ and Maven installed** (for Flink)

4. **PostgreSQL client (psql) installed**
   ```bash
   # macOS
   brew install postgresql
   ```

5. **netcat (nc) installed** (for Kafka connectivity check)

## Running Tests

### Full Integration Test

```bash
# Make sure .env.local has correct DOCKER_HOST_IP
cd tests/integration/scripts
./run_integration_test.sh
```

### Check Infrastructure First

```bash
# Verify all remote services are accessible
./scripts/check-infra.sh
```

### Manual Testing

1. **Source environment:**
   ```bash
   source .env.local
   source scripts/env-remote.sh
   ```

2. **Start Mock Server:**
   ```bash
   cd tests/integration/mock_server
   go run main.go -port 8545 -start-block 1000 -num-blocks 10
   ```

3. **Run data-ingestion:**
   ```bash
   cd data-ingestion
   ETHERSCAN_BASE_URL="http://localhost:8545/api?" \
   ETHERSCAN_API_KEY="test" \
   go run ./cmd/ingestion
   ```

4. **Run stream-processor:**
   ```bash
   cd processing/stream-processor
   mvn clean package -DskipTests
   java -jar target/stream-processor-1.0-SNAPSHOT.jar \
     --kafka.brokers $KAFKA_BROKERS \
     --jdbc.url jdbc:postgresql://$POSTGRES_HOST:$POSTGRES_PORT/chainrisk
   ```

5. **Verify data:**
   ```bash
   PGPASSWORD=chainrisk123 psql -h $POSTGRES_HOST -p $POSTGRES_PORT -U chainrisk -d chainrisk -c \
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

### Cannot Connect to Remote Docker

```bash
# Check if DOCKER_HOST_IP is set correctly
echo $DOCKER_HOST_IP

# Test connectivity
ping $DOCKER_HOST_IP

# Check all services
./scripts/check-infra.sh $DOCKER_HOST_IP
```

### Kafka Connection Issues
```bash
# Check Kafka is accessible
nc -z $DOCKER_HOST_IP 19092

# Check topic exists (if kcat installed)
kcat -b $DOCKER_HOST_IP:19092 -L
```

### PostgreSQL Connection Issues
```bash
# Test connection
PGPASSWORD=chainrisk123 psql -h $POSTGRES_HOST -p $POSTGRES_PORT -U chainrisk -d chainrisk -c "SELECT 1"

# Check schema exists
PGPASSWORD=chainrisk123 psql -h $POSTGRES_HOST -p $POSTGRES_PORT -U chainrisk -d chainrisk -c "\dt chain_data.*"
```

### No Data in Database
1. Check Kafka messages (if kcat installed):
   ```bash
   kcat -b $DOCKER_HOST_IP:19092 -t chain-transactions -C -c 5
   ```

2. Check Flink logs for errors

3. Verify mock server is returning data:
   ```bash
   curl "http://localhost:8545/api?module=proxy&action=eth_blockNumber"
   ```

### Schema Not Found
If `chain_data` schema doesn't exist, run the init script:
```bash
PGPASSWORD=chainrisk123 psql -h $POSTGRES_HOST -p $POSTGRES_PORT -U chainrisk -d chainrisk -f infra/postgres/init.sql
```
