#!/bin/bash
# Chain Risk Platform - PKI Infrastructure Bootstrap
# Initializes Vault PKI secrets engine with Root CA and Intermediate CA

set -euo pipefail

VAULT_ADDR="${VAULT_ADDR:-http://localhost:18200}"
VAULT_TOKEN="${VAULT_TOKEN:-}"
ROOT_CA_TTL="${ROOT_CA_TTL:-87600h}"      # 10 years
INT_CA_TTL="${INT_CA_TTL:-43800h}"        # 5 years
CERT_TTL="${CERT_TTL:-720h}"              # 30 days
DOMAIN="${DOMAIN:-chainrisk.local}"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

check_vault() {
    if ! command -v vault &> /dev/null; then
        log_error "Vault CLI not found. Install: brew install vault"
        exit 1
    fi
    
    if [ -z "$VAULT_TOKEN" ]; then
        log_error "VAULT_TOKEN not set"
        exit 1
    fi
    
    export VAULT_ADDR VAULT_TOKEN
    
    if ! vault status &> /dev/null; then
        log_error "Cannot connect to Vault at $VAULT_ADDR"
        exit 1
    fi
    log_info "Vault connection OK"
}

enable_pki_engine() {
    log_info "Enabling PKI secrets engine..."
    
    # Root CA engine
    if vault secrets list | grep -q "^pki/"; then
        log_warn "PKI engine already enabled, skipping"
    else
        vault secrets enable pki
        vault secrets tune -max-lease-ttl="$ROOT_CA_TTL" pki
        log_info "Root PKI engine enabled"
    fi
    
    # Intermediate CA engine
    if vault secrets list | grep -q "^pki_int/"; then
        log_warn "PKI intermediate engine already enabled, skipping"
    else
        vault secrets enable -path=pki_int pki
        vault secrets tune -max-lease-ttl="$INT_CA_TTL" pki_int
        log_info "Intermediate PKI engine enabled"
    fi
}

generate_root_ca() {
    log_info "Generating Root CA..."
    
    vault write -format=json pki/root/generate/internal \
        common_name="Chain Risk Platform Root CA" \
        issuer_name="root-ca" \
        ttl="$ROOT_CA_TTL" \
        key_type="rsa" \
        key_bits=4096 > /tmp/root_ca.json
    
    # Configure URLs
    vault write pki/config/urls \
        issuing_certificates="${VAULT_ADDR}/v1/pki/ca" \
        crl_distribution_points="${VAULT_ADDR}/v1/pki/crl"
    
    log_info "Root CA generated"
}

generate_intermediate_ca() {
    log_info "Generating Intermediate CA..."
    
    # Generate CSR
    vault write -format=json pki_int/intermediate/generate/internal \
        common_name="Chain Risk Platform Intermediate CA" \
        issuer_name="intermediate-ca" \
        key_type="rsa" \
        key_bits=4096 > /tmp/int_csr.json
    
    CSR=$(jq -r '.data.csr' /tmp/int_csr.json)
    
    # Sign with Root CA
    vault write -format=json pki/root/sign-intermediate \
        csr="$CSR" \
        format="pem_bundle" \
        ttl="$INT_CA_TTL" > /tmp/int_cert.json
    
    CERT=$(jq -r '.data.certificate' /tmp/int_cert.json)
    
    # Import signed certificate
    vault write pki_int/intermediate/set-signed certificate="$CERT"
    
    # Configure URLs
    vault write pki_int/config/urls \
        issuing_certificates="${VAULT_ADDR}/v1/pki_int/ca" \
        crl_distribution_points="${VAULT_ADDR}/v1/pki_int/crl"
    
    log_info "Intermediate CA generated and signed"
}

create_service_role() {
    log_info "Creating service certificate role..."
    
    vault write pki_int/roles/service-role \
        allowed_domains="$DOMAIN" \
        allow_subdomains=true \
        allow_localhost=true \
        allow_ip_sans=true \
        allowed_uri_sans="spiffe://${DOMAIN}/*" \
        max_ttl="$CERT_TTL" \
        ttl="$CERT_TTL" \
        key_type="rsa" \
        key_bits=2048 \
        key_usage="DigitalSignature,KeyEncipherment" \
        ext_key_usage="ServerAuth,ClientAuth" \
        require_cn=true \
        server_flag=true \
        client_flag=true
    
    log_info "Service role created with TTL: $CERT_TTL"
}

apply_policy() {
    log_info "Applying PKI policy..."
    
    SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    POLICY_FILE="${SCRIPT_DIR}/../../infra/vault/pki-config.hcl"
    
    if [ -f "$POLICY_FILE" ]; then
        vault policy write pki-admin "$POLICY_FILE"
        log_info "PKI policy applied"
    else
        log_warn "Policy file not found: $POLICY_FILE"
    fi
}

export_ca_chain() {
    log_info "Exporting CA chain..."
    
    SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    CERT_DIR="${SCRIPT_DIR}/../../infra/certs"
    mkdir -p "$CERT_DIR"
    
    # Export Root CA
    curl -s "${VAULT_ADDR}/v1/pki/ca/pem" > "${CERT_DIR}/root-ca.pem"
    
    # Export Intermediate CA
    curl -s "${VAULT_ADDR}/v1/pki_int/ca/pem" > "${CERT_DIR}/intermediate-ca.pem"
    
    # Create CA chain
    cat "${CERT_DIR}/intermediate-ca.pem" "${CERT_DIR}/root-ca.pem" > "${CERT_DIR}/ca-chain.pem"
    
    log_info "CA chain exported to $CERT_DIR"
}

cleanup_temp() {
    rm -f /tmp/root_ca.json /tmp/int_csr.json /tmp/int_cert.json
}

main() {
    log_info "=== Chain Risk Platform PKI Bootstrap ==="
    log_info "Vault: $VAULT_ADDR"
    log_info "Domain: $DOMAIN"
    
    check_vault
    enable_pki_engine
    generate_root_ca
    generate_intermediate_ca
    create_service_role
    apply_policy
    export_ca_chain
    cleanup_temp
    
    log_info "=== PKI Bootstrap Complete ==="
    log_info "Next: Run generate-service-cert.sh for each service"
}

main "$@"
