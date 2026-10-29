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

/**
 * Cross-reference & enrich Budi TTB records with official system document relations
 * (No. FPB Acuan, No. PO, No. FSTB) from doc-relation-reference.json.
 */
function enrichBudiRecords(records: BudiTtbRecord[]): BudiTtbRecord[] {
  let docRel: any = null;
  try {
    const docRelPath = path.join(process.cwd(), 'src', 'data', 'doc-relation-reference.json');
    if (fs.existsSync(docRelPath)) {
      docRel = JSON.parse(fs.readFileSync(docRelPath, 'utf8'));
    }
  } catch (err) {
    console.warn('[sync-budi-stock] Gagal membaca doc-relation-reference:', err);
  }

  if (!docRel) return records;

  function getPrefix(str?: string): string {
    if (!str) return '';
    const m = str.trim().toUpperCase().match(/^([A-Z]{2,6})/);
    return m ? m[1] : '';
  }

  function cleanArmada(str?: string): string {
    if (!str) return '';
    return str
      .toUpperCase()
      .replace(/^(TK|TB|BG|MT|SPOB|HOPPER BARGE|BARGE|SV|TRUCK TANKI|TRUCK|MOBIL|SITE)\s+/i, '')
      .replace(/[^A-Z0-9]/g, '');
  }

  const fpbByTtbArray = new Map<string, { fpb: string; po: string; fstb: string; prefix: string }>();
  if (docRel.byFpb) {
    Object.entries(docRel.byFpb).forEach(([fpbNum, fpbData]: [string, any]) => {
      const fpbPrefix = getPrefix(fpbNum);
      if (fpbData.ttbs && Array.isArray(fpbData.ttbs)) {
        fpbData.ttbs.forEach((t: string) => {
          const ttbPrefix = getPrefix(t) || fpbPrefix;
          const fullKey = t.trim().toUpperCase();
          const info = {
            fpb: fpbNum,
            po: fpbData.pos?.[0] || '',
            fstb: fpbData.fstbs?.[0] || '',
            prefix: fpbPrefix,
          };
          fpbByTtbArray.set(fullKey, info);

          const m = t.match(/26-0*(\d+)/);
          if (m) {
            const padKey = `${ttbPrefix}-26${m[1].padStart(5, '0')}`;
            fpbByTtbArray.set(padKey, info);
          }
        });
      }
    });
  }

  return records.map((r) => {
    let fpb = r.noFpb && r.noFpb !== '-' ? r.noFpb : '';
    let po = r.noPo || '';
    let fstb = r.noFstb || '';
    let isEnriched = r.isEnriched || false;

    const rawTtb = (r.ttbAccurate || '').trim().toUpperCase();
    const targetPrefix = getPrefix(rawTtb) || getPrefix(r.pt) || 'CPL';

    if (!fpb && rawTtb) {
      const m = rawTtb.match(/26-0*(\d+)/);
      const seq = m ? parseInt(m[1], 10) : 0;
      const paddedKey = m ? `26${m[1].padStart(5, '0')}` : '';
      const normKey = m ? `26${m[1]}` : '';

      // 1. Direct lookup in byTtb
      const entry =
        docRel.byTtb?.[rawTtb] ||
        (paddedKey ? docRel.byTtb?.[paddedKey] : undefined) ||
        (normKey ? docRel.byTtb?.[normKey] : undefined);

      if (entry && entry.fpb && getPrefix(entry.fpb) === targetPrefix) {
        fpb = entry.fpb;
        po = entry.po || po;
        fstb = entry.fstb || fstb;
        isEnriched = true;
      }

      // 2. Lookup in byFpb ttbs array
      if (!fpb && fpbByTtbArray.size > 0) {
        const f =
          fpbByTtbArray.get(rawTtb) ||
          (paddedKey ? fpbByTtbArray.get(`${targetPrefix}-${paddedKey}`) : undefined);
        if (f && f.fpb && f.prefix === targetPrefix) {
          fpb = f.fpb;
          po = f.po || po;
          fstb = f.fstb || fstb;
          isEnriched = true;
        }
      }

      // 3. Adjacent TTB sequence lookup (+- 1 to 5) with armada matching
      if (!fpb && seq > 0 && docRel.byTtb) {
        const armClean = cleanArmada(r.deptArmada);
        if (armClean) {
          for (const offset of [-1, 1, -2, 2, -3, 3, -4, 4, -5, 5]) {
            const adjSeq = seq + offset;
            const adjKey = `26${String(adjSeq).padStart(5, '0')}`;
            const adjEntry = docRel.byTtb[adjKey];
            if (adjEntry && adjEntry.fpb && getPrefix(adjEntry.fpb) === targetPrefix) {
              const adjArmClean = cleanArmada(adjEntry.armada);
              if (adjArmClean && (adjArmClean.includes(armClean) || armClean.includes(adjArmClean))) {
                fpb = adjEntry.fpb;
                po = adjEntry.po || po;
                fstb = adjEntry.fstb || fstb;
                isEnriched = true;
                break;
              }
            }
          }
        }
      }
    }

    return {
      ...r,
      noFpb: fpb || '-',
      noPo: po || undefined,
      noFstb: fstb || undefined,
      isEnriched,
    };
  });
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

  // Cross-reference & enrich records with system relations
  const enrichedRecords = enrichBudiRecords(records);

  // Summary calculations
  const totalRecords = enrichedRecords.length;
  const uniqueArmada = new Set(enrichedRecords.map((r) => r.deptArmada.toUpperCase().trim()).filter(Boolean));
  const totalTerkirim = enrichedRecords.filter((r) => r.statusPengantaran === 'TERKIRIM').length;
  const totalDalamProses = totalRecords - totalTerkirim;

  const ptBreakdown: Record<string, number> = {};
  enrichedRecords.forEach((r) => {
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

  return { records: enrichedRecords, summary };
}

function loadFromLocalCache(): { records: BudiTtbRecord[]; summary: BudiSyncSummary } | null {
  try {
    if (fs.existsSync(CACHE_FILE_PATH)) {
      const raw = fs.readFileSync(CACHE_FILE_PATH, 'utf-8');
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.records) && parsed.records.length > 0) {
        return {
          ...parsed,
          records: enrichBudiRecords(parsed.records),
        };
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
