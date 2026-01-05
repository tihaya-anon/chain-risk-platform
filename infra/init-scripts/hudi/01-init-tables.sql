-- Hudi Table Initialization Script
-- Run via Spark or Trino after infrastructure is up

-- Create database
CREATE SCHEMA IF NOT EXISTS chainrisk;

-- ============================================================
-- Transfers table (MOR - Merge On Read)
-- Stores all historical transfer data
-- ============================================================
CREATE TABLE IF NOT EXISTS chainrisk.transfers (
    tx_hash STRING,
    block_number BIGINT,
    log_index INT,
    from_addr STRING,
    to_addr STRING,
    amount DECIMAL(38, 0),
    token_address STRING,
    token_symbol STRING,
    token_decimal INT,
    timestamp BIGINT,
    transfer_type STRING,
    network STRING,
    source STRING,           -- 'stream' or 'batch'
    created_at TIMESTAMP,
    corrected_at TIMESTAMP,
    dt DATE                  -- partition column
) USING hudi
PARTITIONED BY (network, dt)
TBLPROPERTIES (
    'type' = 'mor',
    'primaryKey' = 'tx_hash,log_index',
    'preCombineField' = 'block_number',
    'hoodie.table.name' = 'transfers',
    'hoodie.datasource.write.operation' = 'upsert',
    'hoodie.cleaner.commits.retained' = '24',
    'hoodie.keep.min.commits' = '20',
    'hoodie.keep.max.commits' = '30'
);

-- ============================================================
-- Address Features table
-- Computed features for ML risk scoring
-- ============================================================
CREATE TABLE IF NOT EXISTS chainrisk.address_features (
    address STRING,
    network STRING,
    
    -- Transaction stats
    tx_count BIGINT,
    sent_count BIGINT,
    received_count BIGINT,
    unique_counterparties BIGINT,
    avg_tx_value DOUBLE,
    max_tx_value DOUBLE,
    tx_value_stddev DOUBLE,
    address_age_days INT,
    
    -- Ratios
    sent_ratio DOUBLE,
    round_amount_ratio DOUBLE,
    small_tx_ratio DOUBLE,
    large_tx_ratio DOUBLE,
    
    -- Graph features
    in_degree BIGINT,
    out_degree BIGINT,
    in_out_ratio DOUBLE,
    unique_in_neighbors BIGINT,
    
    -- Metadata
    computed_at TIMESTAMP,
    feature_version STRING
) USING hudi
PARTITIONED BY (network)
TBLPROPERTIES (
    'type' = 'cow',
    'primaryKey' = 'address,network',
    'preCombineField' = 'computed_at',
    'hoodie.table.name' = 'address_features'
);

-- ============================================================
-- Address Labels table
-- Labels from public sources (OFAC, Tornado Cash, etc.)
-- ============================================================
CREATE TABLE IF NOT EXISTS chainrisk.address_labels (
    address STRING,
    label_type STRING,       -- 'sanctioned', 'mixer', 'exchange'
    label STRING,            -- Specific label name
    source STRING,           -- 'ofac', 'tornado_cash', 'etherscan'
    confidence DOUBLE,       -- 1.0 for official sources
    fetched_at TIMESTAMP
) USING hudi
PARTITIONED BY (source)
TBLPROPERTIES (
    'type' = 'cow',
    'primaryKey' = 'address,source',
    'preCombineField' = 'fetched_at',
    'hoodie.table.name' = 'address_labels'
);

-- ============================================================
-- Training Dataset table
-- Joined features + labels for ML training
-- ============================================================
CREATE TABLE IF NOT EXISTS chainrisk.training_dataset (
    address STRING,
    network STRING,
    
    -- Features
    tx_count BIGINT,
    sent_count BIGINT,
    received_count BIGINT,
    unique_counterparties BIGINT,
    avg_tx_value DOUBLE,
    max_tx_value DOUBLE,
    tx_value_stddev DOUBLE,
    address_age_days INT,
    sent_ratio DOUBLE,
    round_amount_ratio DOUBLE,
    small_tx_ratio DOUBLE,
    large_tx_ratio DOUBLE,
    in_degree BIGINT,
    out_degree BIGINT,
    in_out_ratio DOUBLE,
    unique_in_neighbors BIGINT,
    
    -- Label
    label INT,               -- 1=risky, 0=normal, NULL=unknown
    label_type STRING,
    label_source STRING,
    
    -- Metadata
    created_at TIMESTAMP,
    dataset_version STRING
) USING hudi
PARTITIONED BY (network)
TBLPROPERTIES (
    'type' = 'cow',
    'primaryKey' = 'address,network',
    'preCombineField' = 'created_at',
    'hoodie.table.name' = 'training_dataset'
);

-- ============================================================
-- Address risk scores history table
-- ============================================================
CREATE TABLE IF NOT EXISTS chainrisk.address_risk_history (
    address STRING,
    risk_score DECIMAL(5, 4),
    risk_level STRING,
    factors STRING,          -- JSON string
    tags ARRAY<STRING>,
    network STRING,
    source STRING,
    calculated_at TIMESTAMP,
    dt DATE
) USING hudi
PARTITIONED BY (network, dt)
TBLPROPERTIES (
    'type' = 'mor',
    'primaryKey' = 'address,calculated_at',
    'preCombineField' = 'calculated_at',
    'hoodie.table.name' = 'address_risk_history'
);

-- ============================================================
-- Processing state table
-- ============================================================
CREATE TABLE IF NOT EXISTS chainrisk.processing_state (
    processor_id STRING,
    network STRING,
    last_processed_block BIGINT,
    last_processed_timestamp BIGINT,
    updated_at TIMESTAMP
) USING hudi
TBLPROPERTIES (
    'type' = 'cow',
    'primaryKey' = 'processor_id,network',
    'preCombineField' = 'updated_at',
    'hoodie.table.name' = 'processing_state'
);
