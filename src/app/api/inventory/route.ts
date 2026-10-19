import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import * as XLSX from 'xlsx';
import { parseInventoryWorkbook, calculateInventorySummary } from '@/utils/inventoryParser';
import { InventoryItem, InventorySummary } from '@/types/procurement';
import {
  isR2Configured,
  getObjectFromR2,
  uploadToR2,
} from '@/utils/r2Client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

const R2_INVENTORY_KEY = 'dashboard-metadata/inventory-items.json';

// Server-side memory cache for instantaneous response
let cachedItems: InventoryItem[] | null = null;
let cachedSummary: InventorySummary | null = null;

async function loadFromR2(): Promise<{ items: InventoryItem[]; summary: InventorySummary } | null> {
  if (!isR2Configured()) return null;
  try {
    const obj = await getObjectFromR2(R2_INVENTORY_KEY);
    if (obj && obj.body) {
      const text = Buffer.from(obj.body).toString('utf8');
      const parsed = JSON.parse(text);
      if (parsed && Array.isArray(parsed.items) && parsed.items.length > 0) {
        return {
          items: parsed.items,
          summary: parsed.summary || calculateInventorySummary(parsed.items),
        };
      }
    }
  } catch (err) {
    console.warn('Gagal membaca inventory dari Cloudflare R2:', err);
  }
  return null;
}

async function saveToR2(items: InventoryItem[], summary: InventorySummary): Promise<boolean> {
  if (!isR2Configured()) return false;
  try {
    const payload = JSON.stringify({ items, summary, savedAt: new Date().toISOString() });
    await uploadToR2({
      key: R2_INVENTORY_KEY,
      body: Buffer.from(payload, 'utf8'),
      contentType: 'application/json',
    });
    return true;
  } catch (err) {
    console.warn('Gagal menyimpan inventory ke Cloudflare R2:', err);
    return false;
  }
}

function loadInitialFromDisk(forceReload: boolean = false): { items: InventoryItem[]; summary: InventorySummary } {
  if (!forceReload && cachedItems && cachedSummary) {
    return { items: cachedItems, summary: cachedSummary };
  }

  // 1. Try reading pre-generated fast JSON file
  const jsonPath = path.join(process.cwd(), 'src', 'data', 'initialInventoryData.json');
  if (!forceReload && fs.existsSync(jsonPath)) {
    try {
      const raw = fs.readFileSync(jsonPath, 'utf-8');
      const items: InventoryItem[] = JSON.parse(raw);
      if (Array.isArray(items) && items.length > 0) {
        const summary = calculateInventorySummary(items);
        cachedItems = items;
        cachedSummary = summary;
        return { items, summary };
      }
    } catch (err) {
      console.warn('Failed reading initialInventoryData.json, falling back to Excel:', err);
    }
  }

  // 2. Priority paths to search for the consolidated inventory file
  const candidatePaths = [
    path.join(process.cwd(), 'Daftar_Barang_Gabungan_Semua_Perusahaan.xlsx'),
    path.join(process.cwd(), 'Daftar_Barang_Gabungan_Semua_Perusahaan_Enriched.xlsx'),
    path.join(process.cwd(), '..', 'Daftar_Barang_Gabungan_Semua_Perusahaan.xlsx'),
    path.join(process.cwd(), 'Daftar_Barang_PT_CINDARA_PRATAMA_LINES.xlsx'),
  ];

  for (const filePath of candidatePaths) {
    if (fs.existsSync(filePath)) {
      try {
        const buffer = fs.readFileSync(filePath);
        const workbook = XLSX.read(buffer, { type: 'buffer' });
        const result = parseInventoryWorkbook(workbook);
        if (result.items.length > 0) {
          cachedItems = result.items;
          cachedSummary = result.summary;
          // Asynchronously update json cache safely
          try {
            fs.writeFileSync(jsonPath, JSON.stringify(result.items), 'utf-8');
          } catch {}
          return result;
        }
      } catch (err) {
        console.error('Failed reading inventory Excel at', filePath, err);
      }
    }
  }

  return { items: [], summary: calculateInventorySummary([]) };
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const force = searchParams.get('force') === 'true' || searchParams.get('refresh') === 'true';

    let data: { items: InventoryItem[]; summary: InventorySummary } | null = null;

    if (!force) {
      // 1. Prioritas baca dari Cloudflare R2
      data = await loadFromR2();
    }

    // 2. Fallback ke disk jika belum ada di R2
    if (!data || data.items.length === 0) {
      data = loadInitialFromDisk(force);
      // Seed data ke R2 di background
      if (data.items.length > 0 && isR2Configured()) {
        saveToR2(data.items, data.summary).catch(() => {});
      }
    }

    cachedItems = data.items;
    cachedSummary = data.summary;

    const q = searchParams.get('q')?.toLowerCase()?.trim();
    const entity = searchParams.get('entity');
    const status = searchParams.get('status');

    let filtered = data.items;

    if (entity && entity !== 'ALL') {
      filtered = filtered.filter((it) => it.entity === entity || it.perusahaan.includes(entity));
    }

    if (status === 'READY') {
      filtered = filtered.filter((it) => it.quantity > 0);
    } else if (status === 'ZERO') {
      filtered = filtered.filter((it) => it.quantity === 0);
    } else if (status === 'NEGATIVE') {
      filtered = filtered.filter((it) => it.quantity < 0);
    }

    if (q) {
      filtered = filtered.filter(
        (it) =>
          it.itemCode.toLowerCase().includes(q) ||
          it.description.toLowerCase().includes(q) ||
          it.perusahaan.toLowerCase().includes(q)
      );
    }

    return NextResponse.json({
      success: true,
      fromR2: isR2Configured(),
      summary: data.summary,
      totalCount: data.items.length,
      totalFiltered: filtered.length,
      items: filtered,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error?.message || 'Gagal memuat data persediaan' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get('content-type') || '';

    // Direct JSON sync payload from client
    if (contentType.includes('application/json')) {
      const body = await req.json();
      if (Array.isArray(body?.items)) {
        const items = body.items;
        const summary = body.summary || calculateInventorySummary(items);
        cachedItems = items;
        cachedSummary = summary;
        await saveToR2(items, summary);
        return NextResponse.json({
          success: true,
          message: `Berhasil menyinkronkan ${items.length.toLocaleString('id-ID')} item persediaan ke Cloudflare R2!`,
          summary,
          items,
        });
      }
    }

    // FormData Excel upload
    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ success: false, message: 'File tidak ditemukan' }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const result = parseInventoryWorkbook(workbook);

    if (result.items.length === 0) {
      return NextResponse.json(
        { success: false, message: 'Tidak ada baris data persediaan yang valid ditemukan di file Excel ini' },
        { status: 400 }
      );
    }

    cachedItems = result.items;
    cachedSummary = result.summary;

    // Simpan ke Cloudflare R2
    await saveToR2(result.items, result.summary);

    return NextResponse.json({
      success: true,
      message: `Berhasil mengimpor ${result.items.length} item stok persediaan & tersinkron ke Cloudflare R2!`,
      summary: result.summary,
      items: result.items,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error?.message || 'Gagal mengunggah file' },
      { status: 500 }
    );
  }
}
