import { NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import fs from 'fs';
import path from 'path';
import { parseAndMergeWorkbook } from '@/utils/excelParser';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function findLatestLocalProcurementFile(): { buffer: Buffer; fileName: string } | null {
  const candidateDirs = [
    process.cwd(),
    ...(process.env.USERPROFILE
      ? [
          path.join(process.env.USERPROFILE, 'Downloads'),
          path.join(process.env.USERPROFILE, 'Desktop'),
        ]
      : []),
  ];

  let bestFile: { filePath: string; mtime: number; version: number } | null = null;

  for (const dir of Array.from(new Set(candidateDirs))) {
    if (!fs.existsSync(dir)) continue;
    try {
      const files = fs.readdirSync(dir);
      for (const file of files) {
        if (!file.endsWith('.xlsx')) continue;
        const lower = file.toLowerCase();
        if (
          lower.includes('monitoring berkas internal procurement') ||
          lower.includes('monitoring_berkas_internal_procurement') ||
          lower.includes('monitoring berkas procurement')
        ) {
          const fullPath = path.join(dir, file);
          const stat = fs.statSync(fullPath);
          const vMatch = file.match(/\((\d+)\)/);
          const version = vMatch ? parseInt(vMatch[1], 10) : (lower.includes('latest') ? 999 : 0);
          const score = version * 10000000000000 + stat.mtimeMs;

          if (!bestFile || score > (bestFile.version * 10000000000000 + bestFile.mtime)) {
            bestFile = { filePath: fullPath, mtime: stat.mtimeMs, version };
          }
        }
      }
    } catch {
      // Abaikan folder tanpa izin baca
    }
  }

  if (bestFile) {
    try {
      const buffer = fs.readFileSync(bestFile.filePath);
      return { buffer, fileName: path.basename(bestFile.filePath) };
    } catch {
      return null;
    }
  }
  return null;
}

export async function GET() {
  try {
    const local = findLatestLocalProcurementFile();
    if (!local) {
      return NextResponse.json(
        {
          success: false,
          message:
            'Tidak ditemukan file Excel Monitoring Berkas Internal Procurement di folder Downloads atau komputer.',
        },
        { status: 404 }
      );
    }

    const workbook = XLSX.read(local.buffer, { type: 'buffer' });
    const result = parseAndMergeWorkbook(workbook);

    return NextResponse.json({
      success: true,
      message: `Berhasil memuat ${result.procurement.length.toLocaleString('id-ID')} data dari ${local.fileName}!`,
      fileName: local.fileName,
      stats: result.stats,
      sheetNames: workbook.SheetNames,
      procurement: result.procurement,
      armada: result.armada,
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error('Error in GET /api/load-desktop-excel:', err);
    return NextResponse.json(
      { success: false, message: err?.message || 'Gagal memuat file Excel desktop.' },
      { status: 500 }
    );
  }
}

export async function POST() {
  return GET();
}
