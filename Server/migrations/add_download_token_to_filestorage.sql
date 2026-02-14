-- Add download_token column to filestorage table
ALTER TABLE filestorage ADD COLUMN IF NOT EXISTS download_token VARCHAR(64) UNIQUE;

-- Create index for faster token lookups
CREATE INDEX IF NOT EXISTS idx_filestorage_download_token ON filestorage(download_token);

-- Add comment
COMMENT ON COLUMN filestorage.download_token IS 'Secure token for downloading files without exposing full paths';
