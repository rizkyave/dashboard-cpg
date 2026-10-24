export type ShippingMethod =
  | 'Travel / Mobil Titipan'
  | 'Kapal Perintis / Kapal Lain'
  | 'Ekspedisi Lokal';

export interface RemoteHandoverTokenData {
  id: string;
  token: string;
  ttbId: string;
  noTtb: string;
  cleanNoTtb: string;
  armada: string;
  noFpb?: string;
  noPo?: string;
  itemSummary: string;
  fileUrl?: string;

  // Third-party delivery info
  shippingMethod: ShippingMethod;
  carrierContact: string;
  trackingNumber?: string;
  recipientPhone: string;
  recipientNameTarget?: string;

  // Status and Expiration
  createdAt: string;
  expiresAt: string;
  isUsed: boolean;
  usedAt?: string;

  // Dispatcher info
  dispatchedBy: string;
  dispatchedAt: string;

  // Completed receiver submission data
  receiverName?: string;
  receiverRole?: string;
  receiverSignatureDataUrl?: string;
  receiverPhotos?: string[];
  geolocation?: {
    latitude: number;
    longitude: number;
    accuracy?: number;
  };
  completionNotes?: string;
}

export interface RemoteHandoverResponse {
  success: boolean;
  message?: string;
  error?: string;
  token?: string;
  shareUrl?: string;
  data?: RemoteHandoverTokenData;
  tokens?: RemoteHandoverTokenData[];
  status?: 'valid' | 'used' | 'expired' | 'not_found';
}

