import { NextRequest, NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import fs from 'fs';
import path from 'path';
import {
  CheckFpbRecord,
  BU_NOOR_SHEET_GID,
  MELINDA_SHEET_GID,
  BU_NOOR_SHEET_URL,
  MELINDA_SHEET_URL,
  DEFAULT_CHECK_FPB_SPREADSHEET_URL,
} from '@/types/checkFpbSync';
import {
  normalizeFpbKeyForCheck,
  extractCheckFpbCandidates,
  getDefaultCheckFpbUrl,
} from '@/utils/checkFpbStorage';
import { isR2Configured, uploadToR2 } from '@/utils/r2Client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

const CACHE_FILE_PATH = path.join(process.cwd(), 'src', 'data', 'check-fpb-data.json');
const R2_CACHE_KEY = 'dashboard-metadata/check-fpb-data.json';

function formatDate(val: any): string {
  if (!val) return '';
  if (typeof val === 'number') {
    const d = new Date(Math.round((val - 25569) * 86400 * 1000));
    if (!isNaN(d.getTime())) {
      const y = d.getUTCFullYear();
      const m = String(d.getUTCMonth() + 1).padStart(2, '0');
      const day = String(d.getUTCDate()).padStart(2, '0');
      return `${day}/${m}/${y}`;
    }
  }
  const s = String(val).trim();
  if (s === '/' || s === '-') return '';
  return s;
}

function loadCachedData(): {
  summary: any;
  records: Record<string, CheckFpbRecord>;
} | null {
  try {
    if (fs.existsSync(CACHE_FILE_PATH)) {
      const raw = fs.readFileSync(CACHE_FILE_PATH, 'utf8');
      return JSON.parse(raw);
    }
  } catch (err) {
    console.warn('Gagal membaca cache check-fpb-data.json:', err);
  }
  return null;
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const fpbQuery = searchParams.get('fpb')?.trim();
    const entityQuery = searchParams.get('entity')?.trim();

    const cached = loadCachedData();

    if (fpbQuery) {
      const candidates = extractCheckFpbCandidates(fpbQuery, entityQuery);
      let matchedRecord: CheckFpbRecord | null = null;

      if (cached && cached.records) {
        for (const cand of candidates) {
          if (cached.records[cand]) {
            matchedRecord = cached.records[cand];
            break;
          }
        }
      }

      const fallback = getDefaultCheckFpbUrl(fpbQuery);

      return NextResponse.json({
        success: true,
        matched: Boolean(matchedRecord),
        record: matchedRecord || {
          fpb: fpbQuery,
          tglFpb: '',
          armada: '',
          tglCek: '',
          statusCek: 'CLOSE',
          tglApproveWeb: '',
          done: 'DONE',
          note: '',
          checker: fallback.checker,
          checkerLabel: fallback.label,
          sourceSheet: fallback.sourceSheet,
          sheetGid: fallback.gid,
          sheetUrl: fallback.url,
          rowNumber: 0,
        },
        fallback,
      });
    }

    // Return general stats
    return NextResponse.json({
      success: true,
      summary: cached?.summary || {
        totalRecords: 0,
        totalNoor: 0,
        totalMelinda: 0,
        lastSyncedAt: null,
        sourceSpreadsheetUrl: DEFAULT_CHECK_FPB_SPREADSHEET_URL,
      },
    });
  } catch (err: any) {
    console.error('Error in GET /api/sync-check-fpb:', err);
    return NextResponse.json(
      { success: false, message: err?.message || 'Gagal memuat data verifikasi FPB.' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    let targetSpreadsheetUrl = DEFAULT_CHECK_FPB_SPREADSHEET_URL;
    try {
      const body = await req.json();
      if (body?.url) targetSpreadsheetUrl = body.url;
    } catch {
      // Default
    }

    const match = targetSpreadsheetUrl.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    const spreadsheetId = match ? match[1] : '1Bou_dU7L8UWhDEjgBpPqtKnIqoF7wLQSUN2bnYbrp1I';
    const downloadUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=xlsx`;

    const res = await fetch(downloadUrl, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, */*',
      },
      cache: 'no-store',
    });

    if (!res.ok) {
      return NextResponse.json(
        { success: false, message: `Gagal mengunduh spreadsheet dari Google (HTTP ${res.status}).` },
        { status: 502 }
      );
    }

    const arrayBuffer = await res.arrayBuffer();
    const workbook = XLSX.read(Buffer.from(arrayBuffer), { type: 'buffer' });

    const records: Record<string, CheckFpbRecord> = {};
    let totalNoor = 0;
    let totalMelinda = 0;

    // 1. Bu Noor (gid: 76614569)
    const wsNoor = workbook.Sheets['FBP CHECK BU NOOR'];
    if (wsNoor) {
      const jsonNoor: any[][] = XLSX.utils.sheet_to_json(wsNoor, { header: 1 });
      for (let i = 3; i < jsonNoor.length; i++) {
        const r = jsonNoor[i];
        if (!r) continue;
        const fpb = String(r[1] || '').trim();
        if (!fpb || fpb === '-' || fpb === '/') continue;
        const norm = normalizeFpbKeyForCheck(fpb);
        if (!norm) continue;

        const record: CheckFpbRecord = {
          fpb,
          tglFpb: formatDate(r[0]),
          armada: String(r[2] || '').trim(),
          tglCek: formatDate(r[3]),
          statusCek: String(r[4] || '').trim(),
          tglApproveWeb: formatDate(r[5]),
          done: String(r[6] || '').trim(),
          note: String(r[7] || '').trim(),
          checker: 'NOOR HASANAH',
          checkerLabel: 'Bu Noor',
          sourceSheet: 'FBP CHECK BU NOOR',
          sheetGid: BU_NOOR_SHEET_GID as any,
          sheetUrl: BU_NOOR_SHEET_URL,
          rowNumber: i + 1,
        };

        records[norm] = record;

        const digitsMatch = fpb.match(/(\d+)$/);
        if (digitsMatch) {
          const digits = digitsMatch[1];
          const trimmed = digits.replace(/^0+/, '');
          const prefixMatch = fpb.match(/^([A-Z]{2,6})/i);
          if (prefixMatch) {
            const pt = prefixMatch[1].toUpperCase();
            records[`${pt}_${digits}`] = record;
            if (trimmed) records[`${pt}_${trimmed}`] = record;
          }
        }
        totalNoor++;
      }
    }

    // 2. Melinda (gid: 1411569542)
    const wsMelinda = workbook.Sheets['FBP CHECK MELINDA'];
    if (wsMelinda) {
      const jsonMelinda: any[][] = XLSX.utils.sheet_to_json(wsMelinda, { header: 1 });
      for (let i = 3; i < jsonMelinda.length; i++) {
        const r = jsonMelinda[i];
        if (!r) continue;
        const fpb = String(r[1] || '').trim();
        if (!fpb || fpb === '-' || fpb === '/') continue;
        const norm = normalizeFpbKeyForCheck(fpb);
        if (!norm) continue;

        const record: CheckFpbRecord = {
          fpb,
          tglFpb: formatDate(r[0]),
          armada: String(r[2] || '').trim(),
          tglCek: formatDate(r[3]),
          statusCek: String(r[4] || '').trim(),
          tglApproveWeb: formatDate(r[5]),
          done: String(r[6] || '').trim(),
          note: String(r[7] || '').trim(),
          checker: 'MELINDA DWI PUTRI',
          checkerLabel: 'Bu Melinda',
          sourceSheet: 'FBP CHECK MELINDA',
          sheetGid: MELINDA_SHEET_GID as any,
          sheetUrl: MELINDA_SHEET_URL,
          rowNumber: i + 1,
        };

        records[norm] = record;

        const digitsMatch = fpb.match(/(\d+)$/);
        if (digitsMatch) {
          const digits = digitsMatch[1];
          const trimmed = digits.replace(/^0+/, '');
          const prefixMatch = fpb.match(/^([A-Z]{2,6})/i);
          if (prefixMatch) {
            const pt = prefixMatch[1].toUpperCase();
            records[`${pt}_${digits}`] = record;
            if (trimmed) records[`${pt}_${trimmed}`] = record;
          }
        }
        totalMelinda++;
      }
    }

    const payload = {
      summary: {
        totalRecords: Object.keys(records).length,
        totalNoor,
        totalMelinda,
        lastSyncedAt: new Date().toISOString(),
        sourceSpreadsheetUrl: targetSpreadsheetUrl,
      },
      records,
      savedAt: new Date().toISOString(),
    };

    try {
      fs.writeFileSync(CACHE_FILE_PATH, JSON.stringify(payload, null, 2), 'utf8');
    } catch (saveErr) {
      console.warn('Gagal menyimpan file cache lokal check-fpb-data.json:', saveErr);
    }

    if (isR2Configured()) {
      try {
        await uploadToR2({
          key: R2_CACHE_KEY,
          body: Buffer.from(JSON.stringify(payload), 'utf8'),
          contentType: 'application/json',
        });
      } catch (r2Err) {
        console.warn('Gagal upload check-fpb-data.json ke R2:', r2Err);
      }
    }

    return NextResponse.json({
      success: true,
      message: `Berhasil menyinkronkan data verifikasi FPB (${totalNoor} Bu Noor + ${totalMelinda} Melinda = ${Object.keys(records).length} keys)!`,
      summary: payload.summary,
    });
  } catch (err: any) {
    console.error('Error in POST /api/sync-check-fpb:', err);
    return NextResponse.json(
      { success: false, message: err?.message || 'Gagal menyinkronkan data Google Sheet verifikasi FPB.' },
      { status: 500 }
    );
  }
}

