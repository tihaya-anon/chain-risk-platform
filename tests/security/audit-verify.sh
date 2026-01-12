#!/bin/bash
# Audit Log Verification Script
# Verifies audit logging is working correctly across all services

set -euo pipefail

LOKI_URL="${LOKI_URL:-http://localhost:3100}"
TIME_RANGE="${TIME_RANGE:-15m}"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

PASS=0
FAIL=0

log_pass() { echo -e "${GREEN}[PASS]${NC} $1"; ((PASS++)); }
log_fail() { echo -e "${RED}[FAIL]${NC} $1"; ((FAIL++)); }
log_info() { echo -e "${YELLOW}[INFO]${NC} $1"; }

# Services to verify
SERVICES=("query-service" "alert-service" "risk-ml-service" "graph-service" "orchestrator" "bff")

# Required audit event types
AUDIT_EVENTS=("AUTH" "ACCESS" "MODIFY" "ADMIN" "SECURITY")

query_loki() {
    local query=$1
    local result
    
    result=$(curl -s -G "${LOKI_URL}/loki/api/v1/query_range" \
        --data-urlencode "query=${query}" \
        --data-urlencode "start=$(date -v-${TIME_RANGE} +%s 2>/dev/null || date -d "-${TIME_RANGE}" +%s)000000000" \
        --data-urlencode "end=$(date +%s)000000000" \
        --data-urlencode "limit=100" 2>/dev/null)
    
    echo "$result"
}

count_events() {
    local query=$1
    local result
    
    result=$(query_loki "$query")
    
    if [ -z "$result" ]; then
        echo "0"
        return
    fi
    
    local count
    count=$(echo "$result" | jq -r '.data.result | length' 2>/dev/null || echo "0")
    echo "$count"
}

check_audit_events_exist() {
    log_info "Checking audit events exist in Loki..."
    
    local total
    total=$(count_events '{job="chainrisk"} |= "AUDIT"')
    
    if [ "$total" -gt 0 ]; then
        log_pass "Found $total audit events in Loki"
        return 0
    else
        log_fail "No audit events found in Loki"
        return 1
    fi
}

check_service_audit_logs() {
    local service=$1
    log_info "Checking audit logs for: $service"
    
    local count
    count=$(count_events "{service=\"${service}\"} |= \"AUDIT\"")
    
    if [ "$count" -gt 0 ]; then
        log_pass "$service: $count audit events"
        return 0
    else
        log_fail "$service: No audit events found"
        return 1
    fi
}

check_event_type() {
    local event_type=$1
    log_info "Checking event type: $event_type"
    
    local count
    count=$(count_events "{job=\"chainrisk\"} |~ \"event_type.*${event_type}\"")
    
    if [ "$count" -gt 0 ]; then
        log_pass "Event type $event_type: $count events"
        return 0
    else
        log_info "Event type $event_type: No events (may be expected)"
        return 0
    fi
}

check_event_schema() {
    log_info "Checking audit event schema..."
    
    local result
    result=$(query_loki '{job="chainrisk"} |= "AUDIT" | json')
    
    if [ -z "$result" ]; then
        log_fail "Cannot retrieve events for schema validation"
        return 1
    fi
    
    # Check for required fields in audit events
    local required_fields=("event_type" "timestamp" "service")
    local sample_event
    sample_event=$(echo "$result" | jq -r '.data.result[0].values[0][1]' 2>/dev/null)
    
    if [ -z "$sample_event" ] || [ "$sample_event" == "null" ]; then
        log_info "No events available for schema validation"
        return 0
    fi
    
    local all_present=true
    for field in "${required_fields[@]}"; do
        if echo "$sample_event" | jq -e ".${field}" > /dev/null 2>&1; then
            log_pass "Schema field present: $field"
        else
            log_fail "Schema field missing: $field"
            all_present=false
        fi
    done
    
    $all_present
}

check_sensitive_data_masking() {
    log_info "Checking sensitive data masking..."
    
    # Check that passwords are not logged in plain text
    local password_count
    password_count=$(count_events '{job="chainrisk"} |~ "password.*[a-zA-Z0-9]{8,}"')
    
    if [ "$password_count" -eq 0 ]; then
        log_pass "No plaintext passwords found in logs"
    else
        log_fail "Possible plaintext passwords found: $password_count occurrences"
        return 1
    fi
    
    # Check that API keys are masked
    local apikey_count
    apikey_count=$(count_events '{job="chainrisk"} |~ "api_key.*[a-zA-Z0-9]{20,}"')
    
    if [ "$apikey_count" -eq 0 ]; then
        log_pass "No exposed API keys found in logs"
    else
        log_fail "Possible exposed API keys: $apikey_count occurrences"
        return 1
    fi
    
    return 0
}

check_rate_limit_events() {
    log_info "Checking rate limit audit events..."
    
    local count
    count=$(count_events '{job="chainrisk"} |~ "rate.?limit|429|too.?many"')
    
    log_info "Rate limit events found: $count"
    return 0
}

check_auth_events() {
    log_info "Checking authentication audit events..."
    
    local login_count
    login_count=$(count_events '{job="chainrisk"} |~ "login|auth|token"')
    
    log_info "Auth events found: $login_count"
    return 0
}

generate_test_events() {
    log_info "Generating test audit events..."
    
    # Make some API calls to generate audit events
    local test_address="0x742d35Cc6634C0532925a3b844Bc9e7595f8fE00"
    
    # Query service
    curl -s "http://localhost:8081/api/v1/addresses/${test_address}" > /dev/null 2>&1 || true
    
    # Risk service
    curl -s "http://localhost:8082/api/v1/risk/${test_address}" > /dev/null 2>&1 || true
    
    # Alert service
    curl -s "http://localhost:8083/api/v1/rules" > /dev/null 2>&1 || true
    
    # Graph service
    curl -s "http://localhost:8084/api/v1/graph/address/${test_address}" > /dev/null 2>&1 || true
    
    # Wait for logs to be ingested
    sleep 3
    
    log_info "Test events generated"
}

main() {
    echo "=============================================="
    echo "  Audit Log Verification"
    echo "=============================================="
    echo "Loki URL: $LOKI_URL"
    echo "Time Range: $TIME_RANGE"
    echo ""
    
    # Check Loki connectivity
    if ! curl -s "${LOKI_URL}/ready" > /dev/null 2>&1; then
        log_fail "Cannot connect to Loki at $LOKI_URL"
        exit 1
    fi
    log_pass "Loki connection OK"
    
    # Generate test events if requested
    if [ "${GENERATE_EVENTS:-false}" == "true" ]; then
        generate_test_events
    fi
    
    echo ""
    echo "--- Event Existence ---"
    check_audit_events_exist || true
    
    echo ""
    echo "--- Per-Service Audit Logs ---"
    for service in "${SERVICES[@]}"; do
        check_service_audit_logs "$service" || true
    done
    
    echo ""
    echo "--- Event Types ---"
    for event_type in "${AUDIT_EVENTS[@]}"; do
        check_event_type "$event_type" || true
    done
    
    echo ""
    echo "--- Schema Validation ---"
    check_event_schema || true
    
    echo ""
    echo "--- Security Checks ---"
    check_sensitive_data_masking || true
    check_rate_limit_events || true
    check_auth_events || true
    
    echo ""
    echo "=============================================="
    echo "  Summary: $PASS passed, $FAIL failed"
    echo "=============================================="
    
    [ "$FAIL" -eq 0 ]
}

main "$@"
