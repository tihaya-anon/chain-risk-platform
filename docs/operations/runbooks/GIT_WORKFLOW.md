# Git Workflow

## Branch Strategy

```
main (production)
  └── feature/xxx, fix/xxx, docs/xxx
```

## Commit Convention

```
<type>(<scope>): <subject>
```

**Types**: feat, fix, docs, refactor, test, chore, perf

**Scopes**: data-ingestion, query-service, alert-service, risk-ml-service, bff, orchestrator, stream-processor, batch-processor, graph-service, frontend, infra, docs

**Examples**:
```bash
feat(query-service): add address query API
fix(stream-processor): handle null token address
docs(readme): update architecture diagram
refactor(graph-service): remove deprecated sync layer
```

## Daily Workflow

```bash
# 1. Create feature branch
git checkout main
git pull
git checkout -b feature/my-feature

# 2. Develop and commit
git add .
git commit -m "feat(scope): description"

# 3. Merge to main
git checkout main
git merge feature/my-feature --no-ff -m "Merge feature/my-feature"
git branch -d feature/my-feature
```

## Version Tags

```bash
git tag -a v1.0.0 -m "Release v1.0.0"
git push origin v1.0.0
```
