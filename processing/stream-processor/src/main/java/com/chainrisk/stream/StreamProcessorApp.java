package com.chainrisk.stream;

import com.chainrisk.stream.job.TransferExtractionJob;
import org.apache.flink.api.java.utils.ParameterTool;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.InputStream;
import java.util.stream.Stream;

/**
 * Main entry point for the Stream Processor application
 */
public class StreamProcessorApp {
    private static final Logger LOG = LoggerFactory.getLogger(StreamProcessorApp.class);

    public static void main(String[] args) throws Exception {
        LOG.info("===========================================");
        LOG.info("  Chain Risk Platform - Stream Processor");
        LOG.info("===========================================");

        // Load default configuration
        ParameterTool defaultParams = loadDefaultConfig();

        // Override with command line arguments
        ParameterTool params = ParameterTool.fromArgs(args);

        ParameterTool finalParams = defaultParams.mergeWith(params);

        // Determine which job to run
        String jobName = finalParams.get("job", "transfer-extraction");

        LOG.info("Starting job: {}", jobName);

        switch (jobName) {
            case "transfer-extraction":
                TransferExtractionJob.main(toArgs(finalParams));
                break;
            // Add more jobs here as needed
            // case "aggregation":
            // AggregationJob.main(toArgs(finalParams));
            // break;
            default:
                LOG.error("Unknown job: {}", jobName);
                System.exit(1);
        }
    }

    private static ParameterTool loadDefaultConfig() {
        try (InputStream is = StreamProcessorApp.class.getResourceAsStream("/application.properties")) {
            if (is != null) {
                return ParameterTool.fromPropertiesFile(is);
            }
        } catch (Exception e) {
            LOG.warn("Could not load default configuration", e);
        }
        return ParameterTool.fromArgs(new String[] {});
    }

    private static String[] toArgs(ParameterTool params) {
        return params.toMap().entrySet().stream()
                .flatMap(e -> Stream.of("--" + e.getKey(), e.getValue()))
                .toArray(String[]::new);
    }
}
