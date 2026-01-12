# Worker 1 Prompt - Infrastructure Track

## Context

You are implementing Phase 13 (Security Hardening) for Chain Risk Platform. Your track focuses on **infrastructure security**: certificate management, TLS/mTLS, and final integration.

**Repo**: `tihaya-anon/chain-risk-platform`

---

## Setup

```bash
git fetch origin develop/phase13
git checkout develop/phase13
```

---

## Your Tasks

### Task 1: CP1 - Certificate Management & Vault (Day 1)

**Branch**: `feature/cp1-cert-management`

**Objective**: Set up Vault PKI for certificate lifecycle management.

**Deliverables**:
- `infra/vault/pki-config.hcl` - Vault PKI policy
- `scripts/certs/init-pki.sh` - CA bootstrap script
- `scripts/certs/generate-service-cert.sh` - Cert generation script
- `infra/certs/{service}/` - Generated certs for all 6 services

**Implementation**:
1. Enable Vault PKI secrets engine
2. Create root CA and intermediate CA
3. Configure service roles with 30-day TTL
4. Generate certs for: orchestrator, bff, query-service, risk-ml-service, alert-service, graph-service
5. Update `infra/compose/vault.yml` with PKI bootstrap

**Validation**:
```bash
vault secrets list | grep pki
openssl verify -CAfile ca.pem cert.pem
```

**On completion**: Merge to `develop/phase13`, start CP2.

---

### Task 2: CP2 - TLS/mTLS Configuration (Day 2-3)

**Branch**: `feature/cp2-tls-mtls`

**Depends on**: CP1 complete

**Objective**: Enable TLS for all services, mTLS for internal communication.

**Deliverables**:
- `services/query-service/pkg/tls/config.go`
- `services/alert-service/pkg/tls/config.go`
- `services/orchestrator/src/main/resources/application-tls.yml`
- `services/graph-service/src/main/resources/application-tls.yml`
- `services/risk-ml-service/app/core/tls.py`
- `services/bff/src/config/tls.ts`
- Docker compose updates with cert mounts

**Configuration**:
| Service | External TLS | mTLS | Port |
|---------|-------------|------|------|
| orchestrator | ✓ | ✓ | 8443 |
| bff | ✓ | ✗ | 3443 |
| query-service | ✓ | ✓ | 8444 |
| risk-ml-service | ✓ | ✓ | 8445 |
| alert-service | ✓ | ✓ | 8446 |
| graph-service | ✓ | ✓ | 8447 |

**Validation**:
```bash
# Should fail (no client cert)
curl --insecure https://localhost:8444/health

# Should pass (with client cert)
curl --cert client.pem --key client-key.pem --cacert ca.pem https://localhost:8444/health
```

**On completion**: Merge to `develop/phase13`, wait for CP3-5.

---

### Task 3: CP6 - Integration & Verification (Day 4-5)

**Branch**: `feature/cp6-integration`

**Depends on**: CP2, CP3, CP4, CP5 all complete

**Objective**: Validate all security controls, generate compliance report.

**Deliverables**:
- `tests/security/tls-suite.sh`
- `tests/security/k6/rate-limit.test.js`
- `tests/security/k6/validation.test.js`
- `tests/security/audit-verify.sh`
- `scripts/security/generate-report.sh`
- `docs/security/reports/security-report-YYYYMMDD.md`

**Validation checklist**:
- [ ] All TLS handshakes succeed
- [ ] mTLS rejects requests without client cert
- [ ] Rate limiting triggers at threshold
- [ ] Invalid input returns 400
- [ ] Audit events appear in Loki
- [ ] No critical/high vulnerabilities in scan

**On completion**:
1. Generate compliance report
2. Merge to `develop/phase13`
3. Create PR: `develop/phase13` → `main`
4. Tag `v0.13.0`

---

## Reference Docs

- [CP1_CERT_MANAGEMENT.md](./CP1_CERT_MANAGEMENT.md)
- [CP2_TLS_MTLS.md](./CP2_TLS_MTLS.md)
- [CP6_INTEGRATION.md](./CP6_INTEGRATION.md)

---

## Tech Stack Reference

| Service | Language | Framework |
|---------|----------|-----------|
| query-service | Go | Gin |
| alert-service | Go | Gin |
| orchestrator | Java | Spring Boot |
| graph-service | Java | Spring Boot |
| risk-ml-service | Python | FastAPI |
| bff | TypeScript | NestJS |

---

## Communication

- Notify all workers when CP6 starts
- Escalate blockers immediately
- Update PR with progress
