export interface PreDispatchChecklistData {
  ttbId: string;
  cleanNoTtb?: string;
  noTtb?: string;
  armada?: string;
  noFpb?: string;
  noPo?: string;
  itemSummary?: string;
  itemsVerified: boolean;
  packagingGood: boolean;
  documentsReady: boolean;
  dispatchNotes?: string;
  dispatchedAt: string;
  courierName: string;
}

export interface PreDispatchResponse {
  success: boolean;
  message: string;
  record?: PreDispatchChecklistData;
  records?: PreDispatchChecklistData[];
  error?: string;
}

