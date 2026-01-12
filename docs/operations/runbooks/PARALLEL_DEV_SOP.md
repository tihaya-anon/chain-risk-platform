# Parallel Development SOP

> Branch strategy for multi-worker checkpoint-based development

---

## Branch Structure

```
main
└── develop/{phase}                    # Integration branch (temporary)
    ├── feature/{cp}-{description}     # Worker feature branches
    └── ...
```

---

## Workflow

### 1. Phase Setup

```bash
git checkout main && git pull
git checkout -b develop/phase{N}
git push -u origin develop/phase{N}
```

### 2. Checkpoint Development

```bash
# Start
git checkout develop/phase{N} && git pull
git checkout -b feature/cp{X}-{description}

# Work...

# Complete - merge and DELETE feature branch
git checkout develop/phase{N} && git pull
git merge --no-ff feature/cp{X}-{description}
git branch -d feature/cp{X}-{description}
git push
```

### 3. Phase Completion

```bash
git checkout main
git merge --no-ff develop/phase{N} -m "feat: Phase {N} complete"
git tag -a v0.{N}.0 -m "Phase {N}"
git push origin main --tags

# DELETE develop branch
git branch -d develop/phase{N}
git push origin --delete develop/phase{N}
```

---

## Branch Cleanup Checklist

After each checkpoint:
- [ ] Feature branch deleted locally
- [ ] Feature branch deleted remotely (if pushed)

After phase completion:
- [ ] Develop branch deleted locally
- [ ] Develop branch deleted remotely
- [ ] `git fetch --prune` executed

---

## Commit Convention

```
feat(cp{X}): description
fix(cp{X}): description
docs(cp{X}): description
```

---

## Assignment Table

| CP | Task | Worker | Depends | Notify |
|----|------|--------|---------|--------|
| 1 | Infrastructure | W1 | - | - |
| 2 | Data Layer | W1 | CP-1 | - |
| 3 | API Layer | W2 | CP-1 | - |
| 4 | Integration | W1 | CP-2,3 | W2 |

---

## Coordination Rules

1. **Merge Order**: Follow dependency DAG
2. **Conflict Resolution**: Upstream owner resolves
3. **Blocking**: Notify immediately if blocked
4. **Cleanup**: Delete branches after merge (mandatory)
