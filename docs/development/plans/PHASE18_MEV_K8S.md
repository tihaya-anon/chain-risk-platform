# Phase 18: MEV Detection & Kubernetes Migration

## Goals

1. **MEV Detection** - Real-time mempool monitoring for sandwich attacks, front-running
2. **Kubernetes Migration** - Production-grade K8s deployment with GitOps

---

## Part A: MEV Detection

### Architecture

```
Mempool (Geth/Erigon WebSocket)
         ↓
  Mempool Collector (Go)
         ↓
  Kafka: mempool-pending-txs
         ↓
  Flink CEP Job
    ├── Sandwich Detector
    ├── Front-run Detector
    └── Abnormal Gas Detector
         ↓
  Kafka: mev-alerts
         ↓
  Alert Service
```

### Checkpoints

#### CP-A1: Mempool Collector

**Location**: `data-ingestion/mempool-collector/`

**Scope**:
- Go service, WebSocket connection to Geth/Erigon node
- Subscribe `newPendingTransactions`
- Decode transaction: from, to, value, gas, input data
- Publish to Kafka `mempool-pending-txs`

**Interface**:
```go
type PendingTx struct {
    Hash      string
    From      string
    To        string
    Value     string
    Gas       uint64
    GasPrice  string
    Input     string
    Timestamp int64
}
```

#### CP-A2: Flink MEV Detection Job

**Location**: `processing/stream-processor/src/main/java/.../mev/`

**Scope**:
- Flink CEP patterns for MEV detection
- Sandwich: detect tx pairs bracketing a victim tx
- Front-run: detect similar tx with higher gas preceding target

**Patterns**:
```
Sandwich Pattern:
  [BuyTx(token, high_gas)] -> [VictimTx(token)] -> [SellTx(token)]
  Within: same block window (~12s)

Front-run Pattern:
  [Tx1(similar_input, gas=G1)] -> [Tx2(similar_input, gas=G2)]
  Where: G1 > G2, Tx1.from != Tx2.from
```

#### CP-A3: Alert Integration

**Scope**:
- New alert types in alert-service
- MEV alert schema
- Dashboard updates

---

## Part B: Kubernetes Migration

### Architecture

```
GitHub Repo
     ↓ (push)
GitHub Actions (CI)
     ↓ (build & push)
Container Registry
     ↓
ArgoCD (GitOps)
     ↓ (sync)
Kubernetes Cluster
  ├── Namespace: chain-risk-prod
  │   ├── Deployment: bff
  │   ├── Deployment: query-service
  │   ├── Deployment: risk-ml-service
  │   ├── Deployment: alert-service
  │   ├── Deployment: graph-service
  │   └── Deployment: mempool-collector
  └── Namespace: chain-risk-infra
      ├── StatefulSet: kafka
      ├── StatefulSet: postgresql
      └── StatefulSet: redis
```

### Checkpoints

#### CP-B1: Helm Charts

**Location**: `infra/k8s/charts/`

**Scope**:
- Base chart for all services
- Per-service values files
- ConfigMaps, Secrets management

**Structure**:
```
infra/k8s/
├── charts/
│   └── chain-risk-service/
│       ├── Chart.yaml
│       ├── values.yaml
│       └── templates/
│           ├── deployment.yaml
│           ├── service.yaml
│           ├── hpa.yaml
│           ├── configmap.yaml
│           └── ingress.yaml
├── overlays/
│   ├── dev/
│   ├── staging/
│   └── prod/
└── argocd/
    └── applications.yaml
```

#### CP-B2: Resource Configuration

**Scope**:
- Resource requests/limits per service
- HPA configuration
- PodDisruptionBudget

**Example**:
```yaml
# query-service
resources:
  requests:
    cpu: 100m
    memory: 128Mi
  limits:
    cpu: 500m
    memory: 512Mi
hpa:
  minReplicas: 2
  maxReplicas: 10
  targetCPU: 70
```

#### CP-B3: ArgoCD GitOps

**Scope**:
- ArgoCD Application definitions
- Sync policies
- Rollback configuration

#### CP-B4: Network & Security

**Scope**:
- NetworkPolicy (service isolation)
- Ingress configuration
- TLS termination

---

## Deliverables

| Checkpoint | Output |
|------------|--------|
| CP-A1 | `data-ingestion/mempool-collector/` |
| CP-A2 | `processing/stream-processor/.../mev/` |
| CP-A3 | Alert types, dashboard |
| CP-B1 | `infra/k8s/charts/` |
| CP-B2 | Resource configs, HPA |
| CP-B3 | ArgoCD setup |
| CP-B4 | NetworkPolicy, Ingress |

---

## Effort Estimate

| Part | Effort |
|------|--------|
| A: MEV Detection | 5-7 days |
| B: K8s Migration | 5-7 days |
| **Total** | ~2 weeks |

---

## Dependencies

- Ethereum node access (Geth/Erigon with `--txpool` API)
- Kubernetes cluster (local: minikube/kind, or cloud)
- Container registry

---

## Success Criteria

1. MEV alerts firing on simulated sandwich attacks
2. All services running on K8s with HPA
3. GitOps: code push → auto deploy
4. Zero-downtime rolling updates

---

**Created**: 2026-01-14
