-- Chain Risk Platform Database Initialization

-- Create schemas
CREATE SCHEMA IF NOT EXISTS chain_data;
CREATE SCHEMA IF NOT EXISTS risk;
CREATE SCHEMA IF NOT EXISTS alert;

-- Transfers table
CREATE TABLE IF NOT EXISTS chain_data.transfers (
    id BIGSERIAL PRIMARY KEY,
    tx_hash VARCHAR(66) NOT NULL,
    block_number BIGINT NOT NULL,
    from_address VARCHAR(42) NOT NULL,
    to_address VARCHAR(42) NOT NULL,
    value NUMERIC(78, 0) NOT NULL,
    token_address VARCHAR(42),
    token_symbol VARCHAR(20),
    timestamp TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_transfers_from (from_address),
    INDEX idx_transfers_to (to_address),
    INDEX idx_transfers_block (block_number),
    INDEX idx_transfers_timestamp (timestamp)
);

-- Address risk scores table
CREATE TABLE IF NOT EXISTS risk.address_scores (
    address VARCHAR(42) PRIMARY KEY,
    risk_score DECIMAL(5, 4) NOT NULL,
    risk_level VARCHAR(20) NOT NULL,
    factors JSONB,
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_risk_score (risk_score),
    INDEX idx_risk_level (risk_level)
);

-- Alerts table
CREATE TABLE IF NOT EXISTS alert.alerts (
    id BIGSERIAL PRIMARY KEY,
    alert_type VARCHAR(50) NOT NULL,
    severity VARCHAR(20) NOT NULL,
    address VARCHAR(42),
    tx_hash VARCHAR(66),
    message TEXT NOT NULL,
    metadata JSONB,
    status VARCHAR(20) DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    resolved_at TIMESTAMP,
    
    INDEX idx_alerts_type (alert_type),
    INDEX idx_alerts_severity (severity),
    INDEX idx_alerts_status (status),
    INDEX idx_alerts_created (created_at)
);
