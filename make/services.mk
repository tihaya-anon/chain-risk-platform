# Service Build/Run Commands

# Data Ingestion (Go)
ingestion-build:
	@cd $(DIR_INGESTION) && mkdir -p bin && go build -o bin/ingestion ./cmd/ingestion

ingestion-run:
	@bash -c '$(LOAD_ENV) cd $(DIR_INGESTION) && ./bin/ingestion'

ingestion-test:
	@cd $(DIR_INGESTION) && go test ./...

ingestion-clean:
	@rm -rf $(DIR_INGESTION)/bin

# Data Generator (Go)
generator-build:
	@cd $(DIR_INGESTION) && mkdir -p bin && go build -o bin/generator ./cmd/generator

generator-run: generator-build
	@bash -c '$(LOAD_ENV) cd $(DIR_INGESTION) && ./bin/generator -mode=random -tps=10'

generator-scenario: generator-build
	@bash -c '$(LOAD_ENV) cd $(DIR_INGESTION) && ./bin/generator -mode=scenario -scenario=$(SCENARIO) -tps=$(or $(TPS),10)'

generator-stress: generator-build
	@bash -c '$(LOAD_ENV) cd $(DIR_INGESTION) && ./bin/generator -mode=random -tps=100 -duration=$(or $(DURATION),60)'

# Query Service (Go)
query-build:
	@cd $(DIR_QUERY) && mkdir -p bin && go build -o bin/query ./cmd/...

query-run:
	@bash -c '$(LOAD_ENV) cd $(DIR_QUERY) && go run ./cmd/...'

query-test:
	@cd $(DIR_QUERY) && go test ./...

query-clean:
	@rm -rf $(DIR_QUERY)/bin

# Alert Service (Go)
alert-build:
	@cd $(DIR_ALERT) && mkdir -p bin && go build -o bin/alert ./cmd/...

alert-run:
	@bash -c '$(LOAD_ENV) cd $(DIR_ALERT) && go run ./cmd/...'

alert-test:
	@cd $(DIR_ALERT) && go test ./...

alert-clean:
	@rm -rf $(DIR_ALERT)/bin

# Risk ML Service (Python)
risk-build:
	@cd $(DIR_RISK) && uv sync

risk-run:
	@bash -c '$(LOAD_ENV) cd $(DIR_RISK) && uv run uvicorn app.main:app --reload --port 8082'

risk-test:
	@cd $(DIR_RISK) && uv run pytest

risk-clean:
	@find $(DIR_RISK) -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null || true

# BFF Service (TypeScript)
bff-build:
	@cd $(DIR_BFF) && npm install && npm run build

bff-run:
	@bash -c '$(LOAD_ENV) cd $(DIR_BFF) && npm run start:dev'

bff-test:
	@cd $(DIR_BFF) && npm test

bff-clean:
	@rm -rf $(DIR_BFF)/dist

# Orchestrator (Java)
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

# Graph Service (Java)
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

# Frontend (React)
frontend-build:
	@cd $(DIR_FRONTEND) && npm install && npm run build

frontend-run:
	@cd $(DIR_FRONTEND) && npm run dev

frontend-test:
	@cd $(DIR_FRONTEND) && npm test

frontend-clean:
	@rm -rf $(DIR_FRONTEND)/dist
