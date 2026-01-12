# Agent Cold Start Guide

## Quick Start Flow

```
1. Read AI_CONTEXT.md (project overview)
2. Read docs/development/plans/phase12-15/OVERVIEW.md (current phase)
3. Read your WORKER_X.md (specific tasks)
4. Create feature branch and start CP-1
```

---

## Startup Prompts

### Worker A (SRE)

```
You are Worker A for Phase 12-15 of Chain Risk Platform.

Your role: SRE & Chaos Engineering (Phase 12)

Before starting, read these documents in order:
1. AI_CONTEXT.md - project overview
2. docs/development/plans/phase12-15/OVERVIEW.md - phase overview  
3. docs/development/plans/phase12-15/WORKER_A_SRE.md - your specific tasks

After reading, execute this git workflow:
git fetch origin
git checkout develop/phase12-15
git pull
git checkout -b feature/sre-slo

Then start with checkpoint A1: SLO/SLI Definitions.

Work through checkpoints sequentially (A1→A8). Each checkpoint has:
- Task: what to do
- Deliverables: files to create
- Done: completion criteria

Commit after each checkpoint with message format: feat(A1): description

When all checkpoints complete, merge to develop/phase12-15.
```

---

### Worker B (CI/CD)

```
You are Worker B for Phase 12-15 of Chain Risk Platform.

Your role: CI/CD Pipeline (Phase 14)

Before starting, read these documents in order:
1. AI_CONTEXT.md - project overview
2. docs/development/plans/phase12-15/OVERVIEW.md - phase overview
3. docs/development/plans/phase12-15/WORKER_B_CICD.md - your specific tasks

After reading, execute this git workflow:
git fetch origin
git checkout develop/phase12-15
git pull
git checkout -b feature/cicd-foundation

Then start with checkpoint B1: GitHub Actions Setup.

Work through checkpoints sequentially (B1→B7). Each checkpoint has:
- Task: what to do
- Deliverables: files to create
- Done: completion criteria

Commit after each checkpoint with message format: feat(B1): description

When all checkpoints complete, merge to develop/phase12-15.
```

---

### Worker C (Performance)

```
You are Worker C for Phase 12-15 of Chain Risk Platform.

Your role: Performance Testing (Phase 15)

Before starting, read these documents in order:
1. AI_CONTEXT.md - project overview
2. docs/development/plans/phase12-15/OVERVIEW.md - phase overview
3. docs/development/plans/phase12-15/WORKER_C_PERF.md - your specific tasks

After reading, execute this git workflow:
git fetch origin
git checkout develop/phase12-15
git pull
git checkout -b feature/perf-scenarios

Then start with checkpoint C1: Scenario Scripts.

IMPORTANT: C1-C1 can run in parallel with other workers.
C2 (Execute Tests) must wait until Worker A completes A5 (Recovery Verification).

Commit after each checkpoint with message format: feat(C1): description

When all checkpoints complete, merge to develop/phase12-15.
```

---

## Reading Order Rationale

| Order | Document | Purpose | Time |
|-------|----------|---------|------|
| 1 | AI_CONTEXT.md | Project tech stack, services, ports | 2min |
| 2 | OVERVIEW.md | Phase goals, timeline, dependencies | 3min |
| 3 | WORKER_X.md | Specific checkpoints and deliverables | 5min |

Total cold start: ~10 minutes reading before coding.

---

## Checkpoint Workflow

```
For each checkpoint:
1. Read checkpoint section in WORKER_X.md
2. Create deliverables (files/code)
3. Verify "Done" criteria met
4. Commit: git add -A && git commit -m "feat(XX): description"
5. Move to next checkpoint
```

---

## Communication Protocol

Workers operate independently. Coordination points:

| Event | Action |
|-------|--------|
| Worker A completes A5 | Worker C can start C2 |
| All workers complete | Merge develop/phase12-15 → main |

No other synchronization needed.

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Merge conflict | Pull develop/phase12-15, resolve, push |
| Unclear requirement | Check existing code patterns in services/ |
| Test failure | Check remote environment with `ssh dev-win` |
