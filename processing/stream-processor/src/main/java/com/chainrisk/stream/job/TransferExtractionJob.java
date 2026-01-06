package com.chainrisk.stream.job;

import com.chainrisk.stream.model.RawBlockData;
import com.chainrisk.stream.model.Transaction;
import com.chainrisk.stream.model.Transfer;
import com.chainrisk.stream.parser.RawBlockDataDeserializer;
import com.chainrisk.stream.parser.TransactionParser;
import com.chainrisk.stream.parser.TransferParser;
import com.chainrisk.stream.serializer.TransferKafkaSerializer;
import com.chainrisk.stream.sink.JdbcSinkFactory;
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
 * Processes raw blockchain data from Kafka:
 * 1. PostgreSQL - for OLTP queries (Query Service)
 * 2. Kafka - notify downstream consumers
 * 
 * Neo4j sync is handled by batch processor (Neo4jSyncJob) for consistency.
 * All data is marked with source='stream' for later batch correction.
 */
public class TransferExtractionJob {
    private static final Logger LOG = LoggerFactory.getLogger(TransferExtractionJob.class);

    public static void main(String[] args) throws Exception {
        ParameterTool params = ParameterTool.fromArgs(args);
        
        // Kafka source
        String kafkaBrokers = params.get("kafka.brokers", "localhost:19092");
        String kafkaTopic = params.get("kafka.topic", "chain-transactions");
        String kafkaGroupId = params.get("kafka.group.id", "stream-processor");

        // Kafka sink (transfers topic)
        String transfersKafkaBrokers = params.get("kafka.transfers.brokers", kafkaBrokers);
        String transfersTopic = params.get("kafka.transfers.topic", "transfers");

        // PostgreSQL
        String jdbcUrl = params.get("jdbc.url", "jdbc:postgresql://localhost:15432/chainrisk");
        String jdbcUser = params.get("jdbc.user", "chainrisk");
        String jdbcPassword = params.get("jdbc.password", "chainrisk123");

        // Feature flags
        boolean enableKafkaProducer = params.getBoolean("enable.kafka.producer", true);
        boolean enableStateTracking = params.getBoolean("enable.state.tracking", true);

        LOG.info("=== Lambda Architecture Speed Layer ===");
        LOG.info("Kafka source: {}:{}", kafkaBrokers, kafkaTopic);
        LOG.info("PostgreSQL: {}", jdbcUrl);
        LOG.info("Kafka producer: {} (enabled={})", transfersTopic, enableKafkaProducer);

        StreamExecutionEnvironment env = StreamExecutionEnvironment.getExecutionEnvironment();

        // Checkpointing
        env.enableCheckpointing(60000);
        env.getCheckpointConfig().setMinPauseBetweenCheckpoints(30000);
        env.getCheckpointConfig().setCheckpointTimeout(120000);

        // Kafka source
        KafkaSource<RawBlockData> kafkaSource = KafkaSource.<RawBlockData>builder()
                .setBootstrapServers(kafkaBrokers)
                .setTopics(kafkaTopic)
                .setGroupId(kafkaGroupId)
                .setStartingOffsets(OffsetsInitializer.earliest())
                .setValueOnlyDeserializer(new RawBlockDataDeserializer())
                .build();

        WatermarkStrategy<RawBlockData> watermarkStrategy = WatermarkStrategy
                .<RawBlockData>forBoundedOutOfOrderness(Duration.ofMinutes(1))
                .withTimestampAssigner((event, timestamp) -> 
                        event.getTimestamp() != null ? event.getTimestamp() * 1000 : timestamp);

        DataStream<RawBlockData> rawBlockStream = env
                .fromSource(kafkaSource, watermarkStrategy, "Kafka Source")
                .name("Raw Block Data");

        DataStream<RawBlockData> validBlocks = rawBlockStream
                .filter(block -> block != null && block.isValid())
                .name("Filter Valid Blocks");

        JdbcSinkFactory sinkFactory = new JdbcSinkFactory(jdbcUrl, jdbcUser, jdbcPassword);

        // Processing state tracking
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
        }

        // Transaction stream -> PostgreSQL
        DataStream<Transaction> transactions = validBlocks
                .flatMap(new TransactionParser())
                .name("Parse Transactions");

        DataStream<Transaction> validTransactions = transactions
                .filter(tx -> tx != null && tx.getHash() != null && tx.getFromAddress() != null)
                .name("Filter Valid Transactions");

        validTransactions
                .addSink(sinkFactory.createTransactionSink())
                .name("Transaction PostgreSQL Sink");

        // Transfer stream -> PostgreSQL + Kafka
        DataStream<Transfer> transfers = validBlocks
                .flatMap(new TransferParser())
                .name("Parse Transfers");

        DataStream<Transfer> validTransfers = transfers
                .filter(transfer -> transfer != null &&
                        transfer.getFromAddress() != null &&
                        transfer.getToAddress() != null)
                .name("Filter Valid Transfers");

        validTransfers
                .addSink(sinkFactory.createTransferSink())
                .name("Transfer PostgreSQL Sink");

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
        }

        LOG.info("=== Executing Speed Layer ===");
        env.execute("Lambda Architecture - Speed Layer");
    }
}
