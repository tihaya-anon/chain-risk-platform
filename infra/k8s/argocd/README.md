# ArgoCD GitOps Configuration

## Setup

```bash
# Install ArgoCD
kubectl create namespace argocd
kubectl apply -n argocd -f https://raw.githubusercontent.com/argoproj/argo-cd/stable/manifests/install.yaml

# Apply project and apps
kubectl apply -f infra/k8s/argocd/project.yaml
kubectl apply -f infra/k8s/argocd/applicationset.yaml
kubectl apply -f infra/k8s/argocd/infra-app.yaml

# Get initial password
kubectl -n argocd get secret argocd-initial-admin-secret -o jsonpath="{.data.password}" | base64 -d
```

## Architecture

```
GitHub Push → ArgoCD Sync → K8s Apply
     ↓              ↓
  Webhook      ApplicationSet
                   ↓
            Per-service Apps
```

## Applications

| App | Source | Destination |
|-----|--------|-------------|
| bff | charts/chain-risk-service + values/bff.yaml | chain-risk-prod |
| query-service | charts/chain-risk-service + values/query-service.yaml | chain-risk-prod |
| risk-ml-service | charts/chain-risk-service + values/risk-ml-service.yaml | chain-risk-prod |
| alert-service | charts/chain-risk-service + values/alert-service.yaml | chain-risk-prod |
| graph-service | charts/chain-risk-service + values/graph-service.yaml | chain-risk-prod |
| mempool-collector | charts/chain-risk-service + values/mempool-collector.yaml | chain-risk-prod |

## Sync Policies

- **Automated**: Enabled with prune and self-heal
- **Retry**: 5 attempts with exponential backoff
- **Prune**: Foreground propagation

## Rollback

```bash
# List history
argocd app history <app-name>

# Rollback to revision
argocd app rollback <app-name> <revision>
```
