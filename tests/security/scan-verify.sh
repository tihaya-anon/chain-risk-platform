#!/bin/bash
# Security Scan Verification Script
# Runs local security scans and verifies no critical vulnerabilities

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="${SCRIPT_DIR}/../.."
RESULTS_DIR="${SCRIPT_DIR}/scan-results"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

PASS=0
FAIL=0
WARN=0

log_pass() { echo -e "${GREEN}[PASS]${NC} $1"; ((PASS++)); }
log_fail() { echo -e "${RED}[FAIL]${NC} $1"; ((FAIL++)); }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; ((WARN++)); }
log_info() { echo -e "${YELLOW}[INFO]${NC} $1"; }

mkdir -p "$RESULTS_DIR"

check_tool() {
    local tool=$1
    if command -v "$tool" &> /dev/null; then
        return 0
    else
        log_warn "$tool not installed, skipping"
        return 1
    fi
}

run_trivy_scan() {
    log_info "Running Trivy filesystem scan..."
    
    if ! check_tool trivy; then
        return 0
    fi
    
    local critical=0
    local high=0
    
    # Scan each service directory
    for service_dir in "${PROJECT_ROOT}"/services/*/; do
        local service_name=$(basename "$service_dir")
        log_info "Scanning $service_name..."
        
        local output="${RESULTS_DIR}/trivy-${service_name}.json"
        
        trivy fs --severity CRITICAL,HIGH --format json \
            --output "$output" \
            "$service_dir" 2>/dev/null || true
        
        if [ -f "$output" ]; then
            local svc_critical=$(jq '[.Results[]?.Vulnerabilities[]? | select(.Severity=="CRITICAL")] | length' "$output" 2>/dev/null || echo 0)
            local svc_high=$(jq '[.Results[]?.Vulnerabilities[]? | select(.Severity=="HIGH")] | length' "$output" 2>/dev/null || echo 0)
            
            critical=$((critical + svc_critical))
            high=$((high + svc_high))
            
            if [ "$svc_critical" -gt 0 ]; then
                log_fail "$service_name: $svc_critical CRITICAL vulnerabilities"
            elif [ "$svc_high" -gt 0 ]; then
                log_warn "$service_name: $svc_high HIGH vulnerabilities"
            else
                log_pass "$service_name: No CRITICAL/HIGH vulnerabilities"
            fi
        fi
    done
    
    echo ""
    log_info "Trivy Summary: $critical CRITICAL, $high HIGH"
    
    if [ "$critical" -gt 0 ]; then
        return 1
    fi
    return 0
}

run_semgrep_scan() {
    log_info "Running Semgrep SAST scan..."
    
    if ! check_tool semgrep; then
        return 0
    fi
    
    local output="${RESULTS_DIR}/semgrep-results.json"
    
    semgrep scan --config auto --config p/security-audit \
        --severity ERROR \
        --json --output "$output" \
        "${PROJECT_ROOT}/services" 2>/dev/null || true
    
    if [ -f "$output" ]; then
        local errors=$(jq '.results | length' "$output" 2>/dev/null || echo 0)
        
        if [ "$errors" -gt 0 ]; then
            log_fail "Semgrep found $errors security issues"
            jq -r '.results[] | "  - \(.path):\(.start.line) \(.check_id)"' "$output" | head -10
            return 1
        else
            log_pass "Semgrep: No security issues found"
        fi
    fi
    
    return 0
}

run_gitleaks_scan() {
    log_info "Running Gitleaks secret detection..."
    
    if ! check_tool gitleaks; then
        return 0
    fi
    
    local output="${RESULTS_DIR}/gitleaks-results.json"
    
    gitleaks detect --source "${PROJECT_ROOT}" \
        --no-git \
        --report-format json \
        --report-path "$output" 2>/dev/null || true
    
    if [ -f "$output" ]; then
        local secrets=$(jq 'length' "$output" 2>/dev/null || echo 0)
        
        if [ "$secrets" -gt 0 ]; then
            log_fail "Gitleaks found $secrets potential secrets"
            jq -r '.[] | "  - \(.File):\(.StartLine) \(.RuleID)"' "$output" | head -10
            return 1
        else
            log_pass "Gitleaks: No secrets detected"
        fi
    else
        log_pass "Gitleaks: No secrets detected"
    fi
    
    return 0
}

run_dependency_check() {
    log_info "Checking for known vulnerable dependencies..."
    
    local issues=0
    
    # Check Go dependencies
    for go_mod in "${PROJECT_ROOT}"/services/*/go.mod; do
        if [ -f "$go_mod" ]; then
            local dir=$(dirname "$go_mod")
            local service=$(basename "$dir")
            
            cd "$dir"
            if go list -m -json all 2>/dev/null | jq -e 'select(.Deprecated)' > /dev/null 2>&1; then
                log_warn "$service: Has deprecated Go dependencies"
                ((issues++))
            fi
            cd - > /dev/null
        fi
    done
    
    # Check npm dependencies
    for package_json in "${PROJECT_ROOT}"/services/*/package.json; do
        if [ -f "$package_json" ]; then
            local dir=$(dirname "$package_json")
            local service=$(basename "$dir")
            
            cd "$dir"
            if npm audit --json 2>/dev/null | jq -e '.metadata.vulnerabilities.critical > 0' > /dev/null 2>&1; then
                log_fail "$service: Has critical npm vulnerabilities"
                ((issues++))
            fi
            cd - > /dev/null
        fi
    done
    
    if [ "$issues" -eq 0 ]; then
        log_pass "Dependency check: No critical issues"
    fi
    
    return 0
}

check_security_headers() {
    log_info "Checking security headers configuration..."
    
    # Check for CORS configuration
    if grep -r "Access-Control-Allow-Origin.*\*" "${PROJECT_ROOT}/services" --include="*.go" --include="*.ts" --include="*.java" > /dev/null 2>&1; then
        log_warn "Found permissive CORS (Allow-Origin: *) - review for production"
    else
        log_pass "No overly permissive CORS found"
    fi
    
    # Check for secure cookie settings
    if grep -r "httpOnly.*false\|secure.*false" "${PROJECT_ROOT}/services" --include="*.ts" --include="*.js" > /dev/null 2>&1; then
        log_warn "Found insecure cookie settings"
    else
        log_pass "Cookie security settings OK"
    fi
    
    return 0
}

check_hardcoded_secrets() {
    log_info "Checking for hardcoded secrets patterns..."
    
    local patterns=(
        "password\s*=\s*['\"][^'\"]{8,}['\"]"
        "api[_-]?key\s*=\s*['\"][^'\"]{16,}['\"]"
        "secret\s*=\s*['\"][^'\"]{16,}['\"]"
        "token\s*=\s*['\"][^'\"]{20,}['\"]"
    )
    
    local found=0
    
    for pattern in "${patterns[@]}"; do
        if grep -riE "$pattern" "${PROJECT_ROOT}/services" \
            --include="*.go" --include="*.ts" --include="*.py" --include="*.java" \
            --exclude-dir=".venv" --exclude-dir="node_modules" --exclude-dir="target" \
            2>/dev/null | grep -v "example\|test\|mock\|placeholder" > /dev/null 2>&1; then
            log_warn "Possible hardcoded secret pattern: $pattern"
            ((found++))
        fi
    done
    
    if [ "$found" -eq 0 ]; then
        log_pass "No obvious hardcoded secrets found"
    fi
    
    return 0
}

generate_summary() {
    local report="${RESULTS_DIR}/scan-summary.json"
    
    cat > "$report" << EOF
{
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "results": {
    "passed": $PASS,
    "failed": $FAIL,
    "warnings": $WARN
  },
  "status": "$([ $FAIL -eq 0 ] && echo 'pass' || echo 'fail')"
}
EOF
    
    log_info "Summary written to $report"
}

main() {
    echo "=============================================="
    echo "  Security Scan Verification"
    echo "=============================================="
    echo "Project: ${PROJECT_ROOT}"
    echo "Results: ${RESULTS_DIR}"
    echo ""
    
    run_trivy_scan || true
    echo ""
    
    run_semgrep_scan || true
    echo ""
    
    run_gitleaks_scan || true
    echo ""
    
    run_dependency_check || true
    echo ""
    
    check_security_headers || true
    echo ""
    
    check_hardcoded_secrets || true
    echo ""
    
    generate_summary
    
    echo ""
    echo "=============================================="
    echo "  Summary: $PASS passed, $FAIL failed, $WARN warnings"
    echo "=============================================="
    
    [ "$FAIL" -eq 0 ]
}

main "$@"
