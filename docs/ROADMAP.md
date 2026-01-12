# Chain Risk Platform - Roadmap

---

## Completed

| Phase | Content | Date |
|-------|---------|------|
| 1-4 | Core platform, services, frontend | - |
| 5 | Alert Service | 2026-01-09 |
| 6 | GNN Integration | 2026-01-09 |
| 7 | Production Readiness | 2026-01-10 |
| 8 | Observability Stack | 2026-01-10 |
| 9 | Batch Orchestration | 2026-01-10 |
| 10 | Production Hardening | 2026-01-11 |
| 11 | API Integration Testing | 2026-01-12 |
| 12 | SRE & Chaos Engineering | 2026-01-12 |
| 14 | CI/CD Pipeline | 2026-01-12 |
| 15 | Performance Testing | 2026-01-12 |

---

## Upcoming

### Phase 13: Security Hardening
**Priority**: High | **Estimate**: 1-2 weeks

- [ ] TLS for all service communication
- [ ] API rate limiting per user/IP
- [ ] Request validation and sanitization
- [ ] Security audit
- [ ] Audit logging

**Success Criteria**:
- All traffic encrypted
- OWASP Top 10 addressed

---

## Backlog

| Feature | Priority | Description |
|---------|----------|-------------|
| Kubernetes Migration | Medium | Full K8s deployment with Helm |
| Multi-chain Support | Medium | Beyond Ethereum |
| Report Export | Low | PDF/CSV for compliance |
| GraphQL API | Low | Alternative to REST |

---

## Decision Log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-01-12 | Phase 12/14/15 parallel | Reduce timeline via worker parallelization |
| 2026-01-12 | Defer Phase 13 | Security after operational stability |
| 2026-01-11 | Vault for secrets | Centralized, auditable |
| 2026-01-10 | ES for Jaeger | Persistent trace storage |

---

**Last Updated**: 2026-01-12
