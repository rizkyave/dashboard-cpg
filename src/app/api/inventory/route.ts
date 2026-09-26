import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import * as XLSX from 'xlsx';
import { parseInventoryWorkbook, calculateInventorySummary } from '@/utils/inventoryParser';
import { InventoryItem, InventorySummary } from '@/types/procurement';

// Server-side memory cache for instantaneous response
let cachedItems: InventoryItem[] | null = null;
let cachedSummary: InventorySummary | null = null;

function loadInitialFromDisk() {
  if (cachedItems && cachedSummary) {
    return { items: cachedItems, summary: cachedSummary };
  }

  // Priority paths to search for the consolidated inventory file
  const candidatePaths = [
    path.join(process.cwd(), 'Daftar_Barang_Gabungan_Semua_Perusahaan.xlsx'),
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
    const { items, summary } = loadInitialFromDisk();

    const { searchParams } = new URL(req.url);
    const q = searchParams.get('q')?.toLowerCase()?.trim();
    const entity = searchParams.get('entity');
    const status = searchParams.get('status');

    let filtered = items;

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
      summary,
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

    return NextResponse.json({
      success: true,
      message: `Berhasil mengimpor ${result.items.length} item stok persediaan!`,
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
