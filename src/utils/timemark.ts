/**
 * Utilitas Integrasi TimeMark untuk Verifikasi Foto Dokumentasi Lapangan
 * Menghubungkan kode FSTB (5 digit terakhir) langsung ke portal web TimeMark Teamspace.
 */

export const DEFAULT_TIMEMARK_PORTAL_URL = 'https://teamspace.timemark.com/en/allPhotos';
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
      const clean = saved.trim().replace(/\/+$/, '');
      // Auto upgrade root domain lama ke halaman allPhotos langsung
      if (clean === 'https://teamspace.timemark.com' || clean === 'http://teamspace.timemark.com') {
        return DEFAULT_TIMEMARK_PORTAL_URL;
      }
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
 * Membentuk URL pencarian web langsung dengan nomor FSTB.
 * Mendukung template placeholder {code} dan {fstb}, serta otomatis
 * menambahkan parameter query string (?search=...&keyword=...&q=...) ke URL portal.
 */
export const buildTimemarkSearchUrl = (baseUrl: string, shortCode: string, fullFstb?: string): string => {
  const code = (shortCode || extractFstbLast5(fullFstb)).trim();
  const fstb = (fullFstb || code).trim();
  let url = (baseUrl || DEFAULT_TIMEMARK_PORTAL_URL).trim();

  // Jika URL masih mengarah ke root domain, arahkan langsung ke halaman galeri allPhotos
  if (url.replace(/\/+$/, '') === 'https://teamspace.timemark.com' || url.replace(/\/+$/, '') === 'http://teamspace.timemark.com') {
    url = DEFAULT_TIMEMARK_PORTAL_URL;
  }

  if (!code && !fstb) return url;

  // 1. Template replacement jika user mengonfigurasi template URL kustom
  // Contoh: https://teamspace.timemark.com/?search={code}
  // Atau: https://drive.google.com/drive/search?q={fstb}
  if (url.includes('{code}') || url.includes('{fstb}')) {
    return url
      .replace(/\{code\}/g, encodeURIComponent(code))
      .replace(/\{fstb\}/g, encodeURIComponent(fstb));
  }

  // 2. Format URL pencarian web otomatis:
  // Mengirim parameter search dan keyword yang umum digunakan web app
  const cleanBase = url.replace(/\/+$/, '');
  const separator = cleanBase.includes('?') ? '&' : '?';
  const queryParam = `search=${encodeURIComponent(code)}&keyword=${encodeURIComponent(code)}&q=${encodeURIComponent(code)}`;

  // Menangani URL yang memiliki hash routing (#/...)
  if (cleanBase.includes('#')) {
    const hashSep = cleanBase.includes('?') ? '&' : '?';
    return `${cleanBase}${hashSep}${queryParam}`;
  }

  return `${cleanBase}${separator}${queryParam}`;
};

/**
 * Membuka portal TimeMark langsung dengan pencarian nomor FSTB di web & menyalin ke clipboard.
 * Membuka web search langsung tanpa harus paste manual.
 */
export const openTimemarkWithFstb = async (
  fstb: string,
  onNotify?: (msg: string, type: 'info' | 'success' | 'warning' | 'error') => void
): Promise<{ success: boolean; shortCode: string; portalUrl: string; searchUrl: string }> => {
  const shortCode = extractFstbLast5(fstb);
  const portalUrl = getTimemarkPortalUrl();

  if (!shortCode && !fstb) {
    if (onNotify) {
      onNotify('Nomor FSTB tidak valid atau belum terbit.', 'warning');
    }
    return { success: false, shortCode: '', portalUrl, searchUrl: portalUrl };
  }

  // 1. Bentuk URL pencarian web langsung yang membawa nomor FSTB
  const searchUrl = buildTimemarkSearchUrl(portalUrl, shortCode, fstb);

  // 2. Salin 5 angka ke clipboard sebagai safeguard / cadangan
  let copied = false;
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(shortCode || fstb);
      copied = true;
    } catch {
      // Non-fatal
    }
  }

  // 3. Buka URL pencarian langsung di tab baru (langsung search no FSTB tanpa paste manual)
  if (typeof window !== 'undefined') {
    window.open(searchUrl, '_blank', 'noopener,noreferrer');
  }

  // 4. Notifikasi toast
  if (onNotify) {
    onNotify(
      `Membuka web pencarian FSTB "${shortCode || fstb}"${copied ? ' (kode juga disalin ke clipboard)' : ''}...`,
      'success'
    );
  }

  return { success: true, shortCode, portalUrl, searchUrl };
};

