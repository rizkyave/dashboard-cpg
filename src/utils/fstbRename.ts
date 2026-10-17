/**
 * Utilitas format & sanitasi penamaan berkas FSTB otomatis untuk penyimpanan Cloudflare R2 & sistem.
 * 
 * Aturan penamaan:
 * 1. Format utama: [NO_FSTB].[ekstensi_asli]
 *    Contoh: "CPL-FSTB-26-05241.pdf"
 * 2. Jika lebih dari 1 file: tambahkan indeks suffix, misal:
 *    "CPL-FSTB-26-05241_01.pdf", "CPL-FSTB-26-05241_02.pdf"
 * 3. Sanitasi karakter ilegal (/, \, ?, %, *, :, |, ", <, >) menjadi tanda hubung (-).
 */

export interface FstbComponents {
  prefix: string | null;       // contoh: "CPL", "SP", "GAJ", "HL", "MOI"
  year: string | null;         // contoh: "26"
  number: string | null;       // contoh: "05241" (standar 5 digit)
  rawNumber: string | null;    // contoh: "5241" atau "05241"
  canonicalFstb: string | null;// contoh: "CPL-FSTB-26-05241"
}

/**
 * Ekstraksi komponen nomor FSTB (Prefix Perusahaan, Tahun, dan Nomor Urut) secara akurat.
 * Mendukung format:
 * - "CPL-FSTB-26-05241.pdf" -> CPL, 26, 05241 -> "CPL-FSTB-26-05241"
 * - "SP-FSTB-26-00328.pdf"  -> SP, 26, 00328  -> "SP-FSTB-26-00328"
 * - "FSTB-26-05241.pdf"     -> null, 26, 05241 -> "FSTB-26-05241"
 * - "FSTB 05241.pdf"        -> null, 26 (default), 05241 -> "FSTB-26-05241"
 * - "05241.pdf"             -> null, 26 (default), 05241 -> "FSTB-26-05241"
 */
export function extractFstbComponents(input: string, fallbackYear?: string): FstbComponents {
  if (!input) {
    return { prefix: null, year: null, number: null, rawNumber: null, canonicalFstb: null };
  }

  const base = input.replace(/\.[a-z0-9]+$/i, '').trim();

  // Pola 1: [PREFIX]-FSTB-[YR]-[NUM] atau [PREFIX]-FSTB [NUM]
  // Contoh: CPL-FSTB-26-05241, SP-FSTB-26-00328, GAJ-FSTB-26-01124
  const fullRegex = /(?:^|[\s_./\-])([A-Za-z]{2,6})[\s\-_./]+FSTB[\s\-_./]*(?:(20\d{2}|\d{2})[\s\-_./]+)?(\d{3,6})(?:$|[\s_./\-])/i;

  // Pola 2: FSTB-[YR]-[NUM] atau FSTB [NUM] (tanpa prefix)
  const noPrefixRegex = /(?:^|[\s_./\-])FSTB[\s\-_./]*(?:(20\d{2}|\d{2})[\s\-_./]+)?(\d{3,6})(?:$|[\s_./\-])/i;

  let prefix: string | null = null;
  let year: string | null = null;
  let rawNumber: string | null = null;

  const mFull = base.match(fullRegex);
  if (mFull) {
    prefix = mFull[1].toUpperCase();
    if (mFull[2]) {
      year = mFull[2].length === 4 ? mFull[2].slice(2) : mFull[2];
    }
    rawNumber = mFull[3];
  } else {
    const mNoPref = base.match(noPrefixRegex);
    if (mNoPref) {
      if (mNoPref[1]) {
        year = mNoPref[1].length === 4 ? mNoPref[1].slice(2) : mNoPref[1];
      }
      rawNumber = mNoPref[2];
    } else {
      // Pola 3: Angka mandiri 4-6 digit (cth: 05241.pdf, Scan_05241.pdf)
      const numMatch = base.match(/(?:^|[^0-9])(\d{4,6})(?:[^0-9]|$)/);
      if (numMatch) {
        rawNumber = numMatch[1];
      }
    }
  }

  if (!rawNumber) {
    return { prefix, year, number: null, rawNumber: null, canonicalFstb: null };
  }

  const number = rawNumber.length <= 5 ? rawNumber.padStart(5, '0') : rawNumber;
  const currentYear = year || fallbackYear || String(new Date().getFullYear()).slice(2);

  let canonicalFstb = '';
  if (prefix) {
    canonicalFstb = `${prefix}-FSTB-${currentYear}-${number}`;
  } else {
    canonicalFstb = `FSTB-${currentYear}-${number}`;
  }

  return {
    prefix,
    year: currentYear,
    number,
    rawNumber,
    canonicalFstb,
  };
}

/**
 * Membersihkan karakter terlarang dari nomor FSTB agar aman digunakan sebagai nama file
 */
export function sanitizeFstbNumber(raw: string): string {
  if (!raw) return '';
  return raw
    .trim()
    .toUpperCase()
    .replace(/[/\\?%*:|"<>]/g, '-')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * Memformat nama berkas FSTB yang baru sesuai standar penamaan.
 */
export function formatFstbFilename(
  cleanFstb: string,
  originalFilename: string,
  index?: number,
  total?: number
): string {
  const ext = originalFilename.includes('.')
    ? originalFilename.slice(originalFilename.lastIndexOf('.')).toLowerCase()
    : '.pdf';

  const baseFstb = sanitizeFstbNumber(cleanFstb) || 'FSTB';

  if (typeof index === 'number' && typeof total === 'number' && total > 1) {
    const suffix = String(index + 1).padStart(2, '0');
    return `${baseFstb}_${suffix}${ext}`;
  }

  return `${baseFstb}${ext}`;
}

/**
 * Format ukuran berkas dalam format ramah pengguna (KB / MB)
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

