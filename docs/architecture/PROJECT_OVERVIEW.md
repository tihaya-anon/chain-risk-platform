# Chain Risk Platform - Project Overview

> Multi-language microservice blockchain risk analysis system (Lambda Architecture)

## Project Goals

### Dual Purpose
1. **Singapore Crypto Compliance**: Demonstrate blockchain data processing + compliance analysis capability
2. **Backend Freelancing**: Showcase multi-language tech stack for reuse

---

## Tech Stack Summary

| Domain         | Technology                          | Proficiency |
| -------------- | ----------------------------------- | ----------- |
| **Core**       | Java/Flink/Kafka + Blockchain Data  | ⭐⭐⭐⭐⭐       |
| **Backend**    | SpringBoot, Go Gin/GORM             | ⭐⭐⭐⭐        |
| **AI/ML**      | PyTorch, Pandas, ML/RL, Agent       | ⭐⭐⭐⭐        |
| **Frontend**   | Vue, React                          | ⭐⭐⭐         |
| **DevOps**     | Docker, K8s                         | ⭐⭐⭐         |

---

## System Architecture (Lambda)

### Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Frontend (React + TypeScript)                │
└─────────────────────────────────┬───────────────────────────────────┘
                                  │
┌─────────────────────────────────▼───────────────────────────────────┐
│              Orchestrator (Java/Spring Cloud Gateway)               │
│         JWT Auth / Routing / Rate Limiting / Circuit Breaker        │
└─────────────────────────────────┬───────────────────────────────────┘
                                  │ X-User-Id/Username/Role
┌─────────────────────────────────▼───────────────────────────────────┐
│                      BFF Layer (TypeScript/Nest.js)                 │
│              Business Aggregation / Data Transform                  │
└───────────┬─────────────────────┬─────────────────────┬─────────────┘
            │                     │                     │
┌───────────▼───────────┐ ┌───────▼───────┐ ┌───────────▼───────────┐
│    Query Service      │ │ Risk Service  │ │    Alert Service      │
│        (Go)           │ │   (Python)    │ │        (Go)           │
└───────────┬───────────┘ └───────┬───────┘ └───────────┬───────────┘
            └──────────┬──────────┴──────────┬──────────┘
                       │                     │
┌──────────────────────▼─────────────────────▼────────────────────────┐
│                     Data & Processing Layer                         │
│                                                                     │
│  ┌────────────────────────────────────────────────────────┐         │
│  │              Data Ingestion (Go)                       │         │
│  │          On-chain data → Kafka Producer                │         │
│  └─────────────────────────┬──────────────────────────────┘         │
│                            │                                        │
│                            ▼                                        │
│                   ┌────────────────┐                                │
│                   │  Kafka Topics  │                                │
│                   │  - raw-blocks  │                                │
│                   │  - transfers   │                                │
│                   └────┬───────────┘                                │
│                        │                                            │
│                        ▼                                            │
│                 ┌──────────────┐                                    │
│                 │ Flink Stream │                                    │
│                 │ (real-time)  │                                    │
│                 └────┬─────┬───┘                                    │
│                      │     │                                        │
│                      ▼     ▼                                        │
│  ┌──────────────┐     ┌──────────────┐     ┌──────────────┐         │
│  │ PostgreSQL   │     │    Neo4j     │     │ Graph Engine │         │
│  │ (hot, 7 days)│     │   (graph)    │     │  (analysis)  │         │
│  └──────┬───────┘     └──────────────┘     └──────────────┘         │
│         │                                                           │
│         │ Daily archive (02:00)                                     │
│         ▼                                                           │
│  ┌─────────────────────────────────────────────────────────┐        │
│  │                  Hudi (Data Lake)                       │        │
│  │                   Historical data                       │        │
│  │              ┌─────────────────────┐                    │        │
│  │              │  transfers (MOR)    │                    │        │
│  │              │  partition: dt      │                    │        │
│  │              └──────────┬──────────┘                    │        │
│  │                         ↑                               │        │
│  │                  Spark Batch (03:00)                    │        │
│  │                  (Full RPC → UPSERT correction)         │        │
│  │                         │                               │        │
│  │                         ↓                               │        │
│  │              Correction writeback to PostgreSQL         │        │
│  └─────────────────────────────────────────────────────────┘        │
│                                                                     │
│  Query Service routing:                                             │
│    - Recent 7 days → PostgreSQL                                     │
│    - Historical → Hudi (Trino)                                      │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Data Flow Details

### 1️⃣ Real-time Stream Processing (Flink)

**Goal**: Sub-second data processing, fast response

```
On-chain data → Kafka (raw-blocks)
                    ↓
              Flink Stream Processor
                    ↓
          ┌─────────┴─────────┐
          ↓                   ↓
    PostgreSQL              Neo4j
    (source='stream')      (source='stream')
          ↓                   ↓
    Query Service        Graph Engine
                        (incremental analysis)
```

**Processing Logic**:
- Consume Kafka `raw-blocks` Topic
- Parse Transfer (Native + ERC20)
- **Dual-write strategy**:
  - PostgreSQL: For OLTP queries (Query Service)
  - Neo4j: For real-time graph analysis (Graph Engine)
- Send to Kafka `transfers` Topic for downstream
- Simple real-time risk rules (blacklist check)

**Characteristics**:
- ✅ Good real-time performance (sub-second latency)
- ⚠️ May have data loss or parsing errors
- ⚠️ Cannot handle complex contracts or block reorgs

---

### 2️⃣ Data Archival & Batch Processing (Hudi + Spark)

**Goal**: Hot-cold separation, data accuracy, eventual consistency

```
┌─────────────────────────────────────────────────────────────┐
│                    Cold Data Archive (Daily 02:00)          │
│                                                             │
│  PostgreSQL (>7 days) ──archive──→ Hudi (full history)      │
│         │                                                   │
│         └── Delete archived data                            │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                    Batch Correction (Daily 03:00)           │
│                                                             │
│  Full Node RPC ──→ Spark Batch ──→ Hudi (UPSERT override)   │
│                                         │                   │
│                                         ↓                   │
│                        Recent corrections → PostgreSQL      │
└─────────────────────────────────────────────────────────────┘
```

**Processing Logic**:

1. **Cold Data Archive** (02:00)
   - Read data older than 7 days from PostgreSQL
   - Write to Hudi (UPSERT)
   - Delete archived data from PostgreSQL

2. **Batch Correction** (03:00)
   - Rescan yesterday's blocks from full node RPC
   - Use complete parsing logic
   - UPSERT to Hudi (auto-override stream data)
   - Writeback recent corrected data to PostgreSQL

**Characteristics**:
- ✅ PostgreSQL size controlled (only 7 days)
- ✅ Batch processing no lock contention (operates on Hudi)
- ✅ Low storage cost (cold data on object storage)
- ✅ Time Travel support (audit requirements)

---

### 3️⃣ Graph Analysis Service (Graph Engine)

**Goal**: Address relationship analysis, risk propagation

```
Neo4j Graph Data
    ↓
┌───┴────────────────┐
│                    │
↓                    ↓
Real-time Incremental    Daily Batch Analysis
(Kafka triggered)        (Scheduled task)
│                        │
├─ Incremental Clustering├─ Full Graph Clustering
│  (Common Input)        │  (Common Input)
│                        │
├─ Incremental Tag Prop  ├─ Full Graph Tag Prop
│  (BFS)                 │  (BFS)
│                        │
└─ Real-time Graph Query └─ PageRank
                            Community Detection
```

**Characteristics**:
- ✅ Good real-time (sub-second incremental analysis)
- ✅ High accuracy (batch full graph analysis)
- ✅ No PostgreSQL sync needed (Flink/Spark write directly to Neo4j)

---

## Project Structure

```
chain-risk-platform/
│
├── services/
│   ├── orchestrator/          # Java (Spring Cloud Gateway)
│   │   └── API Gateway, JWT Auth, Routing, Circuit Breaker
│   │
│   ├── bff/                   # TypeScript (Nest.js)
│   │   └── Business Aggregation, Data Transform
│   │
│   ├── query-service/         # Go (Gin + GORM)
│   │   └── Address/Transaction Query, Pagination, Cache
│   │
│   ├── alert-service/         # Go (Gin)
│   │   └── Alert Rule Engine, Notification Push
│   │
│   └── risk-ml-service/       # Python (FastAPI)
│       └── Risk Score Model, Feature Engineering
│
├── processing/
│   ├── stream-processor/      # Java (Flink)
│   │   ├── Real-time transaction processing
│   │   ├── Transfer parsing
│   │   └── Dual-write PostgreSQL + Neo4j
│   │
│   ├── batch-processor/       # Java (Spark + Hudi)
│   │   ├── Daily batch processing
│   │   ├── Complete parsing logic
│   │   └── Override write to Hudi data lake
│   │
│   └── graph-engine/          # Java (Spring Boot + Neo4j)
│       ├── Address Clustering (Common Input Heuristic)
│       ├── Tag Propagation (BFS)
│       ├── Graph Query REST API
│       └── Incremental + Batch graph analysis
│
├── data-ingestion/            # Go
│   └── On-chain data collection, Kafka Producer
│
├── frontend/                  # React + TypeScript
│   └── Risk Dashboard
│
├── infra/
│   ├── docker-compose.yml
│   ├── k8s/
│   ├── hive/                  # Hive Metastore
│   ├── trino/                 # Trino query engine
│   └── terraform/
│
└── docs/
    ├── PROJECT_OVERVIEW.md
    ├── DEVELOPMENT_PLAN.md
    ├── TECH_DECISIONS.md
    ├── LAMBDA_ARCHITECTURE.md
    ├── GATEWAY_BFF_ARCHITECTURE.md
    ├── ORCHESTRATOR_ARCHITECTURE.md
    └── api-specs/
```

---

## Language Responsibilities & Freelancing Mapping

| Module           | Language           | Responsibility                  | Reuse Scenario           |
| ---------------- | ------------------ | ------------------------------- | ------------------------ |
| **Orchestrator** | Java/Spring Cloud  | API Gateway, Auth, Rate Limit   | Enterprise Gateway       |
| **BFF**          | TypeScript/Nest.js | Business Aggregation            | Any BFF project          |
| **Query/Alert**  | Go/Gin             | High-performance microservices  | CRUD backend, tools      |
| **Risk ML**      | Python/FastAPI     | ML inference service            | AI projects, analytics   |
| **Flink Stream** | Java/Flink         | Real-time stream, dual-write    | Real-time data projects  |
| **Spark Batch**  | Java/Spark         | Batch processing, correction    | Big data batch projects  |
| **Graph Engine** | Java/Spring+Neo4j  | Graph analysis, clustering      | Graph DB apps, relations |
| **Ingestion**    | Go                 | High-concurrency collection     | Crawlers, data sync      |

---

## Lambda Architecture Benefits

| Dimension      | Traditional             | Lambda (This Project)                |
| -------------- | ----------------------- | ------------------------------------ |
| **Real-time**  | Medium (needs sync)     | Excellent (Flink direct to Neo4j)    |
| **Accuracy**   | Medium (stream errors)  | Excellent (Spark batch correction)   |
| **Integrity**  | Weak (sync may fail)    | Strong (batch ensures consistency)   |
| **Complexity** | Low                     | Medium (stream-batch separation)     |
| **Efficiency** | Low (duplicate compute) | High (each layer specialized)        |
| **Scalability**| Medium                  | Excellent (stream-batch independent) |

---

## Application Scenarios

### Scenario 1: Transfer Data Extraction & Correction

| Phase      | Processing     | Data Source    | Accuracy         | Latency |
| ---------- | -------------- | -------------- | ---------------- | ------- |
| **Real-time** | Flink stream | Kafka          | Medium           | Seconds |
| **Correction**| Spark batch  | Full Node RPC  | High             | T+1 day |

---

### Scenario 2: Address Risk Scoring

| Phase      | Processing     | Features         | Model Complexity | Latency |
| ---------- | -------------- | ---------------- | ---------------- | ------- |
| **Real-time** | Flink stream | Simple window    | Light rules      | Seconds |
| **Correction**| Spark batch  | Global history   | Complex ML       | T+1 day |

---

### Scenario 3: Address Clustering & Tag Propagation

| Phase      | Processing         | Scope      | Algorithm          | Latency |
| ---------- | ------------------ | ---------- | ------------------ | ------- |
| **Real-time** | Graph Engine Inc | Local graph| Simple clustering  | Seconds |
| **Correction**| Graph Engine Batch| Full graph | PageRank, Community| Daily   |

---

## Related Documentation

- [Development Plan](../development/DEVELOPMENT_PLAN.md)
- [Tech Decisions](./TECH_DECISIONS.md)
- [Lambda Architecture](./LAMBDA_ARCHITECTURE.md)
- [Hudi Batch Layer](../development/HUDI_BATCH_LAYER.md)
- [API Specs](../api-specs/)

---

**Last Updated**: 2026-01-05
