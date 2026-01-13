#!/bin/bash
# TLS/mTLS Verification Test Suite
# Validates TLS configuration across all services
#
# Architecture: External Client → Orchestrator (edge) → BFF → Backend Services
# - orchestrator: Edge gateway, TLS only (no mTLS)
# - All other services: Internal, mTLS required

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CERT_DIR="${SCRIPT_DIR}/../../infra/certs"
CLIENT_CERT="${CERT_DIR}/client/cert.pem"
CLIENT_KEY="${CERT_DIR}/client/key.pem"
CA_CERT="${CERT_DIR}/ca-chain.pem"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

PASS=0
FAIL=0

log_pass() { echo -e "${GREEN}[PASS]${NC} $1"; ((PASS++)); }
log_fail() { echo -e "${RED}[FAIL]${NC} $1"; ((FAIL++)); }
log_info() { echo -e "${YELLOW}[INFO]${NC} $1"; }

# Service configuration: name:port:mtls_required
# orchestrator is edge gateway - no mTLS required
# all other services are internal - mTLS required
SERVICES=(
    "orchestrator:8443:false"
    "bff:3443:true"
    "query-service:8444:true"
    "alert-service:8446:true"
    "risk-ml-service:8445:true"
    "graph-service:8447:true"
)

check_tls_handshake() {
    local name=$1
    local port=$2
    local host="${3:-localhost}"
    
    log_info "Testing TLS handshake: $name ($host:$port)"
    
    if echo | openssl s_client -connect "$host:$port" -servername "$name.chainrisk.local" 2>/dev/null | grep -q "Verify return code: 0"; then
        log_pass "$name TLS handshake successful"
        return 0
    else
        log_fail "$name TLS handshake failed"
        return 1
    fi
}

check_mtls_required() {
    local name=$1
    local port=$2
    local host="${3:-localhost}"
    
    log_info "Testing mTLS enforcement: $name"
    
    # Test without client cert - should fail
    local response
    response=$(curl -s -o /dev/null -w "%{http_code}" --insecure "https://$host:$port/health" 2>/dev/null || echo "000")
    
    if [[ "$response" == "000" || "$response" == "403" || "$response" == "400" ]]; then
        log_pass "$name rejects requests without client cert (HTTP $response)"
    else
        log_fail "$name accepts requests without client cert (HTTP $response)"
        return 1
    fi
    
    # Test with client cert - should succeed
    if [ -f "$CLIENT_CERT" ] && [ -f "$CLIENT_KEY" ] && [ -f "$CA_CERT" ]; then
        response=$(curl -s -o /dev/null -w "%{http_code}" \
            --cert "$CLIENT_CERT" \
            --key "$CLIENT_KEY" \
            --cacert "$CA_CERT" \
            "https://$host:$port/health" 2>/dev/null || echo "000")
        
        if [[ "$response" == "200" ]]; then
            log_pass "$name accepts requests with valid client cert"
        else
            log_fail "$name rejects requests with valid client cert (HTTP $response)"
            return 1
        fi
    else
        log_info "Skipping client cert test - certificates not found"
    fi
    
    return 0
}

check_tls_only() {
    local name=$1
    local port=$2
    local host="${3:-localhost}"
    
    log_info "Testing TLS-only (no mTLS): $name"
    
    # Edge gateway should accept requests without client cert
    local response
    response=$(curl -s -o /dev/null -w "%{http_code}" --insecure "https://$host:$port/health" 2>/dev/null || echo "000")
    
    if [[ "$response" == "200" ]]; then
        log_pass "$name accepts HTTPS requests without client cert"
    else
        log_fail "$name rejects HTTPS requests (HTTP $response)"
        return 1
    fi
    
    return 0
}

check_cipher_suites() {
    local name=$1
    local port=$2
    local host="${3:-localhost}"
    
    log_info "Testing cipher suites: $name"
    
    # Check for strong cipher
    local cipher
    cipher=$(echo | openssl s_client -connect "$host:$port" -cipher 'ECDHE+AESGCM' 2>/dev/null | grep "Cipher is" | awk '{print $NF}')
    
    if [[ -n "$cipher" && "$cipher" != "0000" && "$cipher" != "(NONE)" ]]; then
        log_pass "$name uses strong cipher: $cipher"
    else
        log_fail "$name does not support strong ciphers"
        return 1
    fi
    
    return 0
}

check_tls_version() {
    local name=$1
    local port=$2
    local host="${3:-localhost}"
    
    log_info "Testing TLS version: $name"
    
    # Check TLS 1.2 is supported
    if echo | openssl s_client -connect "$host:$port" -tls1_2 2>/dev/null | grep -q "Protocol  : TLSv1.2"; then
        log_pass "$name supports TLS 1.2"
    else
        log_fail "$name does not support TLS 1.2"
        return 1
    fi
    
    # Check TLS 1.0/1.1 is rejected (optional - may not be configured)
    if echo | openssl s_client -connect "$host:$port" -tls1 2>&1 | grep -q "alert protocol version\|no protocols available"; then
        log_pass "$name rejects TLS 1.0"
    else
        log_info "$name may accept TLS 1.0 (check configuration)"
    fi
    
    return 0
}

check_cert_expiry() {
    local name=$1
    local port=$2
    local host="${3:-localhost}"
    local warn_days=14
    
    log_info "Checking certificate expiry: $name"
    
    local expiry
    expiry=$(echo | openssl s_client -connect "$host:$port" -servername "$name.chainrisk.local" 2>/dev/null | openssl x509 -noout -enddate 2>/dev/null | cut -d= -f2)
    
    if [ -z "$expiry" ]; then
        log_fail "$name certificate expiry check failed"
        return 1
    fi
    
    local expiry_epoch now_epoch days_left
    expiry_epoch=$(date -j -f "%b %d %H:%M:%S %Y %Z" "$expiry" "+%s" 2>/dev/null || date -d "$expiry" "+%s" 2>/dev/null)
    now_epoch=$(date "+%s")
    days_left=$(( (expiry_epoch - now_epoch) / 86400 ))
    
    if [ "$days_left" -lt 0 ]; then
        log_fail "$name certificate EXPIRED"
        return 1
    elif [ "$days_left" -lt "$warn_days" ]; then
        log_info "$name certificate expires in $days_left days (WARNING)"
    else
        log_pass "$name certificate valid for $days_left days"
    fi
    
    return 0
}

main() {
    echo "=============================================="
    echo "  TLS/mTLS Verification Test Suite"
    echo "=============================================="
    echo ""
    echo "Architecture:"
    echo "  External → Orchestrator (edge/TLS) → Internal (mTLS)"
    echo ""
    
    local host="${1:-localhost}"
    
    for svc in "${SERVICES[@]}"; do
        IFS=':' read -r name port mtls <<< "$svc"
        
        echo ""
        echo "--- $name ---"
        
        check_tls_handshake "$name" "$port" "$host" || true
        check_tls_version "$name" "$port" "$host" || true
        check_cipher_suites "$name" "$port" "$host" || true
        check_cert_expiry "$name" "$port" "$host" || true
        
        if [ "$mtls" == "true" ]; then
            check_mtls_required "$name" "$port" "$host" || true
        else
            check_tls_only "$name" "$port" "$host" || true
        fi
    done
    
    echo ""
    echo "=============================================="
    echo "  Summary: $PASS passed, $FAIL failed"
    echo "=============================================="
    
    [ "$FAIL" -eq 0 ]
}

main "$@"
