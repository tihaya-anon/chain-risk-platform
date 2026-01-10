# Chain Risk Platform - Staging Runbook

## Overview

Procedures for deploying, operating, and troubleshooting the staging environment.

## Quick Reference

| Action | Command |
|--------|---------|
| Deploy | `./scripts/deploy/staging-deploy.sh deploy` |
| Verify | `./scripts/deploy/staging-deploy.sh verify` |
| Rollback | `./scripts/deploy/staging-deploy.sh rollback` |
| E2E Tests | `./scripts/deploy/staging-e2e.sh all` |
| Monitoring | `./scripts/deploy/verify-monitoring.sh report` |
| Load Test | `k6 run tests/load/staging-load.js` |

## Deployment

### Prerequisites

- kubectl configured with staging cluster access
- Docker images built and pushed to registry
- Secrets configured in cluster

### Deploy Steps

```bash
# 1. Check current state
./scripts/deploy/staging-deploy.sh status

# 2. Deploy
./scripts/deploy/staging-deploy.sh deploy

# 3. Verify
./scripts/deploy/staging-deploy.sh verify

# 4. Run smoke tests
./scripts/deploy/staging-e2e.sh smoke
```

### Rollback

```bash
# Rollback all deployments
./scripts/deploy/staging-deploy.sh rollback

# Rollback specific deployment
kubectl rollout undo deployment/staging-risk-service -n chain-risk-staging
```

## Monitoring

### Access

| Service | URL | Credentials |
|---------|-----|-------------|
| Grafana | http://grafana.staging.local | admin/admin |
| Prometheus | http://prometheus.staging.local | - |
| Jaeger | http://jaeger.staging.local | - |

### Key Dashboards

1. **Pipeline Overview** - Data flow metrics
2. **Service Health** - Pod status, resource usage
3. **Alert Metrics** - Alert volume and latency
4. **ML Performance** - GNN/XGBoost metrics

### Alerts

| Alert | Severity | Action |
|-------|----------|--------|
| HighErrorRate | Critical | Check logs, scale up |
| HighLatency | Warning | Check resource usage |
| PodCrashLoop | Critical | Check logs, rollback |
| DiskUsage>80% | Warning | Cleanup or expand |

## Troubleshooting

### Pod Issues

```bash
# Check pod status
kubectl get pods -n chain-risk-staging

# Describe problematic pod
kubectl describe pod <pod-name> -n chain-risk-staging

# View logs
kubectl logs <pod-name> -n chain-risk-staging --tail=100

# Previous container logs (if restarted)
kubectl logs <pod-name> -n chain-risk-staging --previous
```

### Service Issues

```bash
# Check endpoints
kubectl get endpoints -n chain-risk-staging

# Test service connectivity
kubectl run debug --rm -it --image=busybox -n chain-risk-staging -- wget -qO- http://staging-bff:3001/health

# Port forward for local testing
kubectl port-forward svc/staging-bff 3001:3001 -n chain-risk-staging
```

### Database Issues

```bash
# Check PostgreSQL connection
kubectl exec -it <postgres-pod> -n chain-risk-staging -- psql -U postgres -c "SELECT 1"

# Check Neo4j connection
kubectl exec -it <neo4j-pod> -n chain-risk-staging -- cypher-shell -u neo4j -p <password> "RETURN 1"
```

### Performance Issues

```bash
# Check resource usage
kubectl top pods -n chain-risk-staging

# Check HPA status
kubectl get hpa -n chain-risk-staging

# Force scale
kubectl scale deployment staging-risk-service --replicas=5 -n chain-risk-staging
```

## Operations

### Scaling

```bash
# Manual scale
kubectl scale deployment staging-<service> --replicas=N -n chain-risk-staging

# Update HPA limits
kubectl patch hpa staging-<service>-hpa -n chain-risk-staging \
  --patch '{"spec":{"maxReplicas":20}}'
```

### Config Updates

```bash
# Edit configmap
kubectl edit configmap staging-chain-risk-config -n chain-risk-staging

# Restart to apply
kubectl rollout restart deployment -n chain-risk-staging
```

### Secret Rotation

```bash
# Update secret
kubectl create secret generic staging-chain-risk-secrets \
  --from-literal=PG_PASSWORD=<new-password> \
  --dry-run=client -o yaml | kubectl apply -f -

# Restart services
kubectl rollout restart deployment -n chain-risk-staging
```

## Load Testing

```bash
# Smoke test (1 min)
k6 run --duration=1m --vus=5 tests/load/staging-load.js

# Full load test
k6 run tests/load/staging-load.js

# Custom config
k6 run -e BASE_URL=http://staging.local tests/load/staging-load.js
```

### Performance Targets

| Metric | Target |
|--------|--------|
| p95 Latency | < 500ms |
| Error Rate | < 1% |
| Throughput | > 100 req/s |

## Incident Response

### Severity Levels

| Level | Description | Response Time |
|-------|-------------|---------------|
| P1 | Service down | 15 min |
| P2 | Degraded | 1 hour |
| P3 | Minor issue | 4 hours |

### Escalation

1. On-call engineer
2. Team lead
3. Platform team

## Maintenance

### Daily

- [ ] Check Grafana dashboards
- [ ] Review firing alerts
- [ ] Check pod restart counts

### Weekly

- [ ] Review error logs
- [ ] Check resource trends
- [ ] Run E2E tests

### Monthly

- [ ] Run load tests
- [ ] Review and update runbook
- [ ] Rotate secrets
