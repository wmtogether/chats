// Threads API Service
import authService from '../Authentication/jwt';

export interface ThreadMetadata {
  queueId: number;
  queueStatus: string;
  requestType: string;
  createdByName: string;
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
      
      console.log('🔄 Fetching threads from:', url);
      
      const response = await authService.authenticatedFetch(url, {
        method: 'GET',
      });

      console.log('📡 Threads API response status:', response.status);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('❌ Threads API error:', errorData);
        throw new Error(errorData.error || `HTTP ${response.status}: Failed to fetch threads`);
      }

      const data = await response.json();
      console.log('📊 Raw threads data:', data);
      
      // Transform the response to match our expected format
      const result = {
        success: true,
        threads: data.chats || data.threads || data,
        total: data.total || (data.chats || data.threads || data)?.length || 0,
        page: data.page || 1,
        limit: data.limit || 50
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
      const response = await authService.authenticatedFetch(`${this.baseUrl}/${id}`, {
        method: 'GET',
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}: Failed to fetch thread`);
      }

      const data = await response.json();
      return data.thread || data;
    } catch (error) {
      console.error('Error fetching thread:', error);
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