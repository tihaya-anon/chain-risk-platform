# Testing Commands

# ============================================
# Smoke Test
# ============================================
smoke-test:
	@bash -c '$(LOAD_ENV) ./scripts/smoke-test.sh'

# ============================================
# E2E Tests (Go)
# ============================================
test-e2e: generator-build
	@bash -c '$(LOAD_ENV) ./tests/e2e/run_e2e.sh all'

test-e2e-pipeline: generator-build
	@bash -c '$(LOAD_ENV) ./tests/e2e/run_e2e.sh pipeline'

test-e2e-services:
	@bash -c '$(LOAD_ENV) ./tests/e2e/run_e2e.sh services'

# ============================================
# Playwright E2E Tests (Frontend)
# ============================================
playwright-setup:
	@echo "🎭 Installing Playwright..."
	@cd $(DIR_FRONTEND) && npm install
	@cd $(DIR_FRONTEND) && npx playwright install chromium
	@echo "✅ Playwright setup complete"

playwright-test:
	@echo "🎭 Running Playwright tests..."
	@bash -c '$(LOAD_ENV) ./tests/e2e/playwright/scripts/run-playwright.sh all'

playwright-test-login:
	@bash -c '$(LOAD_ENV) ./tests/e2e/playwright/scripts/run-playwright.sh login'

playwright-test-dashboard:
	@bash -c '$(LOAD_ENV) ./tests/e2e/playwright/scripts/run-playwright.sh dashboard'

playwright-test-search:
	@bash -c '$(LOAD_ENV) ./tests/e2e/playwright/scripts/run-playwright.sh search'

playwright-test-alerts:
	@bash -c '$(LOAD_ENV) ./tests/e2e/playwright/scripts/run-playwright.sh alerts'

playwright-test-websocket:
	@bash -c '$(LOAD_ENV) ./tests/e2e/playwright/scripts/run-playwright.sh websocket'

playwright-test-headed:
	@bash -c '$(LOAD_ENV) ./tests/e2e/playwright/scripts/run-playwright.sh all --headed'

playwright-report:
	@cd tests/e2e/playwright && npx playwright show-report

# WebSocket E2E helpers
ws-inject-alert:
	@bash -c '$(LOAD_ENV) ./tests/e2e/playwright/scripts/ws-test-helper.sh inject-alert'

ws-inject-critical:
	@bash -c '$(LOAD_ENV) ./tests/e2e/playwright/scripts/ws-test-helper.sh inject-critical'

ws-inject-batch:
	@bash -c '$(LOAD_ENV) ./tests/e2e/playwright/scripts/ws-test-helper.sh inject-batch $(N)'

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

test-e2e-all: test-e2e playwright-test

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
