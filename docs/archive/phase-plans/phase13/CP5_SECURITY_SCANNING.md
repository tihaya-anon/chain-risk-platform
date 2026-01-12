# CP5: Security Scanning CI Integration

> **Worker**: W3  
> **Estimate**: 0.5 day  
> **Dependencies**: None  
> **Parallel Group**: A

---

## Objective

Integrate SAST, dependency scanning, and container image scanning into CI pipeline.

---

## Tasks

### 5.1 SAST - CodeQL/Semgrep

```yaml
# .github/workflows/security.yml
name: Security Scan

on:
  push:
    branches: [main, develop/*]
  pull_request:
    branches: [main]
  schedule:
    - cron: '0 6 * * 1'  # Weekly Monday 6AM

jobs:
  codeql:
    runs-on: ubuntu-latest
    permissions:
      security-events: write
    strategy:
      matrix:
        language: [go, java, javascript, python]
    steps:
      - uses: actions/checkout@v4
      - uses: github/codeql-action/init@v3
        with:
          languages: ${{ matrix.language }}
      - uses: github/codeql-action/autobuild@v3
      - uses: github/codeql-action/analyze@v3
        with:
          category: "/language:${{ matrix.language }}"

  semgrep:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: returntocorp/semgrep-action@v1
        with:
          config: >-
            p/security-audit
            p/owasp-top-ten
            p/golang
            p/java
            p/python
            p/typescript
```

---

### 5.2 Dependency Scanning - Trivy

```yaml
  dependency-scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      # Go dependencies
      - name: Scan Go modules
        uses: aquasecurity/trivy-action@master
        with:
          scan-type: 'fs'
          scan-ref: 'services/query-service'
          format: 'sarif'
          output: 'go-trivy.sarif'

      # Python dependencies
      - name: Scan Python deps
        uses: aquasecurity/trivy-action@master
        with:
          scan-type: 'fs'
          scan-ref: 'services/risk-ml-service'
          format: 'sarif'
          output: 'python-trivy.sarif'

      # Node dependencies
      - name: Scan Node deps
        uses: aquasecurity/trivy-action@master
        with:
          scan-type: 'fs'
          scan-ref: 'services/bff'
          format: 'sarif'
          output: 'node-trivy.sarif'

      - name: Upload results
        uses: github/codeql-action/upload-sarif@v3
        with:
          sarif_file: '.'
```

---

### 5.3 Container Image Scanning

```yaml
  container-scan:
    runs-on: ubuntu-latest
    needs: [build]
    strategy:
      matrix:
        service: [query-service, alert-service, risk-ml-service, bff, orchestrator, graph-service]
    steps:
      - name: Scan image
        uses: aquasecurity/trivy-action@master
        with:
          image-ref: 'chainrisk/${{ matrix.service }}:${{ github.sha }}'
          format: 'sarif'
          output: '${{ matrix.service }}-image.sarif'
          severity: 'CRITICAL,HIGH'
          exit-code: '1'

      - name: Upload results
        uses: github/codeql-action/upload-sarif@v3
        with:
          sarif_file: '${{ matrix.service }}-image.sarif'
```

---

### 5.4 Secret Detection

```yaml
  secret-scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Gitleaks scan
        uses: gitleaks/gitleaks-action@v2
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}

      - name: TruffleHog scan
        uses: trufflesecurity/trufflehog@main
        with:
          extra_args: --only-verified
```

---

### 5.5 Security Gate Configuration

```yaml
  security-gate:
    runs-on: ubuntu-latest
    needs: [codeql, semgrep, dependency-scan, container-scan, secret-scan]
    steps:
      - name: Check results
        run: |
          # Fail if any critical/high vulnerabilities found
          if [ "${{ needs.container-scan.result }}" == "failure" ]; then
            echo "::error::Container scan found critical vulnerabilities"
            exit 1
          fi
```

---

### 5.6 Trivy Config

```yaml
# .trivy.yaml
severity:
  - CRITICAL
  - HIGH

ignore-unfixed: true

vulnerability:
  type:
    - os
    - library

secret:
  config: trivy-secret.yaml
```

---

### 5.7 Semgrep Rules

```yaml
# .semgrep/custom-rules.yaml
rules:
  - id: hardcoded-secret
    patterns:
      - pattern-either:
          - pattern: $KEY = "..."
          - pattern: password = "..."
    message: Hardcoded secret detected
    severity: ERROR
    languages: [go, java, python, typescript]

  - id: sql-injection
    patterns:
      - pattern: |
          db.Query($FMT + $INPUT)
    message: Potential SQL injection
    severity: ERROR
    languages: [go]
```

---

## Deliverables

| Artifact | Path |
|----------|------|
| Security workflow | `.github/workflows/security.yml` |
| Trivy config | `.trivy.yaml` |
| Semgrep config | `.semgrep.yaml` |
| Custom rules | `.semgrep/custom-rules.yaml` |
| Gitleaks config | `.gitleaks.toml` |

---

## Scan Schedule

| Scan Type | Trigger | Blocking |
|-----------|---------|----------|
| SAST | PR, Push | Yes (High/Critical) |
| Dependency | PR, Push | Yes (Critical) |
| Container | Post-build | Yes (Critical) |
| Secret | PR, Push | Yes (any) |
| Full scan | Weekly | Report only |

---

## Validation

| Check | Method |
|-------|--------|
| SAST runs | Trigger PR → check workflow |
| Dependency scan | Check SARIF output |
| Container scan | Build image → verify scan |
| Secret detection | Commit test secret → verify block |
| Gate blocks | Introduce vuln → verify fail |

---

## Completion Criteria

- [ ] CodeQL configured for all languages
- [ ] Semgrep with OWASP rules
- [ ] Trivy dependency scanning
- [ ] Container image scanning
- [ ] Secret detection (Gitleaks)
- [ ] Security gate blocks on critical
- [ ] SARIF results uploaded to GH Security

---

## Handoff

Upon completion:
1. Merge `feature/cp5-security-scanning` → `develop/phase13`
2. Notify W1 of completion status

---

**Branch**: `feature/cp5-security-scanning`
