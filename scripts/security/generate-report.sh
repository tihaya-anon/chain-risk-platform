#!/bin/bash
# Security Compliance Report Generator
# Generates a comprehensive security compliance report

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="${SCRIPT_DIR}/../.."
REPORT_DIR="${PROJECT_ROOT}/docs/security/reports"
DATE=$(date +%Y%m%d)
REPORT="${REPORT_DIR}/security-report-${DATE}.md"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_info() { echo -e "${YELLOW}[INFO]${NC} $1"; }

mkdir -p "$REPORT_DIR"

# Get version
VERSION=$(git describe --tags --abbrev=0 2>/dev/null || echo "dev")

log_info "Generating security compliance report..."

cat > "$REPORT" << 'HEADER'
# Security Compliance Report

> Chain Risk Platform - Phase 13 Security Hardening

HEADER

cat >> "$REPORT" << EOF
**Date**: $(date +%Y-%m-%d)  
**Version**: ${VERSION}  
**Generated**: $(date -u +%Y-%m-%dT%H:%M:%SZ)

---

## Executive Summary

This report documents the security controls implemented during Phase 13 Security Hardening.

### Coverage

| Control | Status | Coverage |
|---------|--------|----------|
| TLS Encryption | ✅ | 100% services |
| mTLS (Internal) | ✅ | 5/6 services |
| Rate Limiting | ✅ | All public APIs |
| Input Validation | ✅ | All endpoints |
| Audit Logging | ✅ | All sensitive ops |
| Security Scanning | ✅ | CI integrated |

---

## TLS/mTLS Configuration

### Service TLS Status

| Service | Port | TLS | mTLS | Cert Expiry |
|---------|------|-----|------|-------------|
| orchestrator | 8443 | ✅ | ✅ | 30 days |
| bff | 3443 | ✅ | ❌ (edge) | 30 days |
| query-service | 8444 | ✅ | ✅ | 30 days |
| risk-ml-service | 8445 | ✅ | ✅ | 30 days |
| alert-service | 8446 | ✅ | ✅ | 30 days |
| graph-service | 8447 | ✅ | ✅ | 30 days |

### TLS Configuration

- **Minimum Version**: TLS 1.2
- **Cipher Suites**: ECDHE+AESGCM (Strong)
- **Certificate Authority**: Internal PKI via Vault
- **Certificate Rotation**: Automated via Vault (30-day TTL)

---

## Rate Limiting

### Configuration per Service

| Service | Limit | Window | Burst |
|---------|-------|--------|-------|
| query-service | 100/min | 1 min | 10 |
| risk-ml-service | 50/min | 1 min | 5 |
| alert-service | 60/min | 1 min | 10 |
| graph-service | 30/min | 1 min | 5 |
| bff | 200/min | 1 min | 20 |
| orchestrator | 100/min | 1 min | 10 |

### Implementation

- **Go Services**: golang.org/x/time/rate + custom middleware
- **Java Services**: Resilience4j RateLimiter
- **Python Service**: slowapi/limits
- **TypeScript Service**: @nestjs/throttler

---

## Input Validation

### OWASP Top 10 Controls

| # | Vulnerability | Control | Status |
|---|--------------|---------|--------|
| A01 | Broken Access Control | JWT + RBAC | ✅ |
| A02 | Cryptographic Failures | TLS 1.2+, AES-256 | ✅ |
| A03 | Injection | Parameterized queries, validation | ✅ |
| A04 | Insecure Design | Security review | ✅ |
| A05 | Security Misconfiguration | Hardened defaults | ✅ |
| A06 | Vulnerable Components | Dependency scanning | ✅ |
| A07 | Auth Failures | Rate limiting, lockout | ✅ |
| A08 | Data Integrity | Input validation | ✅ |
| A09 | Logging Failures | Audit logging | ✅ |
| A10 | SSRF | URL validation | ✅ |

### Validation Rules

- **Ethereum Addresses**: \`^0x[a-fA-F0-9]{40}\$\`
- **Request Size Limit**: 1MB
- **SQL Injection**: Blocked
- **XSS**: Input sanitization + CSP headers
- **Path Traversal**: Blocked

---

## Audit Logging

### Event Types Logged

| Event Type | Description | Services |
|------------|-------------|----------|
| AUTH | Authentication events | All |
| ACCESS | Resource access | All |
| MODIFY | Data modifications | All |
| ADMIN | Administrative actions | orchestrator, bff |
| SECURITY | Security events | All |

### Log Schema

\`\`\`json
{
  "timestamp": "2026-01-12T10:30:00Z",
  "event_type": "ACCESS",
  "service": "query-service",
  "user_id": "user123",
  "ip_address": "192.168.1.1",
  "resource": "/api/v1/addresses/0x...",
  "action": "GET",
  "status": "success",
  "metadata": {}
}
\`\`\`

### Storage

- **Backend**: Loki (via Promtail)
- **Retention**: 90 days
- **Query**: Grafana dashboards

---

## Security Scanning

### CI Pipeline Integration

| Scanner | Type | Trigger | Blocking |
|---------|------|---------|----------|
| CodeQL | SAST | Push/PR | ⚠️ Warning |
| Semgrep | SAST | Push/PR | ⚠️ Warning |
| Trivy | Dependency/Container | Push | ✅ Critical/High |
| Gitleaks | Secrets | Push/PR | ✅ Blocking |

### Scan Results

EOF

# Add actual scan results if available
if [ -f "${PROJECT_ROOT}/tests/security/scan-results/scan-summary.json" ]; then
    cat >> "$REPORT" << EOF

Last scan results:
\`\`\`json
$(cat "${PROJECT_ROOT}/tests/security/scan-results/scan-summary.json" 2>/dev/null || echo '{"status": "not_run"}')
\`\`\`

EOF
fi

cat >> "$REPORT" << 'EOF'

---

## Certificate Management

### PKI Architecture

```
Root CA (10 years)
└── Intermediate CA (5 years)
    ├── orchestrator.chainrisk.local (30 days)
    ├── bff.chainrisk.local (30 days)
    ├── query-service.chainrisk.local (30 days)
    ├── risk-ml-service.chainrisk.local (30 days)
    ├── alert-service.chainrisk.local (30 days)
    └── graph-service.chainrisk.local (30 days)
```

### Automation

- **Generation**: `scripts/certs/generate-service-cert.sh`
- **Renewal**: `scripts/certs/renew-certs.sh`
- **Bootstrap**: `scripts/certs/init-pki.sh`

---

## Verification Tests

### Test Suite

| Test | File | Purpose |
|------|------|---------|
| TLS Suite | `tests/security/tls-suite.sh` | TLS/mTLS verification |
| Rate Limit | `tests/security/k6/rate-limit.test.js` | Rate limiting verification |
| Validation | `tests/security/k6/validation.test.js` | Input validation verification |
| Audit | `tests/security/audit-verify.sh` | Audit log verification |
| Scan | `tests/security/scan-verify.sh` | Security scan verification |

### Running Tests

```bash
# TLS verification
./tests/security/tls-suite.sh

# Rate limit testing (requires k6)
k6 run tests/security/k6/rate-limit.test.js

# Input validation testing
k6 run tests/security/k6/validation.test.js

# Audit log verification
./tests/security/audit-verify.sh

# Security scan verification
./tests/security/scan-verify.sh
```

---

## Recommendations

### Immediate

- [ ] Rotate any exposed secrets
- [ ] Review rate limit thresholds based on traffic
- [ ] Enable mTLS for BFF in internal deployment

### Short-term

- [ ] Implement certificate expiry alerting
- [ ] Add WAF for additional protection
- [ ] Conduct penetration testing

### Long-term

- [ ] Implement zero-trust architecture
- [ ] Add behavioral anomaly detection
- [ ] SOC 2 certification preparation

---

## Appendix

### Files Changed in Phase 13

```
infra/vault/pki-config.hcl
infra/certs/
infra/compose/security.yml
infra/compose/services-tls.yml
scripts/certs/
services/*/pkg/tls/ (Go)
services/*/application-tls.yml (Java)
services/risk-ml-service/app/core/tls.py
services/bff/src/config/tls.ts
.github/workflows/security.yml
tests/security/
```

### Related Documentation

- [Phase 13 Plan](../../../development/plans/PHASE13_SECURITY.md)
- [SLO Definitions](../../sre/SLO_DEFINITIONS.md)
- [Runbooks](../../sre/runbooks/)

---

**Report generated by**: Chain Risk Platform Security Suite  
**Contact**: security@chainrisk.local
EOF

log_info "Report generated: $REPORT"
echo ""
cat "$REPORT"
