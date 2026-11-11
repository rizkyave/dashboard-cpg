import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { FpbReviewRecord } from '@/types/fpbReview';
import { isR2Configured, listR2Objects } from '@/utils/r2Client';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const runtime = 'nodejs';

const LOCAL_REVIEWS_PATH = path.join(process.cwd(), 'src', 'data', 'fpb-reviews.json');
const LOCAL_PDF_DIR = path.join(process.cwd(), 'public', 'uploads', 'fpb');

function extractFpbNumberFromFilename(filename: string): string {
  return filename
    .replace(/\.pdf$/i, '')
    .replace(/^(?:logistik_)?Approved_rev_sign_/i, '')
    .trim();
}

/**
 * Endpoint Sinkronisasi e-FPB Mode Mandiri
 * Semua pemanggilan otomatis ke server eksternal IT (e-fpb.cindaragroup.com) dinonaktifkan
 * untuk mencegah alarm firewall dan pemblokiran dari tim IT.
 * Endpoint ini sekarang berfungsi untuk membaca daftar PDF FPB di R2/lokal
 * serta menerima data import file Excel/CSV/JSON secara mandiri.
 */
export async function GET(req: NextRequest) {
  try {
    let records: FpbReviewRecord[] = [];
    if (fs.existsSync(LOCAL_REVIEWS_PATH)) {
      records = JSON.parse(fs.readFileSync(LOCAL_REVIEWS_PATH, 'utf-8'));
    }

    const fileMap = new Map<
      string,
      { fpbNumber: string; filename: string; url: string; source: 'r2' | 'local' }
    >();

    // 1. Pindai berkas PDF FPB yang tersimpan di Cloudflare R2
    if (isR2Configured()) {
      const prefixes = ['fpb-signed/', 'fpb-pdfs/', 'fpb-raw/', 'dashboard-metadata/fpb-pdfs/'];
      const results = await Promise.all(prefixes.map((pfx) => listR2Objects(pfx, 1000)));
      for (const objs of results) {
        for (const obj of objs) {
          if (!/\.pdf$/i.test(obj.name)) continue;
          const fpbNumber = extractFpbNumberFromFilename(obj.name);
          if (!fpbNumber) continue;
          const normKey = fpbNumber.toLowerCase();
          if (!fileMap.has(normKey)) {
            fileMap.set(normKey, {
              fpbNumber,
              filename: obj.name,
              url: `/api/review-fpb/pdf?fpbNo=${encodeURIComponent(fpbNumber)}&type=signed`,
              source: 'r2',
            });
          }
        }
      }
    }

    // 2. Pindai berkas PDF FPB di folder lokal (jika ada)
    if (fs.existsSync(LOCAL_PDF_DIR)) {
      for (const name of fs.readdirSync(LOCAL_PDF_DIR)) {
        if (!/\.pdf$/i.test(name)) continue;
        const fpbNumber = extractFpbNumberFromFilename(name);
        if (!fpbNumber) continue;
        const normKey = fpbNumber.toLowerCase();
        if (!fileMap.has(normKey)) {
          fileMap.set(normKey, {
            fpbNumber,
            filename: name,
            url: `/api/review-fpb/pdf?fpbNo=${encodeURIComponent(fpbNumber)}&type=signed`,
            source: 'local',
          });
        }
      }
    }

    const files = Array.from(fileMap.values());

    return NextResponse.json({
      success: true,
      mode: 'standalone',
      message: 'Mode Mandiri Aktif. Sinkronisasi otomatis ke server IT telah dinonaktifkan demi keamanan.',
      totalRecords: records.length,
      records,
      totalFiles: files.length,
      files,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error?.message || 'Gagal membaca data lokal.' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const newRecords: FpbReviewRecord[] = Array.isArray(body?.records) ? body.records : [];

    if (newRecords.length === 0) {
      return NextResponse.json(
        {
          success: true,
          mode: 'standalone',
          message: 'Mode Mandiri Aktif: Tidak ada request ke server eksternal IT.',
          importedCount: 0,
        }
      );
    }

    let existing: FpbReviewRecord[] = [];
    if (fs.existsSync(LOCAL_REVIEWS_PATH)) {
      existing = JSON.parse(fs.readFileSync(LOCAL_REVIEWS_PATH, 'utf-8'));
    }

    let added = 0;
    let updated = 0;

    for (const rec of newRecords) {
      if (!rec.fpbNo) continue;
      const idx = existing.findIndex((e) => e.fpbNo.toLowerCase() === rec.fpbNo.toLowerCase());
      if (idx >= 0) {
        existing[idx] = { ...existing[idx], ...rec, updatedAt: new Date().toISOString() };
        updated++;
      } else {
        existing.unshift({
          ...rec,
          id: rec.id || `fpb-rev-${rec.fpbNo}`,
          createdAt: rec.createdAt || new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
        added++;
      }
    }

    fs.writeFileSync(LOCAL_REVIEWS_PATH, JSON.stringify(existing, null, 2), 'utf-8');

    return NextResponse.json({
      success: true,
      mode: 'standalone',
      message: `Berhasil mengimpor data secara mandiri: ${added} baru, ${updated} diperbarui.`,
      addedCount: added,
      updatedCount: updated,
      totalCount: existing.length,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error?.message || 'Gagal menyimpan data import.' },
      { status: 500 }
    );
  }
}
