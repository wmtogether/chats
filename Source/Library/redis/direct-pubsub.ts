import { directPublisher, directSubscriber } from './direct-client';

export type PubSubChannel =
  | 'chat:message'
  | 'chat:reaction'
  | 'chat:edit'
  | 'chat:delete'
  | 'chat:typing'
  | 'thread:new'
  | 'thread:update'
  | 'thread:delete'
  | 'notification'
  | 'workspace:update'
  | 'user:status'
  | 'test:ping';

export interface PubSubMessage<T = any> {
  channel: PubSubChannel;
  event: string;
  data: T;
  timestamp: number;
  userId?: string;
}

// Publish a message to a channel using direct Redis
export async function publishDirect<T = any>(
  channel: PubSubChannel,
  event: string,
  data: T,
  userId?: string
): Promise<void> {
  const message: PubSubMessage<T> = {
    channel,
    event,
    data,
    timestamp: Date.now(),
    userId,
  };

  try {
    await directPublisher.publish(channel, JSON.stringify(message));
    console.log(`📡 Published directly to Redis ${channel}:${event}`, data);
  } catch (error) {
    console.error(`Failed to publish directly to Redis ${channel}:`, error);
    throw error;
  }
}

// Subscribe to a channel with a callback using direct Redis
export async function subscribeDirect(
  channel: PubSubChannel,
  callback: (message: PubSubMessage) => void
): Promise<void> {
  try {
    await directSubscriber.subscribe(channel, (messageStr) => {
      try {
        const message = JSON.parse(messageStr) as PubSubMessage;
        console.log(`📨 Received directly from Redis ${channel}:${message.event}`, message.data);
        callback(message);
      } catch (error) {
        console.error('Failed to parse direct Redis message:', error);
      }
    });
    console.log(`🔔 Subscribed directly to Redis channel: ${channel}`);
  } catch (error) {
    console.error(`Failed to subscribe directly to Redis ${channel}:`, error);
    throw error;
  }
}

// Unsubscribe from a channel using direct Redis
export async function unsubscribeDirect(channel: PubSubChannel): Promise<void> {
  try {
    await directSubscriber.unsubscribe(channel);
    console.log(`🔕 Unsubscribed directly from Redis channel: ${channel}`);
  } catch (error) {
    console.error(`Failed to unsubscribe directly from Redis ${channel}:`, error);
    throw error;
  }
}

// Helper functions for specific events using direct Redis
export const directChatEvents = {
  newMessage: (channelId: string, message: any, userId?: string) =>
    publishDirect('chat:message', 'new', { channelId, message }, userId),
  
  messageEdited: (channelId: string, messageId: string, content: string, editedAt: string, attachments?: string[], userId?: string) =>
    publishDirect('chat:edit', 'edited', { channelId, messageId, content, editedAt, attachments }, userId),
  
  messageDeleted: (channelId: string, messageId: string, userId?: string) =>
    publishDirect('chat:delete', 'deleted', { channelId, messageId }, userId),
  
  messageReaction: (channelId: string, messageId: string, reactions: any[], userId?: string) =>
    publishDirect('chat:reaction', 'reaction', { channelId, messageId, reactions }, userId),
  
  userTyping: (channelId: string, user: { userId: string; userName: string; profilePicture?: string | null }) =>
    publishDirect('chat:typing', 'typing', { channelId, user }),
};

export const directThreadEvents = {
  created: (chat: any, userId?: string) =>
    publishDirect('thread:new', 'created', { chat }, userId),
  updated: (chat: any, userId?: string) =>
    publishDirect('thread:update', 'updated', { chat }, userId),
  deleted: (chatId: string, userId?: string) =>
    publishDirect('thread:delete', 'deleted', { chatId }, userId),
};

export const directNotificationEvents = {
  send: (userId: string, notification: any) =>
    publishDirect('notification', 'send', { userId, notification }),
};

export const directWorkspaceEvents = {
  updated: (workspaceId: string, data: any, userId?: string) =>
    publishDirect('workspace:update', 'updated', { workspaceId, ...data }, userId),
};

export const directUserEvents = {
  statusChanged: (userId: string, status: 'online' | 'away' | 'busy' | 'offline') =>
    publishDirect('user:status', 'changed', { userId, status }),
};