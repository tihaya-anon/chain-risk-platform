#!/bin/bash
# ============================================================
# Local Host Mapping Script for Development
# ============================================================
# This script sets up /etc/hosts entries temporarily or
# provides alternative solutions without modifying system files
# ============================================================

set -e

# Load configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

if [ -f "$PROJECT_ROOT/.env.local" ]; then
    source "$PROJECT_ROOT/.env.local"
fi

if [ -z "$DOCKER_HOST_IP" ]; then
    echo "Error: DOCKER_HOST_IP not set in .env.local"
    echo "Please edit .env.local and set your remote machine's IP"
    exit 1
fi

# Service hostnames used in configs
SERVICES=(
    "kafka"
    "zookeeper"
    "postgres"
    "redis"
    "neo4j"
    "nacos"
    "prometheus"
    "grafana"
    "jaeger"
)

echo "============================================"
echo "Docker Host IP: $DOCKER_HOST_IP"
echo "============================================"

case "$1" in
    # Option 1: Print hosts entries (manual copy to /etc/hosts)
    "print")
        echo ""
        echo "Add these lines to /etc/hosts:"
        echo "----------------------------------------"
        for svc in "${SERVICES[@]}"; do
            echo "$DOCKER_HOST_IP    $svc"
        done
        echo "----------------------------------------"
        ;;

    # Option 2: Export as environment variables (for current shell)
    "export")
        echo ""
        echo "Run this in your terminal:"
        echo "----------------------------------------"
        echo "export KAFKA_HOST=$DOCKER_HOST_IP"
        echo "export POSTGRES_HOST=$DOCKER_HOST_IP"
        echo "export REDIS_HOST=$DOCKER_HOST_IP"
        echo "export NEO4J_HOST=$DOCKER_HOST_IP"
        echo "export NACOS_HOST=$DOCKER_HOST_IP"
        echo "export JAEGER_HOST=$DOCKER_HOST_IP"
        echo "----------------------------------------"
        ;;

    # Option 3: Generate hosts file for Docker (if running local containers)
    "docker-hosts")
        HOSTS_FILE="$PROJECT_ROOT/infra/hosts/docker.hosts"
        mkdir -p "$(dirname "$HOSTS_FILE")"
        echo "# Auto-generated hosts mapping" > "$HOSTS_FILE"
        echo "# Generated at: $(date)" >> "$HOSTS_FILE"
        for svc in "${SERVICES[@]}"; do
            echo "$DOCKER_HOST_IP    $svc" >> "$HOSTS_FILE"
        done
        echo "Generated: $HOSTS_FILE"
        echo "Use with: docker run --add-host or extra_hosts in docker-compose"
        ;;

    *)
        echo ""
        echo "Usage: $0 {print|export|docker-hosts}"
        echo ""
        echo "  print        - Print /etc/hosts entries"
        echo "  export       - Print export commands for shell"
        echo "  docker-hosts - Generate hosts file for Docker"
        echo ""
        ;;
esac
