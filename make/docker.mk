# Docker Compose Commands

COMPOSE_BASE := -f infra/compose/base.yml
COMPOSE_INFRA := $(COMPOSE_BASE) -f infra/compose/infra.yml
COMPOSE_DATALAKE := $(COMPOSE_INFRA) -f infra/compose/datalake.yml
COMPOSE_MONITORING := $(COMPOSE_BASE) -f infra/compose/monitoring.yml
COMPOSE_SECURITY := $(COMPOSE_BASE) -f infra/compose/security.yml
COMPOSE_SERVICES := $(COMPOSE_INFRA) -f infra/compose/services.yml
COMPOSE_ALL := $(COMPOSE_BASE) -f infra/compose/infra.yml -f infra/compose/datalake.yml -f infra/compose/monitoring.yml -f infra/compose/security.yml -f infra/compose/services.yml

DOCKER_REGISTRY := chainrisk
DOCKER_TAG := latest

# Infrastructure
infra-up:
	@echo "🚀 Starting core infrastructure..."
	@docker-compose $(COMPOSE_INFRA) up -d
	@echo "✅ Started: zookeeper, kafka, postgres, neo4j, redis, nacos"

infra-down:
	@docker-compose $(COMPOSE_INFRA) down

infra-ps:
	@docker-compose $(COMPOSE_INFRA) ps

# Data Lake
datalake-up:
	@echo "🚀 Starting data lake..."
	@docker-compose $(COMPOSE_DATALAKE) up -d minio minio-init hive-metastore trino
	@echo "✅ Started: minio, hive-metastore, trino"

datalake-down:
	@docker-compose $(COMPOSE_DATALAKE) stop minio hive-metastore trino

# Monitoring
monitoring-up:
	@echo "🚀 Starting monitoring..."
	@docker-compose $(COMPOSE_MONITORING) up -d
	@echo "✅ Started: prometheus, grafana, loki, elasticsearch, jaeger"

monitoring-down:
	@docker-compose $(COMPOSE_MONITORING) down

monitoring-ps:
	@docker-compose $(COMPOSE_MONITORING) ps

# Security
security-up:
	@echo "🚀 Starting Vault..."
	@docker-compose $(COMPOSE_SECURITY) up -d
	@echo "✅ Vault started on :18200"

security-down:
	@docker-compose $(COMPOSE_SECURITY) down

# App Services
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

# All
up-all:
	@echo "🚀 Starting ALL..."
	@docker-compose $(COMPOSE_ALL) up -d
	@echo "✅ All started"

down-all:
	@docker-compose $(COMPOSE_ALL) down

ps-all:
	@docker-compose $(COMPOSE_ALL) ps

# Build
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
	@echo "✅ Cleaned"
