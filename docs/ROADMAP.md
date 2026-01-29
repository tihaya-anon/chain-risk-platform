# Chain Risk Platform - Roadmap

## Current: v0.19.0 (In Progress)

**Platform**: Multi-language Microservices + Platform Engineering + DevOps/SRE

---

## Completed

| Phase | Content | Version |
|-------|---------|---------|
| 1-11 | Core Platform (Services, ML, Graph) | v0.1-0.11 |
| 12 | SRE & Observability | v0.12.0 |
| 13 | Security Hardening | v0.13.0 |
| 14 | CI/CD Pipeline | v0.14.0 |
| 15 | Performance Testing | v0.15.0 |
| 16 | BFF Consolidation | v0.16.0 |
| 17 | AIOps Foundation | v0.17.0 |
| 18 | MEV Detection + K8s Migration | v0.18.0 |

---

## Current Phase

| Phase | Focus | Status |
|-------|-------|--------|
| 19 | **Platform Engineering & Production Readiness** | 🔄 In Progress |

**Goals**:
- Ensure system reliability (Docker Compose)
- Build SRE tooling (Service Registry, Config Center, etc.)
- Complete operational documentation (Postmortems, Runbooks)
- Transform into Internal Developer Platform

**Details**: See [PHASE19_PLATFORM_ENGINEERING.md](development/plans/PHASE19_PLATFORM_ENGINEERING.md)

---

## Upcoming

| Phase | Focus | Status |
|-------|-------|--------|
| 20 | Advanced Platform Features (Service Mesh, ML Anomaly Detection) | Backlog |
| 21 | Developer Experience (Self-service Portal, IDE Plugins) | Backlog |

---

## Architecture Evolution

### v0.19.0: Platform Engineering Layer

```
┌─────────────────────────────────────────────────────────────┐
│              Platform Engineering Layer (NEW)                │
│  Service Registry │ Config Center │ Metrics Aggregator      │
│  Deployment Controller │ Chaos Operator │ Platform API      │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│              Business Services Layer                         │
│  BFF │ Query │ Risk │ Alert │ Graph │ Mempool               │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│              Data Processing Layer                           │
│  Flink (Stream + MEV Detection) │ Spark (Batch)             │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│              Infrastructure Layer                            │
│  Kafka │ PostgreSQL │ Redis │ Neo4j │ Vault                 │
└─────────────────────────────────────────────────────────────┘
```

### v0.1-0.18.0: Business Services

```
┌─────────────────────────────────────────────────────────────┐
│              Chain Risk Platform                            │
├─────────────────────────────────────────────────────────────┤
│  On-chain Risk (v0.1+)    │  Transaction Risk (v0.18+)      │
│  • AML/Sanctions          │  • MEV Detection                │
│  • Graph Analysis         │  • Sandwich Attack              │
│  • Risk Scoring           │  • Front-running                │
├─────────────────────────────────────────────────────────────┤
│  Data: Blockchain         │  Data: Mempool                  │
│  Latency: Seconds         │  Latency: Milliseconds          │
└─────────────────────────────────────────────────────────────┘
```

---

**Updated**: 2026-01-29
