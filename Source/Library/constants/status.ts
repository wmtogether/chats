import { Clock, CheckCircle, XCircle, AlertCircle, Pause } from 'lucide-react';

export interface StatusConfig {
  label: string;
  labelTh: string;
  icon: any;
  color: string;
  bgColor: string;
  textColor: string;
}

export const STATUS_CONFIG: Record<string, StatusConfig> = {
  PENDING: {
    label: 'Pending',
    labelTh: 'รอดำเนินการ',
    icon: Clock,
    color: 'text-yellow-700 dark:text-yellow-300',
    bgColor: 'bg-yellow-100 dark:bg-yellow-900/30',
    textColor: 'text-yellow-800 dark:text-yellow-400'
  },
  ACCEPTED: {
    label: 'Accepted',
    labelTh: 'รับงานแล้ว',
    icon: CheckCircle,
    color: 'text-blue-700 dark:text-blue-300',
    bgColor: 'bg-blue-100 dark:bg-blue-900/30',
    textColor: 'text-blue-800 dark:text-blue-400'
  },
  WAIT_DIMENSION: {
    label: 'Wait Dimension',
    labelTh: 'รอขึ้น Dimension',
    icon: Clock,
    color: 'text-orange-700 dark:text-orange-300',
    bgColor: 'bg-orange-100 dark:bg-orange-900/30',
    textColor: 'text-orange-800 dark:text-orange-400'
  },
  WAIT_FEEDBACK: {
    label: 'Wait Feedback',
    labelTh: 'รอ Feedback',
    icon: AlertCircle,
    color: 'text-purple-700 dark:text-purple-300',
    bgColor: 'bg-purple-100 dark:bg-purple-900/30',
    textColor: 'text-purple-800 dark:text-purple-400'
  },
  WAIT_QA: {
    label: 'Wait QA',
    labelTh: 'รอ QA',
    icon: AlertCircle,
    color: 'text-indigo-700 dark:text-indigo-300',
    bgColor: 'bg-indigo-100 dark:bg-indigo-900/30',
    textColor: 'text-indigo-800 dark:text-indigo-400'
  },
  HOLD: {
    label: 'Hold',
    labelTh: 'พักงาน',
    icon: Pause,
    color: 'text-gray-700 dark:text-gray-300',
    bgColor: 'bg-gray-100 dark:bg-gray-800/30',
    textColor: 'text-gray-800 dark:text-gray-400'
  },
  COMPLETED: {
    label: 'Completed',
    labelTh: 'เสร็จสิ้น',
    icon: CheckCircle,
    color: 'text-green-700 dark:text-green-300',
    bgColor: 'bg-green-100 dark:bg-green-900/30',
    textColor: 'text-green-800 dark:text-green-400'
  },
  CANCEL: {
    label: 'Cancel',
    labelTh: 'ยกเลิก',
    icon: XCircle,
    color: 'text-red-700 dark:text-red-300',
    bgColor: 'bg-red-100 dark:bg-red-900/30',
    textColor: 'text-red-800 dark:text-red-400'
  },
};

// Helper function to get status config with fallback
export function getStatusConfig(status: string): StatusConfig {
  return STATUS_CONFIG[status] || STATUS_CONFIG.PENDING;
}

// Helper function to get Thai label
export function getStatusLabelTh(status: string): string {
  return STATUS_CONFIG[status]?.labelTh || status;
}

// Helper function to get English label
export function getStatusLabel(status: string): string {
  return STATUS_CONFIG[status]?.label || status;
}
