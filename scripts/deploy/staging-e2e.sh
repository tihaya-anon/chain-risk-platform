#!/bin/bash
# ============================================================
# Staging E2E Test Runner
# ============================================================
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$(dirname "$SCRIPT_DIR")")"

source "$PROJECT_ROOT/scripts/common.sh"

NAMESPACE="chain-risk-staging"

log_section "Staging E2E Tests"

# Setup port forwards
setup_port_forwards() {
    log_info "Setting up port forwards..."
    
    # Kill existing forwards
    pkill -f "kubectl port-forward.*chain-risk-staging" 2>/dev/null || true
    sleep 1
    
    # Forward services
    kubectl port-forward svc/staging-bff 3001:3001 -n "$NAMESPACE" &
    kubectl port-forward svc/staging-query-service 8081:8081 -n "$NAMESPACE" &
    kubectl port-forward svc/staging-risk-service 8082:8082 -n "$NAMESPACE" &
    kubectl port-forward svc/staging-graph-service 8084:8084 -n "$NAMESPACE" &
    
    sleep 3
    log_info "Port forwards ready"
}

# Cleanup port forwards
cleanup() {
    log_info "Cleaning up port forwards..."
    pkill -f "kubectl port-forward.*chain-risk-staging" 2>/dev/null || true
}
trap cleanup EXIT

# Run E2E tests
run_tests() {
    log_section "Running E2E Tests"
    
    cd "$PROJECT_ROOT/tests/e2e"
    
    # Set staging URLs
    export BFF_URL="http://localhost:3001"
    export QUERY_SERVICE_URL="http://localhost:8081"
    export RISK_SERVICE_URL="http://localhost:8082"
    export GRAPH_SERVICE_URL="http://localhost:8084"
    export E2E_ENV="staging"
    
    # Run tests
    go test -v -timeout 10m ./... 2>&1 | tee "$PROJECT_ROOT/.logs/staging-e2e.log"
    
    return ${PIPESTATUS[0]}
}

# Quick smoke test
smoke_test() {
    log_section "Smoke Tests"
    
    local failed=0
    
    # BFF health
    if curl -sf http://localhost:3001/health > /dev/null; then
        log_info "BFF health ✓"
    else
        log_error "BFF health ✗"
        failed=1
    fi
    
    # Query service
    if curl -sf http://localhost:8081/health > /dev/null; then
        log_info "Query service health ✓"
    else
        log_error "Query service health ✗"
        failed=1
    fi
    
    # Risk service
    if curl -sf http://localhost:8082/health > /dev/null; then
        log_info "Risk service health ✓"
    else
        log_error "Risk service health ✗"
        failed=1
    fi
    
    # Graph service
    if curl -sf http://localhost:8084/actuator/health > /dev/null; then
        log_info "Graph service health ✓"
    else
        log_error "Graph service health ✗"
        failed=1
    fi
    
    return $failed
}

# Main
case "${1:-all}" in
    all)
        setup_port_forwards
        smoke_test
        run_tests
        ;;
    smoke)
        setup_port_forwards
        smoke_test
        ;;
    e2e)
        setup_port_forwards
        run_tests
        ;;
    *)
        echo "Usage: $0 {all|smoke|e2e}"
        exit 1
        ;;
esac
