# WebSocket Notifications Implementation

## Overview
Implemented real-time WebSocket notifications with authentication and Windows desktop notifications via IPC.

## Backend (Go)

### 1. WebSocket Server (`Server/websocket.go`)
- **Authentication**: Token-based auth via query parameter or context
- **Hub Pattern**: Manages connected clients and broadcasts messages
- **Message Types**: 
  - `new_message` - New chat messages with notification flag
  - `chat_created`, `chat_updated`, `chat_deleted`
  - `design_created`, `proof_created`
  - `queue_update`, `upload_progress`
  - `ping`/`pong` for keep-alive

### 2. Message Handler (`Server/handlers_message.go`)
- Updated `sendMessageHandler` to broadcast with notification flag
- Includes sender info for notification display

```go
wsHub.BroadcastMessage("new_message", map[string]interface{}{
    "chatUuid":     chatUUID,
    "message":      message,
    "notification": true,
    "sender":       user.Name,
    "senderRole":   user.Role,
})
```

## Desktop App (Rust)

### 1. Notification Module (`Desktop/src/hooks/noti.rs`)
- Windows Toast Notifications using Windows API
- XML-based notification templates
- IPC handler for WebView communication

### 2. Cargo Dependencies (`Desktop/Cargo.toml`)
Added Windows notification features:
```toml
"UI_Notifications",
"Data_Xml_Dom",
```

### 3. IPC Handler (`Desktop/src/main_win.rs`)
Added `show_notification` IPC message type:
```rust
"show_notification" => {
    // Parse and show Windows toast notification
    hooks::show_notification(noti_data)
}
```

## Frontend (React/TypeScript)

### 1. WebSocket Hook (`Source/Library/hooks/useWebSocket.ts`)
- Auto-reconnect with configurable interval
- Token-based authentication
- Message parsing and event handling
- Keep-alive ping/pong

### 2. Notification Service (`Source/Library/services/notificationService.ts`)
- **Desktop Notifications**: Via IPC to Rust backend
- **Web Notifications**: Browser Notification API
- Auto-detection of environment (desktop vs web)
- Permission handling

### 3. WebSocket Provider (`Source/Components/WebSocketProvider.tsx`)
- Global WebSocket connection management
- Message routing to appropriate handlers
- Custom events for component updates
- Toast notifications for user feedback

## Usage

### Backend Setup
```go
// Initialize WebSocket hub
InitWebSocket()

// Broadcast message
wsHub.BroadcastMessage("new_message", data)
```

### Frontend Setup
```tsx
// Wrap app with WebSocketProvider
<WebSocketProvider>
  <App />
</WebSocketProvider>

// Show notification
import { showNotification } from '../Library/services/notificationService';

await showNotification({
  title: 'New Message',
  message: 'You have a new message',
  chatUuid: 'chat-uuid-here',
});
```

### Desktop IPC
```javascript
// From WebView JavaScript
window.ipc.postMessage(JSON.stringify({
  type: 'show_notification',
  title: 'New Message',
  message: 'You have a new message',
  chat_uuid: 'chat-uuid-here',
}));
```

## Features

### Authentication
- Token-based WebSocket authentication
- Supports both query parameter and context-based auth
- Automatic reconnection with token refresh

### Notifications
- **Desktop**: Windows Toast Notifications
- **Web**: Browser Notification API
- **Auto-detection**: Chooses appropriate method
- **Rich content**: Title, message, icon, chat link

### Real-time Updates
- Chat messages
- Chat CRUD operations
- Design/Proof creation
- Queue updates
- Upload progress

### Connection Management
- Auto-reconnect on disconnect
- Configurable reconnect interval
- Keep-alive ping/pong
- Connection status tracking

## Message Flow

```
User A sends message
    ↓
Go Backend (handlers_message.go)
    ↓
WebSocket Hub broadcasts
    ↓
All connected clients receive
    ↓
Frontend WebSocketProvider
    ↓
Notification Service
    ↓
Desktop: IPC → Rust → Windows Toast
Web: Browser Notification API
```

## Testing

### Test WebSocket Connection
```javascript
// In browser console
const ws = new WebSocket('ws://localhost:3000/ws?token=YOUR_TOKEN');
ws.onmessage = (e) => console.log('Message:', JSON.parse(e.data));
```

### Test Desktop Notification
```javascript
// In desktop app WebView console
window.ipc.postMessage(JSON.stringify({
  type: 'show_notification',
  title: 'Test',
  message: 'This is a test notification',
}));
```

## Configuration

### WebSocket URL
Auto-detected based on current location:
- Development: `ws://localhost:3000/ws`
- Production: `wss://your-domain.com/ws`

### Reconnect Settings
```typescript
useWebSocket({
  autoReconnect: true,
  reconnectInterval: 3000, // 3 seconds
});
```

### Notification Permissions
```typescript
import { requestNotificationPermission } from '../Library/services/notificationService';

const granted = await requestNotificationPermission();
```

## Security

- Token-based authentication for WebSocket connections
- Origin validation in WebSocket upgrader
- IPC message validation in Rust
- XSS protection via XML escaping in notifications

## Browser Compatibility

- **WebSocket**: All modern browsers
- **Notifications**: Chrome, Firefox, Edge, Safari
- **Desktop**: Windows 10/11 with WRY/WebView2

## Future Enhancements

- [ ] macOS notification support
- [ ] Linux notification support
- [ ] Notification action buttons
- [ ] Notification sound customization
- [ ] Notification grouping
- [ ] Do Not Disturb mode
- [ ] Notification history
