package com.chainrisk.stream.model;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

import java.math.BigInteger;
import java.time.Instant;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Unit tests for Transaction model
 */
@DisplayName("Transaction Model Tests")
class TransactionTest {

    @Nested
    @DisplayName("isContractCreation Method")
    class IsContractCreationTests {

        @Test
        @DisplayName("Should return true when to is null and contractAddress is set")
        void shouldReturnTrueForContractCreation() {
            Transaction tx = new Transaction();
            tx.setToAddress(null);
            tx.setContractAddress("0xnewcontract");

            assertTrue(tx.isContractCreation());
        }

        @Test
        @DisplayName("Should return true when to is empty and contractAddress is set")
        void shouldReturnTrueWhenToIsEmpty() {
            Transaction tx = new Transaction();
            tx.setToAddress("");
            tx.setContractAddress("0xnewcontract");

            assertTrue(tx.isContractCreation());
        }

        @Test
        @DisplayName("Should return false when to address is set")
        void shouldReturnFalseWhenToAddressIsSet() {
            Transaction tx = new Transaction();
            tx.setToAddress("0xrecipient");
            tx.setContractAddress("0xnewcontract");

            assertFalse(tx.isContractCreation());
        }

        @Test
        @DisplayName("Should return false when contractAddress is null")
        void shouldReturnFalseWhenContractAddressIsNull() {
            Transaction tx = new Transaction();
            tx.setToAddress(null);
            tx.setContractAddress(null);

            assertFalse(tx.isContractCreation());
        }

        @Test
        @DisplayName("Should return false when contractAddress is empty")
        void shouldReturnFalseWhenContractAddressIsEmpty() {
            Transaction tx = new Transaction();
            tx.setToAddress(null);
            tx.setContractAddress("");

            assertFalse(tx.isContractCreation());
        }
    }

    @Nested
    @DisplayName("hasValueTransfer Method")
    class HasValueTransferTests {

        @Test
        @DisplayName("Should return true when value is greater than zero")
        void shouldReturnTrueWhenValueIsPositive() {
            Transaction tx = new Transaction();
            tx.setValue(new BigInteger("1000000000000000000"));

            assertTrue(tx.hasValueTransfer());
        }

        @Test
        @DisplayName("Should return false when value is zero")
        void shouldReturnFalseWhenValueIsZero() {
            Transaction tx = new Transaction();
            tx.setValue(BigInteger.ZERO);

            assertFalse(tx.hasValueTransfer());
        }

        @Test
        @DisplayName("Should return false when value is null")
        void shouldReturnFalseWhenValueIsNull() {
            Transaction tx = new Transaction();
            tx.setValue(null);

            assertFalse(tx.hasValueTransfer());
        }

        @Test
        @DisplayName("Should return true for small positive value")
        void shouldReturnTrueForSmallPositiveValue() {
            Transaction tx = new Transaction();
            tx.setValue(BigInteger.ONE);

            assertTrue(tx.hasValueTransfer());
        }
    }

    @Nested
    @DisplayName("Getter and Setter Tests")
    class GetterSetterTests {

        @Test
        @DisplayName("Should set and get hash correctly")
        void shouldSetAndGetHash() {
            Transaction tx = new Transaction();
            tx.setHash("0xabc123");

            assertEquals("0xabc123", tx.getHash());
        }

        @Test
        @DisplayName("Should set and get blockNumber correctly")
        void shouldSetAndGetBlockNumber() {
            Transaction tx = new Transaction();
            tx.setBlockNumber(12345678L);

            assertEquals(12345678L, tx.getBlockNumber());
        }

        @Test
        @DisplayName("Should set and get blockHash correctly")
        void shouldSetAndGetBlockHash() {
            Transaction tx = new Transaction();
            tx.setBlockHash("0xblockhash");

            assertEquals("0xblockhash", tx.getBlockHash());
        }

        @Test
        @DisplayName("Should set and get transactionIndex correctly")
        void shouldSetAndGetTransactionIndex() {
            Transaction tx = new Transaction();
            tx.setTransactionIndex(42);

            assertEquals(42, tx.getTransactionIndex());
        }

        @Test
        @DisplayName("Should set and get fromAddress correctly")
        void shouldSetAndGetFromAddress() {
            Transaction tx = new Transaction();
            tx.setFromAddress("0xsender");

            assertEquals("0xsender", tx.getFromAddress());
        }

        @Test
        @DisplayName("Should set and get toAddress correctly")
        void shouldSetAndGetToAddress() {
            Transaction tx = new Transaction();
            tx.setToAddress("0xrecipient");

            assertEquals("0xrecipient", tx.getToAddress());
        }

        @Test
        @DisplayName("Should set and get value correctly")
        void shouldSetAndGetValue() {
            Transaction tx = new Transaction();
            BigInteger value = new BigInteger("1000000000000000000");
            tx.setValue(value);

            assertEquals(value, tx.getValue());
        }

        @Test
        @DisplayName("Should set and get gas correctly")
        void shouldSetAndGetGas() {
            Transaction tx = new Transaction();
            tx.setGas(21000L);

            assertEquals(21000L, tx.getGas());
        }

        @Test
        @DisplayName("Should set and get gasPrice correctly")
        void shouldSetAndGetGasPrice() {
            Transaction tx = new Transaction();
            BigInteger gasPrice = new BigInteger("20000000000");
            tx.setGasPrice(gasPrice);

            assertEquals(gasPrice, tx.getGasPrice());
        }

        @Test
        @DisplayName("Should set and get gasUsed correctly")
        void shouldSetAndGetGasUsed() {
            Transaction tx = new Transaction();
            tx.setGasUsed(21000L);

            assertEquals(21000L, tx.getGasUsed());
        }

        @Test
        @DisplayName("Should set and get nonce correctly")
        void shouldSetAndGetNonce() {
            Transaction tx = new Transaction();
            tx.setNonce(100L);

            assertEquals(100L, tx.getNonce());
        }

        @Test
        @DisplayName("Should set and get input correctly")
        void shouldSetAndGetInput() {
            Transaction tx = new Transaction();
            tx.setInput("0xa9059cbb...");

            assertEquals("0xa9059cbb...", tx.getInput());
        }

        @Test
        @DisplayName("Should set and get timestamp correctly")
        void shouldSetAndGetTimestamp() {
            Transaction tx = new Transaction();
            Instant now = Instant.now();
            tx.setTimestamp(now);

            assertEquals(now, tx.getTimestamp());
        }

        @Test
        @DisplayName("Should set and get isError correctly")
        void shouldSetAndGetIsError() {
            Transaction tx = new Transaction();
            tx.setIsError(true);

            assertTrue(tx.getIsError());

            tx.setIsError(false);
            assertFalse(tx.getIsError());
        }

        @Test
        @DisplayName("Should set and get txReceiptStatus correctly")
        void shouldSetAndGetTxReceiptStatus() {
            Transaction tx = new Transaction();
            tx.setTxReceiptStatus("1");

            assertEquals("1", tx.getTxReceiptStatus());
        }

        @Test
        @DisplayName("Should set and get contractAddress correctly")
        void shouldSetAndGetContractAddress() {
            Transaction tx = new Transaction();
            tx.setContractAddress("0xnewcontract");

            assertEquals("0xnewcontract", tx.getContractAddress());
        }
    }

    @Nested
    @DisplayName("toString Tests")
    class ToStringTests {

        @Test
        @DisplayName("toString should contain relevant fields")
        void toStringShouldContainRelevantFields() {
            Transaction tx = new Transaction();
            tx.setHash("0xhash123");
            tx.setBlockNumber(12345678L);
            tx.setFromAddress("0xsender");
            tx.setToAddress("0xrecipient");
            tx.setValue(new BigInteger("1000000000000000000"));

            String result = tx.toString();

            assertTrue(result.contains("hash='0xhash123'"));
            assertTrue(result.contains("blockNumber=12345678"));
            assertTrue(result.contains("from='0xsender'"));
            assertTrue(result.contains("to='0xrecipient'"));
            assertTrue(result.contains("value=1000000000000000000"));
        }

        @Test
        @DisplayName("toString should handle null values")
        void toStringShouldHandleNullValues() {
            Transaction tx = new Transaction();

            String result = tx.toString();

            assertNotNull(result);
            assertTrue(result.contains("Transaction{"));
        }
    }

    @Nested
    @DisplayName("Serialization Tests")
    class SerializationTests {

        @Test
        @DisplayName("Transaction should be serializable")
        void transactionShouldBeSerializable() {
            Transaction tx = new Transaction();
            tx.setHash("0xhash");
            tx.setFromAddress("0xfrom");
            tx.setToAddress("0xto");
            tx.setValue(new BigInteger("1000"));
            tx.setBlockNumber(12345678L);

            assertDoesNotThrow(() -> {
                java.io.ByteArrayOutputStream baos = new java.io.ByteArrayOutputStream();
                java.io.ObjectOutputStream oos = new java.io.ObjectOutputStream(baos);
                oos.writeObject(tx);
                oos.close();
            });
        }
    }

    @Nested
    @DisplayName("Edge Cases")
    class EdgeCaseTests {

        @Test
        @DisplayName("Should handle large block numbers")
        void shouldHandleLargeBlockNumbers() {
            Transaction tx = new Transaction();
            tx.setBlockNumber(Long.MAX_VALUE);

            assertEquals(Long.MAX_VALUE, tx.getBlockNumber());
        }

        @Test
        @DisplayName("Should handle very large values")
        void shouldHandleVeryLargeValues() {
            Transaction tx = new Transaction();
            BigInteger largeValue = new BigInteger("115792089237316195423570985008687907853269984665640564039457584007913129639935"); // 2^256 - 1
            tx.setValue(largeValue);

            assertEquals(largeValue, tx.getValue());
            assertTrue(tx.hasValueTransfer());
        }

        @Test
        @DisplayName("Should handle empty input data")
        void shouldHandleEmptyInputData() {
            Transaction tx = new Transaction();
            tx.setInput("");

            assertEquals("", tx.getInput());
        }

        @Test
        @DisplayName("Should handle 0x input data")
        void shouldHandle0xInputData() {
            Transaction tx = new Transaction();
            tx.setInput("0x");

            assertEquals("0x", tx.getInput());
        }
    }
}
