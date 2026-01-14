# CP5: Validation and Final Cleanup

> **Worker**: W1 + W2  
> **Estimate**: 0.5 day  
> **Dependencies**: CP3, CP4  
> **Parallel Group**: C

---

## Objective

Validate the complete system and finalize documentation.

---

## Tasks

### 5.1 Integration Testing

Run full E2E test suite:

```bash
cd services/bff
npm run test:e2e

cd ../../frontend
npm run test:e2e
```

### 5.2 Manual Verification Checklist

| Test | Expected | Actual |
|------|----------|--------|
| Frontend login | JWT returned | |
| Address query | Data returned | |
| Risk score | Score returned | |
| Graph neighbors | Nodes returned | |
| Orchestration endpoints | Aggregated data | |
| Rate limiting | 429 after limit | |

### 5.3 Performance Comparison

```bash
# Before (with orchestrator) - baseline from previous tests
# After (BFF only)
curl -w "@curl-format.txt" -o /dev/null -s http://localhost:3001/api/v1/addresses/0x123
```

Expected: ~5-10ms latency reduction.

### 5.4 Update Documentation

| Document | Update |
|----------|--------|
| `README.md` | Remove orchestrator from architecture |
| `docs/architecture/` | Update diagrams |
| `GATEWAY_BFF_ARCHITECTURE.md` | Archive or update |

### 5.5 Delete Orchestrator Code

After validation passes:

```bash
rm -rf services/orchestrator
git add -A
git commit -m "chore: remove deprecated orchestrator service"
```

---

## Deliverables

| Artifact | Path |
|----------|------|
| Test results | PR description |
| Updated README | `README.md` |
| Updated architecture | `docs/architecture/` |

---

## Validation

| Check | Pass |
|-------|------|
| All E2E tests pass | [ ] |
| Manual tests pass | [ ] |
| No orchestrator references | [ ] |
| Documentation updated | [ ] |

---

## Completion Criteria

- [ ] E2E tests pass
- [ ] Manual verification complete
- [ ] Orchestrator code deleted
- [ ] Documentation updated
- [ ] PR ready for review

---

## Merge Process

```bash
# Merge feature branches
git checkout refactor/bff-consolidation
git merge refactor/cp1-bff-gateway
git merge refactor/cp2-orchestration

# Final validation
make test

# Merge to main
git checkout main
git merge --no-ff refactor/bff-consolidation
git tag v1.x.0
git push origin main --tags
```

---

**Branch**: `refactor/bff-consolidation` (merge target)
