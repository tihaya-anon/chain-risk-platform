#!/bin/bash
# Chain Risk Platform - Service Certificate Generator
# Generates TLS certificates for individual services using Vault PKI

set -euo pipefail

VAULT_ADDR="${VAULT_ADDR:-http://localhost:18200}"
VAULT_TOKEN="${VAULT_TOKEN:-}"
CERT_TTL="${CERT_TTL:-720h}"
DOMAIN="${DOMAIN:-chainrisk.local}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CERT_BASE_DIR="${SCRIPT_DIR}/../../infra/certs"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

usage() {
    cat << EOF
Usage: $(basename "$0") <service-name> [options]

Services: orchestrator, bff, query-service, risk-ml-service, alert-service, graph-service

Options:
  -t, --ttl <duration>    Certificate TTL (default: 720h)
  -o, --output <dir>      Output directory (default: infra/certs/<service>)
  -a, --all               Generate certificates for all services
  -h, --help              Show this help

Examples:
  $(basename "$0") query-service
  $(basename "$0") --all
  $(basename "$0") orchestrator --ttl 168h
EOF
}

SERVICES=(
    "orchestrator"
    "bff"
    "query-service"
    "risk-ml-service"
    "alert-service"
    "graph-service"
)

check_vault() {
    if [ -z "$VAULT_TOKEN" ]; then
        log_error "VAULT_TOKEN not set"
        exit 1
    fi
    
    export VAULT_ADDR VAULT_TOKEN
    
    if ! vault status &> /dev/null; then
        log_error "Cannot connect to Vault at $VAULT_ADDR"
        exit 1
    fi
}

generate_cert() {
    local service=$1
    local output_dir="${2:-${CERT_BASE_DIR}/${service}}"
    local ttl="${3:-$CERT_TTL}"
    
    log_info "Generating certificate for: $service"
    
    mkdir -p "$output_dir"
    
    local cn="${service}.${DOMAIN}"
    local alt_names="${service},localhost"
    local ip_sans="127.0.0.1"
    local uri_sans="spiffe://${DOMAIN}/${service}"
    
    # Issue certificate from Vault
    vault write -format=json "pki_int/issue/service-role" \
        common_name="$cn" \
        alt_names="$alt_names" \
        ip_sans="$ip_sans" \
        uri_sans="$uri_sans" \
        ttl="$ttl" > /tmp/cert_data_${service}.json
    
    # Extract certificate components
    jq -r '.data.certificate' /tmp/cert_data_${service}.json > "${output_dir}/cert.pem"
    jq -r '.data.private_key' /tmp/cert_data_${service}.json > "${output_dir}/key.pem"
    jq -r '.data.ca_chain[0]' /tmp/cert_data_${service}.json > "${output_dir}/ca.pem"
    jq -r '.data.ca_chain | join("\n")' /tmp/cert_data_${service}.json > "${output_dir}/ca-chain.pem"
    
    # Create full chain (cert + intermediate + root)
    cat "${output_dir}/cert.pem" "${output_dir}/ca-chain.pem" > "${output_dir}/fullchain.pem"
    
    # Set permissions
    chmod 644 "${output_dir}/cert.pem" "${output_dir}/ca.pem" "${output_dir}/ca-chain.pem" "${output_dir}/fullchain.pem"
    chmod 600 "${output_dir}/key.pem"
    
    # Generate PKCS12 for Java services
    if [[ "$service" == "orchestrator" || "$service" == "graph-service" ]]; then
        log_info "Generating PKCS12 keystore for $service"
        openssl pkcs12 -export \
            -in "${output_dir}/cert.pem" \
            -inkey "${output_dir}/key.pem" \
            -certfile "${output_dir}/ca-chain.pem" \
            -out "${output_dir}/keystore.p12" \
            -name "$service" \
            -passout pass:changeit
        
        # Create truststore with CA chain
        keytool -importcert \
            -file "${output_dir}/ca.pem" \
            -keystore "${output_dir}/truststore.p12" \
            -storetype PKCS12 \
            -storepass changeit \
            -alias "chainrisk-ca" \
            -noprompt 2>/dev/null || true
        
        chmod 600 "${output_dir}/keystore.p12" "${output_dir}/truststore.p12"
    fi
    
    # Cleanup temp file
    rm -f /tmp/cert_data_${service}.json
    
    # Verify certificate
    log_info "Verifying certificate..."
    openssl verify -CAfile "${CERT_BASE_DIR}/ca-chain.pem" "${output_dir}/cert.pem" && \
        log_info "Certificate valid for $service" || \
        log_error "Certificate verification failed for $service"
    
    # Show certificate info
    local expiry
    expiry=$(openssl x509 -in "${output_dir}/cert.pem" -noout -enddate | cut -d= -f2)
    log_info "Certificate expires: $expiry"
}

generate_client_cert() {
    log_info "Generating client certificate for mTLS testing..."
    
    local output_dir="${CERT_BASE_DIR}/client"
    mkdir -p "$output_dir"
    
    vault write -format=json "pki_int/issue/service-role" \
        common_name="client.${DOMAIN}" \
        alt_names="client,localhost" \
        ip_sans="127.0.0.1" \
        ttl="$CERT_TTL" > /tmp/cert_data_client.json
    
    jq -r '.data.certificate' /tmp/cert_data_client.json > "${output_dir}/cert.pem"
    jq -r '.data.private_key' /tmp/cert_data_client.json > "${output_dir}/key.pem"
    jq -r '.data.ca_chain[0]' /tmp/cert_data_client.json > "${output_dir}/ca.pem"
    
    chmod 644 "${output_dir}/cert.pem" "${output_dir}/ca.pem"
    chmod 600 "${output_dir}/key.pem"
    
    rm -f /tmp/cert_data_client.json
    log_info "Client certificate generated in $output_dir"
}

generate_all() {
    log_info "Generating certificates for all services..."
    
    for service in "${SERVICES[@]}"; do
        generate_cert "$service"
    done
    
    generate_client_cert
    
    log_info "=== All certificates generated ==="
}

main() {
    local service=""
    local generate_all_flag=false
    local ttl="$CERT_TTL"
    local output_dir=""
    
    while [[ $# -gt 0 ]]; do
        case $1 in
            -h|--help)
                usage
                exit 0
                ;;
            -a|--all)
                generate_all_flag=true
                shift
                ;;
            -t|--ttl)
                ttl="$2"
                shift 2
                ;;
            -o|--output)
                output_dir="$2"
                shift 2
                ;;
            *)
                service="$1"
                shift
                ;;
        esac
    done
    
    check_vault
    
    if $generate_all_flag; then
        generate_all
    elif [ -n "$service" ]; then
        # Validate service name
        local valid=false
        for s in "${SERVICES[@]}"; do
            if [ "$s" == "$service" ]; then
                valid=true
                break
            fi
        done
        
        if ! $valid; then
            log_error "Unknown service: $service"
            usage
            exit 1
        fi
        
        generate_cert "$service" "$output_dir" "$ttl"
    else
        log_error "No service specified"
        usage
        exit 1
    fi
}

main "$@"
