#!/bin/bash
# ============================================================
# Monitoring Verification Script
# ============================================================
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$(dirname "$SCRIPT_DIR")")"

source "$PROJECT_ROOT/scripts/common.sh"

NAMESPACE="chain-risk-staging"
PROMETHEUS_URL="${PROMETHEUS_URL:-http://localhost:9090}"
GRAFANA_URL="${GRAFANA_URL:-http://localhost:3000}"

log_section "Monitoring Verification"

# Check Prometheus targets
check_prometheus() {
    log_info "Checking Prometheus targets..."
    
    local targets=$(curl -s "$PROMETHEUS_URL/api/v1/targets" 2>/dev/null)
    if [ -z "$targets" ]; then
        log_warn "Cannot connect to Prometheus at $PROMETHEUS_URL"
        return 1
    fi
    
    local up_count=$(echo "$targets" | jq '[.data.activeTargets[] | select(.health=="up")] | length' 2>/dev/null || echo "0")
    local total_count=$(echo "$targets" | jq '.data.activeTargets | length' 2>/dev/null || echo "0")
    
    log_info "Prometheus targets: $up_count/$total_count up"
    
    if [ "$up_count" -lt "$total_count" ]; then
        log_warn "Some targets down:"
        echo "$targets" | jq -r '.data.activeTargets[] | select(.health!="up") | "\(.labels.job): \(.health)"' 2>/dev/null
    fi
    
    return 0
}

# Check Grafana dashboards
check_grafana() {
    log_info "Checking Grafana dashboards..."
    
    local dashboards=$(curl -s "$GRAFANA_URL/api/search?type=dash-db" 2>/dev/null)
    if [ -z "$dashboards" ]; then
        log_warn "Cannot connect to Grafana at $GRAFANA_URL"
        return 1
    fi
    
    local count=$(echo "$dashboards" | jq 'length' 2>/dev/null || echo "0")
    log_info "Grafana dashboards found: $count"
    
    # List dashboards
    echo "$dashboards" | jq -r '.[].title' 2>/dev/null | while read title; do
        log_info "  - $title"
    done
    
    return 0
}

# Check key metrics exist
check_metrics() {
    log_info "Checking key metrics..."
    
    metrics=(
        "http_requests_total"
        "http_request_duration_seconds"
        "process_cpu_seconds_total"
        "process_resident_memory_bytes"
    )
    
    local found=0
    for metric in "${metrics[@]}"; do
        local result=$(curl -s "$PROMETHEUS_URL/api/v1/query?query=$metric" 2>/dev/null)
        local count=$(echo "$result" | jq '.data.result | length' 2>/dev/null || echo "0")
        
        if [ "$count" -gt 0 ]; then
            log_info "  $metric: $count series ✓"
            ((found++))
        else
            log_warn "  $metric: not found"
        fi
    done
    
    log_info "Metrics found: $found/${#metrics[@]}"
    return 0
}

# Check alerting rules
check_alerts() {
    log_info "Checking alerting rules..."
    
    local rules=$(curl -s "$PROMETHEUS_URL/api/v1/rules" 2>/dev/null)
    if [ -z "$rules" ]; then
        log_warn "Cannot fetch alerting rules"
        return 1
    fi
    
    local rule_count=$(echo "$rules" | jq '[.data.groups[].rules[]] | length' 2>/dev/null || echo "0")
    local firing=$(echo "$rules" | jq '[.data.groups[].rules[] | select(.state=="firing")] | length' 2>/dev/null || echo "0")
    
    log_info "Alerting rules: $rule_count total, $firing firing"
    
    if [ "$firing" -gt 0 ]; then
        log_warn "Firing alerts:"
        echo "$rules" | jq -r '.data.groups[].rules[] | select(.state=="firing") | "  - \(.name): \(.alerts | length) instances"' 2>/dev/null
    fi
    
    return 0
}

# Generate report
generate_report() {
    log_section "Monitoring Report"
    
    cat << EOF

=== Monitoring Verification Report ===
Date: $(date -u +"%Y-%m-%d %H:%M:%S UTC")
Namespace: $NAMESPACE

Prometheus: $PROMETHEUS_URL
Grafana: $GRAFANA_URL

EOF

    check_prometheus
    check_grafana
    check_metrics
    check_alerts
    
    echo ""
    log_info "Report complete"
}

# Main
case "${1:-report}" in
    prometheus)
        check_prometheus
        ;;
    grafana)
        check_grafana
        ;;
    metrics)
        check_metrics
        ;;
    alerts)
        check_alerts
        ;;
    report)
        generate_report
        ;;
    *)
        echo "Usage: $0 {prometheus|grafana|metrics|alerts|report}"
        exit 1
        ;;
esac
