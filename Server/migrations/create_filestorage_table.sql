-- Migration: Create filestorage table
-- This table stores file storage paths and metadata for proof jobs
-- Links customer_id and runner_id for proper folder organization

CREATE TABLE IF NOT EXISTS filestorage (
    id SERIAL PRIMARY KEY,
    runner_id VARCHAR(50) NOT NULL,
    job_id INTEGER REFERENCES jobs(id) ON DELETE CASCADE,
    customer_id VARCHAR(50) NOT NULL,
    customer_name VARCHAR(255),
    storage_path VARCHAR(500) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    -- Indexes for faster lookups
    CONSTRAINT unique_runner_customer UNIQUE (runner_id, customer_id)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_filestorage_runner_id ON filestorage(runner_id);
CREATE INDEX IF NOT EXISTS idx_filestorage_customer_id ON filestorage(customer_id);
CREATE INDEX IF NOT EXISTS idx_filestorage_job_id ON filestorage(job_id);
CREATE INDEX IF NOT EXISTS idx_filestorage_storage_path ON filestorage(storage_path);

-- Add comments
COMMENT ON TABLE filestorage IS 'Stores file storage paths and metadata for proof jobs';
COMMENT ON COLUMN filestorage.runner_id IS 'Runner ID (e.g., WMT-120226-J0001)';
COMMENT ON COLUMN filestorage.job_id IS 'Reference to jobs table';
COMMENT ON COLUMN filestorage.customer_id IS 'Customer ID (e.g., A001, A123)';
COMMENT ON COLUMN filestorage.customer_name IS 'Customer name for reference';
COMMENT ON COLUMN filestorage.storage_path IS 'Full storage path (e.g., /volumes/filestorage/WMT/A001/WMT-120226-J0001)';
