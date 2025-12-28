#!/bin/bash
cd processing/stream-processor

mvn clean package -DskipTests -Plocal
	
java \
    --add-opens java.base/java.util=ALL-UNNAMED \
    --add-opens java.base/java.lang=ALL-UNNAMED \
    --add-opens java.base/java.lang.reflect=ALL-UNNAMED \
    -jar target/stream-processor-1.0.0-SNAPSHOT.jar \
    --kafka.brokers ${KAFKA_BROKERS} \
    --jdbc.url jdbc:postgresql://${POSTGRES_HOST}:${POSTGRES_PORT}/chainrisk