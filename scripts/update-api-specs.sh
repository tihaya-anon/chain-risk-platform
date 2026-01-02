#!/bin/bash

# ============================================
# API Specification Update Script
# ============================================
# This script automatically generates/updates OpenAPI specifications
# for all microservices and saves them to docs/api-specs/

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
API_SPECS_DIR="$PROJECT_ROOT/docs/api-specs"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

log_section() {
    echo -e "\n${BLUE}========================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}========================================${NC}"
}

# Ensure API specs directory exists
mkdir -p "$API_SPECS_DIR"

# ============================================
# 1. Query Service (Go + swaggo/swag)
# ============================================
update_query_service() {
    log_section "Updating Query Service API Spec"
    
    cd "$PROJECT_ROOT/services/query-service"
    
    # Check if swag is installed
    if ! command -v swag &> /dev/null; then
        log_warn "swag not found, installing..."
        go install github.com/swaggo/swag/cmd/swag@latest
    fi
    
    # Generate swagger docs
    log_info "Running swag init..."
    swag init -g cmd/query/main.go -o docs --parseDependency --parseInternal
    
    # Copy to api-specs directory
    if [ -f "docs/swagger.json" ]; then
        cp docs/swagger.json "$API_SPECS_DIR/query-service.openapi.json"
        log_info "✅ Query Service API spec updated: docs/api-specs/query-service.openapi.json"
    else
        log_error "❌ Failed to generate query-service API spec"
        return 1
    fi
}

# ============================================
# 2. BFF (NestJS + @nestjs/swagger)
# ============================================
update_bff() {
    log_section "Updating BFF API Spec"
    
    cd "$PROJECT_ROOT/services/bff"
    
    # Check if service is running
    if curl -s http://localhost:3001/health > /dev/null 2>&1; then
        log_info "BFF is running, fetching API spec..."
        
        # Fetch OpenAPI spec from running service
        if curl -s http://localhost:3001/docs-json > "$API_SPECS_DIR/bff.openapi.json"; then
            log_info "✅ BFF API spec updated: docs/api-specs/bff.openapi.json"
        else
            log_error "❌ Failed to fetch BFF API spec"
            return 1
        fi
    else
        log_warn "BFF is not running. Starting temporarily..."
        
        # Start BFF in background
        npm run start:dev > /dev/null 2>&1 &
        BFF_PID=$!
        
        # Wait for service to be ready
        log_info "Waiting for BFF to start..."
        for i in {1..30}; do
            if curl -s http://localhost:3001/health > /dev/null 2>&1; then
                log_info "BFF is ready"
                break
            fi
            sleep 1
        done
        
        # Fetch API spec
        if curl -s http://localhost:3001/docs-json > "$API_SPECS_DIR/bff.openapi.json"; then
            log_info "✅ BFF API spec updated: docs/api-specs/bff.openapi.json"
        else
            log_error "❌ Failed to fetch BFF API spec"
            kill $BFF_PID 2>/dev/null || true
            return 1
        fi
        
        # Stop BFF
        kill $BFF_PID 2>/dev/null || true
        log_info "Stopped temporary BFF instance"
    fi
}

# ============================================
# 3. Risk ML Service (FastAPI)
# ============================================
update_risk_ml_service() {
    log_section "Updating Risk ML Service API Spec"
    
    cd "$PROJECT_ROOT/services/risk-ml-service"
    
    # Check if service is running
    if curl -s http://localhost:8082/health > /dev/null 2>&1; then
        log_info "Risk ML Service is running, fetching API spec..."
        
        # Fetch OpenAPI spec from running service
        if curl -s http://localhost:8082/openapi.json > "$API_SPECS_DIR/risk-ml-service.openapi.json"; then
            log_info "✅ Risk ML Service API spec updated: docs/api-specs/risk-ml-service.openapi.json"
        else
            log_error "❌ Failed to fetch Risk ML Service API spec"
            return 1
        fi
    else
        log_warn "Risk ML Service is not running. Starting temporarily..."
        
        # Start Risk ML Service in background
        uv run uvicorn app.main:app --port 8082 > /dev/null 2>&1 &
        RISK_PID=$!
        
        # Wait for service to be ready
        log_info "Waiting for Risk ML Service to start..."
        for i in {1..30}; do
            if curl -s http://localhost:8082/health > /dev/null 2>&1; then
                log_info "Risk ML Service is ready"
                break
            fi
            sleep 1
        done
        
        # Fetch API spec
        if curl -s http://localhost:8082/openapi.json > "$API_SPECS_DIR/risk-ml-service.openapi.json"; then
            log_info "✅ Risk ML Service API spec updated: docs/api-specs/risk-ml-service.openapi.json"
        else
            log_error "❌ Failed to fetch Risk ML Service API spec"
            kill $RISK_PID 2>/dev/null || true
            return 1
        fi
        
        # Stop Risk ML Service
        kill $RISK_PID 2>/dev/null || true
        log_info "Stopped temporary Risk ML Service instance"
    fi
}

# ============================================
# 4. Orchestrator (Java + springdoc-openapi)
# ============================================
update_orchestrator() {
    log_section "Updating Orchestrator API Spec"
    
    cd "$PROJECT_ROOT/services/orchestrator"
    
    # Check if service is running
    if curl -s http://localhost:8080/actuator/health > /dev/null 2>&1; then
        log_info "Orchestrator is running, fetching API spec..."
        
        # Fetch OpenAPI spec from running service
        if curl -s http://localhost:8080/v3/api-docs > "$API_SPECS_DIR/orchestrator.openapi.json"; then
            log_info "✅ Orchestrator API spec updated: docs/api-specs/orchestrator.openapi.json"
        else
            log_error "❌ Failed to fetch Orchestrator API spec"
            return 1
        fi
    else
        log_warn "Orchestrator is not running. Please start it manually and run this script again."
        log_warn "Run: make orchestrator-run"
        return 1
    fi
}

# ============================================
# 5. Graph Engine (Java + springdoc-openapi)
# ============================================
update_graph_engine() {
    log_section "Updating Graph Engine API Spec"
    
    cd "$PROJECT_ROOT/processing/graph-engine"
    
    # Check if service is running
    if curl -s http://localhost:8084/actuator/health > /dev/null 2>&1; then
        log_info "Graph Engine is running, fetching API spec..."
        
        # Fetch OpenAPI spec from running service
        if curl -s http://localhost:8084/api-docs > "$API_SPECS_DIR/graph-engine.openapi.json"; then
            log_info "✅ Graph Engine API spec updated: docs/api-specs/graph-engine.openapi.json"
        else
            log_error "❌ Failed to fetch Graph Engine API spec"
            return 1
        fi
    else
        log_warn "Graph Engine is not running. Please start it manually and run this script again."
        log_warn "Run: make graph-run"
        return 1
    fi
}

# ============================================
# Main execution
# ============================================
main() {
    log_section "API Specification Update"
    log_info "Target directory: $API_SPECS_DIR"
    
    # Track results
    declare -a RESULTS
    
    # Update each service
    if update_query_service; then
        RESULTS+=("✅ Query Service")
    else
        RESULTS+=("❌ Query Service")
    fi
    
    if update_bff; then
        RESULTS+=("✅ BFF")
    else
        RESULTS+=("❌ BFF")
    fi
    
    if update_risk_ml_service; then
        RESULTS+=("✅ Risk ML Service")
    else
        RESULTS+=("❌ Risk ML Service")
    fi
    
    if update_orchestrator; then
        RESULTS+=("✅ Orchestrator")
    else
        RESULTS+=("❌ Orchestrator (not running)")
    fi
    
    if update_graph_engine; then
        RESULTS+=("✅ Graph Engine")
    else
        RESULTS+=("❌ Graph Engine (not running)")
    fi
    
    # Print summary
    log_section "Summary"
    for result in "${RESULTS[@]}"; do
        echo -e "$result"
    done
    
    echo ""
    log_info "API specifications saved to: $API_SPECS_DIR"
    log_info "Files:"
    ls -lh "$API_SPECS_DIR"/*.json 2>/dev/null || log_warn "No JSON files found"
}

# Parse command line arguments
SERVICES=()
while [[ $# -gt 0 ]]; do
    case $1 in
        --query)
            SERVICES+=("query")
            shift
            ;;
        --bff)
            SERVICES+=("bff")
            shift
            ;;
        --risk)
            SERVICES+=("risk")
            shift
            ;;
        --orchestrator)
            SERVICES+=("orchestrator")
            shift
            ;;
        --graph)
            SERVICES+=("graph")
            shift
            ;;
        --all)
            SERVICES=("query" "bff" "risk" "orchestrator" "graph")
            shift
            ;;
        --help|-h)
            echo "Usage: $0 [OPTIONS]"
            echo ""
            echo "Update OpenAPI specifications for microservices"
            echo ""
            echo "Options:"
            echo "  --all              Update all services (default)"
            echo "  --query            Update Query Service only"
            echo "  --bff              Update BFF only"
            echo "  --risk             Update Risk ML Service only"
            echo "  --orchestrator     Update Orchestrator only"
            echo "  --graph            Update Graph Engine only"
            echo "  --help, -h         Show this help message"
            echo ""
            echo "Examples:"
            echo "  $0                 # Update all services"
            echo "  $0 --query --bff   # Update Query Service and BFF only"
            exit 0
            ;;
        *)
            log_error "Unknown option: $1"
            echo "Run '$0 --help' for usage information"
            exit 1
            ;;
    esac
done

# If no services specified, update all
if [ ${#SERVICES[@]} -eq 0 ]; then
    SERVICES=("query" "bff" "risk" "orchestrator" "graph")
fi

# Run updates for selected services
log_section "API Specification Update"
log_info "Target directory: $API_SPECS_DIR"
log_info "Services to update: ${SERVICES[*]}"

declare -a RESULTS

for service in "${SERVICES[@]}"; do
    case $service in
        query)
            if update_query_service; then
                RESULTS+=("✅ Query Service")
            else
                RESULTS+=("❌ Query Service")
            fi
            ;;
        bff)
            if update_bff; then
                RESULTS+=("✅ BFF")
            else
                RESULTS+=("❌ BFF")
            fi
            ;;
        risk)
            if update_risk_ml_service; then
                RESULTS+=("✅ Risk ML Service")
            else
                RESULTS+=("❌ Risk ML Service")
            fi
            ;;
        orchestrator)
            if update_orchestrator; then
                RESULTS+=("✅ Orchestrator")
            else
                RESULTS+=("❌ Orchestrator (not running)")
            fi
            ;;
        graph)
            if update_graph_engine; then
                RESULTS+=("✅ Graph Engine")
            else
                RESULTS+=("❌ Graph Engine (not running)")
            fi
            ;;
    esac
done

# Print summary
log_section "Summary"
for result in "${RESULTS[@]}"; do
    echo -e "$result"
done

echo ""
log_info "API specifications saved to: $API_SPECS_DIR"
log_info "Files:"
ls -lh "$API_SPECS_DIR"/*.json 2>/dev/null || log_warn "No JSON files found"
