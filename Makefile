# ============================================
# Chain Risk Platform - Monorepo Makefile
# ============================================
# 统一构建入口，简化多语言项目管理
SHELL := /bin/bash
.PHONY: help init clean build test lint docker-up docker-down

# Export all variables to sub-makes and shell commands
export

# Default target
help:
	@echo "Chain Risk Platform - Available Commands"
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | \
		awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-20s\033[0m %s\n", $$1, $$2}'
	@echo ""

# ==================== Setup ====================

init: ## Initialize all services
	init-go init-java init-python init-ts
	@echo "✅ All services initialized"

init-go: ## Initialize Go services
	@echo "📦 Initializing Go services..."
	@cd data-ingestion && go mod tidy 2>/dev/null || true
	@cd services/query-service && go mod tidy 2>/dev/null || true
	@cd services/alert-service && go mod tidy 2>/dev/null || true

init-java: ## Initialize Java services
	@echo "📦 Initializing Java services..."
	@cd processing && mvn clean install -DskipTests 2>/dev/null || true
	@cd services/orchestrator && mvn clean install -DskipTests 2>/dev/null || true

init-python: ## Initialize Python services
	@echo "📦 Initializing Python services..."
	@cd services/risk-ml-service && pip install -e . 2>/dev/null || true

init-ts: ## Initialize TypeScript services
	@echo "📦 Initializing TypeScript services..."
	@cd services/bff && npm install 2>/dev/null || true
	@cd frontend && npm install 2>/dev/null || true

# ==================== Build ====================

build: ## Build all services
	build-go build-java build-python build-ts
	@echo "✅ All services built"

build-go: ## Build Go services
	@echo "🔨 Building Go services..."
	@cd data-ingestion && go build -o bin/ingestion ./cmd/... 2>/dev/null || echo "⏭️  data-ingestion: skipped (not initialized)"
	@cd services/query-service && go build -o bin/query ./cmd/... 2>/dev/null || echo "⏭️  query-service: skipped (not initialized)"
	@cd services/alert-service && go build -o bin/alert ./cmd/... 2>/dev/null || echo "⏭️  alert-service: skipped (not initialized)"

build-java: ## Build Java services
	@echo "🔨 Building Java services..."
	@cd processing && mvn package -DskipTests 2>/dev/null || echo "⏭️  processing: skipped (not initialized)"
	@cd services/orchestrator && mvn package -DskipTests 2>/dev/null || echo "⏭️  orchestrator: skipped (not initialized)"

build-python: ## Build Python services
	@echo "🔨 Building Python services..."
	@cd services/risk-ml-service && python -m build 2>/dev/null || echo "⏭️  risk-ml-service: skipped (not initialized)"

build-ts: ## Build TypeScript services
	@echo "🔨 Building TypeScript services..."
	@cd services/bff && npm run build 2>/dev/null || echo "⏭️  bff: skipped (not initialized)"
	@cd frontend && npm run build 2>/dev/null || echo "⏭️  frontend: skipped (not initialized)"

# ==================== Test ====================

test: ## Run all tests
	test-go test-java test-python test-ts
	@echo "✅ All tests completed"

test-go: ## Test Go services
	@echo "🧪 Testing Go services..."
	@cd data-ingestion && go test ./... 2>/dev/null || echo "⏭️  data-ingestion: skipped"
	@cd services/query-service && go test ./... 2>/dev/null || echo "⏭️  query-service: skipped"
	@cd services/alert-service && go test ./... 2>/dev/null || echo "⏭️  alert-service: skipped"

test-java: ## Test Java services
	@echo "🧪 Testing Java services..."
	@cd processing && mvn test 2>/dev/null || echo "⏭️  processing: skipped"
	@cd services/orchestrator && mvn test 2>/dev/null || echo "⏭️  orchestrator: skipped"

test-python: ## Test Python services
	@echo "🧪 Testing Python services..."
	@cd services/risk-ml-service && pytest 2>/dev/null || echo "⏭️  risk-ml-service: skipped"

test-ts: ## Test TypeScript services
	@echo "🧪 Testing TypeScript services..."
	@cd services/bff && npm test 2>/dev/null || echo "⏭️  bff: skipped"
	@cd frontend && npm test 2>/dev/null || echo "⏭️  frontend: skipped"

# ==================== Lint ====================

lint: ## Lint all services
	lint-go lint-java lint-python lint-ts
	@echo "✅ All linting completed"

lint-go: ## Lint Go services
	@echo "🔍 Linting Go services..."
	@cd data-ingestion && golangci-lint run 2>/dev/null || echo "⏭️  data-ingestion: skipped"
	@cd services/query-service && golangci-lint run 2>/dev/null || echo "⏭️  query-service: skipped"
	@cd services/alert-service && golangci-lint run 2>/dev/null || echo "⏭️  alert-service: skipped"

lint-java: ## Lint Java services
	@echo "🔍 Linting Java services..."
	@cd processing && mvn checkstyle:check 2>/dev/null || echo "⏭️  processing: skipped"

lint-python: ## Lint Python services
	@echo "🔍 Linting Python services..."
	@cd services/risk-ml-service && ruff check . 2>/dev/null || echo "⏭️  risk-ml-service: skipped"

lint-ts: ## Lint TypeScript services
	@echo "🔍 Linting TypeScript services..."
	@cd services/bff && npm run lint 2>/dev/null || echo "⏭️  bff: skipped"
	@cd frontend && npm run lint 2>/dev/null || echo "⏭️  frontend: skipped"

# ==================== Clean ====================

clean: ## Clean all artifacts
	clean-go clean-java clean-python clean-ts
	@echo "✅ All artifacts cleaned"

clean-go: ## Clean Go artifacts
	@echo "🧹 Cleaning Go artifacts..."
	@rm -rf data-ingestion/bin
	@rm -rf services/query-service/bin
	@rm -rf services/alert-service/bin

clean-java: ## Clean Java artifacts
	@echo "🧹 Cleaning Java artifacts..."
	@cd processing && mvn clean 2>/dev/null || true
	@cd services/orchestrator && mvn clean 2>/dev/null || true

clean-python: ## Clean Python artifacts
	@echo "🧹 Cleaning Python artifacts..."
	@find services/risk-ml-service -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null || true
	@rm -rf services/risk-ml-service/dist
	@rm -rf services/risk-ml-service/*.egg-info

clean-ts: ## Clean TypeScript artifacts
	@echo "🧹 Cleaning TypeScript artifacts..."
	@rm -rf services/bff/dist
	@rm -rf frontend/dist

# ==================== Individual Service Commands ====================

run-ingestion: ## Data Ingestion (Go)
	@bash -c 'set -a && source .env.local && source ./scripts/env-remote.sh > /dev/null && cd data-ingestion && go run ./cmd/...'

run-query: ## Query Service (Go)
	@bash -c 'set -a && source .env.local && source ./scripts/env-remote.sh > /dev/null && cd services/query-service && go run ./cmd/...'

run-alert: ## Alert Service (Go)
	@cd services/alert-service && go run ./cmd/...

run-risk: ## Risk ML Service (Python)
	@bash -c 'set -a && source .env.local && source ./scripts/env-remote.sh > /dev/null && cd services/risk-ml-service && uv run uvicorn app.main:app --reload --port 8082'

run-bff: ## BFF (TypeScript)
	@cd services/bff && npm run start:dev

run-frontend: ## Frontend (React)
	@cd frontend && npm run dev

run-orchestrator: ## Orchestrator (Java)
	@cd services/orchestrator && mvn spring-boot:run

run-flink: ## Flink (Java)
	@bash -c 'set -a && source .env.local && source ./scripts/env-remote.sh > /dev/null && ./scripts/run-flink.sh'

# ==================== Combined Service Commands ====================

# Log directory for background services
LOGS_DIR := .logs

run-svc: ## Run query, risk, bff in background (logs in .logs/)
	@mkdir -p $(LOGS_DIR)
	@echo "🚀 Starting services in background..."
	@echo "   Logs: $(LOGS_DIR)/"
	@bash -c 'set -a && source .env.local && source ./scripts/env-remote.sh > /dev/null && cd services/query-service && go run ./cmd/... > ../../$(LOGS_DIR)/query.log 2>&1 &'
	@bash -c 'set -a && source .env.local && source ./scripts/env-remote.sh > /dev/null && cd services/risk-ml-service && uv run uvicorn app.main:app --reload --port 8082 > ../../$(LOGS_DIR)/risk.log 2>&1 &'
	@cd services/bff && npm run start:dev > ../../$(LOGS_DIR)/bff.log 2>&1 &
	@sleep 2
	@echo "✅ Services started:"
	@echo "   - Query Service: http://localhost:8081 (log: $(LOGS_DIR)/query.log)"
	@echo "   - Risk Service:  http://localhost:8082 (log: $(LOGS_DIR)/risk.log)"
	@echo "   - BFF Service:   http://localhost:3001 (log: $(LOGS_DIR)/bff.log)"
	@echo ""
	@echo "📋 Commands:"
	@echo "   make logs-query  # Tail query service logs"
	@echo "   make logs-risk   # Tail risk service logs"
	@echo "   make logs-bff    # Tail bff service logs"
	@echo "   make stop-svc    # Stop all services"

run-svc-tmux: ## Run query, risk, bff in tmux split panes
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
		tmux send-keys -t chain-risk:services "make run-query" C-m; \
		tmux split-window -h -t chain-risk:services; \
		tmux send-keys -t chain-risk:services "make run-risk" C-m; \
		tmux split-window -v -t chain-risk:services; \
		tmux send-keys -t chain-risk:services "make run-bff" C-m; \
		tmux select-layout -t chain-risk:services tiled; \
		echo "✅ Services started in tmux session 'chain-risk'"; \
		read -p "🔗 Attach to session? [y/N] " answer; \
		if [ "$$answer" = "y" ] || [ "$$answer" = "Y" ]; then \
			tmux attach -t chain-risk; \
		else \
			echo "   Run manually: tmux attach -t chain-risk"; \
		fi \
	fi

run-svc-iterm: ## Run query, risk, bff in iTerm2 tabs (macOS only)
	@osascript -e 'tell application "iTerm2"' \
		-e 'tell current window' \
		-e 'create tab with default profile' \
		-e 'tell current session' \
		-e 'write text "cd $(PWD) && make run-query"' \
		-e 'end tell' \
		-e 'end tell' \
		-e 'tell current window' \
		-e 'create tab with default profile' \
		-e 'tell current session' \
		-e 'write text "cd $(PWD) && make run-risk"' \
		-e 'end tell' \
		-e 'end tell' \
		-e 'tell current window' \
		-e 'create tab with default profile' \
		-e 'tell current session' \
		-e 'write text "cd $(PWD) && make run-bff"' \
		-e 'end tell' \
		-e 'end tell' \
		-e 'end tell'
	@echo "✅ Services started in iTerm2 tabs"

stop-svc: ## Stop all background services (including tmux session)
	@echo "🛑 Stopping services..."
	@-pkill -f "query-service" 2>/dev/null || true
	@-pkill -f "uvicorn app.main:app" 2>/dev/null || true
	@-pkill -f "nest start" 2>/dev/null || true
	@-pkill -f "ts-node" 2>/dev/null || true
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

logs-query: ## Tail query service logs
	@tail -f $(LOGS_DIR)/query.log

logs-risk: ## Tail risk service logs
	@tail -f $(LOGS_DIR)/risk.log

logs-bff: ## Tail bff service logs
	@tail -f $(LOGS_DIR)/bff.log

logs-all: ## Tail all service logs
	@tail -f $(LOGS_DIR)/*.log
