import { useEffect } from 'react';
import { useWebSocket } from '../Library/hooks/useWebSocket';
import { showNotification } from '../Library/services/notificationService';
import { useToast } from '../Library/hooks/useToast';

interface WebSocketProviderProps {
  children: React.ReactNode;
}

export default function WebSocketProvider({ children }: WebSocketProviderProps) {
  const { addToast } = useToast();

  const { isConnected, lastMessage } = useWebSocket({
    onConnect: () => {
      console.log('✅ WebSocket connected');
      addToast({ message: 'เชื่อมต่อสำเร็จ', type: 'success' });
    },
    onDisconnect: () => {
      console.log('🔌 WebSocket disconnected');
      addToast({ message: 'การเชื่อมต่อขาดหาย', type: 'warning' });
    },
    onError: (error) => {
      console.error('❌ WebSocket error:', error);
    },
    autoReconnect: true,
    reconnectInterval: 3000,
  });

  useEffect(() => {
    if (!lastMessage) return;

    const { type, data } = lastMessage;

    switch (type) {
      case 'new_message':
        handleNewMessage(data);
        break;
      case 'chat_created':
        handleChatCreated(data);
        break;
      case 'chat_updated':
        handleChatUpdated(data);
        break;
      case 'chat_deleted':
        handleChatDeleted(data);
        break;
      case 'design_created':
        handleDesignCreated(data);
        break;
      case 'proof_created':
        handleProofCreated(data);
        break;
      case 'queue_update':
        handleQueueUpdate(data);
        break;
      case 'upload_progress':
        handleUploadProgress(data);
        break;
      default:
        console.log('📨 Unhandled WebSocket message type:', type);
    }
  }, [lastMessage]);

  const handleNewMessage = async (data: any) => {
    console.log('💬 New message received:', data);

    if (data.notification) {
      // Show desktop/web notification
      await showNotification({
        title: `ข้อความใหม่จาก ${data.sender}`,
        message: data.message?.content || 'คุณมีข้อความใหม่',
        chatUuid: data.chatUuid,
      });
    }

    // Trigger custom event for chat components to update
    window.dispatchEvent(
      new CustomEvent('new-message', {
        detail: data,
      })
    );
  };

  const handleChatCreated = (data: any) => {
    console.log('💬 Chat created:', data);
    addToast({ message: `สร้างแชท "${data.chat?.channelName}" สำเร็จ`, type: 'success' });

    window.dispatchEvent(
      new CustomEvent('chat-created', {
        detail: data,
      })
    );
  };

  const handleChatUpdated = (data: any) => {
    console.log('💬 Chat updated:', data);

    window.dispatchEvent(
      new CustomEvent('chat-updated', {
        detail: data,
      })
    );
  };

  const handleChatDeleted = (data: any) => {
    console.log('💬 Chat deleted:', data);
    addToast({ message: `ลบแชท "${data.chatName}" แล้ว`, type: 'info' });

    window.dispatchEvent(
      new CustomEvent('chat-deleted', {
        detail: data,
      })
    );
  };

  const handleDesignCreated = (data: any) => {
    console.log('🎨 Design created:', data);
    addToast({ message: 'สร้างงานออกแบบสำเร็จ', type: 'success' });

    window.dispatchEvent(
      new CustomEvent('design-created', {
        detail: data,
      })
    );
  };

  const handleProofCreated = (data: any) => {
    console.log('📄 Proof created:', data);
    addToast({ message: 'สร้างงานพรูฟสำเร็จ', type: 'success' });

    window.dispatchEvent(
      new CustomEvent('proof-created', {
        detail: data,
      })
    );
  };

  const handleQueueUpdate = (data: any) => {
    console.log('📋 Queue updated:', data);

    window.dispatchEvent(
      new CustomEvent('queue-updated', {
        detail: data,
      })
    );
  };

  const handleUploadProgress = (data: any) => {
    console.log('📤 Upload progress:', data);

    window.dispatchEvent(
      new CustomEvent('upload-progress', {
        detail: data,
      })
    );
  };

  return <>{children}</>;
}
