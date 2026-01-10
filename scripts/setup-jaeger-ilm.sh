#!/bin/bash
# ============================================================
# Setup Elasticsearch ILM Policy for Jaeger Traces
# ============================================================
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/common.sh"

DOCKER_HOST_IP="${DOCKER_HOST_IP:-localhost}"
ES_URL="http://${DOCKER_HOST_IP}:19200"
RETENTION_DAYS="${TRACE_RETENTION_DAYS:-7}"

echo "============================================"
echo "  Setting up Jaeger ILM Policy"
echo "  Retention: ${RETENTION_DAYS} days"
echo "============================================"

# Check ES health
echo -e "\n1. Checking Elasticsearch..."
ES_HEALTH=$(curl -s "${ES_URL}/_cluster/health" | grep -o '"status":"[^"]*"' | cut -d'"' -f4)
if [ "$ES_HEALTH" != "green" ] && [ "$ES_HEALTH" != "yellow" ]; then
    echo -e "   ${RED}✗ Elasticsearch not healthy${NC}"
    exit 1
fi
echo -e "   ${GREEN}✓ ES healthy (${ES_HEALTH})${NC}"

# Create ILM policy
echo -e "\n2. Creating ILM policy 'jaeger-traces-policy'..."
curl -s -X PUT "${ES_URL}/_ilm/policy/jaeger-traces-policy" \
  -H 'Content-Type: application/json' \
  -d "{
    \"policy\": {
      \"phases\": {
        \"hot\": {
          \"min_age\": \"0ms\",
          \"actions\": {
            \"rollover\": {
              \"max_age\": \"1d\",
              \"max_primary_shard_size\": \"50gb\"
            }
          }
        },
        \"warm\": {
          \"min_age\": \"2d\",
          \"actions\": {
            \"forcemerge\": {
              \"max_num_segments\": 1
            },
            \"shrink\": {
              \"number_of_shards\": 1
            }
          }
        },
        \"delete\": {
          \"min_age\": \"${RETENTION_DAYS}d\",
          \"actions\": {
            \"delete\": {}
          }
        }
      }
    }
  }" | grep -q '"acknowledged":true' && echo -e "   ${GREEN}✓ ILM policy created${NC}" || echo -e "   ${YELLOW}⚠ Policy may already exist${NC}"

# Create index template for Jaeger spans
echo -e "\n3. Creating index template for jaeger-span..."
curl -s -X PUT "${ES_URL}/_index_template/jaeger-span-template" \
  -H 'Content-Type: application/json' \
  -d '{
    "index_patterns": ["jaeger-span-*"],
    "template": {
      "settings": {
        "number_of_shards": 1,
        "number_of_replicas": 0,
        "index.lifecycle.name": "jaeger-traces-policy",
        "index.lifecycle.rollover_alias": "jaeger-span"
      }
    }
  }' | grep -q '"acknowledged":true' && echo -e "   ${GREEN}✓ Span template created${NC}" || echo -e "   ${YELLOW}⚠ Template may already exist${NC}"

# Create index template for Jaeger service
echo -e "\n4. Creating index template for jaeger-service..."
curl -s -X PUT "${ES_URL}/_index_template/jaeger-service-template" \
  -H 'Content-Type: application/json' \
  -d '{
    "index_patterns": ["jaeger-service-*"],
    "template": {
      "settings": {
        "number_of_shards": 1,
        "number_of_replicas": 0,
        "index.lifecycle.name": "jaeger-traces-policy",
        "index.lifecycle.rollover_alias": "jaeger-service"
      }
    }
  }' | grep -q '"acknowledged":true' && echo -e "   ${GREEN}✓ Service template created${NC}" || echo -e "   ${YELLOW}⚠ Template may already exist${NC}"

# Show current policy
echo -e "\n5. Verifying ILM policy..."
POLICY=$(curl -s "${ES_URL}/_ilm/policy/jaeger-traces-policy")
if echo "$POLICY" | grep -q "jaeger-traces-policy"; then
    echo -e "   ${GREEN}✓ Policy verified${NC}"
    DELETE_AGE=$(echo "$POLICY" | grep -o '"min_age":"[0-9]*d"' | tail -1 | cut -d'"' -f4)
    echo "   Delete phase: ${DELETE_AGE}"
else
    echo -e "   ${RED}✗ Policy verification failed${NC}"
    exit 1
fi

echo -e "\n============================================"
echo "ILM Policy Setup Complete"
echo "  - Hot phase: Active writes, rollover at 1d or 50GB"
echo "  - Warm phase: After 2d, optimize indices"
echo "  - Delete phase: After ${RETENTION_DAYS}d, remove old data"
echo "============================================"
