-- Hudi Table Initialization Script
-- Run via Spark or Trino after infrastructure is up

-- Create database
CREATE SCHEMA IF NOT EXISTS chainrisk;

-- Transfers table (MOR - Merge On Read)
-- This table stores all historical transfer data
-- Partitioned by network and date for efficient querying
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
    'hoodie.keep.max.commits' = '30',
    'hoodie.compaction.strategy' = 'org.apache.hudi.table.action.compact.strategy.LogFileSizeBasedCompactionStrategy',
    'hoodie.compaction.target.io' = '512000000'
);

-- Address risk scores history table
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

-- Processing state table (track what blocks have been processed)
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
