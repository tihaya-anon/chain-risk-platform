-- Migration: Add Lambda Architecture fields to transfers table
-- Date: 2026-01-03
-- Description: Add source and corrected_at columns for Lambda Architecture

-- Add source column (stream or batch)
ALTER TABLE chain_data.transfers 
ADD COLUMN IF NOT EXISTS source VARCHAR(10) DEFAULT 'stream';

-- Add corrected_at column (timestamp when batch corrected)
ALTER TABLE chain_data.transfers 
ADD COLUMN IF NOT EXISTS corrected_at TIMESTAMP;

-- Create index on source for efficient filtering
CREATE INDEX IF NOT EXISTS idx_transfers_source ON chain_data.transfers(source);

-- Add comment
COMMENT ON COLUMN chain_data.transfers.source IS 'Data source: stream (Speed Layer) or batch (Batch Layer)';
COMMENT ON COLUMN chain_data.transfers.corrected_at IS 'Timestamp when data was corrected by Batch Layer';
