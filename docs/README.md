# Chain Risk Platform - Documentation Center

> Technical documentation for the Chain Risk Platform.

## Documentation Navigation

### 🏗️ Architecture Design

- **[Project Overview](./architecture/PROJECT_OVERVIEW.md)** - Project goals, tech stack, Lambda architecture
- **[Lambda Architecture](./architecture/LAMBDA_ARCHITECTURE.md)** - Stream-batch unified processing design
- **[ML Risk Model Architecture](./architecture/ML_RISK_MODEL_ARCHITECTURE.md)** - ML pipeline for risk scoring
- **[Gateway & BFF Architecture](./architecture/GATEWAY_BFF_ARCHITECTURE.md)** - Orchestrator and BFF responsibilities
- **[Orchestrator Architecture](./architecture/ORCHESTRATOR_ARCHITECTURE.md)** - API Gateway unified architecture
- **[Tech Decisions](./architecture/TECH_DECISIONS.md)** - Technical decision records (TDR)

### 📅 Development Plans

- **[Development Plan](./development/DEVELOPMENT_PLAN.md)** - MVP phased development plan
- **[Progress](./development/PROGRESS.md)** - Real-time progress tracking
- **[Phase 1 Test Plan](./development/PHASE1_TEST_PLAN.md)** - Core data flow test plan
- **[Hudi Batch Layer](./development/HUDI_BATCH_LAYER.md)** - Batch processing with Hudi data lake

### 🛠️ Operations Guides

- **[Scripts Quick Reference](./operations/SCRIPTS_QUICK_REFERENCE.md)** - Common commands quick lookup
- **[Scripts Refactoring](./operations/SCRIPTS_REFACTORING.md)** - Scripts and Makefile summary
- **[Git Workflow](./operations/GIT_WORKFLOW.md)** - Branch strategy, commit conventions
- **[Nacos Integration](./operations/NACOS_INTEGRATION.md)** - Config center and service discovery

### 📡 API Documentation

- **[API Specs Guide](./api-specs/API_SPECS_GUIDE.md)** - How to generate and update API specs
- **[API Quick Reference](./api-specs/API_SPECS_QUICK_REF.md)** - API docs access and quick commands
- **[OpenAPI Spec Files](./api-specs/)** - Microservice OpenAPI JSON files

### 📝 Changelog

- **[Scripts Changelog](./changelog/CHANGELOG_SCRIPTS.md)** - Scripts and Makefile change history
- **[Docs Restructure Changelog](./changelog/CHANGELOG_DOCS_RESTRUCTURE.md)** - Documentation restructure record

### 📦 Archive

- **[Session Archive 2024-12-30](./archive/SESSION_ARCHIVE_20241230.md)** - Integration test framework setup

---

## Quick Start

| Role | Start Here |
|------|------------|
| **New Users** | [Project Overview](./architecture/PROJECT_OVERVIEW.md) → [Lambda Architecture](./architecture/LAMBDA_ARCHITECTURE.md) → [Scripts Quick Reference](./operations/SCRIPTS_QUICK_REFERENCE.md) |
| **Developers** | [Git Workflow](./operations/GIT_WORKFLOW.md) → [Progress](./development/PROGRESS.md) → [API Quick Reference](./api-specs/API_SPECS_QUICK_REF.md) |
| **Architects** | [Tech Decisions](./architecture/TECH_DECISIONS.md) → [Lambda Architecture](./architecture/LAMBDA_ARCHITECTURE.md) → [ML Risk Model Architecture](./architecture/ML_RISK_MODEL_ARCHITECTURE.md) |

---

## Directory Structure

```
docs/
├── README.md                    # Documentation index
├── architecture/                # Architecture design
│   ├── PROJECT_OVERVIEW.md
│   ├── LAMBDA_ARCHITECTURE.md
│   ├── ML_RISK_MODEL_ARCHITECTURE.md
│   ├── GATEWAY_BFF_ARCHITECTURE.md
│   ├── ORCHESTRATOR_ARCHITECTURE.md
│   └── TECH_DECISIONS.md
├── development/                 # Development plans
│   ├── DEVELOPMENT_PLAN.md
│   ├── PROGRESS.md
│   ├── PHASE1_TEST_PLAN.md
│   └── HUDI_BATCH_LAYER.md
├── operations/                  # Operations guides
│   ├── SCRIPTS_QUICK_REFERENCE.md
│   ├── GIT_WORKFLOW.md
│   └── NACOS_INTEGRATION.md
├── api-specs/                   # API documentation
├── changelog/                   # Change records
└── archive/                     # Archived documents
```

---

**Last Updated**: 2026-01-05
