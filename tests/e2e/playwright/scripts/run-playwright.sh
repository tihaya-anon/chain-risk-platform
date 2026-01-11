#!/bin/bash
# Playwright E2E Test Runner

set -e

SCRIPT_DIR=$(dirname "$0")
PROJECT_ROOT="${SCRIPT_DIR}/../../../.."
PLAYWRIGHT_DIR="${SCRIPT_DIR}/.."

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

# Load environment
cd "$PROJECT_ROOT"
set -a
source .env.local 2>/dev/null || true
source ./scripts/load-env.sh 2>/dev/null || true
set +a

# Default values
FRONTEND_URL="${FRONTEND_URL:-http://localhost:5173}"
BFF_URL="${BFF_URL:-http://localhost:3001}"
HEADLESS="${HEADLESS:-true}"
SPEC="${1:-}"

print_usage() {
    echo "Usage: $0 [spec] [options]"
    echo ""
    echo "Specs:"
    echo "  all        Run all tests (default)"
    echo "  login      Run login tests"
    echo "  dashboard  Run dashboard tests"
    echo "  search     Run search tests"
    echo "  alerts     Run alerts tests"
    echo "  websocket  Run WebSocket tests"
    echo ""
    echo "Options:"
    echo "  --headed   Run with browser visible"
    echo "  --debug    Run in debug mode"
    echo ""
    echo "Environment:"
    echo "  FRONTEND_URL  Frontend URL (default: $FRONTEND_URL)"
    echo "  BFF_URL       BFF URL (default: $BFF_URL)"
    echo ""
}

check_frontend() {
    echo -e "${YELLOW}Checking frontend availability...${NC}"
    if curl -s --max-time 5 "$FRONTEND_URL" >/dev/null; then
        echo -e "${GREEN}✓ Frontend is running at $FRONTEND_URL${NC}"
        return 0
    else
        echo -e "${RED}✗ Frontend not available at $FRONTEND_URL${NC}"
        return 1
    fi
}

check_bff() {
    echo -e "${YELLOW}Checking BFF availability...${NC}"
    if curl -s --max-time 5 "$BFF_URL/health" >/dev/null 2>&1 || curl -s --max-time 5 "$BFF_URL" >/dev/null; then
        echo -e "${GREEN}✓ BFF is running at $BFF_URL${NC}"
        return 0
    else
        echo -e "${YELLOW}! BFF may not be running at $BFF_URL (tests will use mocks)${NC}"
        return 0
    fi
}

run_tests() {
    local spec_file=""
    local extra_args=""

    case "$SPEC" in
    login)
        spec_file="specs/login.spec.ts"
        ;;
    dashboard)
        spec_file="specs/dashboard.spec.ts"
        ;;
    search)
        spec_file="specs/search.spec.ts"
        ;;
    alerts)
        spec_file="specs/alerts.spec.ts"
        ;;
    websocket)
        spec_file="specs/websocket.spec.ts"
        ;;
    all | "")
        spec_file=""
        ;;
    --help | -h)
        print_usage
        exit 0
        ;;
    *)
        echo -e "${RED}Unknown spec: $SPEC${NC}"
        print_usage
        exit 1
        ;;
    esac

    # Check for options
    for arg in "$@"; do
        case "$arg" in
        --headed)
            extra_args="$extra_args --headed"
            ;;
        --debug)
            extra_args="$extra_args --debug"
            ;;
        esac
    done

    cd "$PLAYWRIGHT_DIR"

    echo -e "${CYAN}Running Playwright tests...${NC}"
    echo "  Spec: ${spec_file:-all}"
    echo "  Frontend: $FRONTEND_URL"
    echo "  BFF: $BFF_URL"
    echo ""

    export FRONTEND_URL
    export BFF_URL

    if [ -n "$spec_file" ]; then
        npx playwright test "$spec_file" $extra_args
    else
        npx playwright test $extra_args
    fi
}

# Main
echo -e "${CYAN}╔════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║     Playwright E2E Test Runner         ║${NC}"
echo -e "${CYAN}╚════════════════════════════════════════╝${NC}"
echo ""

check_frontend || {
    echo -e "${YELLOW}Starting frontend in background...${NC}"
    cd "$PROJECT_ROOT/frontend"
    npm run dev &
    FRONTEND_PID=$!
    sleep 5
    trap "kill $FRONTEND_PID 2>/dev/null" EXIT
}

check_bff

run_tests "$@"

echo ""
echo -e "${GREEN}✓ E2E tests completed${NC}"
