package com.chainrisk.stream.parser;

import com.chainrisk.stream.model.ChainEvent;
import com.chainrisk.stream.model.Transaction;
import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import org.apache.flink.api.common.functions.FlatMapFunction;
import org.apache.flink.util.Collector;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Parses ChainEvent and extracts Transaction records
 */
public class TransactionParser implements FlatMapFunction<ChainEvent, Transaction> {
    private static final long serialVersionUID = 1L;
    private static final Logger LOG = LoggerFactory.getLogger(TransactionParser.class);

    private transient ObjectMapper objectMapper;

    @Override
    public void flatMap(ChainEvent event, Collector<Transaction> out) throws Exception {
        if (objectMapper == null) {
            initObjectMapper();
        }

        try {
            if (event.isTransaction()) {
                parseTransaction(event, out);
            }
        } catch (Exception e) {
            LOG.error("Error parsing transaction event: {}", event, e);
        }
    }

    private void initObjectMapper() {
        objectMapper = new ObjectMapper();
        objectMapper.registerModule(new JavaTimeModule());
        objectMapper.configure(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES, false);
    }

    /**
     * Parse transaction from ChainEvent
     */
    private void parseTransaction(ChainEvent event, Collector<Transaction> out) throws Exception {
        Transaction tx = objectMapper.treeToValue(event.getData(), Transaction.class);

        if (tx == null) {
            LOG.warn("Failed to parse transaction from event: {}", event);
            return;
        }

        // Set network from event
        tx.setNetwork(event.getNetwork());

        out.collect(tx);
        LOG.debug("Parsed transaction: {}", tx);
    }
}
