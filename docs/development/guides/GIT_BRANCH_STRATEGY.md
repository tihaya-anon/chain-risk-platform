# Git Branch Strategy

## Branch Naming

| Type | Pattern | Example | Lifecycle |
|------|---------|---------|-----------|
| Main | `main` | - | Permanent |
| Feature | `feature/<name>` | `feature/user-auth` | Merge → Delete |
| Fix | `fix/<issue>` | `fix/login-error` | Merge → Delete |
| Hotfix | `hotfix/<issue>` | `hotfix/critical-bug` | Merge → Delete |

## Workflow

```
main ─────────────────────────────────────────►
       \                    /
        feature/xxx ───────►
```

1. Create branch from `main`
2. Develop and test
3. Merge to `main` (prefer `--no-ff`)
4. Delete branch immediately after merge

## Rules

- **No long-lived branches** except `main`
- **Delete after merge** - both local and remote
- **No develop branch** - main is always deployable
- **Rebase before merge** if behind main

## Commands

```bash
# Create feature branch
git checkout -b feature/new-feature main

# Merge and delete
git checkout main
git merge --no-ff feature/new-feature
git branch -d feature/new-feature
git push origin --delete feature/new-feature

# Clean stale branches
git fetch --prune
git branch --merged main | grep -v main | xargs git branch -d
```
