#!/bin/bash
# ============================================================
# Staging Deployment Script
# ============================================================
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$(dirname "$SCRIPT_DIR")")"

source "$PROJECT_ROOT/scripts/common.sh"

# Configuration
NAMESPACE="chain-risk-staging"
OVERLAY_PATH="$PROJECT_ROOT/infra/k8s/overlays/staging"
TIMEOUT="300s"

log_section "Staging Deployment"

# Check prerequisites
check_prerequisites() {
    log_info "Checking prerequisites..."
    
    if ! command -v kubectl &> /dev/null; then
        log_error "kubectl not found"
        exit 1
    fi
    
    if ! kubectl cluster-info &> /dev/null; then
        log_error "Cannot connect to Kubernetes cluster"
        exit 1
    fi
    
    log_info "Prerequisites OK"
}

# Build and push images
build_images() {
    log_section "Building Images"
    
    local REGISTRY="${REGISTRY:-localhost:5000}"
    local TAG="${TAG:-staging}"
    
    services=(
        "query-service:services/query-service"
        "risk-service:services/risk-ml-service"
        "alert-service:services/alert-service"
        "graph-service:services/graph-service"
        "bff:services/bff"
        "orchestrator:services/orchestrator"
        "stream-processor:processing/stream-processor"
    )
    
    for svc in "${services[@]}"; do
        name="${svc%%:*}"
        path="${svc#*:}"
        
        if [ -f "$PROJECT_ROOT/$path/Dockerfile" ]; then
            log_info "Building $name..."
            docker build -t "$REGISTRY/chain-risk/$name:$TAG" "$PROJECT_ROOT/$path"
            docker push "$REGISTRY/chain-risk/$name:$TAG" 2>/dev/null || true
        else
            log_warn "Dockerfile not found for $name, skipping"
        fi
    done
}

# Deploy to staging
deploy() {
    log_section "Deploying to Staging"
    
    # Create namespace if not exists
    kubectl create namespace "$NAMESPACE" --dry-run=client -o yaml | kubectl apply -f -
    
    # Apply kustomize overlay
    log_info "Applying kustomize overlay..."
    kubectl apply -k "$OVERLAY_PATH"
    
    # Wait for deployments
    log_info "Waiting for deployments to be ready..."
    kubectl wait --for=condition=available deployment --all \
        -n "$NAMESPACE" --timeout="$TIMEOUT" || true
    
    # Show status
    log_section "Deployment Status"
    kubectl get pods -n "$NAMESPACE"
    kubectl get svc -n "$NAMESPACE"
}

# Verify deployment
verify() {
    log_section "Verifying Deployment"
    
    local failed=0
    
    # Check all pods running
    local not_ready=$(kubectl get pods -n "$NAMESPACE" --no-headers | grep -v "Running\|Completed" | wc -l)
    if [ "$not_ready" -gt 0 ]; then
        log_warn "$not_ready pods not ready"
        kubectl get pods -n "$NAMESPACE" | grep -v "Running\|Completed"
        failed=1
    else
        log_info "All pods running ✓"
    fi
    
    # Check services have endpoints
    services=("query-service" "risk-service" "alert-service" "graph-service" "bff")
    for svc in "${services[@]}"; do
        local endpoints=$(kubectl get endpoints "staging-$svc" -n "$NAMESPACE" -o jsonpath='{.subsets[*].addresses[*].ip}' 2>/dev/null)
        if [ -z "$endpoints" ]; then
            log_warn "No endpoints for $svc"
            failed=1
        else
            log_info "$svc has endpoints ✓"
        fi
    done
    
    return $failed
}

# Health check
health_check() {
    log_section "Health Checks"
    
    # Port-forward BFF and check health
    kubectl port-forward svc/staging-bff 3001:3001 -n "$NAMESPACE" &
    PF_PID=$!
    sleep 3
    
    if curl -s http://localhost:3001/health | grep -q "ok\|healthy"; then
        log_info "BFF health check passed ✓"
    else
        log_warn "BFF health check failed"
    fi
    
    kill $PF_PID 2>/dev/null || true
}

# Rollback
rollback() {
    log_section "Rolling Back"
    
    deployments=$(kubectl get deployments -n "$NAMESPACE" -o name)
    for dep in $deployments; do
        log_info "Rolling back $dep..."
        kubectl rollout undo "$dep" -n "$NAMESPACE"
    done
    
    kubectl rollout status deployment --all -n "$NAMESPACE" --timeout="$TIMEOUT"
}

# Main
case "${1:-deploy}" in
    deploy)
        check_prerequisites
        deploy
        verify
        ;;
    build)
        build_images
        ;;
    verify)
        verify
        health_check
        ;;
    rollback)
        rollback
        ;;
    status)
        kubectl get all -n "$NAMESPACE"
        ;;
    *)
        echo "Usage: $0 {deploy|build|verify|rollback|status}"
        exit 1
        ;;
esac
