import { NextRequest, NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import { parseServiceMaintenanceWorkbook } from '@/utils/smParser';
import { DEFAULT_SM_VENDORS, ServiceMaintenanceItem, ServiceMaintenanceSummary, VendorSheetConfig } from '@/types/serviceMaintenance';
import {
  isR2Configured,
  getObjectFromR2,
  uploadToR2,
} from '@/utils/r2Client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

const R2_SM_KEY = 'dashboard-metadata/service-maintenance.json';
const R2_SM_VENDORS_KEY = 'dashboard-metadata/sm-vendors.json';

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

async function loadSmFromR2(): Promise<{ items: ServiceMaintenanceItem[]; summary: ServiceMaintenanceSummary } | null> {
  if (!isR2Configured()) return null;
  try {
    const obj = await getObjectFromR2(R2_SM_KEY);
    if (obj && obj.body) {
      const parsed = JSON.parse(Buffer.from(obj.body).toString('utf8'));
      if (parsed && Array.isArray(parsed.items) && parsed.items.length > 0) {
        return {
          items: parsed.items,
          summary: parsed.summary,
        };
      }
    }
  } catch (err) {
    console.warn('Gagal membaca service-maintenance dari R2:', err);
  }
  return null;
}

async function saveSmToR2(items: ServiceMaintenanceItem[], summary: ServiceMaintenanceSummary): Promise<boolean> {
  if (!isR2Configured()) return false;
  try {
    await uploadToR2({
      key: R2_SM_KEY,
      body: Buffer.from(JSON.stringify({ items, summary, savedAt: new Date().toISOString() }), 'utf8'),
      contentType: 'application/json',
    });
    return true;
  } catch (err) {
    console.warn('Gagal menyimpan service-maintenance ke R2:', err);
    return false;
  }
}

async function loadVendorsFromR2(): Promise<VendorSheetConfig[] | null> {
  if (!isR2Configured()) return null;
  try {
    const obj = await getObjectFromR2(R2_SM_VENDORS_KEY);
    if (obj && obj.body) {
      const parsed = JSON.parse(Buffer.from(obj.body).toString('utf8'));
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch {}
  return null;
}

async function saveVendorsToR2(vendors: VendorSheetConfig[]): Promise<boolean> {
  if (!isR2Configured()) return false;
  try {
    await uploadToR2({
      key: R2_SM_VENDORS_KEY,
      body: Buffer.from(JSON.stringify(vendors, null, 2), 'utf8'),
      contentType: 'application/json',
    });
    return true;
  } catch {
    return false;
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const sync = searchParams.get('sync') === 'true';
    const targetUrl = searchParams.get('url');
    const vendorName = searchParams.get('vendor') || DEFAULT_SM_VENDORS[0].name;

    if (sync && targetUrl) {
      return await processSmSheet(targetUrl, vendorName);
    }

    // Default GET: Baca data tersimpan di Cloudflare R2
    const [cloudSm, cloudVendors] = await Promise.all([
      loadSmFromR2(),
      loadVendorsFromR2(),
    ]);

    return NextResponse.json({
      success: true,
      fromCloud: Boolean(cloudSm),
      items: cloudSm?.items || [],
      summary: cloudSm?.summary || null,
      vendors: cloudVendors || DEFAULT_SM_VENDORS,
    });
  } catch (err: any) {
    console.error('Error in GET /api/sync-sm:', err);
    return NextResponse.json(
      { success: false, message: err?.message || 'Gagal memproses data Service Maintenance.' },
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
    let body: any = {};

    try {
      body = await req.json();
      if (body?.url) targetUrl = body.url;
      if (body?.vendor) vendorName = body.vendor;
      if (body?.syncAll) syncAll = true;
      if (Array.isArray(body?.vendors) && body.vendors.length > 0) {
        customVendors = body.vendors;
      }
    } catch {}

    // Menyimpan daftar vendor custom ke Cloudflare R2
    if (Array.isArray(body?.saveVendors)) {
      await saveVendorsToR2(body.saveVendors);
      return NextResponse.json({
        success: true,
        message: 'Pengaturan vendor SM berhasil disimpan ke Cloudflare R2.',
        vendors: body.saveVendors,
      });
    }

    // Menyimpan data items SM hasil upload / edit langsung ke Cloudflare R2
    if (Array.isArray(body?.items) && body.items.length > 0) {
      const merged = body.items;
      const totalClose = merged.filter((i: any) => i.status === 'CLOSE').length;
      const totalOpen = merged.filter((i: any) => i.status === 'OPEN').length;
      const totalHold = merged.filter((i: any) => i.status === 'HOLD').length;
      const summary: ServiceMaintenanceSummary = body.summary || {
        totalRecords: merged.length,
        totalClose,
        totalOpen,
        totalHold,
        totalVendors: Array.from(new Set(merged.map((i: any) => i.vendor))).length,
        lastUpdated: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
      };
      await saveSmToR2(merged, summary);
      return NextResponse.json({
        success: true,
        message: 'Data Service & Maintenance berhasil disimpan ke Cloudflare R2.',
        items: merged,
        summary,
      });
    }

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

  const summary: ServiceMaintenanceSummary = {
    totalRecords: allItems.length,
    totalClose: allItems.filter((i) => i.status === 'CLOSE').length,
    totalOpen: allItems.filter((i) => i.status === 'OPEN').length,
    totalHold: allItems.filter((i) => i.status === 'HOLD').length,
    totalVendors: Array.from(new Set(allItems.map((i) => i.vendor))).length,
    lastUpdated: timeStr,
  };

  // Simpan hasil sinkronisasi gabungan ke Cloudflare R2
  if (allItems.length > 0) {
    await saveSmToR2(allItems, summary);
  }

  return NextResponse.json({
    success: true,
    items: allItems,
    summary,
    message: `Berhasil menarik ${allItems.length} data SM dari vendor yang aktif & tersinkron ke R2. ${
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
