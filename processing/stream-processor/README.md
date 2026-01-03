# Stream Processor - Lambda Architecture Speed Layer

> Real-time stream processing with Apache Flink - Dual-write to PostgreSQL + Neo4j

## 🎯 Overview

Part of the Lambda Architecture **Speed Layer**, this Flink job processes raw blockchain data from Kafka and implements a **dual-write strategy**:

1. **PostgreSQL** - For OLTP queries (Query Service)
2. **Neo4j** - For real-time graph analysis (Graph Engine)
3. **Kafka** - Notify downstream consumers (Graph Engine incremental analysis)

All data is marked with `source='stream'` for later batch correction by Spark.

---

## 🏗️ Architecture

```
Kafka (chain-transactions)
    │
    ▼
RawBlockDataDeserializer
    │
    ▼
TransferParser (FlatMap)
    │
    ├── Transaction → Native Transfer
    │
    └── ERC20 Logs → Token Transfer
    │
    ├─────────┬─────────┬─────────┐
    │         │         │         │
    ▼         ▼         ▼         ▼
PostgreSQL  Neo4j   Kafka    State Tracker
(OLTP)      (Graph) (Notify) (Monitoring)
```

---

## ✨ Features

### Dual-Write Strategy
- **PostgreSQL**: Stores transfers for OLTP queries
- **Neo4j**: Creates Address nodes and TRANSFER relationships for graph analysis
- **Kafka**: Publishes transfers to `transfers` topic for downstream consumers

### Data Marking
- All data marked with `source='stream'`
- Enables Spark batch layer to identify and correct stream data
- Supports eventual consistency in Lambda Architecture

### Fault Tolerance
- Flink checkpointing every 60 seconds
- Graceful error handling (no job failure on sink errors)
- Processing state tracking per network

---

## 🛠️ Technology Stack

- **Framework**: Apache Flink 1.18
- **Language**: Java 17
- **Message Queue**: Kafka
- **Databases**: PostgreSQL, Neo4j
- **Driver**: Neo4j Java Driver 5.14.0

---

## 📁 Project Structure

```
stream-processor/
├── src/main/java/com/chainrisk/stream/
│   ├── StreamProcessorApp.java           # Application entry
│   ├── job/
│   │   └── TransferExtractionJob.java    # Main Flink job (dual-write)
│   ├── model/
│   │   ├── RawBlockData.java             # Raw block model
│   │   ├── Transaction.java              # Transaction model
│   │   └── Transfer.java                 # Transfer model
│   ├── parser/
│   │   ├── RawBlockDataDeserializer.java # Kafka deserializer
│   │   ├── TransactionParser.java        # Transaction parser
│   │   └── TransferParser.java           # Transfer parser
│   ├── serializer/
│   │   └── TransferKafkaSerializer.java  # Kafka serializer for transfers
│   ├── sink/
│   │   ├── JdbcSinkFactory.java          # PostgreSQL sink factory
│   │   ├── Neo4jTransferSink.java        # Neo4j sink (dual-write)
│   │   └── ProcessingStateTracker.java   # State tracking
│   └── ...
├── src/main/resources/
│   ├── application.properties            # Configuration
│   └── logback.xml                       # Logging config
└── pom.xml
```

---

## 🚀 Quick Start

### Build

```bash
cd processing
mvn clean package -pl stream-processor -am
```

### Run Locally

```bash
# With default configuration
java -jar target/stream-processor-1.0.0-SNAPSHOT.jar

# With custom configuration
java -jar target/stream-processor-1.0.0-SNAPSHOT.jar \
  --kafka.brokers=localhost:19092 \
  --kafka.topic=chain-transactions \
  --jdbc.url=jdbc:postgresql://localhost:15432/chainrisk \
  --neo4j.uri=bolt://localhost:17687
```

### Run on Flink Cluster

```bash
flink run -c com.chainrisk.stream.StreamProcessorApp \
  target/stream-processor-1.0.0-SNAPSHOT.jar \
  --kafka.brokers=kafka:9092 \
  --neo4j.uri=bolt://neo4j:7687
```

---

## ⚙️ Configuration

### Kafka Configuration

| Parameter | Description | Default |
|-----------|-------------|---------|
| `kafka.brokers` | Kafka bootstrap servers | localhost:19092 |
| `kafka.topic` | Source topic (raw blocks) | chain-transactions |
| `kafka.group.id` | Consumer group ID | stream-processor |
| `kafka.transfers.brokers` | Kafka brokers for transfers topic | localhost:19092 |
| `kafka.transfers.topic` | Sink topic (transfers) | transfers |

### PostgreSQL Configuration

| Parameter | Description | Default |
|-----------|-------------|---------|
| `jdbc.url` | PostgreSQL JDBC URL | jdbc:postgresql://localhost:15432/chainrisk |
| `jdbc.user` | Database user | chainrisk |
| `jdbc.password` | Database password | chainrisk123 |

### Neo4j Configuration

| Parameter | Description | Default |
|-----------|-------------|---------|
| `neo4j.uri` | Neo4j Bolt URI | bolt://localhost:17687 |
| `neo4j.user` | Neo4j user | neo4j |
| `neo4j.password` | Neo4j password | chainrisk123 |

### Feature Flags

| Parameter | Description | Default |
|-----------|-------------|---------|
| `enable.neo4j.sink` | Enable dual-write to Neo4j | true |
| `enable.kafka.producer` | Enable Kafka producer for transfers | true |
| `enable.state.tracking` | Enable processing state tracking | true |

---

## 📊 Data Flow

### Input (Kafka)

```json
{
  "network": "ethereum",
  "blockNumber": 18000000,
  "timestamp": 1704240000,
  "transactions": [...]
}
```

### Output 1: PostgreSQL

```sql
INSERT INTO transfers (
    tx_hash, block_number, from_addr, to_addr, 
    amount, token_address, source, created_at
) VALUES (
    '0xabc...', 18000000, '0x123...', '0x456...',
    '1000000000000000000', NULL, 'stream', NOW()
)
ON CONFLICT (tx_hash, log_index) DO UPDATE SET
    source = 'stream', updated_at = NOW();
```

### Output 2: Neo4j

```cypher
// Create Address nodes
MERGE (from:Address {address: $fromAddr, network: $network})
ON CREATE SET from.source = 'stream', from.created_at = timestamp()

MERGE (to:Address {address: $toAddr, network: $network})
ON CREATE SET to.source = 'stream', to.created_at = timestamp()

// Create TRANSFER relationship
MERGE (from)-[r:TRANSFER {tx_hash: $txHash, log_index: $logIndex}]->(to)
ON CREATE SET r.source = 'stream', r.amount = $amount, r.timestamp = $timestamp
```

### Output 3: Kafka (transfers topic)

```json
{
  "txHash": "0xabc...",
  "blockNumber": 18000000,
  "fromAddress": "0x123...",
  "toAddress": "0x456...",
  "value": "1000000000000000000",
  "network": "ethereum",
  "transferType": "native"
}
```

---

## 🔍 Monitoring

### Metrics

- **Success Count**: Number of successfully processed transfers
- **Error Count**: Number of failed sink operations
- **Neo4j Write Latency**: Time to write to Neo4j
- **Kafka Lag**: Consumer lag on source topic

### Logs

```bash
# View Flink job logs
tail -f logs/flink-*.log

# Check Neo4j sink stats
grep "Neo4j sink processed" logs/flink-*.log
```

---

## 🧪 Testing

### Unit Tests

```bash
mvn test -pl stream-processor
```

### Integration Tests

```bash
# Start infrastructure
docker-compose up -d

# Run integration tests
mvn verify -pl stream-processor
```

---

## 🐛 Troubleshooting

### Neo4j Connection Failed

```bash
# Check Neo4j is running
docker ps | grep neo4j

# Verify connectivity
curl http://localhost:17474
```

### Kafka Consumer Lag

```bash
# Check consumer group lag
kafka-consumer-groups.sh --bootstrap-server localhost:19092 \
  --group stream-processor --describe
```

### PostgreSQL Write Errors

```bash
# Check PostgreSQL logs
docker logs chainrisk-postgres
```

---

## 📚 Related Documentation

- [Lambda Architecture Overview](../../docs/architecture/LAMBDA_ARCHITECTURE.md)
- [Project Overview](../../docs/architecture/PROJECT_OVERVIEW.md)
- [Technical Decisions](../../docs/architecture/TECH_DECISIONS.md)

---

**Last Updated**: 2026-01-03
