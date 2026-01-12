#!/bin/bash
# ============================================
# Phase 14 Validation Script
# ============================================

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
NC='\033[0m'

pass() { echo -e "${GREEN}✓${NC} $1"; }
fail() { echo -e "${RED}✗${NC} $1"; FAILED=1; }

FAILED=0

echo "============================================"
echo " Phase 14 CI/CD Validation"
echo "============================================"
echo ""

# Check workflows exist
echo "=== GitHub Workflows ==="
[ -f ".github/workflows/ci.yml" ] && pass "CI workflow exists" || fail "CI workflow missing"
[ -f ".github/workflows/build.yml" ] && pass "Build workflow exists" || fail "Build workflow missing"
[ -f ".github/workflows/test.yml" ] && pass "Test workflow exists" || fail "Test workflow missing"
[ -f ".github/workflows/cleanup.yml" ] && pass "Cleanup workflow exists" || fail "Cleanup workflow missing"
[ -f ".github/dependabot.yml" ] && pass "Dependabot config exists" || fail "Dependabot missing"
echo ""

# Validate YAML (basic check)
echo "=== YAML Validation ==="
for f in .github/workflows/*.yml; do
  # Check for valid YAML structure (name field should exist)
  if grep -q "^name:" "$f" 2>/dev/null; then
    pass "$(basename $f) has valid structure"
  else
    fail "$(basename $f) missing name field"
  fi
done
echo ""

# Check deploy scripts
echo "=== Deploy Scripts ==="
[ -f "scripts/deploy/blue-green.sh" ] && pass "Blue-green script exists" || fail "Blue-green missing"
[ -f "scripts/deploy/rollback.sh" ] && pass "Rollback script exists" || fail "Rollback missing"
[ -x "scripts/deploy/blue-green.sh" ] && pass "Blue-green is executable" || fail "Blue-green not executable"
[ -x "scripts/deploy/rollback.sh" ] && pass "Rollback is executable" || fail "Rollback not executable"
echo ""

# Check helper scripts
echo "=== Helper Scripts ==="
[ -f "scripts/wait-for-healthy.sh" ] && pass "Wait-for-healthy exists" || fail "Wait-for-healthy missing"
[ -x "scripts/wait-for-healthy.sh" ] && pass "Wait-for-healthy is executable" || fail "Not executable"
echo ""

# Test dry-run
echo "=== Dry Run Tests ==="
if ./scripts/deploy/blue-green.sh test-service test:latest --dry-run > /dev/null 2>&1; then
  pass "Blue-green dry-run works"
else
  fail "Blue-green dry-run failed"
fi
echo ""

# Summary
echo "============================================"
if [ $FAILED -eq 0 ]; then
  echo -e "${GREEN}All validations passed!${NC}"
  exit 0
else
  echo -e "${RED}Some validations failed${NC}"
  exit 1
fi
