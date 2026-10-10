export interface WorkOrderItem {
  id: string;
  timestamp: string;
  nomerDokumen: string;
  tanggalOrder: string;
  departemenArmada: string;
  namaProject: string;
  lokasiPekerjaan: string;
  tanggalMulai: string;
  tanggalMrpFpb: string;
  tanggalSelesai: string;
  noLkaLkk: string;
  scalaPrioritas: string;
  section: string;
  uraianPerbaikan: string;
  uploadSoWoUrl: string;
  gapAnalysis: string;
  noFpbMrp: string;
  status: 'Open' | 'On Progress' | 'Close' | string;
  progress: number;
  evidence: string;
  spk: string;
  bastUrl: string;
  efpbPdfUrl?: string;
  orderDateMs?: number;
  timestampMs?: number;
  rowIndex?: number;
}

export interface WorkOrderSummary {
  total: number;
  open: number;
  onProgress: number;
  close: number;
  withFpb: number;
  lastSynced: string;
}

