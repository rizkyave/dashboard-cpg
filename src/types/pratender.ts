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
  technicalStatus?: 'PASSED' | 'FAILED'; // 'PASSED' = Lolos Syarat Teknis, 'FAILED' = Tidak Lolos Evaluasi I
  status: 'SUBMITTED' | 'UNDER_EVALUATION' | 'NEGOTIATION' | 'RECOMMENDED' | 'AWARDED' | 'REJECTED';
  negotiationNotes?: string;
  negotiatedGrandTotal?: number; // BAFO (Best & Final Offer)
  isLocked?: boolean; // Status kunci 1x submit untuk cegah input ganda
  lockedAt?: string;
  unlockedAt?: string;
  unlockedBy?: string;
  receiptNumber?: string;
  token?: string;
  officialDocName?: string;
  officialDocUrl?: string;
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
  releaseTierId?: string;
  releaseTierName?: string;
  isPoReleased?: boolean;
  poReleasedAt?: string;
  poReleasedBy?: string;
  standstillStartedAt?: string;
  standstillEndsAt?: string;
  standstillStatus?: 'IN_PROGRESS' | 'COMPLETED_NO_DISPUTE' | 'DISPUTED';
  disputeNotes?: string;
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
  currentStock?: number;
  avgUnitPrice?: number;
  totalEstimatedCost?: number;
  urgency?: 'CRITICAL' | 'REORDER' | 'PLANNED';
  source?: 'PLANNING' | 'SISA_LAYANAN';
  urgencyReason?: string;
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
  waGroupInviteLink?: string; // Tautan undangan grup WhatsApp koordinasi vendor
  isWinnerBlasted?: boolean; // Status 1x blast pengumuman pemenang ke peserta
  winnerBlastedAt?: string; // Timestamp saat blast pengumuman disiarkan
  winnerBlastedBy?: string; // Staf/Panitia yang melakukan blast pengumuman
  evaluationDeadline?: string; // Target SLA Evaluasi Panitia (1-2 hari kerja)
  scheduleAddendumHistory?: {
    extendedAt: string;
    extendedBy: string;
    oldDate: string;
    newDate: string;
    reason: string;
  }[];
  notes?: string;
  updatedAt?: string;
}

