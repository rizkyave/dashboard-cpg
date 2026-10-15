export interface KapalRekapItem {
  no: number;
  noKapal: string;
  namaKapal: string;
  tipeKapal: string;
  gt: string;
  mesinHp: string;
  dayaKwPs: string;
  noTelp: string;
  totalKuota: number;
  kruAktif: number;
  cadet: number;
  posisiLowong: number;
  persentaseTerisi: string;
  terisiRatio: number;
}

export interface CrewMasterItem {
  id: number;
  noKapal: string;
  namaKapal: string;
  tipeKapal: string;
  noKru: number;
  nik: string;
  namaPersonel: string;
  statusSlot: 'AKTIF' | 'CADET (MAGANG)' | 'LOWONG (VACANT)' | string;
  jabatan: string;
  departemen: string;
  noHp: string;
  ijazah: string;
  tahunIjazah: string;
  tglOnBoard: string;
  statusPenugasan: string;
  asalKampus: string;
  catatanMutasi: string;
  catatanAudit: string;
}

export interface LowongItem {
  no: number;
  noKapal: string;
  namaKapal: string;
  tipeKapal: string;
  jabatan: string;
  departemen: string;
  kualifikasi: string;
  noTelpKapal: string;
  rekomendasi: string;
  isMandatory: boolean;
}

export interface CadetMonitoringItem {
  no: number;
  noKapal: string;
  namaKapal: string;
  namaCadet: string;
  jabatan: string;
  departemen: string;
  noHp: string;
  sertifikat: string;
  tglOnBoard: string;
  asalKampus: string;
  catatan: string;
}

export interface AuditLogItem {
  no: number;
  barisSumber: string | number;
  kategoriMasalah: string;
  deskripsi: string;
}

export interface CrewKapalSummary {
  totalArmada: number;
  totalKuota: number;
  kruAktif: number;
  cadet: number;
  posisiLowong: number;
  persentaseTerisi: string;
}

