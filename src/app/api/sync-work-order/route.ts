import { NextRequest, NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import { WorkOrderItem, WorkOrderSummary } from '@/types/workOrder';
import {
  isR2Configured,
  getObjectFromR2,
  uploadToR2,
} from '@/utils/r2Client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

const DEFAULT_WO_SHEET_URL =
  'https://docs.google.com/spreadsheets/d/1PCko1zSn1PNpK9kfnUp3CoMGeeKsxhycwBiUH78b9B4/edit?gid=687878754#gid=687878754';
const R2_WO_KEY = 'dashboard-metadata/work-orders.json';

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

function findHeaderRow(rawRows: any[][]): { headerRowIndex: number; headers: string[] } {
  for (let i = 0; i < Math.min(15, rawRows.length); i++) {
    const row = rawRows[i];
    if (!row || !Array.isArray(row)) continue;
    const line = row.map((c) => String(c || '').trim().toLowerCase()).join(' ');
    if (
      line.includes('work order') ||
      line.includes('nomer dokumen') ||
      line.includes('nomor dokumen') ||
      line.includes('no. dokumen') ||
      line.includes('tgl wo masuk') ||
      line.includes('timestamp')
    ) {
      return {
        headerRowIndex: i,
        headers: row.map((c) => String(c || '').trim().toLowerCase()),
      };
    }
  }
  return {
    headerRowIndex: 0,
    headers: (rawRows[0] || []).map((c: any) => String(c || '').trim().toLowerCase()),
  };
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

  // Deteksi target sheet:
  // Jika targetUrl memiliki GID 687878754 atau sheet 'Dashboard' tersedia di workbook, gunakan 'Dashboard' sebagai sumber utama.
  const gidMatch = targetUrl.match(/[#&?]gid=([0-9]+)/);
  const targetGid = gidMatch ? gidMatch[1] : null;

  let targetSheetName = '';
  if (targetGid === '687878754' || !targetGid) {
    targetSheetName = wb.SheetNames.find((name) => name.toLowerCase() === 'dashboard') || '';
  }
  if (!targetSheetName) {
    targetSheetName =
      wb.SheetNames.find((name) => name.toLowerCase() === 'dashboard') ||
      wb.SheetNames.find((name) =>
        name.toLowerCase().replace(/[\s_]+/g, '').includes('formresponse') ||
        name.toLowerCase().includes('form responses 1')
      ) ||
      wb.SheetNames[0];
  }

  const ws = wb.Sheets[targetSheetName];
  if (!ws) {
    return NextResponse.json(
      {
        success: false,
        message: `Sheet "${targetSheetName}" tidak ditemukan di dalam dokumen Google Spreadsheet.`,
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
      message: `Sheet ${targetSheetName} kosong.`,
    });
  }

  // Cari baris header secara dinamis (misal baris index 3 untuk Dashboard atau index 0 untuk Form Responses 1)
  const { headerRowIndex, headers } = findHeaderRow(rawRows);

  const colMap: Record<string, number> = {};
  headers.forEach((h: string, idx: number) => {
    const clean = h.trim().toLowerCase();
    if (clean.includes('timestamp')) {
      colMap.timestamp = idx;
    } else if (
      clean.includes('work order') ||
      clean.includes('nomer dokumen') ||
      clean.includes('nomor dokumen') ||
      clean.includes('no. dokumen') ||
      clean.includes('no wo')
    ) {
      if (colMap.nomerDokumen === undefined) colMap.nomerDokumen = idx;
    } else if (
      clean.includes('tgl wo masuk') ||
      clean.includes('tanggal order') ||
      clean.includes('tgl order') ||
      clean.includes('tanggal wo')
    ) {
      if (colMap.tanggalOrder === undefined) colMap.tanggalOrder = idx;
    } else if (clean.includes('departemen') || clean.includes('armada') || clean.includes('unit')) {
      if (colMap.departemen === undefined) colMap.departemen = idx;
    } else if (clean.includes('nama project') || clean.includes('project')) {
      colMap.project = idx;
    } else if (clean.includes('lokasi pekerjaan') || clean.includes('lokasi')) {
      colMap.lokasi = idx;
    } else if (clean.includes('mulai')) {
      colMap.mulai = idx;
    } else if (clean.includes('mrp/fpb')) {
      colMap.mrpFpb = idx;
    } else if (clean.includes('selesai') || clean.includes('tgl sr')) {
      if (colMap.selesai === undefined) colMap.selesai = idx;
    } else if (clean.includes('lka') || clean.includes('lkk')) {
      colMap.lka = idx;
    } else if (clean.includes('prioritas') || clean.includes('urgency')) {
      colMap.prioritas = idx;
    } else if (clean.includes('section')) {
      colMap.section = idx;
    } else if (clean.includes('uraian singkat') || clean.includes('uraian') || clean.includes('permintaan')) {
      if (colMap.uraian === undefined) colMap.uraian = idx;
    } else if (clean.includes('upload so/wo') || clean.includes('so/wo')) {
      colMap.uploadSoWo = idx;
    } else if (clean.includes('gap')) {
      colMap.gap = idx;
    } else if (clean.includes('no. fpb/mrp') || clean.includes('fpb')) {
      if (colMap.noFpb === undefined) colMap.noFpb = idx;
    } else if (clean === 'status' || clean.includes('status')) {
      if (colMap.status === undefined) colMap.status = idx;
    } else if (clean === 'progress' || clean.includes('progress')) {
      if (colMap.progress === undefined) colMap.progress = idx;
    } else if (clean.includes('evidence') || clean.includes('no sr') || clean.includes('foto')) {
      if (colMap.evidence === undefined) colMap.evidence = idx;
    } else if (clean === 'spk') {
      colMap.spk = idx;
    } else if (clean === 'bast') {
      colMap.bast = idx;
    } else if (clean === 'column 1') {
      colMap.efpbPdf = idx;
    }
  });

  // Khusus sheet Dashboard: kolom FPB berada tepat di sebelah kiri kolom STATUS jika belum terpetakan
  const isDashboardSheet = targetSheetName.toLowerCase() === 'dashboard';
  if (isDashboardSheet && colMap.noFpb === undefined && colMap.status !== undefined && colMap.status > 0) {
    colMap.noFpb = colMap.status - 1;
  }

  // Jika memproses sheet Dashboard, siapkan index lookup dari 'Form Responses 1' untuk melengkapi atribut detail (Drive, Prioritas, BAST, SPK)
  const frMap = new Map<string, any[]>();
  const frSheetName = wb.SheetNames.find(
    (name) =>
      name.toLowerCase().replace(/[\s_]+/g, '').includes('formresponse') ||
      name.toLowerCase().includes('form responses 1')
  );

  if (isDashboardSheet && frSheetName && wb.Sheets[frSheetName]) {
    try {
      const frWs = wb.Sheets[frSheetName];
      const frRawRows: any[][] = XLSX.utils.sheet_to_json(frWs, { header: 1 });
      if (frRawRows && frRawRows.length > 1) {
        for (let j = 1; j < frRawRows.length; j++) {
          const frRow = frRawRows[j];
          if (!frRow || !frRow[1]) continue;
          const frDocNo = String(frRow[1]).trim().toLowerCase();
          const frUraian = String(frRow[12] || '').trim().toLowerCase();
          const keyCombined = `${frDocNo}::${frUraian}`;
          frMap.set(keyCombined, frRow);
          if (!frMap.has(frDocNo)) {
            frMap.set(frDocNo, frRow);
          }
        }
      }
    } catch (frErr) {
      console.warn('Gagal membaca Form Responses 1 untuk enrichment:', frErr);
    }
  }

  const items: WorkOrderItem[] = [];
  let openCount = 0;
  let onProgressCount = 0;
  let closeCount = 0;
  let withFpbCount = 0;

  const startRow = headerRowIndex + 1;
  for (let i = startRow; i < rawRows.length; i++) {
    const r = rawRows[i];
    if (!r || r.length === 0) continue;

    const docNo = String(r[colMap.nomerDokumen ?? 3] || '').trim();
    if (!docNo) continue;

    let fpbVal = String(r[colMap.noFpb ?? 8] || '').trim();
    if (fpbVal === '-' || fpbVal === 'null') fpbVal = '';

    const rawStatus = r[colMap.status ?? 9];
    const status = normalizeStatus(rawStatus);

    const rawProgress = r[colMap.progress ?? 10];
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

    const rawTimestamp = colMap.timestamp !== undefined ? r[colMap.timestamp] : undefined;
    const rawTanggalOrder = r[colMap.tanggalOrder ?? 4];
    const orderDateMs = getEpochMs(rawTanggalOrder);
    const timestampMs = getEpochMs(rawTimestamp);

    let rawEvidence = String(r[colMap.evidence ?? 11] || '').trim();
    if (rawEvidence === '#REF!' || rawEvidence === '-' || rawEvidence === 'null') {
      rawEvidence = '';
    }

    const uraianPerbaikan = String(r[colMap.uraian ?? 6] || '').trim();
    const departemenArmada = String(r[colMap.departemen ?? 5] || '').trim();
    const section = String(r[colMap.section ?? 7] || '').trim();
    const tanggalSelesai = formatExcelDate(r[colMap.selesai ?? 12]);

    let namaProject = colMap.project !== undefined ? String(r[colMap.project] || '').trim() : '';
    let lokasiPekerjaan = colMap.lokasi !== undefined ? String(r[colMap.lokasi] || '').trim() : '';
    let scalaPrioritas = colMap.prioritas !== undefined ? String(r[colMap.prioritas] || '').trim() : '';
    let uploadSoWoUrl = colMap.uploadSoWo !== undefined ? String(r[colMap.uploadSoWo] || '').trim() : '';
    let spk = colMap.spk !== undefined ? String(r[colMap.spk] || '').trim() : '';
    let bastUrl = colMap.bast !== undefined ? String(r[colMap.bast] || '').trim() : '';
    let efpbPdf = colMap.efpbPdf !== undefined ? String(r[colMap.efpbPdf] || '').trim() : '';
    let tanggalMulai = colMap.mulai !== undefined ? formatExcelDate(r[colMap.mulai]) : '';
    let tanggalMrpFpb = colMap.mrpFpb !== undefined ? formatExcelDate(r[colMap.mrpFpb]) : '';
    let noLkaLkk = colMap.lka !== undefined ? String(r[colMap.lka] || '').trim() : '';
    let gapAnalysis = colMap.gap !== undefined ? String(r[colMap.gap] || '').trim() : '';

    // Lakukan enrichment dari Form Responses 1 jika ada
    if (frMap.size > 0) {
      const matchKey = `${docNo.toLowerCase()}::${uraianPerbaikan.toLowerCase()}`;
      const frRow = frMap.get(matchKey) || frMap.get(docNo.toLowerCase());
      if (frRow) {
        if (!namaProject && frRow[4]) namaProject = String(frRow[4]).trim();
        if (!lokasiPekerjaan && frRow[5]) lokasiPekerjaan = String(frRow[5]).trim();
        if (!scalaPrioritas && frRow[10]) scalaPrioritas = String(frRow[10]).trim();
        if (!uploadSoWoUrl && frRow[13]) uploadSoWoUrl = String(frRow[13]).trim();
        if (!rawEvidence && frRow[18]) rawEvidence = String(frRow[18]).trim();
        if (!spk && frRow[19]) spk = String(frRow[19]).trim();
        if (!bastUrl && frRow[20]) bastUrl = String(frRow[20]).trim();
        if (!efpbPdf && frRow[22]) efpbPdf = String(frRow[22]).trim();
        if (!tanggalMulai && frRow[6]) tanggalMulai = formatExcelDate(frRow[6]);
        if (!tanggalMrpFpb && frRow[7]) tanggalMrpFpb = formatExcelDate(frRow[7]);
        if (!noLkaLkk && frRow[9]) noLkaLkk = String(frRow[9]).trim();
        if (!gapAnalysis && frRow[14]) gapAnalysis = String(frRow[14]).trim();
        if (!fpbVal && frRow[15]) {
          const fallbackFpb = String(frRow[15]).trim();
          if (fallbackFpb && fallbackFpb !== '-' && fallbackFpb !== 'null') {
            fpbVal = fallbackFpb;
          }
        }
      }
    }

    if (status === 'Close') closeCount++;
    else if (status === 'On Progress') onProgressCount++;
    else openCount++;

    if (fpbVal) withFpbCount++;

    items.push({
      id: `wo-${i}-${docNo.replace(/[^a-zA-Z0-9]/g, '-')}`,
      timestamp: formatExcelDate(rawTimestamp),
      nomerDokumen: docNo,
      tanggalOrder: formatExcelDate(rawTanggalOrder),
      departemenArmada,
      namaProject,
      lokasiPekerjaan,
      tanggalMulai,
      tanggalMrpFpb,
      tanggalSelesai,
      noLkaLkk,
      scalaPrioritas,
      section,
      uraianPerbaikan,
      uploadSoWoUrl,
      gapAnalysis,
      noFpbMrp: fpbVal,
      status,
      progress,
      evidence: rawEvidence,
      spk,
      bastUrl,
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

  // Simpan data Work Order ke Cloudflare R2
  if (items.length > 0 && isR2Configured()) {
    try {
      await uploadToR2({
        key: R2_WO_KEY,
        body: Buffer.from(JSON.stringify({ items, summary, sheetName: targetSheetName }), 'utf8'),
        contentType: 'application/json',
      });
    } catch (r2Err) {
      console.warn('Gagal menyimpan work-orders ke R2:', r2Err);
    }
  }

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
    const forceRefresh = searchParams.get('refresh') === 'true' || searchParams.get('sync') === 'true';

    // Jika tidak force refresh, coba muat dari Cloudflare R2 terlebih dahulu untuk kecepatan maksimal
    if (!forceRefresh && isR2Configured()) {
      try {
        const obj = await getObjectFromR2(R2_WO_KEY);
        if (obj && obj.body) {
          const parsed = JSON.parse(Buffer.from(obj.body).toString('utf8'));
          if (parsed && Array.isArray(parsed.items) && parsed.items.length > 0) {
            return NextResponse.json({
              success: true,
              fromCloud: true,
              sheetName: parsed.sheetName || 'Dashboard',
              items: parsed.items,
              summary: parsed.summary,
              totalCount: parsed.items.length,
              lastSynced: parsed.summary?.lastSynced || new Date().toISOString(),
            });
          }
        }
      } catch (err) {
        console.warn('Gagal membaca work-orders dari R2:', err);
      }
    }

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
    let body: any = {};
    try {
      body = await req.json();
    } catch {
      // Empty or non-JSON
    }

    // Jika client mengirim data items langsung untuk disimpan ke R2
    if (Array.isArray(body?.items) && body.items.length > 0) {
      const summary = body.summary || {
        total: body.items.length,
        open: 0,
        onProgress: 0,
        close: 0,
        withFpb: 0,
        lastSynced: new Date().toISOString(),
      };
      if (isR2Configured()) {
        await uploadToR2({
          key: R2_WO_KEY,
          body: Buffer.from(JSON.stringify({ items: body.items, summary, sheetName: body.sheetName || 'Dashboard' }), 'utf8'),
          contentType: 'application/json',
        });
      }
      return NextResponse.json({
        success: true,
        message: 'Data Work Order berhasil disimpan ke Cloudflare R2.',
        items: body.items,
        summary,
      });
    }

    const targetUrl = body?.url || DEFAULT_WO_SHEET_URL;
    return await processWorkOrderSheet(targetUrl);
  } catch (err: any) {
    console.error('Error in POST /api/sync-work-order:', err);
    return NextResponse.json(
      { success: false, message: err?.message || 'Gagal memproses sinkronisasi Work Order.' },
      { status: 500 }
    );
  }
}
