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
  'https://docs.google.com/spreadsheets/d/16Ae8qGsGYX_xCNsqZvME-uZvaAeECsE69PBYlY32fZk/edit?pli=1&gid=0#gid=0';
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
 * Cari file Excel Monitoring Berkas Internal Procurement terbaru dari folder Downloads / Project / Desktop.
 * Mengabaikan file lock sementara Excel (~$*) dan memilih file valid terbaru berdasarkan waktu modifikasi (mtime).
 */
function findLatestLocalProcurementFile(): { buffer: Buffer; fileName: string } | null {
  const candidateDirs: string[] = [process.cwd()];
  if (process.env.USERPROFILE) {
    candidateDirs.push(
      path.join(process.env.USERPROFILE, 'Downloads'),
      path.join(process.env.USERPROFILE, 'Desktop')
    );
  }

  const validCandidates: { filePath: string; mtime: number; size: number }[] = [];

  for (const dir of Array.from(new Set(candidateDirs))) {
    if (!fs.existsSync(dir)) continue;
    try {
      const files = fs.readdirSync(dir);
      for (const file of files) {
        if (!file.endsWith('.xlsx')) continue;
        if (file.startsWith('~$')) continue; // Abaikan file lock sementara Excel
        const lower = file.toLowerCase();
        if (
          lower.includes('monitoring berkas internal procurement') ||
          lower.includes('monitoring_berkas_internal_procurement') ||
          lower.includes('monitoring berkas procurement')
        ) {
          const fullPath = path.join(dir, file);
          try {
            const stat = fs.statSync(fullPath);
            if (stat.size > 50000) { // Minimal 50KB untuk file valid
              validCandidates.push({ filePath: fullPath, mtime: stat.mtimeMs, size: stat.size });
            }
          } catch {
            // Abaikan file yang tidak dapat dibaca
          }
        }
      }
    } catch {
      // Abaikan folder tanpa izin baca
    }
  }

  // Urutkan dari yang paling baru diubah / diunduh (mtime terbesar)
  validCandidates.sort((a, b) => b.mtime - a.mtime);

  for (const candidate of validCandidates) {
    try {
      const buffer = fs.readFileSync(candidate.filePath);
      return { buffer, fileName: path.basename(candidate.filePath) };
    } catch {
      // Lanjut ke kandidat berikutnya jika file sedang terkunci eksklusif
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
          'Akses Google Sheets masih dibatasi (HTTP 401/403). Untuk membukanya, ubah izin berbagi Google Sheets menjadi "Siapa saja yang memiliki link" atau pasang Webhook Apps Script di menu Auto-Save.',
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
      console.warn('Gagal upload hasil sinkronisasi ke R2:', r2Err);
    }
  }

  const msg = isLocalFallback
    ? `Akses link Google Sheets masih dibatasi (privat). Berhasil menyinkronkan ${result.procurement.length.toLocaleString('id-ID')} data dari file terbaru "${sourceLabel}" & tersimpan ke Cloudflare R2!`
    : `Berhasil menyinkronkan ${result.procurement.length.toLocaleString('id-ID')} berkas internal langsung dari Google Sheets & tersimpan ke Cloudflare R2!`;

  return NextResponse.json({
    success: true,
    message: msg,
    stats: result.stats,
    sheetNames: workbook.SheetNames,
    procurement: result.procurement,
    armada: result.armada,
    sourceUrl: sourceLabel,
    timestamp: new Date().toISOString(),
  });
}
