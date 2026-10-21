export type FpbReviewStatus =
  | 'PENDING_REVIEW'
  | 'APPROVED_PO'
  | 'FULFILL_STOCK'
  | 'NEED_CLARIFICATION'
  | 'REJECTED';

export type FpbUrgency = 'NORMAL' | 'URGENT' | 'EMERGENCY';

export type FpbPriorityLevel = 'P1' | 'P2' | 'P3';

export interface FpbPriorityInfo {
  code: FpbPriorityLevel;
  label: string;
  badgeLabel: string;
  slaDaysMin: number;
  slaDaysMax: number;
  description: string;
}

export const FPB_PRIORITIES: Record<FpbPriorityLevel, FpbPriorityInfo> = {
  P1: {
    code: 'P1',
    label: 'P1 - Utama (1–2 Hari)',
    badgeLabel: 'P1 (Utama: 1-2 Hari)',
    slaDaysMin: 1,
    slaDaysMax: 2,
    description: 'Prioritas Utama: Kebutuhan kritis/darurat kapal, target pengadaan 1-2 hari.',
  },
  P2: {
    code: 'P2',
    label: 'P2 - Menengah (3–14 Hari)',
    badgeLabel: 'P2 (Menengah: 3-14 Hari)',
    slaDaysMin: 3,
    slaDaysMax: 14,
    description: 'Prioritas Menengah: Kebutuhan pemeliharaan rutin, target pengadaan 3-14 hari.',
  },
  P3: {
    code: 'P3',
    label: 'P3 - Rutin (14–30 Hari)',
    badgeLabel: 'P3 (Rutin: 14-30 Hari)',
    slaDaysMin: 14,
    slaDaysMax: 30,
    description: 'Prioritas Rutin / Buffer: Kebutuhan persediaan stok gudang, target pengadaan 14-30 hari.',
  },
};

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
  priorityLevel?: FpbPriorityLevel;
  slaTargetDate?: string;
  slaDaysRemaining?: number;
  slaStatus?: 'ON_TRACK' | 'DUE_SOON' | 'OVERDUE';
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
  p1Count: number;
  p2Count: number;
  p3Count: number;
  overdueCount: number;
}

