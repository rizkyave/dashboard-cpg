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

