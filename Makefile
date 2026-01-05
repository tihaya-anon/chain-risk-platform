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
DIR_GRAPH := processing/graph-engine
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
	@echo "  make infra-up          Start infrastructure (docker-compose)"
	@echo "  make infra-down        Stop infrastructure"
	@echo "  make infra-check       Check infrastructure status"
	@echo ""
	@echo "🚀 Run All Services:"
	@echo "  make run-svc           Run all backend services in background"
	@echo "  make run-svc-tmux      Run all backend services in tmux"
	@echo "  make run-svc-iterm     Run all backend services in iTerm2 tabs"
	@echo "  make stop-svc          Stop all backend services"
	@echo ""
	@echo "📊 Data Ingestion (Go):"
	@echo "  make ingestion-init    Initialize dependencies"
	@echo "  make ingestion-build   Build service"
	@echo "  make ingestion-run     Run service"
	@echo "  make ingestion-test    Run tests"
	@echo "  make ingestion-lint    Run linter"
	@echo "  make ingestion-clean   Clean artifacts"
	@echo ""
	@echo "🔍 Query Service (Go):"
	@echo "  make query-init        Initialize dependencies"
	@echo "  make query-build       Build service"
	@echo "  make query-run         Run service"
	@echo "  make query-test        Run tests"
	@echo "  make query-lint        Run linter"
	@echo "  make query-clean       Clean artifacts"
	@echo ""
	@echo "⚠️  Alert Service (Go):"
	@echo "  make alert-init        Initialize dependencies"
	@echo "  make alert-build       Build service"
	@echo "  make alert-run         Run service"
	@echo "  make alert-test        Run tests"
	@echo "  make alert-lint        Run linter"
	@echo "  make alert-clean       Clean artifacts"
	@echo ""
	@echo "🤖 Risk ML Service (Python):"
	@echo "  make risk-init         Initialize dependencies"
	@echo "  make risk-build        Build service"
	@echo "  make risk-run          Run service"
	@echo "  make risk-test         Run tests"
	@echo "  make risk-lint         Run linter"
	@echo "  make risk-clean        Clean artifacts"
	@echo ""
	@echo "🌐 BFF Service (TypeScript):"
	@echo "  make bff-init          Initialize dependencies"
	@echo "  make bff-build         Build service"
	@echo "  make bff-run           Run service"
	@echo "  make bff-test          Run tests"
	@echo "  make bff-lint          Run linter"
	@echo "  make bff-clean         Clean artifacts"
	@echo ""
	@echo "🚪 Orchestrator (Java):"
	@echo "  make orchestrator-init    Initialize dependencies"
	@echo "  make orchestrator-build   Build service"
	@echo "  make orchestrator-run     Run service"
	@echo "  make orchestrator-test    Run tests"
	@echo "  make orchestrator-clean   Clean artifacts"
	@echo ""
	@echo "🔗 Graph Engine (Java):"
	@echo "  make graph-init        Initialize dependencies"
	@echo "  make graph-build       Build service"
	@echo "  make graph-run         Run service"
	@echo "  make graph-test        Run tests"
	@echo "  make graph-clean       Clean artifacts"
	@echo ""
	@echo "⚡ Stream Processor (Java/Flink):"
	@echo "  make flink-init        Initialize dependencies"
	@echo "  make flink-build       Build service"
	@echo "  make flink-run         Run service"
	@echo "  make flink-test        Run tests"
	@echo "  make flink-clean       Clean artifacts"
	@echo ""
	@echo "📊 Batch Processor (Java/Spark + Hudi):"
	@echo "  make batch-init        Initialize dependencies"
	@echo "  make batch-build       Build service"
	@echo "  make batch-test        Run tests"
	@echo "  make batch-clean       Clean artifacts"
	@echo "  make batch-archive     Run archive job (PostgreSQL → Hudi)"
	@echo "  make batch-correct     Run batch correction job"
	@echo "  make batch-features    Compute ML features from transfers"
	@echo "  make batch-labels      Ingest label data (OFAC, Tornado, Exchange)"
	@echo "  make batch-training    Prepare training dataset"
	@echo "  make batch-stop        Stop running batch job"
	@echo ""
	@echo "🖥️  Frontend (React):"
	@echo "  make frontend-init     Initialize dependencies"
	@echo "  make frontend-build    Build service"
	@echo "  make frontend-run      Run service"
	@echo "  make frontend-test     Run tests"
	@echo "  make frontend-lint     Run linter"
	@echo "  make frontend-clean    Clean artifacts"
	@echo ""
	@echo "🔧 Batch Operations:"
	@echo "  make init-all          Initialize all services"
	@echo "  make build-all         Build all services"
	@echo "  make test-all          Test all services"
	@echo "  make lint-all          Lint all services"
	@echo "  make clean-all         Clean all artifacts"
	@echo ""
	@echo "📚 API Documentation:"
	@echo "  make api-update        Update all API specifications"
	@echo "  make api-update-query  Update Query Service API spec"
	@echo "  make api-update-bff    Update BFF API spec"
	@echo "  make api-update-risk   Update Risk ML Service API spec"
	@echo "  make api-update-orch   Update Orchestrator API spec"
	@echo "  make api-update-graph  Update Graph Engine API spec"
	@echo ""
	@echo "🧪 Integration Test:"
	@echo "  make test-integration  Run integration tests"
	@echo "  make mock-server-build Build mock Etherscan server"
	@echo "  make mock-server-run   Run mock server with fixtures"
	@echo "  make fixture-gen       Generate test fixtures from real API"
	@echo ""
	@echo "📋 Logs:"
	@echo "  make logs-query        Tail query service logs"
	@echo "  make logs-risk         Tail risk service logs"
	@echo "  make logs-bff          Tail bff service logs"
	@echo "  make logs-graph        Tail graph service logs"
	@echo "  make logs-all          Tail all service logs"
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

# ============================================
# Data Ingestion (Go)
# ============================================

ingestion-init:
	@echo "📦 Initializing data-ingestion..."
	@cd data-ingestion && go mod tidy
	@echo "✅ data-ingestion initialized"

ingestion-build:
	@echo "🔨 Building data-ingestion (production)..."
	@cd data-ingestion && go build -o bin/ingestion ./cmd/ingestion
	@cd data-ingestion && go build -o bin/fixture-gen ./cmd/fixture-gen
	@echo "✅ data-ingestion built"

ingestion-build-test:
	@echo "🔨 Building data-ingestion (test mode)..."
	@cd data-ingestion && go build -tags test_mode -o bin/ingestion-test ./cmd/ingestion
	@cd data-ingestion && go build -o bin/fixture-gen ./cmd/fixture-gen
	@echo "✅ data-ingestion built (test mode - Kafka disabled)"

ingestion-run:
	@bash -c 'set -a && source .env.local && source ./scripts/load-env.sh > /dev/null && cd data-ingestion && ./bin/ingestion'

ingestion-run-test:
	@bash -c 'set -a && source .env.local && source ./scripts/load-env.sh > /dev/null && cd data-ingestion && ./bin/ingestion-test'

ingestion-test:
	@echo "🧪 Testing data-ingestion..."
	@cd data-ingestion && go test ./...

ingestion-lint:
	@echo "🔍 Linting data-ingestion..."
	@cd data-ingestion && golangci-lint run

ingestion-clean:
	@echo "🧹 Cleaning data-ingestion..."
	@rm -rf data-ingestion/bin
	@echo "✅ data-ingestion cleaned"

# ============================================
# Query Service (Go)
# ============================================

query-init:
	@echo "📦 Initializing query-service..."
	@cd services/query-service && go mod tidy
	@echo "✅ query-service initialized"

query-build:
	@echo "🔨 Building query-service..."
	@cd services/query-service && go build -o bin/query ./cmd/...
	@echo "✅ query-service built"

query-run:
	@bash -c 'set -a && source .env.local && source ./scripts/load-env.sh > /dev/null && cd services/query-service && go run ./cmd/...'

query-test:
	@echo "🧪 Testing query-service..."
	@cd services/query-service && go test ./...

query-lint:
	@echo "🔍 Linting query-service..."
	@cd services/query-service && golangci-lint run

query-clean:
	@echo "🧹 Cleaning query-service..."
	@rm -rf services/query-service/bin
	@echo "✅ query-service cleaned"

# ============================================
# Alert Service (Go)
# ============================================

alert-init:
	@echo "📦 Initializing alert-service..."
	@cd services/alert-service && go mod tidy
	@echo "✅ alert-service initialized"

alert-build:
	@echo "🔨 Building alert-service..."
	@cd services/alert-service && go build -o bin/alert ./cmd/...
	@echo "✅ alert-service built"

alert-run:
	@cd services/alert-service && go run ./cmd/...

alert-test:
	@echo "🧪 Testing alert-service..."
	@cd services/alert-service && go test ./...

alert-lint:
	@echo "🔍 Linting alert-service..."
	@cd services/alert-service && golangci-lint run

alert-clean:
	@echo "🧹 Cleaning alert-service..."
	@rm -rf services/alert-service/bin
	@echo "✅ alert-service cleaned"

# ============================================
# Risk ML Service (Python)
# ============================================

risk-init:
	@echo "📦 Initializing risk-ml-service..."
	@cd services/risk-ml-service && uv sync
	@echo "✅ risk-ml-service initialized"

risk-build:
	@echo "🔨 Building risk-ml-service..."
	@cd services/risk-ml-service && uv build
	@echo "✅ risk-ml-service built"

risk-run:
	@bash -c 'set -a && source .env.local && source ./scripts/load-env.sh > /dev/null && cd services/risk-ml-service && uv run uvicorn app.main:app --reload --port 8082'

risk-test:
	@echo "🧪 Testing risk-ml-service..."
	@cd services/risk-ml-service && uv run pytest

risk-lint:
	@echo "🔍 Linting risk-ml-service..."
	@cd services/risk-ml-service && uv run ruff check .

risk-clean:
	@echo "🧹 Cleaning risk-ml-service..."
	@find services/risk-ml-service -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null || true
	@rm -rf services/risk-ml-service/dist
	@rm -rf services/risk-ml-service/*.egg-info
	@echo "✅ risk-ml-service cleaned"

# ============================================
# BFF Service (TypeScript)
# ============================================

bff-init:
	@echo "📦 Initializing bff..."
	@cd services/bff && npm install
	@echo "✅ bff initialized"

bff-build:
	@echo "🔨 Building bff..."
	@cd services/bff && npm run build
	@echo "✅ bff built"

bff-run:
	@bash -c 'set -a && source .env.local && source ./scripts/load-env.sh > /dev/null && cd services/bff && npm run start:dev'

bff-test:
	@echo "🧪 Testing bff..."
	@cd services/bff && npm test

bff-lint:
	@echo "🔍 Linting bff..."
	@cd services/bff && npm run lint

bff-clean:
	@echo "🧹 Cleaning bff..."
	@rm -rf services/bff/dist
	@echo "✅ bff cleaned"

# ============================================
# Orchestrator (Java)
# ============================================

orchestrator-init:
	@echo "📦 Initializing orchestrator..."
	@bash -c 'cd $(DIR_ORCHESTRATOR) && $(JAVA17_ENV) mvn clean install $(MVN_SKIP_TESTS) $(MVN_QUIET)'
	@echo "✅ orchestrator initialized"

orchestrator-build:
	@echo "🔨 Building orchestrator..."
	@bash -c 'cd $(DIR_ORCHESTRATOR) && $(JAVA17_ENV) mvn package $(MVN_SKIP_TESTS) $(MVN_QUIET)'
	@echo "✅ orchestrator built"

orchestrator-run:
	@bash -c '$(LOAD_ENV) cd $(DIR_ORCHESTRATOR) && $(JAVA17_ENV) mvn spring-boot:run'

orchestrator-test:
	@echo "🧪 Testing orchestrator..."
	@bash -c 'cd $(DIR_ORCHESTRATOR) && $(JAVA17_ENV) mvn test'

orchestrator-clean:
	@echo "🧹 Cleaning orchestrator..."
	@bash -c 'cd $(DIR_ORCHESTRATOR) && $(JAVA17_ENV) mvn clean $(MVN_QUIET)'
	@echo "✅ orchestrator cleaned"

# ============================================
# Graph Engine (Java)
# ============================================

graph-init:
	@echo "📦 Initializing graph-engine..."
	@bash -c 'cd $(DIR_GRAPH) && $(JAVA17_ENV) mvn clean install $(MVN_SKIP_TESTS) $(MVN_QUIET)'
	@echo "✅ graph-engine initialized"

graph-build:
	@echo "🔨 Building graph-engine..."
	@bash -c 'cd $(DIR_GRAPH) && $(JAVA17_ENV) mvn package $(MVN_SKIP_TESTS) $(MVN_QUIET)'
	@echo "✅ graph-engine built"

graph-run:
	@bash -c '$(LOAD_ENV) ./scripts/run-graph-engine.sh'

graph-test:
	@echo "🧪 Testing graph-engine..."
	@bash -c 'cd $(DIR_GRAPH) && $(JAVA17_ENV) mvn test'

graph-clean:
	@echo "🧹 Cleaning graph-engine..."
	@bash -c 'cd $(DIR_GRAPH) && $(JAVA17_ENV) mvn clean $(MVN_QUIET)'
	@echo "✅ graph-engine cleaned"

graph-stop:
	@echo "🛑 Stopping graph-engine..."
	@-pkill -f "graph-engine.*\.jar" 2>/dev/null || true
	@sleep 1
	@-pkill -9 -f "graph-engine.*\.jar" 2>/dev/null || true
	@echo "✅ graph-engine stopped"

# ============================================
# Stream Processor (Java/Flink)
# ============================================

flink-init:
	@echo "📦 Initializing stream-processor..."
	@bash -c 'cd $(DIR_FLINK) && $(JAVA17_ENV) mvn clean install $(MVN_SKIP_TESTS) $(MVN_QUIET)'
	@echo "✅ stream-processor initialized"

flink-build:
	@echo "🔨 Building stream-processor..."
	@bash -c 'cd $(DIR_FLINK) && $(JAVA17_ENV) mvn package $(MVN_SKIP_TESTS) $(MVN_QUIET)'
	@echo "✅ stream-processor built"

flink-run:
	@bash -c '$(LOAD_ENV) ./scripts/run-flink.sh'

flink-test:
	@echo "🧪 Testing stream-processor..."
	@bash -c 'cd $(DIR_FLINK) && $(JAVA17_ENV) mvn test'

flink-clean:
	@echo "🧹 Cleaning stream-processor..."
	@bash -c 'cd $(DIR_FLINK) && $(JAVA17_ENV) mvn clean $(MVN_QUIET)'
	@echo "✅ stream-processor cleaned"

flink-stop:
	@echo "🛑 Stopping stream-processor..."
	@if command -v tmux >/dev/null 2>&1 && tmux has-session -t flink-stream 2>/dev/null; then \
		tmux kill-session -t flink-stream; \
		echo "✅ Stopped tmux session 'flink-stream'"; \
	else \
		pkill -f "stream-processor.*\.jar" 2>/dev/null || true; \
		sleep 1; \
		pkill -9 -f "stream-processor.*\.jar" 2>/dev/null || true; \
		echo "✅ stream-processor stopped"; \
	fi

flink-logs:
	@if command -v tmux >/dev/null 2>&1 && tmux has-session -t flink-stream 2>/dev/null; then \
		tmux attach -t flink-stream; \
	else \
		tail -f $(DIR_FLINK)/logs/stream-processor.log 2>/dev/null || echo "❌ No logs found"; \
	fi

# ============================================
# Batch Processor (Java/Spark + Hudi)
# ============================================

batch-init:
	@echo "📦 Initializing batch-processor..."
	@bash -c 'cd $(DIR_BATCH) && $(JAVA17_ENV) mvn clean install $(MVN_SKIP_TESTS) $(MVN_QUIET)'
	@echo "✅ batch-processor initialized"

batch-build:
	@echo "🔨 Building batch-processor..."
	@bash -c 'cd $(DIR_BATCH) && $(JAVA17_ENV) mvn package $(MVN_SKIP_TESTS) -Plocal $(MVN_QUIET)'
	@echo "✅ batch-processor built"

batch-test:
	@echo "🧪 Testing batch-processor..."
	@bash -c 'cd $(DIR_BATCH) && $(JAVA17_ENV) mvn test'

batch-clean:
	@echo "🧹 Cleaning batch-processor..."
	@bash -c 'cd $(DIR_BATCH) && $(JAVA17_ENV) mvn clean $(MVN_QUIET)'
	@echo "✅ batch-processor cleaned"

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

batch-run: batch-archive batch-correct

batch-stop:
	@echo "🛑 Stopping batch-processor..."
	@-pkill -f "batch-processor.*\.jar" 2>/dev/null || true
	@-pkill -f "BatchProcessorApp" 2>/dev/null || true
	@echo "✅ batch-processor stopped"

batch-logs:
	@tail -f logs/batch-processor-*.log 2>/dev/null || echo "❌ No logs found"

# ============================================
# Frontend (React)
# ============================================

frontend-init:
	@echo "📦 Initializing frontend..."
	@cd frontend && npm install
	@echo "✅ frontend initialized"

frontend-build:
	@echo "🔨 Building frontend..."
	@cd frontend && npm run build
	@echo "✅ frontend built"

frontend-run:
	@cd frontend && npm run dev

frontend-test:
	@echo "🧪 Testing frontend..."
	@cd frontend && npm test

frontend-lint:
	@echo "🔍 Linting frontend..."
	@cd frontend && npm run lint

frontend-clean:
	@echo "🧹 Cleaning frontend..."
	@rm -rf frontend/dist
	@echo "✅ frontend cleaned"

# ============================================
# Batch Operations
# ============================================

init-all:
	@echo "📦 Initializing all services..."
	@$(MAKE) ingestion-init || true
	@$(MAKE) query-init || true
	@$(MAKE) alert-init || true
	@$(MAKE) risk-init || true
	@$(MAKE) bff-init || true
	@$(MAKE) orchestrator-init || true
	@$(MAKE) graph-init || true
	@$(MAKE) flink-init || true
	@$(MAKE) batch-init || true
	@$(MAKE) frontend-init || true
	@echo "✅ All services initialized"

build-all:
	@echo "🔨 Building all services..."
	@$(MAKE) ingestion-build || echo "⏭️  ingestion: skipped"
	@$(MAKE) query-build || echo "⏭️  query: skipped"
	@$(MAKE) alert-build || echo "⏭️  alert: skipped"
	@$(MAKE) risk-build || echo "⏭️  risk: skipped"
	@$(MAKE) bff-build || echo "⏭️  bff: skipped"
	@$(MAKE) orchestrator-build || echo "⏭️  orchestrator: skipped"
	@$(MAKE) graph-build || echo "⏭️  graph: skipped"
	@$(MAKE) flink-build || echo "⏭️  flink: skipped"
	@$(MAKE) batch-build || echo "⏭️  batch: skipped"
	@$(MAKE) frontend-build || echo "⏭️  frontend: skipped"
	@echo "✅ All services built"

test-all:
	@echo "🧪 Testing all services..."
	@$(MAKE) ingestion-test || echo "⏭️  ingestion: skipped"
	@$(MAKE) query-test || echo "⏭️  query: skipped"
	@$(MAKE) alert-test || echo "⏭️  alert: skipped"
	@$(MAKE) risk-test || echo "⏭️  risk: skipped"
	@$(MAKE) bff-test || echo "⏭️  bff: skipped"
	@$(MAKE) orchestrator-test || echo "⏭️  orchestrator: skipped"
	@$(MAKE) graph-test || echo "⏭️  graph: skipped"
	@$(MAKE) flink-test || echo "⏭️  flink: skipped"
	@$(MAKE) batch-test || echo "⏭️  batch: skipped"
	@$(MAKE) frontend-test || echo "⏭️  frontend: skipped"
	@echo "✅ All tests completed"

lint-all:
	@echo "🔍 Linting all services..."
	@$(MAKE) ingestion-lint || echo "⏭️  ingestion: skipped"
	@$(MAKE) query-lint || echo "⏭️  query: skipped"
	@$(MAKE) alert-lint || echo "⏭️  alert: skipped"
	@$(MAKE) risk-lint || echo "⏭️  risk: skipped"
	@$(MAKE) bff-lint || echo "⏭️  bff: skipped"
	@$(MAKE) frontend-lint || echo "⏭️  frontend: skipped"
	@echo "✅ All linting completed"

clean-all:
	@echo "🧹 Cleaning all artifacts..."
	@$(MAKE) ingestion-clean || true
	@$(MAKE) query-clean || true
	@$(MAKE) alert-clean || true
	@$(MAKE) risk-clean || true
	@$(MAKE) bff-clean || true
	@$(MAKE) orchestrator-clean || true
	@$(MAKE) graph-clean || true
	@$(MAKE) flink-clean || true
	@$(MAKE) batch-clean || true
	@$(MAKE) frontend-clean || true
	@echo "✅ All artifacts cleaned"

# ============================================
# Combined Service Commands
# ============================================

run-svc:
	@mkdir -p $(LOGS_DIR)
	@echo "🚀 Starting services in background..."
	@echo "   Logs: $(LOGS_DIR)/"
	@bash -c '$(LOAD_ENV) cd $(DIR_QUERY) && go run ./cmd/... > ../../$(LOGS_DIR)/query.log 2>&1 &'
	@bash -c '$(LOAD_ENV) cd $(DIR_RISK) && uv run uvicorn app.main:app --reload --port 8082 > ../../$(LOGS_DIR)/risk.log 2>&1 &'
	@cd $(DIR_BFF) && npm run start:dev > ../../$(LOGS_DIR)/bff.log 2>&1 &
	@bash -c '$(LOAD_ENV) ./scripts/run-graph-engine.sh > $(LOGS_DIR)/graph.log 2>&1 &'
	@sleep 2
	@echo "✅ Services started:"
	@echo "   - Query Service:  http://localhost:8081 (log: $(LOGS_DIR)/query.log)"
	@echo "   - Risk Service:   http://localhost:8082 (log: $(LOGS_DIR)/risk.log)"
	@echo "   - BFF Service:    http://localhost:3001 (log: $(LOGS_DIR)/bff.log)"
	@echo "   - Graph Engine:   http://localhost:8084 (log: $(LOGS_DIR)/graph.log)"
	@echo ""
	@echo "📋 Commands:"
	@echo "   make logs-all     # Tail all service logs"
	@echo "   make stop-svc     # Stop all services"

run-svc-tmux:
	@command -v tmux >/dev/null 2>&1 || { echo "❌ tmux not installed. Run: brew install tmux"; exit 1; }
	@if tmux has-session -t chain-risk 2>/dev/null; then \
		echo "✅ tmux session 'chain-risk' already exists"; \
		read -p "🔗 Attach to session? [y/N] " answer; \
		if [ "$$answer" = "y" ] || [ "$$answer" = "Y" ]; then \
			tmux attach -t chain-risk; \
		else \
			echo "   Run manually: tmux attach -t chain-risk"; \
		fi \
	else \
		tmux new-session -d -s chain-risk -n services; \
		tmux send-keys -t chain-risk:services "make query-run" C-m; \
		tmux split-window -h -t chain-risk:services; \
		tmux send-keys -t chain-risk:services "make risk-run" C-m; \
		tmux split-window -v -t chain-risk:services; \
		tmux send-keys -t chain-risk:services "make bff-run" C-m; \
		tmux select-pane -t chain-risk:services.0; \
		tmux split-window -v -t chain-risk:services; \
		tmux send-keys -t chain-risk:services "make graph-run" C-m; \
		tmux select-layout -t chain-risk:services tiled; \
		echo "✅ Services started in tmux session 'chain-risk'"; \
		read -p "🔗 Attach to session? [y/N] " answer; \
		if [ "$$answer" = "y" ] || [ "$$answer" = "Y" ]; then \
			tmux attach -t chain-risk; \
		else \
			echo "   Run manually: tmux attach -t chain-risk"; \
		fi \
	fi

run-svc-iterm:
	@osascript -e 'tell application "iTerm2"' \
		-e 'tell current window' \
		-e 'create tab with default profile' \
		-e 'tell current session' \
		-e 'write text "cd $(PWD) && make query-run"' \
		-e 'end tell' \
		-e 'end tell' \
		-e 'tell current window' \
		-e 'create tab with default profile' \
		-e 'tell current session' \
		-e 'write text "cd $(PWD) && make risk-run"' \
		-e 'end tell' \
		-e 'end tell' \
		-e 'tell current window' \
		-e 'create tab with default profile' \
		-e 'tell current session' \
		-e 'write text "cd $(PWD) && make bff-run"' \
		-e 'end tell' \
		-e 'end tell' \
		-e 'tell current window' \
		-e 'create tab with default profile' \
		-e 'tell current session' \
		-e 'write text "cd $(PWD) && make graph-run"' \
		-e 'end tell' \
		-e 'end tell' \
		-e 'end tell'
	@echo "✅ Services started in iTerm2 tabs"

stop-svc:
	@echo "🛑 Stopping services..."
	@-pkill -f "query-service" 2>/dev/null || true
	@-pkill -f "uvicorn app.main:app" 2>/dev/null || true
	@-pkill -f "nest start" 2>/dev/null || true
	@-pkill -f "ts-node" 2>/dev/null || true
	@-pkill -f "graph-engine" 2>/dev/null || true
	@-pkill -f "stream-processor.*\.jar" 2>/dev/null || true
	@-pkill -f "batch-processor.*\.jar" 2>/dev/null || true
	@echo "✅ Services stopped"
	@if tmux has-session -t chain-risk 2>/dev/null; then \
		read -p "🗑️  Kill tmux session 'chain-risk'? [y/N] " answer; \
		if [ "$$answer" = "y" ] || [ "$$answer" = "Y" ]; then \
			tmux kill-session -t chain-risk; \
			echo "✅ tmux session killed"; \
		else \
			echo "   tmux session kept. Run manually: tmux kill-session -t chain-risk"; \
		fi \
	fi

stop-query:
	@echo "🛑 Stopping query service..."
	@-pkill -f "query-service" 2>/dev/null || true
	@echo "✅ query service stopped"

stop-risk:
	@echo "🛑 Stopping risk service..."
	@-pkill -f "uvicorn app.main:app" 2>/dev/null || true
	@echo "✅ risk service stopped"

stop-bff:
	@echo "🛑 Stopping bff service..."
	@-pkill -f "nest start" 2>/dev/null || true
	@-pkill -f "ts-node" 2>/dev/null || true
	@echo "✅ bff service stopped"

stop-alert:
	@echo "🛑 Stopping alert service..."
	@-pkill -f "alert-service" 2>/dev/null || true
	@echo "✅ alert service stopped"

stop-ingestion:
	@echo "🛑 Stopping data ingestion..."
	@-pkill -f "data-ingestion" 2>/dev/null || true
	@echo "✅ data ingestion stopped"

# ============================================
# Logs
# ============================================

logs-query:
	@tail -f $(LOGS_DIR)/query.log

logs-risk:
	@tail -f $(LOGS_DIR)/risk.log

logs-bff:
	@tail -f $(LOGS_DIR)/bff.log

logs-graph:
	@tail -f $(LOGS_DIR)/graph.log

logs-all:
	@tail -f $(LOGS_DIR)/*.log

# ============================================
# API Documentation
# ============================================

api-update:
	@./scripts/update-api-specs.sh --all

api-update-query:
	@./scripts/update-api-specs.sh --query

api-update-bff:
	@./scripts/update-api-specs.sh --bff

api-update-risk:
	@./scripts/update-api-specs.sh --risk

api-update-orch:
	@./scripts/update-api-specs.sh --orchestrator

api-update-graph:
	@./scripts/update-api-specs.sh --graph

# ============================================
# Integration Test
# ============================================

test-integration:
	@bash -c 'set -a && source .env.local && source ./scripts/load-env.sh > /dev/null && ./scripts/run-integration-test.sh'

test-integration-phase1:
	@bash -c 'set -a && source .env.local && source ./scripts/load-env.sh > /dev/null && ./scripts/test-integration-phase1.sh'

test-integration-phase2:
	@bash -c 'set -a && source .env.local && source ./scripts/load-env.sh > /dev/null && ./scripts/test-integration-phase2.sh'

test-integration-phase3:
	@bash -c 'set -a && source .env.local && source ./scripts/load-env.sh > /dev/null && ./scripts/test-integration-phase3.sh'

mock-server-build:
	@echo "🔨 Building mock server..."
	@cd tests/integration/mock_server && mkdir -p bin && go build -o bin/mock_server .
	@echo "✅ Mock server built: tests/integration/mock_server/bin/mock_server"

mock-server-run: mock-server-build
	@echo "🚀 Starting mock server..."
	@cd tests/integration/mock_server && ./bin/mock_server -fixtures ../fixtures/ethereum -port 8545

fixture-gen-build:
	@echo "🔨 Building fixture-gen..."
	@cd data-ingestion && go build -o bin/fixture-gen ./cmd/fixture-gen
	@echo "✅ fixture-gen built: data-ingestion/bin/fixture-gen"

fixture-gen: fixture-gen-build
	@echo "📥 Generating test fixtures..."
	@bash -c 'set -a && source .env.local && cd data-ingestion && ./bin/fixture-gen \
		-network ethereum \
		-output ../tests/integration/fixtures \
		-latest 3 \
		-rate-limit 5 \
		-verbose'
	@echo "✅ Fixtures generated in tests/integration/fixtures/ethereum/"
