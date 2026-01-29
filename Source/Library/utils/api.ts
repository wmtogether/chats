// Source/Library/utils/api.ts
import type { ChatType, ChatMetadata, NullString, NullInt64, MessageType } from '../types';
import { getApiUrl } from './env';

const API_BASE_URL = getApiUrl();
/**
 * Safely extracts the string value from a NullString type.
 * Returns an empty string if the NullString is invalid.
 */
export function getNullStringValue(ns: NullString | undefined): string {
  if (ns && ns.Valid) {
    return ns.String;
  }
  return '';
}

/**
 * Safely extracts the number value from a NullInt64 type.
 * Returns 0 if the NullInt64 is invalid.
 */
export function getNullInt64Value(ni: NullInt64 | undefined): number {
  if (ni && ni.Valid) {
    return ni.Int64;
  }
  return 0;
}

/**
 * Parses the metadata JSON string from a ChatType object.
 * Returns the parsed ChatMetadata object, or undefined if parsing fails.
 */
export function parseChatMetadata(chat: ChatType): ChatMetadata | undefined {
  if (!chat.metadata) {
    return undefined;
  }
  try {
    // The metadata string appears to be raw JSON, not base64 encoded.
    // If it were base64, we would use JSON.parse(atob(chat.metadata)).
    // Based on the provided example: "metadata":"eyJxdWV1ZUlkIjogMzk3LCA..." it IS base64 encoded.
    const decodedMetadata = atob(chat.metadata);
    const parsed = JSON.parse(decodedMetadata);
    return parsed as ChatMetadata;
  } catch (e) {
    console.error('Error parsing chat metadata:', e);
    return undefined;
  }
}

/**
 * Pre-processes a chat object to parse its metadata.
 */
export function preprocessChat(chat: ChatType): ChatType {
    const processedChat = { ...chat };
    processedChat.parsedMetadata = parseChatMetadata(chat);
    return processedChat;
}

/**
 * Deletes a chat by UUID.
 * Returns a promise that resolves to the API response.
 */
export async function deleteChat(chatUuid: string): Promise<{
  success: boolean;
  message?: string;
  error?: string;
  data?: any;
}> {
  try {
    const token = localStorage.getItem('authToken');
    if (!token) {
      throw new Error('No authentication token found');
    }

    console.log('Deleting chat with UUID:', chatUuid);
    console.log('Using URL:', `/api/chats/${chatUuid}`);

    const response = await fetch(`${API_BASE_URL}/api/chats/${chatUuid}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    console.log('Delete response status:', response.status);
    console.log('Delete response headers:', response.headers);

    // Handle non-JSON responses (like 405 Method Not Allowed)
    let result;
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      result = await response.json();
    } else {
      // For non-JSON responses, create a generic error object
      const text = await response.text();
      result = {
        success: false,
        error: text || `HTTP ${response.status}: ${response.statusText}`
      };
    }

    if (!response.ok) {
      // Handle specific error cases
      if (response.status === 405) {
        throw new Error('Delete operation not supported. The server may not have the DELETE endpoint configured.');
      } else if (response.status === 403) {
        throw new Error(result.error || 'You don\'t have permission to delete this chat. Only the creator or administrators can delete chats.');
      } else if (response.status === 404) {
        throw new Error('Chat not found. It may have already been deleted.');
      } else if (response.status === 401) {
        throw new Error('Authentication required. Please log in again.');
      } else {
        throw new Error(result.error || `HTTP error! status: ${response.status}`);
      }
    }

    return result;
  } catch (error) {
    console.error('Error deleting chat:', error);
    throw error;
  }
}
/**
 * Creates a new chat.
 * Returns a promise that resolves to the API response.
 */
export async function createChat(chatData: {
  name: string;
  requestType: string;
  customerId?: string;
  customerName?: string;
  description?: string;
}): Promise<{
  success: boolean;
  message?: string;
  error?: string;
  data?: ChatType;
}> {
  try {
    const token = localStorage.getItem('authToken');
    if (!token) {
      throw new Error('No authentication token found');
    }

    const response = await fetch(`${API_BASE_URL}/api/chats`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(chatData),
    });

    const result = await response.json();

    if (!response.ok) {
      // Handle specific error cases
      if (response.status === 400) {
        throw new Error(result.error || 'Invalid chat data provided.');
      } else if (response.status === 401) {
        throw new Error('Authentication required. Please log in again.');
      } else if (response.status === 403) {
        throw new Error('You don\'t have permission to create chats.');
      } else {
        throw new Error(result.error || `HTTP error! status: ${response.status}`);
      }
    }

    return result;
  } catch (error) {
    console.error('Error creating chat:', error);
    throw error;
  }
}

/**
 * Sends a message to a chat.
 * Returns a promise that resolves to the API response.
 */
export async function sendMessage(chatUuid: string, messageData: {
  content: string;
  attachments?: string[];
  replyTo?: {
    messageId: string;
    userName: string;
    content: string;
  };
}): Promise<{
  success: boolean;
  message?: string;
  error?: string;
  data?: MessageType;
}> {
  try {
    const token = localStorage.getItem('authToken');
    if (!token) {
      throw new Error('No authentication token found');
    }

    const response = await fetch(`${API_BASE_URL}/api/chats/${chatUuid}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(messageData),
    });

    const result = await response.json();

    if (!response.ok) {
      // Handle specific error cases
      if (response.status === 400) {
        throw new Error(result.error || 'Invalid message data provided.');
      } else if (response.status === 401) {
        throw new Error('Authentication required. Please log in again.');
      } else if (response.status === 403) {
        throw new Error('You don\'t have permission to send messages to this chat.');
      } else if (response.status === 404) {
        throw new Error('Chat not found.');
      } else {
        throw new Error(result.error || `HTTP error! status: ${response.status}`);
      }
    }

    return result;
  } catch (error) {
    console.error('Error sending message:', error);
    throw error;
  }
}

/**
 * Deletes a message by its ID.
 * Returns a promise that resolves to the API response.
 */
export async function deleteMessage(messageId: string): Promise<{
  success: boolean;
  message?: string;
  error?: string;
}> {
  try {
    const token = localStorage.getItem('authToken');
    if (!token) {
      throw new Error('No authentication token found');
    }

    const response = await fetch(`${API_BASE_URL}/api/messages/${messageId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    const result = await response.json();

    if (!response.ok) {
      // Handle specific error cases
      if (response.status === 403) {
        throw new Error(result.error || 'You don\'t have permission to delete this message.');
      } else if (response.status === 404) {
        throw new Error('Message not found. It may have already been deleted.');
      } else if (response.status === 401) {
        throw new Error('Authentication required. Please log in again.');
      } else {
        throw new Error(result.error || `HTTP error! status: ${response.status}`);
      }
    }

    return result;
  } catch (error) {
    console.error('Error deleting message:', error);
    throw error;
  }
}

/**
 * Edits a message by its ID.
 * Returns a promise that resolves to the API response.
 */
export async function editMessage(messageId: string, messageData: {
  content: string;
  attachments?: string[];
}): Promise<{
  success: boolean;
  message?: string;
  error?: string;
  data?: MessageType;
}> {
  try {
    const token = localStorage.getItem('authToken');
    if (!token) {
      throw new Error('No authentication token found');
    }

    const response = await fetch(`${API_BASE_URL}/api/messages/${messageId}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(messageData),
    });

    const result = await response.json();

    if (!response.ok) {
      // Handle specific error cases
      if (response.status === 400) {
        throw new Error(result.error || 'Invalid message data provided.');
      } else if (response.status === 403) {
        throw new Error(result.error || 'You can only edit your own messages.');
      } else if (response.status === 404) {
        throw new Error('Message not found.');
      } else if (response.status === 401) {
        throw new Error('Authentication required. Please log in again.');
      } else {
        throw new Error(result.error || `HTTP error! status: ${response.status}`);
      }
    }

    return result;
  } catch (error) {
    console.error('Error editing message:', error);
    throw error;
  }
}

/**
 * Updates a chat's request type.
 * Returns a promise that resolves to the API response.
 */
export async function updateChatRequestType(chatUuid: string, requestType: string): Promise<{
  success: boolean;
  message?: string;
  error?: string;
  data?: ChatType;
}> {
  try {
    const token = localStorage.getItem('authToken');
    if (!token) {
      throw new Error('No authentication token found');
    }

    const response = await fetch(`${API_BASE_URL}/api/chats/${chatUuid}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ requestType }),
    });

    const result = await response.json();

    if (!response.ok) {
      // Handle specific error cases
      if (response.status === 400) {
        throw new Error(result.error || 'Invalid request type provided.');
      } else if (response.status === 401) {
        throw new Error('Authentication required. Please log in again.');
      } else if (response.status === 403) {
        throw new Error(result.error || 'You don\'t have permission to update this chat. Only the creator or administrators can update chats.');
      } else if (response.status === 404) {
        throw new Error('Chat not found.');
      } else {
        throw new Error(result.error || `HTTP error! status: ${response.status}`);
      }
    }

    return result;
  } catch (error) {
    console.error('Error updating chat request type:', error);
    throw error;
  }
}

/**
 * Adds a reaction to a message.
 * Returns a promise that resolves to the API response.
 */
export async function addReaction(messageId: string, emoji: string): Promise<{
  success: boolean;
  message?: string;
  error?: string;
}> {
  try {
    const token = localStorage.getItem('authToken');
    if (!token) {
      throw new Error('No authentication token found');
    }

    const response = await fetch(`${API_BASE_URL}/api/messages/${messageId}/reactions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ emoji }),
    });

    const result = await response.json();

    if (!response.ok) {
      // Handle specific error cases
      if (response.status === 400) {
        throw new Error(result.error || 'Invalid reaction data provided.');
      } else if (response.status === 404) {
        throw new Error('Message not found.');
      } else if (response.status === 401) {
        throw new Error('Authentication required. Please log in again.');
      } else {
        throw new Error(result.error || `HTTP error! status: ${response.status}`);
      }
    }

    return result;
  } catch (error) {
    console.error('Error adding reaction:', error);
    throw error;
  }
}