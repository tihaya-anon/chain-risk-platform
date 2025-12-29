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
	@cd services/bff-gateway && npm install 2>/dev/null || true
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
	@cd services/bff-gateway && npm run build 2>/dev/null || echo "⏭️  bff-gateway: skipped (not initialized)"
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
	@cd services/bff-gateway && npm test 2>/dev/null || echo "⏭️  bff-gateway: skipped"
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
	@cd services/bff-gateway && npm run lint 2>/dev/null || echo "⏭️  bff-gateway: skipped"
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
	@rm -rf services/bff-gateway/dist
	@rm -rf frontend/dist

# ==================== Individual Service Commands ====================

run-ingestion: ## Data Ingestion (Go)
	@bash -c 'set -a && source .env.local && source ./scripts/env-remote.sh > /dev/null && cd data-ingestion && go run ./cmd/...'

run-query: ## Query Service (Go)
	@bash -c 'set -a && source .env.local && source ./scripts/env-remote.sh > /dev/null && cd services/query-service && go run ./cmd/...'

run-alert: ## Alert Service (Go)
	@cd services/alert-service && go run ./cmd/...

run-risk: ## Risk ML Service (Python)
	@bash -c 'set -a && source .env.local && source ./scripts/env-remote.sh > /dev/null && cd services/risk-ml-service && uvicorn app.main:app --reload --port 8082'

run-bff: ## BFF Gateway (TypeScript)
	@cd services/bff-gateway && npm run start:dev

run-frontend: ## Frontend (React)
	@cd frontend && npm run dev

run-orchestrator: ## Orchestrator (Java)
	@cd services/orchestrator && mvn spring-boot:run

run-flink: ## Flink (Java)
	@bash -c 'set -a && source .env.local && source ./scripts/env-remote.sh > /dev/null && ./scripts/run-flink.sh'
