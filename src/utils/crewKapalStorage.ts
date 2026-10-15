import * as XLSX from 'xlsx';
import {
  KapalRekapItem,
  CrewMasterItem,
  LowongItem,
  CadetMonitoringItem,
  AuditLogItem,
  CrewKapalSummary,
} from '@/types/crewKapal';
import {
  initialKapalRekap,
  initialMasterCrew,
  initialLowong,
  initialCadet,
  initialAuditLogs,
  initialCrewSummary,
} from '@/data/initialCrewData';

const STORAGE_KEY_CREW = 'CPG_CREW_KAPAL_DATA_V1';

export interface StoredCrewData {
  summary: CrewKapalSummary;
  kapalRekap: KapalRekapItem[];
  masterCrew: CrewMasterItem[];
  posisiLowong: LowongItem[];
  cadetMonitoring: CadetMonitoringItem[];
  auditLogs: AuditLogItem[];
  lastUpdated: string;
}

export function loadCrewData(): StoredCrewData {
  if (typeof window === 'undefined') {
    return {
      summary: initialCrewSummary,
      kapalRekap: initialKapalRekap,
      masterCrew: initialMasterCrew,
      posisiLowong: initialLowong,
      cadetMonitoring: initialCadet,
      auditLogs: initialAuditLogs,
      lastUpdated: '15 Oktober 2026',
    };
  }

  try {
    const raw = localStorage.getItem(STORAGE_KEY_CREW);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.masterCrew) && parsed.masterCrew.length > 0) {
        return parsed;
      }
    }
  } catch (err) {
    console.error('Error loading stored crew data:', err);
  }

  return {
    summary: initialCrewSummary,
    kapalRekap: initialKapalRekap,
    masterCrew: initialMasterCrew,
    posisiLowong: initialLowong,
    cadetMonitoring: initialCadet,
    auditLogs: initialAuditLogs,
    lastUpdated: '15 Oktober 2026',
  };
}

export function saveCrewData(data: StoredCrewData): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY_CREW, JSON.stringify(data));
    window.dispatchEvent(new CustomEvent('cpg_crew_data_changed'));
  } catch (err) {
    console.error('Error saving crew data:', err);
  }
}

export function resetCrewData(): StoredCrewData {
  const base: StoredCrewData = {
    summary: initialCrewSummary,
    kapalRekap: initialKapalRekap,
    masterCrew: initialMasterCrew,
    posisiLowong: initialLowong,
    cadetMonitoring: initialCadet,
    auditLogs: initialAuditLogs,
    lastUpdated: '15 Oktober 2026',
  };
  if (typeof window !== 'undefined') {
    localStorage.removeItem(STORAGE_KEY_CREW);
    window.dispatchEvent(new CustomEvent('cpg_crew_data_changed'));
  }
  return base;
}

/**
 * Export all 5 sheets to Excel .xlsx workbook
 */
export function exportCrewDataToExcel(data: StoredCrewData): void {
  const wb = XLSX.utils.book_new();

  // Sheet 1: Ringkasan Armada
  const rekapRows = data.kapalRekap.map((k) => ({
    'No': k.no,
    'No. Kapal': k.noKapal,
    'Nama Kapal': k.namaKapal,
    'Tipe Kapal': k.tipeKapal,
    'GT': k.gt,
    'Mesin (HP)': k.mesinHp,
    'Daya (KW/PS)': k.dayaKwPs,
    'No. Telp / Call Kapal': k.noTelp,
    'Total Kuota': k.totalKuota,
    'Kru Aktif': k.kruAktif,
    'Cadet': k.cadet,
    'Posisi Lowong': k.posisiLowong,
    'Persentase Terisi': k.persentaseTerisi,
  }));
  const wsRekap = XLSX.utils.json_to_sheet(rekapRows);
  XLSX.utils.book_append_sheet(wb, wsRekap, 'Ringkasan Armada');

  // Sheet 2: Master Crew
  const crewRows = data.masterCrew.map((c) => ({
    'No. ID': c.id,
    'No. Kapal': c.noKapal,
    'Nama Kapal': c.namaKapal,
    'Tipe Kapal': c.tipeKapal,
    'No. Kru': c.noKru,
    'NIK': c.nik,
    'Nama Personel': c.namaPersonel,
    'Status Slot': c.statusSlot,
    'Jabatan': c.jabatan,
    'Departemen': c.departemen,
    'No. Handphone': c.noHp,
    'Ijazah / Sertifikat': c.ijazah,
    'Tahun Ijazah': c.tahunIjazah,
    'Tgl On Board': c.tglOnBoard,
    'Status Penugasan': c.statusPenugasan,
    'Asal Kampus / Sekolah': c.asalKampus,
    'Riwayat Mutasi': c.catatanMutasi,
    'Catatan Audit': c.catatanAudit,
  }));
  const wsCrew = XLSX.utils.json_to_sheet(crewRows);
  XLSX.utils.book_append_sheet(wb, wsCrew, 'Data Master Crew');

  // Sheet 3: Posisi Lowong
  const lowongRows = data.posisiLowong.map((l) => ({
    'No': l.no,
    'No. Kapal': l.noKapal,
    'Nama Kapal': l.namaKapal,
    'Tipe Kapal': l.tipeKapal,
    'Jabatan yang Dibutuhkan': l.jabatan,
    'Departemen': l.departemen,
    'Kualifikasi Standar': l.kualifikasi,
    'No. Telp Kapal': l.noTelpKapal,
    'Rekomendasi Tindakan HR': l.rekomendasi,
  }));
  const wsLowong = XLSX.utils.json_to_sheet(lowongRows);
  XLSX.utils.book_append_sheet(wb, wsLowong, 'Posisi Lowong');

  // Sheet 4: Monitoring Cadet
  const cadetRows = data.cadetMonitoring.map((cad) => ({
    'No': cad.no,
    'No. Kapal': cad.noKapal,
    'Nama Kapal': cad.namaKapal,
    'Nama Cadet': cad.namaCadet,
    'Jabatan': cad.jabatan,
    'Departemen': cad.departemen,
    'No. Handphone': cad.noHp,
    'Sertifikat': cad.sertifikat,
    'Tgl On Board': cad.tglOnBoard,
    'Asal Kampus': cad.asalKampus,
    'Catatan': cad.catatan,
  }));
  const wsCadet = XLSX.utils.json_to_sheet(cadetRows);
  XLSX.utils.book_append_sheet(wb, wsCadet, 'Monitoring Cadet');

  // Sheet 5: Log Audit
  const auditRows = data.auditLogs.map((a) => ({
    'No': a.no,
    'Baris Sumber': a.barisSumber,
    'Kategori Masalah': a.kategoriMasalah,
    'Deskripsi Temuan': a.deskripsi,
  }));
  const wsAudit = XLSX.utils.json_to_sheet(auditRows);
  XLSX.utils.book_append_sheet(wb, wsAudit, 'Log Audit Data');

  XLSX.writeFile(wb, `DATA_CREW_KAPAL_PT_CPL_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

