package com.chainrisk.stream.parser;

import com.chainrisk.stream.model.RawBlockData;
import com.chainrisk.stream.model.Transfer;
import com.fasterxml.jackson.databind.JsonNode;
import org.apache.flink.api.common.functions.FlatMapFunction;
import org.apache.flink.util.Collector;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.math.BigInteger;
import java.time.Instant;

/**
 * Parses RawBlockData and extracts Transfer records
 * Handles native transfers and ERC20 transfers from transaction input data
 */
public class TransferParser implements FlatMapFunction<RawBlockData, Transfer> {
    private static final long serialVersionUID = 1L;
    private static final Logger LOG = LoggerFactory.getLogger(TransferParser.class);

    // ERC20 method signatures
    private static final String TRANSFER_METHOD_ID = "0xa9059cbb";
    private static final String TRANSFER_FROM_METHOD_ID = "0x23b872dd";

    @Override
    public void flatMap(RawBlockData blockData, Collector<Transfer> out) throws Exception {
        if (blockData == null || !blockData.isValid()) {
            LOG.debug("Skipping invalid block data");
            return;
        }

        try {
            JsonNode result = blockData.getResult();
            JsonNode transactions = result.get("transactions");

            if (transactions == null || !transactions.isArray()) {
                return;
            }

            // Extract block-level data
            long blockTimestamp = parseHexLong(getTextValue(result, "timestamp"));
            Instant timestamp = Instant.ofEpochSecond(blockTimestamp);

            int transferCount = 0;
            int txIndex = 0;

            for (JsonNode txNode : transactions) {
                try {
                    // Extract native transfer if value > 0
                    Transfer nativeTransfer = extractNativeTransfer(txNode, blockData, timestamp, txIndex);
                    if (nativeTransfer != null) {
                        out.collect(nativeTransfer);
                        transferCount++;
                    }

                    // Extract ERC20 transfer from input data
                    Transfer erc20Transfer = extractERC20Transfer(txNode, blockData, timestamp, txIndex);
                    if (erc20Transfer != null) {
                        out.collect(erc20Transfer);
                        transferCount++;
                    }

                    txIndex++;
                } catch (Exception e) {
                    LOG.warn("Failed to extract transfers from tx at index {} in block {}", 
                            txIndex, blockData.getBlockNumber(), e);
                }
            }

            LOG.debug("Extracted {} transfers from block {}", transferCount, blockData.getBlockNumber());

        } catch (Exception e) {
            LOG.error("Error parsing block data for transfers: {}", blockData, e);
        }
    }

    /**
     * Extract native token transfer (ETH/BNB) from transaction
     */
    private Transfer extractNativeTransfer(JsonNode txNode, RawBlockData blockData, 
                                           Instant timestamp, int txIndex) {
        BigInteger value = parseHexBigInteger(getTextValue(txNode, "value"));
        String toAddress = getTextValue(txNode, "to");

        // Skip if no value or no recipient (contract creation)
        if (value.compareTo(BigInteger.ZERO) <= 0 || toAddress == null || toAddress.isEmpty()) {
            return null;
        }

        Transfer transfer = new Transfer();
        transfer.setTxHash(getTextValue(txNode, "hash"));
        transfer.setBlockNumber(blockData.getBlockNumber());
        transfer.setLogIndex(0);
        transfer.setFromAddress(getTextValue(txNode, "from"));
        transfer.setToAddress(toAddress);
        transfer.setValue(value);
        transfer.setTokenAddress(null); // Native token
        transfer.setTokenSymbol(getNativeTokenSymbol(blockData.getNetwork()));
        transfer.setTokenDecimal(18);
        transfer.setTimestamp(timestamp);
        transfer.setTransferType("native");
        transfer.setNetwork(blockData.getNetwork());

        return transfer;
    }

    /**
     * Extract ERC20 transfer from transaction input data
     */
    private Transfer extractERC20Transfer(JsonNode txNode, RawBlockData blockData, 
                                          Instant timestamp, int txIndex) {
        String input = getTextValue(txNode, "input");
        if (input == null || input.length() < 10) {
            return null;
        }

        String methodId = input.substring(0, 10).toLowerCase();

        if (TRANSFER_METHOD_ID.equals(methodId)) {
            return parseERC20TransferMethod(txNode, input, blockData, timestamp);
        } else if (TRANSFER_FROM_METHOD_ID.equals(methodId)) {
            return parseERC20TransferFromMethod(txNode, input, blockData, timestamp);
        }

        return null;
    }

    /**
     * Parse ERC20 transfer(address to, uint256 value) method
     */
    private Transfer parseERC20TransferMethod(JsonNode txNode, String input, 
                                              RawBlockData blockData, Instant timestamp) {
        if (input.length() < 138) {
            return null;
        }

        try {
            String toAddress = "0x" + input.substring(34, 74);
            String valueHex = input.substring(74, 138);
            BigInteger value = new BigInteger(valueHex, 16);

            Transfer transfer = new Transfer();
            transfer.setTxHash(getTextValue(txNode, "hash"));
            transfer.setBlockNumber(blockData.getBlockNumber());
            transfer.setLogIndex(1); // Distinguish from native transfer
            transfer.setFromAddress(getTextValue(txNode, "from"));
            transfer.setToAddress(toAddress);
            transfer.setValue(value);
            transfer.setTokenAddress(getTextValue(txNode, "to")); // Contract address
            transfer.setTimestamp(timestamp);
            transfer.setTransferType("erc20");
            transfer.setNetwork(blockData.getNetwork());

            return transfer;
        } catch (Exception e) {
            LOG.warn("Failed to parse ERC20 transfer: {}", e.getMessage());
            return null;
        }
    }

    /**
     * Parse ERC20 transferFrom(address from, address to, uint256 value) method
     */
    private Transfer parseERC20TransferFromMethod(JsonNode txNode, String input, 
                                                  RawBlockData blockData, Instant timestamp) {
        if (input.length() < 202) {
            return null;
        }

        try {
            String fromAddress = "0x" + input.substring(34, 74);
            String toAddress = "0x" + input.substring(98, 138);
            String valueHex = input.substring(138, 202);
            BigInteger value = new BigInteger(valueHex, 16);

            Transfer transfer = new Transfer();
            transfer.setTxHash(getTextValue(txNode, "hash"));
            transfer.setBlockNumber(blockData.getBlockNumber());
            transfer.setLogIndex(1);
            transfer.setFromAddress(fromAddress);
            transfer.setToAddress(toAddress);
            transfer.setValue(value);
            transfer.setTokenAddress(getTextValue(txNode, "to"));
            transfer.setTimestamp(timestamp);
            transfer.setTransferType("erc20");
            transfer.setNetwork(blockData.getNetwork());

            return transfer;
        } catch (Exception e) {
            LOG.warn("Failed to parse ERC20 transferFrom: {}", e.getMessage());
            return null;
        }
    }

    /**
     * Get native token symbol based on network
     */
    private String getNativeTokenSymbol(String network) {
        if ("bsc".equalsIgnoreCase(network)) {
            return "BNB";
        }
        return "ETH";
    }

    /**
     * Get text value from JSON node
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
            return BigInteger.ZERO;
        }
    }
}
