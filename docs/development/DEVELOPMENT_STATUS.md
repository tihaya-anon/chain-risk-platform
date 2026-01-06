# Development Status

> Current development status and recent changes

**Last Updated**: 2026-01-06

---

## Current Focus

Codebase cleanup and documentation after graph-service refactoring.

---

## Recent Changes (2026-01-06)

### Graph Service Refactoring

Moved `graph-engine` from `processing/` to `services/` and removed deprecated PostgreSQL sync code:

| Change | Description |
|--------|-------------|
| Directory move | `processing/graph-engine` → `services/graph-service` |
| Remove sync layer | Deleted PostgreSQL → Neo4j sync (replaced by Flink dual-write) |
| Rename application | `GraphEngineApplication` → `GraphServiceApplication` |
| Update Nacos | `spring.application.name: graph-service` |
| Update BFF | Removed deprecated `/sync` endpoints |
| Update Nacos config | Removed `graph-sync` section from pipeline config |

**Deleted Files**:
- `sync/PostgresTransferReader.java`
- `sync/SyncStateTracker.java`
- `service/GraphSyncService.java`
- `service/impl/GraphSyncServiceImpl.java`
- `model/dto/SyncStatusResponse.java`

**Data Flow Change**:
```
Before: Flink → PostgreSQL → GraphSyncService → Neo4j
After:  Flink → PostgreSQL + Neo4j (dual-write)
```

### ML Feature Pipeline (Earlier)

| Component | Status |
|-----------|--------|
| FeatureComputeJob | ✅ Done |
| LabelIngestionJob | ✅ Done |
| TrainingDataPrepareJob | ✅ Done |
| data_loader.py | ✅ Done |

---

## Architecture Reference

```
┌─────────────────────────────────────────────────────────────┐
│                    Data Sources                             │
│  Etherscan API → Kafka → Flink → PostgreSQL + Neo4j        │
└─────────────────────────────────────────────────────────────┘
                              │
         ┌────────────────────┼────────────────────┐
         │                    │                    │
         ▼                    ▼                    ▼
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│  Query Service  │  │  Graph Service  │  │  Risk Service   │
│  (Go)           │  │  (Java/Neo4j)   │  │  (Python)       │
└─────────────────┘  └─────────────────┘  └─────────────────┘
         │                    │                    │
         └────────────────────┼────────────────────┘
                              │
                              ▼
                     ┌─────────────────┐
                     │      BFF        │
                     │  (TypeScript)   │
                     └─────────────────┘
```

---

## Pending Tasks

| Task | Priority | Notes |
|------|----------|-------|
| End-to-end ML pipeline test | High | Full pipeline validation |
| XGBoost model training | Medium | After data pipeline verified |
| Isolation Forest training | Medium | After data pipeline verified |
| Add unit tests for graph-service | Low | Post-refactoring validation |

---

## Related Documentation

- [ML Feature Pipeline](./ML_FEATURE_PIPELINE.md)
- [Lambda Architecture](../architecture/LAMBDA_ARCHITECTURE.md)
- [Project Overview](../architecture/PROJECT_OVERVIEW.md)
