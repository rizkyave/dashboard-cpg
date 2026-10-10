import { NextRequest, NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import { WorkOrderItem, WorkOrderSummary } from '@/types/workOrder';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const DEFAULT_WO_SHEET_URL =
  'https://docs.google.com/spreadsheets/d/1PCko1zSn1PNpK9kfnUp3CoMGeeKsxhycwBiUH78b9B4/edit?gid=687878754#gid=687878754';

function extractExportUrl(rawUrl: string): string {
  const trimmed = rawUrl.trim();
  const match = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (match && match[1]) {
    return `https://docs.google.com/spreadsheets/d/${match[1]}/export?format=xlsx`;
  }
  if (trimmed.includes('export?format=')) {
    return trimmed;
  }
  return trimmed;
}

function formatExcelDate(val: any): string {
  if (!val) return '';
  if (val instanceof Date) {
    if (isNaN(val.getTime())) return '';
    const d = String(val.getDate()).padStart(2, '0');
    const m = String(val.getMonth() + 1).padStart(2, '0');
    const y = val.getFullYear();
    return `${d}/${m}/${y}`;
  }
  if (typeof val === 'number') {
    const date = new Date((val - 25569) * 86400 * 1000);
    if (!isNaN(date.getTime())) {
      const d = String(date.getDate()).padStart(2, '0');
      const m = String(date.getMonth() + 1).padStart(2, '0');
      const y = date.getFullYear();
      return `${d}/${m}/${y}`;
    }
  }
  const str = String(val).trim();
  // If ISO string like 2026-06-11T07:31:14.000Z
  if (str.includes('T') && str.length >= 10) {
    const parsed = new Date(str);
    if (!isNaN(parsed.getTime())) {
      const d = String(parsed.getDate()).padStart(2, '0');
      const m = String(parsed.getMonth() + 1).padStart(2, '0');
      const y = parsed.getFullYear();
      return `${d}/${m}/${y}`;
    }
  }
  return str;
}

function getEpochMs(val: any): number {
  if (!val) return 0;
  if (val instanceof Date) return isNaN(val.getTime()) ? 0 : val.getTime();
  if (typeof val === 'number') {
    const d = new Date((val - 25569) * 86400 * 1000);
    return isNaN(d.getTime()) ? 0 : d.getTime();
  }
  const str = String(val).trim();
  if (str) {
    const d = new Date(str);
    if (!isNaN(d.getTime())) return d.getTime();
    const parts = str.split('/');
    if (parts.length === 3) {
      const day = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const year = parseInt(parts[2], 10);
      return new Date(year, month, day).getTime() || 0;
    }
  }
  return 0;
}

function normalizeStatus(st: any): string {
  if (!st) return 'Open';
  const s = String(st).trim().toLowerCase();
  if (s.includes('close')) return 'Close';
  if (s.includes('progress')) return 'On Progress';
  if (s.includes('open')) return 'Open';
  return String(st).trim();
}

async function processWorkOrderSheet(targetUrl: string) {
  const downloadUrl = extractExportUrl(targetUrl);

  const response = await fetch(downloadUrl, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      Accept:
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/octet-stream, */*',
    },
    cache: 'no-store',
    redirect: 'follow',
  });

  if (!response.ok) {
    return NextResponse.json(
      {
        success: false,
        message: `Gagal mengunduh file Google Sheets (HTTP Status ${response.status}: ${response.statusText}). Pastikan link Work Order memiliki izin akses Publik/Viewer.`,
      },
      { status: 400 }
    );
  }

  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  if (buffer.length < 500) {
    const textPreview = buffer.toString('utf8');
    if (
      textPreview.includes('<html') ||
      textPreview.includes('login') ||
      textPreview.includes('ServiceLogin')
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            'Akses ke Google Sheets ditolak / memerlukan login. Pastikan pengaturan share di Google Spreadsheet berstatus "Anyone with the link can view".',
        },
        { status: 403 }
      );
    }
  }

  const wb = XLSX.read(buffer, { type: 'buffer', cellDates: true });

  // Cari sheet 'Form Responses 1'
  let targetSheetName = wb.SheetNames.find(
    (name) =>
      name.toLowerCase().replace(/[\s_]+/g, '').includes('formresponse') ||
      name.toLowerCase().includes('form responses 1')
  );

  if (!targetSheetName) {
    // Fallback: cari sheet yang memiliki data dokumen WO
    targetSheetName = wb.SheetNames[0];
  }

  const ws = wb.Sheets[targetSheetName];
  if (!ws) {
    return NextResponse.json(
      {
        success: false,
        message: `Sheet "Form Responses 1" tidak ditemukan di dalam dokumen Google Spreadsheet.`,
      },
      { status: 404 }
    );
  }

  const rawRows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1 });
  if (!rawRows || rawRows.length < 2) {
    return NextResponse.json({
      success: true,
      items: [],
      summary: {
        total: 0,
        open: 0,
        onProgress: 0,
        close: 0,
        withFpb: 0,
        lastSynced: new Date().toISOString(),
      },
      message: 'Sheet Form Responses 1 kosong.',
    });
  }

  const headerRow = rawRows[0] || [];
  const headers = headerRow.map((h: any) => String(h || '').trim().toLowerCase());

  const colMap: Record<string, number> = {};
  headers.forEach((h: string, idx: number) => {
    if (h.includes('timestamp')) colMap.timestamp = idx;
    else if (h.includes('nomer dokumen') || h.includes('nomor dokumen') || h.includes('no. dokumen')) colMap.nomerDokumen = idx;
    else if (h.includes('tanggal order') || h.includes('tgl order')) colMap.tanggalOrder = idx;
    else if (h.includes('departemen/armada') || h.includes('departemen') || h.includes('armada')) colMap.departemen = idx;
    else if (h.includes('nama project') || h.includes('project')) colMap.project = idx;
    else if (h.includes('lokasi pekerjaan') || h.includes('lokasi')) colMap.lokasi = idx;
    else if (h.includes('mulai')) colMap.mulai = idx;
    else if (h.includes('mrp/fpb')) colMap.mrpFpb = idx;
    else if (h.includes('selesai')) colMap.selesai = idx;
    else if (h.includes('lka') || h.includes('lkk')) colMap.lka = idx;
    else if (h.includes('prioritas') || h.includes('urgency')) colMap.prioritas = idx;
    else if (h.includes('section')) colMap.section = idx;
    else if (h.includes('uraian singkat') || h.includes('uraian') || h.includes('permintaan')) colMap.uraian = idx;
    else if (h.includes('upload so/wo') || h.includes('so/wo')) colMap.uploadSoWo = idx;
    else if (h.includes('gap')) colMap.gap = idx;
    else if (h.includes('no. fpb/mrp') || h === 'fpb') {
      if (colMap.noFpb === undefined || h.includes('no. fpb/mrp')) colMap.noFpb = idx;
    }
    else if (h === 'status') colMap.status = idx;
    else if (h === 'progress') colMap.progress = idx;
    else if (h.includes('evidence') || h.includes('foto')) colMap.evidence = idx;
    else if (h === 'spk') colMap.spk = idx;
    else if (h === 'bast') colMap.bast = idx;
    else if (h === 'column 1') colMap.efpbPdf = idx;
  });

  const items: WorkOrderItem[] = [];
  let openCount = 0;
  let onProgressCount = 0;
  let closeCount = 0;
  let withFpbCount = 0;

  for (let i = 1; i < rawRows.length; i++) {
    const r = rawRows[i];
    if (!r || r.length === 0) continue;

    const docNo = String(r[colMap.nomerDokumen ?? 1] || '').trim();
    if (!docNo) continue;

    let fpbVal = String(r[colMap.noFpb ?? 15] || '').trim();
    // Fallback kolom terakhir jika index 15 kosong
    if ((!fpbVal || fpbVal === '-' || fpbVal === 'null') && r[23]) {
      fpbVal = String(r[23]).trim();
    }
    if (fpbVal === '-' || fpbVal === 'null') fpbVal = '';

    const rawStatus = r[colMap.status ?? 16];
    const status = normalizeStatus(rawStatus);

    if (status === 'Close') closeCount++;
    else if (status === 'On Progress') onProgressCount++;
    else openCount++;

    if (fpbVal) withFpbCount++;

    const rawProgress = r[colMap.progress ?? 17];
    let progress = 0;
    if (typeof rawProgress === 'number') {
      progress = rawProgress <= 1 ? Math.round(rawProgress * 100) : Math.round(rawProgress);
    } else if (rawProgress) {
      const num = parseFloat(String(rawProgress).replace('%', ''));
      if (!isNaN(num)) progress = num <= 1 ? Math.round(num * 100) : Math.round(num);
    }
    if (status === 'Close' && progress === 0) {
      progress = 100;
    }

    const rawTimestamp = r[colMap.timestamp ?? 0];
    const rawTanggalOrder = r[colMap.tanggalOrder ?? 2];
    const orderDateMs = getEpochMs(rawTanggalOrder);
    const timestampMs = getEpochMs(rawTimestamp);
    const efpbPdf = colMap.efpbPdf !== undefined ? String(r[colMap.efpbPdf] || '').trim() : '';

    items.push({
      id: `wo-${i}-${docNo.replace(/[^a-zA-Z0-9]/g, '-')}`,
      timestamp: formatExcelDate(rawTimestamp),
      nomerDokumen: docNo,
      tanggalOrder: formatExcelDate(rawTanggalOrder),
      departemenArmada: String(r[colMap.departemen ?? 3] || '').trim(),
      namaProject: String(r[colMap.project ?? 4] || '').trim(),
      lokasiPekerjaan: String(r[colMap.lokasi ?? 5] || '').trim(),
      tanggalMulai: formatExcelDate(r[colMap.mulai ?? 6]),
      tanggalMrpFpb: formatExcelDate(r[colMap.mrpFpb ?? 7]),
      tanggalSelesai: formatExcelDate(r[colMap.selesai ?? 8]),
      noLkaLkk: String(r[colMap.lka ?? 9] || '').trim(),
      scalaPrioritas: String(r[colMap.prioritas ?? 10] || '').trim(),
      section: String(r[colMap.section ?? 11] || '').trim(),
      uraianPerbaikan: String(r[colMap.uraian ?? 12] || '').trim(),
      uploadSoWoUrl: String(r[colMap.uploadSoWo ?? 13] || '').trim(),
      gapAnalysis: String(r[colMap.gap ?? 14] || '').trim(),
      noFpbMrp: fpbVal,
      status,
      progress,
      evidence: String(r[colMap.evidence ?? 18] || '').trim(),
      spk: String(r[colMap.spk ?? 19] || '').trim(),
      bastUrl: String(r[colMap.bast ?? 20] || '').trim(),
      efpbPdfUrl: efpbPdf,
      orderDateMs,
      timestampMs,
      rowIndex: i,
    });
  }

  // Urutkan default: data terbaru (paling akhir di Google Sheets) berada di posisi paling atas
  items.sort((a, b) => {
    const timeA = a.orderDateMs || 0;
    const timeB = b.orderDateMs || 0;
    if (timeA !== timeB) return timeB - timeA;
    const subA = a.timestampMs || a.rowIndex || 0;
    const subB = b.timestampMs || b.rowIndex || 0;
    return subB - subA;
  });

  const summary: WorkOrderSummary = {
    total: items.length,
    open: openCount,
    onProgress: onProgressCount,
    close: closeCount,
    withFpb: withFpbCount,
    lastSynced: new Date().toISOString(),
  };

  return NextResponse.json({
    success: true,
    sheetName: targetSheetName,
    items,
    summary,
    totalCount: items.length,
    lastSynced: summary.lastSynced,
  });
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const targetUrl = searchParams.get('url') || DEFAULT_WO_SHEET_URL;
    return await processWorkOrderSheet(targetUrl);
  } catch (err: any) {
    console.error('Error in GET /api/sync-work-order:', err);
    return NextResponse.json(
      { success: false, message: err?.message || 'Gagal memproses sinkronisasi Work Order.' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    let targetUrl = DEFAULT_WO_SHEET_URL;
    try {
      const body = await req.json();
      if (body?.url) {
        targetUrl = body.url;
      }
    } catch {
      // Default url
    }
    return await processWorkOrderSheet(targetUrl);
  } catch (err: any) {
    console.error('Error in POST /api/sync-work-order:', err);
    return NextResponse.json(
      { success: false, message: err?.message || 'Gagal memproses sinkronisasi Work Order.' },
      { status: 500 }
    );
  }
}

