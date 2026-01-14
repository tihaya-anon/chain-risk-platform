# Chain Risk Platform - Roadmap

## Current: v0.18.0

**Platform**: On-chain Security Monitoring (Risk Analysis + MEV Detection)

---

## Completed

| Phase | Content | Version |
|-------|---------|---------|
| 1-11 | Core Platform (Services, ML, Graph) | v0.1-0.11 |
| 12 | SRE & Observability | v0.12.0 |
| 13 | Security Hardening | v0.13.0 |
| 14 | CI/CD Pipeline | v0.14.0 |
| 15 | Performance Testing | v0.15.0 |
| 16 | BFF Consolidation | v0.17.0 |
| 17 | AIOps Foundation | v0.18.0 |

---

## Upcoming

| Phase | Focus | Status |
|-------|-------|--------|
| 18 | MEV Detection + K8s Migration | Planning |
| 19 | Anomaly Detection (ML) | Backlog |
| 20 | Multi-chain Support | Backlog |

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│              Chain Risk Platform                        │
├─────────────────────────────────────────────────────────┤
│  On-chain Risk (v0.1+)    │  Transaction Risk (v0.19+)  │
│  • AML/Sanctions          │  • MEV Detection            │
│  • Graph Analysis         │  • Sandwich Attack          │
│  • Risk Scoring           │  • Front-running            │
├─────────────────────────────────────────────────────────┤
│  Data: Blockchain         │  Data: Mempool              │
│  Latency: Seconds         │  Latency: Milliseconds      │
└─────────────────────────────────────────────────────────┘
```

---

**Updated**: 2026-01-14
