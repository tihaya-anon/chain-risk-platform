#!/bin/bash
# Chain Risk Platform - Certificate Renewal Script
# Checks certificate expiration and renews if needed

set -euo pipefail

VAULT_ADDR="${VAULT_ADDR:-http://localhost:18200}"
VAULT_TOKEN="${VAULT_TOKEN:-}"
RENEWAL_THRESHOLD_DAYS="${RENEWAL_THRESHOLD_DAYS:-7}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CERT_BASE_DIR="${SCRIPT_DIR}/../../infra/certs"
GENERATE_SCRIPT="${SCRIPT_DIR}/generate-service-cert.sh"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

SERVICES=(
    "orchestrator"
    "bff"
    "query-service"
    "risk-ml-service"
    "alert-service"
    "graph-service"
)

check_expiry() {
    local service=$1
    local cert_file="${CERT_BASE_DIR}/${service}/cert.pem"
    
    if [ ! -f "$cert_file" ]; then
        echo "missing"
        return
    fi
    
    local expiry_date
    expiry_date=$(openssl x509 -in "$cert_file" -noout -enddate 2>/dev/null | cut -d= -f2)
    
    if [ -z "$expiry_date" ]; then
        echo "invalid"
        return
    fi
    
    local expiry_epoch
    local now_epoch
    local days_left
    
    expiry_epoch=$(date -j -f "%b %d %H:%M:%S %Y %Z" "$expiry_date" "+%s" 2>/dev/null || date -d "$expiry_date" "+%s" 2>/dev/null)
    now_epoch=$(date "+%s")
    days_left=$(( (expiry_epoch - now_epoch) / 86400 ))
    
    echo "$days_left"
}

renew_cert() {
    local service=$1
    log_info "Renewing certificate for $service..."
    
    if [ -x "$GENERATE_SCRIPT" ]; then
        "$GENERATE_SCRIPT" "$service"
    else
        log_error "Generate script not found or not executable: $GENERATE_SCRIPT"
        return 1
    fi
}

main() {
    log_info "=== Certificate Renewal Check ==="
    log_info "Threshold: $RENEWAL_THRESHOLD_DAYS days"
    
    local renewed=0
    local skipped=0
    local errors=0
    
    for service in "${SERVICES[@]}"; do
        local days_left
        days_left=$(check_expiry "$service")
        
        case "$days_left" in
            "missing")
                log_warn "[$service] Certificate missing - generating..."
                if renew_cert "$service"; then
                    ((renewed++))
                else
                    ((errors++))
                fi
                ;;
            "invalid")
                log_warn "[$service] Certificate invalid - regenerating..."
                if renew_cert "$service"; then
                    ((renewed++))
                else
                    ((errors++))
                fi
                ;;
            *)
                if [ "$days_left" -lt "$RENEWAL_THRESHOLD_DAYS" ]; then
                    log_warn "[$service] Certificate expires in $days_left days - renewing..."
                    if renew_cert "$service"; then
                        ((renewed++))
                    else
                        ((errors++))
                    fi
                else
                    log_info "[$service] Certificate valid for $days_left days"
                    ((skipped++))
                fi
                ;;
        esac
    done
    
    log_info "=== Summary ==="
    log_info "Renewed: $renewed"
    log_info "Skipped: $skipped"
    log_info "Errors: $errors"
    
    [ "$errors" -eq 0 ]
}

main "$@"
