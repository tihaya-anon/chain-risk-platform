# Quick Start

## Prerequisites

Go 1.21+, Java 17+, Python 3.11+, Node 18+, Docker 24+, Make

## Setup

```bash
# 1. Clone and configure
git clone <repo-url> && cd chain-risk-platform
echo "DOCKER_HOST_IP=192.168.x.x" > .env.local

# 2. SSH config (~/.ssh/config)
Host dev-win
    HostName 192.168.x.x
    User your-username

# 3. Verify
source scripts/load-env.sh
make infra-check
```

## Run Services

```bash
make query-run    # or risk/alert/graph/orch/bff
curl http://localhost:8081/health
```

## UIs

| UI | URL |
|----|-----|
| Grafana | `http://<remote>:13001` |
| Jaeger | `http://<remote>:26686` |
| Nacos | `http://<remote>:18848/nacos` |

## Next

- [DEV_SOP](../operations/runbooks/DEV_SOP.md) - Development workflow
- [AI_CONTEXT](../../AI_CONTEXT.md) - Project overview
