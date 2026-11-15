/**
 * Helper untuk menentukan keselarasan tanggal FPB terhadap siklus mingguan (Cut-Off Jumat Pk 10:00 WITA)
 */

export interface FpbCycleAlignment {
  isPastCycle: boolean;
  daysLate: number;
  originalBatchSeq: number;
  originalBatchName: string;
  originalBatchCode: string;
  cycleStartDate: Date;
  cycleCutoffDate: Date;
  description: string;
}

export function parseFpbDate(dStr?: string): Date | null {
  if (!dStr) return null;
  const s = dStr.trim();
  // 1. DD/MM/YYYY or DD-MM-YYYY or DD/MM/YY
  const m1 = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
  if (m1) {
    const day = parseInt(m1[1], 10);
    const month = parseInt(m1[2], 10) - 1;
    let year = parseInt(m1[3], 10);
    if (year < 100) year += 2000;
    return new Date(year, month, day);
  }
  // 2. YYYY-MM-DD
  const m2 = s.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/);
  if (m2) {
    return new Date(parseInt(m2[1], 10), parseInt(m2[2], 10) - 1, parseInt(m2[3], 10));
  }
  // 3. Indonesian month names: "3 Nop 2026", "3 November 2026", "03 Nopember 2026"
  const monthMap: Record<string, number> = {
    jan: 0, januari: 0,
    feb: 1, februari: 1,
    mar: 2, maret: 2,
    apr: 3, april: 3,
    mei: 4, may: 4,
    jun: 5, juni: 5,
    jul: 6, juli: 6,
    agu: 7, agustus: 7, aug: 7,
    sep: 8, september: 8,
    okt: 9, oktober: 9, oct: 9,
    nop: 10, november: 10, nov: 10,
    des: 11, desember: 11, dec: 11,
  };
  const m3 = s.match(/^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})$/);
  if (m3) {
    const day = parseInt(m3[1], 10);
    const monStr = m3[2].toLowerCase();
    const year = parseInt(m3[3], 10);
    const mon = monthMap[monStr];
    if (mon !== undefined) {
      return new Date(year, mon, day);
    }
  }
  const parsed = new Date(s);
  return isNaN(parsed.getTime()) ? null : parsed;
}

export function toRomanNumeral(num: number): string {
  if (num <= 0) return 'I';
  const romanMap: [number, string][] = [
    [100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'],
    [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']
  ];
  let res = '';
  let n = num;
  for (const [val, sym] of romanMap) {
    while (n >= val) {
      res += sym;
      n -= val;
    }
  }
  return res || String(num);
}

export function checkFpbCycleAlignment(
  fpbDateStr?: string,
  now: Date = new Date(),
  currentBatchSeq: number = 3
): FpbCycleAlignment {
  const currentYear = now.getFullYear();

  // Tentukan cut-off Jumat jam 10:00:00 untuk siklus aktif saat ini
  const day = now.getDay(); // 0 = Minggu, 5 = Jumat
  const cutoff = new Date(now);
  cutoff.setHours(10, 0, 0, 0);

  const targetCutoff = new Date(cutoff);
  if (day === 5) {
    if (now.getTime() >= cutoff.getTime()) {
      targetCutoff.setDate(targetCutoff.getDate() + 7);
    }
  } else if (day < 5) {
    targetCutoff.setDate(targetCutoff.getDate() + (5 - day));
  } else {
    targetCutoff.setDate(targetCutoff.getDate() + 6);
  }

  // Siklus aktif dimulai persis setelah cut-off Jumat sebelumnya (7 hari sebelum targetCutoff)
  const cycleStart = new Date(targetCutoff);
  cycleStart.setDate(cycleStart.getDate() - 7);

  const fDate = parseFpbDate(fpbDateStr);
  if (!fDate) {
    return {
      isPastCycle: false,
      daysLate: 0,
      originalBatchSeq: currentBatchSeq,
      originalBatchName: `Batch ${toRomanNumeral(currentBatchSeq)}`,
      originalBatchCode: `CPG-PP-${currentYear}-B${String(currentBatchSeq).padStart(2, '0')}`,
      cycleStartDate: cycleStart,
      cycleCutoffDate: targetCutoff,
      description: 'Format tanggal tidak terdeteksi, diasumsikan reguler.',
    };
  }

  const cycleStartDayStart = new Date(cycleStart.getFullYear(), cycleStart.getMonth(), cycleStart.getDate()).getTime();
  const fpbDayStart = new Date(fDate.getFullYear(), fDate.getMonth(), fDate.getDate()).getTime();

  const isPast = fpbDayStart < cycleStartDayStart;

  let daysLate = 0;
  let originalBatchSeq = currentBatchSeq;

  if (isPast) {
    daysLate = Math.max(1, Math.round((cycleStartDayStart - fpbDayStart) / (24 * 3600 * 1000)));
    const weeksAgo = Math.ceil(daysLate / 7);
    originalBatchSeq = Math.max(1, currentBatchSeq - weeksAgo);
  }

  const originalBatchName = `Batch ${toRomanNumeral(originalBatchSeq)}`;
  const originalBatchCode = `CPG-PP-${fDate.getFullYear()}-B${String(originalBatchSeq).padStart(2, '0')}`;

  return {
    isPastCycle: isPast,
    daysLate,
    originalBatchSeq,
    originalBatchName,
    originalBatchCode,
    cycleStartDate: cycleStart,
    cycleCutoffDate: targetCutoff,
    description: isPast
      ? `Tertanggal ${fpbDateStr}. Asal siklus: ${originalBatchName} (terlambat ${daysLate} hari dari siklus Batch ${toRomanNumeral(currentBatchSeq)}).`
      : `Sesuai siklus berjalan (Batch ${toRomanNumeral(currentBatchSeq)}).`,
  };
}
