/**
 * Utility Pemformatan & Validasi Batas Waktu Penawaran Tender (RFQ Closing Deadline)
 * Memastikan penegasan Hari, Tanggal, dan Jam Penutupan Resmi (WITA - UTC+8)
 */

export const HARI_INDONESIA = [
  'Minggu',
  'Senin',
  'Selasa',
  'Rabu',
  'Kamis',
  'Jumat',
  'Sabtu',
];

export const BULAN_INDONESIA = [
  'Januari',
  'Februari',
  'Maret',
  'April',
  'Mei',
  'Juni',
  'Juli',
  'Agustus',
  'September',
  'Oktober',
  'November',
  'Desember',
];

export interface TenderDeadlineInfo {
  isValid: boolean;
  closingDate: Date | null;
  dayName: string;
  dateStr: string;
  timeStr: string;
  formattedFull: string; // contoh: "Jumat, 20 November 2026 pukul 17:00 WITA"
  isPassed: boolean;
  remainingMs: number;
  remainingText: string; // contoh: "Sisa 2 hari 4 jam 15 menit" atau "Batas Waktu Telah Berakhir"
}

/**
 * Parsing string tanggal & jam batas penawaran ke objek Date yang presisi
 * Mendukung format: YYYY-MM-DDTHH:mm, YYYY-MM-DD HH:mm, YYYY-MM-DD, ISO string
 */
export function parseTenderClosingDate(raw: string | undefined | null): Date | null {
  if (!raw || typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;

  // Jika format hanya tanggal YYYY-MM-DD (panjang 10), defaultkan ke jam 17:00:00 (Akhir jam operasional kantor)
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const [y, m, d] = trimmed.split('-').map(Number);
    const date = new Date(y, m - 1, d, 17, 0, 0, 0);
    return isNaN(date.getTime()) ? null : date;
  }

  // Jika format YYYY-MM-DDTHH:mm atau YYYY-MM-DD HH:mm
  if (/^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(:\d{2})?/.test(trimmed)) {
    const normalized = trimmed.replace(' ', 'T');
    const date = new Date(normalized);
    if (!isNaN(date.getTime())) return date;
  }

  // Fallback standar
  const parsed = new Date(trimmed);
  return isNaN(parsed.getTime()) ? null : parsed;
}

/**
 * Memformat batas waktu penawaran dengan penegasan Hari, Tanggal Lengkap, dan Jam Penutupan
 * Hasil contoh: "Jumat, 20 November 2026 pukul 17:00 WITA"
 */
export function formatTenderClosingFull(
  raw: string | undefined | null,
  fallback = 'Sesuai Ketentuan RKS'
): string {
  const date = parseTenderClosingDate(raw);
  if (!date) return fallback;

  const dayName = HARI_INDONESIA[date.getDay()];
  const dayNum = date.getDate();
  const monthName = BULAN_INDONESIA[date.getMonth()];
  const year = date.getFullYear();

  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');

  return `${dayName}, ${dayNum} ${monthName} ${year} pukul ${hours}:${minutes} WITA`;
}

/**
 * Menghitung status deadline, sisa waktu, dan teks keterbacaan tinggi
 */
export function getTenderDeadlineInfo(raw: string | undefined | null): TenderDeadlineInfo {
  const date = parseTenderClosingDate(raw);
  if (!date) {
    return {
      isValid: false,
      closingDate: null,
      dayName: '-',
      dateStr: '-',
      timeStr: '-',
      formattedFull: 'Sesuai Ketentuan RKS',
      isPassed: false,
      remainingMs: 0,
      remainingText: 'Jadwal belum ditentukan',
    };
  }

  const now = Date.now();
  const closingMs = date.getTime();
  const remainingMs = closingMs - now;
  const isPassed = remainingMs <= 0;

  const dayName = HARI_INDONESIA[date.getDay()];
  const dayNum = date.getDate();
  const monthName = BULAN_INDONESIA[date.getMonth()];
  const year = date.getFullYear();

  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');

  const dateStr = `${dayNum} ${monthName} ${year}`;
  const timeStr = `${hours}:${minutes} WITA`;
  const formattedFull = `${dayName}, ${dateStr} pukul ${timeStr}`;

  let remainingText = '';
  if (isPassed) {
    remainingText = 'Batas Waktu Telah Berakhir (Ditutup)';
  } else {
    const diffSec = Math.floor(remainingMs / 1000);
    const days = Math.floor(diffSec / 86400);
    const hrs = Math.floor((diffSec % 86400) / 3600);
    const mins = Math.floor((diffSec % 3600) / 60);

    if (days > 0) {
      remainingText = `Sisa ${days} hari ${hrs} jam`;
    } else if (hrs > 0) {
      remainingText = `Sisa ${hrs} jam ${mins} menit lagi!`;
    } else {
      remainingText = `Kritis: Sisa ${mins} menit lagi!`;
    }
  }

  return {
    isValid: true,
    closingDate: date,
    dayName,
    dateStr,
    timeStr,
    formattedFull,
    isPassed,
    remainingMs,
    remainingText,
  };
}

/**
 * Mengonversi tanggal ke format yang kompatibel dengan input type="datetime-local" (YYYY-MM-DDTHH:mm)
 */
export function toDatetimeLocalValue(raw: string | undefined | null, defaultHour = 17): string {
  const date = parseTenderClosingDate(raw);
  if (!date) {
    // Default 7 hari ke depan pukul defaultHour:00
    const d = new Date();
    d.setDate(d.getDate() + 7);
    d.setHours(defaultHour, 0, 0, 0);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const h = String(d.getHours()).padStart(2, '0');
    const min = String(d.getMinutes()).padStart(2, '0');
    return `${y}-${m}-${day}T${h}:${min}`;
  }

  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const h = String(date.getHours()).padStart(2, '0');
  const min = String(date.getMinutes()).padStart(2, '0');
  return `${y}-${m}-${d}T${h}:${min}`;
}
