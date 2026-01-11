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

RUN apk --no-cache add curl && \
    adduser -D -u 1000 appuser && \
    mkdir -p /app/logs && chown appuser:appuser /app/logs

COPY --from=builder /app/target/orchestrator-*.jar /app/app.jar

USER appuser

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
  CMD curl -f http://localhost:8080/actuator/health || exit 1

ENTRYPOINT ["java", "-XX:+UseG1GC", "-XX:MaxRAMPercentage=75.0", "-jar", "/app/app.jar"]
