# Unique ID Format Reference

## Format: QT-DDMMYY-{NUM}

### Components:
- **QT** - Queue/Task prefix (fixed)
- **DDMMYY** - Date in day-month-year format
- **{NUM}** - Sequential number for that day (starts at 1)

### Examples:
```
QT-100226-1   → First queue on February 10, 2026
QT-100226-2   → Second queue on February 10, 2026
QT-110226-1   → First queue on February 11, 2026
QT-010326-15  → 15th queue on March 1, 2026
```

### Benefits:
1. **Human-Readable**: Easy to reference in conversations
2. **Date-Sortable**: Can sort by date from the ID
3. **Daily Reset**: Numbers reset each day, keeping them manageable
4. **Unique**: Guaranteed unique across the system
5. **Searchable**: Easy to search in database or UI

### Database Implementation:
```sql
-- Column definition
unique_id VARCHAR(50)

-- Index for fast lookups
CREATE INDEX idx_chats_unique_id ON chats(unique_id);

-- Query by unique ID
SELECT * FROM chats WHERE unique_id = 'QT-100226-1';

-- Get all chats for a specific date
SELECT * FROM chats WHERE unique_id LIKE 'QT-100226-%';
```

### API Usage:
```javascript
// Display in UI
<div>Queue ID: {chat.uniqueId}</div>
// Output: Queue ID: QT-100226-1

// Search by unique ID
const chat = await getChat('QT-100226-1');

// Filter by date
const chatsToday = chats.filter(c => 
  c.uniqueId.startsWith('QT-100226-')
);
```

### Generation Logic:
1. Get current date in DDMMYY format
2. Count existing chats with same date prefix
3. Increment count by 1
4. Format as `QT-{date}-{count}`

### Edge Cases:
- **Midnight Rollover**: New day = new sequence starting at 1
- **Deleted Chats**: Numbers are not reused (gaps are OK)
- **Concurrent Creation**: Database handles race conditions
- **Backfill**: Existing chats get IDs based on creation date

### Frontend Display:
```typescript
// StickyStatus.tsx
const displayId = queueData?.uniqueId || 
  `Queue #${queueData?.id}`;

// Output: QT-100226-1 (or fallback to Queue #123)
```

### Backend Generation:
```go
func GenerateNextChatUniqueID() (string, error) {
    now := time.Now()
    dateStr := now.Format("020106") // DDMMYY
    prefix := fmt.Sprintf("QT-%s-", dateStr)
    
    var count int
    db.QueryRow(`
        SELECT COUNT(*) FROM chats 
        WHERE unique_id LIKE $1
    `, prefix+"%").Scan(&count)
    
    return fmt.Sprintf("%s%d", prefix, count+1), nil
}
```

### Migration:
```sql
-- Add column
ALTER TABLE chats ADD COLUMN unique_id VARCHAR(50);

-- Backfill existing data
UPDATE chats 
SET unique_id = 'QT-' || TO_CHAR(created_at, 'DDMMYY') || '-' || row_number
WHERE unique_id IS NULL;
```

### Testing:
```bash
# Create multiple chats on same day
curl -X POST /api/chats -d '{"name":"Test 1"}'
# Response: {"uniqueId": "QT-100226-1"}

curl -X POST /api/chats -d '{"name":"Test 2"}'
# Response: {"uniqueId": "QT-100226-2"}

curl -X POST /api/chats -d '{"name":"Test 3"}'
# Response: {"uniqueId": "QT-100226-3"}
```

### Support Use Cases:
```
Customer: "I need help with my order"
Support: "What's your queue ID?"
Customer: "QT-100226-1"
Support: *searches* "Found it! Let me check the status..."
```

### Reporting:
```sql
-- Daily queue count
SELECT 
  SUBSTRING(unique_id, 4, 6) as date,
  COUNT(*) as total_queues
FROM chats
WHERE unique_id IS NOT NULL
GROUP BY SUBSTRING(unique_id, 4, 6)
ORDER BY date DESC;

-- Output:
-- date    | total_queues
-- 100226  | 15
-- 090226  | 23
-- 080226  | 18
```
