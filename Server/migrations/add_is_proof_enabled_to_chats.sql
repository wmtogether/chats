-- Add is_proof_enabled column to chats table
-- When set to 1, file uploads will use the proof's filestorage path instead of the default CN path
ALTER TABLE chats ADD COLUMN IF NOT EXISTS is_proof_enabled SMALLINT DEFAULT 0;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_chats_is_proof_enabled ON chats(is_proof_enabled);

-- Add comment
COMMENT ON COLUMN chats.is_proof_enabled IS 'When 1, use proof filestorage path; when 0, use default CN path';
