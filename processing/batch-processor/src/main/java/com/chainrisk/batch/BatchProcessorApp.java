package com.chainrisk.batch;

import com.chainrisk.batch.job.TransferCorrectionJob;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Batch Processor Application Entry Point
 * Lambda Architecture - Batch Layer
 */
public class BatchProcessorApp {
    private static final Logger LOG = LoggerFactory.getLogger(BatchProcessorApp.class);

    public static void main(String[] args) {
        LOG.info("Starting Batch Processor Application");
        LOG.info("Lambda Architecture - Batch Layer");
        
        // For now, only run TransferCorrectionJob
        // In future, can dispatch to different jobs based on arguments
        TransferCorrectionJob.main(args);
    }
}
