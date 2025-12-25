import { publisher, subscriber } from './client';

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
  | 'test:ping'; // For testing

export interface PubSubMessage<T = any> {
  channel: PubSubChannel;
  event: string;
  data: T;
  timestamp: number;
  userId?: string;
}

// Publish a message to a channel
export async function publish<T = any>(
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
    await publisher.publish(channel, JSON.stringify(message));
    console.log(`📡 Published to ${channel}:${event}`, data);
  } catch (error) {
    console.error(`Failed to publish to ${channel}:`, error);
    throw error;
  }
}

// Subscribe to a channel with a callback
export async function subscribe(
  channel: PubSubChannel,
  callback: (message: PubSubMessage) => void
): Promise<void> {
  try {
    await subscriber.subscribe(channel, (messageStr) => {
      try {
        const message = JSON.parse(messageStr) as PubSubMessage;
        console.log(`📨 Received from ${channel}:${message.event}`, message.data);
        callback(message);
      } catch (error) {
        console.error('Failed to parse message:', error);
      }
    });
    console.log(`🔔 Subscribed to ${channel}`);
  } catch (error) {
    console.error(`Failed to subscribe to ${channel}:`, error);
    throw error;
  }
}

// Unsubscribe from a channel
export async function unsubscribe(channel: PubSubChannel): Promise<void> {
  try {
    await subscriber.unsubscribe(channel);
    console.log(`🔕 Unsubscribed from ${channel}`);
  } catch (error) {
    console.error(`Failed to unsubscribe from ${channel}:`, error);
    throw error;
  }
}

// Helper functions for specific events
export const chatEvents = {
  newMessage: (channelId: string, message: any, userId?: string) =>
    publish('chat:message', 'new', { channelId, message }, userId),
  
  messageEdited: (channelId: string, messageId: string, content: string, editedAt: string, attachments?: string[], userId?: string) =>
    publish('chat:edit', 'edited', { channelId, messageId, content, editedAt, attachments }, userId),
  
  messageDeleted: (channelId: string, messageId: string, userId?: string) =>
    publish('chat:delete', 'deleted', { channelId, messageId }, userId),
  
  messageReaction: (channelId: string, messageId: string, reactions: any[], userId?: string) =>
    publish('chat:reaction', 'reaction', { channelId, messageId, reactions }, userId),
  
  userTyping: (channelId: string, user: { userId: string; userName: string; profilePicture?: string | null }) =>
    publish('chat:typing', 'typing', { channelId, user }),
};

export const threadEvents = {
  created: (chat: any, userId?: string) =>
    publish('thread:new', 'created', { chat }, userId),
  updated: (chat: any, userId?: string) =>
    publish('thread:update', 'updated', { chat }, userId),
  deleted: (chatId: string, userId?: string) =>
    publish('thread:delete', 'deleted', { chatId }, userId),
};

export const notificationEvents = {
  send: (userId: string, notification: any) =>
    publish('notification', 'send', { userId, notification }),
};

export const workspaceEvents = {
  updated: (workspaceId: string, data: any, userId?: string) =>
    publish('workspace:update', 'updated', { workspaceId, ...data }, userId),
};

export const userEvents = {
  statusChanged: (userId: string, status: 'online' | 'away' | 'busy' | 'offline') =>
    publish('user:status', 'changed', { userId, status }),
};