-- Create file_downloads table for token-based downloads
CREATE TABLE IF NOT EXISTS file_downloads (
    id SERIAL PRIMARY KEY,
    token VARCHAR(64) UNIQUE NOT NULL,
    file_path TEXT NOT NULL,
    filename VARCHAR(255) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Create index for faster token lookups
CREATE INDEX IF NOT EXISTS idx_file_downloads_token ON file_downloads(token);

-- Add comment
COMMENT ON TABLE file_downloads IS 'Maps download tokens to file paths for secure downloads';
