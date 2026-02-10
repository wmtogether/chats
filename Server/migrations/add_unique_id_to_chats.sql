-- Migration: Add unique_id column to chats table
-- Format: QT-DDMMYY-{NUM}

-- Add the unique_id column
ALTER TABLE chats ADD COLUMN IF NOT EXISTS unique_id VARCHAR(50);

-- Create an index for faster lookups
CREATE INDEX IF NOT EXISTS idx_chats_unique_id ON chats(unique_id);

-- Backfill existing chats with unique IDs (optional, for existing data)
-- This will generate unique IDs for all existing chats based on their creation date
DO $$
DECLARE
    chat_record RECORD;
    date_str TEXT;
    count_for_date INT;
    new_unique_id TEXT;
BEGIN
    FOR chat_record IN 
        SELECT id, created_at 
        FROM chats 
        WHERE unique_id IS NULL 
        ORDER BY created_at ASC
    LOOP
        -- Format date as DDMMYY
        date_str := TO_CHAR(chat_record.created_at, 'DDMMYY');
        
        -- Count existing chats with this date prefix
        SELECT COUNT(*) INTO count_for_date
        FROM chats
        WHERE unique_id LIKE 'QT-' || date_str || '-%';
        
        -- Generate new unique ID
        new_unique_id := 'QT-' || date_str || '-' || (count_for_date + 1)::TEXT;
        
        -- Update the chat
        UPDATE chats 
        SET unique_id = new_unique_id 
        WHERE id = chat_record.id;
        
        RAISE NOTICE 'Updated chat ID % with unique_id: %', chat_record.id, new_unique_id;
    END LOOP;
END $$;

-- Add a comment to the column
COMMENT ON COLUMN chats.unique_id IS 'Unique identifier in format QT-DDMMYY-{NUM} for easy reference';
