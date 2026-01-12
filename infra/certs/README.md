# Chain Risk Platform - TLS Certificates

This directory contains TLS/mTLS certificates for all platform services.

## Structure

```
certs/
├── root-ca.pem           # Root CA certificate
├── intermediate-ca.pem   # Intermediate CA certificate
├── ca-chain.pem          # Full CA chain
├── orchestrator/         # Java Spring Gateway
├── bff/                  # TypeScript NestJS
├── query-service/        # Go Gin
├── risk-ml-service/      # Python FastAPI
├── alert-service/        # Go Gin
├── graph-service/        # Java Spring
└── client/               # mTLS test client
```

## Certificate Files (per service)

| File | Description | Permission |
|------|-------------|------------|
| `cert.pem` | Service certificate | 644 |
| `key.pem` | Private key | 600 |
| `ca.pem` | Intermediate CA | 644 |
| `ca-chain.pem` | Full CA chain | 644 |
| `fullchain.pem` | Cert + CA chain | 644 |
| `keystore.p12` | Java keystore (Java services only) | 600 |
| `truststore.p12` | Java truststore (Java services only) | 600 |

## Generation

```bash
# Initialize PKI (first time only)
export VAULT_TOKEN=<your-token>
./scripts/certs/init-pki.sh

# Generate all service certificates
./scripts/certs/generate-service-cert.sh --all

# Generate single service certificate
./scripts/certs/generate-service-cert.sh query-service
```

## Certificate Lifecycle

| Type | TTL | Rotation |
|------|-----|----------|
| Root CA | 10 years | Manual |
| Intermediate CA | 5 years | Manual |
| Service certs | 30 days | Automated via Vault |

## Security Notes

- Private keys (`key.pem`) must never be committed to git
- Use `.gitignore` to exclude sensitive files
- Rotate certificates before expiration
- Monitor certificate expiry via Prometheus alerts

## Verification

```bash
# Verify certificate chain
openssl verify -CAfile ca-chain.pem cert.pem

# Check certificate details
openssl x509 -in cert.pem -noout -text

# Test TLS connection
openssl s_client -connect localhost:8444 -CAfile ca-chain.pem
```
