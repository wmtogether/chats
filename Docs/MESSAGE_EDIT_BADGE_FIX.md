# Message Edit Badge Fix

## Problem
The "edited" badge was showing on all messages, even those that were never edited. This was because the badge was checking for `editedAt` field existence, which could be set even on first send.

## Solution
Added an `is_edited` column to track whether a message has actually been edited.

## Changes Made

### 1. Database Migration
**File**: `Server/migrations/add_is_edited_to_chats_history.sql`
- Added `is_edited INTEGER DEFAULT 0` column to `chats_history` table
- 0 = not edited (default)
- 1 = edited
- Created index for performance

### 2. Backend (Go)

#### Updated ChatMessage Struct
**File**: `Server/chat.go`
```go
type ChatMessage struct {
    // ... other fields
    IsEdited    int          `json:"isEdited"`    // 0 = not edited, 1 = edited
    EditedAt    sql.NullTime `json:"editedAt"`
    // ... other fields
}
```

#### Updated CreateMessage Function
**File**: `Server/database.go`
- Sets `is_edited = 0` when creating new messages
- Updated INSERT query to include `is_edited` column
- Updated RETURNING clause to include `is_edited`

#### Updated UpdateMessage Function
**File**: `Server/database.go`
- Sets `is_edited = 1` when editing messages
- Updated UPDATE query: `SET content = $1, attachments = $2, is_edited = 1, edited_at = $3`

#### Updated GetMessageByID Function
**File**: `Server/database.go`
- Updated SELECT query to include `is_edited`
- Updated Scan to include `is_edited` field

#### Updated GetMessagesByChannelID Function
**File**: `Server/database.go`
- Updated SELECT query to include `is_edited`
- Updated Scan to include `is_edited` field

#### Updated Search Messages Handler
**File**: `Server/handlers_message.go`
- Updated search query to include `is_edited`
- Updated Scan to include `is_edited` field

### 3. Frontend (TypeScript/React)

#### Updated MessageBubbleData Interface
**File**: `Source/Library/types.ts`
```typescript
export interface MessageBubbleData {
    // ... other fields
    isEdited?: number; // 0 = not edited, 1 = edited
    editedAt?: string;
    // ... other fields
}
```

#### Updated MessageBubble Component
**File**: `Source/Components/MessageBubble.tsx`
- Changed condition from `{data.editedAt && ...}` to `{data.isEdited === 1 && ...}`
- Now only shows "(edited)" badge when `isEdited === 1`

## Behavior

### Before Fix
- All messages showed "(edited)" badge if `editedAt` was set
- Even first-time sent messages could show the badge

### After Fix
- New messages: `is_edited = 0`, no badge shown
- Edited messages: `is_edited = 1`, badge shown
- Badge only appears after actual edit operation

## Database Schema

```sql
ALTER TABLE chats_history 
ADD COLUMN IF NOT EXISTS is_edited INTEGER DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_chats_history_is_edited 
ON chats_history(is_edited);
```

## API Response Example

### New Message
```json
{
    "messageId": "msg_123_456",
    "content": "Hello world",
    "isEdited": 0,
    "editedAt": null,
    "createdAt": "2026-02-18T10:00:00Z"
}
```

### Edited Message
```json
{
    "messageId": "msg_123_456",
    "content": "Hello world (updated)",
    "isEdited": 1,
    "editedAt": "2026-02-18T10:05:00Z",
    "createdAt": "2026-02-18T10:00:00Z"
}
```

## Testing

1. **Send new message**: Should NOT show "(edited)" badge
2. **Edit message**: Should show "(edited)" badge after edit
3. **Search messages**: Should include `isEdited` field in results
4. **Load chat history**: Should correctly show/hide badge based on `isEdited` value

## Migration Steps

1. Run the migration SQL script to add the column
2. Restart the Go backend to load new schema
3. Frontend will automatically use the new `isEdited` field
4. Existing messages will have `is_edited = 0` by default

## Backward Compatibility

- Existing messages without `is_edited` will default to 0 (not edited)
- Frontend checks for `isEdited === 1` explicitly
- `editedAt` field is still maintained for timestamp information
