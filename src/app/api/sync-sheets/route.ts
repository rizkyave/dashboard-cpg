import { NextRequest, NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import fs from 'fs';
import path from 'path';
import { parseAndMergeWorkbook } from '@/utils/excelParser';
import { isR2Configured, uploadToR2 } from '@/utils/r2Client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

const DEFAULT_SHEET_URL =
  'https://docs.google.com/spreadsheets/d/16Ae8gGsGYx_xCNaqZvME-uZvaAeECsE69PBYlY32fZk/edit?pli=1&gid=0#gid=0';
const R2_PROCUREMENT_KEY = 'dashboard-metadata/procurement-data.json';
const R2_ARMADA_KEY = 'dashboard-metadata/armada-data.json';

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

/**
 * Cari file Excel Monitoring Berkas Internal Procurement terbaru dari folder Downloads / Project
 */
function findLatestLocalProcurementFile(): { buffer: Buffer; fileName: string } | null {
  const candidateDirs: string[] = [process.cwd()];
  if (process.env.USERPROFILE) {
    candidateDirs.push(
      path.join(process.env.USERPROFILE, 'Downloads'),
      path.join(process.env.USERPROFILE, 'Desktop')
    );
  }

  let bestFile: { filePath: string; mtime: number; version: number } | null = null;

  for (const dir of Array.from(new Set(candidateDirs))) {
    if (!fs.existsSync(dir)) continue;
    try {
      const files = fs.readdirSync(dir);
      for (const file of files) {
        if (!file.endsWith('.xlsx')) continue;
        const lower = file.toLowerCase();
        if (
          lower.includes('monitoring berkas internal procurement') ||
          lower.includes('monitoring_berkas_internal_procurement') ||
          lower.includes('monitoring berkas procurement')
        ) {
          const fullPath = path.join(dir, file);
          const stat = fs.statSync(fullPath);
          const vMatch = file.match(/\((\d+)\)/);
          const version = vMatch ? parseInt(vMatch[1], 10) : (lower.includes('latest') ? 999 : 0);
          const score = version * 10000000000000 + stat.mtimeMs;

          if (!bestFile || score > (bestFile.version * 10000000000000 + bestFile.mtime)) {
            bestFile = { filePath: fullPath, mtime: stat.mtimeMs, version };
          }
        }
      }
    } catch {
      // Abaikan folder tanpa izin baca
    }
  }

  if (bestFile) {
    try {
      const buffer = fs.readFileSync(bestFile.filePath);
      return { buffer, fileName: path.basename(bestFile.filePath) };
    } catch {
      return null;
    }
  }
  return null;
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const targetUrl = searchParams.get('url') || DEFAULT_SHEET_URL;
    return await processSheet(targetUrl);
  } catch (err: any) {
    console.error('Error in GET /api/sync-sheets:', err);
    return NextResponse.json(
      { success: false, message: err?.message || 'Gagal memproses sinkronisasi sheet.' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    let targetUrl = DEFAULT_SHEET_URL;
    try {
      const body = await req.json();
      if (body?.url) {
        targetUrl = body.url;
      }
    } catch {
      // Default url
    }
    return await processSheet(targetUrl);
  } catch (err: any) {
    console.error('Error in POST /api/sync-sheets:', err);
    return NextResponse.json(
      { success: false, message: err?.message || 'Gagal memproses sinkronisasi sheet.' },
      { status: 500 }
    );
  }
}

async function processSheet(targetUrl: string) {
  let buffer: Buffer | null = null;
  let sourceLabel = targetUrl;
  let isLocalFallback = false;

  // 1. Coba download dari Google Sheets jika URL disediakan
  try {
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

    if (response.ok) {
      const contentType = response.headers.get('content-type') || '';
      if (!contentType.includes('text/html')) {
        const arrayBuffer = await response.arrayBuffer();
        const b = Buffer.from(arrayBuffer);
        const textPreview = b.subarray(0, 1000).toString('utf8');
        if (
          !textPreview.includes('<html') &&
          !textPreview.includes('<!DOCTYPE') &&
          !textPreview.includes('ServiceLogin') &&
          !textPreview.includes('accounts.google.com')
        ) {
          buffer = b;
        }
      }
    }
  } catch (netErr) {
    console.warn('Google Sheets network fetch failed, trying local fallback:', netErr);
  }

  // 2. Jika Google Sheets dibatasi (401/403/Login Page) atau gagal diunduh, otomatis gunakan file lokal terbaru
  if (!buffer) {
    const local = findLatestLocalProcurementFile();
    if (local) {
      buffer = local.buffer;
      sourceLabel = `${local.fileName} (Lokal)`;
      isLocalFallback = true;
    }
  }

  if (!buffer) {
    return NextResponse.json(
      {
        success: false,
        message:
          'Akses Google Sheets masih dibatasi (HTTP 401/403) dan belum ditemukan file Excel Monitoring Berkas Internal Procurement di folder Downloads/komputer.',
      },
      { status: 403 }
    );
  }

  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const result = parseAndMergeWorkbook(workbook);

  if (result.procurement.length === 0 && result.armada.length === 0) {
    return NextResponse.json(
      {
        success: false,
        message: `Tidak ditemukan sheet yang sesuai di spreadsheet. Sheet terdeteksi: ${workbook.SheetNames.join(', ')}`,
      },
      { status: 422 }
    );
  }

  // Simpan data tersinkron ke Cloudflare R2 agar semua device langsung terupdate
  if (isR2Configured()) {
    try {
      await Promise.all([
        uploadToR2({
          key: R2_PROCUREMENT_KEY,
          body: Buffer.from(JSON.stringify(result.procurement), 'utf8'),
          contentType: 'application/json',
        }),
        result.armada.length > 0
          ? uploadToR2({
              key: R2_ARMADA_KEY,
              body: Buffer.from(JSON.stringify(result.armada), 'utf8'),
              contentType: 'application/json',
            })
          : Promise.resolve(),
      ]);
    } catch (r2Err) {
      console.warn('Gagal menyimpan hasil sync sheets ke Cloudflare R2:', r2Err);
    }
  }

  return NextResponse.json({
    success: true,
    message: isLocalFallback
      ? `Berhasil menyinkronkan ${result.procurement.length.toLocaleString('id-ID')} data procurement langsung dari file ${sourceLabel} & tersinkron ke R2!`
      : `Berhasil menyinkronkan ${result.procurement.length.toLocaleString('id-ID')} data procurement langsung dari Google Sheets & tersinkron ke R2!`,
    stats: result.stats,
    sheetNames: workbook.SheetNames,
    procurement: result.procurement,
    armada: result.armada,
    sourceUrl: sourceLabel,
    timestamp: new Date().toISOString(),
  });
}
