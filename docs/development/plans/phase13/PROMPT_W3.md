# Worker 3 Prompt - CI/CD Track

## Context

You are implementing Phase 13 (Security Hardening) for Chain Risk Platform. Your track focuses on **CI/CD security**: SAST, dependency scanning, container scanning, and secret detection.

**Repo**: `tihaya-anon/chain-risk-platform`

---

## Setup

```bash
git fetch origin develop/phase13
git checkout develop/phase13
```

---

## Your Task

### CP5 - Security Scanning CI Integration (Day 1)

**Branch**: `feature/cp5-security-scanning`

**Objective**: Integrate security scanning into CI pipeline with blocking gates.

**Deliverables**:
- `.github/workflows/security.yml` - Main security workflow
- `.trivy.yaml` - Trivy configuration
- `.semgrep.yaml` - Semgrep configuration
- `.semgrep/custom-rules.yaml` - Custom security rules
- `.gitleaks.toml` - Secret detection config

---

## Implementation

### 1. Security Workflow

```yaml
# .github/workflows/security.yml
name: Security Scan

on:
  push:
    branches: [main, develop/*]
  pull_request:
    branches: [main]
  schedule:
    - cron: '0 6 * * 1'

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

  dependency-scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Scan Go
        uses: aquasecurity/trivy-action@master
        with:
          scan-type: fs
          scan-ref: services/query-service
          severity: CRITICAL,HIGH
          exit-code: '1'
      - name: Scan Python
        uses: aquasecurity/trivy-action@master
        with:
          scan-type: fs
          scan-ref: services/risk-ml-service
          severity: CRITICAL,HIGH
      - name: Scan Node
        uses: aquasecurity/trivy-action@master
        with:
          scan-type: fs
          scan-ref: services/bff
          severity: CRITICAL,HIGH

  container-scan:
    runs-on: ubuntu-latest
    needs: [codeql]
    strategy:
      matrix:
        service: [query-service, alert-service, risk-ml-service, bff, orchestrator, graph-service]
    steps:
      - uses: aquasecurity/trivy-action@master
        with:
          image-ref: chainrisk/${{ matrix.service }}:${{ github.sha }}
          severity: CRITICAL,HIGH
          exit-code: '1'

  secret-scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - uses: gitleaks/gitleaks-action@v2
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}

  security-gate:
    runs-on: ubuntu-latest
    needs: [codeql, semgrep, dependency-scan, container-scan, secret-scan]
    steps:
      - name: Security Gate
        run: echo "All security checks passed"
```

---

### 2. Trivy Configuration

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
  config: .trivy-secret.yaml
```

---

### 3. Semgrep Configuration

```yaml
# .semgrep.yaml
rules:
  - p/security-audit
  - p/owasp-top-ten
  - p/golang
  - p/java
  - p/python
  - p/typescript

paths:
  include:
    - services/
  exclude:
    - "**/vendor/**"
    - "**/.venv/**"
    - "**/node_modules/**"
```

---

### 4. Custom Semgrep Rules

```yaml
# .semgrep/custom-rules.yaml
rules:
  - id: hardcoded-secret-pattern
    patterns:
      - pattern-either:
          - pattern: password = "..."
          - pattern: api_key = "..."
          - pattern: secret = "..."
    message: Potential hardcoded secret
    severity: ERROR
    languages: [go, java, python, typescript]

  - id: sql-string-concat
    patterns:
      - pattern: |
          db.Query($FMT + $INPUT)
    message: SQL injection risk - use parameterized queries
    severity: ERROR
    languages: [go]

  - id: unsafe-deserialization
    pattern: ObjectInputStream($INPUT)
    message: Unsafe deserialization
    severity: WARNING
    languages: [java]
```

---

### 5. Gitleaks Configuration

```toml
# .gitleaks.toml
title = "Chain Risk Platform Gitleaks Config"

[extend]
useDefault = true

[[rules]]
id = "chain-risk-api-key"
description = "Chain Risk API Key"
regex = '''chainrisk[_-]?api[_-]?key['":\s]*[=:]\s*['"]?[\w-]{32,}'''
secretGroup = 0
```

---

## Scan Schedule

| Scan Type | Trigger | Blocking |
|-----------|---------|----------|
| SAST (CodeQL) | PR, Push | Yes (High/Critical) |
| SAST (Semgrep) | PR, Push | Yes (Error) |
| Dependency | PR, Push | Yes (Critical) |
| Container | Post-build | Yes (Critical) |
| Secret | PR, Push | Yes (any) |
| Full | Weekly Mon 6AM | Report |

---

## Validation

```bash
# Local Trivy scan
trivy fs --severity CRITICAL,HIGH services/

# Local Semgrep scan
semgrep --config auto --severity ERROR services/

# Local Gitleaks scan
gitleaks detect --source .

# Trigger CI
git push origin feature/cp5-security-scanning
# Check Actions tab for workflow run
```

---

## Completion Criteria

- [ ] CodeQL configured for Go, Java, Python, TypeScript
- [ ] Semgrep with OWASP + custom rules
- [ ] Trivy for dependency scanning
- [ ] Container image scanning in CI
- [ ] Gitleaks secret detection
- [ ] Security gate blocks on critical findings
- [ ] SARIF results uploaded to GitHub Security

---

## Reference Docs

- [CP5_SECURITY_SCANNING.md](./CP5_SECURITY_SCANNING.md)

---

## On Completion

1. Merge `feature/cp5-security-scanning` → `develop/phase13`
2. Notify W1 that CP5 is complete
3. Verify workflow runs on develop branch

---

## Communication

- Notify W1 when complete
- Escalate if scans find critical issues in existing code
