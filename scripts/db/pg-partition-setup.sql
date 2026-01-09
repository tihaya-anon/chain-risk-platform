-- PostgreSQL Partition Setup for Rolling Data Cleanup
-- Converts existing tables to partitioned tables by timestamp
-- Retention: Configurable via environment (default 30 days)

-- ============================================
-- 1. Create Partitioned Transfers Table
-- ============================================

-- Create new partitioned table
CREATE TABLE IF NOT EXISTS chain_data.transfers_partitioned (
    id BIGSERIAL,
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
    source VARCHAR(10) DEFAULT 'stream',
    corrected_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    PRIMARY KEY (id, timestamp),
    CONSTRAINT uk_transfers_part_tx_log UNIQUE (tx_hash, log_index, timestamp)
) PARTITION BY RANGE (timestamp);

-- Create indexes on partitioned table
CREATE INDEX IF NOT EXISTS idx_transfers_part_from ON chain_data.transfers_partitioned(from_address);
CREATE INDEX IF NOT EXISTS idx_transfers_part_to ON chain_data.transfers_partitioned(to_address);
CREATE INDEX IF NOT EXISTS idx_transfers_part_block ON chain_data.transfers_partitioned(block_number);
CREATE INDEX IF NOT EXISTS idx_transfers_part_token ON chain_data.transfers_partitioned(token_address) WHERE token_address IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_transfers_part_network ON chain_data.transfers_partitioned(network);

-- ============================================
-- 2. Create Partitioned Transactions Table
-- ============================================

CREATE TABLE IF NOT EXISTS chain_data.transactions_partitioned (
    id BIGSERIAL,
    hash VARCHAR(66) NOT NULL,
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
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    PRIMARY KEY (id, timestamp),
    CONSTRAINT uk_transactions_part_hash UNIQUE (hash, timestamp)
) PARTITION BY RANGE (timestamp);

CREATE INDEX IF NOT EXISTS idx_transactions_part_block ON chain_data.transactions_partitioned(block_number);
CREATE INDEX IF NOT EXISTS idx_transactions_part_from ON chain_data.transactions_partitioned(from_address);
CREATE INDEX IF NOT EXISTS idx_transactions_part_to ON chain_data.transactions_partitioned(to_address);

-- ============================================
-- 3. Create Partitioned Alert History Table
-- ============================================

CREATE TABLE IF NOT EXISTS alert.alert_history_partitioned (
    id BIGSERIAL,
    rule_id BIGINT,
    alert_type VARCHAR(50) NOT NULL,
    severity VARCHAR(20) NOT NULL,
    entity_type VARCHAR(50) NOT NULL,
    entity_id VARCHAR(255) NOT NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    metadata JSONB,
    status VARCHAR(20) DEFAULT 'pending',
    notified_at TIMESTAMP,
    acknowledged_at TIMESTAMP,
    acknowledged_by VARCHAR(255),
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    
    PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);

CREATE INDEX IF NOT EXISTS idx_alert_hist_part_rule ON alert.alert_history_partitioned(rule_id);
CREATE INDEX IF NOT EXISTS idx_alert_hist_part_entity ON alert.alert_history_partitioned(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_alert_hist_part_status ON alert.alert_history_partitioned(status);
CREATE INDEX IF NOT EXISTS idx_alert_hist_part_severity ON alert.alert_history_partitioned(severity);

-- ============================================
-- 4. Partition Management Functions
-- ============================================

-- Function to create daily partitions
CREATE OR REPLACE FUNCTION chain_data.create_daily_partition(
    p_table_name TEXT,
    p_schema_name TEXT,
    p_date DATE
) RETURNS VOID AS $$
DECLARE
    v_partition_name TEXT;
    v_start_date DATE;
    v_end_date DATE;
BEGIN
    v_partition_name := p_table_name || '_' || TO_CHAR(p_date, 'YYYYMMDD');
    v_start_date := p_date;
    v_end_date := p_date + INTERVAL '1 day';
    
    EXECUTE format(
        'CREATE TABLE IF NOT EXISTS %I.%I PARTITION OF %I.%I 
         FOR VALUES FROM (%L) TO (%L)',
        p_schema_name, v_partition_name,
        p_schema_name, p_table_name,
        v_start_date, v_end_date
    );
    
    RAISE NOTICE 'Created partition: %.%', p_schema_name, v_partition_name;
END;
$$ LANGUAGE plpgsql;

-- Function to create weekly partitions
CREATE OR REPLACE FUNCTION chain_data.create_weekly_partition(
    p_table_name TEXT,
    p_schema_name TEXT,
    p_date DATE
) RETURNS VOID AS $$
DECLARE
    v_partition_name TEXT;
    v_start_date DATE;
    v_end_date DATE;
BEGIN
    -- Get Monday of the week
    v_start_date := DATE_TRUNC('week', p_date)::DATE;
    v_end_date := v_start_date + INTERVAL '7 days';
    v_partition_name := p_table_name || '_' || TO_CHAR(v_start_date, 'YYYYMMDD');
    
    EXECUTE format(
        'CREATE TABLE IF NOT EXISTS %I.%I PARTITION OF %I.%I 
         FOR VALUES FROM (%L) TO (%L)',
        p_schema_name, v_partition_name,
        p_schema_name, p_table_name,
        v_start_date, v_end_date
    );
    
    RAISE NOTICE 'Created partition: %.%', p_schema_name, v_partition_name;
END;
$$ LANGUAGE plpgsql;

-- Function to ensure partitions exist for date range
CREATE OR REPLACE FUNCTION chain_data.ensure_partitions(
    p_table_name TEXT,
    p_schema_name TEXT,
    p_start_date DATE,
    p_end_date DATE,
    p_interval TEXT DEFAULT 'daily'
) RETURNS INTEGER AS $$
DECLARE
    v_current DATE;
    v_count INTEGER := 0;
BEGIN
    v_current := p_start_date;
    
    WHILE v_current <= p_end_date LOOP
        IF p_interval = 'daily' THEN
            PERFORM chain_data.create_daily_partition(p_table_name, p_schema_name, v_current);
            v_current := v_current + INTERVAL '1 day';
        ELSE
            PERFORM chain_data.create_weekly_partition(p_table_name, p_schema_name, v_current);
            v_current := v_current + INTERVAL '7 days';
        END IF;
        v_count := v_count + 1;
    END LOOP;
    
    RETURN v_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 5. Create Initial Partitions (7 days back + 7 days forward)
-- ============================================

DO $$
DECLARE
    v_start DATE := CURRENT_DATE - INTERVAL '7 days';
    v_end DATE := CURRENT_DATE + INTERVAL '7 days';
BEGIN
    -- Create partitions for transfers
    PERFORM chain_data.ensure_partitions('transfers_partitioned', 'chain_data', v_start, v_end, 'daily');
    
    -- Create partitions for transactions  
    PERFORM chain_data.ensure_partitions('transactions_partitioned', 'chain_data', v_start, v_end, 'daily');
    
    -- Create partitions for alert_history
    PERFORM chain_data.ensure_partitions('alert_history_partitioned', 'alert', v_start, v_end, 'daily');
END $$;

-- ============================================
-- 6. Migrate Existing Data (Optional)
-- ============================================

-- Migration function (run manually when ready)
CREATE OR REPLACE FUNCTION chain_data.migrate_to_partitioned() RETURNS VOID AS $$
BEGIN
    -- Migrate transfers
    INSERT INTO chain_data.transfers_partitioned 
    SELECT * FROM chain_data.transfers 
    ON CONFLICT DO NOTHING;
    
    -- Migrate transactions
    INSERT INTO chain_data.transactions_partitioned 
    SELECT * FROM chain_data.transactions 
    ON CONFLICT DO NOTHING;
    
    RAISE NOTICE 'Migration completed. Verify data before dropping old tables.';
END;
$$ LANGUAGE plpgsql;

-- View for partition information
CREATE OR REPLACE VIEW chain_data.partition_info AS
SELECT 
    nmsp_parent.nspname AS parent_schema,
    parent.relname AS parent_table,
    nmsp_child.nspname AS partition_schema,
    child.relname AS partition_name,
    pg_size_pretty(pg_relation_size(child.oid)) AS partition_size,
    pg_relation_size(child.oid) AS size_bytes
FROM pg_inherits
JOIN pg_class parent ON pg_inherits.inhparent = parent.oid
JOIN pg_class child ON pg_inherits.inhrelid = child.oid
JOIN pg_namespace nmsp_parent ON parent.relnamespace = nmsp_parent.oid
JOIN pg_namespace nmsp_child ON child.relnamespace = nmsp_child.oid
WHERE parent.relkind = 'p'
ORDER BY parent.relname, child.relname;

COMMENT ON VIEW chain_data.partition_info IS 'View to monitor partition sizes and status';
