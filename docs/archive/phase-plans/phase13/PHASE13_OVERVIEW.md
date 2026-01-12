# Phase 13: Security Hardening - Development Plan

> **Status**: Planning → Development  
> **Priority**: High  
> **Estimate**: 5-7 days (parallel execution)

---

## Checkpoint Structure

| CP | Task | Est | Worker | Depends | Parallel Group |
|----|------|-----|--------|---------|----------------|
| 1 | Certificate Management & Vault | 1d | W1 | - | A |
| 2 | TLS/mTLS Configuration | 1d | W1 | CP1 | B |
| 3 | API Hardening | 1.5d | W2 | - | A |
| 4 | Audit Logging | 1d | W2 | - | A |
| 5 | Security Scanning CI | 0.5d | W3 | - | A |
| 6 | Integration & Verification | 1d | W1 | CP2-5 | C |

---

## Dependency DAG

```
┌─────────────────────────────────────────────────────────────┐
│                    PARALLEL GROUP A                         │
│  ┌──────┐    ┌──────┐    ┌──────┐    ┌──────┐              │
│  │ CP1  │    │ CP3  │    │ CP4  │    │ CP5  │              │
│  │Vault │    │ API  │    │Audit │    │ Scan │              │
│  └──┬───┘    └──┬───┘    └──┬───┘    └──┬───┘              │
└─────┼───────────┼──────────┼──────────┼────────────────────┘
      │           │          │          │
      ▼           │          │          │
┌──────────┐      │          │          │
│   CP2    │      │          │          │
│ TLS/mTLS │      │          │          │
└────┬─────┘      │          │          │
     │            │          │          │
     └────────────┴──────────┴──────────┘
                  │
                  ▼
            ┌──────────┐
            │   CP6    │
            │Integrate │
            └──────────┘
```

---

## Worker Assignment

### Worker 1 (Infrastructure Track)
| Order | CP | Task |
|-------|----|----|
| 1 | CP1 | Certificate Management |
| 2 | CP2 | TLS/mTLS (after CP1) |
| 3 | CP6 | Integration (after all) |

### Worker 2 (Application Track)
| Order | CP | Task |
|-------|----|----|
| 1 | CP3 | API Hardening |
| 2 | CP4 | Audit Logging |

### Worker 3 (CI/CD Track)
| Order | CP | Task |
|-------|----|----|
| 1 | CP5 | Security Scanning |

---

## Service Scope

| Service | Lang | TLS | Rate Limit | Audit | Scan |
|---------|------|-----|------------|-------|------|
| orchestrator | Java | ✓ mTLS | ✓ | ✓ | ✓ |
| bff | TypeScript | ✓ TLS | ✓ | ✓ | ✓ |
| query-service | Go | ✓ mTLS | ✓ | ✓ | ✓ |
| risk-ml-service | Python | ✓ mTLS | ✓ | ✓ | ✓ |
| alert-service | Go | ✓ mTLS | ✓ | ✓ | ✓ |
| graph-service | Java | ✓ mTLS | ✓ | ✓ | ✓ |

---

## Success Criteria

| Criteria | Target | Validation |
|----------|--------|------------|
| TLS Coverage | 100% endpoints | curl --insecure fails |
| mTLS Internal | All inter-service | Cert verification logs |
| Rate Limiting | All public APIs | k6 burst test |
| Input Validation | OWASP Top 10 | SAST clean |
| Audit Logs | Sensitive ops | Log query verification |
| Vuln Scan | 0 Critical/High | CI gate pass |

---

## Deliverables

| CP | Artifacts |
|----|-----------|
| 1 | `infra/vault/`, cert generation scripts |
| 2 | TLS configs per service, mTLS middleware |
| 3 | Rate limit middleware, validation schemas |
| 4 | Audit log middleware, Loki queries |
| 5 | `.github/workflows/security.yml`, scan configs |
| 6 | Security test suite, compliance report |

---

## Timeline (Parallel Execution)

```
Day 1:  CP1 ████████  CP3 ████████████  CP4 ████████  CP5 ████
Day 2:  CP1 ████      CP3 ████████████  CP4 ████████
Day 3:  CP2 ████████████████
Day 4:  CP2 ████      CP6 ████████████████████████████████████
Day 5:  CP6 ████████  Buffer/Fixes
```

---

## Checkpoint Documents

| CP | Document |
|----|----------|
| 1 | [CP1_CERT_MANAGEMENT.md](./CP1_CERT_MANAGEMENT.md) |
| 2 | [CP2_TLS_MTLS.md](./CP2_TLS_MTLS.md) |
| 3 | [CP3_API_HARDENING.md](./CP3_API_HARDENING.md) |
| 4 | [CP4_AUDIT_LOGGING.md](./CP4_AUDIT_LOGGING.md) |
| 5 | [CP5_SECURITY_SCANNING.md](./CP5_SECURITY_SCANNING.md) |
| 6 | [CP6_INTEGRATION.md](./CP6_INTEGRATION.md) |

---

## Branch Strategy

```bash
# All workers: fetch develop branch (docs already pushed)
git fetch origin develop/phase13
git checkout develop/phase13

# Create feature branch
git checkout -b feature/cp{X}-{description}

# Work... then merge back
git checkout develop/phase13
git pull origin develop/phase13
git merge --no-ff feature/cp{X}-{description}
git push origin develop/phase13

# Cleanup
git branch -d feature/cp{X}-{description}
```

### Branch Flow

```
origin/develop/phase13  ◄── docs ready, workers fetch from here
       │
       ├── W1: feature/cp1-cert-management
       ├── W2: feature/cp3-api-hardening
       ├── W2: feature/cp4-audit-logging
       └── W3: feature/cp5-security-scanning
       │
       ├── W1: feature/cp2-tls-mtls (after CP1)
       └── W1: feature/cp6-integration (after CP2-5)
       │
       ▼
origin/main  ◄── Final merge + tag v0.13.0
```

---

## Coordination Matrix

| Event | Action | Notify |
|-------|--------|--------|
| CP1 complete | W1 starts CP2 | - |
| CP3 complete | W2 starts CP4 | - |
| CP2-5 complete | W1 starts CP6 | All |
| CP6 complete | Merge to main | All |
| Blocker | Stop, escalate | All |

---

## Worker Prompts

| Worker | Prompt |
|--------|--------|
| W1 | [PROMPT_W1.md](./PROMPT_W1.md) |
| W2 | [PROMPT_W2.md](./PROMPT_W2.md) |
| W3 | [PROMPT_W3.md](./PROMPT_W3.md) |

---

**Created**: 2026-01-12  
**Updated**: 2026-01-12
