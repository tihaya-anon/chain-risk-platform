# CP1: Certificate Management & Vault Integration

> **Worker**: W1  
> **Estimate**: 1 day  
> **Dependencies**: None  
> **Parallel Group**: A

---

## Objective

Establish PKI infrastructure using Vault for certificate lifecycle management.

---

## Tasks

### 1.1 Vault PKI Engine Setup
- Enable PKI secrets engine
- Configure root CA (internal)
- Create intermediate CA for service certs
- Set TTL policies (service certs: 30d, CA: 1y)

### 1.2 Certificate Generation Scripts
- Script: `scripts/certs/generate-service-cert.sh`
- Parameters: service name, SAN list, validity period
- Output: cert.pem, key.pem, ca.pem

### 1.3 Vault Role Configuration
- Create roles per service with appropriate policies
- Configure allowed_domains, allow_subdomains
- Set key usage (serverAuth, clientAuth)

### 1.4 Docker Compose Integration
- Update `infra/compose/vault.yml` with PKI config
- Add init script for PKI bootstrap
- Configure auto-unseal (dev mode)

---

## Deliverables

| Artifact | Path |
|----------|------|
| Vault PKI config | `infra/vault/pki-config.hcl` |
| Cert generation script | `scripts/certs/generate-service-cert.sh` |
| CA bootstrap script | `scripts/certs/init-pki.sh` |
| Vault compose update | `infra/compose/vault.yml` |
| Service cert directory | `infra/certs/` |

---

## Implementation

### Vault PKI Configuration

```hcl
# infra/vault/pki-config.hcl
path "pki/*" {
  capabilities = ["create", "read", "update", "delete", "list"]
}

path "pki_int/*" {
  capabilities = ["create", "read", "update", "delete", "list"]
}
```

### Certificate Generation Script

```bash
#!/bin/bash
# scripts/certs/generate-service-cert.sh
SERVICE=$1
VAULT_ADDR=${VAULT_ADDR:-http://localhost:8200}

vault write -format=json pki_int/issue/service-role \
  common_name="${SERVICE}.chainrisk.local" \
  alt_names="${SERVICE},localhost" \
  ip_sans="127.0.0.1" \
  ttl="720h" | jq -r '.data' > /tmp/cert-data.json

jq -r '.certificate' /tmp/cert-data.json > infra/certs/${SERVICE}/cert.pem
jq -r '.private_key' /tmp/cert-data.json > infra/certs/${SERVICE}/key.pem
jq -r '.ca_chain[0]' /tmp/cert-data.json > infra/certs/${SERVICE}/ca.pem
```

---

## Validation

| Check | Command |
|-------|---------|
| Vault PKI enabled | `vault secrets list \| grep pki` |
| CA cert valid | `openssl x509 -in ca.pem -noout -text` |
| Service cert chain | `openssl verify -CAfile ca.pem cert.pem` |
| Cert SAN correct | `openssl x509 -in cert.pem -noout -ext subjectAltName` |

---

## Service Certificate Matrix

| Service | CN | SANs |
|---------|----|----|
| orchestrator | orchestrator.chainrisk.local | orchestrator, localhost |
| bff | bff.chainrisk.local | bff, localhost |
| query-service | query-service.chainrisk.local | query-service, localhost |
| risk-ml-service | risk-ml-service.chainrisk.local | risk-ml-service, localhost |
| alert-service | alert-service.chainrisk.local | alert-service, localhost |
| graph-service | graph-service.chainrisk.local | graph-service, localhost |

---

## Completion Criteria

- [ ] Vault PKI engine configured
- [ ] Root CA generated and stored
- [ ] Intermediate CA generated
- [ ] Certificate generation script functional
- [ ] All 6 service certificates generated
- [ ] Certificate verification passes

---

## Handoff

Upon completion:
1. Merge `feature/cp1-cert-management` → `develop/phase13`
2. Notify W1 to start CP2
3. Document any deviations in PR

---

**Branch**: `feature/cp1-cert-management`
