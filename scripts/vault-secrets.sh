#!/bin/bash
# ============================================================
# Vault Secrets Management for Chain Risk Platform
# ============================================================
# Usage:
#   ./scripts/vault-secrets.sh status    - Show secrets status
#   ./scripts/vault-secrets.sh seed      - Seed all secrets
#   ./scripts/vault-secrets.sh get PATH  - Get a secret
#   ./scripts/vault-secrets.sh verify    - Verify all secrets
# ============================================================
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

source "$SCRIPT_DIR/common.sh"

VAULT_ADDR="${VAULT_ADDR:-http://${DOCKER_HOST_IP}:18200}"
VAULT_KEYS_FILE="$PROJECT_ROOT/.vault-keys"

export VAULT_ADDR

# Load Vault token
load_token() {
    if [ ! -f "$VAULT_KEYS_FILE" ]; then
        log_error "Vault keys file not found: $VAULT_KEYS_FILE"
        log_info "Run 'make vault-init' first"
        exit 1
    fi
    source "$VAULT_KEYS_FILE"
    export VAULT_TOKEN="$VAULT_ROOT_TOKEN"
}

# Check Vault status
check_status() {
    log_info "Checking Vault status..."
    
    local health=$(curl -s "$VAULT_ADDR/v1/sys/health")
    local initialized=$(echo "$health" | grep -o '"initialized":[^,]*' | cut -d':' -f2)
    local sealed=$(echo "$health" | grep -o '"sealed":[^,]*' | cut -d':' -f2)
    
    if [ "$initialized" != "true" ]; then
        log_error "Vault not initialized"
        exit 1
    fi
    
    if [ "$sealed" = "true" ]; then
        log_error "Vault is sealed"
        log_info "Run 'make vault-unseal' to unseal"
        exit 1
    fi
    
    log_success "Vault is initialized and unsealed"
}

# Seed database secrets
seed_database_secrets() {
    log_info "Seeding database secrets..."
    
    # PostgreSQL
    curl -s -X POST \
        -H "X-Vault-Token: $VAULT_TOKEN" \
        -H "Content-Type: application/json" \
        -d "{\"data\": {
            \"host\": \"${POSTGRES_HOST:-$DOCKER_HOST_IP}\",
            \"port\": \"${POSTGRES_PORT:-15432}\",
            \"user\": \"${POSTGRES_USER:-chainrisk}\",
            \"password\": \"${POSTGRES_PASSWORD:-chainrisk123}\",
            \"database\": \"${POSTGRES_DB:-chainrisk}\"
        }}" \
        "$VAULT_ADDR/v1/secret/data/chainrisk/database/postgres" > /dev/null
    log_success "  PostgreSQL secrets stored"
    
    # Neo4j
    curl -s -X POST \
        -H "X-Vault-Token: $VAULT_TOKEN" \
        -H "Content-Type: application/json" \
        -d "{\"data\": {
            \"uri\": \"${NEO4J_URI:-bolt://$DOCKER_HOST_IP:17687}\",
            \"user\": \"${NEO4J_USER:-neo4j}\",
            \"password\": \"${NEO4J_PASSWORD:-chainrisk123}\"
        }}" \
        "$VAULT_ADDR/v1/secret/data/chainrisk/database/neo4j" > /dev/null
    log_success "  Neo4j secrets stored"
    
    # Redis
    curl -s -X POST \
        -H "X-Vault-Token: $VAULT_TOKEN" \
        -H "Content-Type: application/json" \
        -d "{\"data\": {
            \"host\": \"${REDIS_HOST:-$DOCKER_HOST_IP}\",
            \"port\": \"${REDIS_PORT:-16379}\",
            \"password\": \"${REDIS_PASSWORD:-}\"
        }}" \
        "$VAULT_ADDR/v1/secret/data/chainrisk/database/redis" > /dev/null
    log_success "  Redis secrets stored"
    
    # Kafka
    curl -s -X POST \
        -H "X-Vault-Token: $VAULT_TOKEN" \
        -H "Content-Type: application/json" \
        -d "{\"data\": {
            \"brokers\": \"${KAFKA_BROKERS:-$DOCKER_HOST_IP:19092}\"
        }}" \
        "$VAULT_ADDR/v1/secret/data/chainrisk/database/kafka" > /dev/null
    log_success "  Kafka secrets stored"
}

# Seed JWT secrets
seed_jwt_secrets() {
    log_info "Seeding JWT secrets..."
    
    # Generate secure JWT secret if not exists
    local jwt_secret="${JWT_SECRET:-}"
    if [ -z "$jwt_secret" ] || [ "$jwt_secret" = "default-secret-change-me" ]; then
        jwt_secret=$(openssl rand -base64 32)
        log_info "  Generated new JWT secret"
    fi
    
    curl -s -X POST \
        -H "X-Vault-Token: $VAULT_TOKEN" \
        -H "Content-Type: application/json" \
        -d "{\"data\": {
            \"secret\": \"$jwt_secret\",
            \"expires_in\": \"${JWT_EXPIRES_IN:-1h}\",
            \"refresh_expires_in\": \"${JWT_REFRESH_EXPIRES_IN:-7d}\"
        }}" \
        "$VAULT_ADDR/v1/secret/data/chainrisk/jwt/config" > /dev/null
    log_success "  JWT secrets stored"
}

# Seed API keys
seed_api_secrets() {
    log_info "Seeding API secrets..."
    
    # Etherscan
    curl -s -X POST \
        -H "X-Vault-Token: $VAULT_TOKEN" \
        -H "Content-Type: application/json" \
        -d "{\"data\": {
            \"key\": \"${ETHERSCAN_API_KEY:-demo-key}\"
        }}" \
        "$VAULT_ADDR/v1/secret/data/chainrisk/api/etherscan" > /dev/null
    log_success "  Etherscan API key stored"
    
    # MinIO/S3
    curl -s -X POST \
        -H "X-Vault-Token: $VAULT_TOKEN" \
        -H "Content-Type: application/json" \
        -d "{\"data\": {
            \"endpoint\": \"${MINIO_ENDPOINT:-http://$DOCKER_HOST_IP:19000}\",
            \"access_key\": \"${MINIO_ACCESS_KEY:-minioadmin}\",
            \"secret_key\": \"${MINIO_SECRET_KEY:-minioadmin123}\"
        }}" \
        "$VAULT_ADDR/v1/secret/data/chainrisk/api/minio" > /dev/null
    log_success "  MinIO secrets stored"
}

# Get a secret
get_secret() {
    local path=$1
    if [ -z "$path" ]; then
        log_error "Usage: $0 get <path>"
        log_info "Example: $0 get chainrisk/database/postgres"
        exit 1
    fi
    
    load_token
    
    local response=$(curl -s -H "X-Vault-Token: $VAULT_TOKEN" \
        "$VAULT_ADDR/v1/secret/data/$path")
    
    if echo "$response" | grep -q '"errors"'; then
        log_error "Failed to get secret: $path"
        echo "$response" | jq -r '.errors[]' 2>/dev/null
        exit 1
    fi
    
    echo "$response" | jq -r '.data.data'
}

# Verify all secrets exist
verify_secrets() {
    log_info "Verifying secrets..."
    
    local paths=(
        "chainrisk/database/postgres"
        "chainrisk/database/neo4j"
        "chainrisk/database/redis"
        "chainrisk/database/kafka"
        "chainrisk/jwt/config"
        "chainrisk/api/etherscan"
        "chainrisk/api/minio"
    )
    
    local all_ok=true
    
    for path in "${paths[@]}"; do
        local response=$(curl -s -H "X-Vault-Token: $VAULT_TOKEN" \
            "$VAULT_ADDR/v1/secret/data/$path")
        
        if echo "$response" | grep -q '"data"'; then
            log_success "  $path"
        else
            log_error "  $path - NOT FOUND"
            all_ok=false
        fi
    done
    
    if [ "$all_ok" = true ]; then
        log_success "All secrets verified"
    else
        log_error "Some secrets are missing"
        exit 1
    fi
}

# Show secrets status
show_status() {
    log_info "Vault Secrets Status"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "Vault Address: $VAULT_ADDR"
    echo ""
    
    check_status
    load_token
    
    echo ""
    log_info "Configured Secrets:"
    
    # List secrets
    local mounts=$(curl -s -H "X-Vault-Token: $VAULT_TOKEN" \
        "$VAULT_ADDR/v1/secret/metadata/chainrisk?list=true" 2>/dev/null)
    
    if echo "$mounts" | grep -q '"keys"'; then
        echo "$mounts" | jq -r '.data.keys[]' 2>/dev/null | while read key; do
            echo "  📁 chainrisk/$key"
        done
    else
        log_warn "No secrets found. Run 'make vault-secrets-seed' to seed secrets."
    fi
}

# Seed all secrets
seed_all() {
    check_status
    load_token
    
    log_info "Seeding all secrets to Vault..."
    echo ""
    
    seed_database_secrets
    seed_jwt_secrets
    seed_api_secrets
    
    echo ""
    log_success "All secrets seeded successfully!"
    echo ""
    log_info "Vault UI: $VAULT_ADDR/ui"
}

# Main
main() {
    case "${1:-status}" in
        status)
            show_status
            ;;
        seed)
            seed_all
            ;;
        get)
            load_token
            get_secret "$2"
            ;;
        verify)
            check_status
            load_token
            verify_secrets
            ;;
        *)
            echo "Usage: $0 {status|seed|get|verify}"
            echo ""
            echo "Commands:"
            echo "  status  - Show Vault and secrets status"
            echo "  seed    - Seed all secrets to Vault"
            echo "  get     - Get a specific secret (e.g., get chainrisk/database/postgres)"
            echo "  verify  - Verify all required secrets exist"
            exit 1
            ;;
    esac
}

main "$@"
