# Chain Risk Platform - Documentation Center

> This documentation center contains all technical documentation for the project.

## Documentation Navigation

### 🏗️ Architecture Design

System architecture, technology choices, and design decisions.

- **[Project Overview](./architecture/PROJECT_OVERVIEW.md)** - Project goals, tech stack, Lambda architecture
- **[Lambda Architecture](./architecture/LAMBDA_ARCHITECTURE.md)** - Stream-batch unified processing design
- **[Gateway & BFF Architecture](./architecture/GATEWAY_BFF_ARCHITECTURE.md)** - Orchestrator and BFF responsibilities
- **[Orchestrator Architecture](./architecture/ORCHESTRATOR_ARCHITECTURE.md)** - API Gateway unified architecture
- **[Tech Decisions](./architecture/TECH_DECISIONS.md)** - Technical decision records (TDR)

### 📅 Development Plans

Project development plans, progress tracking, and test plans.

- **[Development Plan](./development/DEVELOPMENT_PLAN.md)** - MVP phased development plan
- **[Progress](./development/PROGRESS.md)** - Real-time progress tracking
- **[Phase 1 Test Plan](./development/PHASE1_TEST_PLAN.md)** - Core data flow test plan
- **[Hudi Batch Layer](./development/HUDI_BATCH_LAYER.md)** - Batch processing with Hudi data lake

### 🛠️ Operations Guides

Daily development and operations guides.

- **[Scripts Quick Reference](./operations/SCRIPTS_QUICK_REFERENCE.md)** - Common commands quick lookup
- **[Scripts Refactoring](./operations/SCRIPTS_REFACTORING.md)** - Scripts and Makefile summary
- **[Scripts Comparison](./operations/SCRIPTS_COMPARISON.md)** - Before/after comparison
- **[Git Workflow](./operations/GIT_WORKFLOW.md)** - Branch strategy, commit conventions
- **[Nacos Integration](./operations/NACOS_INTEGRATION.md)** - Config center and service discovery

### 📡 API Documentation

API specification management and OpenAPI documents.

- **[API Specs Guide](./api-specs/API_SPECS_GUIDE.md)** - How to generate and update API specs
- **[API Quick Reference](./api-specs/API_SPECS_QUICK_REF.md)** - API docs access and quick commands
- **[OpenAPI Spec Files](./api-specs/)** - Microservice OpenAPI JSON files
  - `query-service.openapi.json` - Query Service (Go)
  - `bff.openapi.json` - BFF (NestJS)
  - `risk-ml-service.openapi.json` - Risk ML Service (FastAPI)
  - `orchestrator.openapi.json` - Orchestrator (Spring Boot)
  - `graph-engine.openapi.json` - Graph Engine (Spring Boot)

### 📝 Changelog

Project change history and version records.

- **[Scripts Changelog](./changelog/CHANGELOG_SCRIPTS.md)** - Scripts and Makefile change history
- **[Docs Restructure Changelog](./changelog/CHANGELOG_DOCS_RESTRUCTURE.md)** - Documentation restructure record

### 📦 Archive

Historical session records and outdated documents.

- **[Session Archive 2024-12-30](./archive/SESSION_ARCHIVE_20241230.md)** - Integration test framework setup

---

## Quick Start

### New Users
1. Read [Project Overview](./architecture/PROJECT_OVERVIEW.md) for background
2. Read [Lambda Architecture](./architecture/LAMBDA_ARCHITECTURE.md) for stream-batch design
3. Check [Development Plan](./development/DEVELOPMENT_PLAN.md) for current phase
4. Reference [Scripts Quick Reference](./operations/SCRIPTS_QUICK_REFERENCE.md) to start environment

### Developers
1. Follow [Git Workflow](./operations/GIT_WORKFLOW.md) for commits
2. Use [API Quick Reference](./api-specs/API_SPECS_QUICK_REF.md) for API docs
3. Check [Progress](./development/PROGRESS.md) for current tasks

### Architects/Tech Leads
1. Review [Tech Decisions](./architecture/TECH_DECISIONS.md) for rationale
2. Deep dive [Lambda Architecture](./architecture/LAMBDA_ARCHITECTURE.md)
3. Reference [Orchestrator Architecture](./architecture/ORCHESTRATOR_ARCHITECTURE.md)
4. Read [Gateway & BFF Architecture](./architecture/GATEWAY_BFF_ARCHITECTURE.md)

---

## Directory Structure

```
docs/
├── README.md                    # This file - documentation index
├── architecture/                # Architecture design
│   ├── PROJECT_OVERVIEW.md      # Project overview (Lambda)
│   ├── LAMBDA_ARCHITECTURE.md   # Lambda architecture details
│   ├── GATEWAY_BFF_ARCHITECTURE.md
│   ├── ORCHESTRATOR_ARCHITECTURE.md
│   └── TECH_DECISIONS.md        # Technical decisions
├── development/                 # Development plans
│   ├── DEVELOPMENT_PLAN.md
│   ├── PROGRESS.md
│   ├── PHASE1_TEST_PLAN.md
│   └── HUDI_BATCH_LAYER.md      # Hudi batch processing
├── operations/                  # Operations guides
│   ├── SCRIPTS_QUICK_REFERENCE.md
│   ├── SCRIPTS_REFACTORING.md
│   ├── SCRIPTS_COMPARISON.md
│   ├── GIT_WORKFLOW.md
│   └── NACOS_INTEGRATION.md
├── api-specs/                   # API documentation
│   ├── API_SPECS_GUIDE.md
│   ├── API_SPECS_QUICK_REF.md
│   ├── query-service.openapi.json
│   ├── bff.openapi.json
│   ├── risk-ml-service.openapi.json
│   ├── orchestrator.openapi.json
│   └── graph-engine.openapi.json
├── changelog/                   # Change records
│   ├── CHANGELOG_SCRIPTS.md
│   └── CHANGELOG_DOCS_RESTRUCTURE.md
└── archive/                     # Archived documents
    └── SESSION_ARCHIVE_20241230.md
```

---

## Documentation Maintenance

### Update Principles
- **Architecture docs**: Update on major changes, requires team review
- **Development plans**: Update at phase start/end
- **Progress**: Real-time updates, daily/weekly recommended
- **Operations guides**: Update on script/process changes
- **API docs**: Auto-generate after API changes
- **Changelog**: Append on significant changes

### Archive Strategy
- Outdated session records move to `archive/`
- Archived docs retained but not maintained
- Archive filename format: `<TYPE>_ARCHIVE_<DATE>.md`

---

## Contact

For documentation issues or suggestions, contact project maintainers or submit an Issue.

---

**Last Updated**: 2026-01-05
