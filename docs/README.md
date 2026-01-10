# Chain Risk Platform - Documentation

## Quick Start (New Developer)

```bash
# 1. Clone and setup
git clone <repo-url> && cd chain-risk-platform

# 2. Configure remote infrastructure
echo "DOCKER_HOST_IP=<remote-ip>" > .env.local

# 3. Load environment and verify
source scripts/load-env.sh
make infra-check

# 4. Run a service locally
make query-run  # or risk-run, alert-run, etc.
```

**Recommended reading order**:
1. [Quick Start Guide](./getting-started/QUICK_START.md) - Environment setup
2. [Project Overview](./architecture/overview/PROJECT_OVERVIEW.md) - System design
3. [Development Workflow](./getting-started/DEVELOPMENT_WORKFLOW.md) - Daily workflow

---

## Documentation Map

```
docs/
├── getting-started/       # 🚀 START HERE
│   ├── QUICK_START.md     # Environment setup, first run
│   └── DEVELOPMENT_WORKFLOW.md  # Daily dev workflow
│
├── architecture/          # System design
│   ├── overview/          # High-level architecture
│   ├── components/        # Component deep-dives
│   └── decisions/         # Technical decisions (TDR)
│
├── api-specs/             # API documentation
│   └── openapi/           # OpenAPI specs per service
│
├── development/           # Development guides
│   ├── plans/             # Roadmaps, phase plans
│   ├── guides/            # Implementation guides
│   └── troubleshooting/   # Debug guides
│
├── operations/            # Ops & deployment
│   ├── runbooks/          # Operational procedures
│   ├── testing/           # Test environments
│   └── policies/          # Data retention, security
│
├── changelog/             # Release history
└── archive/               # Historical documents
```

---

## By Role

| Role | Start Here | Then Read |
|------|------------|-----------|
| **New Developer** | [Quick Start](./getting-started/QUICK_START.md) | [Project Overview](./architecture/overview/PROJECT_OVERVIEW.md) |
| **Backend Dev** | [Dev Workflow](./getting-started/DEVELOPMENT_WORKFLOW.md) | [API Specs](./api-specs/API_SPECS_QUICK_REF.md) |
| **ML Engineer** | [ML Architecture](./architecture/components/ML_RISK_MODEL_ARCHITECTURE.md) | [GNN Plan](./development/plans/GNN_DEVELOPMENT_PLAN.md) |
| **DevOps** | [Integration Testing](./operations/testing/INTEGRATION_TESTING_ENVIRONMENT.md) | [Staging Runbook](./operations/runbooks/STAGING_RUNBOOK.md) |

---

## Key Documents

### Architecture
- [Project Overview](./architecture/overview/PROJECT_OVERVIEW.md) - Goals, tech stack, Lambda architecture
- [Lambda Architecture](./architecture/components/LAMBDA_ARCHITECTURE.md) - Stream-batch design
- [Gateway & BFF](./architecture/components/GATEWAY_BFF_ARCHITECTURE.md) - API layer design

### Development
- [Development Plan](./development/plans/DEVELOPMENT_PLAN.md) - Phase status & roadmap
- [Git Workflow](./operations/runbooks/GIT_WORKFLOW.md) - Branch strategy
- [Parallel Dev SOP](./operations/runbooks/PARALLEL_DEV_SOP.md) - Multi-worker coordination

### Operations
- [Integration Testing](./operations/testing/INTEGRATION_TESTING_ENVIRONMENT.md) - Remote infra setup
- [Phase 8 Validation](./development/guides/OBSERVABILITY_PHASE8_VALIDATION.md) - Observability test plan

---

## Infrastructure Quick Reference

| Service | Local Port | Remote Port | URL |
|---------|------------|-------------|-----|
| Grafana | - | 13001 | `http://<remote>:13001` |
| Prometheus | - | 19090 | `http://<remote>:19090` |
| Jaeger | - | 26686 | `http://<remote>:26686` |
| Kafka UI | - | 18080 | `http://<remote>:18080` |
| Nacos | - | 18848 | `http://<remote>:18848/nacos` |
| Airflow | - | 18088 | `http://<remote>:18088` |

See [Integration Testing Environment](./operations/testing/INTEGRATION_TESTING_ENVIRONMENT.md) for full port list.

---

## Current Status

| Phase | Status | Description |
|-------|--------|-------------|
| 1-7 | ✅ | Core platform complete |
| 8 | 🔶 | Observability - dev complete, pending test |
| 9 | ✅ | Airflow batch orchestration |

See [Development Plan](./development/plans/DEVELOPMENT_PLAN.md) for details.

---

**Last Updated**: 2026-01-10
