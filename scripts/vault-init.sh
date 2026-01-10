#!/bin/bash
# ============================================================
# Vault Initialization Script for Chain Risk Platform
# ============================================================
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

source "$SCRIPT_DIR/common.sh"

VAULT_ADDR="${VAULT_ADDR:-http://${DOCKER_HOST_IP}:18200}"
VAULT_KEYS_FILE="$PROJECT_ROOT/.vault-keys"

export VAULT_ADDR

log_info "Vault Initialization Script"
log_info "VAULT_ADDR: $VAULT_ADDR"

# Wait for Vault to be ready
wait_for_vault() {
    log_info "Waiting for Vault to be ready..."
    local max_attempts=30
    local attempt=0
    while [ $attempt -lt $max_attempts ]; do
        if curl -s "$VAULT_ADDR/v1/sys/health" > /dev/null 2>&1; then
            log_success "Vault is ready"
            return 0
        fi
        attempt=$((attempt + 1))
        sleep 2
    done
    log_error "Vault failed to start"
    exit 1
}

# Initialize Vault
init_vault() {
    log_info "Checking Vault initialization status..."
    
    local status=$(curl -s "$VAULT_ADDR/v1/sys/init" | grep -o '"initialized":[^,]*' | cut -d':' -f2)
    
    if [ "$status" = "true" ]; then
        log_info "Vault already initialized"
        return 0
    fi
    
    log_info "Initializing Vault..."
    local init_response=$(curl -s -X PUT \
        -H "Content-Type: application/json" \
        -d '{"secret_shares": 1, "secret_threshold": 1}' \
        "$VAULT_ADDR/v1/sys/init")
    
    local root_token=$(echo "$init_response" | grep -o '"root_token":"[^"]*"' | cut -d'"' -f4)
    local unseal_key=$(echo "$init_response" | grep -o '"keys":\["[^"]*"\]' | grep -o '\["[^"]*"\]' | tr -d '[]"')
    
    if [ -z "$root_token" ] || [ -z "$unseal_key" ]; then
        log_error "Failed to initialize Vault"
        echo "$init_response"
        exit 1
    fi
    
    # Save keys
    cat > "$VAULT_KEYS_FILE" << EOF
VAULT_UNSEAL_KEY=$unseal_key
VAULT_ROOT_TOKEN=$root_token
EOF
    chmod 600 "$VAULT_KEYS_FILE"
    
    log_success "Vault initialized. Keys saved to $VAULT_KEYS_FILE"
    log_warn "IMPORTANT: In production, use multiple unseal keys and store securely!"
}

# Unseal Vault
unseal_vault() {
    log_info "Checking Vault seal status..."
    
    local sealed=$(curl -s "$VAULT_ADDR/v1/sys/seal-status" | grep -o '"sealed":[^,]*' | cut -d':' -f2)
    
    if [ "$sealed" = "false" ]; then
        log_info "Vault already unsealed"
        return 0
    fi
    
    if [ ! -f "$VAULT_KEYS_FILE" ]; then
        log_error "Vault keys file not found: $VAULT_KEYS_FILE"
        exit 1
    fi
    
    source "$VAULT_KEYS_FILE"
    
    log_info "Unsealing Vault..."
    curl -s -X PUT \
        -H "Content-Type: application/json" \
        -d "{\"key\": \"$VAULT_UNSEAL_KEY\"}" \
        "$VAULT_ADDR/v1/sys/unseal" > /dev/null
    
    log_success "Vault unsealed"
}

# Enable KV secrets engine
enable_kv_engine() {
    source "$VAULT_KEYS_FILE"
    export VAULT_TOKEN="$VAULT_ROOT_TOKEN"
    
    log_info "Enabling KV secrets engine..."
    
    # Check if already enabled
    local engines=$(curl -s -H "X-Vault-Token: $VAULT_TOKEN" "$VAULT_ADDR/v1/sys/mounts")
    if echo "$engines" | grep -q '"secret/"'; then
        log_info "KV secrets engine already enabled"
        return 0
    fi
    
    curl -s -X POST \
        -H "X-Vault-Token: $VAULT_TOKEN" \
        -H "Content-Type: application/json" \
        -d '{"type": "kv", "options": {"version": "2"}}' \
        "$VAULT_ADDR/v1/sys/mounts/secret" > /dev/null
    
    log_success "KV secrets engine enabled"
}

# Create policy
create_policy() {
    source "$VAULT_KEYS_FILE"
    export VAULT_TOKEN="$VAULT_ROOT_TOKEN"
    
    log_info "Creating chainrisk policy..."
    
    local policy_content=$(cat "$PROJECT_ROOT/infra/vault/policies/chainrisk-policy.hcl")
    local policy_json=$(echo "$policy_content" | jq -Rs '{policy: .}')
    
    curl -s -X PUT \
        -H "X-Vault-Token: $VAULT_TOKEN" \
        -H "Content-Type: application/json" \
        -d "$policy_json" \
        "$VAULT_ADDR/v1/sys/policies/acl/chainrisk" > /dev/null
    
    log_success "Policy created"
}

# Enable AppRole auth
enable_approle() {
    source "$VAULT_KEYS_FILE"
    export VAULT_TOKEN="$VAULT_ROOT_TOKEN"
    
    log_info "Enabling AppRole authentication..."
    
    # Check if already enabled
    local auths=$(curl -s -H "X-Vault-Token: $VAULT_TOKEN" "$VAULT_ADDR/v1/sys/auth")
    if echo "$auths" | grep -q '"approle/"'; then
        log_info "AppRole already enabled"
        return 0
    fi
    
    curl -s -X POST \
        -H "X-Vault-Token: $VAULT_TOKEN" \
        -H "Content-Type: application/json" \
        -d '{"type": "approle"}' \
        "$VAULT_ADDR/v1/sys/auth/approle" > /dev/null
    
    log_success "AppRole authentication enabled"
}

# Create AppRole for services
create_approle() {
    source "$VAULT_KEYS_FILE"
    export VAULT_TOKEN="$VAULT_ROOT_TOKEN"
    
    log_info "Creating chainrisk-services AppRole..."
    
    # Create role
    curl -s -X POST \
        -H "X-Vault-Token: $VAULT_TOKEN" \
        -H "Content-Type: application/json" \
        -d '{"policies": ["chainrisk"], "token_ttl": "1h", "token_max_ttl": "4h"}' \
        "$VAULT_ADDR/v1/auth/approle/role/chainrisk-services" > /dev/null
    
    # Get role_id
    local role_id=$(curl -s -H "X-Vault-Token: $VAULT_TOKEN" \
        "$VAULT_ADDR/v1/auth/approle/role/chainrisk-services/role-id" | \
        grep -o '"role_id":"[^"]*"' | cut -d'"' -f4)
    
    # Generate secret_id
    local secret_id=$(curl -s -X POST -H "X-Vault-Token: $VAULT_TOKEN" \
        "$VAULT_ADDR/v1/auth/approle/role/chainrisk-services/secret-id" | \
        grep -o '"secret_id":"[^"]*"' | cut -d'"' -f4)
    
    # Save AppRole credentials
    cat >> "$VAULT_KEYS_FILE" << EOF
VAULT_APPROLE_ROLE_ID=$role_id
VAULT_APPROLE_SECRET_ID=$secret_id
EOF
    
    log_success "AppRole created. Credentials appended to $VAULT_KEYS_FILE"
}

# Seed initial secrets
seed_secrets() {
    source "$VAULT_KEYS_FILE"
    export VAULT_TOKEN="$VAULT_ROOT_TOKEN"
    
    log_info "Seeding initial secrets..."
    
    # Database secrets
    curl -s -X POST \
        -H "X-Vault-Token: $VAULT_TOKEN" \
        -H "Content-Type: application/json" \
        -d '{"data": {"host": "'"${POSTGRES_HOST:-localhost}"'", "port": "'"${POSTGRES_PORT:-15432}"'", "user": "'"${POSTGRES_USER:-chainrisk}"'", "password": "'"${POSTGRES_PASSWORD:-chainrisk123}"'", "database": "'"${POSTGRES_DB:-chainrisk}"'"}}' \
        "$VAULT_ADDR/v1/secret/data/chainrisk/database/postgres" > /dev/null
    
    curl -s -X POST \
        -H "X-Vault-Token: $VAULT_TOKEN" \
        -H "Content-Type: application/json" \
        -d '{"data": {"uri": "'"${NEO4J_URI:-bolt://localhost:17687}"'", "user": "'"${NEO4J_USER:-neo4j}"'", "password": "'"${NEO4J_PASSWORD:-chainrisk123}"'"}}' \
        "$VAULT_ADDR/v1/secret/data/chainrisk/database/neo4j" > /dev/null
    
    curl -s -X POST \
        -H "X-Vault-Token: $VAULT_TOKEN" \
        -H "Content-Type: application/json" \
        -d '{"data": {"host": "'"${REDIS_HOST:-localhost}"'", "port": "'"${REDIS_PORT:-16379}"'", "password": "'"${REDIS_PASSWORD:-}"'"}}' \
        "$VAULT_ADDR/v1/secret/data/chainrisk/database/redis" > /dev/null
    
    # API keys
    curl -s -X POST \
        -H "X-Vault-Token: $VAULT_TOKEN" \
        -H "Content-Type: application/json" \
        -d '{"data": {"key": "'"${ETHERSCAN_API_KEY:-demo-key}"'"}}' \
        "$VAULT_ADDR/v1/secret/data/chainrisk/api/etherscan" > /dev/null
    
    # JWT secret
    local jwt_secret=$(openssl rand -base64 32)
    curl -s -X POST \
        -H "X-Vault-Token: $VAULT_TOKEN" \
        -H "Content-Type: application/json" \
        -d '{"data": {"secret": "'"$jwt_secret"'", "expires_in": "1h", "refresh_expires_in": "7d"}}' \
        "$VAULT_ADDR/v1/secret/data/chainrisk/jwt/config" > /dev/null
    
    # MinIO/S3
    curl -s -X POST \
        -H "X-Vault-Token: $VAULT_TOKEN" \
        -H "Content-Type: application/json" \
        -d '{"data": {"endpoint": "'"${MINIO_ENDPOINT:-http://localhost:19000}"'", "access_key": "'"${MINIO_ACCESS_KEY:-minioadmin}"'", "secret_key": "'"${MINIO_SECRET_KEY:-minioadmin123}"'"}}' \
        "$VAULT_ADDR/v1/secret/data/chainrisk/api/minio" > /dev/null
    
    log_success "Initial secrets seeded"
}

# Main
main() {
    case "${1:-all}" in
        wait)
            wait_for_vault
            ;;
        init)
            wait_for_vault
            init_vault
            ;;
        unseal)
            unseal_vault
            ;;
        setup)
            enable_kv_engine
            create_policy
            enable_approle
            create_approle
            ;;
        seed)
            seed_secrets
            ;;
        all)
            wait_for_vault
            init_vault
            unseal_vault
            enable_kv_engine
            create_policy
            enable_approle
            create_approle
            seed_secrets
            log_success "Vault fully configured!"
            log_info "UI available at: $VAULT_ADDR/ui"
            ;;
        status)
            curl -s "$VAULT_ADDR/v1/sys/health" | jq .
            ;;
        *)
            echo "Usage: $0 {wait|init|unseal|setup|seed|all|status}"
            exit 1
            ;;
    esac
}

main "$@"
