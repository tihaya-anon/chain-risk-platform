FROM apache/hive:4.0.0

USER root

# Install curl and netcat
RUN apt-get update && apt-get install -y curl netcat-openbsd && rm -rf /var/lib/apt/lists/*

# Download PostgreSQL JDBC driver
RUN curl -L https://jdbc.postgresql.org/download/postgresql-42.7.1.jar \
    -o /opt/hive/lib/postgresql-42.7.1.jar

# Download AWS SDK for S3/MinIO support
RUN curl -L https://repo1.maven.org/maven2/org/apache/hadoop/hadoop-aws/3.3.6/hadoop-aws-3.3.6.jar \
    -o /opt/hive/lib/hadoop-aws-3.3.6.jar && \
    curl -L https://repo1.maven.org/maven2/com/amazonaws/aws-java-sdk-bundle/1.12.367/aws-java-sdk-bundle-1.12.367.jar \
    -o /opt/hive/lib/aws-java-sdk-bundle-1.12.367.jar

# Copy custom entrypoint
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

USER hive

ENTRYPOINT ["/entrypoint.sh"]
