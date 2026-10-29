export interface BudiTtbRecord {
  id: string;
  no: number;
  pt: string;
  deptArmada: string;
  noFpb: string;
  picTtb: string;
  ttbAccurate: string;
  tanggalInputTtb: string;
  tanggalKeTimLapangan: string;
  keteranganLapangan: string;
  lapseDayLapangan: number | string;
  picLapangan: string;
  tanggalBarangDiantar: string;
  keteranganDiantar: string;
  tanggalTimLapKePicTtb: string;
  lapseDayTtb: number | string;
  tanggalTtbKePicPch: string;
  keteranganPch: string;
  lapseDayPch: number | string;
  statusPengantaran: 'TERKIRIM' | 'DALAM_PENGANTARAN' | 'PROSES_GUDANG';
  sumberSheet: 'STOCK GUDANG PAK BUDI' | 'STOCK TALI';
}

export interface BudiSyncSummary {
  totalRecords: number;
  totalArmada: number;
  totalTerkirim: number;
  totalDalamProses: number;
  ptBreakdown: Record<string, number>;
  lastSyncedAt: string;
  sourceUrl: string;
}

export const DEFAULT_BUDI_SHEET_URL =
  'https://docs.google.com/spreadsheets/d/1Bou_dU7L8UWhDEjgBpPqtKnIqoF7wLQSUN2bnYbrp1I/edit?gid=1826916113#gid=1826916113';

