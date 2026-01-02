#!/bin/bash
# ============================================================
# Sparse clone for Docker deployment
# Usage: ./scripts/sparse-clone.sh <repo-url> [target-dir]
# 
# This script clones only the files needed for docker-compose
# ============================================================

set -e

REPO_URL="${1:-}"
TARGET_DIR="${2:-chain-risk-platform}"

if [ -z "$REPO_URL" ]; then
    echo "Usage: $0 <repo-url> [target-dir]"
    echo "Example: $0 https://github.com/user/chain-risk-platform.git"
    exit 1
fi

echo "=== Sparse Clone for Docker Deployment ==="
echo "Repo: $REPO_URL"
echo "Target: $TARGET_DIR"
echo ""

# Clone with sparse checkout (no-cone mode for file-level control)
git clone --filter=blob:none --sparse "$REPO_URL" "$TARGET_DIR"
cd "$TARGET_DIR"

# Use no-cone mode to support individual files (not just directories)
git sparse-checkout set --no-cone \
    docker-compose.yml \
    .env.example \
    infra \
    --skip-checks

echo ""
echo "=== Clone Complete ==="
echo "Files cloned:"
find . -type f -not -path './.git/*'
echo ""
echo "Next steps:"
echo "  cd $TARGET_DIR"
echo "  cp .env.example .env.local"
echo "  # Edit .env.local with your settings"
echo "  docker-compose up -d"
