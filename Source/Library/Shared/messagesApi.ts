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
  replyTo?: {
    messageId: string;
    userName: string;
    content: string;
  };
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
    replyToId?: string;
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
   * Edit a message
   */
  async editMessage(identifier: string, messageId: string, messageData: {
    content?: string;
    attachments?: string[];
  }): Promise<{ success: boolean; message: MessageData }> {
    try {
      console.log('📝 Editing message:', messageId, 'in:', identifier);
      console.log('📝 Edit data:', messageData);
      
      const response = await authService.authenticatedFetch(`${this.baseUrl}/${identifier}/messages/${messageId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(messageData),
      });

      console.log('📡 Edit message response status:', response.status);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('❌ Edit message failed:', errorData);
        throw new Error(errorData.error || 'Failed to edit message');
      }

      const data = await response.json();
      console.log('✅ Message edited successfully:', data);

      return {
        success: true,
        message: data.message
      };
    } catch (error) {
      console.error('❌ Edit message error:', error);
      throw error;
    }
  }

  /**
   * Delete a message
   */
  async deleteMessage(identifier: string, messageId: string): Promise<{ success: boolean }> {
    try {
      console.log('🗑️ API: Deleting message:', messageId, 'in:', identifier);
      console.log('🔍 API: Request details:', {
        url: `${this.baseUrl}/${identifier}/messages/${messageId}`,
        method: 'DELETE',
        identifier,
        messageId
      });
      
      const response = await authService.authenticatedFetch(`${this.baseUrl}/${identifier}/messages/${messageId}`, {
        method: 'DELETE',
      });

      console.log('📡 API: Delete message response status:', response.status);
      console.log('📡 API: Response headers:', Object.fromEntries(response.headers.entries()));

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ API: Delete message failed - Response text:', errorText);
        
        let errorData;
        try {
          errorData = JSON.parse(errorText);
        } catch {
          errorData = { error: errorText };
        }
        
        console.error('❌ API: Delete message failed - Parsed error:', errorData);
        throw new Error(errorData.error || `HTTP ${response.status}: Failed to delete message`);
      }

      const responseText = await response.text();
      console.log('✅ API: Delete message success - Response text:', responseText);
      
      let responseData;
      try {
        responseData = responseText ? JSON.parse(responseText) : { success: true };
      } catch {
        responseData = { success: true }; // Assume success if no JSON response
      }
      
      console.log('✅ API: Message deleted successfully - Parsed response:', responseData);

      return { success: true };
    } catch (error) {
      console.error('❌ API: Delete message error:', error);
      console.error('❌ API: Error type:', typeof error);
      console.error('❌ API: Error details:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      });
      throw error;
    }
  }

  /**
   * Add or remove a reaction to a message
   */
  async addReaction(identifier: string, messageId: string, emoji: string): Promise<{ success: boolean; reactions: any[] }> {
    try {
      console.log('😀 Adding reaction:', emoji, 'to message:', messageId, 'in:', identifier);
      
      const response = await authService.authenticatedFetch(`${this.baseUrl}/${identifier}/messages/${messageId}/reactions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ emoji }),
      });

      console.log('📡 Add reaction response status:', response.status);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('❌ Add reaction failed:', errorData);
        throw new Error(errorData.error || 'Failed to add reaction');
      }

      const data = await response.json();
      console.log('✅ Reaction added successfully:', data);

      return {
        success: true,
        reactions: data.reactions || []
      };
    } catch (error) {
      console.error('❌ Add reaction error:', error);
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