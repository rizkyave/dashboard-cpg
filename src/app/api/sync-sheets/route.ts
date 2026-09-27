import { NextRequest, NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import { parseAndMergeWorkbook } from '@/utils/excelParser';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const DEFAULT_SHEET_URL =
  'https://docs.google.com/spreadsheets/d/16Ae8gGsGYx_xCNaqZvME-uZvaAeECsE69PBYlY32fZk/edit?gid=0#gid=0';

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
        message: `Gagal mengunduh file Google Sheets (HTTP Status ${response.status}: ${response.statusText}). Pastikan link memiliki izin akses "Siapa saja yang memiliki link dapat melihat".`,
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
            'Akses ke Google Sheets ditolak / memerlukan login. Ubah pengaturan bagikan (share) spreadsheet menjadi "Siapa saja yang memiliki link dapat melihat (Viewer)".',
        },
        { status: 403 }
      );
    }
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

  return NextResponse.json({
    success: true,
    message: `Berhasil menyinkronkan ${result.procurement.length.toLocaleString('id-ID')} data procurement langsung dari Google Sheets!`,
    stats: result.stats,
    sheetNames: workbook.SheetNames,
    procurement: result.procurement,
    armada: result.armada,
    sourceUrl: targetUrl,
    timestamp: new Date().toISOString(),
  });
}
