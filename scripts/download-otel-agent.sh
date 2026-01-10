#!/bin/bash
# Download OpenTelemetry Java Agent for tracing

set -e

OTEL_VERSION="${OTEL_VERSION:-2.10.0}"
OTEL_AGENT_JAR="opentelemetry-javaagent.jar"
OTEL_DIR="$(dirname "$0")/../infra/otel"

mkdir -p "$OTEL_DIR"

if [ -f "$OTEL_DIR/$OTEL_AGENT_JAR" ]; then
    echo "✅ OTel agent already exists: $OTEL_DIR/$OTEL_AGENT_JAR"
    exit 0
fi

echo "📦 Downloading OpenTelemetry Java Agent v${OTEL_VERSION}..."

curl -L -o "$OTEL_DIR/$OTEL_AGENT_JAR" \
    "https://github.com/open-telemetry/opentelemetry-java-instrumentation/releases/download/v${OTEL_VERSION}/opentelemetry-javaagent.jar"

echo "✅ Downloaded to $OTEL_DIR/$OTEL_AGENT_JAR"
