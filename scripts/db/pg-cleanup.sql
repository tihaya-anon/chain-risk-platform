-- PostgreSQL Rolling Cleanup Script
-- Drops old partitions and creates future partitions
-- Run via cron: daily at 00:05

-- ============================================
-- Configuration (set via environment or defaults)
-- ============================================

-- Default retention: 30 days for transfers/transactions, 90 days for alerts
DO $$
DECLARE
    v_transfers_retention INTEGER := COALESCE(NULLIF(current_setting('app.transfers_retention_days', true), '')::INTEGER, 30);
    v_transactions_retention INTEGER := COALESCE(NULLIF(current_setting('app.transactions_retention_days', true), '')::INTEGER, 30);
    v_alerts_retention INTEGER := COALESCE(NULLIF(current_setting('app.alerts_retention_days', true), '')::INTEGER, 90);
BEGIN
    RAISE NOTICE 'Retention config: transfers=% days, transactions=% days, alerts=% days',
        v_transfers_retention, v_transactions_retention, v_alerts_retention;
END $$;

-- ============================================
-- 1. Drop Old Partitions Function
-- ============================================

CREATE OR REPLACE FUNCTION chain_data.drop_old_partitions(
    p_table_name TEXT,
    p_schema_name TEXT,
    p_retention_days INTEGER
) RETURNS INTEGER AS $$
DECLARE
    v_cutoff_date DATE;
    v_partition RECORD;
    v_count INTEGER := 0;
    v_partition_date DATE;
BEGIN
    v_cutoff_date := CURRENT_DATE - (p_retention_days || ' days')::INTERVAL;
    
    FOR v_partition IN
        SELECT 
            child.relname AS partition_name,
            nmsp_child.nspname AS partition_schema
        FROM pg_inherits
        JOIN pg_class parent ON pg_inherits.inhparent = parent.oid
        JOIN pg_class child ON pg_inherits.inhrelid = child.oid
        JOIN pg_namespace nmsp_parent ON parent.relnamespace = nmsp_parent.oid
        JOIN pg_namespace nmsp_child ON child.relnamespace = nmsp_child.oid
        WHERE parent.relname = p_table_name
          AND nmsp_parent.nspname = p_schema_name
    LOOP
        -- Extract date from partition name (format: tablename_YYYYMMDD)
        BEGIN
            v_partition_date := TO_DATE(
                SUBSTRING(v_partition.partition_name FROM '_(\d{8})$'),
                'YYYYMMDD'
            );
            
            IF v_partition_date < v_cutoff_date THEN
                EXECUTE format('DROP TABLE IF EXISTS %I.%I', 
                    v_partition.partition_schema, v_partition.partition_name);
                RAISE NOTICE 'Dropped partition: %.%', 
                    v_partition.partition_schema, v_partition.partition_name;
                v_count := v_count + 1;
            END IF;
        EXCEPTION
            WHEN OTHERS THEN
                RAISE WARNING 'Could not parse date from partition: %', v_partition.partition_name;
        END;
    END LOOP;
    
    RETURN v_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 2. Create Future Partitions Function
-- ============================================

CREATE OR REPLACE FUNCTION chain_data.create_future_partitions(
    p_days_ahead INTEGER DEFAULT 7
) RETURNS INTEGER AS $$
DECLARE
    v_start DATE := CURRENT_DATE;
    v_end DATE := CURRENT_DATE + (p_days_ahead || ' days')::INTERVAL;
    v_count INTEGER := 0;
BEGIN
    -- Create partitions for transfers_partitioned
    v_count := v_count + chain_data.ensure_partitions(
        'transfers_partitioned', 'chain_data', v_start, v_end, 'daily'
    );
    
    -- Create partitions for transactions_partitioned
    v_count := v_count + chain_data.ensure_partitions(
        'transactions_partitioned', 'chain_data', v_start, v_end, 'daily'
    );
    
    -- Create partitions for alert_history_partitioned
    v_count := v_count + chain_data.ensure_partitions(
        'alert_history_partitioned', 'alert', v_start, v_end, 'daily'
    );
    
    RETURN v_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 3. Main Cleanup Function
-- ============================================

CREATE OR REPLACE FUNCTION chain_data.rolling_cleanup(
    p_transfers_retention INTEGER DEFAULT 30,
    p_transactions_retention INTEGER DEFAULT 30,
    p_alerts_retention INTEGER DEFAULT 90,
    p_future_days INTEGER DEFAULT 7
) RETURNS TABLE (
    operation TEXT,
    table_name TEXT,
    partitions_affected INTEGER
) AS $$
DECLARE
    v_dropped_transfers INTEGER;
    v_dropped_transactions INTEGER;
    v_dropped_alerts INTEGER;
    v_created INTEGER;
BEGIN
    -- Drop old partitions
    SELECT chain_data.drop_old_partitions('transfers_partitioned', 'chain_data', p_transfers_retention) 
    INTO v_dropped_transfers;
    
    SELECT chain_data.drop_old_partitions('transactions_partitioned', 'chain_data', p_transactions_retention) 
    INTO v_dropped_transactions;
    
    SELECT chain_data.drop_old_partitions('alert_history_partitioned', 'alert', p_alerts_retention) 
    INTO v_dropped_alerts;
    
    -- Create future partitions
    SELECT chain_data.create_future_partitions(p_future_days) INTO v_created;
    
    -- Vacuum analyze affected tables
    EXECUTE 'VACUUM ANALYZE chain_data.transfers_partitioned';
    EXECUTE 'VACUUM ANALYZE chain_data.transactions_partitioned';
    EXECUTE 'VACUUM ANALYZE alert.alert_history_partitioned';
    
    -- Return results
    operation := 'drop_old'; table_name := 'transfers_partitioned'; partitions_affected := v_dropped_transfers;
    RETURN NEXT;
    
    operation := 'drop_old'; table_name := 'transactions_partitioned'; partitions_affected := v_dropped_transactions;
    RETURN NEXT;
    
    operation := 'drop_old'; table_name := 'alert_history_partitioned'; partitions_affected := v_dropped_alerts;
    RETURN NEXT;
    
    operation := 'create_future'; table_name := 'all'; partitions_affected := v_created;
    RETURN NEXT;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 4. Cleanup Audit Log
-- ============================================

CREATE TABLE IF NOT EXISTS chain_data.cleanup_log (
    id BIGSERIAL PRIMARY KEY,
    operation VARCHAR(50) NOT NULL,
    table_name VARCHAR(100),
    partitions_dropped INTEGER DEFAULT 0,
    partitions_created INTEGER DEFAULT 0,
    execution_time_ms INTEGER,
    executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Wrapper function with logging
CREATE OR REPLACE FUNCTION chain_data.rolling_cleanup_with_log(
    p_transfers_retention INTEGER DEFAULT 30,
    p_transactions_retention INTEGER DEFAULT 30,
    p_alerts_retention INTEGER DEFAULT 90,
    p_future_days INTEGER DEFAULT 7
) RETURNS VOID AS $$
DECLARE
    v_start_time TIMESTAMP;
    v_result RECORD;
    v_total_dropped INTEGER := 0;
    v_total_created INTEGER := 0;
BEGIN
    v_start_time := clock_timestamp();
    
    FOR v_result IN 
        SELECT * FROM chain_data.rolling_cleanup(
            p_transfers_retention, p_transactions_retention, p_alerts_retention, p_future_days
        )
    LOOP
        IF v_result.operation = 'drop_old' THEN
            v_total_dropped := v_total_dropped + v_result.partitions_affected;
        ELSE
            v_total_created := v_result.partitions_affected;
        END IF;
    END LOOP;
    
    -- Log the cleanup run
    INSERT INTO chain_data.cleanup_log (operation, partitions_dropped, partitions_created, execution_time_ms)
    VALUES (
        'rolling_cleanup',
        v_total_dropped,
        v_total_created,
        EXTRACT(MILLISECONDS FROM clock_timestamp() - v_start_time)::INTEGER
    );
    
    RAISE NOTICE 'Cleanup complete: dropped=%, created=%, time=%ms',
        v_total_dropped, v_total_created,
        EXTRACT(MILLISECONDS FROM clock_timestamp() - v_start_time)::INTEGER;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 5. Get Partition Statistics
-- ============================================

CREATE OR REPLACE FUNCTION chain_data.get_partition_stats()
RETURNS TABLE (
    table_name TEXT,
    partition_count BIGINT,
    total_size TEXT,
    oldest_partition DATE,
    newest_partition DATE
) AS $$
BEGIN
    RETURN QUERY
    WITH partition_dates AS (
        SELECT 
            parent.relname AS parent_table,
            TO_DATE(SUBSTRING(child.relname FROM '_(\d{8})$'), 'YYYYMMDD') AS partition_date,
            pg_relation_size(child.oid) AS size_bytes
        FROM pg_inherits
        JOIN pg_class parent ON pg_inherits.inhparent = parent.oid
        JOIN pg_class child ON pg_inherits.inhrelid = child.oid
        WHERE parent.relkind = 'p'
    )
    SELECT 
        parent_table,
        COUNT(*)::BIGINT,
        pg_size_pretty(SUM(size_bytes))::TEXT,
        MIN(partition_date),
        MAX(partition_date)
    FROM partition_dates
    GROUP BY parent_table
    ORDER BY parent_table;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- Example Usage
-- ============================================

-- Run cleanup with default retention
-- SELECT * FROM chain_data.rolling_cleanup();

-- Run cleanup with custom retention
-- SELECT * FROM chain_data.rolling_cleanup(14, 14, 30, 7);

-- Run cleanup with logging
-- SELECT chain_data.rolling_cleanup_with_log();

-- Check partition stats
-- SELECT * FROM chain_data.get_partition_stats();

-- View cleanup history
-- SELECT * FROM chain_data.cleanup_log ORDER BY executed_at DESC LIMIT 10;
