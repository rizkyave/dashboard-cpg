import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import * as XLSX from 'xlsx';
import { parseSisaLayananWorkbook, calculateSisaLayananSummary } from '@/utils/sisaLayananParser';
import { SisaLayananItem, SisaLayananSummary } from '@/types/sisaLayanan';

// In-memory server cache
let cachedItems: SisaLayananItem[] | null = null;
let cachedSummary: SisaLayananSummary | null = null;

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
    const { items, summary } = loadInitialFromDisk();

    const { searchParams } = new URL(req.url);
    const q = searchParams.get('q')?.toLowerCase()?.trim();
    const status = searchParams.get('status')?.toUpperCase()?.trim();
    const pt = searchParams.get('pt')?.toUpperCase()?.trim();
    const departement = searchParams.get('departement')?.toLowerCase()?.trim();

    let filtered = items;

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
      summary,
      totalCount: items.length,
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

    // Simpan file ke root project agar tersimpan permanen
    try {
      const destPath = path.join(process.cwd(), 'Laporan_Sisa_Layanan_Gabungan.xlsx');
      fs.writeFileSync(destPath, buffer);
    } catch (saveErr) {
      console.warn('Gagal menyimpan file ke disk:', saveErr);
    }

    return NextResponse.json({
      success: true,
      message: `Berhasil memuat ${result.items.length.toLocaleString('id-ID')} item Laporan Sisa Layanan Gabungan!`,
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

