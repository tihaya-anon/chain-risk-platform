# Processing: Flink & Spark

# Stream Processor (Flink)
flink-build:
	@bash -c 'cd $(DIR_FLINK) && $(JAVA17_ENV) mvn package $(MVN_SKIP_TESTS) -Plocal $(MVN_QUIET)'

flink-run:
	@bash -c '$(LOAD_ENV) ./scripts/run-flink.sh'

flink-run-otel: otel-download
	@bash -c '$(LOAD_ENV) OTEL_ENABLED=true ./scripts/run-flink.sh'

flink-test:
	@bash -c 'cd $(DIR_FLINK) && $(JAVA17_ENV) mvn test'

flink-clean:
	@bash -c 'cd $(DIR_FLINK) && $(JAVA17_ENV) mvn clean $(MVN_QUIET)'

flink-stop:
	@tmux kill-session -t flink-stream 2>/dev/null || pkill -f "stream-processor.*\.jar" 2>/dev/null || true

# Batch Processor (Spark)
batch-build:
	@bash -c 'cd $(DIR_BATCH) && $(JAVA17_ENV) mvn package $(MVN_SKIP_TESTS) -Plocal $(MVN_QUIET)'

batch-test:
	@bash -c 'cd $(DIR_BATCH) && $(JAVA17_ENV) mvn test'

batch-clean:
	@bash -c 'cd $(DIR_BATCH) && $(JAVA17_ENV) mvn clean $(MVN_QUIET)'

batch-archive:
	@bash -c '$(LOAD_ENV) ./scripts/run-batch-processor.sh archive'

batch-features:
	@bash -c '$(LOAD_ENV) ./scripts/run-batch-processor.sh features'

batch-labels:
	@bash -c '$(LOAD_ENV) ./scripts/run-batch-processor.sh labels'

batch-training:
	@bash -c '$(LOAD_ENV) ./scripts/run-batch-processor.sh training'

batch-neo4j:
	@bash -c '$(LOAD_ENV) ./scripts/run-batch-processor.sh neo4j'
