package com.chainrisk.stream.model;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

import java.math.BigInteger;
import java.time.Instant;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Unit tests for Transfer model
 */
@DisplayName("Transfer Model Tests")
class TransferTest {

    @Nested
    @DisplayName("fromTransaction Factory Method")
    class FromTransactionTests {

        @Test
        @DisplayName("Should create native ETH transfer from transaction")
        void shouldCreateNativeEthTransfer() {
            Transaction tx = createTestTransaction("0xhash123", "0xFrom", "0xTo", 
                new BigInteger("1000000000000000000"), 12345678L);

            Transfer transfer = Transfer.fromTransaction(tx, "ethereum");

            assertEquals("0xhash123", transfer.getTxHash());
            assertEquals(12345678L, transfer.getBlockNumber());
            assertEquals(0, transfer.getLogIndex());
            assertEquals("0xfrom", transfer.getFromAddress()); // Should be lowercased
            assertEquals("0xto", transfer.getToAddress()); // Should be lowercased
            assertEquals(new BigInteger("1000000000000000000"), transfer.getValue());
            assertNull(transfer.getTokenAddress());
            assertEquals("ETH", transfer.getTokenSymbol());
            assertEquals(18, transfer.getTokenDecimal());
            assertEquals("native", transfer.getTransferType());
            assertEquals("ethereum", transfer.getNetwork());
        }

        @Test
        @DisplayName("Should create native BNB transfer for BSC network")
        void shouldCreateNativeBnbTransfer() {
            Transaction tx = createTestTransaction("0xbschash", "0xFrom", "0xTo", 
                new BigInteger("5000000000000000000"), 98765432L);

            Transfer transfer = Transfer.fromTransaction(tx, "bsc");

            assertEquals("BNB", transfer.getTokenSymbol());
            assertEquals("bsc", transfer.getNetwork());
        }

        @Test
        @DisplayName("Should create native MATIC transfer for Polygon network")
        void shouldCreateNativeMaticTransfer() {
            Transaction tx = createTestTransaction("0xpolyhash", "0xFrom", "0xTo", 
                new BigInteger("2000000000000000000"), 55555555L);

            Transfer transfer = Transfer.fromTransaction(tx, "polygon");

            assertEquals("MATIC", transfer.getTokenSymbol());
            assertEquals("polygon", transfer.getNetwork());
        }

        @Test
        @DisplayName("Should return UNKNOWN symbol for unknown network")
        void shouldReturnUnknownSymbolForUnknownNetwork() {
            Transaction tx = createTestTransaction("0xunknown", "0xFrom", "0xTo", 
                new BigInteger("1000000000000000000"), 12345678L);

            Transfer transfer = Transfer.fromTransaction(tx, "unknown_chain");

            assertEquals("UNKNOWN", transfer.getTokenSymbol());
        }

        @Test
        @DisplayName("Should handle case-insensitive network names")
        void shouldHandleCaseInsensitiveNetworkNames() {
            Transaction tx = createTestTransaction("0xhash", "0xFrom", "0xTo", 
                new BigInteger("1000000000000000000"), 12345678L);

            Transfer ethTransfer = Transfer.fromTransaction(tx, "ETHEREUM");
            assertEquals("ETH", ethTransfer.getTokenSymbol());

            Transfer bscTransfer = Transfer.fromTransaction(tx, "BSC");
            assertEquals("BNB", bscTransfer.getTokenSymbol());

            Transfer polyTransfer = Transfer.fromTransaction(tx, "POLYGON");
            assertEquals("MATIC", polyTransfer.getTokenSymbol());
        }
    }

    @Nested
    @DisplayName("Address Normalization")
    class AddressNormalizationTests {

        @Test
        @DisplayName("setFromAddress should lowercase the address")
        void setFromAddressShouldLowercase() {
            Transfer transfer = new Transfer();
            transfer.setFromAddress("0xABCDEF1234567890");

            assertEquals("0xabcdef1234567890", transfer.getFromAddress());
        }

        @Test
        @DisplayName("setToAddress should lowercase the address")
        void setToAddressShouldLowercase() {
            Transfer transfer = new Transfer();
            transfer.setToAddress("0xABCDEF1234567890");

            assertEquals("0xabcdef1234567890", transfer.getToAddress());
        }

        @Test
        @DisplayName("setTokenAddress should lowercase the address")
        void setTokenAddressShouldLowercase() {
            Transfer transfer = new Transfer();
            transfer.setTokenAddress("0xTOKEN1234567890");

            assertEquals("0xtoken1234567890", transfer.getTokenAddress());
        }

        @Test
        @DisplayName("setFromAddress should handle null")
        void setFromAddressShouldHandleNull() {
            Transfer transfer = new Transfer();
            transfer.setFromAddress(null);

            assertNull(transfer.getFromAddress());
        }

        @Test
        @DisplayName("setToAddress should handle null")
        void setToAddressShouldHandleNull() {
            Transfer transfer = new Transfer();
            transfer.setToAddress(null);

            assertNull(transfer.getToAddress());
        }

        @Test
        @DisplayName("setTokenAddress should handle null")
        void setTokenAddressShouldHandleNull() {
            Transfer transfer = new Transfer();
            transfer.setTokenAddress(null);

            assertNull(transfer.getTokenAddress());
        }
    }

    @Nested
    @DisplayName("isNativeTransfer Method")
    class IsNativeTransferTests {

        @Test
        @DisplayName("Should return true when tokenAddress is null")
        void shouldReturnTrueWhenTokenAddressIsNull() {
            Transfer transfer = new Transfer();
            transfer.setTokenAddress(null);

            assertTrue(transfer.isNativeTransfer());
        }

        @Test
        @DisplayName("Should return true when tokenAddress is empty")
        void shouldReturnTrueWhenTokenAddressIsEmpty() {
            Transfer transfer = new Transfer();
            transfer.setTokenAddress("");

            assertTrue(transfer.isNativeTransfer());
        }

        @Test
        @DisplayName("Should return false when tokenAddress is set")
        void shouldReturnFalseWhenTokenAddressIsSet() {
            Transfer transfer = new Transfer();
            transfer.setTokenAddress("0xtoken");

            assertFalse(transfer.isNativeTransfer());
        }
    }

    @Nested
    @DisplayName("getUniqueId Method")
    class GetUniqueIdTests {

        @Test
        @DisplayName("Should return txHash-logIndex format")
        void shouldReturnCorrectFormat() {
            Transfer transfer = new Transfer();
            transfer.setTxHash("0xabc123");
            transfer.setLogIndex(5);

            assertEquals("0xabc123-5", transfer.getUniqueId());
        }

        @Test
        @DisplayName("Should handle zero logIndex")
        void shouldHandleZeroLogIndex() {
            Transfer transfer = new Transfer();
            transfer.setTxHash("0xdef456");
            transfer.setLogIndex(0);

            assertEquals("0xdef456-0", transfer.getUniqueId());
        }
    }

    @Nested
    @DisplayName("Getter and Setter Tests")
    class GetterSetterTests {

        @Test
        @DisplayName("Should set and get all fields correctly")
        void shouldSetAndGetAllFields() {
            Transfer transfer = new Transfer();
            Instant now = Instant.now();

            transfer.setTxHash("0xhash");
            transfer.setBlockNumber(12345678L);
            transfer.setLogIndex(3);
            transfer.setFromAddress("0xfrom");
            transfer.setToAddress("0xto");
            transfer.setValue(new BigInteger("1000"));
            transfer.setTokenAddress("0xtoken");
            transfer.setTokenSymbol("USDT");
            transfer.setTokenDecimal(6);
            transfer.setTimestamp(now);
            transfer.setTransferType("erc20");
            transfer.setNetwork("ethereum");

            assertEquals("0xhash", transfer.getTxHash());
            assertEquals(12345678L, transfer.getBlockNumber());
            assertEquals(3, transfer.getLogIndex());
            assertEquals("0xfrom", transfer.getFromAddress());
            assertEquals("0xto", transfer.getToAddress());
            assertEquals(new BigInteger("1000"), transfer.getValue());
            assertEquals("0xtoken", transfer.getTokenAddress());
            assertEquals("USDT", transfer.getTokenSymbol());
            assertEquals(6, transfer.getTokenDecimal());
            assertEquals(now, transfer.getTimestamp());
            assertEquals("erc20", transfer.getTransferType());
            assertEquals("ethereum", transfer.getNetwork());
        }
    }

    @Nested
    @DisplayName("toString Tests")
    class ToStringTests {

        @Test
        @DisplayName("toString should contain relevant fields")
        void toStringShouldContainRelevantFields() {
            Transfer transfer = new Transfer();
            transfer.setTxHash("0xhash123");
            transfer.setBlockNumber(12345678L);
            transfer.setFromAddress("0xfrom");
            transfer.setToAddress("0xto");
            transfer.setValue(new BigInteger("1000000000000000000"));
            transfer.setTokenSymbol("ETH");
            transfer.setTransferType("native");

            String result = transfer.toString();

            assertTrue(result.contains("txHash='0xhash123'"));
            assertTrue(result.contains("blockNumber=12345678"));
            assertTrue(result.contains("from='0xfrom'"));
            assertTrue(result.contains("to='0xto'"));
            assertTrue(result.contains("token='ETH'"));
            assertTrue(result.contains("type='native'"));
        }
    }

    @Nested
    @DisplayName("Serialization Tests")
    class SerializationTests {

        @Test
        @DisplayName("Transfer should be serializable")
        void transferShouldBeSerializable() {
            Transfer transfer = new Transfer();
            transfer.setTxHash("0xhash");
            transfer.setFromAddress("0xfrom");
            transfer.setToAddress("0xto");
            transfer.setValue(new BigInteger("1000"));

            assertDoesNotThrow(() -> {
                java.io.ByteArrayOutputStream baos = new java.io.ByteArrayOutputStream();
                java.io.ObjectOutputStream oos = new java.io.ObjectOutputStream(baos);
                oos.writeObject(transfer);
                oos.close();
            });
        }
    }

    // Helper method to create test transactions
    private Transaction createTestTransaction(String hash, String from, String to, 
                                               BigInteger value, Long blockNumber) {
        Transaction tx = new Transaction();
        tx.setHash(hash);
        tx.setFromAddress(from);
        tx.setToAddress(to);
        tx.setValue(value);
        tx.setBlockNumber(blockNumber);
        tx.setTimestamp(Instant.now());
        return tx;
    }
}
