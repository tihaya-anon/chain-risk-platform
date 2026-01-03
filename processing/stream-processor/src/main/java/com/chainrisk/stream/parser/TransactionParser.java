package com.chainrisk.stream.parser;

import com.chainrisk.stream.model.RawBlockData;
import com.chainrisk.stream.model.Transaction;
import com.fasterxml.jackson.databind.JsonNode;
import org.apache.flink.api.common.functions.FlatMapFunction;
import org.apache.flink.util.Collector;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.math.BigInteger;
import java.time.Instant;

/**
 * Parses RawBlockData and extracts Transaction records
 * Handles the raw Etherscan API response format
 */
public class TransactionParser implements FlatMapFunction<RawBlockData, Transaction> {
    private static final long serialVersionUID = 1L;
    private static final Logger LOG = LoggerFactory.getLogger(TransactionParser.class);

    @Override
    public void flatMap(RawBlockData blockData, Collector<Transaction> out) throws Exception {
        if (blockData == null || !blockData.isValid()) {
            LOG.debug("Skipping invalid block data");
            return;
        }

        try {
            JsonNode result = blockData.getResult();
            JsonNode transactions = result.get("transactions");

            if (transactions == null || !transactions.isArray()) {
                LOG.debug("No transactions in block {}", blockData.getBlockNumber());
                return;
            }

            // Extract block-level data
            String blockHash = getTextValue(result, "hash");
            long blockTimestamp = parseHexLong(getTextValue(result, "timestamp"));
            Instant timestamp = Instant.ofEpochSecond(blockTimestamp);

            int txIndex = 0;
            for (JsonNode txNode : transactions) {
                try {
                    Transaction tx = parseTransaction(txNode, blockData, blockHash, timestamp, txIndex);
                    if (tx != null) {
                        out.collect(tx);
                    }
                    txIndex++;
                } catch (Exception e) {
                    LOG.warn("Failed to parse transaction at index {} in block {}", 
                            txIndex, blockData.getBlockNumber(), e);
                }
            }

            LOG.debug("Parsed {} transactions from block {}", txIndex, blockData.getBlockNumber());

        } catch (Exception e) {
            LOG.error("Error parsing block data: {}", blockData, e);
        }
    }

    /**
     * Parse a single transaction from JSON node
     */
    private Transaction parseTransaction(JsonNode txNode, RawBlockData blockData, 
                                         String blockHash, Instant timestamp, int txIndex) {
        Transaction tx = new Transaction();

        tx.setHash(getTextValue(txNode, "hash"));
        tx.setBlockNumber(blockData.getBlockNumber());
        tx.setBlockHash(blockHash);
        tx.setTransactionIndex(txIndex);
        tx.setFromAddress(getTextValue(txNode, "from"));
        tx.setToAddress(getTextValue(txNode, "to"));
        tx.setValue(parseHexBigInteger(getTextValue(txNode, "value")));
        tx.setGas(parseHexLong(getTextValue(txNode, "gas")));
        tx.setGasPrice(parseHexBigInteger(getTextValue(txNode, "gasPrice")));
        tx.setNonce(parseHexLong(getTextValue(txNode, "nonce")));
        tx.setInput(getTextValue(txNode, "input"));
        tx.setTimestamp(timestamp);
        tx.setNetwork(blockData.getNetwork());

        // These fields may not be in the raw block data
        // They would need to be fetched from transaction receipts
        tx.setIsError(false);
        tx.setGasUsed(null);

        return tx;
    }

    /**
     * Get text value from JSON node, handling null
     */
    private String getTextValue(JsonNode node, String field) {
        JsonNode fieldNode = node.get(field);
        if (fieldNode == null || fieldNode.isNull()) {
            return null;
        }
        return fieldNode.asText();
    }

    /**
     * Parse hex string to long
     */
    private long parseHexLong(String hex) {
        if (hex == null || hex.isEmpty()) {
            return 0;
        }
        try {
            String cleanHex = hex.startsWith("0x") ? hex.substring(2) : hex;
            return Long.parseLong(cleanHex, 16);
        } catch (NumberFormatException e) {
            LOG.warn("Failed to parse hex long: {}", hex);
            return 0;
        }
    }

    /**
     * Parse hex string to BigInteger
     */
    private BigInteger parseHexBigInteger(String hex) {
        if (hex == null || hex.isEmpty()) {
            return BigInteger.ZERO;
        }
        try {
            String cleanHex = hex.startsWith("0x") ? hex.substring(2) : hex;
            if (cleanHex.isEmpty()) {
                return BigInteger.ZERO;
            }
            return new BigInteger(cleanHex, 16);
        } catch (NumberFormatException e) {
            LOG.warn("Failed to parse hex BigInteger: {}", hex);
            return BigInteger.ZERO;
        }
    }
}
