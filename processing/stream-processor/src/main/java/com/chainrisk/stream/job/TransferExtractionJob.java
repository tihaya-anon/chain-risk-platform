package com.chainrisk.stream.job;

import com.chainrisk.stream.model.ChainEvent;
import com.chainrisk.stream.model.Transfer;
import com.chainrisk.stream.parser.ChainEventDeserializer;
import com.chainrisk.stream.parser.TransferParser;
import com.chainrisk.stream.sink.JdbcSinkFactory;
import org.apache.flink.api.common.eventtime.WatermarkStrategy;
import org.apache.flink.api.java.utils.ParameterTool;
import org.apache.flink.connector.kafka.source.KafkaSource;
import org.apache.flink.connector.kafka.source.enumerator.initializer.OffsetsInitializer;
import org.apache.flink.streaming.api.datastream.DataStream;
import org.apache.flink.streaming.api.environment.StreamExecutionEnvironment;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.time.Duration;

/**
 * Main Flink job for processing blockchain transactions and extracting transfers
 */
public class TransferExtractionJob {
    private static final Logger LOG = LoggerFactory.getLogger(TransferExtractionJob.class);

    public static void main(String[] args) throws Exception {
        // Parse parameters
        ParameterTool params = ParameterTool.fromArgs(args);
        
        // Kafka configuration
        String kafkaBrokers = params.get("kafka.brokers", "localhost:9092");
        String kafkaTopic = params.get("kafka.topic", "chain-transactions");
        String kafkaGroupId = params.get("kafka.group.id", "stream-processor");
        
        // PostgreSQL configuration
        String jdbcUrl = params.get("jdbc.url", "jdbc:postgresql://localhost:5432/chainrisk");
        String jdbcUser = params.get("jdbc.user", "chainrisk");
        String jdbcPassword = params.get("jdbc.password", "chainrisk123");

        LOG.info("Starting Transfer Extraction Job");
        LOG.info("Kafka brokers: {}", kafkaBrokers);
        LOG.info("Kafka topic: {}", kafkaTopic);

        // Create execution environment
        StreamExecutionEnvironment env = StreamExecutionEnvironment.getExecutionEnvironment();
        
        // Enable checkpointing for fault tolerance
        env.enableCheckpointing(60000); // Checkpoint every 60 seconds
        env.getCheckpointConfig().setMinPauseBetweenCheckpoints(30000);
        env.getCheckpointConfig().setCheckpointTimeout(120000);

        // Create Kafka source
        KafkaSource<ChainEvent> kafkaSource = KafkaSource.<ChainEvent>builder()
            .setBootstrapServers(kafkaBrokers)
            .setTopics(kafkaTopic)
            .setGroupId(kafkaGroupId)
            .setStartingOffsets(OffsetsInitializer.earliest())
            .setValueOnlyDeserializer(new ChainEventDeserializer())
            .build();

        // Create watermark strategy with bounded out-of-orderness
        WatermarkStrategy<ChainEvent> watermarkStrategy = WatermarkStrategy
            .<ChainEvent>forBoundedOutOfOrderness(Duration.ofMinutes(1))
            .withTimestampAssigner((event, timestamp) -> 
                event.getTimestamp() != null ? event.getTimestamp().toEpochMilli() : timestamp);

        // Read from Kafka
        DataStream<ChainEvent> eventStream = env
            .fromSource(kafkaSource, watermarkStrategy, "Kafka Source")
            .name("Chain Events");

        // Filter out null events
        DataStream<ChainEvent> validEvents = eventStream
            .filter(event -> event != null && event.getData() != null)
            .name("Filter Valid Events");

        // Parse events and extract transfers
        DataStream<Transfer> transfers = validEvents
            .flatMap(new TransferParser())
            .name("Parse Transfers");

        // Filter out null transfers
        DataStream<Transfer> validTransfers = transfers
            .filter(transfer -> transfer != null && 
                               transfer.getFromAddress() != null && 
                               transfer.getToAddress() != null)
            .name("Filter Valid Transfers");

        // Create JDBC sink
        JdbcSinkFactory sinkFactory = new JdbcSinkFactory(jdbcUrl, jdbcUser, jdbcPassword);

        // Write to PostgreSQL
        validTransfers
            .addSink(sinkFactory.createTransferSink())
            .name("PostgreSQL Sink");

        // Execute the job
        env.execute("Transfer Extraction Job");
    }
}
