# Chain Risk Platform - Vault Policy
# Services can read secrets from their designated paths

# Database credentials
path "secret/data/chainrisk/database/*" {
  capabilities = ["read"]
}

# API keys
path "secret/data/chainrisk/api/*" {
  capabilities = ["read"]
}

# JWT signing keys
path "secret/data/chainrisk/jwt/*" {
  capabilities = ["read"]
}

# Service-specific secrets
path "secret/data/chainrisk/services/*" {
  capabilities = ["read"]
}
