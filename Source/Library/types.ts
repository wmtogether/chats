// Source/Library/types.ts

// Represents Go's sql.NullString type
export interface NullString {
  String: string;
  Valid: boolean;
}

// Represents Go's sql.NullInt64 type
export interface NullInt64 {
  Int64: number;
  Valid: boolean;
}

// Interface for the parsed metadata field in a Chat object
export interface ChatMetadata {
  queueId: number;
  queueStatus: string;
  requestType: string;
  createdByName: string;
  // Add other properties found in the metadata JSON
}

// Interface for a Chat object (as received from the API)
export interface ChatType {
  id: number;
  uuid: string;
  uniqueId?: string; // Format: QT-DDMMYY-{NUM}
  channelId: string;
  channelName: string;
  channelType: string;
  chatCategory: string;
  description: NullString;
  jobId: NullString;
  queueId: NullInt64;
  customerId: NullString;
  customers: NullString; // Changed from original analysis to match the provided JSON. It's also NullString.
  status?: string; // Chat status (PENDING, ACCEPTED, etc.)
  metadata: string; // The raw JSON string
  parsedMetadata?: ChatMetadata; // To store the parsed metadata
  isArchived: number; // 0 or 1
  createdById: number;
  createdByName: string;
  createdAt: string; // ISO 8601 string
  updatedAt: string; // ISO 8601 string
  // Add other fields as they appear in the API response
}

// Interface for a Message object (as received from the API)
export interface MessageType {
  messageId: string;
  userId: string;
  userName: string;
  createdAt: string;
  content: string;
  attachments?: string[];
  editedAt?: string; // Optional field
  // Add other fields as they appear in the API response
}

// User interface for message bubble
export interface MessageUser {
  id: string;
  name: string;
  avatarUrl?: string;
  initial?: string;
  color?: string;
}

// Message data for message bubble component
export interface MessageBubbleData {
  id: string;
  user: MessageUser;
  time: string;
  content: string;
  attachments?: string[];
  reactions?: { emoji: string; count: number; active?: boolean }[];
  isHighlighted?: boolean;
  editedAt?: string;
  replyTo?: {
    messageId: string;
    userName: string;
    content: string;
  };
  meta?: {
    type: 'progress';
    label: string;
    current: string;
    total: string;
    percentage: number;
  };
}

// Interface for a Customer object (as received from the API)
export interface CustomerType {
  id: number;
  cusId: string;     // Customer ID from jobs
  name: string;      // Customer name
  createdAt: string; // ISO 8601 string
  updatedAt: string; // ISO 8601 string
}
