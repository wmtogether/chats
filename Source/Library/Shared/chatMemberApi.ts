// Chat Member API Client
import { getApiUrl } from '../utils/env';

const API_BASE_URL = getApiUrl();

export interface ChatMember {
  id: number;
  chatId: number;
  userId: number;
  userName: string;
  userRole: string;
  joinedAt: string;
}

export interface ChatMembersResponse {
  members: ChatMember[];
  memberCount: number;
  creator: {
    id: number;
    name: string;
  };
}

export interface ApiResponse<T = any> {
  success: boolean;
  message?: string;
  data?: T;
  error?: string;
}

/**
 * Join a chat
 */
export async function joinChat(chatId: number): Promise<void> {
  const token = localStorage.getItem('authToken');
  if (!token) {
    throw new Error('No authentication token found');
  }

  const response = await fetch(`${API_BASE_URL}/api/chats/${chatId}/join`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Failed to join chat: ${response.statusText}`);
  }

  const result: ApiResponse = await response.json();
  
  if (!result.success) {
    throw new Error(result.error || 'Failed to join chat');
  }
}

/**
 * Leave a chat
 */
export async function leaveChat(chatId: number): Promise<void> {
  const token = localStorage.getItem('authToken');
  if (!token) {
    throw new Error('No authentication token found');
  }

  const response = await fetch(`${API_BASE_URL}/api/chats/${chatId}/leave`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Failed to leave chat: ${response.statusText}`);
  }

  const result: ApiResponse = await response.json();
  
  if (!result.success) {
    throw new Error(result.error || 'Failed to leave chat');
  }
}

/**
 * Get all members of a chat
 */
export async function getChatMembers(chatId: number): Promise<ChatMembersResponse> {
  const token = localStorage.getItem('authToken');
  if (!token) {
    throw new Error('No authentication token found');
  }

  const response = await fetch(`${API_BASE_URL}/api/chats/${chatId}/members`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to get chat members: ${response.statusText}`);
  }

  const result: ApiResponse<ChatMembersResponse> = await response.json();
  
  if (!result.success || !result.data) {
    throw new Error(result.error || 'Failed to get chat members');
  }

  return result.data;
}

/**
 * Check if current user is a member of a chat
 */
export async function checkChatMembership(chatId: number): Promise<boolean> {
  const token = localStorage.getItem('authToken');
  if (!token) {
    throw new Error('No authentication token found');
  }

  const response = await fetch(`${API_BASE_URL}/api/chats/${chatId}/is-member`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to check membership: ${response.statusText}`);
  }

  const result: ApiResponse<{ isMember: boolean }> = await response.json();
  
  if (!result.success || !result.data) {
    throw new Error(result.error || 'Failed to check membership');
  }

  return result.data.isMember;
}

/**
 * Get all chats the current user has joined
 */
export async function getUserJoinedChats(): Promise<number[]> {
  const token = localStorage.getItem('authToken');
  if (!token) {
    throw new Error('No authentication token found');
  }

  const response = await fetch(`${API_BASE_URL}/api/users/me/joined-chats`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to get joined chats: ${response.statusText}`);
  }

  const result: ApiResponse<{ chatIds: number[]; count: number }> = await response.json();
  
  if (!result.success || !result.data) {
    throw new Error(result.error || 'Failed to get joined chats');
  }

  return result.data.chatIds;
}
