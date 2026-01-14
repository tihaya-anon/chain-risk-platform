#!/bin/bash

# ============================================
# API Specification Update Script
# ============================================
# Generates/updates OpenAPI specifications for all services

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
API_SPECS_DIR="$PROJECT_ROOT/docs/api-specs/openapi"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }
log_section() { echo -e "\n${BLUE}=== $1 ===${NC}"; }

mkdir -p "$API_SPECS_DIR"

# Query Service (Go + swaggo/swag)
update_query_service() {
    log_section "Query Service"
    cd "$PROJECT_ROOT/services/query-service"
    
    if ! command -v swag &> /dev/null; then
        log_warn "swag not found, installing..."
        go install github.com/swaggo/swag/cmd/swag@latest
        export PATH="$PATH:$(go env GOPATH)/bin"
    fi
    
    swag init -g cmd/query/main.go -o docs --parseDependency --parseInternal
    
    if [ -f "docs/swagger.json" ]; then
        cp docs/swagger.json "$API_SPECS_DIR/query-service.openapi.json"
        log_info "✅ Query Service updated"
    else
        log_error "❌ Failed"
        return 1
    fi
}

# BFF (NestJS + @nestjs/swagger)
update_bff() {
    log_section "BFF"
    cd "$PROJECT_ROOT/services/bff"
    
    if curl -s http://localhost:3001/health > /dev/null 2>&1; then
        curl -s http://localhost:3001/docs-json > "$API_SPECS_DIR/bff.openapi.json"
        log_info "✅ BFF updated"
    else
        log_warn "BFF not running. Run: make bff-run"
        return 1
    fi
}

# Risk ML Service (FastAPI)
update_risk_ml_service() {
    log_section "Risk ML Service"
    cd "$PROJECT_ROOT/services/risk-ml-service"
    
    if curl -s http://localhost:8082/health > /dev/null 2>&1; then
        curl -s http://localhost:8082/openapi.json > "$API_SPECS_DIR/risk-ml-service.openapi.json"
        log_info "✅ Risk ML Service updated"
    else
        log_warn "Risk ML Service not running. Run: make risk-run"
        return 1
    fi
}

# Alert Service (Go + swaggo/swag)
update_alert_service() {
    log_section "Alert Service"
    cd "$PROJECT_ROOT/services/alert-service"
    
    if ! command -v swag &> /dev/null; then
        go install github.com/swaggo/swag/cmd/swag@latest
        export PATH="$PATH:$(go env GOPATH)/bin"
    fi
    
    swag init -g cmd/main.go -o docs --parseDependency --parseInternal 2>/dev/null || true
    
    if [ -f "docs/swagger.json" ]; then
        cp docs/swagger.json "$API_SPECS_DIR/alert-service.openapi.json"
        log_info "✅ Alert Service updated"
    else
        log_warn "Alert Service spec generation failed or no annotations"
        return 1
    fi
}

# Graph Service (Java + springdoc-openapi)
update_graph_service() {
    log_section "Graph Service"
    cd "$PROJECT_ROOT/services/graph-service"
    
    if curl -s http://localhost:8084/actuator/health > /dev/null 2>&1; then
        curl -s http://localhost:8084/api-docs > "$API_SPECS_DIR/graph-service.openapi.json"
        log_info "✅ Graph Service updated"
    else
        log_warn "Graph Service not running. Run: make graph-run"
        return 1
    fi
}

# Parse arguments
SERVICES=()
while [[ $# -gt 0 ]]; do
    case $1 in
        --query) SERVICES+=("query"); shift ;;
        --bff) SERVICES+=("bff"); shift ;;
        --risk) SERVICES+=("risk"); shift ;;
        --alert) SERVICES+=("alert"); shift ;;
        --graph) SERVICES+=("graph"); shift ;;
        --all) SERVICES=("query" "bff" "risk" "alert" "graph"); shift ;;
        --help|-h)
            echo "Usage: $0 [--all|--query|--bff|--risk|--alert|--graph]"
            exit 0 ;;
        *) log_error "Unknown: $1"; exit 1 ;;
    esac
done

[ ${#SERVICES[@]} -eq 0 ] && SERVICES=("query" "bff" "risk" "alert" "graph")

log_section "API Spec Update"
log_info "Services: ${SERVICES[*]}"

declare -a RESULTS
for svc in "${SERVICES[@]}"; do
    case $svc in
        query) update_query_service && RESULTS+=("✅ Query") || RESULTS+=("❌ Query") ;;
        bff) update_bff && RESULTS+=("✅ BFF") || RESULTS+=("❌ BFF") ;;
        risk) update_risk_ml_service && RESULTS+=("✅ Risk ML") || RESULTS+=("❌ Risk ML") ;;
        alert) update_alert_service && RESULTS+=("✅ Alert") || RESULTS+=("❌ Alert") ;;
        graph) update_graph_service && RESULTS+=("✅ Graph") || RESULTS+=("❌ Graph") ;;
    esac
done

log_section "Summary"
for r in "${RESULTS[@]}"; do echo -e "$r"; done
echo ""
ls -lh "$API_SPECS_DIR"/*.json 2>/dev/null || log_warn "No files"
