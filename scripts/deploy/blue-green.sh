#!/bin/bash
# ============================================
# Blue-Green Deployment Script
# ============================================
# Zero-downtime deployment with automatic rollback

set -e

SERVICE=$1
NEW_IMAGE=$2
HEALTH_ENDPOINT=${3:-/health}
NETWORK=${NETWORK:-chainrisk-backend}
HISTORY_DIR=${HISTORY_DIR:-/tmp/deploy-history}

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

usage() {
  echo "Usage: $0 <service> <image> [health_endpoint]"
  echo ""
  echo "Arguments:"
  echo "  service         Service name (e.g., query-service)"
  echo "  image           Docker image with tag"
  echo "  health_endpoint Health check path (default: /health)"
  echo ""
  echo "Options:"
  echo "  --dry-run       Print actions without executing"
  echo ""
  echo "Environment:"
  echo "  NETWORK         Docker network (default: chainrisk-backend)"
  echo "  HISTORY_DIR     Deploy history dir (default: /tmp/deploy-history)"
  exit 1
}

# Parse args
DRY_RUN=false
for arg in "$@"; do
  case $arg in
    --dry-run) DRY_RUN=true; shift ;;
  esac
done

if [ -z "$SERVICE" ] || [ -z "$NEW_IMAGE" ]; then
  usage
fi

BLUE="${SERVICE}"
GREEN="${SERVICE}-green"

echo "============================================"
echo " Blue-Green Deploy: $SERVICE"
echo "============================================"
echo "Image: $NEW_IMAGE"
echo "Health: $HEALTH_ENDPOINT"
echo "Network: $NETWORK"
echo ""

# Save current state
mkdir -p "$HISTORY_DIR"
CURRENT_IMAGE=$(docker inspect "$BLUE" --format '{{.Config.Image}}' 2>/dev/null || echo "")
if [ -n "$CURRENT_IMAGE" ]; then
  echo "$CURRENT_IMAGE" > "${HISTORY_DIR}/${SERVICE}-previous"
  log_info "Saved previous image: $CURRENT_IMAGE"
fi
echo "$NEW_IMAGE" > "${HISTORY_DIR}/${SERVICE}-current"

if $DRY_RUN; then
  log_warn "DRY RUN - no changes made"
  echo "Would execute:"
  echo "  1. Start green instance with $NEW_IMAGE"
  echo "  2. Health check $HEALTH_ENDPOINT"
  echo "  3. Switch traffic blue -> green"
  echo "  4. Remove old instance"
  exit 0
fi

# Get env vars from current instance
ENV_ARGS=""
if docker inspect "$BLUE" > /dev/null 2>&1; then
  ENV_VARS=$(docker inspect "$BLUE" --format '{{range .Config.Env}}{{.}} {{end}}')
  for var in $ENV_VARS; do
    ENV_ARGS="$ENV_ARGS -e $var"
  done
fi

# Step 1: Start green instance
log_info "[1/5] Starting green instance..."
docker run -d --name "$GREEN" \
  --network "$NETWORK" \
  $ENV_ARGS \
  "$NEW_IMAGE"

# Step 2: Wait for healthy
log_info "[2/5] Waiting for green to be healthy..."
HEALTHY=false
for i in $(seq 1 30); do
  if docker exec "$GREEN" wget -qO- "http://localhost${HEALTH_ENDPOINT}" > /dev/null 2>&1 || \
     docker exec "$GREEN" curl -sf "http://localhost${HEALTH_ENDPOINT}" > /dev/null 2>&1; then
    log_info "Green instance is healthy"
    HEALTHY=true
    break
  fi
  echo "  Attempt $i/30..."
  sleep 2
done

if ! $HEALTHY; then
  log_error "Green instance failed health check"
  docker logs "$GREEN" --tail 50
  docker rm -f "$GREEN"
  exit 1
fi

# Step 3: Switch traffic
log_info "[3/5] Switching traffic to green..."
if docker inspect "$BLUE" > /dev/null 2>&1; then
  docker stop "$BLUE"
  docker rename "$BLUE" "${BLUE}-old"
fi
docker rename "$GREEN" "$BLUE"

# Step 4: Verify new instance
log_info "[4/5] Verifying new instance..."
sleep 3
if ! docker exec "$BLUE" wget -qO- "http://localhost${HEALTH_ENDPOINT}" > /dev/null 2>&1 && \
   ! docker exec "$BLUE" curl -sf "http://localhost${HEALTH_ENDPOINT}" > /dev/null 2>&1; then
  log_error "New instance unhealthy after switch, rolling back..."
  docker stop "$BLUE"
  docker rename "$BLUE" "$GREEN"
  docker rename "${BLUE}-old" "$BLUE"
  docker start "$BLUE"
  docker rm -f "$GREEN"
  exit 1
fi

# Step 5: Cleanup old
log_info "[5/5] Cleaning up old instance..."
docker rm -f "${BLUE}-old" 2>/dev/null || true

echo ""
echo "============================================"
log_info "Deploy complete!"
echo "============================================"
echo "Service: $SERVICE"
echo "Image: $NEW_IMAGE"
echo "Status: Running"
