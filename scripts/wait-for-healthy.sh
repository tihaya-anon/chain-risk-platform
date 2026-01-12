#!/bin/bash
# ============================================
# Wait for services to be healthy
# ============================================

set -e

TIMEOUT=${TIMEOUT:-120}
INTERVAL=${INTERVAL:-5}

# Service endpoints
declare -A SERVICES=(
  ["orchestrator"]="http://localhost:8080/health"
  ["bff"]="http://localhost:3001/health"
  ["query-service"]="http://localhost:8081/health"
  ["risk-ml-service"]="http://localhost:8082/health"
  ["alert-service"]="http://localhost:8083/health"
  ["graph-service"]="http://localhost:8084/actuator/health"
)

check_service() {
  local name=$1
  local url=$2
  
  if curl -sf "$url" > /dev/null 2>&1; then
    echo "✓ $name is healthy"
    return 0
  fi
  return 1
}

main() {
  echo "Waiting for services to be healthy..."
  echo "Timeout: ${TIMEOUT}s, Interval: ${INTERVAL}s"
  echo ""
  
  local start_time=$(date +%s)
  local all_healthy=false
  
  while true; do
    local current_time=$(date +%s)
    local elapsed=$((current_time - start_time))
    
    if [ $elapsed -ge $TIMEOUT ]; then
      echo ""
      echo "Timeout reached after ${TIMEOUT}s"
      echo "Some services may not be healthy"
      return 1
    fi
    
    all_healthy=true
    for name in "${!SERVICES[@]}"; do
      if ! check_service "$name" "${SERVICES[$name]}"; then
        all_healthy=false
      fi
    done
    
    if $all_healthy; then
      echo ""
      echo "All services are healthy!"
      return 0
    fi
    
    echo "Waiting... ($elapsed/${TIMEOUT}s)"
    sleep $INTERVAL
  done
}

# Allow running specific services
if [ "$1" != "" ]; then
  SERVICES=()
  for svc in "$@"; do
    case $svc in
      orchestrator) SERVICES["orchestrator"]="http://localhost:8080/health" ;;
      bff) SERVICES["bff"]="http://localhost:3001/health" ;;
      query-service) SERVICES["query-service"]="http://localhost:8081/health" ;;
      risk-ml-service) SERVICES["risk-ml-service"]="http://localhost:8082/health" ;;
      alert-service) SERVICES["alert-service"]="http://localhost:8083/health" ;;
      graph-service) SERVICES["graph-service"]="http://localhost:8084/actuator/health" ;;
      *) echo "Unknown service: $svc" ;;
    esac
  done
fi

main
