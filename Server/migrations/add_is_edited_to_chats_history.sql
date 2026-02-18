-- Migration: Add is_edited column to chats_history table
-- This column tracks whether a message has been edited

ALTER TABLE chats_history 
ADD COLUMN IF NOT EXISTS is_edited INTEGER DEFAULT 0;

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_chats_history_is_edited ON chats_history(is_edited);

-- Add comment
COMMENT ON COLUMN chats_history.is_edited IS 'Flag indicating if message has been edited (0 = not edited, 1 = edited)';
