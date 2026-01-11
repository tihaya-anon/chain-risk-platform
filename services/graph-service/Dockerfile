# Build stage
FROM maven:3.9-eclipse-temurin-17-alpine AS builder
WORKDIR /app

COPY pom.xml .
RUN mvn dependency:go-offline -B

COPY src ./src
RUN mvn package -DskipTests -q

# Runtime stage
FROM eclipse-temurin:17-jre-alpine
WORKDIR /app

# Install curl for healthcheck and download OTel agent
ARG OTEL_VERSION=2.10.0
RUN apk --no-cache add curl && \
    adduser -D -u 1000 appuser && \
    mkdir -p /app/logs && chown appuser:appuser /app/logs && \
    curl -L -o /app/opentelemetry-javaagent.jar \
        "https://github.com/open-telemetry/opentelemetry-java-instrumentation/releases/download/v${OTEL_VERSION}/opentelemetry-javaagent.jar"

COPY --from=builder /app/target/graph-service-*.jar /app/app.jar

# OTel configuration
ENV JAVA_TOOL_OPTIONS="-javaagent:/app/opentelemetry-javaagent.jar"
ENV OTEL_SERVICE_NAME=graph-service
ENV OTEL_EXPORTER_OTLP_ENDPOINT=http://jaeger:4317
ENV OTEL_EXPORTER_OTLP_PROTOCOL=grpc
ENV OTEL_TRACES_EXPORTER=otlp
ENV OTEL_METRICS_EXPORTER=none
ENV OTEL_LOGS_EXPORTER=none
ENV OTEL_PROPAGATORS=tracecontext,baggage

USER appuser

EXPOSE 8084

HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
  CMD curl -f http://localhost:8084/actuator/health || exit 1

ENTRYPOINT ["java", "-XX:+UseG1GC", "-XX:MaxRAMPercentage=75.0", "-jar", "/app/app.jar"]
