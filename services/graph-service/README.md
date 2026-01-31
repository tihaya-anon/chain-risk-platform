# Graph Service

Graph analysis service for address clustering and risk tag propagation using Neo4j.

## Features

- **Address Clustering**: Cluster addresses based on common input heuristics
- **Tag Propagation**: Propagate risk tags through transaction graph
- **Path Finding**: Find shortest paths between addresses
- **Neighbor Analysis**: Analyze address relationships and connections
- **Graph Queries**: Query transaction graph with Cypher
- **REST API**: Full CRUD operations for graph data
- **Nacos Integration**: Service discovery and dynamic configuration
- **Prometheus Metrics**: Built-in metrics for monitoring
- **Swagger API**: Interactive API documentation

## Architecture

```
Client → Graph Service → Neo4j (Graph Database)
              ↓
          Prometheus
              ↓
            Nacos
```

### Data Flow

```
Flink Stream Processor → Neo4j (dual-write)
                           ↓
                    Graph Service (read)
                           ↓
                      BFF Gateway
```

## Technology Stack

- **Language**: Java 17
- **Framework**: Spring Boot 3.2.1
- **Database**: Neo4j 5.15.0
- **Service Discovery**: Nacos (Spring Cloud Alibaba)
- **Resilience**: Resilience4j (Rate Limiting)
- **Metrics**: Micrometer + Prometheus
- **API Docs**: SpringDoc OpenAPI 3

## Quick Start

### Prerequisites

- Java 17+
- Maven 3.8+
- Neo4j 5.x
- Nacos (optional, for service discovery)

### Installation

```bash
# Build
mvn clean package -DskipTests

# Run
java -jar target/graph-service-1.0.0-SNAPSHOT.jar

# Or with Maven
mvn spring-boot:run
```

### Development

```bash
# Run with dev profile
mvn spring-boot:run -Dspring-boot.run.profiles=dev

# Run tests
mvn test

# Run with hot reload (Spring DevTools)
mvn spring-boot:run -Dspring-boot.run.jvmArguments="-Dspring.devtools.restart.enabled=true"
```

## Configuration

Configuration is loaded from:
1. `src/main/resources/application.yml` - Default configuration
2. `src/main/resources/bootstrap.yml` - Bootstrap configuration (Nacos)
3. Environment variables (override config files)
4. Nacos Config Center (if enabled) - Dynamic configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `SERVER_PORT` | HTTP server port | 8084 |
| `NEO4J_URI` | Neo4j Bolt URI | bolt://localhost:17687 |
| `NEO4J_USERNAME` | Neo4j username | neo4j |
| `NEO4J_PASSWORD` | Neo4j password | chainrisk123 |
| `NACOS_SERVER_ADDR` | Nacos server address | localhost:18848 |
| `NACOS_NAMESPACE` | Nacos namespace | dev |
| `SPRING_PROFILES_ACTIVE` | Active Spring profile | dev |

### Application Configuration

See [src/main/resources/application.yml](src/main/resources/application.yml) for all available options.

## API Endpoints

### Address Endpoints

```
GET    /api/v1/graph/addresses/:address              Get address node info
GET    /api/v1/graph/addresses/:address/neighbors    Get address neighbors
POST   /api/v1/graph/addresses/:address/tags         Add tag to address
DELETE /api/v1/graph/addresses/:address/tags/:tag    Remove tag from address
```

### Clustering Endpoints

```
POST   /api/v1/graph/clustering/run                  Run address clustering
GET    /api/v1/graph/clustering/results              Get clustering results
GET    /api/v1/graph/clusters/:clusterId             Get cluster details
GET    /api/v1/graph/clusters/:clusterId/addresses   Get addresses in cluster
```

### Tag Propagation Endpoints

```
POST   /api/v1/graph/propagation/run                 Run tag propagation
GET    /api/v1/graph/propagation/results             Get propagation results
GET    /api/v1/graph/tags/:tag/addresses             Get addresses with tag
```

### Path Finding Endpoints

```
GET    /api/v1/graph/paths/shortest                  Find shortest path
       ?from=0x123...&to=0x456...&maxDepth=5
GET    /api/v1/graph/paths/all                       Find all paths
       ?from=0x123...&to=0x456...&maxDepth=3
```

### Health & Metrics

```
GET    /actuator/health                              Health check
GET    /actuator/metrics                             Metrics endpoint
GET    /actuator/prometheus                          Prometheus metrics
GET    /swagger-ui.html                              Swagger UI
GET    /v3/api-docs                                  OpenAPI spec
```

## API Examples

### Get Address Node

```bash
curl http://localhost:8084/api/v1/graph/addresses/0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb
```

Response:
```json
{
  "address": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
  "network": "ethereum",
  "tags": ["Exchange", "High Volume"],
  "cluster_id": "cluster_123",
  "in_degree": 150,
  "out_degree": 200,
  "total_transfers": 350,
  "first_seen": "2024-01-01T00:00:00Z",
  "last_seen": "2024-01-30T12:00:00Z"
}
```

### Get Address Neighbors

```bash
curl "http://localhost:8084/api/v1/graph/addresses/0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb/neighbors?limit=10&direction=BOTH"
```

### Run Address Clustering

```bash
curl -X POST http://localhost:8084/api/v1/graph/clustering/run \
  -H "Content-Type: application/json" \
  -d '{
    "network": "ethereum",
    "algorithm": "common_input",
    "min_cluster_size": 2
  }'
```

### Run Tag Propagation

```bash
curl -X POST http://localhost:8084/api/v1/graph/propagation/run \
  -H "Content-Type: application/json" \
  -d '{
    "source_tag": "Sanctioned",
    "max_depth": 3,
    "min_confidence": 0.7
  }'
```

### Find Shortest Path

```bash
curl "http://localhost:8084/api/v1/graph/paths/shortest?from=0x123...&to=0x456...&maxDepth=5"
```

## Neo4j Graph Schema

### Nodes

#### Address Node

```cypher
(:Address {
  address: String,
  network: String,
  tags: [String],
  cluster_id: String,
  source: String,
  created_at: Long,
  updated_at: Long
})
```

### Relationships

#### TRANSFER Relationship

```cypher
(:Address)-[:TRANSFER {
  tx_hash: String,
  log_index: Integer,
  amount: String,
  token_address: String,
  timestamp: Long,
  block_number: Long,
  source: String
}]->(:Address)
```

### Indexes

```cypher
// Address lookup
CREATE INDEX address_index FOR (a:Address) ON (a.address, a.network);

// Tag search
CREATE INDEX tag_index FOR (a:Address) ON (a.tags);

// Cluster lookup
CREATE INDEX cluster_index FOR (a:Address) ON (a.cluster_id);

// Transaction hash lookup
CREATE INDEX tx_hash_index FOR ()-[r:TRANSFER]-() ON (r.tx_hash);
```

## Clustering Algorithms

### Common Input Heuristic

Clusters addresses that appear as inputs in the same transaction (co-spending).

**Cypher Query:**
```cypher
MATCH (a1:Address)-[r1:TRANSFER]->(intermediate:Address)
MATCH (a2:Address)-[r2:TRANSFER]->(intermediate)
WHERE a1 <> a2
  AND r1.tx_hash = r2.tx_hash
  AND a1.network = $network
MERGE (a1)-[:SAME_ENTITY]-(a2)
```

### Deposit Address Heuristic

Clusters addresses that send funds to the same exchange/service address.

## Tag Propagation

### Risk Score Propagation

Propagates risk scores through the transaction graph with decay:

```
risk_score(neighbor) = risk_score(source) * decay_factor * confidence
```

**Parameters:**
- `decay_factor`: 0.8 (default)
- `max_depth`: 3 hops (default)
- `min_confidence`: 0.5 (default)

### Tag Types

| Tag | Description | Propagation |
|-----|-------------|-------------|
| `Sanctioned` | OFAC sanctioned address | High priority, 3 hops |
| `Mixer` | Mixing service | Medium priority, 2 hops |
| `Exchange` | Exchange address | No propagation |
| `Scam` | Known scam address | High priority, 3 hops |
| `High Risk` | High risk score | Medium priority, 2 hops |

## Performance Optimization

### Query Optimization

1. **Use indexes** for address and tag lookups
2. **Limit depth** in path finding queries (max 5 hops)
3. **Use LIMIT** in neighbor queries
4. **Batch operations** for bulk updates

### Connection Pool

```yaml
spring:
  neo4j:
    pool:
      max-connection-pool-size: 50
      connection-acquisition-timeout: 30s
      max-connection-lifetime: 1h
```

### Rate Limiting

Configured via Resilience4j:

```yaml
resilience4j:
  ratelimiter:
    instances:
      graphService:
        limit-for-period: 100
        limit-refresh-period: 1s
        timeout-duration: 0s
```

## Metrics

Exposed on `/actuator/prometheus`:

| Metric | Type | Description |
|--------|------|-------------|
| `graph_service_requests_total` | Counter | Total HTTP requests |
| `graph_service_request_duration_seconds` | Histogram | Request latency |
| `graph_service_neo4j_queries_total` | Counter | Neo4j queries by type |
| `graph_service_neo4j_query_duration_seconds` | Histogram | Neo4j query latency |
| `graph_service_clustering_runs_total` | Counter | Clustering algorithm runs |
| `graph_service_propagation_runs_total` | Counter | Tag propagation runs |

## Testing

```bash
# Run unit tests
mvn test

# Run integration tests (requires Neo4j)
mvn verify -Pintegration

# Run specific test
mvn test -Dtest=GraphServiceTest

# Run with coverage
mvn test jacoco:report
```

## Docker

```bash
# Build image
docker build -t graph-service:latest .

# Run container
docker run -p 8084:8084 \
  -e NEO4J_URI=bolt://neo4j:7687 \
  -e NEO4J_PASSWORD=password \
  graph-service:latest
```

## Troubleshooting

### Neo4j Connection Issues

```bash
# Test Neo4j connection
curl http://localhost:17474

# Check Neo4j status
docker logs chainrisk-neo4j

# Verify credentials
cypher-shell -a bolt://localhost:17687 -u neo4j -p chainrisk123 "RETURN 1"
```

### Slow Queries

1. Check if indexes are created:
   ```cypher
   SHOW INDEXES
   ```

2. Analyze query plan:
   ```cypher
   EXPLAIN MATCH (a:Address {address: $addr}) RETURN a
   ```

3. Check connection pool metrics in `/actuator/metrics`

### Memory Issues

1. Increase Neo4j heap size in `neo4j.conf`:
   ```
   dbms.memory.heap.initial_size=2g
   dbms.memory.heap.max_size=4g
   ```

2. Limit query result size with `LIMIT`

3. Use pagination for large result sets

## Related Services

- [BFF](../bff/README.md) - API Gateway
- [Stream Processor](../../processing/stream-processor/README.md) - Writes graph data to Neo4j
- [Batch Processor](../../processing/batch-processor/README.md) - Batch graph updates

## Documentation

- [Neo4j Cypher Manual](https://neo4j.com/docs/cypher-manual/current/)
- [Spring Data Neo4j](https://docs.spring.io/spring-data/neo4j/docs/current/reference/html/)
- [Graph Algorithms](../../docs/architecture/GRAPH_ALGORITHMS.md)

## License

MIT
