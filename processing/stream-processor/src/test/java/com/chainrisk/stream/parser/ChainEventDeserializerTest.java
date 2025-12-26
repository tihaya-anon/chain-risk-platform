package com.chainrisk.stream.parser;

import com.chainrisk.stream.model.ChainEvent;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

import java.io.IOException;
import java.nio.charset.StandardCharsets;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Unit tests for ChainEventDeserializer
 */
@DisplayName("ChainEventDeserializer Tests")
class ChainEventDeserializerTest {

    private ChainEventDeserializer deserializer;

    @BeforeEach
    void setUp() {
        deserializer = new ChainEventDeserializer();
    }

    @Nested
    @DisplayName("Transaction Event Deserialization")
    class TransactionEventTests {

        @Test
        @DisplayName("Should deserialize transaction event with all fields")
        void shouldDeserializeTransactionEvent() throws IOException {
            String json = """
                {
                    "eventType": "transaction",
                    "network": "ethereum",
                    "blockNumber": 12345678,
                    "timestamp": "2024-01-01T00:00:00Z",
                    "data": {
                        "hash": "0xabc123",
                        "blockNumber": 12345678,
                        "from": "0xaaaa",
                        "to": "0xbbbb",
                        "value": "1000000000000000000"
                    }
                }
                """;

            ChainEvent event = deserializer.deserialize(json.getBytes(StandardCharsets.UTF_8));

            assertNotNull(event);
            assertEquals("transaction", event.getEventType());
            assertEquals("ethereum", event.getNetwork());
            assertEquals(12345678L, event.getBlockNumber());
            assertNotNull(event.getTimestamp());
            assertNotNull(event.getData());
            assertTrue(event.isTransaction());
            assertFalse(event.isTransfer());
        }

        @Test
        @DisplayName("Should deserialize BSC transaction event")
        void shouldDeserializeBscTransactionEvent() throws IOException {
            String json = """
                {
                    "eventType": "transaction",
                    "network": "bsc",
                    "blockNumber": 98765432,
                    "timestamp": "2024-06-15T12:30:00Z",
                    "data": {
                        "hash": "0xdef456",
                        "from": "0x1111",
                        "to": "0x2222",
                        "value": "5000000000000000000"
                    }
                }
                """;

            ChainEvent event = deserializer.deserialize(json.getBytes(StandardCharsets.UTF_8));

            assertNotNull(event);
            assertEquals("bsc", event.getNetwork());
            assertTrue(event.isTransaction());
        }
    }

    @Nested
    @DisplayName("Transfer Event Deserialization")
    class TransferEventTests {

        @Test
        @DisplayName("Should deserialize native transfer event")
        void shouldDeserializeNativeTransferEvent() throws IOException {
            String json = """
                {
                    "eventType": "transfer",
                    "network": "ethereum",
                    "blockNumber": 12345678,
                    "timestamp": "2024-01-01T00:00:00Z",
                    "data": {
                        "txHash": "0xtest123",
                        "blockNumber": 12345678,
                        "logIndex": 0,
                        "from": "0xaaaa",
                        "to": "0xbbbb",
                        "value": "1000000000000000000",
                        "tokenSymbol": "ETH",
                        "tokenDecimal": 18,
                        "transferType": "native"
                    }
                }
                """;

            ChainEvent event = deserializer.deserialize(json.getBytes(StandardCharsets.UTF_8));

            assertNotNull(event);
            assertEquals("transfer", event.getEventType());
            assertEquals("ethereum", event.getNetwork());
            assertTrue(event.isTransfer());
            assertFalse(event.isTransaction());
        }

        @Test
        @DisplayName("Should deserialize ERC20 transfer event")
        void shouldDeserializeErc20TransferEvent() throws IOException {
            String json = """
                {
                    "eventType": "transfer",
                    "network": "ethereum",
                    "blockNumber": 12345678,
                    "timestamp": "2024-01-01T00:00:00Z",
                    "data": {
                        "txHash": "0xerc20tx",
                        "blockNumber": 12345678,
                        "logIndex": 1,
                        "from": "0xsender",
                        "to": "0xreceiver",
                        "value": "500000000",
                        "tokenAddress": "0xusdt",
                        "tokenSymbol": "USDT",
                        "tokenDecimal": 6,
                        "transferType": "erc20"
                    }
                }
                """;

            ChainEvent event = deserializer.deserialize(json.getBytes(StandardCharsets.UTF_8));

            assertNotNull(event);
            assertEquals("transfer", event.getEventType());
            assertTrue(event.isTransfer());
        }
    }

    @Nested
    @DisplayName("Internal Transaction Event Deserialization")
    class InternalTransactionEventTests {

        @Test
        @DisplayName("Should deserialize internal transaction event")
        void shouldDeserializeInternalTxEvent() throws IOException {
            String json = """
                {
                    "eventType": "internal_tx",
                    "network": "ethereum",
                    "blockNumber": 12345678,
                    "timestamp": "2024-01-01T00:00:00Z",
                    "data": {
                        "txHash": "0xinternaltx",
                        "from": "0xcontract",
                        "to": "0xuser",
                        "value": "100000000000000000"
                    }
                }
                """;

            ChainEvent event = deserializer.deserialize(json.getBytes(StandardCharsets.UTF_8));

            assertNotNull(event);
            assertEquals("internal_tx", event.getEventType());
            assertTrue(event.isInternalTransaction());
            assertFalse(event.isTransaction());
            assertFalse(event.isTransfer());
        }
    }

    @Nested
    @DisplayName("Edge Cases and Error Handling")
    class EdgeCaseTests {

        @Test
        @DisplayName("Should handle missing optional fields")
        void shouldHandleMissingOptionalFields() throws IOException {
            String json = """
                {
                    "eventType": "transaction",
                    "network": "ethereum"
                }
                """;

            ChainEvent event = deserializer.deserialize(json.getBytes(StandardCharsets.UTF_8));

            assertNotNull(event);
            assertEquals("transaction", event.getEventType());
            assertEquals("ethereum", event.getNetwork());
            assertNull(event.getBlockNumber());
            assertNull(event.getTimestamp());
            assertNull(event.getData());
        }

        @Test
        @DisplayName("Should handle unknown fields gracefully")
        void shouldIgnoreUnknownFields() throws IOException {
            String json = """
                {
                    "eventType": "transaction",
                    "network": "ethereum",
                    "blockNumber": 12345678,
                    "unknownField": "someValue",
                    "anotherUnknown": 12345
                }
                """;

            ChainEvent event = deserializer.deserialize(json.getBytes(StandardCharsets.UTF_8));

            assertNotNull(event);
            assertEquals("transaction", event.getEventType());
        }

        @Test
        @DisplayName("Should return null for invalid JSON")
        void shouldReturnNullForInvalidJson() throws IOException {
            String invalidJson = "{ invalid json }";

            ChainEvent event = deserializer.deserialize(invalidJson.getBytes(StandardCharsets.UTF_8));

            assertNull(event);
        }

        @Test
        @DisplayName("Should return null for empty message")
        void shouldReturnNullForEmptyMessage() throws IOException {
            ChainEvent event = deserializer.deserialize("".getBytes(StandardCharsets.UTF_8));

            assertNull(event);
        }

        @Test
        @DisplayName("Should handle empty JSON object")
        void shouldHandleEmptyJsonObject() throws IOException {
            String json = "{}";

            ChainEvent event = deserializer.deserialize(json.getBytes(StandardCharsets.UTF_8));

            assertNotNull(event);
            assertNull(event.getEventType());
            assertNull(event.getNetwork());
        }
    }

    @Nested
    @DisplayName("Type Information Tests")
    class TypeInfoTests {

        @Test
        @DisplayName("Should return correct produced type")
        void shouldReturnCorrectProducedType() {
            var typeInfo = deserializer.getProducedType();

            assertNotNull(typeInfo);
            assertEquals(ChainEvent.class, typeInfo.getTypeClass());
        }

        @Test
        @DisplayName("isEndOfStream should always return false")
        void isEndOfStreamShouldReturnFalse() {
            assertFalse(deserializer.isEndOfStream(null));
            assertFalse(deserializer.isEndOfStream(new ChainEvent()));
        }
    }
}
