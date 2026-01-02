#!/bin/bash

# Chain Risk Platform - 项目初始化脚本
# 用于创建所有服务的目录结构

set -e

echo "🚀 初始化 Chain Risk Platform 项目结构..."

# 颜色定义
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 创建目录函数
create_dir() {
    mkdir -p "$1"
    echo -e "${GREEN}✓${NC} Created: $1"
}

# ============== Services ==============
echo -e "\n${BLUE}📦 创建服务目录...${NC}"

# BFF Gateway (TypeScript/Nest.js)
create_dir "services/bff-gateway/src/modules/auth"
create_dir "services/bff-gateway/src/modules/address"
create_dir "services/bff-gateway/src/modules/risk"
create_dir "services/bff-gateway/src/common/filters"
create_dir "services/bff-gateway/src/common/guards"
create_dir "services/bff-gateway/src/common/interceptors"
create_dir "services/bff-gateway/test"

# Query Service (Go/Gin)
create_dir "services/query-service/cmd"
create_dir "services/query-service/internal/handler"
create_dir "services/query-service/internal/service"
create_dir "services/query-service/internal/repository"
create_dir "services/query-service/internal/model"
create_dir "services/query-service/pkg/cache"
create_dir "services/query-service/configs"
create_dir "services/query-service/test"

# Alert Service (Go/Gin)
create_dir "services/alert-service/cmd"
create_dir "services/alert-service/internal/handler"
create_dir "services/alert-service/internal/service"
create_dir "services/alert-service/internal/repository"
create_dir "services/alert-service/internal/model"
create_dir "services/alert-service/internal/notifier"
create_dir "services/alert-service/configs"
create_dir "services/alert-service/test"

# Risk ML Service (Python/FastAPI)
create_dir "services/risk-ml-service/app/api/v1"
create_dir "services/risk-ml-service/app/core"
create_dir "services/risk-ml-service/app/models"
create_dir "services/risk-ml-service/app/services"
create_dir "services/risk-ml-service/app/rules"
create_dir "services/risk-ml-service/ml/features"
create_dir "services/risk-ml-service/ml/models"
create_dir "services/risk-ml-service/tests"

# Orchestrator (Java/Spring Cloud)
create_dir "services/orchestrator/src/main/java/com/chainrisk/orchestrator/config"
create_dir "services/orchestrator/src/main/java/com/chainrisk/orchestrator/gateway"
create_dir "services/orchestrator/src/main/resources"
create_dir "services/orchestrator/src/test/java"

# ============== Processing ==============
echo -e "\n${BLUE}⚡ 创建处理模块目录...${NC}"

# Stream Processor (Java/Flink)
create_dir "processing/stream-processor/src/main/java/com/chainrisk/stream/job"
create_dir "processing/stream-processor/src/main/java/com/chainrisk/stream/parser"
create_dir "processing/stream-processor/src/main/java/com/chainrisk/stream/sink"
create_dir "processing/stream-processor/src/main/java/com/chainrisk/stream/model"
create_dir "processing/stream-processor/src/main/resources"
create_dir "processing/stream-processor/src/test/java"

# Batch Processor (Java/Flink SQL)
create_dir "processing/batch-processor/src/main/java/com/chainrisk/batch/job"
create_dir "processing/batch-processor/src/main/resources/sql"
create_dir "processing/batch-processor/src/test/java"

# Graph Engine (Java)
create_dir "processing/graph-engine/src/main/java/com/chainrisk/graph/algorithm"
create_dir "processing/graph-engine/src/main/java/com/chainrisk/graph/repository"
create_dir "processing/graph-engine/src/main/java/com/chainrisk/graph/service"
create_dir "processing/graph-engine/src/main/resources"
create_dir "processing/graph-engine/src/test/java"

# ============== Data Ingestion ==============
echo -e "\n${BLUE}📥 创建数据采集目录...${NC}"

create_dir "data-ingestion/cmd"
create_dir "data-ingestion/internal/client"
create_dir "data-ingestion/internal/producer"
create_dir "data-ingestion/internal/model"
create_dir "data-ingestion/internal/config"
create_dir "data-ingestion/pkg/blockchain"
create_dir "data-ingestion/configs"
create_dir "data-ingestion/test"

# ============== Frontend ==============
echo -e "\n${BLUE}🎨 创建前端目录...${NC}"

create_dir "frontend/src/components/common"
create_dir "frontend/src/components/address"
create_dir "frontend/src/components/risk"
create_dir "frontend/src/components/dashboard"
create_dir "frontend/src/pages"
create_dir "frontend/src/hooks"
create_dir "frontend/src/services"
create_dir "frontend/src/store"
create_dir "frontend/src/types"
create_dir "frontend/src/utils"
create_dir "frontend/public"

# ============== Infrastructure ==============
echo -e "\n${BLUE}🔧 创建基础设施目录...${NC}"

create_dir "infra/k8s/base"
create_dir "infra/k8s/overlays/dev"
create_dir "infra/k8s/overlays/prod"
create_dir "infra/terraform"
create_dir "infra/prometheus"
create_dir "infra/grafana/provisioning/dashboards"
create_dir "infra/grafana/provisioning/datasources"
create_dir "infra/init-scripts/postgres"

# ============== Docs ==============
echo -e "\n${BLUE}📚 创建文档目录...${NC}"

create_dir "docs/api-specs"
create_dir "docs/architecture"
create_dir "docs/guides"

# ============== 创建 .gitkeep 文件 ==============
echo -e "\n${BLUE}📄 创建占位文件...${NC}"

find . -type d -empty -exec touch {}/.gitkeep \;

# ============== 创建基础配置文件 ==============
echo -e "\n${BLUE}⚙️ 创建基础配置文件...${NC}"

# Prometheus 配置
cat > infra/prometheus/prometheus.yml << 'EOF'
global:
  scrape_interval: 15s
  evaluation_interval: 15s

scrape_configs:
  - job_name: 'prometheus'
    static_configs:
      - targets: ['localhost:9090']

  - job_name: 'query-service'
    static_configs:
      - targets: ['query-service:8081']

  - job_name: 'risk-ml-service'
    static_configs:
      - targets: ['risk-ml-service:8082']

  - job_name: 'alert-service'
    static_configs:
      - targets: ['alert-service:8083']
EOF
echo -e "${GREEN}✓${NC} Created: infra/prometheus/prometheus.yml"

# PostgreSQL 初始化脚本
cat > infra/init-scripts/postgres/01-init.sql << 'EOF'
-- Chain Risk Platform Database Initialization

-- Create schemas
CREATE SCHEMA IF NOT EXISTS chain_data;
CREATE SCHEMA IF NOT EXISTS risk;
CREATE SCHEMA IF NOT EXISTS alert;

-- Transfers table
CREATE TABLE IF NOT EXISTS chain_data.transfers (
    id BIGSERIAL PRIMARY KEY,
    tx_hash VARCHAR(66) NOT NULL,
    block_number BIGINT NOT NULL,
    from_address VARCHAR(42) NOT NULL,
    to_address VARCHAR(42) NOT NULL,
    value NUMERIC(78, 0) NOT NULL,
    token_address VARCHAR(42),
    token_symbol VARCHAR(20),
    timestamp TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_transfers_from (from_address),
    INDEX idx_transfers_to (to_address),
    INDEX idx_transfers_block (block_number),
    INDEX idx_transfers_timestamp (timestamp)
);

-- Address risk scores table
CREATE TABLE IF NOT EXISTS risk.address_scores (
    address VARCHAR(42) PRIMARY KEY,
    risk_score DECIMAL(5, 4) NOT NULL,
    risk_level VARCHAR(20) NOT NULL,
    factors JSONB,
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_risk_score (risk_score),
    INDEX idx_risk_level (risk_level)
);

-- Alerts table
CREATE TABLE IF NOT EXISTS alert.alerts (
    id BIGSERIAL PRIMARY KEY,
    alert_type VARCHAR(50) NOT NULL,
    severity VARCHAR(20) NOT NULL,
    address VARCHAR(42),
    tx_hash VARCHAR(66),
    message TEXT NOT NULL,
    metadata JSONB,
    status VARCHAR(20) DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    resolved_at TIMESTAMP,
    
    INDEX idx_alerts_type (alert_type),
    INDEX idx_alerts_severity (severity),
    INDEX idx_alerts_status (status),
    INDEX idx_alerts_created (created_at)
);
EOF
echo -e "${GREEN}✓${NC} Created: infra/init-scripts/postgres/01-init.sql"

# Grafana datasource
cat > infra/grafana/provisioning/datasources/datasources.yml << 'EOF'
apiVersion: 1

datasources:
  - name: Prometheus
    type: prometheus
    access: proxy
    url: http://prometheus:9090
    isDefault: true

  - name: PostgreSQL
    type: postgres
    url: postgres:5432
    database: chainrisk
    user: chainrisk
    secureJsonData:
      password: chainrisk123
    jsonData:
      sslmode: disable
EOF
echo -e "${GREEN}✓${NC} Created: infra/grafana/provisioning/datasources/datasources.yml"

# .gitignore
cat > .gitignore << 'EOF'
# Dependencies
node_modules/
vendor/
__pycache__/
*.pyc
.venv/
venv/

# Build outputs
dist/
build/
target/
*.jar
*.war
bin/

# IDE
.idea/
.vscode/
*.swp
*.swo
.DS_Store

# Environment
.env
.env.local
*.local

# Logs
logs/
*.log

# Test coverage
coverage/
htmlcov/
.coverage

# Temp files
tmp/
temp/
*.tmp

# Secrets (never commit!)
secrets/
*.pem
*.key
EOF
echo -e "${GREEN}✓${NC} Created: .gitignore"

echo -e "\n${GREEN}✅ 项目结构初始化完成!${NC}"
echo -e "\n下一步:"
echo "  1. 运行 'docker-compose up -d' 启动基础设施"
echo "  2. 按照 docs/DEVELOPMENT_PLAN.md 开始开发"
echo ""
