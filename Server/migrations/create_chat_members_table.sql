-- Create chat_members table to track who has joined which chats
CREATE TABLE IF NOT EXISTS chat_members (
    id SERIAL PRIMARY KEY,
    chat_id INTEGER NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(chat_id, user_id) -- Prevent duplicate memberships
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_chat_members_chat_id ON chat_members(chat_id);
CREATE INDEX IF NOT EXISTS idx_chat_members_user_id ON chat_members(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_members_joined_at ON chat_members(joined_at);

-- Add comment to table
COMMENT ON TABLE chat_members IS 'Tracks which users have joined which chats';
COMMENT ON COLUMN chat_members.chat_id IS 'Reference to the chat';
COMMENT ON COLUMN chat_members.user_id IS 'Reference to the user who joined';
COMMENT ON COLUMN chat_members.joined_at IS 'Timestamp when user joined the chat';
