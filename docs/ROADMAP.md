# Chain Risk Platform - Roadmap

> Future development plans and priorities

---

## Completed (v0.10.0)

| Phase | Content | Date |
|-------|---------|------|
| 1-4 | Core platform, services, frontend | - |
| 5 | Alert Service | 2026-01-09 |
| 6 | GNN Integration | 2026-01-09 |
| 7 | Production Readiness | 2026-01-10 |
| 8 | Observability Stack | 2026-01-10 |
| 9 | Batch Orchestration | 2026-01-10 |
| 10 | Production Hardening | 2026-01-11 |

---

## Upcoming

### Phase 11: Performance Testing
**Priority**: High | **Estimate**: 1-2 weeks

- [ ] Load testing with k6 or Locust
- [ ] Identify bottlenecks
- [ ] Database query optimization
- [ ] Connection pooling tuning
- [ ] JVM/Go/Python runtime tuning
- [ ] Establish performance baselines

**Success Criteria**:
- Defined SLAs (p99 latency, throughput)
- Performance regression tests

---

### Phase 12: Security Hardening
**Priority**: High | **Estimate**: 1-2 weeks

- [ ] TLS for all service communication
- [ ] API rate limiting per user/IP
- [ ] Request validation and sanitization
- [ ] Security audit
- [ ] Penetration testing
- [ ] Audit logging

**Success Criteria**:
- All traffic encrypted
- OWASP Top 10 addressed

---

### Phase 13: CI/CD Pipeline
**Priority**: Medium | **Estimate**: 1-2 weeks

- [ ] GitHub Actions workflows
  - Build and test on PR
  - Docker image build and push
  - Automated deployment
- [ ] Blue-green deployment
- [ ] Automated rollback
- [ ] Environment promotion (dev → staging → prod)

**Success Criteria**:
- Zero-downtime deployments
- Automated testing in pipeline

---

## Backlog

| Feature | Priority | Description |
|---------|----------|-------------|
| Kubernetes Migration | Medium | Helm charts, HPA, PV |
| Multi-chain Support | Medium | Beyond Ethereum |
| Report Export | Low | PDF/CSV for compliance |
| User Management UI | Low | Admin interface |
| GraphQL API | Low | Alternative to REST |
| Mobile App | Low | Alert notifications |

---

## Contributing

1. Pick an issue from the roadmap
2. Create a feature branch: `feature/phase{N}-description`
3. Implement with tests
4. Submit PR for review

---

## Decision Log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-01-11 | Vault for secrets | Centralized, auditable |
| 2026-01-10 | ES for Jaeger | Persistent trace storage |
| 2026-01-10 | Airflow for batch | Mature, extensible |
| 2026-01-09 | GNN ensemble | Improved accuracy |

---

**Last Updated**: 2026-01-11
