/**
 * Utility to format various date representations to standard dd/mm/yy format.
 * Examples:
 * - '2026-08-06' -> '06/08/26'
 * - '7/29/2026'  -> '29/07/26'
 * - '8/13/2026'  -> '13/08/26'
 * - '17/07/2026' -> '17/07/26'
 * - '29 July 2026' -> '29/07/26'
 * - '2026-07-29 11:20:15' -> '29/07/26'
 * - '-' or empty -> '-'
 */
export function formatDateDdMmYy(val?: string | number | null): string {
  if (!val && val !== 0) return '-';
  const str = String(val).trim();
  if (
    !str ||
    str === '-' ||
    str === '(kosong)' ||
    str.toLowerCase() === 'null' ||
    str.toLowerCase() === 'undefined'
  ) {
    return '-';
  }

  // Already dd/mm/yy (e.g. 06/08/26)
  if (/^\d{2}\/\d{2}\/\d{2}$/.test(str)) {
    return str;
  }

  // 1. ISO date: YYYY-MM-DD or YYYY/MM/DD (with optional timestamp)
  const isoMatch = str.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (isoMatch) {
    const yy = isoMatch[1].slice(-2);
    const mm = isoMatch[2].padStart(2, '0');
    const dd = isoMatch[3].padStart(2, '0');
    return `${dd}/${mm}/${yy}`;
  }

  // 2. Slash or dash separated: D/M/YYYY, M/D/YYYY, DD/MM/YYYY, or DD/MM/YY
  const slashMatch = str.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})/);
  if (slashMatch) {
    const p1 = parseInt(slashMatch[1], 10);
    const p2 = parseInt(slashMatch[2], 10);
    const yrStr = slashMatch[3];
    const yy = yrStr.length === 4 ? yrStr.slice(-2) : yrStr.padStart(2, '0');

    let dd = '';
    let mm = '';
    if (p1 > 12) {
      // p1 is definitely day: DD/MM/YY
      dd = String(p1).padStart(2, '0');
      mm = String(p2).padStart(2, '0');
    } else if (p2 > 12) {
      // p2 is definitely day: MM/DD/YY (American style from Sheets)
      dd = String(p2).padStart(2, '0');
      mm = String(p1).padStart(2, '0');
    } else {
      // Both <= 12: In Indonesian operations, default is DD/MM/YY
      dd = String(p1).padStart(2, '0');
      mm = String(p2).padStart(2, '0');
    }
    return `${dd}/${mm}/${yy}`;
  }

  // 3. Fallback: Parse textual dates like '29 Jul 2026', '29 July 2026', ISO string
  const parsed = Date.parse(str);
  if (!isNaN(parsed)) {
    const d = new Date(parsed);
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yy = String(d.getFullYear()).slice(-2);
    return `${dd}/${mm}/${yy}`;
  }

  return str;
}

export function formatDateDdMmYyDash(val?: string | number | null): string {
  const slash = formatDateDdMmYy(val);
  if (!slash || slash === '-') return '-';
  return slash.replace(/\//g, '-');
}

export interface DateInfo {
  year: string;
  month: string;
  day: string;
  fullDate: string;
  timestamp: number;
}

/**
 * Ekstraksi informasi tanggal secara akurat (Tahun 4-digit, Bulan 2-digit, Tanggal 2-digit, Timestamp).
 * Menangani format:
 * - ISO: YYYY-MM-DD atau YYYY/MM/DD
 * - Standar Indonesia: DD/MM/YYYY, DD/MM/YY, DD-MM-YYYY, DD-MM-YY
 * - Fallback teks/Date.parse
 */
export function extractDateInfo(dateStr?: string | number | null): DateInfo {
  if (!dateStr && dateStr !== 0) return { year: '', month: '', day: '', fullDate: '', timestamp: 0 };
  const str = String(dateStr).trim();
  if (!str || str === '-' || str === '(kosong)' || str.toLowerCase() === 'null') {
    return { year: '', month: '', day: '', fullDate: '', timestamp: 0 };
  }

  // 1. Format ISO: YYYY-MM-DD atau YYYY/MM/DD
  const isoMatch = str.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (isoMatch) {
    const year = isoMatch[1];
    const month = isoMatch[2].padStart(2, '0');
    const day = isoMatch[3].padStart(2, '0');
    const fullDate = `${year}-${month}-${day}`;
    const timestamp = new Date(`${fullDate}T00:00:00`).getTime();
    return { year, month, day, fullDate, timestamp: isNaN(timestamp) ? 0 : timestamp };
  }

  // 2. Format Slash/Dash: DD/MM/YYYY, DD/MM/YY, DD-MM-YYYY, DD-MM-YY
  const slashMatch = str.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})/);
  if (slashMatch) {
    const p1 = parseInt(slashMatch[1], 10);
    const p2 = parseInt(slashMatch[2], 10);
    const yrStr = slashMatch[3];
    const year = yrStr.length === 2 ? (parseInt(yrStr, 10) > 50 ? `19${yrStr}` : `20${yrStr}`) : yrStr;

    let day = '';
    let month = '';
    if (p1 > 12) {
      day = String(p1).padStart(2, '0');
      month = String(p2).padStart(2, '0');
    } else if (p2 > 12) {
      day = String(p2).padStart(2, '0');
      month = String(p1).padStart(2, '0');
    } else {
      // Default operasi pengadaan Indonesia adalah DD/MM/YY
      day = String(p1).padStart(2, '0');
      month = String(p2).padStart(2, '0');
    }

    const fullDate = `${year}-${month}-${day}`;
    const timestamp = new Date(`${fullDate}T00:00:00`).getTime();
    return { year, month, day, fullDate, timestamp: isNaN(timestamp) ? 0 : timestamp };
  }

  // 3. Fallback: Parse textual dates
  const parsed = Date.parse(str);
  if (!isNaN(parsed)) {
    const dt = new Date(parsed);
    const year = String(dt.getFullYear());
    const month = String(dt.getMonth() + 1).padStart(2, '0');
    const day = String(dt.getDate()).padStart(2, '0');
    const fullDate = `${year}-${month}-${day}`;
    return {
      year,
      month,
      day,
      fullDate,
      timestamp: new Date(`${fullDate}T00:00:00`).getTime() || parsed,
    };
  }

  return { year: '', month: '', day: '', fullDate: '', timestamp: 0 };
}

export default formatDateDdMmYy;

