export interface GlobalFilterState {
  tahun: string;              // 'ALL' | '2026' | '2025'
  bulan: string;              // 'ALL' | '06' | '07' | '08' | '09' | '10'
  entitas: string;            // 'ALL' | 'CPL' | 'PPI' | 'GAJ' | 'HL' | 'MIL'
  selectedArmadaId: string | null; // e.g. 'OFFICE GAJ' atau null jika semua armada
  statusFilter: 'ALL' | 'LENGKAP' | 'PROSES' | 'PARSIAL' | 'BACKLOG';
  searchTerm: string;
  focusTop12Only?: boolean;   // true = Murni 12 Besar (100%), false = + Armada Lainnya (13 Kategori)
  fleetTypeFilter?: 'ALL' | 'MARINE' | 'OFFICE_SITE'; // 'ALL' = Semua, 'MARINE' = Khusus Kapal Laut, 'OFFICE_SITE' = Kantor/Site
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
  isMarine?: boolean;
  realRank?: number;
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
  topVesselRealization?: number;
  top12ConcentrationPct?: number;
  totalAllArmadasFpb?: number;
}

export interface MonthlyTrendPoint {
  monthKey: string;
  monthName: string;
  totalFpb: number;
  qtyFPB: number;
  qtyFSTB: number;
}
