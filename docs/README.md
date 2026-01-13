# Chain Risk Platform - Documentation

## Quick Start

```bash
git clone <repo-url> && cd chain-risk-platform
echo "DOCKER_HOST_IP=<remote-ip>" > .env.local
source scripts/load-env.sh
make infra-check
make query-run
```

**Reading order**: [AI Context](../AI_CONTEXT.md) → [Quick Start](./getting-started/QUICK_START.md) → [Architecture](./architecture/overview/PROJECT_OVERVIEW.md)

---

## Documentation Map

```
docs/
├── getting-started/       # Environment setup
├── architecture/          # System design & decisions
├── api-specs/             # OpenAPI specs
├── development/           # Implementation guides
├── operations/            # Runbooks & policies
├── sre/                   # SLO definitions & chaos testing
├── performance/           # Baseline reports
├── security/              # Security reports
└── archive/               # Historical phase docs
```

---

## By Role

| Role | Start | Reference |
|------|-------|-----------|
| AI Assistant | [AI Context](../AI_CONTEXT.md) | [Roadmap](./ROADMAP.md) |
| New Dev | [Quick Start](./getting-started/QUICK_START.md) | [Overview](./architecture/overview/PROJECT_OVERVIEW.md) |
| Backend | [API Specs](./api-specs/API_SPECS_QUICK_REF.md) | [Dev SOP](./operations/runbooks/DEV_SOP.md) |
| SRE | [SLO Defs](./sre/SLO_DEFINITIONS.md) | [Runbooks](./sre/runbooks/) |
| DevOps | [CI/CD](../.github/workflows/) | [Deploy](../scripts/deploy/) |

---

## Infrastructure (Remote)

| Service | Port |
|---------|------|
| Grafana | 13001 |
| Prometheus | 19090 |
| Jaeger | 26686 |
| Kafka UI | 18080 |
| Nacos | 18848 |
| Airflow | 18088 |

---

## Project Status

**All Phases Complete** - Production Ready

| Phase | Status | Description |
|-------|--------|-------------|
| 1-11 | ✅ | Core platform |
| 12 | ✅ | Observability & SRE |
| 13 | ✅ | Security Hardening |
| 14 | ✅ | CI/CD Pipeline |
| 15 | ✅ | Performance Testing |
| 16 | ✅ | BFF Consolidation |

---

**Version**: v0.17.0 | **Updated**: 2026-01-14
