export interface GlobalFilterState {
  tahun: string;              // 'ALL' | '2026' | '2025'
  bulan: string;              // 'ALL' | '06' | '07' | '08' | '09' | '10'
  entitas: string;            // 'ALL' | 'CPL' | 'PPI' | 'GAJ' | 'HL' | 'MIL'
  selectedArmadaId: string | null; // e.g. 'OFFICE GAJ' atau null jika semua armada
  statusFilter: 'ALL' | 'LENGKAP' | 'PROSES' | 'PARSIAL' | 'BACKLOG';
  searchTerm: string;
}

export interface ArmadaDataPoint {
  id: string;
  name: string;
  normalizedName: string;
  tag: string;
  fpbCount: number;
  qtyFPB: number;
  qtyFSTB: number;
  backlogQty: number;
  percentage: number;
  color: string;
  items: any[];
}

export interface KPIMetrics {
  totalFpb: number;
  totalQtyFPB: number;
  totalQtyFSTB: number;
  fulfillmentRate: number;
  totalBacklogQty: number;
  backlogItemCount: number;
  partialItemCount: number;
  completeItemCount: number;
  vesselCount: number;
  topVesselName: string;
  topVesselFpb: number;
}

export interface MonthlyTrendPoint {
  monthKey: string;
  monthName: string;
  totalFpb: number;
  qtyFPB: number;
  qtyFSTB: number;
}

