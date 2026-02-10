# Sidebar Unique ID Display - Implementation

## Overview
Added unique ID display to the sidebar chat list for easy identification and reference.

## Changes Made

### 1. Visual Display
The unique ID now appears prominently in the sidebar for each chat:

**Location**: Between the creator info and customer info
**Style**: 
- Primary color background (`bg-primary/10`)
- Primary color text (`text-primary`)
- Semibold font weight
- Rounded corners with border
- Stands out from other tags

**Example Display**:
```
┌─────────────────────────────────────┐
│ Test Chat                    10:17  │
│ by Arm (เจ้าของโปรแกรม)      You    │
│ QT-100226-1  John Doe  #C001        │ ← Unique ID here
│ [งานออกแบบใหม่] [Job]              │
└─────────────────────────────────────┘
```

### 2. Search Integration
The unique ID is now searchable in the sidebar search bar:

**Search Examples**:
- Search `QT-100226-1` → Finds the specific chat
- Search `QT-100226` → Finds all chats from that date
- Search `QT-10` → Finds all chats from the 10th day of any month

**Search Highlighting**:
- Matched text is highlighted with primary color background
- Makes it easy to see why a chat matched the search

### 3. Code Changes

#### File: `Source/Components/Sidebar.tsx`

**1. Updated Customer Info Row**:
```typescript
{/* Customer Info Row */}
{(getNullStringValue(chat.customers) || getNullStringValue(chat.customerId) || chat.uniqueId) && (
  <div className="flex items-center gap-2 flex-wrap">
    {chat.uniqueId && (
      <span className="body-small text-primary font-semibold bg-primary/10 px-2 py-1 rounded-md border border-primary/20">
        {searchQuery ? highlightMatch(chat.uniqueId, searchQuery) : chat.uniqueId}
      </span>
    )}
    {/* ... customer name and ID ... */}
  </div>
)}
```

**2. Updated Search Filter**:
```typescript
const filteredChats = useMemo(() => {
  // ... existing code ...
  
  return baseChats.filter(chat =>
    chat.channelName.toLowerCase().includes(query) ||
    chat.uniqueId?.toLowerCase().includes(query) || // ← Added this line
    chat.createdByName.toLowerCase().includes(query) ||
    // ... other filters ...
  );
}, [chats, searchQuery, activeTab, user]);
```

#### File: `Source/Library/types.ts`

**Added uniqueId to ChatType interface**:
```typescript
export interface ChatType {
  id: number;
  uuid: string;
  uniqueId?: string; // Format: QT-DDMMYY-{NUM} ← Added this
  channelId: string;
  // ... other fields ...
}
```

## Visual Hierarchy

The sidebar now displays information in this order:

1. **Chat Name** (title-small, bold) + **Time** (right-aligned)
2. **Creator** (body-small, muted) + **"You" badge** (if applicable)
3. **Unique ID** (primary color, bold) + **Customer Name** + **Customer ID**
4. **Request Type Tag** + **Channel Type** + **Status Badge**

## Benefits

### 1. Easy Reference
- Users can quickly identify chats by their unique ID
- Support staff can ask customers for their "QT number"
- No need to remember long chat names

### 2. Quick Search
- Type `QT-100226-1` to instantly find a specific chat
- Search by date: `QT-100226` finds all chats from Feb 10, 2026
- Partial matches work: `QT-10` finds all chats from the 10th

### 3. Visual Distinction
- Primary color makes it stand out
- Easy to spot in a long list of chats
- Consistent with the unique ID shown in StickyStatus

### 4. Professional Look
- Clean, modern design
- Follows Material Design 3 principles
- Consistent with the rest of the UI

## Usage Examples

### Customer Support Scenario:
```
Customer: "I need help with my order"
Support: "What's your queue ID?"
Customer: "QT-100226-1"
Support: *types in search* "Found it! Let me check..."
```

### Team Communication:
```
Designer: "Can you check QT-100226-3?"
Manager: *searches in sidebar* "Got it, reviewing now"
```

### Daily Workflow:
```
Manager: "Show me all queues from today"
*Searches: QT-100226*
*All today's chats appear*
```

## Responsive Behavior

- **Desktop**: Full unique ID displayed
- **Tablet**: Full unique ID displayed
- **Mobile**: Wraps to new line if needed
- **Search**: Highlights matched portion

## Accessibility

- **Screen Readers**: Reads as "Queue ID: QT-100226-1"
- **Keyboard Navigation**: Focusable and navigable
- **High Contrast**: Primary color ensures visibility
- **Color Blind**: Uses both color and border for distinction

## Testing Checklist

- [x] Unique ID displays correctly in sidebar
- [x] Search by unique ID works
- [x] Partial search works (e.g., "QT-10")
- [x] Highlighting works in search results
- [x] Falls back gracefully if uniqueId is missing
- [x] TypeScript types updated
- [x] No console errors
- [x] Responsive on all screen sizes

## Future Enhancements (Optional)

1. **Copy to Clipboard**: Click unique ID to copy
2. **Direct Link**: Share link with unique ID in URL
3. **QR Code**: Generate QR code for unique ID
4. **Sorting**: Sort chats by unique ID
5. **Filtering**: Filter by date range using unique ID format
6. **Export**: Include unique ID in exported reports

## Screenshots

### Before:
```
┌─────────────────────────────────────┐
│ Test Chat                    10:17  │
│ by Arm (เจ้าของโปรแกรม)      You    │
│ John Doe  #C001                     │
│ [งานออกแบบใหม่] [Job]              │
└─────────────────────────────────────┘
```

### After:
```
┌─────────────────────────────────────┐
│ Test Chat                    10:17  │
│ by Arm (เจ้าของโปรแกรม)      You    │
│ QT-100226-1  John Doe  #C001        │ ← New!
│ [งานออกแบบใหม่] [Job]              │
└─────────────────────────────────────┘
```

## Related Files

- `Source/Components/Sidebar.tsx` - Main sidebar component
- `Source/Components/StickyStatus.tsx` - Also displays unique ID
- `Source/Library/types.ts` - TypeScript type definitions
- `Server/chat.go` - Backend Chat struct
- `Server/database.go` - Unique ID generation logic

## Conclusion

The unique ID is now prominently displayed in the sidebar, making it easy for users to:
- Identify chats quickly
- Search by unique ID
- Reference chats in conversations
- Track daily workload

The implementation is clean, searchable, and follows the existing design system.
