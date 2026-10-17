/**
 * Utilitas format & sanitasi penamaan berkas TTB otomatis untuk Google Drive & sistem penyimpanan.
 * 
 * Aturan penamaan:
 * 1. Format utama: [NO_TTB].[ekstensi_asli]
 *    Contoh: "CPL-TTB-26-00449.jpg"
 * 2. Jika lebih dari 1 file: tambahkan indeks suffix, misal:
 *    "CPL-TTB-26-00449_01.jpg", "CPL-TTB-26-00449_02.jpg"
 * 3. Sanitasi karakter ilegal (/, \, ?, %, *, :, |, ", <, >) menjadi tanda hubung (-).
 */

export interface TtbComponents {
  prefix: string | null;       // contoh: "SP", "GAJ", "CPL", "HL", "MO", "MIL", "SSK"
  year: string | null;         // contoh: "26"
  number: string | null;       // contoh: "00328" (standar 5 digit jika <= 5 digit)
  rawNumber: string | null;    // contoh: "328" atau "00328"
  canonicalTtb: string | null; // contoh: "SP-TTB-26-00328"
}

/**
 * Ekstraksi komponen nomor TTB (Prefix Perusahaan, Tahun, dan Nomor Urut) secara akurat.
 * Mendukung format:
 * - "SP-TTB-26-00328.pdf" -> SP, 26, 00328 -> "SP-TTB-26-00328"
 * - "GAJ-TTB-26-01140.pdf" -> GAJ, 26, 01140 -> "GAJ-TTB-26-01140"
 * - "CPL-TTB-26-06685.pdf" -> CPL, 26, 06685 -> "CPL-TTB-26-06685"
 * - "CPL-TTB 04975.jpg" -> CPL, 26 (default), 04975 -> "CPL-TTB-26-04975"
 * - "TTB-26-00328.pdf" -> null, 26, 00328 -> "TTB-26-00328"
 * - "04975.pdf" -> null, 26 (default), 04975 -> "TTB-26-04975"
 */
export function extractTtbComponents(input: string, fallbackYear?: string): TtbComponents {
  if (!input) {
    return { prefix: null, year: null, number: null, rawNumber: null, canonicalTtb: null };
  }

  const base = input.replace(/\.[a-z0-9]+$/i, '').trim();

  // Pola 1: [PREFIX]-TTB-[YR]-[NUM] atau [PREFIX]-TTB [NUM]
  // Contoh: SP-TTB-26-00328, GAJ-TTB-26-01140, CPL-TTB-26-06685, CPL-TB 04975
  const fullRegex = /(?:^|[\s_./\-])([A-Za-z]{2,6})[\s\-_./]+T?TB[\s\-_./]*(?:(20\d{2}|\d{2})[\s\-_./]+)?(\d{3,6})(?:$|[\s_./\-])/i;

  // Pola 2: TTB-[YR]-[NUM] atau TTB [NUM] (tanpa prefix)
  const noPrefixRegex = /(?:^|[\s_./\-])T?TB[\s\-_./]*(?:(20\d{2}|\d{2})[\s\-_./]+)?(\d{3,6})(?:$|[\s_./\-])/i;

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
      // Pola 3: Angka mandiri 4-6 digit (cth: 04975.jpg, Scan_04975.pdf)
      const numMatch = base.match(/(?:^|[^0-9])(\d{4,6})(?:[^0-9]|$)/);
      if (numMatch) {
        rawNumber = numMatch[1];
      }
    }
  }

  if (!rawNumber) {
    return { prefix, year, number: null, rawNumber: null, canonicalTtb: null };
  }

  const number = rawNumber.length <= 5 ? rawNumber.padStart(5, '0') : rawNumber;
  const currentYear = year || fallbackYear || String(new Date().getFullYear()).slice(2);

  let canonicalTtb = '';
  if (prefix) {
    canonicalTtb = `${prefix}-TTB-${currentYear}-${number}`;
  } else {
    canonicalTtb = `TTB-${currentYear}-${number}`;
  }

  return {
    prefix,
    year: currentYear,
    number,
    rawNumber,
    canonicalTtb,
  };
}

/**
 * Membersihkan karakter terlarang dari nomor TTB agar aman digunakan sebagai nama file
 */
export function sanitizeTtbNumber(raw: string): string {
  if (!raw) return '';
  return raw
    .trim()
    // Ubah garis miring, backslash, dan simbol ilegal menjadi strip
    .replace(/[/\\?%*:|"<>]/g, '-')
    // Ubah spasi menjadi strip
    .replace(/\s+/g, '-')
    // Satukan strip berulang (contoh: --- menjadi -)
    .replace(/-+/g, '-')
    // Hilangkan strip atau titik di awal & akhir
    .replace(/^[-_.]+|[-_.]+$/g, '');
}

/**
 * Ekstrak ekstensi file dan pastikan lowercase
 */
export function getCleanExtension(filename: string): string {
  if (!filename) return '.jpg';
  const lastDot = filename.lastIndexOf('.');
  if (lastDot === -1) return '.jpg';
  const ext = filename.slice(lastDot).toLowerCase().trim();
  return ext || '.jpg';
}

/**
 * Menghasilkan nama file baru otomatis sesuai Nomor TTB
 * 
 * @param noTtb Nomor TTB input pengguna (misal: "CPL/TTB/26/00449")
 * @param originalFilename Nama asli file dari kamera/komputer (misal: "IMG_20261012_WA0012.jpg")
 * @param index Indeks urutan file (0-based)
 * @param totalFiles Jumlah total file dalam antrean upload
 */
export function formatTtbFilename(
  noTtb: string,
  originalFilename: string,
  index: number = 0,
  totalFiles: number = 1
): string {
  const cleanTtb = sanitizeTtbNumber(noTtb) || 'TTB-UNSPECIFIED';
  const ext = getCleanExtension(originalFilename);

  // Jika hanya 1 file, format: [NO_TTB].[ext]
  if (totalFiles <= 1) {
    return `${cleanTtb}${ext}`;
  }

  // Jika multiple files, format: [NO_TTB]_[index].[ext] (contoh: CPL-TTB-26-00449_01.jpg)
  const suffix = String(index + 1).padStart(2, '0');
  return `${cleanTtb}_${suffix}${ext}`;
}

/**
 * Format ukuran file ke representasi manusia (KB / MB)
 */
export function formatFileSize(bytes: number): string {
  if (!bytes || bytes <= 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

