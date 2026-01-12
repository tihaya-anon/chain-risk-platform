# Git Branch Strategy

## Strategy Selection

| Scenario | Strategy | Integration Branch |
|----------|----------|-------------------|
| Solo development | Simple | None (direct to main) |
| Multi-worker parallel | Phase-based | `develop/{phase}` |

---

## Simple Strategy (Solo)

For single developer or sequential work.

```
main ─────────────────────────────────►
       \            /
        feature/xxx ►
```

### Workflow

```bash
# Create feature branch
git checkout -b feature/xxx main

# Develop, then merge
git checkout main
git merge --no-ff feature/xxx
git branch -d feature/xxx
git push origin main
```

---

## Phase-based Strategy (Multi-worker)

For parallel development with multiple workers. See [PARALLEL_DEV_SOP.md](../../../operations/runbooks/PARALLEL_DEV_SOP.md).

```
main ─────────────────────────────────────────►
       \                              /
        develop/phase{N} ────────────►
           \      \      /      /
            cp1    cp2  cp3   cp4
```

### Workflow

1. Create `develop/phase{N}` from main
2. Workers branch from develop, merge back to develop
3. Phase complete → merge develop to main, tag release
4. **Delete develop branch after merge**

---

## Branch Naming

| Type | Pattern | Example |
|------|---------|---------|
| Main | `main` | - |
| Phase integration | `develop/phase{N}` | `develop/phase12` |
| Feature | `feature/{name}` | `feature/user-auth` |
| Fix | `fix/{issue}` | `fix/login-500` |
| Hotfix | `hotfix/{issue}` | `hotfix/critical-bug` |

---

## Critical Rules

### 1. Delete After Merge

```bash
# Local
git branch -d feature/xxx

# Remote
git push origin --delete feature/xxx

# Phase branch after completion
git branch -d develop/phase{N}
git push origin --delete develop/phase{N}
```

### 2. Periodic Cleanup

```bash
# Prune deleted remote branches
git fetch --prune

# Delete merged local branches
git branch --merged main | grep -v main | xargs git branch -d
```

### 3. No Orphan Branches

Every branch must be:
- Actively developed, OR
- Merged and deleted

Branches idle >7 days should be reviewed.
