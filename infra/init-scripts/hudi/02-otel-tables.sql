-- OTel Data Lake: Hudi Table Definitions
-- Tables for archiving OpenTelemetry data for ML training

-- otel_metrics: Time series metrics from all services
CREATE TABLE IF NOT EXISTS otel_metrics (
    id VARCHAR(64) PRIMARY KEY,
    metric_name VARCHAR(255) NOT NULL,
    metric_type VARCHAR(32),               -- gauge, counter, histogram
    labels JSON,                           -- {"service":"query-service","method":"GET"}
    value DOUBLE PRECISION NOT NULL,
    timestamp BIGINT NOT NULL,
    service_name VARCHAR(64) NOT NULL,
    dt VARCHAR(10) NOT NULL                -- partition key: YYYY-MM-DD
);

CREATE INDEX IF NOT EXISTS idx_otel_metrics_service_dt ON otel_metrics(service_name, dt);
CREATE INDEX IF NOT EXISTS idx_otel_metrics_name ON otel_metrics(metric_name);
CREATE INDEX IF NOT EXISTS idx_otel_metrics_timestamp ON otel_metrics(timestamp);

-- otel_logs: Structured log entries
CREATE TABLE IF NOT EXISTS otel_logs (
    id VARCHAR(64) PRIMARY KEY,
    trace_id VARCHAR(32),
    span_id VARCHAR(16),
    severity VARCHAR(16),                  -- INFO, WARN, ERROR, DEBUG
    body TEXT NOT NULL,
    attributes JSON,                       -- {"user_id":"123","request_id":"abc"}
    resource_attributes JSON,
    timestamp BIGINT NOT NULL,
    service_name VARCHAR(64) NOT NULL,
    dt VARCHAR(10) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_otel_logs_service_dt ON otel_logs(service_name, dt);
CREATE INDEX IF NOT EXISTS idx_otel_logs_trace ON otel_logs(trace_id);
CREATE INDEX IF NOT EXISTS idx_otel_logs_severity ON otel_logs(severity);
CREATE INDEX IF NOT EXISTS idx_otel_logs_timestamp ON otel_logs(timestamp);

-- otel_traces: Distributed trace spans
CREATE TABLE IF NOT EXISTS otel_traces (
    id VARCHAR(64) PRIMARY KEY,
    trace_id VARCHAR(32) NOT NULL,
    span_id VARCHAR(16) NOT NULL,
    parent_span_id VARCHAR(16),
    operation_name VARCHAR(255) NOT NULL,
    service_name VARCHAR(64) NOT NULL,
    duration_ms BIGINT NOT NULL,
    status_code VARCHAR(16),               -- OK, ERROR, UNSET
    attributes JSON,
    events JSON,                           -- span events
    timestamp BIGINT NOT NULL,
    dt VARCHAR(10) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_otel_traces_service_dt ON otel_traces(service_name, dt);
CREATE INDEX IF NOT EXISTS idx_otel_traces_trace_id ON otel_traces(trace_id);
CREATE INDEX IF NOT EXISTS idx_otel_traces_operation ON otel_traces(operation_name);
CREATE INDEX IF NOT EXISTS idx_otel_traces_timestamp ON otel_traces(timestamp);

-- Hudi metadata comments
COMMENT ON TABLE otel_metrics IS 'Hudi MOR table partitioned by (service_name, dt)';
COMMENT ON TABLE otel_logs IS 'Hudi MOR table partitioned by (service_name, dt)';
COMMENT ON TABLE otel_traces IS 'Hudi MOR table partitioned by (service_name, dt)';
