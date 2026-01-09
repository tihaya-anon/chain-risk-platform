# Kubernetes Deployment Guide

## Prerequisites

- Kubernetes cluster (1.25+)
- kubectl configured
- kustomize (or kubectl with kustomize support)
- Container registry access

## Directory Structure

```
infra/k8s/
├── base/                    # Base manifests
│   ├── namespace.yaml
│   ├── configmap.yaml
│   ├── secrets.yaml
│   ├── pvc.yaml
│   ├── ingress.yaml
│   ├── hpa.yaml
│   ├── kustomization.yaml
│   └── <service>/deployment.yaml
└── overlays/
    ├── dev/                 # Development overlay
    ├── staging/             # Staging overlay
    └── prod/                # Production overlay
```

## Quick Start

### Deploy to Dev

```bash
# Preview
kubectl kustomize infra/k8s/overlays/dev

# Apply
kubectl apply -k infra/k8s/overlays/dev
```

### Deploy to Staging

```bash
kubectl apply -k infra/k8s/overlays/staging
```

### Deploy to Production

```bash
kubectl apply -k infra/k8s/overlays/prod
```

## Services

| Service | Port | Description |
|---------|------|-------------|
| query-service | 8081 | Transaction/address queries |
| risk-service | 8082 | ML risk scoring |
| alert-service | 8083 | Alert management |
| graph-service | 8084 | Neo4j graph queries |
| bff | 3001 | API Gateway |
| orchestrator | 8085 | Workflow orchestration |
| stream-processor | 8086 | Flink stream processing |

## Configuration

### Secrets Management

Replace placeholder secrets before deployment:

```bash
# Create secret from file
kubectl create secret generic chain-risk-secrets \
  --from-literal=PG_PASSWORD=<password> \
  --from-literal=NEO4J_PASSWORD=<password> \
  -n chain-risk
```

For production, use:
- Sealed Secrets
- External Secrets Operator
- HashiCorp Vault

### ConfigMap Updates

```bash
# Update config
kubectl edit configmap chain-risk-config -n chain-risk

# Restart deployments to pick up changes
kubectl rollout restart deployment -n chain-risk
```

## Scaling

### Manual Scaling

```bash
kubectl scale deployment query-service --replicas=5 -n chain-risk
```

### HPA Configuration

HPA is pre-configured for:
- query-service: 2-10 replicas (CPU 70%)
- risk-service: 2-8 replicas (CPU 60%)
- bff: 2-10 replicas (CPU 70%)
- graph-service: 2-6 replicas (CPU 70%)
- alert-service: 2-6 replicas (CPU 70%)

## Monitoring

### Check Status

```bash
# All resources
kubectl get all -n chain-risk

# Pods
kubectl get pods -n chain-risk -w

# HPA status
kubectl get hpa -n chain-risk
```

### Logs

```bash
# Single pod
kubectl logs -f deployment/query-service -n chain-risk

# All pods of a service
kubectl logs -l app=query-service -n chain-risk --tail=100
```

### Port Forwarding (Debug)

```bash
# BFF
kubectl port-forward svc/bff 3001:3001 -n chain-risk

# Risk Service
kubectl port-forward svc/risk-service 8082:8082 -n chain-risk
```

## Troubleshooting

### Pod Not Starting

```bash
kubectl describe pod <pod-name> -n chain-risk
kubectl logs <pod-name> -n chain-risk --previous
```

### Service Not Accessible

```bash
# Check endpoints
kubectl get endpoints -n chain-risk

# Check ingress
kubectl describe ingress chain-risk-ingress -n chain-risk
```

### Resource Issues

```bash
# Check resource usage
kubectl top pods -n chain-risk
kubectl top nodes
```

## Rollback

```bash
# View history
kubectl rollout history deployment/query-service -n chain-risk

# Rollback
kubectl rollout undo deployment/query-service -n chain-risk

# Rollback to specific revision
kubectl rollout undo deployment/query-service --to-revision=2 -n chain-risk
```
