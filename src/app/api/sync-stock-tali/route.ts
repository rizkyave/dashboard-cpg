import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { StockTaliItem } from '@/types/stockTali';
import {
  STOCK_TALI_SHEET_URL,
  STOCK_TALI_CSV_EXPORT_URL,
  parseCsvRows,
  computeSummary,
} from '@/utils/stockTaliParser';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

const LOCAL_DATA_PATH = path.join(process.cwd(), 'src', 'data', 'stock-tali-data.json');

// GET: Ambil data mutasi stock tali dari file lokal atau Google Sheets
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const forceFresh = searchParams.get('fresh') === 'true';

    if (!forceFresh && fs.existsSync(LOCAL_DATA_PATH)) {
      try {
        const fileContent = fs.readFileSync(LOCAL_DATA_PATH, 'utf-8');
        const parsed = JSON.parse(fileContent);
        const items: StockTaliItem[] = parsed.items || [];
        const summary = computeSummary(items);
        return NextResponse.json({
          success: true,
          updatedAt: parsed.updatedAt || new Date().toISOString(),
          sourceUrl: parsed.sourceUrl || STOCK_TALI_SHEET_URL,
          total: items.length,
          items,
          summary,
        });
      } catch (readErr) {
        console.warn('Gagal membaca cache lokal stock tali, fetching fresh...', readErr);
      }
    }

    // Fetch fresh from Google Sheets
    const res = await fetch(STOCK_TALI_CSV_EXPORT_URL, {
      cache: 'no-store',
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
    });

    if (!res.ok) {
      return NextResponse.json(
        { success: false, message: `Gagal mengunduh CSV Google Sheets: HTTP ${res.status}` },
        { status: 502 }
      );
    }

    const csvText = await res.text();
    const items = parseCsvRows(csvText);
    const summary = computeSummary(items);
    const updatedAt = new Date().toISOString();

    // Cache ke disk
    try {
      fs.writeFileSync(
        LOCAL_DATA_PATH,
        JSON.stringify(
          {
            updatedAt,
            sourceUrl: STOCK_TALI_SHEET_URL,
            total: items.length,
            items,
          },
          null,
          2
        ),
        'utf-8'
      );
    } catch (saveErr) {
      console.warn('Gagal menyimpan cache stock-tali-data.json:', saveErr);
    }

    return NextResponse.json({
      success: true,
      message: `Berhasil memuat ${items.length} data mutasi stock tali.`,
      updatedAt,
      sourceUrl: STOCK_TALI_SHEET_URL,
      total: items.length,
      items,
      summary,
    });
  } catch (err: any) {
    console.error('Error in GET /api/sync-stock-tali:', err);
    return NextResponse.json(
      { success: false, message: err.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}

// POST: Sinkronkan langsung dari Google Sheets (ditekan dari tombol UI)
export async function POST(req: NextRequest) {
  try {
    let targetUrl = STOCK_TALI_CSV_EXPORT_URL;
    try {
      const body = await req.json();
      if (body?.url) {
        const trimmed = body.url.trim();
        const gidMatch = trimmed.match(/gid=([0-9]+)/);
        const idMatch = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
        if (idMatch && idMatch[1]) {
          const gid = gidMatch && gidMatch[1] ? gidMatch[1] : '2021352613';
          targetUrl = `https://docs.google.com/spreadsheets/d/${idMatch[1]}/export?format=csv&gid=${gid}`;
        }
      }
    } catch {}

    const res = await fetch(targetUrl, {
      cache: 'no-store',
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
    });

    if (!res.ok) {
      return NextResponse.json(
        { success: false, message: `Gagal menghubungi Google Sheets: HTTP ${res.status}` },
        { status: 502 }
      );
    }

    const csvText = await res.text();
    const items = parseCsvRows(csvText);
    const summary = computeSummary(items);
    const updatedAt = new Date().toISOString();

    // Cache ke disk
    try {
      fs.writeFileSync(
        LOCAL_DATA_PATH,
        JSON.stringify(
          {
            updatedAt,
            sourceUrl: STOCK_TALI_SHEET_URL,
            total: items.length,
            items,
          },
          null,
          2
        ),
        'utf-8'
      );
    } catch (saveErr) {
      console.warn('Gagal menyimpan cache stock-tali-data.json:', saveErr);
    }

    return NextResponse.json({
      success: true,
      message: `Berhasil menyinkronkan ${items.length} berkas mutasi stock tali dari Google Sheets!`,
      updatedAt,
      sourceUrl: STOCK_TALI_SHEET_URL,
      total: items.length,
      items,
      summary,
    });
  } catch (err: any) {
    console.error('Error in POST /api/sync-stock-tali:', err);
    return NextResponse.json(
      { success: false, message: err.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}
