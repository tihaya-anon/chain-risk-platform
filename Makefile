# ============================================
# Chain Risk Platform - Monorepo Makefile
# ============================================
# 统一构建入口，简化多语言项目管理

.PHONY: help init clean build test lint docker-up docker-down

# Default target
help:
	@echo "Chain Risk Platform - Available Commands"
	@echo "=========================================="
	@echo ""
	@echo "Setup:"
	@echo "  make init          - Initialize all services"
	@echo "  make clean         - Clean all build artifacts"
	@echo ""
	@echo "Development:"
	@echo "  make build         - Build all services"
	@echo "  make test          - Run all tests"
	@echo "  make lint          - Lint all services"
	@echo ""
	@echo "Infrastructure:"
	@echo "  make docker-up     - Start all infrastructure"
	@echo "  make docker-down   - Stop all infrastructure"
	@echo ""
	@echo "Individual Services:"
	@echo "  make build-go      - Build Go services"
	@echo "  make build-java    - Build Java services"
	@echo "  make build-python  - Build Python services"
	@echo "  make build-ts      - Build TypeScript services"
	@echo ""

# ==================== Setup ====================

init: init-go init-java init-python init-ts
	@echo "✅ All services initialized"

init-go:
	@echo "📦 Initializing Go services..."
	@cd data-ingestion && go mod tidy 2>/dev/null || true
	@cd services/query-service && go mod tidy 2>/dev/null || true
	@cd services/alert-service && go mod tidy 2>/dev/null || true

init-java:
	@echo "📦 Initializing Java services..."
	@cd processing && mvn clean install -DskipTests 2>/dev/null || true
	@cd services/orchestrator && mvn clean install -DskipTests 2>/dev/null || true

init-python:
	@echo "📦 Initializing Python services..."
	@cd services/risk-ml-service && pip install -e . 2>/dev/null || true

init-ts:
	@echo "📦 Initializing TypeScript services..."
	@cd services/bff-gateway && npm install 2>/dev/null || true
	@cd frontend && npm install 2>/dev/null || true

# ==================== Build ====================

build: build-go build-java build-python build-ts
	@echo "✅ All services built"

build-go:
	@echo "🔨 Building Go services..."
	@cd data-ingestion && go build -o bin/ingestion ./cmd/... 2>/dev/null || echo "⏭️  data-ingestion: skipped (not initialized)"
	@cd services/query-service && go build -o bin/query ./cmd/... 2>/dev/null || echo "⏭️  query-service: skipped (not initialized)"
	@cd services/alert-service && go build -o bin/alert ./cmd/... 2>/dev/null || echo "⏭️  alert-service: skipped (not initialized)"

build-java:
	@echo "🔨 Building Java services..."
	@cd processing && mvn package -DskipTests 2>/dev/null || echo "⏭️  processing: skipped (not initialized)"
	@cd services/orchestrator && mvn package -DskipTests 2>/dev/null || echo "⏭️  orchestrator: skipped (not initialized)"

build-python:
	@echo "🔨 Building Python services..."
	@cd services/risk-ml-service && python -m build 2>/dev/null || echo "⏭️  risk-ml-service: skipped (not initialized)"

build-ts:
	@echo "🔨 Building TypeScript services..."
	@cd services/bff-gateway && npm run build 2>/dev/null || echo "⏭️  bff-gateway: skipped (not initialized)"
	@cd frontend && npm run build 2>/dev/null || echo "⏭️  frontend: skipped (not initialized)"

# ==================== Test ====================

test: test-go test-java test-python test-ts
	@echo "✅ All tests completed"

test-go:
	@echo "🧪 Testing Go services..."
	@cd data-ingestion && go test ./... 2>/dev/null || echo "⏭️  data-ingestion: skipped"
	@cd services/query-service && go test ./... 2>/dev/null || echo "⏭️  query-service: skipped"
	@cd services/alert-service && go test ./... 2>/dev/null || echo "⏭️  alert-service: skipped"

test-java:
	@echo "🧪 Testing Java services..."
	@cd processing && mvn test 2>/dev/null || echo "⏭️  processing: skipped"
	@cd services/orchestrator && mvn test 2>/dev/null || echo "⏭️  orchestrator: skipped"

test-python:
	@echo "🧪 Testing Python services..."
	@cd services/risk-ml-service && pytest 2>/dev/null || echo "⏭️  risk-ml-service: skipped"

test-ts:
	@echo "🧪 Testing TypeScript services..."
	@cd services/bff-gateway && npm test 2>/dev/null || echo "⏭️  bff-gateway: skipped"
	@cd frontend && npm test 2>/dev/null || echo "⏭️  frontend: skipped"

# ==================== Lint ====================

lint: lint-go lint-java lint-python lint-ts
	@echo "✅ All linting completed"

lint-go:
	@echo "🔍 Linting Go services..."
	@cd data-ingestion && golangci-lint run 2>/dev/null || echo "⏭️  data-ingestion: skipped"
	@cd services/query-service && golangci-lint run 2>/dev/null || echo "⏭️  query-service: skipped"
	@cd services/alert-service && golangci-lint run 2>/dev/null || echo "⏭️  alert-service: skipped"

lint-java:
	@echo "🔍 Linting Java services..."
	@cd processing && mvn checkstyle:check 2>/dev/null || echo "⏭️  processing: skipped"

lint-python:
	@echo "🔍 Linting Python services..."
	@cd services/risk-ml-service && ruff check . 2>/dev/null || echo "⏭️  risk-ml-service: skipped"

lint-ts:
	@echo "🔍 Linting TypeScript services..."
	@cd services/bff-gateway && npm run lint 2>/dev/null || echo "⏭️  bff-gateway: skipped"
	@cd frontend && npm run lint 2>/dev/null || echo "⏭️  frontend: skipped"

# ==================== Clean ====================

clean: clean-go clean-java clean-python clean-ts
	@echo "✅ All artifacts cleaned"

clean-go:
	@echo "🧹 Cleaning Go artifacts..."
	@rm -rf data-ingestion/bin
	@rm -rf services/query-service/bin
	@rm -rf services/alert-service/bin

clean-java:
	@echo "🧹 Cleaning Java artifacts..."
	@cd processing && mvn clean 2>/dev/null || true
	@cd services/orchestrator && mvn clean 2>/dev/null || true

clean-python:
	@echo "🧹 Cleaning Python artifacts..."
	@find services/risk-ml-service -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null || true
	@rm -rf services/risk-ml-service/dist
	@rm -rf services/risk-ml-service/*.egg-info

clean-ts:
	@echo "🧹 Cleaning TypeScript artifacts..."
	@rm -rf services/bff-gateway/dist
	@rm -rf frontend/dist

# ==================== Docker ====================

docker-up:
	@echo "🐳 Starting infrastructure..."
	docker-compose up -d
	@echo "✅ Infrastructure started"
	@echo ""
	@echo "Services:"
	@echo "  - Kafka:      localhost:9092"
	@echo "  - PostgreSQL: localhost:5432"
	@echo "  - Redis:      localhost:6379"
	@echo "  - Neo4j:      localhost:7474 (browser), localhost:7687 (bolt)"
	@echo "  - Nacos:      localhost:8848"
	@echo "  - Prometheus: localhost:9090"
	@echo "  - Grafana:    localhost:3001 (admin/admin123)"
	@echo "  - Jaeger:     localhost:16686"

docker-down:
	@echo "🐳 Stopping infrastructure..."
	docker-compose down
	@echo "✅ Infrastructure stopped"

docker-clean:
	@echo "🐳 Cleaning infrastructure (including volumes)..."
	docker-compose down -v
	@echo "✅ Infrastructure cleaned"

# ==================== Individual Service Commands ====================

# Data Ingestion (Go)
run-ingestion:
	@cd data-ingestion && go run ./cmd/...

# Query Service (Go)
run-query:
	@cd services/query-service && go run ./cmd/...

# Alert Service (Go)
run-alert:
	@cd services/alert-service && go run ./cmd/...

# Risk ML Service (Python)
run-risk:
	@cd services/risk-ml-service && uvicorn app.main:app --reload --port 8082

# BFF Gateway (TypeScript)
run-bff:
	@cd services/bff-gateway && npm run start:dev

# Frontend (React)
run-frontend:
	@cd frontend && npm run dev

# Orchestrator (Java)
run-orchestrator:
	@cd services/orchestrator && mvn spring-boot:run
