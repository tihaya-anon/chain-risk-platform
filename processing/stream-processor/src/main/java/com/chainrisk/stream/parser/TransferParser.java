package com.chainrisk.stream.parser;

import com.chainrisk.stream.model.ChainEvent;
import com.chainrisk.stream.model.Transaction;
import com.chainrisk.stream.model.Transfer;
import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import org.apache.flink.api.common.functions.FlatMapFunction;
import org.apache.flink.util.Collector;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Parses ChainEvent and extracts Transfer records
 */
public class TransferParser implements FlatMapFunction<ChainEvent, Transfer> {
    private static final long serialVersionUID = 1L;
    private static final Logger LOG = LoggerFactory.getLogger(TransferParser.class);

    private transient ObjectMapper objectMapper;

    @Override
    public void flatMap(ChainEvent event, Collector<Transfer> out) throws Exception {
        if (objectMapper == null) {
            initObjectMapper();
        }

        try {
            if (event.isTransaction()) {
                parseTransaction(event, out);
            } else if (event.isTransfer()) {
                parseTransfer(event, out);
            }
        } catch (Exception e) {
            LOG.error("Error parsing event: {}", event, e);
        }
    }

    private void initObjectMapper() {
        objectMapper = new ObjectMapper();
        objectMapper.registerModule(new JavaTimeModule());
        objectMapper.configure(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES, false);
    }

    /**
     * Parse transaction and extract native transfer if value > 0
     */
    private void parseTransaction(ChainEvent event, Collector<Transfer> out) throws Exception {
        Transaction tx = objectMapper.treeToValue(event.getData(), Transaction.class);

        if (tx == null) {
            LOG.warn("Failed to parse transaction from event: {}", event);
            return;
        }

        // Extract native transfer if there's value
        if (tx.hasValueTransfer() && tx.getToAddress() != null) {
            Transfer transfer = Transfer.fromTransaction(tx, event.getNetwork());
            out.collect(transfer);
            LOG.debug("Extracted native transfer: {}", transfer);
        }

        // Parse ERC20 transfers from input data
        if (isERC20Transfer(tx)) {
            parseERC20Transfer(tx, event.getNetwork(), out);
        }
    }

    /**
     * Parse transfer event directly
     */
    private void parseTransfer(ChainEvent event, Collector<Transfer> out) throws Exception {
        Transfer transfer = objectMapper.treeToValue(event.getData(), Transfer.class);

        if (transfer == null) {
            LOG.warn("Failed to parse transfer from event: {}", event);
            return;
        }

        transfer.setNetwork(event.getNetwork());
        out.collect(transfer);
        LOG.debug("Parsed transfer: {}", transfer);
    }

    /**
     * Check if transaction is an ERC20 transfer based on input data
     */
    private boolean isERC20Transfer(Transaction tx) {
        String input = tx.getInput();
        if (input == null || input.length() < 10) {
            return false;
        }

        String methodId = input.substring(0, 10).toLowerCase();
        return "0xa9059cbb".equals(methodId) || "0x23b872dd".equals(methodId);
    }

    /**
     * Parse ERC20 transfer from transaction input
     */
    private void parseERC20Transfer(Transaction tx, String network, Collector<Transfer> out) {
        String input = tx.getInput();
        if (input == null || input.length() < 138) {
            return;
        }

        try {
            String methodId = input.substring(0, 10).toLowerCase();

            if ("0xa9059cbb".equals(methodId)) {
                parseERC20TransferMethod(tx, input, network, out);
            } else if ("0x23b872dd".equals(methodId)) {
                parseERC20TransferFromMethod(tx, input, network, out);
            }
        } catch (Exception e) {
            LOG.warn("Failed to parse ERC20 transfer from tx: {}", tx.getHash(), e);
        }
    }

    /**
     * Parse ERC20 transfer(address to, uint256 value) method
     */
    private void parseERC20TransferMethod(Transaction tx, String input, String network, Collector<Transfer> out) {
        if (input.length() < 138) {
            return;
        }

        String toAddress = "0x" + input.substring(34, 74);
        String valueHex = input.substring(74, 138);

        Transfer transfer = new Transfer();
        transfer.setTxHash(tx.getHash());
        transfer.setBlockNumber(tx.getBlockNumber());
        transfer.setLogIndex(0);
        transfer.setFromAddress(tx.getFromAddress());
        transfer.setToAddress(toAddress);
        transfer.setValue(new java.math.BigInteger(valueHex, 16));
        transfer.setTokenAddress(tx.getToAddress());
        transfer.setTimestamp(tx.getTimestamp());
        transfer.setTransferType("erc20");
        transfer.setNetwork(network);

        out.collect(transfer);
        LOG.debug("Extracted ERC20 transfer(): {}", transfer);
    }

    /**
     * Parse ERC20 transferFrom(address from, address to, uint256 value) method
     */
    private void parseERC20TransferFromMethod(Transaction tx, String input, String network, Collector<Transfer> out) {
        if (input.length() < 202) {
            return;
        }

        String fromAddress = "0x" + input.substring(34, 74);
        String toAddress = "0x" + input.substring(98, 138);
        String valueHex = input.substring(138, 202);

        Transfer transfer = new Transfer();
        transfer.setTxHash(tx.getHash());
        transfer.setBlockNumber(tx.getBlockNumber());
        transfer.setLogIndex(0);
        transfer.setFromAddress(fromAddress);
        transfer.setToAddress(toAddress);
        transfer.setValue(new java.math.BigInteger(valueHex, 16));
        transfer.setTokenAddress(tx.getToAddress());
        transfer.setTimestamp(tx.getTimestamp());
        transfer.setTransferType("erc20");
        transfer.setNetwork(network);

        out.collect(transfer);
        LOG.debug("Extracted ERC20 transferFrom(): {}", transfer);
    }
}
