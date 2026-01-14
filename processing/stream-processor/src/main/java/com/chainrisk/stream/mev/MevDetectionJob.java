package com.chainrisk.stream.mev;

import com.chainrisk.stream.mev.detector.AbnormalGasDetector;
import com.chainrisk.stream.mev.detector.FrontRunDetector;
import com.chainrisk.stream.mev.detector.SandwichDetector;
import com.chainrisk.stream.mev.model.MevAlert;
import com.chainrisk.stream.mev.model.PendingTx;
import com.chainrisk.stream.mev.pattern.MevPatterns;
import org.apache.flink.api.common.eventtime.WatermarkStrategy;
import org.apache.flink.api.java.utils.ParameterTool;
import org.apache.flink.cep.CEP;
import org.apache.flink.cep.PatternStream;
import org.apache.flink.connector.kafka.sink.KafkaRecordSerializationSchema;
import org.apache.flink.connector.kafka.sink.KafkaSink;
import org.apache.flink.connector.kafka.source.KafkaSource;
import org.apache.flink.connector.kafka.source.enumerator.initializer.OffsetsInitializer;
import org.apache.flink.streaming.api.datastream.DataStream;
import org.apache.flink.streaming.api.environment.StreamExecutionEnvironment;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.math.BigInteger;
import java.time.Duration;

/**
 * Flink job for MEV detection using CEP patterns
 *
 * Consumes: mempool-pending-txs
 * Produces: mev-alerts
 */
public class MevDetectionJob {
    private static final Logger LOG = LoggerFactory.getLogger(MevDetectionJob.class);

    public static void main(String[] args) throws Exception {
        ParameterTool params = ParameterTool.fromArgs(args);

        // Kafka config
        String kafkaBrokers = params.get("kafka.brokers", "localhost:19092");
        String inputTopic = params.get("kafka.input.topic", "mempool-pending-txs");
        String outputTopic = params.get("kafka.output.topic", "mev-alerts");
        String groupId = params.get("kafka.group.id", "mev-detector");

        // Detection config
        String abnormalGasThreshold = params.get("abnormal.gas.threshold", "200000000000"); // 200 Gwei
        boolean enableSandwich = params.getBoolean("enable.sandwich", true);
        boolean enableFrontRun = params.getBoolean("enable.frontrun", true);
        boolean enableAbnormalGas = params.getBoolean("enable.abnormal.gas", true);

        LOG.info("=== MEV Detection Job ===");
        LOG.info("Input: {}", inputTopic);
        LOG.info("Output: {}", outputTopic);

        StreamExecutionEnvironment env = StreamExecutionEnvironment.getExecutionEnvironment();
        env.enableCheckpointing(30000);
        env.getCheckpointConfig().setMinPauseBetweenCheckpoints(15000);

        // Kafka source
        KafkaSource<PendingTx> source = KafkaSource.<PendingTx>builder()
            .setBootstrapServers(kafkaBrokers)
            .setTopics(inputTopic)
            .setGroupId(groupId)
            .setStartingOffsets(OffsetsInitializer.latest())
            .setValueOnlyDeserializer(new PendingTxDeserializer())
            .build();

        WatermarkStrategy<PendingTx> watermarkStrategy = WatermarkStrategy
            .<PendingTx>forBoundedOutOfOrderness(Duration.ofSeconds(5))
            .withTimestampAssigner((tx, ts) -> tx.getTimestamp());

        DataStream<PendingTx> pendingTxStream = env
            .fromSource(source, watermarkStrategy, "Mempool Source")
            .filter(tx -> tx != null && tx.isDexSwap())
            .keyBy(PendingTx::extractTargetToken);

        // Kafka sink
        KafkaSink<MevAlert> alertSink = KafkaSink.<MevAlert>builder()
            .setBootstrapServers(kafkaBrokers)
            .setRecordSerializer(KafkaRecordSerializationSchema.builder()
                .setTopic(outputTopic)
                .setValueSerializationSchema(new MevAlertSerializer())
                .build())
            .build();

        // Sandwich detection
        if (enableSandwich) {
            PatternStream<PendingTx> sandwichPatternStream = CEP.pattern(
                pendingTxStream,
                MevPatterns.sandwichPattern()
            );
            DataStream<MevAlert> sandwichAlerts = sandwichPatternStream
                .process(new SandwichDetector())
                .name("Sandwich Detector");
            sandwichAlerts.sinkTo(alertSink).name("Sandwich Alerts Sink");
        }

        // Front-run detection
        if (enableFrontRun) {
            PatternStream<PendingTx> frontRunPatternStream = CEP.pattern(
                pendingTxStream,
                MevPatterns.frontRunPattern()
            );
            DataStream<MevAlert> frontRunAlerts = frontRunPatternStream
                .process(new FrontRunDetector())
                .name("FrontRun Detector");
            frontRunAlerts.sinkTo(alertSink).name("FrontRun Alerts Sink");
        }

        // Abnormal gas detection
        if (enableAbnormalGas) {
            BigInteger threshold = new BigInteger(abnormalGasThreshold);
            DataStream<MevAlert> abnormalGasAlerts = pendingTxStream
                .filter(tx -> tx.getEffectiveGasPrice().compareTo(threshold) > 0)
                .map(new AbnormalGasDetector(threshold))
                .name("Abnormal Gas Detector");
            abnormalGasAlerts.sinkTo(alertSink).name("Abnormal Gas Alerts Sink");
        }

        LOG.info("=== Starting MEV Detection ===");
        env.execute("MEV Detection Job");
    }
}
