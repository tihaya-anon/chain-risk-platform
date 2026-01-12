# Chain Risk Platform - Documentation

## Quick Start

```bash
git clone <repo-url> && cd chain-risk-platform
echo "DOCKER_HOST_IP=<remote-ip>" > .env.local
source scripts/load-env.sh
make infra-check
make query-run
```

**Reading order**: [Quick Start](./getting-started/QUICK_START.md) → [Overview](./architecture/overview/PROJECT_OVERVIEW.md) → [Workflow](./getting-started/DEVELOPMENT_WORKFLOW.md)

---

## Documentation Map

```
docs/
├── getting-started/       # Environment setup
├── architecture/          # System design & decisions
├── api-specs/             # OpenAPI specs
├── development/           # Plans & implementation guides
├── operations/            # Runbooks & deployment
├── sre/                   # SLO definitions & runbooks
├── performance/           # Baseline reports
├── changelog/             # Release notes
└── archive/               # Historical docs
```

---

## By Role

| Role | Start | Reference |
|------|-------|-----------|
| New Dev | [Quick Start](./getting-started/QUICK_START.md) | [Overview](./architecture/overview/PROJECT_OVERVIEW.md) |
| Backend | [Workflow](./getting-started/DEVELOPMENT_WORKFLOW.md) | [API Specs](./api-specs/API_SPECS_QUICK_REF.md) |
| ML | [ML Arch](./architecture/components/ML_RISK_MODEL_ARCHITECTURE.md) | [GNN Plan](./development/plans/GNN_DEVELOPMENT_PLAN.md) |
| SRE | [SLO Defs](./sre/SLO_DEFINITIONS.md) | [Runbooks](./sre/runbooks/) |
| DevOps | [CI/CD](../.github/workflows/) | [Deploy](../scripts/deploy/) |

---

## Infrastructure

| Service | Remote Port |
|---------|-------------|
| Grafana | 13001 |
| Prometheus | 19090 |
| Jaeger | 26686 |
| Kafka UI | 18080 |
| Nacos | 18848 |
| Airflow | 18088 |

---

## Current Status

| Phase | Status | Description |
|-------|--------|-------------|
| 1-11 | ✅ | Core platform, testing |
| 12 | ✅ | SRE & Chaos Engineering |
| 14 | ✅ | CI/CD Pipeline |
| 15 | ✅ | Performance Testing |
| 13 | 📋 | Security (deferred) |

---

**Version**: v0.15.0 | **Updated**: 2026-01-12
