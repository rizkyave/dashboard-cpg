/**
 * Utilitas Integrasi TimeMark untuk Verifikasi Foto Dokumentasi Lapangan
 * Menghubungkan kode FSTB (5 digit terakhir) langsung ke portal web TimeMark Teamspace.
 */

export const DEFAULT_TIMEMARK_PORTAL_URL = 'https://teamspace.timemark.com';
const STORAGE_KEY = 'timemark_portal_url';

/**
 * Ekstraksi 5 digit nomor urut belakang dari kode FSTB.
 * Contoh:
 * - "CPL-FSTB-26-04044" -> "04044"
 * - "MO-FSTB-26-01330"  -> "01330"
 * - "GAJ-FSTB-26-00733" -> "00733"
 * - "04044"             -> "04044"
 */
export const extractFstbLast5 = (fstb?: string | null): string => {
  if (!fstb) return '';
  const clean = fstb.trim();
  if (!clean || clean === '-' || clean === 'null' || clean === 'undefined') return '';

  // 1. Cek pola angka 4-6 digit di ujung string
  const trailingMatch = clean.match(/(\d{4,6})$/);
  if (trailingMatch) return trailingMatch[1];

  // 2. Cek apakah ada kelompok 5 angka di dalam string (misal FSTB 04044 REV)
  const blockMatch = clean.match(/\b(\d{5})\b/);
  if (blockMatch) return blockMatch[1];

  // 3. Fallback: ambil 5 karakter terakhir jika panjang >= 5
  return clean.length >= 5 ? clean.slice(-5) : clean;
};

/**
 * Mendapatkan URL portal TimeMark yang dikonfigurasi pengguna (atau default).
 */
export const getTimemarkPortalUrl = (): string => {
  if (typeof window === 'undefined') return DEFAULT_TIMEMARK_PORTAL_URL;
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && saved.trim().startsWith('http')) {
      return saved.trim();
    }
  } catch {
    // Ignore localStorage error in private mode
  }
  return DEFAULT_TIMEMARK_PORTAL_URL;
};

/**
 * Menyimpan URL portal TimeMark kustom ke localStorage.
 */
export const setTimemarkPortalUrl = (url: string): void => {
  if (typeof window === 'undefined') return;
  try {
    if (!url || !url.trim()) {
      localStorage.removeItem(STORAGE_KEY);
    } else {
      localStorage.setItem(STORAGE_KEY, url.trim());
    }
  } catch {
    // Ignore localStorage error
  }
};

/**
 * Membuka portal TimeMark & menyalin 5 angka FSTB ke clipboard pengguna.
 * Memberikan feedback toast instan untuk kemudahan alur kerja.
 */
export const openTimemarkWithFstb = async (
  fstb: string,
  onNotify?: (msg: string, type: 'info' | 'success' | 'warning' | 'error') => void
): Promise<{ success: boolean; shortCode: string; portalUrl: string }> => {
  const shortCode = extractFstbLast5(fstb);
  const portalUrl = getTimemarkPortalUrl();

  if (!shortCode) {
    if (onNotify) {
      onNotify('Nomor FSTB tidak valid atau belum terbit.', 'warning');
    }
    return { success: false, shortCode: '', portalUrl };
  }

  // 1. Salin 5 angka ke clipboard
  let copied = false;
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(shortCode);
      copied = true;
    } catch {
      // Clipboard write failed (permissions/focus), non-fatal
    }
  }

  // 2. Buka portal web TimeMark di tab baru
  if (typeof window !== 'undefined') {
    window.open(portalUrl, '_blank', 'noopener,noreferrer');
  }

  // 3. Notifikasi toast
  if (onNotify) {
    if (copied) {
      onNotify(
        `Kode FSTB "${shortCode}" disalin ke clipboard! Membuka portal TimeMark...`,
        'success'
      );
    } else {
      onNotify(
        `Membuka portal TimeMark untuk FSTB "${shortCode}"...`,
        'info'
      );
    }
  }

  return { success: true, shortCode, portalUrl };
};
