export type EntityCode = 'ALL' | 'CPL' | 'PPI' | 'HL' | 'GAJ' | 'MIL' | 'SP' | 'SSK' | 'MO';

export type LapseFilterType = 'ALL' | 'NORMAL' | 'WARNING' | 'CRITICAL';

export type TabType = 'overview' | 'procurement' | 'armada' | 'analytics' | 'inventory' | 'timemark';

export type StatusTone = 'emerald' | 'cyan' | 'purple' | 'amber' | 'rose';

export interface InventoryItem {
  id: string;
  perusahaan: string;
  entity: string;
  itemCode: string;
  description: string;
  quantity: number;
  unitPrice: number;
  itemType: string;
  inventoryType: string;
  category: string;
  level?: 'Induk' | 'Sub-Barang' | string;
}

export interface InventoryCompanySummary {
  name: string;
  entity: string;
  totalItems: number;
  parentItems: number;
  subItems: number;
  totalQuantity: number;
  activeStock: number;
  zeroStock: number;
  negativeStock: number;
}

export interface InventorySummary {
  totalItems: number;
  parentItems: number;
  subItems: number;
  totalQuantity: number;
  activeStock: number;
  zeroStock: number;
  negativeStock: number;
  byCompany: InventoryCompanySummary[];
  topItems: {
    rank: number;
    company: string;
    itemCode: string;
    description: string;
    quantity: number;
    itemType: string;
    category?: string;
    level: string;
  }[];
}

export interface ProcurementItem {
  id?: string;
  fpb: string;
  entity: string;
  po: string;
  date: string;
  item: string;
  peruntukan: string;
  lapse: number;
  statusBadge: string;
  statusTone: StatusTone;
  picPch: string;
  picTtb: string;
  picLap: string;
  picAdm: string;
  picAktif: string;
  statusPenjelasan: string;
  // Extended fields from the actual Excel & Merge
  deptArmada?: string;
  deliveryTime?: string;
  noFstb?: string;
  tglInputFstb?: string;
  tglKePicTtb?: string;
  noTtb?: string;
  tglInputTtb?: string;
  tglKeTimLapangan?: string;
  tglBarangDiantar?: string;
  tglTtbKePicPch?: string;
  tglKeAdmPch?: string;
  noSpp?: string;
  tglInputSpp?: string;
  tglKeKeuangan?: string;
  kodeBarang?: string;
  satuan?: string;
  qtyFPB?: number;
  qtyPO?: number;
  qtyFSTB?: number;
  qtyTTB?: number;
  selisih?: number;
  priority?: string;
  kategori?: string;
  statusArmada?: string;
  waktuProses?: string;
  tglFpb?: string;
  tglPo?: string;
  tglFstb?: string;
  tglTtb?: string;
  sourceSheet?: string;
  // Divisi 1: Check & Verifikasi FPB
  picCheckFpb?: string;
  tglCheckFpb?: string;
  statusCheckFpb?: string;
  tglApproveWeb?: string;
  noteCheckFpb?: string;
  doneCheckFpb?: string;
}

export interface ArmadaItem {
  id?: string;
  fpb: string;
  armada: string;
  item: string;
  qtyFPB: number;
  qtyFSTB: number;
  selisih: number;
  status: string;
  // Extended fields from "Monitoring Layanan Armada" sheet & Merge
  tglFpb?: string;
  noPo?: string;
  tglPo?: string;
  noFstb?: string;
  tglFstb?: string;
  noTtb?: string;
  tglTtb?: string;
  kodeBarang?: string;
  satuan?: string;
  keterangan?: string;
  kategori?: string;
  entity?: string;
  priority?: string;
  waktuProses?: string;
  qtyPO?: number;
  qtyTTB?: number;
  picPch?: string;
  picTtb?: string;
  picLap?: string;
  picAdm?: string;
  deliveryTime?: string;
  tglKeKeuangan?: string;
  noSpp?: string;
  statusBadge?: string;
  statusTone?: StatusTone;
  lapse?: number;
  picAktif?: string;
  // Divisi 1: Check & Verifikasi FPB
  picCheckFpb?: string;
  tglCheckFpb?: string;
  statusCheckFpb?: string;
  tglApproveWeb?: string;
  noteCheckFpb?: string;
  doneCheckFpb?: string;
}

export interface ToastState {
  message: string;
  type?: 'info' | 'success' | 'warning' | 'error';
  visible: boolean;
}
