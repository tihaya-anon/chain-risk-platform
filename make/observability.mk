# Observability: Vault, ES, Jaeger, OTel

# ============================================
# Vault
# ============================================
vault-init:
	@bash -c '$(LOAD_ENV) ./scripts/vault-init.sh all'

vault-status:
	@bash -c '$(LOAD_ENV) ./scripts/vault-init.sh status'

vault-unseal:
	@bash -c '$(LOAD_ENV) ./scripts/vault-init.sh unseal'

vault-secrets-status:
	@bash -c '$(LOAD_ENV) ./scripts/vault-secrets.sh status'

vault-secrets-seed:
	@bash -c '$(LOAD_ENV) ./scripts/vault-secrets.sh seed'

vault-secrets-verify:
	@bash -c '$(LOAD_ENV) ./scripts/vault-secrets.sh verify'

# ============================================
# Elasticsearch
# ============================================
es-check:
	@bash -c '$(LOAD_ENV) curl -s "$${ELASTICSEARCH_URL}/_cluster/health?pretty"'

es-indices:
	@bash -c '$(LOAD_ENV) curl -s "$${ELASTICSEARCH_URL}/_cat/indices?v"'

# ============================================
# Jaeger
# ============================================
jaeger-verify:
	@bash -c '$(LOAD_ENV) ./scripts/verify-jaeger-es.sh'

jaeger-ilm-setup:
	@bash -c '$(LOAD_ENV) ./scripts/setup-jaeger-ilm.sh'

jaeger-ilm-status:
	@bash -c '$(LOAD_ENV) ./scripts/check-jaeger-ilm.sh'

jaeger-trace-test:
	@bash -c '$(LOAD_ENV) ./scripts/test-jaeger-tracing.sh'

# ============================================
# OTel
# ============================================
otel-download:
	@./scripts/download-otel-agent.sh

# ============================================
# Infrastructure
# ============================================
infra-check:
	@bash -c '$(LOAD_ENV) ./scripts/check-infra.sh'

# ============================================
# Cleanup
# ============================================
cleanup:
	@bash -c '$(LOAD_ENV) ./scripts/cleanup.sh'

cleanup-all:
	@bash -c '$(LOAD_ENV) ./scripts/cleanup.sh --all -y'

cleanup-rolling:
	@bash -c '$(LOAD_ENV) ./scripts/cleanup-cron.sh --once'
