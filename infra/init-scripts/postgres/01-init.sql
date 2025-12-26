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
    log_index INTEGER NOT NULL DEFAULT 0,
    from_address VARCHAR(42) NOT NULL,
    to_address VARCHAR(42) NOT NULL,
    value NUMERIC(78, 0) NOT NULL,
    token_address VARCHAR(42),
    token_symbol VARCHAR(20),
    token_decimal INTEGER,
    timestamp TIMESTAMP NOT NULL,
    transfer_type VARCHAR(20) NOT NULL DEFAULT 'native',
    network VARCHAR(20) NOT NULL DEFAULT 'ethereum',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT uk_transfers_tx_log UNIQUE (tx_hash, log_index)
);

-- Indexes for transfers
CREATE INDEX IF NOT EXISTS idx_transfers_from ON chain_data.transfers(from_address);
CREATE INDEX IF NOT EXISTS idx_transfers_to ON chain_data.transfers(to_address);
CREATE INDEX IF NOT EXISTS idx_transfers_block ON chain_data.transfers(block_number);
CREATE INDEX IF NOT EXISTS idx_transfers_timestamp ON chain_data.transfers(timestamp);
CREATE INDEX IF NOT EXISTS idx_transfers_token ON chain_data.transfers(token_address) WHERE token_address IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_transfers_network ON chain_data.transfers(network);

-- Transactions table (raw transactions for reference)
CREATE TABLE IF NOT EXISTS chain_data.transactions (
    id BIGSERIAL PRIMARY KEY,
    hash VARCHAR(66) NOT NULL UNIQUE,
    block_number BIGINT NOT NULL,
    block_hash VARCHAR(66),
    transaction_index INTEGER,
    from_address VARCHAR(42) NOT NULL,
    to_address VARCHAR(42),
    value NUMERIC(78, 0) NOT NULL,
    gas BIGINT,
    gas_price NUMERIC(78, 0),
    gas_used BIGINT,
    nonce BIGINT,
    input TEXT,
    timestamp TIMESTAMP NOT NULL,
    is_error BOOLEAN DEFAULT FALSE,
    contract_address VARCHAR(42),
    network VARCHAR(20) NOT NULL DEFAULT 'ethereum',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_transactions_block ON chain_data.transactions(block_number);
CREATE INDEX IF NOT EXISTS idx_transactions_from ON chain_data.transactions(from_address);
CREATE INDEX IF NOT EXISTS idx_transactions_to ON chain_data.transactions(to_address);
CREATE INDEX IF NOT EXISTS idx_transactions_timestamp ON chain_data.transactions(timestamp);

-- Address risk scores table
CREATE TABLE IF NOT EXISTS risk.address_scores (
    address VARCHAR(42) PRIMARY KEY,
    risk_score DECIMAL(5, 4) NOT NULL,
    risk_level VARCHAR(20) NOT NULL,
    factors JSONB,
    tags TEXT[],
    first_seen TIMESTAMP,
    last_seen TIMESTAMP,
    tx_count INTEGER DEFAULT 0,
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_risk_score ON risk.address_scores(risk_score);
CREATE INDEX IF NOT EXISTS idx_risk_level ON risk.address_scores(risk_level);
CREATE INDEX IF NOT EXISTS idx_risk_tags ON risk.address_scores USING GIN(tags);

-- Address labels table
CREATE TABLE IF NOT EXISTS risk.address_labels (
    id BIGSERIAL PRIMARY KEY,
    address VARCHAR(42) NOT NULL,
    label VARCHAR(100) NOT NULL,
    category VARCHAR(50),
    source VARCHAR(50) NOT NULL,
    confidence DECIMAL(3, 2) DEFAULT 1.0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT uk_address_label_source UNIQUE (address, label, source)
);

CREATE INDEX IF NOT EXISTS idx_labels_address ON risk.address_labels(address);
CREATE INDEX IF NOT EXISTS idx_labels_category ON risk.address_labels(category);

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
    resolved_by VARCHAR(100)
);

CREATE INDEX IF NOT EXISTS idx_alerts_type ON alert.alerts(alert_type);
CREATE INDEX IF NOT EXISTS idx_alerts_severity ON alert.alerts(severity);
CREATE INDEX IF NOT EXISTS idx_alerts_status ON alert.alerts(status);
CREATE INDEX IF NOT EXISTS idx_alerts_created ON alert.alerts(created_at);
CREATE INDEX IF NOT EXISTS idx_alerts_address ON alert.alerts(address) WHERE address IS NOT NULL;

-- Alert rules table
CREATE TABLE IF NOT EXISTS alert.rules (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    rule_type VARCHAR(50) NOT NULL,
    conditions JSONB NOT NULL,
    severity VARCHAR(20) NOT NULL DEFAULT 'medium',
    enabled BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Processing state table (for tracking processed blocks)
CREATE TABLE IF NOT EXISTS chain_data.processing_state (
    id VARCHAR(50) PRIMARY KEY,
    last_processed_block BIGINT NOT NULL,
    network VARCHAR(20) NOT NULL,
    processor_type VARCHAR(50) NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Function to update timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger for alert rules
DROP TRIGGER IF EXISTS update_alert_rules_updated_at ON alert.rules;
CREATE TRIGGER update_alert_rules_updated_at
    BEFORE UPDATE ON alert.rules
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
