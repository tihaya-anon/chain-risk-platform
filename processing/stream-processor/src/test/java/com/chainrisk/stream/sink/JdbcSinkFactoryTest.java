package com.chainrisk.stream.sink;

import com.chainrisk.stream.model.Transfer;
import org.apache.flink.connector.jdbc.JdbcConnectionOptions;
import org.apache.flink.connector.jdbc.JdbcExecutionOptions;
import org.apache.flink.streaming.api.functions.sink.SinkFunction;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Unit tests for JdbcSinkFactory
 */
@DisplayName("JdbcSinkFactory Tests")
class JdbcSinkFactoryTest {

    private static final String JDBC_URL = "jdbc:postgresql://localhost:5432/chainrisk";
    private static final String USERNAME = "chainrisk";
    private static final String PASSWORD = "chainrisk123";

    private JdbcSinkFactory factory;

    @BeforeEach
    void setUp() {
        factory = new JdbcSinkFactory(JDBC_URL, USERNAME, PASSWORD);
    }

    @Nested
    @DisplayName("Constructor Tests")
    class ConstructorTests {

        @Test
        @DisplayName("Should create factory with valid parameters")
        void shouldCreateFactoryWithValidParameters() {
            JdbcSinkFactory newFactory = new JdbcSinkFactory(JDBC_URL, USERNAME, PASSWORD);

            assertNotNull(newFactory);
        }

        @Test
        @DisplayName("Should create factory with different database URLs")
        void shouldCreateFactoryWithDifferentUrls() {
            String[] urls = {
                "jdbc:postgresql://localhost:5432/testdb",
                "jdbc:postgresql://192.168.1.100:5432/chainrisk",
                "jdbc:postgresql://db.example.com:5432/production"
            };

            for (String url : urls) {
                JdbcSinkFactory newFactory = new JdbcSinkFactory(url, USERNAME, PASSWORD);
                assertNotNull(newFactory);
            }
        }
    }

    @Nested
    @DisplayName("createTransferSink Tests")
    class CreateTransferSinkTests {

        @Test
        @DisplayName("Should create non-null sink function")
        void shouldCreateNonNullSinkFunction() {
            SinkFunction<Transfer> sink = factory.createTransferSink();

            assertNotNull(sink);
        }

        @Test
        @DisplayName("Should create new sink instance each time")
        void shouldCreateNewSinkInstanceEachTime() {
            SinkFunction<Transfer> sink1 = factory.createTransferSink();
            SinkFunction<Transfer> sink2 = factory.createTransferSink();

            assertNotNull(sink1);
            assertNotNull(sink2);
            assertNotSame(sink1, sink2);
        }
    }

    @Nested
    @DisplayName("getConnectionOptions Tests")
    class GetConnectionOptionsTests {

        @Test
        @DisplayName("Should return non-null connection options")
        void shouldReturnNonNullConnectionOptions() {
            JdbcConnectionOptions options = factory.getConnectionOptions();

            assertNotNull(options);
        }

        @Test
        @DisplayName("Should return options with correct driver name")
        void shouldReturnOptionsWithCorrectDriverName() {
            JdbcConnectionOptions options = factory.getConnectionOptions();

            assertEquals("org.postgresql.Driver", options.getDriverName());
        }

        @Test
        @DisplayName("Should return options with correct URL")
        void shouldReturnOptionsWithCorrectUrl() {
            JdbcConnectionOptions options = factory.getConnectionOptions();

            assertEquals(JDBC_URL, options.getDbURL());
        }

        @Test
        @DisplayName("Should return options with correct username")
        void shouldReturnOptionsWithCorrectUsername() {
            JdbcConnectionOptions options = factory.getConnectionOptions();

            assertTrue(options.getUsername().isPresent());
            assertEquals(USERNAME, options.getUsername().get());
        }

        @Test
        @DisplayName("Should return options with correct password")
        void shouldReturnOptionsWithCorrectPassword() {
            JdbcConnectionOptions options = factory.getConnectionOptions();

            assertTrue(options.getPassword().isPresent());
            assertEquals(PASSWORD, options.getPassword().get());
        }
    }

    @Nested
    @DisplayName("getExecutionOptions Tests")
    class GetExecutionOptionsTests {

        @Test
        @DisplayName("Should return non-null execution options")
        void shouldReturnNonNullExecutionOptions() {
            JdbcExecutionOptions options = factory.getExecutionOptions(1000, 200);

            assertNotNull(options);
        }

        @Test
        @DisplayName("Should return options with correct batch size")
        void shouldReturnOptionsWithCorrectBatchSize() {
            int expectedBatchSize = 500;
            JdbcExecutionOptions options = factory.getExecutionOptions(expectedBatchSize, 200);

            assertEquals(expectedBatchSize, options.getBatchSize());
        }

        @Test
        @DisplayName("Should return options with correct batch interval")
        void shouldReturnOptionsWithCorrectBatchInterval() {
            long expectedInterval = 300;
            JdbcExecutionOptions options = factory.getExecutionOptions(1000, expectedInterval);

            assertEquals(expectedInterval, options.getBatchIntervalMs());
        }

        @Test
        @DisplayName("Should return options with max retries set to 3")
        void shouldReturnOptionsWithMaxRetries() {
            JdbcExecutionOptions options = factory.getExecutionOptions(1000, 200);

            assertEquals(3, options.getMaxRetries());
        }

        @Test
        @DisplayName("Should handle different batch sizes")
        void shouldHandleDifferentBatchSizes() {
            int[] batchSizes = {1, 100, 1000, 5000, 10000};

            for (int batchSize : batchSizes) {
                JdbcExecutionOptions options = factory.getExecutionOptions(batchSize, 200);
                assertEquals(batchSize, options.getBatchSize());
            }
        }

        @Test
        @DisplayName("Should handle different batch intervals")
        void shouldHandleDifferentBatchIntervals() {
            long[] intervals = {0, 100, 500, 1000, 5000};

            for (long interval : intervals) {
                JdbcExecutionOptions options = factory.getExecutionOptions(1000, interval);
                assertEquals(interval, options.getBatchIntervalMs());
            }
        }
    }

    @Nested
    @DisplayName("Factory with Different Configurations")
    class DifferentConfigurationsTests {

        @Test
        @DisplayName("Should work with remote database URL")
        void shouldWorkWithRemoteDatabaseUrl() {
            String remoteUrl = "jdbc:postgresql://192.168.1.100:15432/chainrisk";
            JdbcSinkFactory remoteFactory = new JdbcSinkFactory(remoteUrl, USERNAME, PASSWORD);

            JdbcConnectionOptions options = remoteFactory.getConnectionOptions();
            assertEquals(remoteUrl, options.getDbURL());
        }

        @Test
        @DisplayName("Should work with different credentials")
        void shouldWorkWithDifferentCredentials() {
            String differentUser = "admin";
            String differentPassword = "secretpassword";
            JdbcSinkFactory customFactory = new JdbcSinkFactory(JDBC_URL, differentUser, differentPassword);

            JdbcConnectionOptions options = customFactory.getConnectionOptions();
            assertTrue(options.getUsername().isPresent());
            assertEquals(differentUser, options.getUsername().get());
            assertTrue(options.getPassword().isPresent());
            assertEquals(differentPassword, options.getPassword().get());
        }

        @Test
        @DisplayName("Should work with URL containing query parameters")
        void shouldWorkWithUrlContainingQueryParameters() {
            String urlWithParams = "jdbc:postgresql://localhost:5432/chainrisk?ssl=true&sslmode=require";
            JdbcSinkFactory paramFactory = new JdbcSinkFactory(urlWithParams, USERNAME, PASSWORD);

            JdbcConnectionOptions options = paramFactory.getConnectionOptions();
            assertEquals(urlWithParams, options.getDbURL());
        }
    }

    @Nested
    @DisplayName("Edge Cases")
    class EdgeCaseTests {

        @Test
        @DisplayName("Should handle empty username")
        void shouldHandleEmptyUsername() {
            JdbcSinkFactory emptyUserFactory = new JdbcSinkFactory(JDBC_URL, "", PASSWORD);

            JdbcConnectionOptions options = emptyUserFactory.getConnectionOptions();
            assertTrue(options.getUsername().isPresent());
            assertEquals("", options.getUsername().get());
        }

        @Test
        @DisplayName("Should handle empty password")
        void shouldHandleEmptyPassword() {
            JdbcSinkFactory emptyPassFactory = new JdbcSinkFactory(JDBC_URL, USERNAME, "");

            JdbcConnectionOptions options = emptyPassFactory.getConnectionOptions();
            assertTrue(options.getPassword().isPresent());
            assertEquals("", options.getPassword().get());
        }

        @Test
        @DisplayName("Should handle minimum batch size")
        void shouldHandleMinimumBatchSize() {
            JdbcExecutionOptions options = factory.getExecutionOptions(1, 0);

            assertEquals(1, options.getBatchSize());
            assertEquals(0, options.getBatchIntervalMs());
        }
    }
}
