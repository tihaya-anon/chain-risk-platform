# Worker B: CI/CD Pipeline

> Phase 14 implementation

---

## Role

Build CI/CD pipeline: GitHub Actions, automated testing, Docker builds, deployment automation.

## Timeline

| Day | Checkpoints | Output |
|-----|-------------|--------|
| 1 | B1: GitHub Actions Setup | `.github/workflows/ci.yml` |
| 2 | B2: Build Workflows | `.github/workflows/build.yml` |
| 3 | B3: Test Automation | `.github/workflows/test.yml` |
| 4 | B4: Docker Registry | Registry push config |
| 5 | B5: Blue-Green Deploy | `scripts/deploy/blue-green.sh` |
| 6 | B6: Rollback, B7: Validate | `scripts/deploy/rollback.sh` |

---

## B1: GitHub Actions Setup

### Task

Create base workflow structure.

### CI Workflow

```yaml
# .github/workflows/ci.yml
name: CI

on:
  pull_request:
    branches: [main, develop/*]
  push:
    branches: [main]

jobs:
  lint:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        service:
          - {name: query-service, lang: go}
          - {name: alert-service, lang: go}
          - {name: risk-ml-service, lang: python}
          - {name: graph-service, lang: java}
          - {name: orchestrator, lang: java}
          - {name: bff, lang: node}
    steps:
      - uses: actions/checkout@v4
      
      - name: Lint Go
        if: matrix.service.lang == 'go'
        uses: golangci/golangci-lint-action@v3
        with:
          working-directory: services/${{ matrix.service.name }}
          
      - name: Lint Python
        if: matrix.service.lang == 'python'
        run: |
          pip install ruff
          ruff check services/${{ matrix.service.name }}
          
      - name: Lint Java
        if: matrix.service.lang == 'java'
        run: |
          cd services/${{ matrix.service.name }}
          ./mvnw checkstyle:check
          
      - name: Lint Node
        if: matrix.service.lang == 'node'
        run: |
          cd services/${{ matrix.service.name }}
          npm ci
          npm run lint
```

### Dependabot

```yaml
# .github/dependabot.yml
version: 2
updates:
  - package-ecosystem: gomod
    directory: /services/query-service
    schedule:
      interval: weekly
  - package-ecosystem: gomod
    directory: /services/alert-service
    schedule:
      interval: weekly
  - package-ecosystem: pip
    directory: /services/risk-ml-service
    schedule:
      interval: weekly
  - package-ecosystem: maven
    directory: /services/graph-service
    schedule:
      interval: weekly
  - package-ecosystem: maven
    directory: /services/orchestrator
    schedule:
      interval: weekly
  - package-ecosystem: npm
    directory: /services/bff
    schedule:
      interval: weekly
  - package-ecosystem: github-actions
    directory: /
    schedule:
      interval: weekly
```

### Deliverables

- `.github/workflows/ci.yml`
- `.github/dependabot.yml`

### Done

- [ ] Lint runs on PR
- [ ] Dependabot configured

---

## B2: Build Workflows

### Task

Multi-service Docker build with caching.

### Build Workflow

```yaml
# .github/workflows/build.yml
name: Build

on:
  push:
    branches: [main]
    paths:
      - 'services/**'
      - '.github/workflows/build.yml'

env:
  REGISTRY: ghcr.io
  IMAGE_PREFIX: ${{ github.repository }}

jobs:
  changes:
    runs-on: ubuntu-latest
    outputs:
      services: ${{ steps.filter.outputs.changes }}
    steps:
      - uses: actions/checkout@v4
      - uses: dorny/paths-filter@v2
        id: filter
        with:
          filters: |
            query-service: 'services/query-service/**'
            alert-service: 'services/alert-service/**'
            risk-ml-service: 'services/risk-ml-service/**'
            graph-service: 'services/graph-service/**'
            orchestrator: 'services/orchestrator/**'
            bff: 'services/bff/**'

  build:
    needs: changes
    if: ${{ needs.changes.outputs.services != '[]' }}
    runs-on: ubuntu-latest
    strategy:
      matrix:
        service: ${{ fromJson(needs.changes.outputs.services) }}
    steps:
      - uses: actions/checkout@v4
      
      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3
        
      - name: Login to Registry
        uses: docker/login-action@v3
        with:
          registry: ${{ env.REGISTRY }}
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}
          
      - name: Extract metadata
        id: meta
        uses: docker/metadata-action@v5
        with:
          images: ${{ env.REGISTRY }}/${{ env.IMAGE_PREFIX }}/${{ matrix.service }}
          tags: |
            type=sha
            type=ref,event=branch
            type=semver,pattern={{version}}
            
      - name: Build and push
        uses: docker/build-push-action@v5
        with:
          context: services/${{ matrix.service }}
          push: true
          tags: ${{ steps.meta.outputs.tags }}
          cache-from: type=gha
          cache-to: type=gha,mode=max
```

### Deliverables

- `.github/workflows/build.yml`

### Done

- [ ] Changed services build automatically
- [ ] Images pushed to registry
- [ ] Build uses cache (<5min with cache)

---

## B3: Test Automation

### Task

Automated test execution in CI.

### Test Workflow

```yaml
# .github/workflows/test.yml
name: Test

on:
  pull_request:
    branches: [main, develop/*]

jobs:
  unit-test:
    runs-on: ubuntu-latest
    strategy:
      fail-fast: false
      matrix:
        include:
          - service: query-service
            cmd: go test -v -race -coverprofile=coverage.out ./...
          - service: alert-service
            cmd: go test -v -race -coverprofile=coverage.out ./...
          - service: risk-ml-service
            cmd: pytest --cov=app --cov-report=xml
          - service: graph-service
            cmd: ./mvnw test jacoco:report
          - service: orchestrator
            cmd: ./mvnw test jacoco:report
          - service: bff
            cmd: npm test -- --coverage
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Go
        if: contains(matrix.cmd, 'go test')
        uses: actions/setup-go@v5
        with:
          go-version: '1.21'
          
      - name: Setup Python
        if: contains(matrix.cmd, 'pytest')
        uses: actions/setup-python@v5
        with:
          python-version: '3.11'
          
      - name: Setup Java
        if: contains(matrix.cmd, 'mvnw')
        uses: actions/setup-java@v4
        with:
          java-version: '17'
          distribution: 'temurin'
          
      - name: Setup Node
        if: contains(matrix.cmd, 'npm')
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          
      - name: Install dependencies
        working-directory: services/${{ matrix.service }}
        run: |
          if [ -f "go.mod" ]; then go mod download; fi
          if [ -f "requirements.txt" ]; then pip install -r requirements.txt pytest pytest-cov; fi
          if [ -f "package.json" ]; then npm ci; fi
          
      - name: Run tests
        working-directory: services/${{ matrix.service }}
        run: ${{ matrix.cmd }}
        
      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          directory: services/${{ matrix.service }}
          flags: ${{ matrix.service }}

  contract-test:
    runs-on: ubuntu-latest
    needs: unit-test
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup k6
        run: |
          sudo gpg -k
          sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg \
            --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
          echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" \
            | sudo tee /etc/apt/sources.list.d/k6.list
          sudo apt-get update && sudo apt-get install k6
          
      - name: Start services
        run: make docker-up
        
      - name: Wait for healthy
        run: ./scripts/wait-for-healthy.sh
        
      - name: Run contract tests
        run: make api-test-contracts
        env:
          TEST_ENV: docker
```

### Deliverables

- `.github/workflows/test.yml`
- `scripts/wait-for-healthy.sh`

### Done

- [ ] Unit tests run on PR
- [ ] Contract tests run after unit tests
- [ ] Coverage reported to Codecov

---

## B4: Docker Registry

### Task

Configure image registry and tagging.

### Tagging Strategy

| Event | Tag |
|-------|-----|
| Push to main | `sha-abc1234`, `main` |
| Tag v1.2.3 | `1.2.3`, `1.2`, `1`, `latest` |
| PR | `pr-123` (no push) |

### Registry Setup

For GitHub Container Registry (ghcr.io):
- Images: `ghcr.io/tihaya-anon/chain-risk-platform/<service>`
- Auth: `GITHUB_TOKEN` (automatic)

### Image Cleanup

```yaml
# .github/workflows/cleanup.yml
name: Cleanup Images

on:
  schedule:
    - cron: '0 0 * * 0'  # Weekly

jobs:
  cleanup:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/delete-package-versions@v4
        with:
          package-name: chain-risk-platform/*
          package-type: container
          min-versions-to-keep: 10
          delete-only-untagged-versions: true
```

### Deliverables

- `.github/workflows/cleanup.yml`
- Update build.yml with proper tagging

### Done

- [ ] Images pushed to ghcr.io
- [ ] Tags follow convention
- [ ] Old images cleaned up

---

## B5: Blue-Green Deploy

### Task

Zero-downtime deployment script.

### Script

```bash
#!/bin/bash
# scripts/deploy/blue-green.sh

set -e

SERVICE=$1
NEW_IMAGE=$2
HEALTH_ENDPOINT=${3:-/health}

if [ -z "$SERVICE" ] || [ -z "$NEW_IMAGE" ]; then
  echo "Usage: $0 <service> <image> [health_endpoint]"
  exit 1
fi

BLUE="${SERVICE}"
GREEN="${SERVICE}-green"

echo "=== Blue-Green Deploy: $SERVICE ==="

# Start green instance
echo "[1/5] Starting green instance..."
docker run -d --name "$GREEN" \
  --network chainrisk-backend \
  -e "$(docker inspect $BLUE --format '{{range .Config.Env}}{{.}} {{end}}')" \
  "$NEW_IMAGE"

# Wait for healthy
echo "[2/5] Waiting for green to be healthy..."
for i in $(seq 1 30); do
  if docker exec "$GREEN" wget -qO- "http://localhost${HEALTH_ENDPOINT}" >/dev/null 2>&1; then
    echo "Green is healthy"
    break
  fi
  [ $i -eq 30 ] && { echo "Green failed health check"; docker rm -f "$GREEN"; exit 1; }
  sleep 2
done

# Switch traffic (update DNS/proxy)
echo "[3/5] Switching traffic to green..."
# For Docker: rename containers
docker stop "$BLUE"
docker rename "$BLUE" "${BLUE}-old"
docker rename "$GREEN" "$BLUE"

# Verify
echo "[4/5] Verifying new instance..."
sleep 5
if ! docker exec "$BLUE" wget -qO- "http://localhost${HEALTH_ENDPOINT}" >/dev/null 2>&1; then
  echo "New instance unhealthy, rolling back..."
  docker stop "$BLUE"
  docker rename "$BLUE" "$GREEN"
  docker rename "${BLUE}-old" "$BLUE"
  docker start "$BLUE"
  docker rm -f "$GREEN"
  exit 1
fi

# Cleanup old
echo "[5/5] Cleaning up old instance..."
docker rm -f "${BLUE}-old"

echo "=== Deploy complete ==="
```

### Deliverables

- `scripts/deploy/blue-green.sh`

### Done

- [ ] Deploy switches traffic after health OK
- [ ] Auto-rollback on health failure
- [ ] Old instance removed

---

## B6: Rollback Mechanism

### Task

Quick rollback to previous version.

### Script

```bash
#!/bin/bash
# scripts/deploy/rollback.sh

set -e

SERVICE=$1

if [ -z "$SERVICE" ]; then
  echo "Usage: $0 <service>"
  exit 1
fi

# Get previous image
PREVIOUS_IMAGE=$(cat "/tmp/deploy-history/${SERVICE}-previous" 2>/dev/null)

if [ -z "$PREVIOUS_IMAGE" ]; then
  echo "No previous version found for $SERVICE"
  echo "Available history:"
  ls -la /tmp/deploy-history/ 2>/dev/null || echo "No history"
  exit 1
fi

echo "=== Rollback: $SERVICE to $PREVIOUS_IMAGE ==="

# Use blue-green for rollback
./scripts/deploy/blue-green.sh "$SERVICE" "$PREVIOUS_IMAGE"

echo "=== Rollback complete ==="
```

### Deploy History

```bash
# In blue-green.sh, add before deploy:
mkdir -p /tmp/deploy-history
CURRENT_IMAGE=$(docker inspect "$BLUE" --format '{{.Config.Image}}' 2>/dev/null || echo "")
if [ -n "$CURRENT_IMAGE" ]; then
  echo "$CURRENT_IMAGE" > "/tmp/deploy-history/${SERVICE}-previous"
fi
echo "$NEW_IMAGE" > "/tmp/deploy-history/${SERVICE}-current"
```

### Deliverables

- `scripts/deploy/rollback.sh`
- Update blue-green.sh with history

### Done

- [ ] Rollback completes in <30s
- [ ] Previous version tracked
- [ ] Works with blue-green script

---

## B7: Validation

### Task

End-to-end CI/CD validation.

### Script

```bash
#!/bin/bash
# scripts/validate-phase14.sh

echo "=== Phase 14 Validation ==="

# Workflows exist
[ -f ".github/workflows/ci.yml" ] && echo "✓ CI workflow" || echo "✗ CI workflow"
[ -f ".github/workflows/build.yml" ] && echo "✓ Build workflow" || echo "✗ Build workflow"
[ -f ".github/workflows/test.yml" ] && echo "✓ Test workflow" || echo "✗ Test workflow"

# Deploy scripts
[ -x "scripts/deploy/blue-green.sh" ] && echo "✓ Blue-green script" || echo "✗ Blue-green script"
[ -x "scripts/deploy/rollback.sh" ] && echo "✓ Rollback script" || echo "✗ Rollback script"

# Test deploy (dry run)
echo "Testing deploy script..."
./scripts/deploy/blue-green.sh query-service "query-service:latest" --dry-run \
  && echo "✓ Deploy dry-run" || echo "✗ Deploy dry-run"

echo "=== Done ==="
```

### Deliverables

- `scripts/validate-phase14.sh`
- `docs/archive/phase-docs/PHASE14_SUMMARY.md`
- Update `CHANGELOG.md`

### Done

- [ ] All workflows valid YAML
- [ ] Deploy scripts executable
- [ ] Validation passes

---

## File Checklist

```
.github/
├── workflows/
│   ├── ci.yml
│   ├── build.yml
│   ├── test.yml
│   └── cleanup.yml
└── dependabot.yml

scripts/
├── deploy/
│   ├── blue-green.sh
│   └── rollback.sh
├── wait-for-healthy.sh
└── validate-phase14.sh
```
