#!/bin/bash
# Integration Test - Full Pipeline (all phases)

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

cd "$PROJECT_ROOT"
source "$PROJECT_ROOT/scripts/common.sh"
load_env "$PROJECT_ROOT" || exit 1

log_info "=== Full Integration Test ==="
log_info ""

# Phase 1
log_info ">>> Phase 1: Data Ingestion"
"$SCRIPT_DIR/test-integration-phase1.sh" || { log_error "Phase 1 failed"; exit 1; }

log_info ""
log_info ">>> Phase 2: Flink Processing"
"$SCRIPT_DIR/test-integration-phase2.sh" || { log_error "Phase 2 failed"; exit 1; }

log_info ""
log_info ">>> Phase 3: Batch Processing"
"$SCRIPT_DIR/test-integration-phase3.sh" || { log_error "Phase 3 failed"; exit 1; }

log_info ""
log_info "=========================================="
log_info "✅ Full Integration Test Complete"
log_info "=========================================="
