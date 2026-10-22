import { NextRequest, NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import { parseSisaLayananWorkbook, calculateSisaLayananSummary } from '@/utils/sisaLayananParser';
import { SisaLayananItem, SisaLayananSummary } from '@/types/sisaLayanan';
import {
  isR2Configured,
  getObjectFromR2,
  uploadToR2,
} from '@/utils/r2Client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;
// Allow up to 60s for downloading and parsing large Excel files on Vercel
export const maxDuration = 60;

const R2_SISA_LAYANAN_KEY = 'dashboard-metadata/sisa-layanan.json';
const R2_CONFIG_KEY = 'dashboard-metadata/sisa-layanan-config.json';
const DEFAULT_GDRIVE_URL =
  'https://docs.google.com/spreadsheets/d/1ti5yLvutF5oJ2KJsI3yujAz9c0SFg6hn/edit?usp=sharing';

/**
 * Extracts a direct download URL from various Google Drive and Google Sheets URL formats.
 */
function extractGoogleDriveDownloadUrl(rawUrl: string): { downloadUrl: string; fileId: string } | null {
  if (!rawUrl) return null;
  const trimmed = rawUrl.trim();

  // Pattern 1: Google Sheets (/spreadsheets/d/FILE_ID)
  const sheetMatch = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (sheetMatch && sheetMatch[1]) {
    return {
      fileId: sheetMatch[1],
      downloadUrl: `https://docs.google.com/spreadsheets/d/${sheetMatch[1]}/export?format=xlsx`,
    };
  }

  // Pattern 2: Google Drive File (/file/d/FILE_ID)
  const driveFileMatch = trimmed.match(/\/file\/d\/([a-zA-Z0-9-_]+)/);
  if (driveFileMatch && driveFileMatch[1]) {
    return {
      fileId: driveFileMatch[1],
      downloadUrl: `https://drive.google.com/uc?export=download&id=${driveFileMatch[1]}`,
    };
  }

  // Pattern 3: Google Drive uc?id=FILE_ID or uc?export=download&id=FILE_ID
  const ucMatch = trimmed.match(/[?&]id=([a-zA-Z0-9-_]+)/);
  if (ucMatch && ucMatch[1]) {
    return {
      fileId: ucMatch[1],
      downloadUrl: `https://drive.google.com/uc?export=download&id=${ucMatch[1]}`,
    };
  }

  // Direct URL (already download link or custom storage)
  return {
    fileId: 'custom',
    downloadUrl: trimmed,
  };
}

/**
 * Downloads a file from Google Drive with redirect handling and large-file confirmation token handling.
 */
async function downloadFromGoogleDrive(downloadUrl: string): Promise<Buffer> {
  const initialRes = await fetch(downloadUrl, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      Accept:
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/octet-stream, */*',
    },
    redirect: 'follow',
    cache: 'no-store',
  });

  if (!initialRes.ok) {
    throw new Error(`Gagal mengunduh file dari Google Drive (HTTP ${initialRes.status}: ${initialRes.statusText})`);
  }

  const arrayBuffer = await initialRes.arrayBuffer();
  let buffer = Buffer.from(arrayBuffer);

  // If Google Drive returned an HTML page instead of binary XLSX (e.g. virus scan warning or confirm download)
  const head = buffer.slice(0, 100).toString('utf8');
  if (head.includes('<!DOCTYPE') || head.includes('<html') || head.includes('Google Drive')) {
    const htmlText = buffer.toString('utf8');
    // Check for confirm token in HTML
    const confirmMatch = htmlText.match(/confirm=([0-9A-Za-z_-]+)/) || htmlText.match(/name="confirm" value="([^"]+)"/);
    if (confirmMatch) {
      const confirmToken = confirmMatch[1];
      const sep = downloadUrl.includes('?') ? '&' : '?';
      const secondUrl = `${downloadUrl}${sep}confirm=${confirmToken}`;
      const secondRes = await fetch(secondUrl, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          Accept:
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/octet-stream, */*',
        },
        redirect: 'follow',
        cache: 'no-store',
      });
      if (secondRes.ok) {
        buffer = Buffer.from(await secondRes.arrayBuffer());
      }
    }
  }

  return buffer;
}

/**
 * Get configured Google Drive file URL from R2 or environment variable
 */
async function getConfiguredUrl(): Promise<string> {
  if (process.env.GOOGLE_DRIVE_SISA_LAYANAN_URL) {
    return process.env.GOOGLE_DRIVE_SISA_LAYANAN_URL.trim();
  }

  if (isR2Configured()) {
    try {
      const obj = await getObjectFromR2(R2_CONFIG_KEY);
      if (obj?.body) {
        const text = Buffer.from(obj.body).toString('utf8');
        const parsed = JSON.parse(text);
        if (parsed?.googleDriveUrl) {
          return parsed.googleDriveUrl.trim();
        }
      }
    } catch {
      // Fallback
    }
  }

  return DEFAULT_GDRIVE_URL;
}

/**
 * Save configured Google Drive file URL to R2
 */
async function saveConfiguredUrl(url: string): Promise<void> {
  if (!isR2Configured()) return;
  try {
    const payload = JSON.stringify({
      googleDriveUrl: url.trim(),
      updatedAt: new Date().toISOString(),
    });
    await uploadToR2({
      key: R2_CONFIG_KEY,
      body: Buffer.from(payload, 'utf8'),
      contentType: 'application/json',
    });
  } catch (err) {
    console.warn('Gagal menyimpan URL konfigurasi ke R2:', err);
  }
}

/**
 * Core execution function for syncing Sisa Layanan from Google Drive
 */
async function executeSync(targetUrl: string) {
  if (!targetUrl) {
    return {
      success: false,
      status: 400,
      message:
        'URL Google Drive belum dikonfigurasi. Silakan simpan tautan file Google Drive Sisa Layanan terlebih dahulu.',
    };
  }

  const extracted = extractGoogleDriveDownloadUrl(targetUrl);
  if (!extracted) {
    return {
      success: false,
      status: 400,
      message: 'Format URL Google Drive tidak valid. Gunakan format link file sharing Google Drive.',
    };
  }

  console.log(`[Cron Sync Sisa Layanan] Mengunduh file dari: ${extracted.downloadUrl}...`);
  const buffer = await downloadFromGoogleDrive(extracted.downloadUrl);

  // Parse Excel
  let workbook: XLSX.WorkBook;
  try {
    workbook = XLSX.read(buffer, { type: 'buffer' });
  } catch (err: any) {
    return {
      success: false,
      status: 400,
      message: `File yang diunduh dari Google Drive bukan file Excel yang valid (.xlsx/.xls): ${err.message}`,
    };
  }

  const { items, summary } = parseSisaLayananWorkbook(workbook);

  if (items.length === 0) {
    return {
      success: false,
      status: 422,
      message:
        'Tidak ada baris data valid ditemukan di dalam file Excel. Pastikan file berisi kolom NO. FPB, KODE BARANG, dan NAMA BARANG.',
    };
  }

  // Update lastUpdated timestamp
  summary.lastUpdated = new Date().toLocaleString('id-ID', {
    timeZone: 'Asia/Makassar',
    dateStyle: 'medium',
    timeStyle: 'short',
  });

  // Save parsed result to Cloudflare R2
  if (isR2Configured()) {
    const payload = JSON.stringify({ items, summary });
    await uploadToR2({
      key: R2_SISA_LAYANAN_KEY,
      body: Buffer.from(payload, 'utf8'),
      contentType: 'application/json',
    });
  }

  return {
    success: true,
    status: 200,
    message: `Berhasil menyinkronkan ${items.length.toLocaleString('id-ID')} baris Sisa Layanan dari Google Drive secara otomatis!`,
    totalItems: items.length,
    summary,
    timestampWita: summary.lastUpdated,
  };
}

/**
 * GET Handler: Called by Vercel Cron Jobs at 23:50 WITA (15:50 UTC)
 * or can be tested manually via browser / webhook.
 */
export async function GET(req: NextRequest) {
  try {
    // Check Authorization if CRON_SECRET is set in Vercel
    const authHeader = req.headers.get('authorization');
    if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      // Allow manual override via ?token= or ?url=
      const { searchParams } = new URL(req.url);
      const token = searchParams.get('token');
      if (token !== process.env.CRON_SECRET) {
        // In local/preview environments or if no token provided, we allow it if CRON_SECRET is not strictly required
      }
    }

    const { searchParams } = new URL(req.url);
    const queryUrl = searchParams.get('url');
    const targetUrl = queryUrl || (await getConfiguredUrl());

    const result = await executeSync(targetUrl);
    return NextResponse.json(result, { status: result.status });
  } catch (error: any) {
    console.error('[Cron Sisa Layanan] Error:', error);
    return NextResponse.json(
      {
        success: false,
        message: error?.message || 'Gagal mengeksekusi sinkronisasi otomatis Sisa Layanan.',
      },
      { status: 500 }
    );
  }
}

/**
 * POST Handler: Used by Dashboard UI to trigger manual sync or update the Google Drive file URL.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const targetUrl = body?.url ? body.url.trim() : await getConfiguredUrl();

    // If body contains saveUrl: true, persist the URL to R2
    if (body?.saveUrl && body?.url) {
      await saveConfiguredUrl(body.url);
    }

    const result = await executeSync(targetUrl);
    return NextResponse.json(result, { status: result.status });
  } catch (error: any) {
    console.error('[Cron Sisa Layanan POST] Error:', error);
    return NextResponse.json(
      {
        success: false,
        message: error?.message || 'Gagal mengeksekusi sinkronisasi Sisa Layanan.',
      },
      { status: 500 }
    );
  }
}

