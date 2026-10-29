import { NextRequest, NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import fs from 'fs';
import path from 'path';
import { BudiTtbRecord, BudiSyncSummary } from '@/types/budiStockSync';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

const DEFAULT_BUDI_SHEET_URL =
  'https://docs.google.com/spreadsheets/d/1Bou_dU7L8UWhDEjgBpPqtKnIqoF7wLQSUN2bnYbrp1I/edit?gid=1826916113#gid=1826916113';

const CACHE_FILE_PATH = path.join(process.cwd(), 'src', 'data', 'budi-ttb-sync-data.json');

function extractExportUrl(rawUrl: string): string {
  const trimmed = rawUrl.trim();
  const match = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (match && match[1]) {
    return `https://docs.google.com/spreadsheets/d/${match[1]}/export?format=xlsx`;
  }
  return trimmed;
}

function formatExcelDate(val: any): string {
  if (!val) return '';
  if (typeof val === 'number') {
    // Excel serial date (e.g. 46204 -> 2026-07-01)
    const date = new Date(Math.round((val - 25569) * 86400 * 1000));
    if (!isNaN(date.getTime())) {
      const y = date.getUTCFullYear();
      const m = String(date.getUTCMonth() + 1).padStart(2, '0');
      const d = String(date.getUTCDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    }
  }
  const str = String(val).trim();
  if (str === '/' || str === '-') return '';

  // Handle formats like "1/7/2026" or "01/07/2026"
  const parts = str.split('/');
  if (parts.length === 3) {
    const d = parts[0].padStart(2, '0');
    const m = parts[1].padStart(2, '0');
    let y = parts[2];
    if (y.length === 2) y = `20${y}`;
    return `${y}-${m}-${d}`;
  }

  return str;
}

function parseBudiSheets(wb: XLSX.WorkBook, sourceUrl: string): { records: BudiTtbRecord[]; summary: BudiSyncSummary } {
  const records: BudiTtbRecord[] = [];
  const targetSheets = ['STOCK GUDANG PAK BUDI', 'STOCK TALI'];

  for (const sheetName of targetSheets) {
    const sheet = wb.Sheets[sheetName];
    if (!sheet) continue;

    const rawRows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });
    if (!rawRows || rawRows.length < 2) continue;

    // Header is usually row index 1
    // Data starts at row index 2
    for (let i = 2; i < rawRows.length; i++) {
      const row = rawRows[i];
      if (!row || row.length === 0) continue;

      const pt = String(row[1] || '').trim();
      const deptArmada = String(row[2] || '').trim();
      const noFpb = String(row[3] || '').trim();
      const picTtb = String(row[4] || '').trim();
      const ttbAccurate = String(row[5] || '').trim();

      // Skip row if it doesn't have an armada/unit or TTB
      if (!deptArmada && !ttbAccurate && !pt) continue;

      const tanggalInputTtb = formatExcelDate(row[6]);
      const tanggalKeTimLapangan = formatExcelDate(row[7]);
      const keteranganLapangan = String(row[8] || '').trim();
      const lapseDayLapangan = row[9] !== undefined ? row[9] : '';
      const picLapangan = String(row[10] || '').trim();
      const tanggalBarangDiantar = formatExcelDate(row[11]);
      const keteranganDiantar = String(row[12] || '').trim();
      const tanggalTimLapKePicTtb = formatExcelDate(row[13]);
      const lapseDayTtb = row[14] !== undefined ? row[14] : '';
      const tanggalTtbKePicPch = formatExcelDate(row[15]);
      const keteranganPch = String(row[16] || '').trim();
      const lapseDayPch = row[17] !== undefined ? row[17] : '';

      let statusPengantaran: 'TERKIRIM' | 'DALAM_PENGANTARAN' | 'PROSES_GUDANG' = 'PROSES_GUDANG';
      if (tanggalBarangDiantar) {
        statusPengantaran = 'TERKIRIM';
      } else if (tanggalKeTimLapangan) {
        statusPengantaran = 'DALAM_PENGANTARAN';
      }

      records.push({
        id: ttbAccurate || `TTB-BUDI-${sheetName === 'STOCK TALI' ? 'TALI' : 'GDG'}-${i}`,
        no: Number(row[0]) || records.length + 1,
        pt: pt || 'CPL',
        deptArmada: deptArmada || 'OPERASIONAL',
        noFpb: noFpb || '-',
        picTtb: picTtb || 'BUDI / LOGISTIK',
        ttbAccurate: ttbAccurate || '-',
        tanggalInputTtb,
        tanggalKeTimLapangan,
        keteranganLapangan,
        lapseDayLapangan,
        picLapangan,
        tanggalBarangDiantar,
        keteranganDiantar,
        tanggalTimLapKePicTtb,
        lapseDayTtb,
        tanggalTtbKePicPch,
        keteranganPch,
        lapseDayPch,
        statusPengantaran,
        sumberSheet: sheetName as any,
      });
    }
  }

  // Summary calculations
  const totalRecords = records.length;
  const uniqueArmada = new Set(records.map((r) => r.deptArmada.toUpperCase().trim()).filter(Boolean));
  const totalTerkirim = records.filter((r) => r.statusPengantaran === 'TERKIRIM').length;
  const totalDalamProses = totalRecords - totalTerkirim;

  const ptBreakdown: Record<string, number> = {};
  records.forEach((r) => {
    const code = r.pt.toUpperCase().trim() || 'LAINNYA';
    ptBreakdown[code] = (ptBreakdown[code] || 0) + 1;
  });

  const summary: BudiSyncSummary = {
    totalRecords,
    totalArmada: uniqueArmada.size,
    totalTerkirim,
    totalDalamProses,
    ptBreakdown,
    lastSyncedAt: new Date().toISOString(),
    sourceUrl,
  };

  return { records, summary };
}

function loadFromLocalCache(): { records: BudiTtbRecord[]; summary: BudiSyncSummary } | null {
  try {
    if (fs.existsSync(CACHE_FILE_PATH)) {
      const raw = fs.readFileSync(CACHE_FILE_PATH, 'utf-8');
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.records) && parsed.records.length > 0) {
        return parsed;
      }
    }
  } catch (err) {
    console.warn('Gagal membaca cache budi-ttb-sync-data.json:', err);
  }
  return null;
}

function saveToLocalCache(records: BudiTtbRecord[], summary: BudiSyncSummary): void {
  try {
    const payload = {
      records,
      summary,
      savedAt: new Date().toISOString(),
    };
    fs.writeFileSync(CACHE_FILE_PATH, JSON.stringify(payload, null, 2), 'utf-8');
  } catch (err) {
    console.warn('Gagal menyimpan cache budi-ttb-sync-data.json:', err);
  }
}

async function fetchAndProcess(targetUrl: string) {
  const exportUrl = extractExportUrl(targetUrl);

  const response = await fetch(exportUrl, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      Accept:
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/octet-stream, */*',
    },
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error(`Google Sheets export returned status ${response.status}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  const wb = XLSX.read(new Uint8Array(arrayBuffer), { type: 'array' });
  const result = parseBudiSheets(wb, targetUrl);

  // Save to local cache
  saveToLocalCache(result.records, result.summary);

  return result;
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const forceReload = searchParams.get('force') === 'true';
    const targetUrl = searchParams.get('url') || DEFAULT_BUDI_SHEET_URL;

    if (!forceReload) {
      const cached = loadFromLocalCache();
      if (cached) {
        return NextResponse.json({
          success: true,
          fromCache: true,
          records: cached.records,
          summary: cached.summary,
          count: cached.records.length,
        });
      }
    }

    // Live fetch
    const { records, summary } = await fetchAndProcess(targetUrl);
    return NextResponse.json({
      success: true,
      fromCache: false,
      records,
      summary,
      count: records.length,
    });
  } catch (err: any) {
    console.error('Error in GET /api/sync-budi-stock:', err);
    // Fallback to cache if available
    const cached = loadFromLocalCache();
    if (cached) {
      return NextResponse.json({
        success: true,
        fromCache: true,
        fallbackError: err?.message,
        records: cached.records,
        summary: cached.summary,
        count: cached.records.length,
      });
    }

    return NextResponse.json(
      { success: false, error: err?.message || 'Gagal sinkronisasi data TTB Pak Budi dari Google Sheet' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    let targetUrl = DEFAULT_BUDI_SHEET_URL;
    try {
      const body = await req.json();
      if (body?.url) targetUrl = body.url;
    } catch {
      // Default
    }

    const { records, summary } = await fetchAndProcess(targetUrl);
    return NextResponse.json({
      success: true,
      message: `Berhasil menyinkronkan ${records.length} data mutasi TTB Pak Budi dari Google Sheet!`,
      records,
      summary,
      count: records.length,
    });
  } catch (err: any) {
    console.error('Error in POST /api/sync-budi-stock:', err);
    return NextResponse.json(
      { success: false, error: err?.message || 'Gagal menyinkronkan Google Sheet TTB Pak Budi' },
      { status: 500 }
    );
  }
}

