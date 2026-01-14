# Chain Risk Platform - AI Context

> Entry point for AI assistants.

## Quick Reference

| Item | Value |
|------|-------|
| Repo | `tihaya-anon/chain-risk-platform` |
| Version | v0.18.0 |
| Platform | On-chain Security Monitoring |

---

## Architecture

```
┌─────────────────────────────────────────────────┐
│  On-chain Risk        │  Transaction Risk       │
│  (Blockchain data)    │  (Mempool data) [WIP]   │
│  Latency: seconds     │  Latency: milliseconds  │
└─────────────────────────────────────────────────┘
          ↓                       ↓
      Kafka ────────────────── Kafka
          ↓                       ↓
    Flink/Spark ───────────── Flink CEP
          ↓                       ↓
      Alert Service ←─────────────┘
```

## Services

| Service | Lang | Port | Role |
|---------|------|------|------|
| bff | TypeScript | 3001 | Gateway |
| query-service | Go | 8081 | Queries |
| risk-ml-service | Python | 8082 | ML |
| alert-service | Go | 8083 | Alerts |
| graph-service | Java | 8084 | Graph |
| load-generator | Go | 9100 | Testing |

---

## Project Status

| Phase | Focus | Status |
|-------|-------|--------|
| 1-16 | Core + Security + CI/CD | ✅ |
| 17 | AIOps Foundation | ✅ |
| 18 | MEV Detection + K8s | 📋 Planning |

---

## Key Docs

| Topic | Path |
|-------|------|
| Roadmap | `docs/ROADMAP.md` |
| Goals | `PROJECT_GOALS.md` |
| Phase 18 | `docs/development/plans/PHASE18_MEV_K8S.md` |
| Risk Taxonomy | `docs/business/CRYPTO_RISK_TAXONOMY.md` |

---

## Commands

```bash
make infra-up        # Infrastructure
make services-up     # Services
make test-unit       # Tests
```

---

**Updated**: 2026-01-14
