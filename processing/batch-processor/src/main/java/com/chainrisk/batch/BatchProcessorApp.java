package com.chainrisk.batch;

import com.chainrisk.batch.job.ArchiveToHudiJob;
import com.chainrisk.batch.job.FeatureComputeJob;
import com.chainrisk.batch.job.HudiBatchCorrectionJob;
import com.chainrisk.batch.job.LabelIngestionJob;
import com.chainrisk.batch.job.TrainingDataPrepareJob;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Batch Processor Application Entry Point
 * Lambda Architecture - Batch Layer
 * 
 * Unified entry point for all batch processing jobs.
 * 
 * Usage:
 *   java -jar batch-processor.jar <job-name> [options]
 * 
 * Jobs:
 *   archive   - Archive PostgreSQL data to Hudi data lake
 *   correct   - Run batch correction on Hudi historical data
 *   features  - Compute ML features from transfers
 *   labels    - Ingest label data from public sources
 *   training  - Prepare training dataset (features + labels)
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
                    // FeatureComputeJob.main(jobArgs);
                    break;
                    
                case "labels":
                    LOG.info("Running Label Ingestion Job...");
                    LabelIngestionJob.main(jobArgs);
                    break;
                    
                case "training":
                    LOG.info("Running Training Data Prepare Job...");
                    TrainingDataPrepareJob.main(jobArgs);
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
        System.out.println("  archive   - Archive PostgreSQL cold data to Hudi data lake");
        System.out.println("  correct   - Run batch correction on Hudi historical data");
        System.out.println("  features  - Compute ML features from transfers");
        System.out.println("  labels    - Ingest label data from public sources (OFAC, Tornado Cash)");
        System.out.println("  training  - Prepare training dataset (join features + labels)");
        System.out.println();
        System.out.println("Environment variables:");
        System.out.println("  POSTGRES_HOST, POSTGRES_PORT, POSTGRES_DB, POSTGRES_USER, POSTGRES_PASSWORD");
        System.out.println("  MINIO_ENDPOINT, MINIO_ACCESS_KEY, MINIO_SECRET_KEY");
        System.out.println("  HUDI_BASE_PATH, HIVE_METASTORE_URI, SPARK_MASTER");
        System.out.println("  RETENTION_DAYS (for archive job)");
        System.out.println("  START_DATE, END_DATE (for correct job)");
        System.out.println("  NETWORK (for features/training job)");
        System.out.println("  LABEL_SOURCES (for labels job, comma-separated: ofac,tornado,exchange)");
    }
}
