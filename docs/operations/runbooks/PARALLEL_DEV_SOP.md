# Parallel Development SOP

> Branch strategy and coordination for multi-worker checkpoint-based development

---

## Branch Structure

```
main
└── develop/{phase}                    # Integration branch
    ├── feature/{cp}-{description}     # Worker feature branches
    └── ...
```

---

## Workflow

### 1. Phase Setup

```bash
# Create integration branch from main
git checkout main && git pull
git checkout -b develop/phase{N}
git push -u origin develop/phase{N}
```

### 2. Checkpoint Development

```bash
# Start: sync and branch
git checkout develop/phase{N} && git pull
git checkout -b feature/cp{X}-{description}

# Work...

# Complete: merge back
git checkout develop/phase{N} && git pull
git merge --no-ff feature/cp{X}-{description}
git push
```

### 3. Dependency Handling

Before starting a checkpoint with dependencies:

```bash
# Ensure all upstream CPs merged
git checkout develop/phase{N}
git pull origin develop/phase{N}
# Verify upstream CPs are included, then branch
git checkout -b feature/cp{X}-{description}
```

### 4. Phase Completion

```bash
git checkout main
git merge --no-ff develop/phase{N} -m "feat: Phase {N} complete"
git tag -a v0.{N}.0 -m "Phase {N}"
git push origin main --tags
```

---

## Commit Convention

```
feat(cp{X}): description
fix(cp{X}): description
docs(cp{X}): description
test(cp{X}): description
```

---

## Assignment Table Template

Use this format for phase planning:

| CP | Task | Worker | Depends | Notify |
|----|------|--------|---------|--------|
| 1 | Infrastructure | W1 | - | - |
| 2 | Data Layer | W1 | CP-1 | - |
| 3 | API Layer | W2 | CP-1 | - |
| 4 | Integration | W1 | CP-2,3 | W2 |

- **Worker**: Assigned owner
- **Depends**: Must be merged before starting
- **Notify**: Ping when complete (downstream owners)

---

## Coordination Rules

1. **Merge Order**: Follow DAG strictly, no skip
2. **Conflict Resolution**: Upstream owner resolves
3. **Blocking**: If blocked, notify in channel immediately
4. **Handoff**: Ping downstream workers after merge
