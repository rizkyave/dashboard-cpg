export type KondisiSerahTerima = 'LENGKAP_BAIK' | 'PARSIAL' | 'CATATAN_KONDISI';

export interface SerahTerimaPhoto {
  name: string;
  originalName: string;
  url: string;
  r2Key?: string;
  size: number;
}

export interface SerahTerimaItem {
  id: string;
  noTtb: string;
  cleanNoTtb: string;
  armada: string;
  noFpb?: string;
  noPo?: string;
  itemSummary?: string;
  petugas: string;
  penerima: string;
  kontakPenerima?: string;
  tanggalSerahTerima: string;
  kondisi: KondisiSerahTerima;
  catatan?: string;
  photos: SerahTerimaPhoto[];
  storageProvider: 'CLOUDFLARE_R2' | 'LOCAL';
  createdAt: string;
}

export interface SerahTerimaResponse {
  success: boolean;
  message: string;
  record?: SerahTerimaItem;
  records?: SerahTerimaItem[];
  error?: string;
  isR2Active?: boolean;
}

