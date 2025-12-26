package com.chainrisk.stream.model;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

import java.time.Instant;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Unit tests for ChainEvent model
 */
@DisplayName("ChainEvent Model Tests")
class ChainEventTest {

    private final ObjectMapper objectMapper = new ObjectMapper();

    @Nested
    @DisplayName("Event Type Detection")
    class EventTypeDetectionTests {

        @Test
        @DisplayName("isTransaction should return true for transaction event type")
        void isTransactionShouldReturnTrueForTransaction() {
            ChainEvent event = new ChainEvent();
            event.setEventType("transaction");

            assertTrue(event.isTransaction());
            assertFalse(event.isTransfer());
            assertFalse(event.isInternalTransaction());
        }

        @Test
        @DisplayName("isTransfer should return true for transfer event type")
        void isTransferShouldReturnTrueForTransfer() {
            ChainEvent event = new ChainEvent();
            event.setEventType("transfer");

            assertFalse(event.isTransaction());
            assertTrue(event.isTransfer());
            assertFalse(event.isInternalTransaction());
        }

        @Test
        @DisplayName("isInternalTransaction should return true for internal_tx event type")
        void isInternalTransactionShouldReturnTrueForInternalTx() {
            ChainEvent event = new ChainEvent();
            event.setEventType("internal_tx");

            assertFalse(event.isTransaction());
            assertFalse(event.isTransfer());
            assertTrue(event.isInternalTransaction());
        }

        @Test
        @DisplayName("All type checks should return false for null event type")
        void allTypeChecksShouldReturnFalseForNullEventType() {
            ChainEvent event = new ChainEvent();
            event.setEventType(null);

            assertFalse(event.isTransaction());
            assertFalse(event.isTransfer());
            assertFalse(event.isInternalTransaction());
        }

        @Test
        @DisplayName("All type checks should return false for unknown event type")
        void allTypeChecksShouldReturnFalseForUnknownEventType() {
            ChainEvent event = new ChainEvent();
            event.setEventType("unknown");

            assertFalse(event.isTransaction());
            assertFalse(event.isTransfer());
            assertFalse(event.isInternalTransaction());
        }
    }

    @Nested
    @DisplayName("Getter and Setter Tests")
    class GetterSetterTests {

        @Test
        @DisplayName("Should set and get eventType correctly")
        void shouldSetAndGetEventType() {
            ChainEvent event = new ChainEvent();
            event.setEventType("transaction");

            assertEquals("transaction", event.getEventType());
        }

        @Test
        @DisplayName("Should set and get network correctly")
        void shouldSetAndGetNetwork() {
            ChainEvent event = new ChainEvent();
            event.setNetwork("ethereum");

            assertEquals("ethereum", event.getNetwork());
        }

        @Test
        @DisplayName("Should set and get blockNumber correctly")
        void shouldSetAndGetBlockNumber() {
            ChainEvent event = new ChainEvent();
            event.setBlockNumber(12345678L);

            assertEquals(12345678L, event.getBlockNumber());
        }

        @Test
        @DisplayName("Should set and get timestamp correctly")
        void shouldSetAndGetTimestamp() {
            ChainEvent event = new ChainEvent();
            Instant now = Instant.now();
            event.setTimestamp(now);

            assertEquals(now, event.getTimestamp());
        }

        @Test
        @DisplayName("Should set and get data correctly")
        void shouldSetAndGetData() throws Exception {
            ChainEvent event = new ChainEvent();
            JsonNode data = objectMapper.readTree("{\"key\": \"value\"}");
            event.setData(data);

            assertNotNull(event.getData());
            assertEquals("value", event.getData().get("key").asText());
        }
    }

    @Nested
    @DisplayName("toString Tests")
    class ToStringTests {

        @Test
        @DisplayName("toString should contain all relevant fields")
        void toStringShouldContainAllFields() {
            ChainEvent event = new ChainEvent();
            event.setEventType("transaction");
            event.setNetwork("ethereum");
            event.setBlockNumber(12345678L);
            event.setTimestamp(Instant.parse("2024-01-01T00:00:00Z"));

            String result = event.toString();

            assertTrue(result.contains("eventType='transaction'"));
            assertTrue(result.contains("network='ethereum'"));
            assertTrue(result.contains("blockNumber=12345678"));
            assertTrue(result.contains("timestamp="));
        }

        @Test
        @DisplayName("toString should handle null values")
        void toStringShouldHandleNullValues() {
            ChainEvent event = new ChainEvent();

            String result = event.toString();

            assertNotNull(result);
            assertTrue(result.contains("ChainEvent{"));
        }
    }

    @Nested
    @DisplayName("Serialization Tests")
    class SerializationTests {

        @Test
        @DisplayName("ChainEvent should be serializable")
        void chainEventShouldBeSerializable() {
            ChainEvent event = new ChainEvent();
            event.setEventType("transaction");
            event.setNetwork("ethereum");
            event.setBlockNumber(12345678L);

            // Verify it implements Serializable by checking serialVersionUID
            assertDoesNotThrow(() -> {
                java.io.ByteArrayOutputStream baos = new java.io.ByteArrayOutputStream();
                java.io.ObjectOutputStream oos = new java.io.ObjectOutputStream(baos);
                oos.writeObject(event);
                oos.close();
            });
        }
    }
}
