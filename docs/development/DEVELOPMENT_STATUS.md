# Development Status

> Current development status and recent changes

**Last Updated**: 2026-01-06

---

## Current Focus

**ML Feature Pipeline** - Implementing batch jobs for ML model training data preparation.

---

## Recent Changes (2026-01-06)

### ML Feature Pipeline

Implemented complete ML feature pipeline with Spark batch jobs:

| Component | Status | Description |
|-----------|--------|-------------|
| FeatureComputeJob | ✅ Done | Compute 16 V1 features from transfers |
| LabelIngestionJob | ✅ Done | Fetch labels from OFAC, Tornado Cash, Exchange |
| TrainingDataPrepareJob | ✅ Done | Join features + labels into training dataset |
| data_loader.py | ✅ Done | Read training data from Trino/Hudi |
| Python logging | ✅ Done | Console + file logging with configurable level |

### New Hudi Tables

```sql
-- ML feature storage
address_features (address, 16 feature columns, computed_at, feature_version)

-- Label data from public sources
address_labels (address, label_type, label, source, confidence, fetched_at)

-- Training dataset (features + labels joined)
training_dataset (address, features..., label, label_type, label_source)
```

### Scripts Refactoring

Unified batch processor scripts:

```bash
# Old (removed)
./scripts/run-archive-job.sh
./scripts/run-batch-correction.sh
./scripts/run-feature-compute.sh
./scripts/run-label-ingestion.sh
./scripts/run-training-data-prep.sh

# New (unified)
./scripts/run-batch-processor.sh <job-name>
# Jobs: archive, correct, features, labels, training
```

### Makefile Updates

```makefile
make batch-archive     # Archive PostgreSQL → Hudi
make batch-correct     # Batch correction on Hudi
make batch-features    # Compute ML features
make batch-labels      # Ingest label data
make batch-training    # Prepare training dataset
make batch-stop        # Stop running batch job
```

---

## File Changes Summary

### New Files
- `processing/batch-processor/src/main/java/com/chainrisk/batch/job/FeatureComputeJob.java`
- `processing/batch-processor/src/main/java/com/chainrisk/batch/job/LabelIngestionJob.java`
- `processing/batch-processor/src/main/java/com/chainrisk/batch/job/TrainingDataPrepareJob.java`
- `processing/batch-processor/src/main/java/com/chainrisk/batch/job/fetcher/LabelFetcher.java`
- `processing/batch-processor/src/main/java/com/chainrisk/batch/job/fetcher/OFACFetcher.java`
- `processing/batch-processor/src/main/java/com/chainrisk/batch/job/fetcher/TornadoCashFetcher.java`
- `processing/batch-processor/src/main/java/com/chainrisk/batch/job/fetcher/ExchangeFetcher.java`
- `scripts/run-batch-processor.sh`
- `ml-training/src/log_config.py`
- `docs/development/ML_FEATURE_PIPELINE.md`

### Modified Files
- `infra/init-scripts/hudi/01-init-tables.sql` - Added 3 new tables
- `processing/batch-processor/src/main/java/com/chainrisk/batch/BatchProcessorApp.java` - Added new job routing
- `processing/batch-processor/src/main/resources/log4j2.properties` - Dynamic log file naming
- `ml-training/src/data_loader.py` - Trino/Hudi support + logging
- `ml-training/src/model_registry.py` - Logging
- `ml-training/src/feature_builder.py` - Logging
- `ml-training/src/train_supervised.py` - Logging + --log-level arg
- `ml-training/src/train_unsupervised.py` - Logging + --log-level arg
- `ml-training/configs/training_config.yaml` - Trino config
- `Makefile` - New batch commands

### Removed Files
- `scripts/run-archive-job.sh`
- `scripts/run-batch-correction.sh`
- `scripts/run-feature-compute.sh`
- `scripts/run-label-ingestion.sh`
- `scripts/run-training-data-prep.sh`
- `processing/batch-processor/src/main/resources/logback.xml`

---

## Pending Tasks

| Task | Priority | Notes |
|------|----------|-------|
| Test feature computation | High | Requires running Hudi infrastructure |
| Test label ingestion | High | Requires network access to OFAC API |
| End-to-end ML pipeline test | High | Full pipeline validation |
| XGBoost model training | Medium | After data pipeline verified |
| Isolation Forest training | Medium | After data pipeline verified |

---

## Architecture Reference

```
┌─────────────────────────────────────────────────────────────┐
│                    Data Sources                             │
│  Etherscan API → Kafka → Flink → PostgreSQL + Hudi         │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                  Batch Processing (Spark)                   │
│                                                             │
│  ┌─────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │ArchiveJob   │  │CorrectJob   │  │FeatureComputeJob │  │
│  │(PG→Hudi)    │  │(Hudi fix)   │  │(transfers→feat)  │  │
│  └─────────────┘  └──────────────┘  └──────────────────┘  │
│                                                             │
│  ┌─────────────────┐  ┌─────────────────────────────────┐  │
│  │LabelIngestionJob│  │TrainingDataPrepareJob           │  │
│  │(APIs→labels)    │  │(features+labels→training)       │  │
│  └─────────────────┘  └─────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    ML Training (Python)                     │
│                                                             │
│  Trino → training_dataset → XGBoost / IsolationForest      │
│                           → MinIO (model registry)          │
└─────────────────────────────────────────────────────────────┘
```

---

## Related Documentation

- [ML Feature Pipeline](./ML_FEATURE_PIPELINE.md)
- [ML Risk Model Architecture](../architecture/ML_RISK_MODEL_ARCHITECTURE.md)
- [Hudi Batch Layer](./HUDI_BATCH_LAYER.md)
- [Lambda Architecture](../architecture/LAMBDA_ARCHITECTURE.md)
