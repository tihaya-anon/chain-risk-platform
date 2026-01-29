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
├── development/           # Implementation guides & phase plans
│   ├── guides/           # Development guides
│   ├── plans/            # Phase plans (including Phase 19)
│   └── troubleshooting/  # Troubleshooting guides
├── operations/            # Runbooks & policies
│   ├── runbooks/         # Operational runbooks
│   ├── postmortems/      # Incident postmortems (Phase 19)
│   ├── policies/         # Operational policies
│   └── testing/          # Testing procedures
├── sre/                   # SLO definitions & chaos testing
│   ├── runbooks/         # SRE runbooks
│   └── capacity-planning/ # Capacity planning (Phase 19)
├── performance/           # Baseline reports
├── business/              # Business domain knowledge
└── archive/               # Historical phase docs (Phase 1-18)
```

---

## By Role

| Role | Start | Reference |
|------|-------|-----------|
| AI Assistant | [AI Context](../AI_CONTEXT.md) | [Roadmap](./ROADMAP.md) |
| New Dev | [Quick Start](./getting-started/QUICK_START.md) | [Overview](./architecture/overview/PROJECT_OVERVIEW.md) |
| Backend | [API Specs](./api-specs/API_SPECS_GUIDE.md) | [Dev SOP](./operations/runbooks/DEV_SOP.md) |
| SRE | [SLO Defs](./sre/SLO_DEFINITIONS.md) | [Runbooks](./sre/runbooks/) |
| DevOps | [CI/CD](../.github/workflows/) | [K8s Guide](../infra/k8s/README.md) |
| Platform Engineer | [Phase 19 Plan](./development/plans/PHASE19_PLATFORM_ENGINEERING.md) | [Architecture](./architecture/) |

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

**Current Phase: 19 - Platform Engineering** 🔄

| Phase | Status | Description |
|-------|--------|-------------|
| 1-11 | ✅ | Core platform |
| 12 | ✅ | Observability & SRE |
| 13 | ✅ | Security Hardening |
| 14 | ✅ | CI/CD Pipeline |
| 15 | ✅ | Performance Testing |
| 16 | ✅ | BFF Consolidation |
| 17 | ✅ | AIOps Foundation |
| 18 | ✅ | MEV Detection + K8s |
| **19** | **🔄** | **Platform Engineering & Production Readiness** |

**See**: [Phase 19 Plan](development/plans/PHASE19_PLATFORM_ENGINEERING.md)

---

**Version**: v0.19.0 (In Progress) | **Updated**: 2026-01-29
