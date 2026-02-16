import { apiClient } from '../Authentication/AuthContext';

/**
 * Assign a queue to the current user (graphic role only)
 * @param queueId - The ID of the queue to assign
 * @returns Promise with the assigned queue data
 */
export async function assignQueue(queueId: number): Promise<any> {
  try {
    const response = await apiClient.post(`/queue/${queueId}/assign`);
    return response.data;
  } catch (error: any) {
    console.error('Error assigning queue:', error);
    throw new Error(error.response?.data?.error || 'Failed to assign queue');
  }
}

/**
 * Assign the queue linked to a chat to the current user
 * @param chatUuid - The UUID of the chat
 * @returns Promise with the assigned queue data
 */
export async function assignQueueByChat(chatUuid: string): Promise<any> {
  try {
    const response = await apiClient.post(`/chats/${chatUuid}/assign-queue`);
    return response.data;
  } catch (error: any) {
    console.error('Error assigning queue by chat:', error);
    throw new Error(error.response?.data?.error || 'Failed to assign queue');
  }
}

/**
 * Get the queue linked to a chat
 * @param chatUuid - The UUID of the chat
 * @returns Promise with the queue data
 */
export async function getChatQueue(chatUuid: string): Promise<any> {
  try {
    const response = await apiClient.get(`/chats/${chatUuid}/queue`);
    return response.data;
  } catch (error: any) {
    console.error('Error getting chat queue:', error);
    throw new Error(error.response?.data?.error || 'Failed to get chat queue');
  }
}
