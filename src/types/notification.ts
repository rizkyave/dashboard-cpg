export type NotificationType =
  | 'FSTB_UPLOADED'
  | 'FSTB_VALIDATED'
  | 'TTB_UPLOADED'
  | 'TTB_VALIDATED'
  | 'SYSTEM_INFO';

export interface AppNotification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  senderName: string;
  senderUsername: string;
  senderRole?: string;
  targetRole?: string; // e.g. 'staf_ttb', 'all', etc.
  targetUsers?: string[]; // optional specific usernames
  linkTab?: string; // Tab to navigate to, e.g. 'monitoring-internal', 'validasi-dokumen', 'upload-fstb'
  metadata?: {
    noFstb?: string;
    noPo?: string;
    noFpb?: string;
    armada?: string;
    fileUrl?: string;
    renamedFileName?: string;
    [key: string]: any;
  };
  createdAt: string; // ISO string
  readBy: string[]; // List of user IDs or usernames who have marked this as read
}

export interface WaGatewayConfig {
  provider: 'fonnte' | 'wablas' | 'custom' | 'none';
  apiKey: string;
  targetPhoneNumbers: string; // e.g. "08123456789,08987654321" or group ID
  groupTarget?: string;
  enabled: boolean;
}

