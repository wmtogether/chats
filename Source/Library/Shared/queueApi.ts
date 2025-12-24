// Queue API Service for status updates
import authService from '../Authentication/jwt';

export interface QueueStatus {
  id: number;
  jobName: string;
  requestType: string;
  status: string;
  priority: string;
  assignedToId?: number | null;
  assignedToName?: string | null;
  customerId?: string | null;
  customerName?: string | null;
  createdById: number;
  createdByName: string;
  updatedById: number;
  updatedByName: string;
  createdAt: string;
  updatedAt: string;
}

export interface QueueUpdatePayload {
  status?: string;
  assignedToId?: number | null;
  assignedToName?: string | null;
  requestType?: string;
}

export const QUEUE_STATUSES = [
  'PENDING',
  'ACCEPTED', 
  'WAIT_DIMENSION',
  'WAIT_FEEDBACK',
  'WAIT_QA',
  'HOLD',
  'COMPLETED',
  'CANCEL'
] as const;

export type QueueStatusType = typeof QUEUE_STATUSES[number];

class QueueApiService {
  private baseUrl = '/api/queue';

  async getQueue(queueId: number): Promise<QueueStatus> {
    try {
      console.log('🔄 Fetching queue:', queueId);
      
      const response = await authService.authenticatedFetch(`${this.baseUrl}/${queueId}`, {
        method: 'GET',
      });

      console.log('📡 Queue API response status:', response.status);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('❌ Queue API error:', errorData);
        throw new Error(errorData.error || `HTTP ${response.status}: Failed to fetch queue`);
      }

      const data = await response.json();
      console.log('📊 Queue data:', data);
      
      return data.queue;
    } catch (error) {
      console.error('❌ Error fetching queue:', error);
      throw error;
    }
  }

  async updateQueueStatus(queueId: number, updates: QueueUpdatePayload): Promise<QueueStatus> {
    try {
      console.log('🔄 Updating queue status:', { queueId, updates });
      
      const response = await authService.authenticatedFetch(`${this.baseUrl}/${queueId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updates),
      });

      console.log('📡 Queue update response status:', response.status);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('❌ Queue update error:', errorData);
        throw new Error(errorData.error || `HTTP ${response.status}: Failed to update queue`);
      }

      const data = await response.json();
      console.log('✅ Queue updated successfully:', data);
      
      return data.queue;
    } catch (error) {
      console.error('❌ Error updating queue:', error);
      throw error;
    }
  }

  getStatusLabel(status: string): string {
    switch (status) {
      case 'PENDING': return 'รอดำเนินการ';
      case 'ACCEPTED': return 'รับงาน';
      case 'WAIT_DIMENSION': return 'รอขนาด';
      case 'WAIT_FEEDBACK': return 'รอความคิดเห็น';
      case 'WAIT_QA': return 'รอตรวจสอบ';
      case 'HOLD': return 'พักงาน';
      case 'COMPLETED': return 'เสร็จสิ้น';
      case 'CANCEL': return 'ยกเลิก';
      default: return status;
    }
  }

  getStatusColor(status: string): string {
    switch (status) {
      case 'PENDING': return 'text-yellow-600';
      case 'ACCEPTED': return 'text-blue-600';
      case 'WAIT_DIMENSION': return 'text-orange-600';
      case 'WAIT_FEEDBACK': return 'text-purple-600';
      case 'WAIT_QA': return 'text-indigo-600';
      case 'HOLD': return 'text-gray-600';
      case 'COMPLETED': return 'text-green-600';
      case 'CANCEL': return 'text-red-600';
      default: return 'text-on-surface-variant';
    }
  }

  getStatusBgColor(status: string): string {
    switch (status) {
      case 'PENDING': return 'bg-yellow-500/10 border-yellow-500/20';
      case 'ACCEPTED': return 'bg-blue-500/10 border-blue-500/20';
      case 'WAIT_DIMENSION': return 'bg-orange-500/10 border-orange-500/20';
      case 'WAIT_FEEDBACK': return 'bg-purple-500/10 border-purple-500/20';
      case 'WAIT_QA': return 'bg-indigo-500/10 border-indigo-500/20';
      case 'HOLD': return 'bg-gray-500/10 border-gray-500/20';
      case 'COMPLETED': return 'bg-green-500/10 border-green-500/20';
      case 'CANCEL': return 'bg-red-500/10 border-red-500/20';
      default: return 'bg-surface-variant/10 border-outline';
    }
  }

  getStatusIcon(status: string): string {
    switch (status) {
      case 'PENDING': return 'schedule';
      case 'ACCEPTED': return 'trending_up';
      case 'WAIT_DIMENSION': return 'straighten';
      case 'WAIT_FEEDBACK': return 'feedback';
      case 'WAIT_QA': return 'verified';
      case 'HOLD': return 'pause';
      case 'COMPLETED': return 'check_circle';
      case 'CANCEL': return 'cancel';
      default: return 'help';
    }
  }

  getRequestTypeLabel(requestType: string): string {
    switch (requestType) {
      case 'design': return 'Design Request';
      case 'dimension': return 'Dimension Check';
      case 'checkfile': return 'File Check';
      case 'adjustdesign': return 'Design Adjustment';
      case 'proof': return 'Proof Request';
      case 'sample-i': return 'Sample (Internal)';
      case 'sample-t': return 'Sample (Test)';
      case 'layout': return 'Layout Request';
      default: return 'Work Request';
    }
  }
}

// Export singleton instance
export const queueApiService = new QueueApiService();
export default queueApiService;