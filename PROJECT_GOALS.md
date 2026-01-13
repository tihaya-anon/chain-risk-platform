# Project Goals & Status

> Internal document. Not for public README.

---

## Objectives

| Goal | Scenario | Priority |
|------|----------|----------|
| Multi-language Backend | Freelance work | Short-term |
| Web3 Business Understanding | Continue in Web3 | Medium-term |
| SRE Capabilities | Career advancement | Optimistic |

---

## Completion Assessment

### 1. Multi-language Backend ✅ 90%

**Target**: Demonstrate full-stack microservice proficiency across languages.

| Language | Service | Status |
|----------|---------|--------|
| Go/Gin | query-service, alert-service | ✅ |
| Java/Spring | orchestrator, graph-service | ✅ |
| Python/FastAPI | risk-ml-service | ✅ |
| TypeScript/NestJS | bff | ✅ |
| Spark/Flink | processing layer | ✅ |

**Strengths**:
- Real service interactions, not isolated demos
- Security (TLS/mTLS), monitoring, CI/CD full pipeline
- Clean architecture patterns per language

**Verdict**: Ready for portfolio use.

---

### 2. Web3 Business Understanding ⚠️ 50%

**Target**: Show domain expertise, not just coding ability.

**Current State**:
- ✅ Data pipeline: blockchain → lake → services
- ✅ Graph analysis: address clustering, path finding
- ✅ Risk scoring: ML model integration
- ❌ Missing business rationale documentation

**Gaps**:
| Missing | Why It Matters |
|---------|----------------|
| Risk feature rationale | Why these features? (mixer patterns, bridge exploits, MEV) |
| Label taxonomy | How addresses are categorized (exchange, mixer, phishing, OFAC) |
| Detection logic | What patterns indicate laundering vs normal activity |

**TODO**: Add `docs/business/RISK_MODEL_RATIONALE.md`

---

### 3. SRE Capabilities ✅ 80%

**Target**: Demonstrate production operations expertise.

**Implemented**:
- ✅ SLO definitions with error budgets
- ✅ Grafana dashboards, Prometheus metrics
- ✅ Alertmanager rules and routing
- ✅ Runbooks for common scenarios
- ✅ Chaos engineering scenarios

**Gap**:
- All documentation is "design" stage
- No incident postmortem to prove real-world application

**Optional TODO**: Add fake postmortem `docs/sre/postmortems/SAMPLE_INCIDENT.md`

---

## Summary

```
Multi-lang Backend  ████████████████████░░  90%  → Ready
Web3 Business       ██████████░░░░░░░░░░░░  50%  → Needs rationale doc
SRE                 ████████████████░░░░░░  80%  → Optional postmortem
```

---

## Next Actions

| Action | Effort | Impact |
|--------|--------|--------|
| Write RISK_MODEL_RATIONALE.md | 2h | High (Web3) |
| Add sample postmortem | 1h | Medium (SRE) |
| Polish README for public | 1h | Medium (All) |

---

**Last Updated**: 2026-01-13
