export type SisaLayananStatus = 'CLOSE' | 'OPEN' | 'KURANG' | 'BELUM TTB' | string;

export interface SisaLayananItem {
  id: string;
  fpbNoBarang?: string;
  poNoBarang?: string;
  noFpb: string;
  tglFpb?: string;
  noPo?: string;
  tglPo?: string;
  noFstb?: string;
  tglFstb?: string;
  noTtb?: string;
  tglTtb?: string;
  kodeBarang: string;
  namaBarang: string;
  jmlFpb: number;
  jmlPo: number;
  jmlFstb: number;
  jmlTtb: number;
  selisih: number;
  satuan: string;
  keterangan: string;
  kategori: string;
  status: SisaLayananStatus;
  departement: string;
  pt: string;
  priority: string;
  waktuProses?: string;
  linkFpb?: string;
}

export interface SisaLayananSummary {
  totalItems: number;
  totalClose: number;
  totalOpen: number;
  totalKurang: number;
  totalBelumTtb: number;
  totalUnits: number;
  totalPts: number;
  fulfillmentRate: number; // percentage
  byPt: Record<string, { total: number; close: number; open: number; kurang: number; belumTtb: number }>;
  byStatus: Record<string, number>;
  lastUpdated: string;
}

export interface SisaGoodsSummary {
  primaryName: string;
  totalItemsCount: number;
  qtyText: string;
  allItems: Array<{
    nama: string;
    qty: number;
    satuan: string;
    kodeBarang: string;
    status: string;
    kategori?: string;
    departement?: string;
  }>;
  tooltipText: string;
  allItemNames: string;
  totalQtyFpb: number;
  totalQtyPo: number;
  totalQtyFstb: number;
  totalQtyTtb: number;
  primarySatuan: string;
  primaryTtb?: string;
  allTtbs?: string[];
  primaryFstb?: string;
  allFstbs?: string[];
}


