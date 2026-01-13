# Development SOP

> Standard operating procedure for checkpoint-based parallel development.

---

## Branch Model

```
main
└── develop/phase{N}              # Integration branch
    └── feature/cp{X}-desc        # Feature branches (short-lived)
```

---

## Workflow

### Start Phase

```bash
git checkout main && git pull
git checkout -b develop/phase{N}
git push -u origin develop/phase{N}
```

### Checkpoint Work

```bash
# Start
git checkout develop/phase{N} && git pull
git checkout -b feature/cp{X}-desc

# ... work ...

# Complete
git add -A && git commit -m "feat(cp{X}): description"
git push -u origin feature/cp{X}-desc

# Merge
git checkout develop/phase{N} && git pull
git merge --no-ff feature/cp{X}-desc
git push

# Cleanup
git branch -d feature/cp{X}-desc
git push origin --delete feature/cp{X}-desc
```

### Complete Phase

```bash
git checkout main && git pull
git merge --no-ff develop/phase{N} -m "feat: phase {N} complete"
git tag -a v0.{N}.0 -m "Phase {N}"
git push origin main --tags

# Cleanup
git branch -d develop/phase{N}
git push origin --delete develop/phase{N}
```

---

## Pre-Handoff Checklist

Before switching tasks or ending session, verify:

```bash
# Check unpushed commits
git log origin/$(git branch --show-current)..HEAD

# Check uncommitted changes  
git status

# Check remote sync
git fetch && git status
```

**All three must be clean before handoff.**

| Check | Command | Expected |
|-------|---------|----------|
| Uncommitted | `git status` | "nothing to commit" |
| Unpushed | `git log origin/HEAD..HEAD` | Empty |
| Remote sync | `git fetch && git status` | "up to date" |

---

## Coordination

| Rule | Action |
|------|--------|
| Dependency block | Notify upstream immediately |
| Conflict | Upstream owner resolves |
| Merge order | Follow dependency DAG |

---

## Commit Format

```
<type>(<scope>): <description>

# Types: feat, fix, docs, test, refactor, chore
# Scope: cp{N} or service name
```

---

## Remote Operations

```bash
# Sync and restart service
ssh dev-win "cd ~/chain-risk-platform && git pull && docker-compose up -d --build <service>"

# View logs
ssh dev-win "cd ~/chain-risk-platform && docker logs -f <service>"
```

---

**Updated**: 2026-01-13
