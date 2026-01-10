# Development Workflow

## Daily Development Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Development Cycle                            │
│                                                                     │
│   1. Pull latest    2. Code locally    3. Sync to remote           │
│      from main         & test              (git push)               │
│         │                 │                    │                    │
│         ▼                 ▼                    ▼                    │
│   ┌─────────┐       ┌─────────┐          ┌─────────┐               │
│   │  git    │       │  Local  │          │ Remote  │               │
│   │  pull   │ ───▶  │  Dev    │  ───▶    │  Test   │               │
│   └─────────┘       └─────────┘          └─────────┘               │
│                           │                    │                    │
│                           ▼                    ▼                    │
│                     Unit tests           Integration tests          │
│                     Static checks        E2E validation             │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

## Code Sync Methods

### Method 1: Git (Recommended)

```bash
# Local: commit and push
git add -A && git commit -m "feat: your change"
git push origin your-branch

# Remote: pull and restart
ssh dev-win "cd ~/chain-risk-platform && git pull && docker-compose up -d"
```

### Method 2: SCP (Quick sync)

```bash
# Sync specific file
scp services/query-service/main.go dev-win:~/chain-risk-platform/services/query-service/

# Sync directory
scp -r services/risk-ml-service/ dev-win:~/chain-risk-platform/services/
```

### Method 3: rsync (Bulk sync)

```bash
# Sync entire services directory (exclude build artifacts)
rsync -avz --exclude='*.pyc' --exclude='node_modules' --exclude='target' \
  services/ dev-win:~/chain-risk-platform/services/
```

## Branch Strategy

```
main                          # Production-ready code
└── develop/phase{N}          # Phase integration branch
    └── feature/cp{X}-desc    # Checkpoint feature branch
```

### Starting a New Task

```bash
# 1. Sync with latest
git checkout main && git pull

# 2. Create feature branch (if new phase)
git checkout -b develop/phase10
git push -u origin develop/phase10

# 3. Create checkpoint branch
git checkout -b feature/cp1-new-feature
```

### Completing a Task

```bash
# 1. Commit your work
git add -A
git commit -m "feat(cp1): implement new feature"

# 2. Merge to integration branch
git checkout develop/phase10
git pull
git merge --no-ff feature/cp1-new-feature
git push

# 3. Cleanup (optional)
git branch -d feature/cp1-new-feature
```

### Phase Completion

```bash
# Merge to main and tag
git checkout main
git merge --no-ff develop/phase10 -m "feat: Phase 10 complete"
git tag -a v0.10.0 -m "Phase 10"
git push origin main --tags
```

## Testing Workflow

### 1. Local Development

```bash
# Run service locally
make query-run

# Run unit tests
make query-test

# Static checks
make lint
```

### 2. Integration Testing

```bash
# Ensure remote infra is running
ssh dev-win "cd ~/chain-risk-platform && docker ps"

# Run integration tests
make test-integration
```

### 3. Remote Validation

```bash
# Sync code to remote
git push

# SSH and pull on remote
ssh dev-win "cd ~/chain-risk-platform && git pull"

# Restart services on remote
ssh dev-win "cd ~/chain-risk-platform && docker-compose up -d --build query-service"

# Check logs
ssh dev-win "cd ~/chain-risk-platform && docker logs -f query-service"
```

## Remote Operations

### Check Running Services

```bash
ssh dev-win "cd ~/chain-risk-platform && docker ps --format 'table {{.Names}}\t{{.Status}}'"
```

### Restart a Service

```bash
ssh dev-win "cd ~/chain-risk-platform && docker-compose restart query-service"
```

### View Logs

```bash
ssh dev-win "cd ~/chain-risk-platform && docker logs -f --tail 100 query-service"
```

### Start/Stop Infrastructure

```bash
# Start all
ssh dev-win "cd ~/chain-risk-platform && docker-compose up -d"

# Stop all
ssh dev-win "cd ~/chain-risk-platform && docker-compose down"

# Start specific services
ssh dev-win "cd ~/chain-risk-platform && docker-compose up -d kafka postgres redis"
```

## Monitoring During Development

### Check Service Health

```bash
# Grafana dashboards
open "http://$DOCKER_HOST_IP:13001"

# Jaeger traces
open "http://$DOCKER_HOST_IP:26686"

# Prometheus metrics
open "http://$DOCKER_HOST_IP:19090"
```

### Quick Health Checks

```bash
# All services
make infra-check

# Specific service
curl http://localhost:8081/health  # local
curl "http://$DOCKER_HOST_IP:8081/health"  # remote
```

## Commit Message Convention

```
<type>(<scope>): <description>

Types:
- feat: New feature
- fix: Bug fix
- docs: Documentation
- test: Tests
- refactor: Code refactoring
- chore: Maintenance

Scope (optional):
- cp{N}: Checkpoint number
- service name: query, risk, alert, etc.

Examples:
- feat(cp3): add Loki datasource
- fix(risk-ml): correct OTel package name
- docs: update development workflow
```

## Tips

1. **Always load env first**: `source scripts/load-env.sh`
2. **Check connectivity before testing**: `make infra-check`
3. **Use feature branches**: Never commit directly to main
4. **Sync frequently**: Push small, incremental changes
5. **Check logs on failure**: Both local and remote
