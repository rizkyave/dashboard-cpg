import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
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

const R2_SISA_LAYANAN_KEY = 'dashboard-metadata/sisa-layanan.json';

// In-memory server cache
let cachedItems: SisaLayananItem[] | null = null;
let cachedSummary: SisaLayananSummary | null = null;

async function loadFromR2(): Promise<{ items: SisaLayananItem[]; summary: SisaLayananSummary } | null> {
  if (!isR2Configured()) return null;
  try {
    const obj = await getObjectFromR2(R2_SISA_LAYANAN_KEY);
    if (obj && obj.body) {
      const text = Buffer.from(obj.body).toString('utf8');
      const parsed = JSON.parse(text);
      if (parsed && Array.isArray(parsed.items) && parsed.items.length > 0) {
        return {
          items: parsed.items,
          summary: parsed.summary || calculateSisaLayananSummary(parsed.items),
        };
      }
    }
  } catch (err) {
    console.warn('Gagal membaca sisa-layanan dari Cloudflare R2:', err);
  }
  return null;
}

async function saveToR2(items: SisaLayananItem[], summary: SisaLayananSummary): Promise<boolean> {
  if (!isR2Configured()) return false;
  try {
    const payload = JSON.stringify({ items, summary });
    await uploadToR2({
      key: R2_SISA_LAYANAN_KEY,
      body: Buffer.from(payload, 'utf8'),
      contentType: 'application/json',
    });
    return true;
  } catch (err) {
    console.warn('Gagal menyimpan sisa-layanan ke Cloudflare R2:', err);
    return false;
  }
}

function loadInitialFromDisk(): { items: SisaLayananItem[]; summary: SisaLayananSummary } {
  if (cachedItems && cachedSummary) {
    return { items: cachedItems, summary: cachedSummary };
  }

  const candidatePaths = [
    path.join(process.cwd(), 'Laporan_Sisa_Layanan_Gabungan.xlsx'),
    path.join(process.cwd(), '..', 'Laporan_Sisa_Layanan_Gabungan.xlsx'),
  ];

  for (const filePath of candidatePaths) {
    if (fs.existsSync(filePath)) {
      try {
        const buffer = fs.readFileSync(filePath);
        const workbook = XLSX.read(buffer, { type: 'buffer' });
        const result = parseSisaLayananWorkbook(workbook);
        if (result.items.length > 0) {
          cachedItems = result.items;
          cachedSummary = result.summary;
          return result;
        }
      } catch (err) {
        console.error('Gagal membaca file Excel Sisa Layanan di', filePath, err);
      }
    }
  }

  const emptySummary = calculateSisaLayananSummary([]);
  return { items: [], summary: emptySummary };
}

export async function GET(req: NextRequest) {
  try {
    let data: { items: SisaLayananItem[]; summary: SisaLayananSummary } | null = null;

    // 1. Coba baca dari Cloudflare R2 terlebih dahulu
    data = await loadFromR2();

    // 2. Fallback ke disk jika belum ada di R2
    if (!data || data.items.length === 0) {
      data = loadInitialFromDisk();
      // Seed data awal ke R2 jika berhasil membaca dari disk
      if (data.items.length > 0 && isR2Configured()) {
        saveToR2(data.items, data.summary).catch(() => {});
      }
    }

    cachedItems = data.items;
    cachedSummary = data.summary;

    const { searchParams } = new URL(req.url);
    const q = searchParams.get('q')?.toLowerCase()?.trim();
    const status = searchParams.get('status')?.toUpperCase()?.trim();
    const pt = searchParams.get('pt')?.toUpperCase()?.trim();
    const departement = searchParams.get('departement')?.toLowerCase()?.trim();

    let filtered = data.items;

    if (status && status !== 'ALL') {
      filtered = filtered.filter((it) => it.status === status);
    }

    if (pt && pt !== 'ALL') {
      filtered = filtered.filter((it) => it.pt === pt);
    }

    if (departement && departement !== 'ALL') {
      filtered = filtered.filter((it) => it.departement.toLowerCase().includes(departement));
    }

    if (q) {
      filtered = filtered.filter(
        (it) =>
          (it.noFpb || '').toLowerCase().includes(q) ||
          (it.noPo || '').toLowerCase().includes(q) ||
          (it.noFstb || '').toLowerCase().includes(q) ||
          (it.noTtb || '').toLowerCase().includes(q) ||
          (it.kodeBarang || '').toLowerCase().includes(q) ||
          (it.namaBarang || '').toLowerCase().includes(q) ||
          (it.departement || '').toLowerCase().includes(q) ||
          (it.keterangan || '').toLowerCase().includes(q)
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
    console.error('Error GET /api/sisa-layanan:', error);
    return NextResponse.json(
      { success: false, message: error?.message || 'Gagal memuat data Sisa Layanan Gabungan' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get('content-type') || '';

    // Handle direct JSON payload (e.g. sync from client)
    if (contentType.includes('application/json')) {
      const body = await req.json();
      if (Array.isArray(body?.items)) {
        const items = body.items;
        const summary = body.summary || calculateSisaLayananSummary(items);
        cachedItems = items;
        cachedSummary = summary;
        await saveToR2(items, summary);
        return NextResponse.json({
          success: true,
          message: `Berhasil menyinkronkan ${items.length.toLocaleString('id-ID')} item Sisa Layanan ke Cloudflare R2!`,
          summary,
          items,
        });
      }
    }

    // Handle FormData Excel upload
    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ success: false, message: 'File tidak ditemukan' }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const result = parseSisaLayananWorkbook(workbook);

    if (result.items.length === 0) {
      return NextResponse.json(
        {
          success: false,
          message:
            'Tidak ada baris data valid ditemukan. Pastikan file berisi kolom NO. FPB, KODE BARANG, dan NAMA BARANG.',
        },
        { status: 400 }
      );
    }

    cachedItems = result.items;
    cachedSummary = result.summary;

    // Simpan ke Cloudflare R2 agar tersimpan permanen & tersinkron di semua device
    await saveToR2(result.items, result.summary);

    // Simpan file ke root project jika memungkinkan (non-fatal di serverless)
    try {
      const destPath = path.join(process.cwd(), 'Laporan_Sisa_Layanan_Gabungan.xlsx');
      fs.writeFileSync(destPath, buffer);
    } catch (saveErr) {
      // Non-fatal di Vercel read-only filesystem
    }

    return NextResponse.json({
      success: true,
      message: `Berhasil memuat ${result.items.length.toLocaleString('id-ID')} item Laporan Sisa Layanan Gabungan & tersinkron ke Cloudflare R2!`,
      summary: result.summary,
      items: result.items,
    });
  } catch (error: any) {
    console.error('Error POST /api/sisa-layanan:', error);
    return NextResponse.json(
      { success: false, message: error?.message || 'Gagal mengunggah file' },
      { status: 500 }
    );
  }
}
