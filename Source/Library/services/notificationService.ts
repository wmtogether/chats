// Notification service for desktop and web notifications

export interface NotificationData {
  title: string;
  message: string;
  icon?: string;
  chatUuid?: string;
}

// Check if running in desktop app (WRY webview)
export function isDesktopApp(): boolean {
  return typeof (window as any).ipc !== 'undefined';
}

// Show desktop notification via IPC
export function showDesktopNotification(data: NotificationData): void {
  if (isDesktopApp()) {
    try {
      (window as any).ipc.postMessage(
        JSON.stringify({
          type: 'show_notification',
          title: data.title,
          message: data.message,
          icon: data.icon,
          chat_uuid: data.chatUuid,
        })
      );
      console.log('📢 Desktop notification sent via IPC:', data.title);
    } catch (error) {
      console.error('❌ Failed to send desktop notification:', error);
    }
  } else {
    console.warn('⚠️ Not running in desktop app, cannot show desktop notification');
  }
}

// Show web notification (browser API)
export async function showWebNotification(data: NotificationData): Promise<void> {
  if (!('Notification' in window)) {
    console.warn('⚠️ Browser does not support notifications');
    return;
  }

  // Request permission if not granted
  if (Notification.permission === 'default') {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      console.warn('⚠️ Notification permission denied');
      return;
    }
  }

  if (Notification.permission === 'granted') {
    try {
      const notification = new Notification(data.title, {
        body: data.message,
        icon: data.icon || '/icon.png',
        tag: data.chatUuid || 'default',
        requireInteraction: false,
      });

      notification.onclick = () => {
        window.focus();
        notification.close();
        
        // Navigate to chat if chatUuid is provided
        if (data.chatUuid) {
          // You can add navigation logic here
          console.log('📍 Navigate to chat:', data.chatUuid);
        }
      };

      console.log('📢 Web notification shown:', data.title);
    } catch (error) {
      console.error('❌ Failed to show web notification:', error);
    }
  }
}

// Show notification (desktop or web based on environment)
export async function showNotification(data: NotificationData): Promise<void> {
  if (isDesktopApp()) {
    showDesktopNotification(data);
  } else {
    await showWebNotification(data);
  }
}

// Request notification permission (for web)
export async function requestNotificationPermission(): Promise<boolean> {
  if (!('Notification' in window)) {
    return false;
  }

  if (Notification.permission === 'granted') {
    return true;
  }

  if (Notification.permission !== 'denied') {
    const permission = await Notification.requestPermission();
    return permission === 'granted';
  }

  return false;
}
