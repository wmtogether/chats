-- Add chat_uuid column to filestorage table to link storage to chats
ALTER TABLE filestorage ADD COLUMN IF NOT EXISTS chat_uuid VARCHAR(255);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_filestorage_chat_uuid ON filestorage(chat_uuid);
