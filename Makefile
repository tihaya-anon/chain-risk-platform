# ============================================
# Chain Risk Platform - Monorepo Makefile
# ============================================
SHELL := /bin/bash
.PHONY: help

export

# ============================================
# Common Variables
# ============================================

LOGS_DIR := .logs

JAVA17_HOME := $(shell /usr/libexec/java_home -v 17 2>/dev/null)
JAVA17_ENV := export JAVA_HOME=$(JAVA17_HOME) &&

MVN_QUIET := -q
MVN_SKIP_TESTS := -DskipTests

LOAD_ENV := set -a && source .env.local && source ./scripts/load-env.sh > /dev/null &&

DIR_INGESTION := data-ingestion
DIR_QUERY := services/query-service
DIR_ALERT := services/alert-service
DIR_RISK := services/risk-ml-service
DIR_BFF := services/bff
DIR_ORCHESTRATOR := services/orchestrator
DIR_GRAPH := services/graph-service
DIR_FLINK := processing/stream-processor
DIR_BATCH := processing/batch-processor
DIR_FRONTEND := frontend
DIR_OTEL := infra/otel

# OTel Agent
OTEL_AGENT := $(DIR_OTEL)/opentelemetry-javaagent.jar
OTEL_CONFIG := $(DIR_OTEL)/otel-agent.properties
OTEL_ENDPOINT := $${OTEL_EXPORTER_OTLP_ENDPOINT:-http://localhost:4317}
OTEL_OPTS = -javaagent:$(OTEL_AGENT) -Dotel.javaagent.configuration-file=$(OTEL_CONFIG) -Dotel.exporter.otlp.endpoint=$(OTEL_ENDPOINT)

# ============================================
# Docker Compose Files
# ============================================

COMPOSE_BASE := -f infra/compose/base.yml
COMPOSE_INFRA := $(COMPOSE_BASE) -f infra/compose/infra.yml
COMPOSE_DATALAKE := $(COMPOSE_INFRA) -f infra/compose/datalake.yml
COMPOSE_MONITORING := $(COMPOSE_BASE) -f infra/compose/monitoring.yml
COMPOSE_SECURITY := $(COMPOSE_BASE) -f infra/compose/security.yml
COMPOSE_SERVICES := $(COMPOSE_INFRA) -f infra/compose/services.yml
COMPOSE_ALL := $(COMPOSE_BASE) -f infra/compose/infra.yml -f infra/compose/datalake.yml -f infra/compose/monitoring.yml -f infra/compose/security.yml -f infra/compose/services.yml

DOCKER_REGISTRY := chainrisk
DOCKER_TAG := latest

# ============================================
# Help
# ============================================

help:
	@echo ""
	@echo "Chain Risk Platform - Commands"
	@echo "=============================="
	@echo ""
	@echo "🐳 Docker Compose:"
	@echo "  make infra-up        Core infra (kafka,postgres,neo4j,redis,nacos)"
	@echo "  make infra-down      Stop core infra"
	@echo "  make datalake-up     Data lake (minio,hive,trino)"
	@echo "  make monitoring-up   Monitoring (prometheus,grafana,loki,jaeger,es)"
	@echo "  make security-up     Security (vault)"
	@echo "  make services-up     App services (query,alert,risk,graph,orch,bff)"
	@echo "  make up-all          Start everything"
	@echo "  make down-all        Stop everything"
	@echo ""
	@echo "🔨 Docker Build:"
	@echo "  make docker-build    Build all service images"
	@echo "  make docker-clean    Remove all service images"
	@echo ""
	@echo "🔐 Vault:"
	@echo "  make vault-init      Initialize Vault"
	@echo "  make vault-status    Check Vault status"
	@echo ""
	@echo "🚀 Local Services:"
	@echo "  make run-svc         Run services locally"
	@echo "  make stop-svc        Stop local services"
	@echo ""
	@echo "📊 Individual: {svc}-{build,run,test,clean}"
	@echo "   ingestion, query, alert, risk, bff, orchestrator, graph, flink, batch"
	@echo ""
	@echo "🧪 Testing:"
	@echo "  make test-e2e        Full E2E tests"
	@echo "  make validate-phase10  Phase 10 validation"
	@echo ""

# ============================================
# Infrastructure (Core)
# ============================================

infra-up:
	@echo "🚀 Starting core infrastructure..."
	@docker-compose $(COMPOSE_INFRA) up -d
	@echo "✅ Started: zookeeper, kafka, postgres, neo4j, redis, nacos"

infra-down:
	@echo "🛑 Stopping core infrastructure..."
	@docker-compose $(COMPOSE_INFRA) down

infra-ps:
	@docker-compose $(COMPOSE_INFRA) ps

infra-check:
	@bash -c '$(LOAD_ENV) ./scripts/check-infra.sh'

# ============================================
# Data Lake
# ============================================

datalake-up:
	@echo "🚀 Starting data lake..."
	@docker-compose $(COMPOSE_DATALAKE) up -d minio minio-init hive-metastore trino
	@echo "✅ Started: minio, hive-metastore, trino"

datalake-down:
	@docker-compose $(COMPOSE_DATALAKE) stop minio hive-metastore trino

# ============================================
# Monitoring
# ============================================

monitoring-up:
	@echo "🚀 Starting monitoring..."
	@docker-compose $(COMPOSE_MONITORING) up -d
	@echo "✅ Started: prometheus, grafana, loki, promtail, elasticsearch, jaeger"

monitoring-down:
	@docker-compose $(COMPOSE_MONITORING) down

monitoring-ps:
	@docker-compose $(COMPOSE_MONITORING) ps

# ============================================
# Security (Vault)
# ============================================

security-up:
	@echo "🚀 Starting Vault..."
	@docker-compose $(COMPOSE_SECURITY) up -d
	@echo "✅ Vault started on :18200"

security-down:
	@docker-compose $(COMPOSE_SECURITY) down

vault-init:
	@bash -c '$(LOAD_ENV) ./scripts/vault-init.sh all'

vault-status:
	@bash -c '$(LOAD_ENV) ./scripts/vault-init.sh status'

vault-unseal:
	@bash -c '$(LOAD_ENV) ./scripts/vault-init.sh unseal'

# ============================================
# Application Services (Docker)
# ============================================

services-up:
	@echo "🚀 Starting application services..."
	@docker-compose $(COMPOSE_SERVICES) up -d query-service alert-service risk-ml-service graph-service orchestrator bff
	@echo "✅ Services started"

services-down:
	@docker-compose $(COMPOSE_SERVICES) stop query-service alert-service risk-ml-service graph-service orchestrator bff

services-ps:
	@docker-compose $(COMPOSE_SERVICES) ps

services-logs:
	@docker-compose $(COMPOSE_SERVICES) logs -f query-service alert-service risk-ml-service graph-service orchestrator bff

# ============================================
# All Services
# ============================================

up-all:
	@echo "🚀 Starting ALL services..."
	@docker-compose $(COMPOSE_ALL) up -d
	@echo "✅ All services started"

down-all:
	@echo "🛑 Stopping ALL services..."
	@docker-compose $(COMPOSE_ALL) down

ps-all:
	@docker-compose $(COMPOSE_ALL) ps

# ============================================
# Docker Build
# ============================================

docker-build: docker-build-query docker-build-alert docker-build-risk docker-build-graph docker-build-orchestrator docker-build-bff
	@echo "✅ All images built"

docker-build-query:
	@echo "🐳 Building query-service..."
	@docker build -t $(DOCKER_REGISTRY)/query-service:$(DOCKER_TAG) $(DIR_QUERY)

docker-build-alert:
	@echo "🐳 Building alert-service..."
	@docker build -t $(DOCKER_REGISTRY)/alert-service:$(DOCKER_TAG) $(DIR_ALERT)

docker-build-risk:
	@echo "🐳 Building risk-ml-service..."
	@docker build -t $(DOCKER_REGISTRY)/risk-ml-service:$(DOCKER_TAG) $(DIR_RISK)

docker-build-graph:
	@echo "🐳 Building graph-service..."
	@docker build -t $(DOCKER_REGISTRY)/graph-service:$(DOCKER_TAG) $(DIR_GRAPH)

docker-build-orchestrator:
	@echo "🐳 Building orchestrator..."
	@docker build -t $(DOCKER_REGISTRY)/orchestrator:$(DOCKER_TAG) $(DIR_ORCHESTRATOR)

docker-build-bff:
	@echo "🐳 Building bff..."
	@docker build -t $(DOCKER_REGISTRY)/bff:$(DOCKER_TAG) $(DIR_BFF)

docker-clean:
	@echo "🧹 Cleaning images..."
	@docker rmi $(DOCKER_REGISTRY)/query-service:$(DOCKER_TAG) 2>/dev/null || true
	@docker rmi $(DOCKER_REGISTRY)/alert-service:$(DOCKER_TAG) 2>/dev/null || true
	@docker rmi $(DOCKER_REGISTRY)/risk-ml-service:$(DOCKER_TAG) 2>/dev/null || true
	@docker rmi $(DOCKER_REGISTRY)/graph-service:$(DOCKER_TAG) 2>/dev/null || true
	@docker rmi $(DOCKER_REGISTRY)/orchestrator:$(DOCKER_TAG) 2>/dev/null || true
	@docker rmi $(DOCKER_REGISTRY)/bff:$(DOCKER_TAG) 2>/dev/null || true
	@echo "✅ Images cleaned"

# ============================================
# Elasticsearch & Jaeger
# ============================================

es-check:
	@bash -c '$(LOAD_ENV) curl -s "$${ELASTICSEARCH_URL}/_cluster/health?pretty"'

es-indices:
	@bash -c '$(LOAD_ENV) curl -s "$${ELASTICSEARCH_URL}/_cat/indices?v"'

jaeger-verify:
	@bash -c '$(LOAD_ENV) ./scripts/verify-jaeger-es.sh'

jaeger-ilm-setup:
	@bash -c '$(LOAD_ENV) ./scripts/setup-jaeger-ilm.sh'

jaeger-ilm-status:
	@bash -c '$(LOAD_ENV) ./scripts/check-jaeger-ilm.sh'

# ============================================
# Cleanup
# ============================================

cleanup:
	@bash -c '$(LOAD_ENV) ./scripts/cleanup.sh'

cleanup-all:
	@bash -c '$(LOAD_ENV) ./scripts/cleanup.sh --all -y'

cleanup-rolling:
	@bash -c '$(LOAD_ENV) ./scripts/cleanup-cron.sh --once'

# ============================================
# OTel
# ============================================

otel-download:
	@./scripts/download-otel-agent.sh

# ============================================
# Data Ingestion (Go)
# ============================================

ingestion-build:
	@echo "🔨 Building data-ingestion..."
	@cd $(DIR_INGESTION) && mkdir -p bin && go build -o bin/ingestion ./cmd/ingestion

ingestion-run:
	@bash -c '$(LOAD_ENV) cd $(DIR_INGESTION) && ./bin/ingestion'

ingestion-test:
	@cd $(DIR_INGESTION) && go test ./...

ingestion-clean:
	@rm -rf $(DIR_INGESTION)/bin

# ============================================
# Data Generator (Go)
# ============================================

generator-build:
	@cd $(DIR_INGESTION) && mkdir -p bin && go build -o bin/generator ./cmd/generator

generator-run: generator-build
	@bash -c '$(LOAD_ENV) cd $(DIR_INGESTION) && ./bin/generator -mode=random -tps=10'

generator-scenario: generator-build
	@bash -c '$(LOAD_ENV) cd $(DIR_INGESTION) && ./bin/generator -mode=scenario -scenario=$(SCENARIO) -tps=$(or $(TPS),10)'

generator-stress: generator-build
	@bash -c '$(LOAD_ENV) cd $(DIR_INGESTION) && ./bin/generator -mode=random -tps=100 -duration=$(or $(DURATION),60)'

# ============================================
# Query Service (Go)
# ============================================

query-build:
	@cd $(DIR_QUERY) && mkdir -p bin && go build -o bin/query ./cmd/...

query-run:
	@bash -c '$(LOAD_ENV) cd $(DIR_QUERY) && go run ./cmd/...'

query-test:
	@cd $(DIR_QUERY) && go test ./...

query-clean:
	@rm -rf $(DIR_QUERY)/bin

# ============================================
# Alert Service (Go)
# ============================================

alert-build:
	@cd $(DIR_ALERT) && mkdir -p bin && go build -o bin/alert ./cmd/...

alert-run:
	@bash -c '$(LOAD_ENV) cd $(DIR_ALERT) && go run ./cmd/...'

alert-test:
	@cd $(DIR_ALERT) && go test ./...

alert-clean:
	@rm -rf $(DIR_ALERT)/bin

# ============================================
# Risk ML Service (Python)
# ============================================

risk-build:
	@cd $(DIR_RISK) && uv sync

risk-run:
	@bash -c '$(LOAD_ENV) cd $(DIR_RISK) && uv run uvicorn app.main:app --reload --port 8082'

risk-test:
	@cd $(DIR_RISK) && uv run pytest

risk-clean:
	@find $(DIR_RISK) -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null || true

# ============================================
# BFF Service (TypeScript)
# ============================================

bff-build:
	@cd $(DIR_BFF) && npm install && npm run build

bff-run:
	@bash -c '$(LOAD_ENV) cd $(DIR_BFF) && npm run start:dev'

bff-test:
	@cd $(DIR_BFF) && npm test

bff-clean:
	@rm -rf $(DIR_BFF)/dist

# ============================================
# Orchestrator (Java)
# ============================================

orchestrator-build:
	@bash -c 'cd $(DIR_ORCHESTRATOR) && $(JAVA17_ENV) mvn package $(MVN_SKIP_TESTS) $(MVN_QUIET)'

orchestrator-run:
	@bash -c '$(LOAD_ENV) cd $(DIR_ORCHESTRATOR) && $(JAVA17_ENV) mvn spring-boot:run'

orchestrator-run-otel: otel-download
	@bash -c '$(LOAD_ENV) cd $(DIR_ORCHESTRATOR) && $(JAVA17_ENV) java $(OTEL_OPTS) -Dotel.service.name=orchestrator -jar target/orchestrator-1.0.0-SNAPSHOT.jar'

orchestrator-test:
	@bash -c 'cd $(DIR_ORCHESTRATOR) && $(JAVA17_ENV) mvn test'

orchestrator-clean:
	@bash -c 'cd $(DIR_ORCHESTRATOR) && $(JAVA17_ENV) mvn clean $(MVN_QUIET)'

# ============================================
# Graph Service (Java)
# ============================================

graph-build:
	@bash -c 'cd $(DIR_GRAPH) && $(JAVA17_ENV) mvn package $(MVN_SKIP_TESTS) $(MVN_QUIET)'

graph-run:
	@bash -c '$(LOAD_ENV) cd $(DIR_GRAPH) && $(JAVA17_ENV) java -jar target/graph-service-1.0.0-SNAPSHOT.jar'

graph-run-otel: otel-download
	@bash -c '$(LOAD_ENV) cd $(DIR_GRAPH) && $(JAVA17_ENV) java $(OTEL_OPTS) -Dotel.service.name=graph-service -jar target/graph-service-1.0.0-SNAPSHOT.jar'

graph-test:
	@bash -c 'cd $(DIR_GRAPH) && $(JAVA17_ENV) mvn test'

graph-clean:
	@bash -c 'cd $(DIR_GRAPH) && $(JAVA17_ENV) mvn clean $(MVN_QUIET)'

# ============================================
# Stream Processor (Flink)
# ============================================

flink-build:
	@bash -c 'cd $(DIR_FLINK) && $(JAVA17_ENV) mvn package $(MVN_SKIP_TESTS) -Plocal $(MVN_QUIET)'

flink-run:
	@bash -c '$(LOAD_ENV) ./scripts/run-flink.sh'

flink-run-otel: otel-download
	@bash -c '$(LOAD_ENV) OTEL_ENABLED=true ./scripts/run-flink.sh'

flink-test:
	@bash -c 'cd $(DIR_FLINK) && $(JAVA17_ENV) mvn test'

flink-clean:
	@bash -c 'cd $(DIR_FLINK) && $(JAVA17_ENV) mvn clean $(MVN_QUIET)'

flink-stop:
	@tmux kill-session -t flink-stream 2>/dev/null || pkill -f "stream-processor.*\.jar" 2>/dev/null || true

# ============================================
# Batch Processor (Spark)
# ============================================

batch-build:
	@bash -c 'cd $(DIR_BATCH) && $(JAVA17_ENV) mvn package $(MVN_SKIP_TESTS) -Plocal $(MVN_QUIET)'

batch-test:
	@bash -c 'cd $(DIR_BATCH) && $(JAVA17_ENV) mvn test'

batch-clean:
	@bash -c 'cd $(DIR_BATCH) && $(JAVA17_ENV) mvn clean $(MVN_QUIET)'

batch-archive:
	@bash -c '$(LOAD_ENV) ./scripts/run-batch-processor.sh archive'

batch-features:
	@bash -c '$(LOAD_ENV) ./scripts/run-batch-processor.sh features'

batch-labels:
	@bash -c '$(LOAD_ENV) ./scripts/run-batch-processor.sh labels'

batch-training:
	@bash -c '$(LOAD_ENV) ./scripts/run-batch-processor.sh training'

batch-neo4j:
	@bash -c '$(LOAD_ENV) ./scripts/run-batch-processor.sh neo4j'

# ============================================
# Frontend (React)
# ============================================

frontend-build:
	@cd $(DIR_FRONTEND) && npm install && npm run build

frontend-run:
	@cd $(DIR_FRONTEND) && npm run dev

frontend-test:
	@cd $(DIR_FRONTEND) && npm test

frontend-clean:
	@rm -rf $(DIR_FRONTEND)/dist

# ============================================
# Batch Operations
# ============================================

build-all: ingestion-build query-build alert-build risk-build bff-build orchestrator-build graph-build flink-build batch-build frontend-build generator-build

test-all:
	@$(MAKE) query-test || true
	@$(MAKE) alert-test || true
	@$(MAKE) risk-test || true
	@$(MAKE) bff-test || true
	@$(MAKE) orchestrator-test || true
	@$(MAKE) graph-test || true

clean-all: ingestion-clean query-clean alert-clean risk-clean bff-clean orchestrator-clean graph-clean flink-clean batch-clean frontend-clean

# ============================================
# Local Service Runner
# ============================================

run-svc:
	@mkdir -p $(LOGS_DIR)
	@echo "🚀 Starting services..."
	@bash -c '$(LOAD_ENV) cd $(DIR_QUERY) && go run ./cmd/... > ../../$(LOGS_DIR)/query.log 2>&1 &'
	@bash -c '$(LOAD_ENV) cd $(DIR_RISK) && uv run uvicorn app.main:app --port 8082 > ../../$(LOGS_DIR)/risk.log 2>&1 &'
	@cd $(DIR_BFF) && npm run start:dev > ../../$(LOGS_DIR)/bff.log 2>&1 &
	@bash -c '$(LOAD_ENV) cd $(DIR_GRAPH) && $(JAVA17_ENV) java -jar target/graph-service-1.0.0-SNAPSHOT.jar > ../../$(LOGS_DIR)/graph.log 2>&1 &'
	@sleep 2
	@echo "✅ Services: Query(:8081) Risk(:8082) BFF(:3001) Graph(:8084)"

run-svc-otel: otel-download
	@mkdir -p $(LOGS_DIR)
	@bash -c '$(LOAD_ENV) cd $(DIR_QUERY) && go run ./cmd/... > ../../$(LOGS_DIR)/query.log 2>&1 &'
	@bash -c '$(LOAD_ENV) cd $(DIR_RISK) && uv run uvicorn app.main:app --port 8082 > ../../$(LOGS_DIR)/risk.log 2>&1 &'
	@cd $(DIR_BFF) && npm run start:dev > ../../$(LOGS_DIR)/bff.log 2>&1 &
	@bash -c '$(LOAD_ENV) cd $(DIR_GRAPH) && $(JAVA17_ENV) java $(OTEL_OPTS) -Dotel.service.name=graph-service -jar target/graph-service-1.0.0-SNAPSHOT.jar > ../../$(LOGS_DIR)/graph.log 2>&1 &'
	@sleep 2
	@echo "✅ Services with OTel started"

stop-svc:
	@pkill -f "query-service" 2>/dev/null || true
	@pkill -f "uvicorn app.main:app" 2>/dev/null || true
	@pkill -f "nest start" 2>/dev/null || true
	@pkill -f "graph-service" 2>/dev/null || true
	@echo "✅ Services stopped"

# ============================================
# E2E Tests
# ============================================

test-e2e: generator-build
	@bash -c '$(LOAD_ENV) ./tests/e2e/run_e2e.sh all'

test-e2e-pipeline: generator-build
	@bash -c '$(LOAD_ENV) ./tests/e2e/run_e2e.sh pipeline'

test-e2e-services:
	@bash -c '$(LOAD_ENV) ./tests/e2e/run_e2e.sh services'

test-integration:
	@bash -c '$(LOAD_ENV) ./scripts/test/run-integration-test.sh'

# ============================================
# Phase 10 Validation
# ============================================

validate-phase10:
	@./scripts/validate-phase10.sh

# ============================================
# Trino
# ============================================

trino:
	@bash -c '$(LOAD_ENV) ./scripts/trino-query.sh "$(Q)"'
