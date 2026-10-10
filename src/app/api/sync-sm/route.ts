import { NextRequest, NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import { parseServiceMaintenanceWorkbook } from '@/utils/smParser';
import { DEFAULT_SM_VENDORS } from '@/types/serviceMaintenance';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

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
    const targetUrl = searchParams.get('url') || DEFAULT_SM_VENDORS[0].sheetUrl;
    const vendorName = searchParams.get('vendor') || DEFAULT_SM_VENDORS[0].name;
    return await processSmSheet(targetUrl, vendorName);
  } catch (err: any) {
    console.error('Error in GET /api/sync-sm:', err);
    return NextResponse.json(
      { success: false, message: err?.message || 'Gagal memproses sinkronisasi SM Sheet.' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    let targetUrl = DEFAULT_SM_VENDORS[0].sheetUrl;
    let vendorName = DEFAULT_SM_VENDORS[0].name;
    let customVendors = DEFAULT_SM_VENDORS;
    let syncAll = false;
    try {
      const body = await req.json();
      if (body?.url) targetUrl = body.url;
      if (body?.vendor) vendorName = body.vendor;
      if (body?.syncAll) syncAll = true;
      if (Array.isArray(body?.vendors) && body.vendors.length > 0) {
        customVendors = body.vendors;
      }
    } catch {}

    if (syncAll) {
      return await processAllVendors(customVendors);
    }

    return await processSmSheet(targetUrl, vendorName);
  } catch (err: any) {
    console.error('Error in POST /api/sync-sm:', err);
    return NextResponse.json(
      { success: false, message: err?.message || 'Gagal memproses sinkronisasi SM Sheet.' },
      { status: 500 }
    );
  }
}

async function processAllVendors(vendorsList = DEFAULT_SM_VENDORS) {
  const allItems: any[] = [];
  const errors: string[] = [];

  for (const v of vendorsList) {
    try {
      const downloadUrl = extractExportUrl(v.sheetUrl);
      const res = await fetch(downloadUrl, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          Accept:
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/octet-stream, */*',
        },
        cache: 'no-store',
        redirect: 'follow',
      });

      if (res.ok) {
        const arrayBuf = await res.arrayBuffer();
        const buffer = Buffer.from(arrayBuf);
        if (buffer.length > 500) {
          const workbook = XLSX.read(buffer, { type: 'buffer' });
          const { items } = parseServiceMaintenanceWorkbook(workbook, v.name);
          if (items.length > 0) {
            allItems.push(...items);
          }
        }
      } else {
        errors.push(`${v.name} (HTTP ${res.status})`);
      }
    } catch (e: any) {
      errors.push(`${v.name} (${e.message})`);
    }
  }

  const now = new Date();
  const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now
    .getMinutes()
    .toString()
    .padStart(2, '0')}`;

  const summary = {
    totalRecords: allItems.length,
    totalClose: allItems.filter((i) => i.status === 'CLOSE').length,
    totalOpen: allItems.filter((i) => i.status === 'OPEN').length,
    totalHold: allItems.filter((i) => i.status === 'HOLD').length,
    totalVendors: Array.from(new Set(allItems.map((i) => i.vendor))).length,
    lastUpdated: timeStr,
  };

  return NextResponse.json({
    success: true,
    items: allItems,
    summary,
    message: `Berhasil menarik ${allItems.length} data SM dari vendor yang aktif. ${
      errors.length > 0 ? `Catatan: ${errors.join(', ')} memerlukan login/penyesuaian izin link.` : ''
    }`,
  });
}

async function processSmSheet(targetUrl: string, vendorName: string) {
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
        message: `Gagal mengunduh Google Sheets ${vendorName} (HTTP ${response.status}: ${response.statusText}). Pastikan link berstatus "Siapa saja yang memiliki link dapat melihat".`,
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
          message: `Akses ke Google Sheets ${vendorName} ditolak atau memerlukan login. Ubah pengaturan sharing menjadi "Siapa saja yang memiliki link dapat melihat".`,
        },
        { status: 403 }
      );
    }
  }

  try {
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const { items, summary } = parseServiceMaintenanceWorkbook(workbook, vendorName);

    return NextResponse.json({
      success: true,
      items,
      summary,
      message: `Berhasil menyinkronkan ${items.length} catatan pekerjaan Service & Maintenance (${vendorName})!`,
    });
  } catch (err: any) {
    return NextResponse.json(
      {
        success: false,
        message: `Gagal membaca isi berkas Excel ${vendorName}: ${err.message}`,
      },
      { status: 500 }
    );
  }
}

