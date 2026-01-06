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

# ============================================
# Default target
# ============================================

help:
	@echo ""
	@echo "Chain Risk Platform - Available Commands"
	@echo "========================================="
	@echo ""
	@echo "📦 Infrastructure:"
	@echo "  make infra-up        Start infrastructure (docker-compose)"
	@echo "  make infra-down      Stop infrastructure"
	@echo "  make infra-check     Check infrastructure status"
	@echo "  make cleanup         Clean all data (Kafka, PostgreSQL, Neo4j, Hudi)"
	@echo ""
	@echo "🚀 Services:"
	@echo "  make run-svc         Run all backend services"
	@echo "  make stop-svc        Stop all backend services"
	@echo ""
	@echo "📊 Data Ingestion (Go):    ingestion-{build,run,test,clean}"
	@echo "🔍 Query Service (Go):     query-{build,run,test,clean}"
	@echo "⚠️  Alert Service (Go):     alert-{build,run,test,clean}"
	@echo "🤖 Risk ML Service (Py):   risk-{build,run,test,clean}"
	@echo "🌐 BFF Service (TS):       bff-{build,run,test,clean}"
	@echo "🚪 Orchestrator (Java):    orchestrator-{build,run,test,clean}"
	@echo "🔗 Graph Service (Java):   graph-{build,run,test,clean}"
	@echo ""
	@echo "⚡ Stream Processor (Flink):"
	@echo "  make flink-build     Build stream processor"
	@echo "  make flink-run       Run Flink job (tmux)"
	@echo "  make flink-stop      Stop Flink job"
	@echo ""
	@echo "📊 Batch Processor (Spark):"
	@echo "  make batch-build     Build batch processor"
	@echo "  make batch-archive   Archive PostgreSQL → Hudi"
	@echo "  make batch-features  Compute ML features"
	@echo "  make batch-labels    Ingest label data"
	@echo "  make batch-training  Prepare training dataset"
	@echo "  make batch-neo4j     Sync to Neo4j"
	@echo ""
	@echo "🧪 Testing:"
	@echo "  make test-integration         Full integration test"
	@echo "  make test-integration-phase1  Phase 1: Ingestion → Kafka"
	@echo "  make test-integration-phase2  Phase 2: Flink → PostgreSQL"
	@echo "  make test-integration-phase3  Phase 3: Batch → Hudi + Neo4j"
	@echo ""
	@echo "🔧 Batch Operations:"
	@echo "  make init-all        Initialize all services"
	@echo "  make build-all       Build all services"
	@echo "  make test-all        Test all services"
	@echo "  make clean-all       Clean all artifacts"
	@echo ""

# ============================================
# Infrastructure
# ============================================

infra-up:
	@echo "🚀 Starting infrastructure..."
	@docker-compose up -d
	@echo "✅ Infrastructure started"

infra-down:
	@echo "🛑 Stopping infrastructure..."
	@docker-compose down
	@echo "✅ Infrastructure stopped"

infra-check:
	@bash -c '$(LOAD_ENV) ./scripts/check-infra.sh'

cleanup:
	@bash -c '$(LOAD_ENV) ./scripts/cleanup.sh'

cleanup-all:
	@bash -c '$(LOAD_ENV) ./scripts/cleanup.sh --all -y'

# ============================================
# Data Ingestion (Go)
# ============================================

ingestion-build:
	@echo "🔨 Building data-ingestion..."
	@cd $(DIR_INGESTION) && mkdir -p bin && go build -o bin/ingestion ./cmd/ingestion
	@echo "✅ data-ingestion built"

ingestion-run:
	@bash -c '$(LOAD_ENV) cd $(DIR_INGESTION) && ./bin/ingestion'

ingestion-test:
	@cd $(DIR_INGESTION) && go test ./...

ingestion-clean:
	@rm -rf $(DIR_INGESTION)/bin

# ============================================
# Query Service (Go)
# ============================================

query-build:
	@echo "🔨 Building query-service..."
	@cd $(DIR_QUERY) && mkdir -p bin && go build -o bin/query ./cmd/...
	@echo "✅ query-service built"

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
	@echo "🔨 Building alert-service..."
	@cd $(DIR_ALERT) && mkdir -p bin && go build -o bin/alert ./cmd/...
	@echo "✅ alert-service built"

alert-run:
	@cd $(DIR_ALERT) && go run ./cmd/...

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
	@echo "🔨 Building orchestrator..."
	@bash -c 'cd $(DIR_ORCHESTRATOR) && $(JAVA17_ENV) mvn package $(MVN_SKIP_TESTS) $(MVN_QUIET)'
	@echo "✅ orchestrator built"

orchestrator-run:
	@bash -c '$(LOAD_ENV) cd $(DIR_ORCHESTRATOR) && $(JAVA17_ENV) mvn spring-boot:run'

orchestrator-test:
	@bash -c 'cd $(DIR_ORCHESTRATOR) && $(JAVA17_ENV) mvn test'

orchestrator-clean:
	@bash -c 'cd $(DIR_ORCHESTRATOR) && $(JAVA17_ENV) mvn clean $(MVN_QUIET)'

# ============================================
# Graph Service (Java)
# ============================================

graph-build:
	@echo "🔨 Building graph-service..."
	@bash -c 'cd $(DIR_GRAPH) && $(JAVA17_ENV) mvn package $(MVN_SKIP_TESTS) $(MVN_QUIET)'
	@echo "✅ graph-service built"

graph-run:
	@bash -c '$(LOAD_ENV) cd $(DIR_GRAPH) && $(JAVA17_ENV) java -jar target/graph-service-1.0.0-SNAPSHOT.jar'

graph-test:
	@bash -c 'cd $(DIR_GRAPH) && $(JAVA17_ENV) mvn test'

graph-clean:
	@bash -c 'cd $(DIR_GRAPH) && $(JAVA17_ENV) mvn clean $(MVN_QUIET)'

# ============================================
# Stream Processor (Flink)
# ============================================

flink-build:
	@echo "🔨 Building stream-processor..."
	@bash -c 'cd $(DIR_FLINK) && $(JAVA17_ENV) mvn package $(MVN_SKIP_TESTS) -Plocal $(MVN_QUIET)'
	@echo "✅ stream-processor built"

flink-run:
	@bash -c '$(LOAD_ENV) ./scripts/run-flink.sh'

flink-test:
	@bash -c 'cd $(DIR_FLINK) && $(JAVA17_ENV) mvn test'

flink-clean:
	@bash -c 'cd $(DIR_FLINK) && $(JAVA17_ENV) mvn clean $(MVN_QUIET)'

flink-stop:
	@echo "🛑 Stopping stream-processor..."
	@tmux kill-session -t flink-stream 2>/dev/null || pkill -f "stream-processor.*\.jar" 2>/dev/null || true
	@echo "✅ stream-processor stopped"

flink-logs:
	@tmux attach -t flink-stream 2>/dev/null || tail -f $(DIR_FLINK)/logs/*.log

# ============================================
# Batch Processor (Spark)
# ============================================

batch-build:
	@echo "🔨 Building batch-processor..."
	@bash -c 'cd $(DIR_BATCH) && $(JAVA17_ENV) mvn package $(MVN_SKIP_TESTS) -Plocal $(MVN_QUIET)'
	@echo "✅ batch-processor built"

batch-test:
	@bash -c 'cd $(DIR_BATCH) && $(JAVA17_ENV) mvn test'

batch-clean:
	@bash -c 'cd $(DIR_BATCH) && $(JAVA17_ENV) mvn clean $(MVN_QUIET)'

batch-archive:
	@bash -c '$(LOAD_ENV) ./scripts/run-batch-processor.sh archive'

batch-correct:
	@bash -c '$(LOAD_ENV) ./scripts/run-batch-processor.sh correct'

batch-features:
	@bash -c '$(LOAD_ENV) ./scripts/run-batch-processor.sh features'

batch-labels:
	@bash -c '$(LOAD_ENV) ./scripts/run-batch-processor.sh labels'

batch-training:
	@bash -c '$(LOAD_ENV) ./scripts/run-batch-processor.sh training'

batch-neo4j:
	@bash -c '$(LOAD_ENV) ./scripts/run-batch-processor.sh neo4j'

batch-stop:
	@pkill -f "batch-processor.*\.jar" 2>/dev/null || pkill -f "BatchProcessorApp" 2>/dev/null || true

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

init-all: ingestion-build query-build alert-build risk-build bff-build orchestrator-build graph-build flink-build batch-build frontend-build

build-all: init-all

test-all:
	@$(MAKE) ingestion-test || true
	@$(MAKE) query-test || true
	@$(MAKE) alert-test || true
	@$(MAKE) risk-test || true
	@$(MAKE) bff-test || true
	@$(MAKE) orchestrator-test || true
	@$(MAKE) graph-test || true
	@$(MAKE) flink-test || true
	@$(MAKE) batch-test || true
	@$(MAKE) frontend-test || true

clean-all: ingestion-clean query-clean alert-clean risk-clean bff-clean orchestrator-clean graph-clean flink-clean batch-clean frontend-clean

# ============================================
# Combined Service Commands
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
	@echo "   Logs: $(LOGS_DIR)/"

stop-svc:
	@echo "🛑 Stopping services..."
	@pkill -f "query-service" 2>/dev/null || true
	@pkill -f "uvicorn app.main:app" 2>/dev/null || true
	@pkill -f "nest start" 2>/dev/null || true
	@pkill -f "graph-service" 2>/dev/null || true
	@echo "✅ Services stopped"

logs-all:
	@tail -f $(LOGS_DIR)/*.log

# ============================================
# Integration Tests
# ============================================

test-integration:
	@bash -c '$(LOAD_ENV) ./scripts/test/run-integration-test.sh'

test-integration-phase1:
	@bash -c '$(LOAD_ENV) ./scripts/test/test-integration-phase1.sh'

test-integration-phase2:
	@bash -c '$(LOAD_ENV) ./scripts/test/test-integration-phase2.sh'

test-integration-phase3:
	@bash -c '$(LOAD_ENV) ./scripts/test/test-integration-phase3.sh'

mock-server-build:
	@cd tests/integration/mock_server && mkdir -p bin && go build -o bin/mock_server .

mock-server-run: mock-server-build
	@cd tests/integration/mock_server && ./bin/mock_server -fixtures ../fixtures/ethereum -port 8545

# ============================================
# Trino Query
# ============================================

trino:
	@bash -c '$(LOAD_ENV) ./scripts/trino-query.sh "$(Q)"'
