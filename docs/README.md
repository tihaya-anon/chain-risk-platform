# Chain Risk Platform - Documentation

## Quick Navigation

| Purpose | Document |
|---------|----------|
| Project Overview | [AI_CONTEXT.md](../AI_CONTEXT.md) |
| Getting Started | [QUICK_START.md](getting-started/QUICK_START.md) |
| Architecture | [PROJECT_OVERVIEW.md](architecture/overview/PROJECT_OVERVIEW.md) |
| Roadmap | [ROADMAP.md](ROADMAP.md) |

---

## Structure

```
docs/
├── architecture/          # System design
│   ├── overview/         # High-level architecture
│   ├── components/       # Component deep-dives
│   └── decisions/        # Tech decisions
├── api-specs/            # OpenAPI specifications
├── development/          # Development resources
│   ├── plans/           # Current phase plans
│   └── troubleshooting/ # Issue resolution
├── operations/           # Operational docs
│   ├── runbooks/        # Deployment & workflow
│   ├── policies/        # Data policies
│   └── testing/         # Test procedures
├── sre/                  # SRE practices
│   └── runbooks/        # Incident response
├── business/             # Domain knowledge
├── performance/          # Benchmarks
└── archive/              # Historical (Phase 1-18)
```

---

## Key Documents

### Architecture
- [Project Overview](architecture/overview/PROJECT_OVERVIEW.md)
- [Lambda Architecture](architecture/components/LAMBDA_ARCHITECTURE.md)
- [BFF Architecture](architecture/components/BFF_ARCHITECTURE.md)
- [Tech Decisions](architecture/decisions/TECH_DECISIONS.md)

### Development
- [Dev SOP](operations/runbooks/DEV_SOP.md)
- [Git Workflow](operations/runbooks/GIT_WORKFLOW.md)
- [Phase 19 Plan](development/plans/PHASE19_PLATFORM_ENGINEERING.md)

### Operations
- [Docker Deployment](operations/runbooks/DOCKER_DEPLOYMENT.md)
- [Nacos Integration](operations/runbooks/NACOS_INTEGRATION.md)
- [Integration Testing](operations/testing/THREE_PHASE_TESTING.md)

### SRE
- [SLO Definitions](sre/SLO_DEFINITIONS.md)
- [Chaos Scenarios](sre/CHAOS_SCENARIOS.md)
- [Incident Runbooks](sre/runbooks/)

### API
- [API Specs Guide](api-specs/API_SPECS_GUIDE.md)

---

## Services (Remote Docker)

| Service | Port | Health |
|---------|------|--------|
| BFF | 3401 | /health |
| Query | 18081 | /health |
| Risk ML | 8082 | /health |
| Alert | 18083 | /health |
| Graph | 8084 | /actuator/health |

---

## Status

**Version**: v0.19.0 | **Phase 19**: Platform Engineering

| Phase | Content | Status |
|-------|---------|--------|
| 1-18 | Core Platform | ✅ |
| **19** | **Platform Engineering** | 🔄 |
