export type PratenderStatus =
  | 'DRAFT'
  | 'RFQ_SENT'
  | 'EVALUATION'
  | 'AWARDED'
  | 'COMPLETED'
  | 'CANCELLED';

export type ProcurementMethod =
  | 'TENDER_TERBUKA'
  | 'TENDER_TERBATAS'
  | 'PENUNJUKAN_LANGSUNG';

export interface VendorBidItem {
  itemId: string;
  itemName: string;
  qty: number;
  unitPrice: number;
  totalPrice: number;
  brandOffered?: string;
  compliance?: 'COMPLIANT' | 'DEVIATION' | 'NON_COMPLIANT';
  notes?: string;
}

export interface VendorBidSubmission {
  id: string;
  vendorName: string;
  vendorPic?: string;
  vendorContact?: string;
  quotationRefNo?: string;
  bidDate: string;
  termOfPayment: string; // misal: 'CBD', 'COD', 'NET 14', 'NET 30', 'NET 60'
  deliveryLeadTimeDays: number;
  francoDeliveryPoint: string;
  validityDays?: number;
  items: VendorBidItem[];
  subtotal: number;
  ppnPercent: number; // 0 atau 11
  ppnAmount: number;
  deliveryFee: number;
  grandTotal: number;
  technicalScore?: number; // 0 - 100
  commercialScore?: number; // 0 - 100
  overallScore?: number; // 0 - 100
  ranking?: number;
  status: 'SUBMITTED' | 'UNDER_EVALUATION' | 'NEGOTIATION' | 'RECOMMENDED' | 'AWARDED' | 'REJECTED';
  negotiationNotes?: string;
  negotiatedGrandTotal?: number; // BAFO (Best & Final Offer)
}

export interface TenderEvaluationSummary {
  evaluatedBy?: string;
  evaluatedAt?: string;
  recommendationNotes?: string;
  winningVendorId?: string;
  winningVendorName?: string;
  winningAmount?: number;
  costSavingVsHps?: number;
  costSavingPercent?: number;
  approvalLevel?: 'SUPERVISOR' | 'MANAGER' | 'DIREKSI';
  approvalStatus?: 'DRAFT' | 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED';
  approvedBy?: string;
  approvedAt?: string;
  approvalNotes?: string;
  baepNumber?: string; // Berita Acara Evaluasi Pengadaan No.
}

export interface PratenderRequestRef {
  fpb: string;
  armada: string;
  qtyRequested: number;
  qtyFulfilled: number;
  qtyRemaining: number;
  tglFpb?: string;
  noPo?: string;
  status: string;
  entity?: string;
  workOrderNo?: string;
}

export interface PratenderOpenItem {
  id: string;
  cleanName: string;
  category: string;
  satuan: string;
  totalQtyRemaining: number;
  totalQtyRequested: number;
  vesselCount: number;
  vessels: string[];
  requests: PratenderRequestRef[];
  isPackaged?: boolean;
  packageId?: string;
  packageNumber?: string;
}

export interface PratenderPackageItem {
  itemId: string;
  itemName: string;
  category: string;
  satuan: string;
  totalQty: number;
  originalQty?: number;
  targetPrice?: number;
  targetTotalPrice?: number;
  notes?: string;
  vessels: string[];
  requestFpbs: string[];
}

export interface PratenderPackage {
  id: string;
  packageNumber: string;
  title: string;
  category: string;
  procurementMethod?: ProcurementMethod;
  ownerEstimateHps?: number;
  status: PratenderStatus;
  createdAt: string;
  createdBy: string;
  targetClosingDate?: string;
  description?: string;
  items: PratenderPackageItem[];
  totalEstimatedBudget?: number;
  invitedVendors?: string[];
  vendorBids?: VendorBidSubmission[];
  evaluationSummary?: TenderEvaluationSummary;
  awardedVendor?: string;
  awardedValue?: number;
  poNumberGenerated?: string;
  notes?: string;
  updatedAt?: string;
}

