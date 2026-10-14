/**
 * Utility untuk menyimpan & membaca update status operasional Fase 4 (Logistik TTB/BAST) 
 * dan Fase 5 (Tim Lapangan / Teknisi) secara persisten.
 */

export interface OperationalAttachment {
  id?: string;
  name: string;
  url: string;
  viewUrl?: string;
  driveViewUrl?: string;
  driveFileId?: string;
  uploadedAt: string;
}

export interface OperationalOverride {
  fpb: string;
  // Fase 4: Logistik TTB / BAST
  picTtb?: string;
  noTtb?: string;
  tglTtb?: string;
  // Fase 5: Tim Lapangan / Teknisi
  picLap?: string;
  serviceReportNo?: string;
  tglDiantar?: string;         // Tgl Selesai / Tgl Diantar
  tglKeTimLapangan?: string;   // Tgl Diterima TL / Ke Lapangan
  tglTimLapKePicTtb?: string;  // TL ke TTB
  tglTtbKePicPch?: string;     // TTB ke PCH
  isCompleted?: boolean;       // Status tanda selesai penuh
  // Lampiran foto / scan BAST / Service Report
  attachments?: OperationalAttachment[];
  keterangan?: string;
  updatedAt: string;
}

const STORAGE_KEY = 'CPG_OPERATIONAL_PROGRESS_OVERRIDES';

function normalizeFpbKey(fpb?: string | null): string {
  if (!fpb) return '';
  return fpb
    .toUpperCase()
    .trim()
    .replace(/\s+/g, '')
    .replace(/[^A-Z0-9]/g, '');
}

/**
 * Mengambil semua data override operasional dari localStorage
 */
export function getAllOperationalOverrides(): Record<string, OperationalOverride> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw);
  } catch (err) {
    console.warn('Gagal membaca data override operasional dari localStorage:', err);
    return {};
  }
}

/**
 * Mengambil data override operasional untuk nomor FPB tertentu
 */
export function getOperationalOverride(fpb: string): OperationalOverride | null {
  if (!fpb) return null;
  const all = getAllOperationalOverrides();
  const key = normalizeFpbKey(fpb);
  return all[key] || null;
}

/**
 * Menyimpan data override operasional untuk nomor FPB tertentu
 */
export function saveOperationalOverride(override: OperationalOverride): void {
  if (typeof window === 'undefined' || !override.fpb) return;
  try {
    const all = getAllOperationalOverrides();
    const key = normalizeFpbKey(override.fpb);
    all[key] = {
      ...override,
      updatedAt: new Date().toISOString(),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
    // Trigger storage event across open tabs
    window.dispatchEvent(new Event('cpg_operational_override_changed'));
  } catch (err) {
    console.error('Gagal menyimpan override operasional ke localStorage:', err);
  }
}

/**
 * Menghapus override operasional untuk nomor FPB tertentu (reset)
 */
export function deleteOperationalOverride(fpb: string): void {
  if (typeof window === 'undefined' || !fpb) return;
  try {
    const all = getAllOperationalOverrides();
    const key = normalizeFpbKey(fpb);
    if (all[key]) {
      delete all[key];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
      window.dispatchEvent(new Event('cpg_operational_override_changed'));
    }
  } catch (err) {
    console.error('Gagal menghapus override operasional dari localStorage:', err);
  }
}
