import { StockTaliItem, StockTaliSummary } from '@/types/stockTali';

export const STOCK_TALI_SHEET_URL =
  'https://docs.google.com/spreadsheets/d/1Bou_dU7L8UWhDEjgBpPqtKnIqoF7wLQSUN2bnYbrp1I/edit?gid=2021352613#gid=2021352613';
export const STOCK_TALI_CSV_EXPORT_URL =
  'https://docs.google.com/spreadsheets/d/1Bou_dU7L8UWhDEjgBpPqtKnIqoF7wLQSUN2bnYbrp1I/export?format=csv&gid=2021352613';

export function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      inQuotes = !inQuotes;
    } else if (c === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += c;
    }
  }
  result.push(current.trim());
  return result;
}

export function parseCsvRows(text: string): StockTaliItem[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) return [];

  const startIndex = lines[0].toLowerCase().includes('laporan mutasi') ? 2 : 1;
  const items: StockTaliItem[] = [];

  for (let i = startIndex; i < lines.length; i++) {
    const cols = parseCSVLine(lines[i]);
    if (!cols || cols.length < 2) continue;
    const no = cols[0] || '';
    const pt = (cols[1] || '').trim().toUpperCase();
    const deptArmada = (cols[2] || '').trim();
    if (!no && !deptArmada && !pt) continue;

    items.push({
      no: no,
      pt: pt,
      deptArmada: deptArmada,
      noFpb: (cols[3] || '').trim(),
      picTtb: (cols[4] || '').trim().toUpperCase(),
      ttb: (cols[5] || '').trim(),
      tglInputTtb: (cols[6] || '').trim(),
      tglKeTimLapangan: (cols[7] || '').trim(),
      keterangan: (cols[8] || '').trim(),
      lapseDay1: (cols[9] || '').trim(),
      picLapangan: (cols[10] || '').trim().toUpperCase(),
      tglBarangDiantar: (cols[11] || '').trim(),
      keteranganAntar: (cols[12] || '').trim(),
      tglTimLapKePicTtb: (cols[13] || '').trim(),
      lapseDay2: (cols[14] || '').trim(),
      tglTtbKePicPch: (cols[15] || '').trim(),
      keteranganPch: (cols[16] || '').trim(),
      lapseDay3: (cols[17] || '').trim(),
    });
  }

  return items;
}

export function computeSummary(items: StockTaliItem[]): StockTaliSummary {
  const armadas = new Set<string>();
  const pts = new Set<string>();
  const ptCounts: Record<string, number> = {};
  const picTtbCounts: Record<string, number> = {};
  const picLapCounts: Record<string, number> = {};

  let terkirim = 0;
  let kembaliTtb = 0;
  let tutupPch = 0;

  for (const it of items) {
    if (it.deptArmada) armadas.add(it.deptArmada);
    if (it.pt) {
      pts.add(it.pt);
      ptCounts[it.pt] = (ptCounts[it.pt] || 0) + 1;
    }
    if (it.picTtb) {
      picTtbCounts[it.picTtb] = (picTtbCounts[it.picTtb] || 0) + 1;
    }
    if (it.picLapangan) {
      picLapCounts[it.picLapangan] = (picLapCounts[it.picLapangan] || 0) + 1;
    }

    if (it.tglBarangDiantar && it.tglBarangDiantar !== '-' && it.tglBarangDiantar !== '/') {
      terkirim++;
    }
    if (it.tglTimLapKePicTtb && it.tglTimLapKePicTtb !== '-' && it.tglTimLapKePicTtb !== '/') {
      kembaliTtb++;
    }
    if (it.tglTtbKePicPch && it.tglTtbKePicPch !== '-' && it.tglTtbKePicPch !== '/') {
      tutupPch++;
    }
  }

  return {
    totalItems: items.length,
    totalArmada: armadas.size,
    totalEntitas: pts.size,
    terkirimLapangan: terkirim,
    kembaliKeTtb: kembaliTtb,
    tutupSiklusPch: tutupPch,
    dalamProses: Math.max(0, items.length - terkirim),
    ptCounts,
    picTtbCounts,
    picLapCounts,
  };
}

