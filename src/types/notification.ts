export type NotificationType =
  | 'FSTB_UPLOADED'
  | 'FSTB_VALIDATED'
  | 'TTB_UPLOADED'
  | 'TTB_VALIDATED'
  | 'TTB_DISPATCHED'
  | 'SERAH_TERIMA_COMPLETED'
  | 'SYSTEM_INFO';

export interface AppNotification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  senderName: string;
  senderUsername: string;
  senderRole?: string;
  targetRole?: string; // e.g. 'staf_ttb', 'staf_lapangan', 'all', etc.
  targetUsers?: string[]; // optional specific usernames
  linkTab?: string; // Tab to navigate to: 'monitoring-internal', 'validasi-dokumen', 'upload-fstb', 'upload-ttb', 'serah-terima'
  metadata?: {
    noFstb?: string;
    noTtb?: string;
    noPo?: string;
    noFpb?: string;
    armada?: string;
    itemSummary?: string;
    recipientName?: string;
    recipientRole?: string;
    courierName?: string;
    carrierContact?: string;
    shippingMethod?: string;
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
