package com.chainrisk.stream.parser;

import com.chainrisk.stream.model.ChainEvent;
import com.chainrisk.stream.model.Transfer;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import org.apache.flink.util.Collector;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

/**
 * Unit tests for TransferParser
 */
@DisplayName("TransferParser Tests")
class TransferParserTest {

    private TransferParser parser;
    private ObjectMapper objectMapper;
    private Collector<Transfer> collector;
    private List<Transfer> collectedTransfers;

    @BeforeEach
    void setUp() {
        parser = new TransferParser();
        objectMapper = new ObjectMapper();
        objectMapper.registerModule(new JavaTimeModule());

        // Create a mock collector that stores transfers
        collectedTransfers = new ArrayList<>();
        collector = mock(Collector.class);
        doAnswer(invocation -> {
            Transfer transfer = invocation.getArgument(0);
            collectedTransfers.add(transfer);
            return null;
        }).when(collector).collect(any(Transfer.class));
    }

    private ChainEvent createChainEvent(String eventType, String network, Long blockNumber, String dataJson)
            throws Exception {
        ChainEvent event = new ChainEvent();
        event.setEventType(eventType);
        event.setNetwork(network);
        event.setBlockNumber(blockNumber);
        event.setTimestamp(Instant.now());
        if (dataJson != null) {
            event.setData(objectMapper.readTree(dataJson));
        }
        return event;
    }

    @Nested
    @DisplayName("Native Transfer Parsing")
    class NativeTransferTests {

        @Test
        @DisplayName("Should parse native ETH transfer from transaction")
        void shouldParseNativeEthTransfer() throws Exception {
            String dataJson = """
                    {
                        "hash": "0xabc123",
                        "blockNumber": 12345678,
                        "from": "0xSender",
                        "to": "0xReceiver",
                        "value": 1000000000000000000,
                        "timestamp": "2024-01-01T00:00:00Z"
                    }
                    """;
            ChainEvent event = createChainEvent("transaction", "ethereum", 12345678L, dataJson);

            parser.flatMap(event, collector);

            assertEquals(1, collectedTransfers.size());
            Transfer transfer = collectedTransfers.get(0);
            assertEquals("0xabc123", transfer.getTxHash());
            assertEquals("0xsender", transfer.getFromAddress()); // Should be lowercased
            assertEquals("0xreceiver", transfer.getToAddress()); // Should be lowercased
            assertEquals("native", transfer.getTransferType());
            assertEquals("ETH", transfer.getTokenSymbol());
            assertEquals(18, transfer.getTokenDecimal());
            assertEquals("ethereum", transfer.getNetwork());
        }

        @Test
        @DisplayName("Should parse native BNB transfer from BSC transaction")
        void shouldParseNativeBnbTransfer() throws Exception {
            String dataJson = """
                    {
                        "hash": "0xbsc123",
                        "blockNumber": 98765432,
                        "from": "0xBscSender",
                        "to": "0xBscReceiver",
                        "value": 5000000000000000000,
                        "timestamp": "2024-06-15T12:30:00Z"
                    }
                    """;
            ChainEvent event = createChainEvent("transaction", "bsc", 98765432L, dataJson);

            parser.flatMap(event, collector);

            assertEquals(1, collectedTransfers.size());
            Transfer transfer = collectedTransfers.get(0);
            assertEquals("BNB", transfer.getTokenSymbol());
            assertEquals("bsc", transfer.getNetwork());
        }

        @Test
        @DisplayName("Should parse native MATIC transfer from Polygon transaction")
        void shouldParseNativeMaticTransfer() throws Exception {
            String dataJson = """
                    {
                        "hash": "0xpolygon123",
                        "blockNumber": 55555555,
                        "from": "0xPolySender",
                        "to": "0xPolyReceiver",
                        "value": 2000000000000000000,
                        "timestamp": "2024-06-15T12:30:00Z"
                    }
                    """;
            ChainEvent event = createChainEvent("transaction", "polygon", 55555555L, dataJson);

            parser.flatMap(event, collector);

            assertEquals(1, collectedTransfers.size());
            Transfer transfer = collectedTransfers.get(0);
            assertEquals("MATIC", transfer.getTokenSymbol());
            assertEquals("polygon", transfer.getNetwork());
        }

        @Test
        @DisplayName("Should not emit transfer when value is zero")
        void shouldNotEmitTransferWhenValueIsZero() throws Exception {
            String dataJson = """
                    {
                        "hash": "0xzerovalue",
                        "blockNumber": 12345678,
                        "from": "0xSender",
                        "to": "0xReceiver",
                        "value": 0,
                        "timestamp": "2024-01-01T00:00:00Z"
                    }
                    """;
            ChainEvent event = createChainEvent("transaction", "ethereum", 12345678L, dataJson);

            parser.flatMap(event, collector);

            assertEquals(0, collectedTransfers.size());
        }

        @Test
        @DisplayName("Should not emit transfer when to address is null")
        void shouldNotEmitTransferWhenToAddressIsNull() throws Exception {
            String dataJson = """
                    {
                        "hash": "0xcontractcreate",
                        "blockNumber": 12345678,
                        "from": "0xSender",
                        "value": 1000000000000000000,
                        "timestamp": "2024-01-01T00:00:00Z"
                    }
                    """;
            ChainEvent event = createChainEvent("transaction", "ethereum", 12345678L, dataJson);

            parser.flatMap(event, collector);

            assertEquals(0, collectedTransfers.size());
        }
    }

    @Nested
    @DisplayName("ERC20 Transfer Parsing")
    class ERC20TransferTests {

        @Test
        @DisplayName("Should parse ERC20 transfer() method call")
        void shouldParseErc20TransferMethod() throws Exception {
            // transfer(address to, uint256 value) - method id: 0xa9059cbb
            // to: 0x000000000000000000000000bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb
            // value: 0x0000000000000000000000000000000000000000000000000de0b6b3a7640000
            // (1e18)
            String input = "0xa9059cbb000000000000000000000000bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb0000000000000000000000000000000000000000000000000de0b6b3a7640000";

            String dataJson = String.format("""
                    {
                        "hash": "0xerc20tx",
                        "blockNumber": 12345678,
                        "from": "0xSender",
                        "to": "0xTokenContract",
                        "value": 0,
                        "input": "%s",
                        "timestamp": "2024-01-01T00:00:00Z"
                    }
                    """, input);
            ChainEvent event = createChainEvent("transaction", "ethereum", 12345678L, dataJson);

            parser.flatMap(event, collector);

            assertEquals(1, collectedTransfers.size());
            Transfer transfer = collectedTransfers.get(0);
            assertEquals("0xerc20tx", transfer.getTxHash());
            assertEquals("0xsender", transfer.getFromAddress());
            assertEquals("0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb", transfer.getToAddress());
            assertEquals("erc20", transfer.getTransferType());
            assertEquals("0xtokencontract", transfer.getTokenAddress());
        }

        @Test
        @DisplayName("Should parse ERC20 transferFrom() method call")
        void shouldParseErc20TransferFromMethod() throws Exception {
            // transferFrom(address from, address to, uint256 value) - method id: 0x23b872dd
            // from: 0x000000000000000000000000aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa
            // to: 0x000000000000000000000000bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb
            // value: 0x0000000000000000000000000000000000000000000000000de0b6b3a7640000
            // (1e18)
            String input = "0x23b872dd000000000000000000000000aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa000000000000000000000000bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb0000000000000000000000000000000000000000000000000de0b6b3a7640000";

            String dataJson = String.format("""
                    {
                        "hash": "0xtransferfromtx",
                        "blockNumber": 12345678,
                        "from": "0xSpender",
                        "to": "0xTokenContract",
                        "value": 0,
                        "input": "%s",
                        "timestamp": "2024-01-01T00:00:00Z"
                    }
                    """, input);
            ChainEvent event = createChainEvent("transaction", "ethereum", 12345678L, dataJson);

            parser.flatMap(event, collector);

            assertEquals(1, collectedTransfers.size());
            Transfer transfer = collectedTransfers.get(0);
            assertEquals("0xtransferfromtx", transfer.getTxHash());
            assertEquals("0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", transfer.getFromAddress());
            assertEquals("0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb", transfer.getToAddress());
            assertEquals("erc20", transfer.getTransferType());
        }

        @Test
        @DisplayName("Should emit both native and ERC20 transfers when transaction has value and ERC20 call")
        void shouldEmitBothNativeAndErc20Transfers() throws Exception {
            String input = "0xa9059cbb000000000000000000000000bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb0000000000000000000000000000000000000000000000000de0b6b3a7640000";

            String dataJson = String.format("""
                    {
                        "hash": "0xmixedtx",
                        "blockNumber": 12345678,
                        "from": "0xSender",
                        "to": "0xTokenContract",
                        "value": 1000000000000000000,
                        "input": "%s",
                        "timestamp": "2024-01-01T00:00:00Z"
                    }
                    """, input);
            ChainEvent event = createChainEvent("transaction", "ethereum", 12345678L, dataJson);

            parser.flatMap(event, collector);

            assertEquals(2, collectedTransfers.size());

            // First should be native transfer
            Transfer nativeTransfer = collectedTransfers.stream()
                    .filter(t -> "native".equals(t.getTransferType()))
                    .findFirst()
                    .orElse(null);
            assertNotNull(nativeTransfer);
            assertEquals("ETH", nativeTransfer.getTokenSymbol());

            // Second should be ERC20 transfer
            Transfer erc20Transfer = collectedTransfers.stream()
                    .filter(t -> "erc20".equals(t.getTransferType()))
                    .findFirst()
                    .orElse(null);
            assertNotNull(erc20Transfer);
        }

        @Test
        @DisplayName("Should not parse ERC20 when input is too short")
        void shouldNotParseErc20WhenInputTooShort() throws Exception {
            String dataJson = """
                    {
                        "hash": "0xshortinput",
                        "blockNumber": 12345678,
                        "from": "0xSender",
                        "to": "0xContract",
                        "value": 0,
                        "input": "0xa9059cbb",
                        "timestamp": "2024-01-01T00:00:00Z"
                    }
                    """;
            ChainEvent event = createChainEvent("transaction", "ethereum", 12345678L, dataJson);

            parser.flatMap(event, collector);

            assertEquals(0, collectedTransfers.size());
        }

        @Test
        @DisplayName("Should not parse non-ERC20 method calls")
        void shouldNotParseNonErc20MethodCalls() throws Exception {
            // approve() method - 0x095ea7b3
            String input = "0x095ea7b3000000000000000000000000bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff";

            String dataJson = String.format("""
                    {
                        "hash": "0xapprovetx",
                        "blockNumber": 12345678,
                        "from": "0xSender",
                        "to": "0xTokenContract",
                        "value": 0,
                        "input": "%s",
                        "timestamp": "2024-01-01T00:00:00Z"
                    }
                    """, input);
            ChainEvent event = createChainEvent("transaction", "ethereum", 12345678L, dataJson);

            parser.flatMap(event, collector);

            assertEquals(0, collectedTransfers.size());
        }
    }

    @Nested
    @DisplayName("Direct Transfer Event Parsing")
    class DirectTransferEventTests {

        @Test
        @DisplayName("Should parse direct transfer event")
        void shouldParseDirectTransferEvent() throws Exception {
            String dataJson = """
                    {
                        "txHash": "0xdirecttransfer",
                        "blockNumber": 12345678,
                        "logIndex": 5,
                        "from": "0xFrom",
                        "to": "0xTo",
                        "value": 1000000000000000000,
                        "tokenAddress": "0xToken",
                        "tokenSymbol": "USDT",
                        "tokenDecimal": 6,
                        "transferType": "erc20"
                    }
                    """;
            ChainEvent event = createChainEvent("transfer", "ethereum", 12345678L, dataJson);

            parser.flatMap(event, collector);

            assertEquals(1, collectedTransfers.size());
            Transfer transfer = collectedTransfers.get(0);
            assertEquals("0xdirecttransfer", transfer.getTxHash());
            assertEquals(5, transfer.getLogIndex());
            assertEquals("USDT", transfer.getTokenSymbol());
            assertEquals(6, transfer.getTokenDecimal());
            assertEquals("erc20", transfer.getTransferType());
            assertEquals("ethereum", transfer.getNetwork());
        }
    }

    @Nested
    @DisplayName("Edge Cases and Error Handling")
    class EdgeCaseTests {

        @Test
        @DisplayName("Should handle null event data gracefully")
        void shouldHandleNullEventData() throws Exception {
            ChainEvent event = createChainEvent("transaction", "ethereum", 12345678L, null);

            // Should not throw exception
            assertDoesNotThrow(() -> parser.flatMap(event, collector));
            assertEquals(0, collectedTransfers.size());
        }

        @Test
        @DisplayName("Should handle unknown event type")
        void shouldHandleUnknownEventType() throws Exception {
            String dataJson = """
                    {
                        "hash": "0xunknown",
                        "from": "0xSender",
                        "to": "0xReceiver",
                        "value": 1000000000000000000
                    }
                    """;
            ChainEvent event = createChainEvent("unknown_type", "ethereum", 12345678L, dataJson);

            parser.flatMap(event, collector);

            assertEquals(0, collectedTransfers.size());
        }

        @Test
        @DisplayName("Should handle internal_tx event type (not processed)")
        void shouldHandleInternalTxEventType() throws Exception {
            String dataJson = """
                    {
                        "hash": "0xinternaltx",
                        "from": "0xContract",
                        "to": "0xUser",
                        "value": 1000000000000000000
                    }
                    """;
            ChainEvent event = createChainEvent("internal_tx", "ethereum", 12345678L, dataJson);

            parser.flatMap(event, collector);

            // internal_tx is not processed by current implementation
            assertEquals(0, collectedTransfers.size());
        }

        @Test
        @DisplayName("Should handle malformed transaction data")
        void shouldHandleMalformedTransactionData() throws Exception {
            String dataJson = """
                    {
                        "invalid": "data"
                    }
                    """;
            ChainEvent event = createChainEvent("transaction", "ethereum", 12345678L, dataJson);

            // Should not throw exception
            assertDoesNotThrow(() -> parser.flatMap(event, collector));
            assertEquals(0, collectedTransfers.size());
        }

        @Test
        @DisplayName("Should handle unknown network with UNKNOWN symbol")
        void shouldHandleUnknownNetwork() throws Exception {
            String dataJson = """
                    {
                        "hash": "0xunknownnet",
                        "blockNumber": 12345678,
                        "from": "0xSender",
                        "to": "0xReceiver",
                        "value": 1000000000000000000,
                        "timestamp": "2024-01-01T00:00:00Z"
                    }
                    """;
            ChainEvent event = createChainEvent("transaction", "unknown_chain", 12345678L, dataJson);

            parser.flatMap(event, collector);

            assertEquals(1, collectedTransfers.size());
            Transfer transfer = collectedTransfers.get(0);
            assertEquals("UNKNOWN", transfer.getTokenSymbol());
        }
    }
}
