#!/bin/bash
# ============================================================
# E2E Test Runner
# ============================================================
# Usage:
#   ./tests/e2e/run_e2e.sh           # Run all E2E tests
#   ./tests/e2e/run_e2e.sh pipeline  # Run pipeline tests only
#   ./tests/e2e/run_e2e.sh services  # Run service tests only
#   ./tests/e2e/run_e2e.sh bff       # Run BFF tests only
#   ./tests/e2e/run_e2e.sh gnn       # Run GNN E2E tests only
# ============================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$(dirname "$SCRIPT_DIR")")"

# Source common utilities
source "$PROJECT_ROOT/scripts/common.sh"

cd "$SCRIPT_DIR"

log_section "E2E Test Suite"

# Check environment
if [ -z "$DOCKER_HOST_IP" ]; then
    log_warn "DOCKER_HOST_IP not set, using localhost"
    export DOCKER_HOST_IP="localhost"
fi

log_info "Docker Host: $DOCKER_HOST_IP"

# Download dependencies
log_info "Downloading Go dependencies..."
go mod tidy

# Build generator if not exists
GENERATOR_BIN="$PROJECT_ROOT/data-ingestion/bin/generator"
if [ ! -f "$GENERATOR_BIN" ]; then
    log_info "Building data generator..."
    cd "$PROJECT_ROOT"
    make generator-build
    cd "$SCRIPT_DIR"
fi
export GENERATOR_BIN

# Determine which tests to run
TEST_PATTERN=""
TEST_DIRS="./..."
case "${1:-all}" in
    pipeline)
        TEST_PATTERN="-run TestPipeline"
        TEST_DIRS="./"
        log_info "Running pipeline tests..."
        ;;
    services)
        TEST_PATTERN="-run TestServices"
        TEST_DIRS="./"
        log_info "Running service tests..."
        ;;
    bff)
        TEST_PATTERN="-run TestBFF"
        TEST_DIRS="./"
        log_info "Running BFF tests..."
        ;;
    gnn)
        TEST_DIRS="./gnn/..."
        log_info "Running GNN E2E tests..."
        ;;
    validation)
        TEST_PATTERN="-run TestValidation"
        TEST_DIRS="./gnn/..."
        log_info "Running validation tests..."
        ;;
    all)
        log_info "Running all E2E tests..."
        ;;
    *)
        log_error "Unknown test suite: $1"
        echo "Usage: $0 [pipeline|services|bff|gnn|validation|all]"
        exit 1
        ;;
esac

# Run tests
log_section "Running Tests"

set +e
go test -v -timeout 10m $TEST_PATTERN $TEST_DIRS
TEST_EXIT=$?
set -e

# Summary
echo ""
log_section "Test Summary"

if [ $TEST_EXIT -eq 0 ]; then
    echo -e "${GREEN}✓ All tests passed${NC}"
else
    echo -e "${RED}✗ Some tests failed${NC}"
fi

exit $TEST_EXIT
