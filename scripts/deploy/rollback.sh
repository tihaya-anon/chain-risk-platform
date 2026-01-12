#!/bin/bash
# ============================================
# Rollback Script
# ============================================
# Quick rollback to previous version

set -e

SERVICE=$1
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
  echo "Usage: $0 <service> [options]"
  echo ""
  echo "Arguments:"
  echo "  service    Service name to rollback"
  echo ""
  echo "Options:"
  echo "  --list     Show deployment history"
  echo "  --to       Rollback to specific image"
  echo ""
  echo "Examples:"
  echo "  $0 query-service"
  echo "  $0 query-service --list"
  echo "  $0 query-service --to ghcr.io/repo/query-service:abc123"
  exit 1
}

show_history() {
  echo "Deployment History for $SERVICE:"
  echo ""
  if [ -f "${HISTORY_DIR}/${SERVICE}-current" ]; then
    echo "  Current: $(cat ${HISTORY_DIR}/${SERVICE}-current)"
  fi
  if [ -f "${HISTORY_DIR}/${SERVICE}-previous" ]; then
    echo "  Previous: $(cat ${HISTORY_DIR}/${SERVICE}-previous)"
  fi
  exit 0
}

# Parse args
TARGET_IMAGE=""
for arg in "$@"; do
  case $arg in
    --list) show_history ;;
    --to) shift; TARGET_IMAGE=$1; shift ;;
    -*) log_error "Unknown option: $arg"; usage ;;
  esac
done

if [ -z "$SERVICE" ]; then
  usage
fi

echo "============================================"
echo " Rollback: $SERVICE"
echo "============================================"

# Determine target image
if [ -n "$TARGET_IMAGE" ]; then
  PREVIOUS_IMAGE="$TARGET_IMAGE"
  log_info "Rolling back to specified image"
else
  PREVIOUS_IMAGE=$(cat "${HISTORY_DIR}/${SERVICE}-previous" 2>/dev/null || echo "")
fi

if [ -z "$PREVIOUS_IMAGE" ]; then
  log_error "No previous version found for $SERVICE"
  echo ""
  echo "Available history:"
  ls -la "$HISTORY_DIR"/ 2>/dev/null || echo "No history directory"
  exit 1
fi

log_info "Target: $PREVIOUS_IMAGE"

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Execute rollback using blue-green
log_info "Executing rollback via blue-green deployment..."
"$SCRIPT_DIR/blue-green.sh" "$SERVICE" "$PREVIOUS_IMAGE"

RESULT=$?
if [ $RESULT -eq 0 ]; then
  echo ""
  echo "============================================"
  log_info "Rollback complete!"
  echo "============================================"
else
  log_error "Rollback failed"
  exit 1
fi
