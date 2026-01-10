# Phase 7 Git Branch Strategy

> Branch management for multi-worker parallel development

**Created**: 2026-01-09

---

## Branch Structure

```
main                              # Production-ready code
└── develop/phase7                # Phase 7 integration branch
    ├── feature/cp1-infra-verify      # Worker 1
    ├── feature/cp2-data-generator    # Worker 1
    ├── feature/cp3-rolling-cleanup   # Worker 2
    ├── feature/cp4-metrics-export    # Worker 3
    ├── feature/cp5-e2e-suite         # Worker 1
    ├── feature/cp6-gnn-e2e           # Worker 1
    ├── feature/cp7-k8s-manifests     # Worker 1
    ├── feature/cp8-grafana-dashboards# Worker 2
    └── feature/cp9-staging-deploy    # Worker 1
```

---

## Worker Assignments

| Worker | Checkpoints | Parallel Stage |
|--------|-------------|----------------|
| 1 | CP-1, CP-2, CP-5, CP-6, CP-7, CP-9 | Main path |
| 2 | CP-3, CP-8 | Parallel path |
| 3 | CP-4 | Independent |

---

## Workflow

### Starting a Checkpoint

```bash
# Sync with integration branch
git checkout develop/phase7
git pull origin develop/phase7

# Create feature branch
git checkout -b feature/cpX-description
```

### Completing a Checkpoint

```bash
# Ensure tests pass
make test

# Commit with conventional format
git add .
git commit -m "feat(cpX): brief description"

# Push feature branch
git push origin feature/cpX-description

# Merge to integration branch (after PR review if applicable)
git checkout develop/phase7
git merge --no-ff feature/cpX-description -m "feat(cpX): checkpoint description complete"
git push origin develop/phase7
```

### Handling Dependencies

Per DAG in ROADMAP_PHASE7.md:

- **CP-2, CP-3, CP-4**: Wait for CP-1 merge to develop/phase7
- **CP-5**: Wait for CP-2 AND CP-3 merge
- **CP-6**: Wait for CP-5 merge
- **CP-7, CP-8**: Wait for CP-6 merge (CP-8 also needs CP-4)
- **CP-9**: Wait for CP-7 AND CP-8 merge

```bash
# Before starting dependent checkpoint, sync integration branch
git checkout develop/phase7
git pull origin develop/phase7
git checkout -b feature/cpX-description
```

---

## Commit Message Convention

```
feat(cpX): description     # New feature for checkpoint X
fix(cpX): description      # Bug fix
docs(cpX): description     # Documentation
test(cpX): description     # Test additions
refactor(cpX): description # Code refactoring
```

Examples:
- `feat(cp2): implement scenario-based data generator`
- `fix(cp5): resolve Kafka consumer timeout in E2E tests`
- `docs(cp7): add K8s deployment runbook`

---

## Phase Completion

When all checkpoints complete:

```bash
# Final merge to main
git checkout main
git merge --no-ff develop/phase7 -m "feat: Phase 7 production readiness complete"
git tag -a v0.7.0 -m "Phase 7: Production Readiness"
git push origin main --tags
```

---

## Quick Reference

| Action | Command |
|--------|---------|
| Start checkpoint | `git checkout develop/phase7 && git pull && git checkout -b feature/cpX-desc` |
| Complete checkpoint | `git checkout develop/phase7 && git merge --no-ff feature/cpX-desc` |
| Sync before dependent work | `git checkout develop/phase7 && git pull origin develop/phase7` |
| Check current branch | `git branch --show-current` |
| View DAG status | See ROADMAP_PHASE7.md |
