# Chain Risk Platform - Makefile
SHELL := /bin/bash
.PHONY: help
export

# ============================================
# Variables
# ============================================

LOGS_DIR := .logs

JAVA17_HOME := $(shell /usr/libexec/java_home -v 17 2>/dev/null)
JAVA17_ENV := export JAVA_HOME=$(JAVA17_HOME) &&
MVN_QUIET := -q
MVN_SKIP_TESTS := -DskipTests

LOAD_ENV := set -a && source .env.local && source ./scripts/load-env.sh > /dev/null &&

DIR_INGESTION := data-ingestion
DIR_MEMPOOL := mempool-collector
DIR_QUERY := services/query-service
DIR_ALERT := services/alert-service
DIR_RISK := services/risk-ml-service
DIR_BFF := services/bff
DIR_GRAPH := services/graph-service
DIR_FLINK := processing/stream-processor
DIR_BATCH := processing/batch-processor
DIR_FRONTEND := frontend
DIR_OTEL := infra/otel
DIR_LOADGEN := tools/load-generator

OTEL_AGENT := $(DIR_OTEL)/opentelemetry-javaagent.jar
OTEL_CONFIG := $(DIR_OTEL)/otel-agent.properties
OTEL_ENDPOINT := $${OTEL_EXPORTER_OTLP_ENDPOINT:-http://localhost:4317}
OTEL_OPTS = -javaagent:$(OTEL_AGENT) -Dotel.javaagent.configuration-file=$(OTEL_CONFIG) -Dotel.exporter.otlp.endpoint=$(OTEL_ENDPOINT)

# ============================================
# Include modules
# ============================================

include make/docker.mk
include make/services.mk
include make/processing.mk
include make/observability.mk
include make/testing.mk

# ============================================
# Help
# ============================================

help:
	@echo ""
	@echo "Chain Risk Platform"
	@echo "==================="
	@echo ""
	@echo "🐳 Docker:"
	@echo "  infra-up/down      Core (kafka,pg,neo4j,redis,nacos)"
	@echo "  datalake-up/down   Data lake (minio,hive,trino)"
	@echo "  monitoring-up/down Observability (prom,grafana,loki,jaeger,es)"
	@echo "  security-up/down   Security (vault)"
	@echo "  services-up/down   App services"
	@echo "  up-all/down-all    Everything"
	@echo "  docker-build       Build all images"
	@echo ""
	@echo "🔧 Services: {name}-{build,run,test,clean}"
	@echo "  ingestion, query, alert, risk, bff, graph, mempool, loadgen"
	@echo ""
	@echo "⚡ Processing: flink-{build,run,stop}, batch-{build,archive,...}"
	@echo ""
	@echo "🔐 Vault: vault-{init,status,unseal}"
	@echo "🔭 Jaeger: jaeger-{verify,ilm-setup,ilm-status}"
	@echo ""
	@echo "🧪 Testing:"
	@echo "  test-unit          Unit tests (all services)"
	@echo "  smoke-test         Service health check"
	@echo ""
	@echo "  Integration Tests:"
	@echo "  it-pipeline        Data pipeline (ingestion→flink→batch)"
	@echo "  it-otel            OTel trace verification"
	@echo "  it-mempool         Mempool collector"
	@echo "  it-all             All integration tests"
	@echo ""
	@echo "  E2E Tests:"
	@echo "  test-e2e           Backend E2E tests"
	@echo "  playwright-test    Frontend E2E tests"
	@echo ""
