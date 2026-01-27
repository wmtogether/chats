// Queue API Service for status updates
import ipcService from './ipcService';

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

export interface QueueCreationPayload {
  jobName: string;
  requestType: string;
  notes?: string | null;
  priority?: string;
  customerId?: string | null;
  customerName?: string | null;
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

  async createQueue(payload: QueueCreationPayload): Promise<any> {
    try {
      console.log('🔄 Creating new queue via WebUI API:', payload);
      
      const response = await ipcService.post(this.baseUrl, payload);

      console.log('✅ Queue created successfully:', response);
      
      return response.queue || response.data || response;
    } catch (error) {
      console.error('❌ Error creating queue:', error);
      throw error;
    }
  }

  async getQueue(queueId: number): Promise<QueueStatus> {
    try {
      console.log('🔄 Fetching queue via WebUI API:', queueId);
      
      const response = await ipcService.get(`${this.baseUrl}/${queueId}`);

      console.log('📊 Queue data:', response);
      
      return response.queue || response.data || response;
    } catch (error) {
      console.error('❌ Error fetching queue:', error);
      throw error;
    }
  }

  async updateQueueStatus(queueId: number, updates: QueueUpdatePayload): Promise<QueueStatus> {
    try {
      console.log('🔄 Updating queue status via WebUI API:', { queueId, updates });
      
      const response = await ipcService.patch(`${this.baseUrl}/${queueId}`, updates);

      console.log('✅ Queue updated successfully:', response);
      
      return response.queue || response.data || response;
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