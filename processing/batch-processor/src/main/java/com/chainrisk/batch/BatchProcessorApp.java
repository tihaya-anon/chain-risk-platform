package com.chainrisk.batch;

import com.chainrisk.batch.job.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Batch Processor Application Entry Point
 * Lambda Architecture - Batch Layer
 * 
 * Usage:
 *   java -jar batch-processor.jar <job-name> [options]
 * 
 * Jobs:
 *   archive   - Archive PostgreSQL data to Hudi
 *   correct   - Batch correction on Hudi data
 *   features  - Compute ML features from transfers
 *   labels    - Ingest label data from public sources
 *   training  - Prepare training dataset
 *   neo4j     - Sync transfers to Neo4j graph database
 */
public class BatchProcessorApp {
    private static final Logger LOG = LoggerFactory.getLogger(BatchProcessorApp.class);

    public static void main(String[] args) {
        LOG.info("=== Batch Processor Application ===");
        LOG.info("Lambda Architecture - Batch Layer");

        if (args.length == 0) {
            printUsage();
            System.exit(1);
        }

        String jobName = args[0].toLowerCase();
        String[] jobArgs = new String[args.length - 1];
        System.arraycopy(args, 1, jobArgs, 0, jobArgs.length);

        try {
            switch (jobName) {
                case "archive":
                    LOG.info("Running Archive to Hudi Job...");
                    ArchiveToHudiJob.main(jobArgs);
                    break;
                    
                case "correct":
                    LOG.info("Running Hudi Batch Correction Job...");
                    HudiBatchCorrectionJob.main(jobArgs);
                    break;
                    
                case "features":
                    LOG.info("Running Feature Compute Job...");
                    FeatureComputeJob.main(jobArgs);
                    break;
                    
                case "labels":
                    LOG.info("Running Label Ingestion Job...");
                    LabelIngestionJob.main(jobArgs);
                    break;
                    
                case "training":
                    LOG.info("Running Training Data Prepare Job...");
                    TrainingDataPrepareJob.main(jobArgs);
                    break;
                    
                case "neo4j":
                    LOG.info("Running Neo4j Sync Job...");
                    Neo4jSyncJob.main(jobArgs);
                    break;
                    
                default:
                    LOG.error("Unknown job: {}", jobName);
                    printUsage();
                    System.exit(1);
            }
            
            LOG.info("=== Job {} completed successfully ===", jobName);
            
        } catch (Exception e) {
            LOG.error("Job {} failed", jobName, e);
            System.exit(1);
        }
    }

    private static void printUsage() {
        System.out.println("Usage: java -jar batch-processor.jar <job-name> [options]");
        System.out.println();
        System.out.println("Available jobs:");
        System.out.println("  archive   - Archive PostgreSQL cold data to Hudi");
        System.out.println("  correct   - Batch correction on Hudi historical data");
        System.out.println("  features  - Compute ML features from transfers");
        System.out.println("  labels    - Ingest label data (OFAC, Tornado Cash, Exchange)");
        System.out.println("  training  - Prepare training dataset (features + labels)");
        System.out.println("  neo4j     - Sync transfers to Neo4j graph database");
        System.out.println();
        System.out.println("Environment variables:");
        System.out.println("  POSTGRES_HOST, POSTGRES_PORT, POSTGRES_DB, POSTGRES_USER, POSTGRES_PASSWORD");
        System.out.println("  MINIO_ENDPOINT, MINIO_ACCESS_KEY, MINIO_SECRET_KEY");
        System.out.println("  HUDI_BASE_PATH, HIVE_METASTORE_URI, SPARK_MASTER");
        System.out.println("  NEO4J_URI, NEO4J_USER, NEO4J_PASSWORD");
        System.out.println("  NETWORK, RETENTION_DAYS, FULL_SYNC");
    }
}
