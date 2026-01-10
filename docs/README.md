# Chain Risk Platform - Documentation

## Directory Structure

```
docs/
├── architecture/           # Architecture Design
│   ├── overview/          # Project overview, goals
│   ├── components/        # Component architectures (Lambda, BFF, ML, etc.)
│   └── decisions/         # Technical Decision Records
├── api-specs/             # API Documentation
│   └── openapi/           # OpenAPI specification files
├── development/           # Development Documentation
│   ├── plans/             # Development plans, roadmaps
│   ├── guides/            # Implementation guides
│   └── troubleshooting/   # Debug and troubleshooting
├── operations/            # Operations Documentation
│   ├── runbooks/          # Operational runbooks
│   ├── testing/           # Testing environments and procedures
│   └── policies/          # Data retention, security policies
├── changelog/             # Release and change records
└── archive/               # Historical documents
    ├── phase-reports/     # Completed phase summaries
    ├── test-reports/      # Historical test reports
    └── sessions/          # Development session records
```

---

## Quick Navigation

### Architecture
| Document | Description |
|----------|-------------|
| [Project Overview](./architecture/overview/PROJECT_OVERVIEW.md) | System goals, tech stack, high-level design |
| [Lambda Architecture](./architecture/components/LAMBDA_ARCHITECTURE.md) | Stream-batch unified processing |
| [ML Risk Model](./architecture/components/ML_RISK_MODEL_ARCHITECTURE.md) | Risk scoring pipeline |
| [Gateway & BFF](./architecture/components/GATEWAY_BFF_ARCHITECTURE.md) | API gateway design |
| [Orchestrator](./architecture/components/ORCHESTRATOR_ARCHITECTURE.md) | Service orchestration |
| [Tech Decisions](./architecture/decisions/TECH_DECISIONS.md) | TDR records |

### Development
| Document | Description |
|----------|-------------|
| [Development Plan](./development/plans/DEVELOPMENT_PLAN.md) | MVP phases |
| [GNN Plan](./development/plans/GNN_DEVELOPMENT_PLAN.md) | Graph neural network |
| [Alert Service](./development/guides/ALERT_SERVICE_IMPLEMENTATION.md) | Alert implementation |
| [Troubleshooting](./development/troubleshooting/INTEGRATION_TEST_TROUBLESHOOTING.md) | Common issues |

### Operations
| Document | Description |
|----------|-------------|
| [Git Workflow](./operations/runbooks/GIT_WORKFLOW.md) | Branch strategy |
| [Staging Runbook](./operations/runbooks/STAGING_RUNBOOK.md) | Staging environment |
| [Integration Testing](./operations/testing/INTEGRATION_TESTING_ENVIRONMENT.md) | Test environment setup |
| [Data Retention](./operations/policies/DATA_RETENTION_POLICY.md) | Data lifecycle |

### API
| Document | Description |
|----------|-------------|
| [API Guide](./api-specs/API_SPECS_GUIDE.md) | How to generate/update specs |
| [Quick Reference](./api-specs/API_SPECS_QUICK_REF.md) | API endpoints overview |

---

## Role-Based Entry Points

| Role | Recommended Path |
|------|------------------|
| **New Developer** | Project Overview → Lambda Architecture → Git Workflow |
| **Backend Dev** | Development Plan → API Guide → Troubleshooting |
| **ML Engineer** | ML Risk Model → GNN Plan → Feature Pipeline |
| **DevOps** | Staging Runbook → Integration Testing → Data Retention |
| **Architect** | Tech Decisions → Component Architectures |

---

**Last Updated**: 2026-01-10
