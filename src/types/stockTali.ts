export interface StockTaliItem {
  no: string;
  pt: string;
  deptArmada: string;
  noFpb: string;
  picTtb: string;
  ttb: string;
  tglInputTtb: string;
  tglKeTimLapangan: string;
  keterangan: string;
  lapseDay1: string;
  picLapangan: string;
  tglBarangDiantar: string;
  keteranganAntar: string;
  tglTimLapKePicTtb: string;
  lapseDay2: string;
  tglTtbKePicPch: string;
  keteranganPch: string;
  lapseDay3: string;
}

export interface StockTaliSummary {
  totalItems: number;
  totalArmada: number;
  totalEntitas: number;
  terkirimLapangan: number;
  kembaliKeTtb: number;
  tutupSiklusPch: number;
  dalamProses: number;
  ptCounts: Record<string, number>;
  picTtbCounts: Record<string, number>;
  picLapCounts: Record<string, number>;
}

export interface StockTaliResponse {
  success: boolean;
  message?: string;
  updatedAt: string;
  sourceUrl: string;
  total: number;
  items: StockTaliItem[];
  summary: StockTaliSummary;
}

