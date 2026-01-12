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

---

## Upcoming

### Phase 12: SRE & Chaos Engineering
**Priority**: High | **Estimate**: 1-2 weeks

- [ ] SLO/SLI definitions and tracking dashboard
- [ ] Chaos testing framework (Toxiproxy)
- [ ] Fault injection scenarios (network delay, service crash, DB failure, Kafka disconnect)
- [ ] Auto-recovery mechanisms (circuit breaker enhancement, graceful degradation)
- [ ] On-call runbooks for common incidents
- [ ] Disaster recovery drill scripts

**Success Criteria**:
- Documented SLOs with error budget tracking
- 5+ chaos test scenarios with automated verification
- Runbooks for all critical failure modes

---

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

### Phase 14: CI/CD Pipeline
**Priority**: Medium | **Estimate**: 1-2 weeks

- [ ] GitHub Actions workflows (build, test, deploy)
- [ ] Docker image build and push
- [ ] Blue-green deployment
- [ ] Automated rollback
- [ ] Environment promotion (dev → staging → prod)

**Success Criteria**:
- Zero-downtime deployments
- Automated testing in pipeline

---

### Phase 15: Performance Testing
**Priority**: Medium | **Estimate**: 1 week

- [ ] Load testing with k6
- [ ] Identify bottlenecks
- [ ] Database query optimization
- [ ] Connection pooling tuning
- [ ] Establish performance baselines

**Success Criteria**:
- Defined SLAs (p99 latency, throughput)
- Performance regression tests

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
| 2026-01-12 | SRE phase before Security | Demonstrate operational maturity first |
| 2026-01-11 | Vault for secrets | Centralized, auditable |
| 2026-01-10 | ES for Jaeger | Persistent trace storage |

---

**Last Updated**: 2026-01-12
