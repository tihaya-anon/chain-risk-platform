# Chain Risk Platform - Roadmap

---

## Completed Phases

| Phase | Content | Version |
|-------|---------|---------|
| 1-4 | Project Setup, Data Lake, Ingestion, Infrastructure | v0.1-0.4 |
| 5-7 | Orchestrator, Query Service, Risk ML | v0.5-0.7 |
| 8-9 | BFF Layer, Alert Service | v0.8-0.9 |
| 10-11 | ML Pipeline (XGBoost, GNN), Graph Service | v0.10-0.11 |
| 12 | SRE & Chaos Engineering | v0.12.0 |
| 13 | Security Hardening | v0.13.0-0.16.0 |
| 14 | CI/CD Pipeline | v0.14.0 |
| 15 | Performance Testing | v0.15.0 |
| 16 | BFF Consolidation | v0.17.0 |

---

## Current Status: Production Ready

**Version**: v0.17.0  
**Architecture**: Frontend → BFF → Backend Services

### Service Matrix
| Service | TLS | Rate Limit | Audit | P95 |
|---------|-----|------------|-------|-----|
| bff | ✅ | ✅ | ✅ | - |
| query-service | ✅ | ✅ | ✅ | 112ms |
| risk-ml-service | ✅ | ✅ | ✅ | 312ms |
| alert-service | ✅ | ✅ | ✅ | 134ms |
| graph-service | ✅ | ✅ | ✅ | 198ms |

---

## Backlog

| Feature | Priority | Description |
|---------|----------|-------------|
| Business Documentation | High | Risk model rationale, label taxonomy |
| Kubernetes Migration | Medium | Helm charts, K8s deployment |
| Multi-chain Support | Medium | BSC, Polygon integration |
| Report Export | Low | PDF/CSV compliance reports |

---

**Last Updated**: 2026-01-14
