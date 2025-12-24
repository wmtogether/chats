// Messages API Service for UUID and Channel mapping
import authService from '../Authentication/jwt';

export interface MessageData {
  id: number;
  messageId: string;
  channelId: string;
  content: string;
  userId: number;
  userName: string;
  userRole: string;
  profilePicture?: string;
  attachments?: any[];
  tags?: string[];
  status?: string;
  reactions?: any[];
  editedAt?: string;
  createdAt: string;
}

export interface MessagesResponse {
  success: boolean;
  messages: MessageData[];
}

class MessagesApiService {
  private baseUrl = '/api/threads';

  /**
   * Get messages using UUID or channelId
   * The API supports both UUID and legacy channelId mapping:
   * - If UUID is provided, it looks up the channelId from the chats table
   * - If channelId is provided directly, it uses it as-is
   */
  async getMessages(identifier: string, options?: {
    limit?: number;
  }): Promise<MessagesResponse> {
    try {
      const queryParams = new URLSearchParams();
      
      if (options?.limit) {
        queryParams.append('limit', options.limit.toString());
      }

      const url = `${this.baseUrl}/${identifier}/messages${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
      
      console.log('🔄 Fetching messages from:', url);
      console.log('📋 Message identifier:', {
        identifier,
        isUuid: this.isUuid(identifier),
        type: this.isUuid(identifier) ? 'UUID' : 'Channel ID'
      });
      
      const response = await authService.authenticatedFetch(url, {
        method: 'GET',
      });

      console.log('📡 Messages API response status:', response.status);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('❌ Messages API error:', errorData);
        throw new Error(errorData.error || `HTTP ${response.status}: Failed to fetch messages`);
      }

      const data = await response.json();
      console.log('📊 Raw messages data:', data);
      
      const result = {
        success: true,
        messages: data.messages || []
      };
      
      console.log('✅ Processed messages result:', {
        messageCount: result.messages.length,
        identifier,
        firstMessage: result.messages[0] ? {
          id: result.messages[0].messageId,
          content: result.messages[0].content?.substring(0, 50) + '...',
          user: result.messages[0].userName
        } : 'No messages'
      });
      
      return result;
    } catch (error) {
      console.error('❌ Error fetching messages:', error);
      throw error;
    }
  }

  /**
   * Get messages by UUID specifically
   * This method explicitly uses the UUID to fetch messages
   */
  async getMessagesByUuid(uuid: string, options?: {
    limit?: number;
  }): Promise<MessagesResponse> {
    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(uuid)) {
      throw new Error('Invalid UUID format');
    }

    return this.getMessages(uuid, options);
  }

  /**
   * Get messages by channel ID specifically
   * This method explicitly uses the channelId to fetch messages
   */
  async getMessagesByChannel(channelId: string, options?: {
    limit?: number;
  }): Promise<MessagesResponse> {
    return this.getMessages(channelId, options);
  }

  /**
   * Send a message to a channel using UUID or channelId
   */
  async sendMessage(identifier: string, messageData: {
    content?: string;
    attachments?: any[];
    tags?: string[];
  }): Promise<{ success: boolean; message: MessageData }> {
    try {
      console.log('📤 Sending message to:', identifier);
      console.log('📝 Message data:', messageData);
      
      const response = await authService.authenticatedFetch(`${this.baseUrl}/${identifier}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(messageData),
      });

      console.log('📡 Send message response status:', response.status);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('❌ Send message error:', errorData);
        throw new Error(errorData.error || `HTTP ${response.status}: Failed to send message`);
      }

      const data = await response.json();
      console.log('✅ Message sent successfully:', data);
      
      return {
        success: true,
        message: data.message
      };
    } catch (error) {
      console.error('❌ Error sending message:', error);
      throw error;
    }
  }

  /**
   * Helper method to determine if an identifier is a UUID or channelId
   */
  isUuid(identifier: string): boolean {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return uuidRegex.test(identifier);
  }

  /**
   * Map thread data to get the appropriate identifier for messages
   * This helps when you have a Thread object and need to fetch its messages
   */
  getMessageIdentifier(thread: { uuid?: string; channelId?: string; id?: number }): string {
    // Prefer UUID if available, fallback to channelId, then to id
    const identifier = thread.uuid || thread.channelId || thread.id?.toString() || '';
    
    console.log('🔍 Getting message identifier:', {
      threadData: {
        uuid: thread.uuid,
        channelId: thread.channelId,
        id: thread.id
      },
      selectedIdentifier: identifier,
      identifierType: thread.uuid ? 'UUID' : thread.channelId ? 'Channel ID' : thread.id ? 'Thread ID' : 'None'
    });
    
    return identifier;
  }
}

// Export singleton instance
export const messagesApiService = new MessagesApiService();
export default messagesApiService;