# Testing Commands

# ============================================
# Smoke Test
# ============================================
smoke-test:
	@bash -c '$(LOAD_ENV) ./scripts/smoke-test.sh'

# ============================================
# E2E Tests
# ============================================
test-e2e: generator-build
	@bash -c '$(LOAD_ENV) ./tests/e2e/run_e2e.sh all'

test-e2e-pipeline: generator-build
	@bash -c '$(LOAD_ENV) ./tests/e2e/run_e2e.sh pipeline'

test-e2e-services:
	@bash -c '$(LOAD_ENV) ./tests/e2e/run_e2e.sh services'

# ============================================
# Integration Tests
# ============================================
test-integration:
	@bash -c '$(LOAD_ENV) ./scripts/test/run-integration-test.sh'

# ============================================
# Phase Validation
# ============================================
validate-phase10:
	@./scripts/validate-phase10.sh

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
	@echo "✅ Query(:8081) Risk(:8082) BFF(:3001) Graph(:8084)"

stop-svc:
	@pkill -f "query-service" 2>/dev/null || true
	@pkill -f "uvicorn app.main:app" 2>/dev/null || true
	@pkill -f "nest start" 2>/dev/null || true
	@pkill -f "graph-service" 2>/dev/null || true
	@echo "✅ Stopped"

# ============================================
# Trino Query
# ============================================
trino:
	@bash -c '$(LOAD_ENV) ./scripts/trino-query.sh "$(Q)"'
