import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { InventoryItem } from '@/types/procurement';
import { calculateInventorySummary } from '@/utils/inventoryParser';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

const LOCAL_INVENTORY_PATH = path.join(process.cwd(), 'src', 'data', 'initialInventoryData.json');

/**
 * Endpoint Persediaan Barang Accurate (Mode Mandiri)
 * Dinonaktifkan dari scraping e-fpb.cindaragroup.com demi keamanan sistem.
 * Menggunakan data lokal atau file unggah Excel Accurate mandiri.
 */
export async function POST(req: NextRequest) {
  try {
    let items: InventoryItem[] = [];

    if (fs.existsSync(LOCAL_INVENTORY_PATH)) {
      items = JSON.parse(fs.readFileSync(LOCAL_INVENTORY_PATH, 'utf-8'));
    }

    const summary = calculateInventorySummary(items);

    return NextResponse.json({
      success: true,
      mode: 'standalone',
      message: 'Mode Mandiri: Menggunakan data persediaan master lokal/R2 tanpa menghubungi server IT.',
      count: items.length,
      items,
      summary,
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, message: err?.message || 'Gagal memproses data stok.' },
      { status: 500 }
    );
  }
}
