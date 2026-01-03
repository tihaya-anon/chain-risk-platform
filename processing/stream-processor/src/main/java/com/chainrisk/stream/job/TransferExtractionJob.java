package com.chainrisk.stream.job;

import com.chainrisk.stream.model.RawBlockData;
import com.chainrisk.stream.model.Transaction;
import com.chainrisk.stream.model.Transfer;
import com.chainrisk.stream.parser.RawBlockDataDeserializer;
import com.chainrisk.stream.parser.TransactionParser;
import com.chainrisk.stream.parser.TransferParser;
import com.chainrisk.stream.serializer.TransferKafkaSerializer;
import com.chainrisk.stream.sink.JdbcSinkFactory;
import com.chainrisk.stream.sink.Neo4jTransferSink;
import com.chainrisk.stream.sink.ProcessingStateTracker;
import org.apache.flink.api.common.eventtime.WatermarkStrategy;
import org.apache.flink.api.java.utils.ParameterTool;
import org.apache.flink.connector.kafka.sink.KafkaRecordSerializationSchema;
import org.apache.flink.connector.kafka.sink.KafkaSink;
import org.apache.flink.connector.kafka.source.KafkaSource;
import org.apache.flink.connector.kafka.source.enumerator.initializer.OffsetsInitializer;
import org.apache.flink.streaming.api.datastream.DataStream;
import org.apache.flink.streaming.api.environment.StreamExecutionEnvironment;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.time.Duration;

/**
 * Main Flink job for Lambda Architecture Speed Layer
 * 
 * Processes raw blockchain data from Kafka and implements dual-write strategy:
 * 1. PostgreSQL - for OLTP queries (Query Service)
 * 2. Neo4j - for real-time graph analysis (Graph Engine)
 * 3. Kafka - notify downstream consumers (Graph Engine incremental analysis)
 * 
 * All data is marked with source='stream' for later batch correction by Spark
 */
public class TransferExtractionJob {
    private static final Logger LOG = LoggerFactory.getLogger(TransferExtractionJob.class);

    public static void main(String[] args) throws Exception {
        // Parse parameters
        ParameterTool params = ParameterTool.fromArgs(args);
        
        // Kafka source configuration
        String kafkaBrokers = params.get("kafka.brokers", "localhost:19092");
        String kafkaTopic = params.get("kafka.topic", "chain-transactions");
        String kafkaGroupId = params.get("kafka.group.id", "stream-processor");

        // Kafka sink configuration (for transfers topic)
        String transfersKafkaBrokers = params.get("kafka.transfers.brokers", kafkaBrokers);
        String transfersTopic = params.get("kafka.transfers.topic", "transfers");

        // PostgreSQL configuration
        String jdbcUrl = params.get("jdbc.url", "jdbc:postgresql://localhost:15432/chainrisk");
        String jdbcUser = params.get("jdbc.user", "chainrisk");
        String jdbcPassword = params.get("jdbc.password", "chainrisk123");

        // Neo4j configuration
        String neo4jUri = params.get("neo4j.uri", "bolt://localhost:17687");
        String neo4jUser = params.get("neo4j.user", "neo4j");
        String neo4jPassword = params.get("neo4j.password", "chainrisk123");

        // Feature flags
        boolean enableNeo4jSink = params.getBoolean("enable.neo4j.sink", true);
        boolean enableKafkaProducer = params.getBoolean("enable.kafka.producer", true);
        boolean enableStateTracking = params.getBoolean("enable.state.tracking", true);

        LOG.info("=== Starting Lambda Architecture Speed Layer ===");
        LOG.info("Kafka source - brokers: {}, topic: {}", kafkaBrokers, kafkaTopic);
        LOG.info("PostgreSQL sink - url: {}", jdbcUrl);
        LOG.info("Neo4j sink - uri: {}, enabled: {}", neo4jUri, enableNeo4jSink);
        LOG.info("Kafka producer - brokers: {}, topic: {}, enabled: {}", 
                transfersKafkaBrokers, transfersTopic, enableKafkaProducer);
        LOG.info("State tracking enabled: {}", enableStateTracking);

        // Create execution environment
        StreamExecutionEnvironment env = StreamExecutionEnvironment.getExecutionEnvironment();

        // Enable checkpointing for fault tolerance
        env.enableCheckpointing(60000); // Checkpoint every 60 seconds
        env.getCheckpointConfig().setMinPauseBetweenCheckpoints(30000);
        env.getCheckpointConfig().setCheckpointTimeout(120000);

        // Create Kafka source for raw block data
        KafkaSource<RawBlockData> kafkaSource = KafkaSource.<RawBlockData>builder()
                .setBootstrapServers(kafkaBrokers)
                .setTopics(kafkaTopic)
                .setGroupId(kafkaGroupId)
                .setStartingOffsets(OffsetsInitializer.earliest())
                .setValueOnlyDeserializer(new RawBlockDataDeserializer())
                .build();

        // Create watermark strategy with bounded out-of-orderness
        WatermarkStrategy<RawBlockData> watermarkStrategy = WatermarkStrategy
                .<RawBlockData>forBoundedOutOfOrderness(Duration.ofMinutes(1))
                .withTimestampAssigner((event, timestamp) -> 
                        event.getTimestamp() != null ? event.getTimestamp() * 1000 : timestamp);

        // Read from Kafka
        DataStream<RawBlockData> rawBlockStream = env
                .fromSource(kafkaSource, watermarkStrategy, "Kafka Source")
                .name("Raw Block Data");

        // Filter out null and invalid blocks
        DataStream<RawBlockData> validBlocks = rawBlockStream
                .filter(block -> block != null && block.isValid())
                .name("Filter Valid Blocks");

        // Create JDBC sink factory
        JdbcSinkFactory sinkFactory = new JdbcSinkFactory(jdbcUrl, jdbcUser, jdbcPassword);

        // ============== Processing State Tracking ==============
        if (enableStateTracking) {
            validBlocks
                    .map(block -> new org.apache.flink.api.java.tuple.Tuple2<>(
                            block.getNetwork(),
                            block.getBlockNumber()))
                    .returns(org.apache.flink.api.common.typeinfo.Types.TUPLE(
                            org.apache.flink.api.common.typeinfo.Types.STRING,
                            org.apache.flink.api.common.typeinfo.Types.LONG))
                    .keyBy(tuple -> tuple.f0)
                    .process(new ProcessingStateTracker(jdbcUrl, jdbcUser, jdbcPassword, "stream-processor"))
                    .name("Processing State Tracker");

            LOG.info("Processing state tracker configured");
        }

        // ============== Transaction Stream ==============
        DataStream<Transaction> transactions = validBlocks
                .flatMap(new TransactionParser())
                .name("Parse Transactions");

        DataStream<Transaction> validTransactions = transactions
                .filter(tx -> tx != null && tx.getHash() != null && tx.getFromAddress() != null)
                .name("Filter Valid Transactions");

        validTransactions
                .addSink(sinkFactory.createTransactionSink())
                .name("Transaction PostgreSQL Sink");

        LOG.info("Transaction sink configured");

        // ============== Transfer Stream (Dual-Write) ==============
        DataStream<Transfer> transfers = validBlocks
                .flatMap(new TransferParser())
                .name("Parse Transfers");

        DataStream<Transfer> validTransfers = transfers
                .filter(transfer -> transfer != null &&
                        transfer.getFromAddress() != null &&
                        transfer.getToAddress() != null)
                .name("Filter Valid Transfers");

        // Sink 1: PostgreSQL (OLTP queries)
        validTransfers
                .addSink(sinkFactory.createTransferSink())
                .name("Transfer PostgreSQL Sink");
        LOG.info("PostgreSQL sink configured");

        // Sink 2: Neo4j (Real-time graph analysis)
        if (enableNeo4jSink) {
            validTransfers
                    .addSink(new Neo4jTransferSink(neo4jUri, neo4jUser, neo4jPassword))
                    .name("Transfer Neo4j Sink");
            LOG.info("Neo4j sink configured");
        }

        // Sink 3: Kafka (Notify Graph Engine for incremental analysis)
        if (enableKafkaProducer) {
            KafkaSink<Transfer> transferKafkaSink = KafkaSink.<Transfer>builder()
                    .setBootstrapServers(transfersKafkaBrokers)
                    .setRecordSerializer(KafkaRecordSerializationSchema.builder()
                            .setTopic(transfersTopic)
                            .setValueSerializationSchema(new TransferKafkaSerializer())
                            .build())
                    .build();

            validTransfers
                    .sinkTo(transferKafkaSink)
                    .name("Transfer Kafka Producer");
            LOG.info("Kafka producer configured");
        }

        // Execute the job
        LOG.info("=== Executing Lambda Speed Layer Job ===");
        env.execute("Lambda Architecture - Speed Layer (Flink Stream)");
    }
}
