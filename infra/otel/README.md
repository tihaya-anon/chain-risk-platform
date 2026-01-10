# OpenTelemetry Agent Setup

## Download Agent

```bash
./scripts/download-otel-agent.sh
```

## Configuration

Agent properties: `otel-agent.properties`

Key settings:
- OTLP endpoint: Jaeger at `localhost:4317`
- Traces only (metrics via Prometheus, logs via Loki)
- Auto-instrumentation for JDBC, Kafka, Spring

## Service-specific Usage

### graph-service (Spring Boot)

```bash
java -javaagent:infra/otel/opentelemetry-javaagent.jar \
     -Dotel.javaagent.configuration-file=infra/otel/otel-agent.properties \
     -Dotel.service.name=graph-service \
     -jar services/graph-service/target/graph-service-1.0.0-SNAPSHOT.jar
```

### stream-processor (Flink)

```bash
java -javaagent:infra/otel/opentelemetry-javaagent.jar \
     -Dotel.javaagent.configuration-file=infra/otel/otel-agent.properties \
     -Dotel.service.name=stream-processor \
     -jar processing/stream-processor/target/stream-processor-1.0.0-SNAPSHOT.jar
```

### batch-processor (Spark)

For Spark jobs, add to spark-submit:

```bash
spark-submit \
    --conf "spark.driver.extraJavaOptions=-javaagent:/path/to/opentelemetry-javaagent.jar -Dotel.service.name=batch-processor" \
    --conf "spark.executor.extraJavaOptions=-javaagent:/path/to/opentelemetry-javaagent.jar -Dotel.service.name=batch-processor" \
    ...
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| OTEL_SERVICE_NAME | unknown-service | Service name in traces |
| OTEL_EXPORTER_OTLP_ENDPOINT | http://localhost:4317 | Jaeger OTLP gRPC |
| OTEL_ENV | dev | deployment.environment attribute |
