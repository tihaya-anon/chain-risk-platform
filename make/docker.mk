# Docker Compose Commands (Remote Docker Support)

# Remote Docker SSH host (set in .env.local as DOCKER_SSH_HOST=dev-win)
DOCKER_SSH_HOST ?= $(shell grep "^DOCKER_SSH_HOST=" .env.local 2>/dev/null | cut -d'=' -f2)

# Compose file paths (relative to remote project root)
REMOTE_PROJECT_DIR := ~/chain-risk-platform
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
# Infrastructure
# ============================================
infra-up:
	@echo "🚀 Starting core infrastructure..."
ifdef DOCKER_SSH_HOST
	@ssh $(DOCKER_SSH_HOST) 'cd $(REMOTE_PROJECT_DIR) && docker-compose $(COMPOSE_INFRA) up -d'
else
	@docker-compose $(COMPOSE_INFRA) up -d
endif
	@echo "✅ Started: zookeeper, kafka, postgres, neo4j, redis, nacos"

infra-down:
ifdef DOCKER_SSH_HOST
	@ssh $(DOCKER_SSH_HOST) 'cd $(REMOTE_PROJECT_DIR) && docker-compose $(COMPOSE_INFRA) down'
else
	@docker-compose $(COMPOSE_INFRA) down
endif

infra-ps:
ifdef DOCKER_SSH_HOST
	@ssh $(DOCKER_SSH_HOST) 'cd $(REMOTE_PROJECT_DIR) && docker-compose $(COMPOSE_INFRA) ps'
else
	@docker-compose $(COMPOSE_INFRA) ps
endif

# ============================================
# Data Lake
# ============================================
datalake-up:
	@echo "🚀 Starting data lake..."
ifdef DOCKER_SSH_HOST
	@ssh $(DOCKER_SSH_HOST) 'cd $(REMOTE_PROJECT_DIR) && docker-compose $(COMPOSE_DATALAKE) up -d minio minio-init hive-metastore trino'
else
	@docker-compose $(COMPOSE_DATALAKE) up -d minio minio-init hive-metastore trino
endif
	@echo "✅ Started: minio, hive-metastore, trino"

datalake-down:
ifdef DOCKER_SSH_HOST
	@ssh $(DOCKER_SSH_HOST) 'cd $(REMOTE_PROJECT_DIR) && docker-compose $(COMPOSE_DATALAKE) stop minio hive-metastore trino'
else
	@docker-compose $(COMPOSE_DATALAKE) stop minio hive-metastore trino
endif

# ============================================
# Monitoring
# ============================================
monitoring-up:
	@echo "🚀 Starting monitoring..."
ifdef DOCKER_SSH_HOST
	@ssh $(DOCKER_SSH_HOST) 'cd $(REMOTE_PROJECT_DIR) && docker-compose $(COMPOSE_MONITORING) up -d'
else
	@docker-compose $(COMPOSE_MONITORING) up -d
endif
	@echo "✅ Started: prometheus, grafana, loki, elasticsearch, jaeger"

monitoring-down:
ifdef DOCKER_SSH_HOST
	@ssh $(DOCKER_SSH_HOST) 'cd $(REMOTE_PROJECT_DIR) && docker-compose $(COMPOSE_MONITORING) down'
else
	@docker-compose $(COMPOSE_MONITORING) down
endif

monitoring-ps:
ifdef DOCKER_SSH_HOST
	@ssh $(DOCKER_SSH_HOST) 'cd $(REMOTE_PROJECT_DIR) && docker-compose $(COMPOSE_MONITORING) ps'
else
	@docker-compose $(COMPOSE_MONITORING) ps
endif

# ============================================
# Security
# ============================================
security-up:
	@echo "🚀 Starting Vault..."
ifdef DOCKER_SSH_HOST
	@ssh $(DOCKER_SSH_HOST) 'cd $(REMOTE_PROJECT_DIR) && docker-compose $(COMPOSE_SECURITY) up -d'
else
	@docker-compose $(COMPOSE_SECURITY) up -d
endif
	@echo "✅ Vault started on :18200"

security-down:
ifdef DOCKER_SSH_HOST
	@ssh $(DOCKER_SSH_HOST) 'cd $(REMOTE_PROJECT_DIR) && docker-compose $(COMPOSE_SECURITY) down'
else
	@docker-compose $(COMPOSE_SECURITY) down
endif

# ============================================
# App Services
# ============================================
services-up:
	@echo "🚀 Starting application services..."
ifdef DOCKER_SSH_HOST
	@ssh $(DOCKER_SSH_HOST) 'cd $(REMOTE_PROJECT_DIR) && docker-compose $(COMPOSE_SERVICES) up -d query-service alert-service risk-ml-service graph-service bff'
else
	@docker-compose $(COMPOSE_SERVICES) up -d query-service alert-service risk-ml-service graph-service bff
endif
	@echo "✅ Services started"

services-down:
ifdef DOCKER_SSH_HOST
	@ssh $(DOCKER_SSH_HOST) 'cd $(REMOTE_PROJECT_DIR) && docker-compose $(COMPOSE_SERVICES) stop query-service alert-service risk-ml-service graph-service bff'
else
	@docker-compose $(COMPOSE_SERVICES) stop query-service alert-service risk-ml-service graph-service bff
endif

services-ps:
ifdef DOCKER_SSH_HOST
	@ssh $(DOCKER_SSH_HOST) 'cd $(REMOTE_PROJECT_DIR) && docker-compose $(COMPOSE_SERVICES) ps'
else
	@docker-compose $(COMPOSE_SERVICES) ps
endif

services-logs:
ifdef DOCKER_SSH_HOST
	@ssh $(DOCKER_SSH_HOST) 'cd $(REMOTE_PROJECT_DIR) && docker-compose $(COMPOSE_SERVICES) logs -f query-service alert-service risk-ml-service graph-service bff'
else
	@docker-compose $(COMPOSE_SERVICES) logs -f query-service alert-service risk-ml-service graph-service bff
endif

# ============================================
# All
# ============================================
up-all:
	@echo "🚀 Starting ALL..."
ifdef DOCKER_SSH_HOST
	@ssh $(DOCKER_SSH_HOST) 'cd $(REMOTE_PROJECT_DIR) && docker-compose $(COMPOSE_ALL) up -d'
else
	@docker-compose $(COMPOSE_ALL) up -d
endif
	@echo "✅ All started"

down-all:
ifdef DOCKER_SSH_HOST
	@ssh $(DOCKER_SSH_HOST) 'cd $(REMOTE_PROJECT_DIR) && docker-compose $(COMPOSE_ALL) down'
else
	@docker-compose $(COMPOSE_ALL) down
endif

ps-all:
ifdef DOCKER_SSH_HOST
	@ssh $(DOCKER_SSH_HOST) 'cd $(REMOTE_PROJECT_DIR) && docker-compose $(COMPOSE_ALL) ps'
else
	@docker-compose $(COMPOSE_ALL) ps
endif

# ============================================
# Remote Docker Status
# ============================================
docker-ps:
ifdef DOCKER_SSH_HOST
	@echo "📡 Remote Docker ($(DOCKER_SSH_HOST)):"
	@ssh $(DOCKER_SSH_HOST) 'docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"'
else
	@echo "🐳 Local Docker:"
	@docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'
endif

docker-ps-all:
ifdef DOCKER_SSH_HOST
	@echo "📡 Remote Docker ($(DOCKER_SSH_HOST)):"
	@ssh $(DOCKER_SSH_HOST) 'docker ps -a --format "table {{.Names}}\t{{.Status}}"'
else
	@echo "🐳 Local Docker:"
	@docker ps -a --format 'table {{.Names}}\t{{.Status}}'
endif

docker-logs:
ifdef DOCKER_SSH_HOST
	@ssh $(DOCKER_SSH_HOST) 'docker logs $(SVC) --tail 100'
else
	@docker logs $(SVC) --tail 100
endif

# ============================================
# Build (local only)
# ============================================
docker-build: docker-build-query docker-build-alert docker-build-risk docker-build-graph docker-build-bff docker-build-mempool
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

docker-build-bff:
	@echo "🐳 Building bff..."
	@docker build -t $(DOCKER_REGISTRY)/bff:$(DOCKER_TAG) $(DIR_BFF)

docker-build-mempool:
	@echo "🐳 Building mempool-collector..."
	@docker build -t $(DOCKER_REGISTRY)/mempool-collector:$(DOCKER_TAG) $(DIR_MEMPOOL)

docker-clean:
	@echo "🧹 Cleaning images..."
	@docker rmi $(DOCKER_REGISTRY)/query-service:$(DOCKER_TAG) 2>/dev/null || true
	@docker rmi $(DOCKER_REGISTRY)/alert-service:$(DOCKER_TAG) 2>/dev/null || true
	@docker rmi $(DOCKER_REGISTRY)/risk-ml-service:$(DOCKER_TAG) 2>/dev/null || true
	@docker rmi $(DOCKER_REGISTRY)/graph-service:$(DOCKER_TAG) 2>/dev/null || true
	@docker rmi $(DOCKER_REGISTRY)/bff:$(DOCKER_TAG) 2>/dev/null || true
	@docker rmi $(DOCKER_REGISTRY)/mempool-collector:$(DOCKER_TAG) 2>/dev/null || true
	@echo "✅ Cleaned"

# ============================================
# Sync to Remote
# ============================================
sync-to-remote:
ifdef DOCKER_SSH_HOST
	@echo "📤 Syncing project to remote..."
	@rsync -avz --exclude='.git' --exclude='node_modules' --exclude='target' --exclude='bin' --exclude='*.log' \
		./ $(DOCKER_SSH_HOST):$(REMOTE_PROJECT_DIR)/
	@echo "✅ Synced to $(DOCKER_SSH_HOST):$(REMOTE_PROJECT_DIR)"
else
	@echo "⚠️  DOCKER_SSH_HOST not set, skipping sync"
endif
