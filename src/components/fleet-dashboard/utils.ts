// ============================================================================
// HELPER NORMALISASI & UTILITAS DATA ARMADA
// Menghilangkan duplikasi seperti 'TWIN SISTER 307' dan 'SV TWINSISTER 307'
// ============================================================================

export const TOP_FLEET_COLORS: string[] = [
  '#EC4899', // 1. OFFICE GAJ - Magenta / Deep Pink
  '#8B5CF6', // 2. SPOB SEA LION - Violet
  '#6366F1', // 3. SITE PAGATAN - Indigo
  '#3B82F6', // 4. SPOB FERY 471 - Blue
  '#06B6D4', // 5. SV TWINSISTER 307 - Cyan / Teal
  '#10B981', // 6. TB PMI ABADI - Emerald
  '#22C55E', // 7. DEPT. PROCUREMENT - Green
  '#84CC16', // 8. SPOB OCEAN MANDAR - Lime
  '#EAB308', // 9. HEAD OFFICE - Yellow
  '#F59E0B', // 10. UB CMPL 01 - Amber
  '#FB923C', // 11. TK COASTWAY 1803 - Orange
  '#EF4444', // 12. SV TWINSISTER 306 - Red
  '#64748B', // 13. Armada Lainnya (Others) - Slate Gray
];

export const MONTH_NAMES_ID: Record<string, string> = {
  '01': 'Januari',
  '02': 'Februari',
  '03': 'Maret',
  '04': 'April',
  '05': 'Mei',
  '06': 'Juni',
  '07': 'Juli',
  '08': 'Agustus',
  '09': 'September',
  '10': 'Oktober',
  '11': 'November',
  '12': 'Desember',
};

/**
 * Normalisasi Penamaan Armada agar tidak ada data terpisah / duplikat
 */
export function normalizeArmadaName(name?: string | null): string {
  if (!name) return 'LAINNYA';
  let clean = name.trim().toUpperCase();

  // Bersihkan spasi ganda dan karakter pemisah
  clean = clean.replace(/\s+/g, ' ');

  // Standardisasi awalan kapal
  clean = clean
    .replace(/^SV\.\s*/i, 'SV ')
    .replace(/^TB\.\s*/i, 'TB ')
    .replace(/^SPOB\.\s*/i, 'SPOB ')
    .replace(/^TK\.\s*/i, 'TK ')
    .replace(/^MT\.\s*/i, 'MT ')
    .replace(/^OB\.\s*/i, 'OB ');

  // Standardisasi Twinsister seri 305 / 306 / 307
  if (clean.includes('TWIN SISTER') || clean.includes('TWINSISTER')) {
    const numMatch = clean.match(/30[567]/);
    const num = numMatch ? numMatch[0] : '307';
    return `SV TWINSISTER ${num}`;
  }

  // Standardisasi SPOB Sea Lion
  if (clean.includes('SEA LION')) {
    return 'SPOB SEA LION';
  }

  // Standardisasi SPOB Ocean Mandar
  if (clean.includes('OCEAN MANDAR')) {
    return 'SPOB OCEAN MANDAR';
  }

  // Standardisasi SPOB Fery 471
  if (clean.includes('FERY 471') || clean.includes('FERI 471')) {
    return 'SPOB FERY 471';
  }

  // Standardisasi TK Coastway 1803
  if (clean.includes('COASTWAY 1803') || clean.includes('COASTWAY-1803')) {
    return 'TK COASTWAY 1803';
  }

  // Standardisasi TB PMI Abadi
  if (clean.includes('PMI ABADI')) {
    return 'TB PMI ABADI';
  }

  // Standardisasi UB CMPL 01
  if (clean.includes('CMPL 01') || clean.includes('CMPL-01') || clean.includes('CMPL1')) {
    return 'UB CMPL 01';
  }

  // Standardisasi Kantor / Departemen
  if (clean === 'OFFICE' || clean === 'OFFICE GAJ' || clean === 'GAJ') {
    return 'OFFICE GAJ';
  }
  if (clean === 'HEAD OFFICE' || clean === 'HO') {
    return 'HEAD OFFICE';
  }
  if (clean === 'PROCUREMENT' || clean === 'DEPT. PROCUREMENT' || clean === 'DEPT PROCUREMENT') {
    return 'DEPT. PROCUREMENT';
  }
  if (clean === 'SITE PAGATAN' || clean === 'PAGATAN') {
    return 'SITE PAGATAN';
  }

  return clean;
}

/**
 * Deteksi apakah nama armada tergolong unit kapal laut (Marine Fleet)
 * vs unit kantor operasional darat / site / departemen
 */
export function isMarineArmada(name?: string | null): boolean {
  if (!name) return false;
  const n = normalizeArmadaName(name).toUpperCase();
  // Daftar eksplisit Office / Site / Non-Kapal / Departemen
  if (
    n.includes('OFFICE') ||
    n.includes('SITE') ||
    n.includes('DEPT') ||
    n.includes('PROCUREMENT') ||
    n.includes('GUDANG') ||
    n.includes('WORKSHOP') ||
    n.includes('KANTOR') ||
    n.includes('LOGISTIK') ||
    n.includes('POOL') ||
    n.includes('SECURITY') ||
    n.includes('HRD') ||
    n.includes('FINANCE') ||
    n.includes('ACCOUNTING') ||
    n.includes('MES') ||
    n.includes('MESS') ||
    n === 'GAJ' ||
    n === 'HO' ||
    n === 'OTHERS' ||
    n === 'ARMADA LAINNYA'
  ) {
    return false;
  }
  return true;
}

/**
 * Parser Tanggal Serbaguna (DMY, ISO, Serial Excel, Teks Indonesia)
 */
export function parseDateObj(val: any): Date | null {
  if (!val && val !== 0) return null;
  if (val instanceof Date && !isNaN(val.getTime())) return val;

  let year = 2026;
  let month = 9; // 0-indexed (9 = Oktober)
  let day = 1;

  if (typeof val === 'number') {
    if (val > 10000 && val < 100000) {
      const d = new Date((val - 25569) * 86400 * 1000);
      return new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
    } else if (val > 1000000000000) {
      const d = new Date(val);
      return new Date(d.getFullYear(), d.getMonth(), d.getDate());
    }
    return null;
  }

  if (typeof val === 'string') {
    const trimmed = val.trim();
    if (
      !trimmed ||
      trimmed === '-' ||
      trimmed === '(kosong)' ||
      trimmed.toLowerCase() === 'belum ada' ||
      trimmed.toLowerCase() === 'null' ||
      trimmed.toLowerCase() === 'undefined'
    ) {
      return null;
    }

    const textMatch = trimmed.match(/^(\d{1,2})\s+([A-Za-z]+)\s*(\d{4})?/);
    if (textMatch) {
      day = parseInt(textMatch[1], 10);
      year = textMatch[3] ? parseInt(textMatch[3], 10) : 2026;
      const mStr = textMatch[2].toLowerCase();
      const mNames: Record<string, number> = {
        jan: 0, januari: 0, january: 0,
        feb: 1, februari: 1, february: 1,
        mar: 2, maret: 2, march: 2,
        apr: 3, april: 3,
        mei: 4, may: 4,
        jun: 5, juni: 5, june: 5,
        jul: 6, juli: 6, july: 6,
        agu: 7, agustus: 7, aug: 7, august: 7,
        sep: 8, september: 8,
        okt: 9, oktober: 9, oct: 9, october: 9,
        nov: 10, november: 10,
        des: 11, desember: 11, dec: 11, december: 11,
      };
      month = mNames[mStr.slice(0, 3)] ?? 9;
      return new Date(year, month, day);
    }

    const isoMatch = trimmed.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
    if (isoMatch) {
      return new Date(parseInt(isoMatch[1], 10), parseInt(isoMatch[2], 10) - 1, parseInt(isoMatch[3], 10));
    }

    const dmyMatch = trimmed.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})/);
    if (dmyMatch) {
      let y = parseInt(dmyMatch[3], 10);
      if (y < 100) y += 2000;
      return new Date(y, parseInt(dmyMatch[2], 10) - 1, parseInt(dmyMatch[1], 10));
    }

    const num = parseFloat(trimmed);
    if (!isNaN(num) && num > 10000 && num < 100000) {
      const d = new Date((num - 25569) * 86400 * 1000);
      return new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
    }

    const parsed = Date.parse(trimmed);
    if (!isNaN(parsed)) {
      const d = new Date(parsed);
      return new Date(d.getFullYear(), d.getMonth(), d.getDate());
    }
  }

  return null;
}

export function formatShortDate(d: Date | null): string {
  if (!d || isNaN(d.getTime())) return '-';
  const day = String(d.getDate()).padStart(2, '0');
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
  return `${day} ${months[d.getMonth()]}`;
}

/**
 * Kalkulasi Posisi Horizontal Bar Gantt Sesuai Kalender Bulan Berjalan
 * left = ((start_day - 1) / total_days_in_month) * 100%
 * width = ((end_day - start_day + 1) / total_days_in_month) * 100%
 */
export function calculateDateRangePosition(
  startDate: Date,
  endDate: Date,
  selectedPeriod: string = 'ALL'
): { left: number; width: number } {
  const sDate = startDate.getTime() <= endDate.getTime() ? startDate : endDate;
  const eDate = startDate.getTime() <= endDate.getTime() ? endDate : startDate;

  if (selectedPeriod !== 'ALL') {
    const targetMonth = parseInt(selectedPeriod, 10);
    const totalDays = new Date(2026, targetMonth, 0).getDate();

    const sMonth = sDate.getMonth() + 1;
    const eMonth = eDate.getMonth() + 1;

    let sDay = 1;
    let eDay = totalDays;

    if (sMonth === targetMonth) {
      sDay = sDate.getDate();
    } else if (sMonth > targetMonth) {
      return { left: 96.5, width: 3.5 };
    } else {
      sDay = 1;
    }

    if (eMonth === targetMonth) {
      eDay = eDate.getDate();
    } else if (eMonth < targetMonth) {
      return { left: 0, width: 3.5 };
    } else {
      eDay = totalDays;
    }

    sDay = Math.max(1, Math.min(totalDays, sDay));
    eDay = Math.max(sDay, Math.min(totalDays, eDay));

    const leftPercent = ((sDay - 1) / totalDays) * 100;
    const widthPercent = Math.max(((eDay - sDay + 1) / totalDays) * 100, 3.5);

    const clampedLeft = Math.max(0, Math.min(96.5, leftPercent));
    const clampedWidth = Math.min(100 - clampedLeft, widthPercent);

    return { left: clampedLeft, width: clampedWidth };
  } else {
    // Mode Multi-Month ALL (5 Bulan: Jun=6..Okt=10)
    const getPosPercent = (d: Date, isEnd: boolean = false): number => {
      let m = d.getMonth() + 1;
      let day = d.getDate();

      if (m < 6) {
        m = 6;
        day = 1;
      } else if (m > 10) {
        m = 10;
        day = 31;
      }

      const mIdx = m - 6;
      const daysInM = new Date(2026, m, 0).getDate();
      const dayOffset = isEnd ? day : day - 1;
      const frac = Math.max(0, Math.min(1, dayOffset / daysInM));

      return mIdx * 20 + frac * 20;
    };

    const sPos = getPosPercent(sDate, false);
    const ePos = getPosPercent(eDate, true);

    const left = Math.max(0, Math.min(96.5, sPos));
    const rawWidth = Math.max(3.5, ePos - sPos);
    const width = Math.min(100 - left, rawWidth);

    return { left, width };
  }
}

