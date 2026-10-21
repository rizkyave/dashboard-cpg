export type FpbReviewStatus =
  | 'PENDING_REVIEW'
  | 'APPROVED_PO'
  | 'FULFILL_STOCK'
  | 'NEED_CLARIFICATION'
  | 'REJECTED';

export type FpbUrgency = 'NORMAL' | 'URGENT' | 'EMERGENCY';

export type ItemStockStatus = 'IN_STOCK' | 'PARTIAL' | 'OUT_OF_STOCK' | 'NOT_CHECKED';

export type ItemDecision = 'PO' | 'STOCK' | 'HOLD' | 'REJECT';

export interface FpbItemReview {
  no: number;
  itemCode: string;
  itemName: string;
  qty: number;
  unit: string;
  description: string;
  priority?: string;
  stockAvailable?: number;
  stockStatus?: ItemStockStatus;
  matchedInventoryItem?: string;
  inventoryEntity?: string;
  decision?: ItemDecision;
  notes?: string;
}

export interface FpbDuplicateAlert {
  fpbNo: string;
  date: string;
  armada: string;
  matchedItem: string;
  similarityNotes?: string;
}

export interface FpbRelatedDocs {
  poNos: string[];
  fstbNos: string[];
  ttbNos: string[];
}

export interface FpbReviewRecord {
  id: string;
  fpbNo: string;
  originalFpb: string;
  entity: string;
  armada: string;
  date: string;
  purpose: string;
  efpbStatus: string;
  pchLogistik?: string;
  isReceivedLogistik: boolean;
  pdfUrl: string;
  reviewStatus: FpbReviewStatus;
  urgency: FpbUrgency;
  picPurchasing: string;
  reviewNotes: string;
  items: FpbItemReview[];
  duplicateAlerts: FpbDuplicateAlert[];
  relatedDocs: FpbRelatedDocs;
  reviewedBy?: string;
  reviewedAt?: string;
  updatedAt: string;
  createdAt: string;
}

export interface FpbReviewSummaryMetrics {
  total: number;
  pending: number;
  approvedPo: number;
  fulfillStock: number;
  needClarification: number;
  rejected: number;
  urgent: number;
  emergency: number;
}
