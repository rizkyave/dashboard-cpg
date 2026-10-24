export type PratenderStatus =
  | 'DRAFT'
  | 'RFQ_SENT'
  | 'EVALUATION'
  | 'AWARDED'
  | 'COMPLETED'
  | 'CANCELLED';

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
  status: PratenderStatus;
  createdAt: string;
  createdBy: string;
  targetClosingDate?: string;
  description?: string;
  items: PratenderPackageItem[];
  totalEstimatedBudget?: number;
  invitedVendors?: string[];
  awardedVendor?: string;
  awardedValue?: number;
  poNumberGenerated?: string;
  notes?: string;
  updatedAt?: string;
}

