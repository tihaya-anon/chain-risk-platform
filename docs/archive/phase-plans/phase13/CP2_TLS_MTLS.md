# CP2: TLS/mTLS Configuration

> **Worker**: W1  
> **Estimate**: 1 day  
> **Dependencies**: CP1 (Certificate Management)  
> **Parallel Group**: B

---

## Objective

Enable TLS for external endpoints and mTLS for inter-service communication.

---

## Tasks

### 2.1 Go Services (query-service, alert-service)

```go
// pkg/tls/config.go
func LoadTLSConfig(certPath, keyPath, caPath string) (*tls.Config, error) {
    cert, _ := tls.LoadX509KeyPair(certPath, keyPath)
    caCert, _ := os.ReadFile(caPath)
    caPool := x509.NewCertPool()
    caPool.AppendCertsFromPEM(caCert)
    
    return &tls.Config{
        Certificates: []tls.Certificate{cert},
        ClientCAs:    caPool,
        ClientAuth:   tls.RequireAndVerifyClientCert,
        MinVersion:   tls.VersionTLS12,
    }, nil
}
```

### 2.2 Java Services (orchestrator, graph-service)

```yaml
# application.yml
server:
  ssl:
    enabled: true
    key-store: classpath:keystore.p12
    key-store-password: ${SSL_KEYSTORE_PASSWORD}
    key-store-type: PKCS12
    client-auth: need
    trust-store: classpath:truststore.p12
    trust-store-password: ${SSL_TRUSTSTORE_PASSWORD}
```

### 2.3 Python Service (risk-ml-service)

```python
# app/core/tls.py
import ssl

def create_ssl_context(cert_path: str, key_path: str, ca_path: str) -> ssl.SSLContext:
    ctx = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
    ctx.load_cert_chain(cert_path, key_path)
    ctx.load_verify_locations(ca_path)
    ctx.verify_mode = ssl.CERT_REQUIRED
    ctx.minimum_version = ssl.TLSVersion.TLSv1_2
    return ctx
```

### 2.4 TypeScript Service (bff)

```typescript
// src/main.ts
import * as fs from 'fs';
import * as https from 'https';

const httpsOptions = {
  key: fs.readFileSync(process.env.TLS_KEY_PATH),
  cert: fs.readFileSync(process.env.TLS_CERT_PATH),
  ca: fs.readFileSync(process.env.TLS_CA_PATH),
  requestCert: false, // BFF is edge, no mTLS for clients
};
```

---

## Deliverables

| Artifact | Path |
|----------|------|
| Go TLS package | `services/query-service/pkg/tls/` |
| Go TLS package | `services/alert-service/pkg/tls/` |
| Java keystore config | `services/orchestrator/src/main/resources/` |
| Java keystore config | `services/graph-service/src/main/resources/` |
| Python TLS module | `services/risk-ml-service/app/core/tls.py` |
| BFF TLS config | `services/bff/src/config/tls.ts` |

---

## Configuration Matrix

| Service | External TLS | mTLS (Internal) | Port |
|---------|-------------|-----------------|------|
| orchestrator | ✓ | ✓ | 8443 |
| bff | ✓ | ✗ (edge) | 3443 |
| query-service | ✓ | ✓ | 8444 |
| risk-ml-service | ✓ | ✓ | 8445 |
| alert-service | ✓ | ✓ | 8446 |
| graph-service | ✓ | ✓ | 8447 |

---

## Docker Compose Updates

```yaml
# infra/compose/services.yml
services:
  query-service:
    environment:
      - TLS_ENABLED=true
      - TLS_CERT_PATH=/certs/cert.pem
      - TLS_KEY_PATH=/certs/key.pem
      - TLS_CA_PATH=/certs/ca.pem
    volumes:
      - ../certs/query-service:/certs:ro
```

---

## Validation

| Check | Command |
|-------|---------|
| TLS handshake | `openssl s_client -connect host:port` |
| Cert chain valid | `openssl s_client -showcerts -connect host:port` |
| mTLS required | `curl --insecure https://... → fail` |
| mTLS with cert | `curl --cert client.pem --key client-key.pem --cacert ca.pem https://...` |

---

## Test Script

```bash
#!/bin/bash
# tests/security/tls-verify.sh
SERVICES=("query-service:8444" "alert-service:8446" "risk-ml-service:8445")

for svc in "${SERVICES[@]}"; do
  echo "Testing $svc..."
  # Should fail without client cert
  curl -s --insecure "https://${svc}/health" && echo "FAIL: No mTLS" && exit 1
  # Should pass with client cert
  curl -s --cert /certs/client.pem --key /certs/client-key.pem \
       --cacert /certs/ca.pem "https://${svc}/health" || exit 1
done
echo "All TLS checks passed"
```

---

## Completion Criteria

- [ ] All services TLS enabled
- [ ] mTLS enforced for internal services
- [ ] BFF TLS-only (no mTLS for external clients)
- [ ] HTTP endpoints return redirect/error
- [ ] TLS test script passes
- [ ] Docker compose updated

---

## Handoff

Upon completion:
1. Merge `feature/cp2-tls-mtls` → `develop/phase13`
2. Wait for CP3-5 completion
3. Coordinate with W2/W3 for CP6 start

---

**Branch**: `feature/cp2-tls-mtls`
