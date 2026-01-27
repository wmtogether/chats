// Threads API Service
import ipcService from './ipcService';

export interface ThreadMetadata {
  queueId?: number;
  queueStatus?: string;
  requestType?: string;
  createdByName?: string;
  archived?: boolean;
}

export interface Thread {
  id: number;
  uuid: string;
  channelId: string;
  channelName: string;
  channelType: string;
  chatCategory: string;
  description: string | null;
  jobId: number | null;
  queueId: number | null;
  customerId: number | null;
  customers: any | null;
  metadata: ThreadMetadata | null;
  isArchived: number;
  createdById: number;
  createdByName: string;
  createdAt: string;
  updatedAt: string;
}

export interface ThreadsResponse {
  success: boolean;
  threads: Thread[];
  total: number;
  page: number;
  limit: number;
}

class ThreadsApiService {
  private baseUrl = '/api/threads';

  async getThreads(params?: {
    page?: number;
    limit?: number;
    search?: string;
    status?: string;
    requestType?: string;
    createdBy?: string;
  }): Promise<ThreadsResponse> {
    try {
      const queryParams = new URLSearchParams();
      
      if (params?.page) queryParams.append('page', params.page.toString());
      if (params?.limit) queryParams.append('limit', params.limit.toString());
      if (params?.search) queryParams.append('search', params.search);
      if (params?.status) queryParams.append('status', params.status);
      if (params?.requestType) queryParams.append('requestType', params.requestType);
      if (params?.createdBy) queryParams.append('createdBy', params.createdBy);

      const url = `${this.baseUrl}${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
      
      console.log('🔄 Fetching threads via IPC:', url);
      
      const response = await ipcService.get(url);

      console.log('📡 Threads API response:', response);
      
      // Transform the response to match our expected format
      const result = {
        success: true,
        threads: response.chats || response.threads || response.data || [],
        total: response.total || (response.chats || response.threads || response.data)?.length || 0,
        page: response.page || 1,
        limit: response.limit || 50
      };
      
      console.log('✅ Processed threads result:', {
        threadCount: result.threads.length,
        total: result.total,
        page: result.page,
        limit: result.limit
      });
      
      return result;
    } catch (error) {
      console.error('❌ Error fetching threads:', error);
      throw error;
    }
  }

  async getThread(id: number): Promise<Thread> {
    try {
      const response = await ipcService.get(`${this.baseUrl}/${id}`);
      return response.thread || response.data || response;
    } catch (error) {
      console.error('❌ Error fetching thread:', error);
      throw error;
    }
  }

  async updateThread(id: number, updates: Partial<Thread>): Promise<{ success: boolean; thread?: Thread }> {
    try {
      console.log('✏️ Updating thread via IPC:', id, 'with:', updates);
      
      const response = await ipcService.patch(`${this.baseUrl}/${id}`, updates);

      console.log('✅ Thread updated successfully:', response);

      return {
        success: true,
        thread: response.thread || response.data || response
      };
    } catch (error) {
      console.error('❌ Update thread error:', error);
      throw error;
    }
  }

  async deleteThread(id: number): Promise<{ success: boolean }> {
    try {
      console.log('🗑️ Deleting thread via IPC:', id);
      
      const response = await ipcService.delete(`${this.baseUrl}/${id}`);

      console.log('✅ Thread deleted successfully');

      return { success: true };
    } catch (error) {
      console.error('❌ Delete thread error:', error);
      throw error;
    }
  }

  // Helper method to filter threads with valid metadata (like the mockup filter)
  filterValidThreads(threads: Thread[]): Thread[] {
    return threads.filter(thread => thread.metadata !== null);
  }

  // Helper method to group threads by creator
  groupThreadsByCreator(threads: Thread[]): Record<string, Thread[]> {
    return threads.reduce((groups: Record<string, Thread[]>, thread) => {
      const creatorName = thread.metadata?.createdByName || thread.createdByName;
      if (!groups[creatorName]) {
        groups[creatorName] = [];
      }
      groups[creatorName].push(thread);
      return groups;
    }, {});
  }
}

// Export singleton instance
export const threadsApiService = new ThreadsApiService();
export default threadsApiService;