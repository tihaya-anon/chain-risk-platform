# Chain Risk Platform - Vault PKI Policy Configuration
# Manages certificate lifecycle for all platform services

# Root CA management (restricted)
path "pki/root/generate/internal" {
  capabilities = ["create", "update"]
}

path "pki/root/sign-intermediate" {
  capabilities = ["create", "update"]
}

path "pki/config/urls" {
  capabilities = ["create", "update", "read"]
}

# Intermediate CA management
path "pki_int/*" {
  capabilities = ["create", "read", "update", "delete", "list"]
}

path "pki_int/issue/*" {
  capabilities = ["create", "update"]
}

path "pki_int/sign/*" {
  capabilities = ["create", "update"]
}

path "pki_int/roles/*" {
  capabilities = ["create", "read", "update", "delete", "list"]
}

# Certificate revocation
path "pki_int/revoke" {
  capabilities = ["create", "update"]
}

path "pki_int/tidy" {
  capabilities = ["create", "update"]
}

# CRL access (public)
path "pki/crl" {
  capabilities = ["read"]
}

path "pki_int/crl" {
  capabilities = ["read"]
}

# CA chain access (public)
path "pki/ca/pem" {
  capabilities = ["read"]
}

path "pki_int/ca/pem" {
  capabilities = ["read"]
}

path "pki_int/ca_chain" {
  capabilities = ["read"]
}
