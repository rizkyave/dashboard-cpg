import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { FpbReviewRecord } from '@/types/fpbReview';
import { isR2Configured, listR2Objects, getObjectFromR2, uploadToR2 } from '@/utils/r2Client';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const runtime = 'nodejs';

const R2_FPB_REVIEWS_KEY = 'fpb-metadata/reviews.json';
const LOCAL_REVIEWS_PATH = path.join(process.cwd(), 'src', 'data', 'fpb-reviews.json');
const LOCAL_PDF_DIR = path.join(process.cwd(), 'public', 'uploads', 'fpb');

function extractFpbNumberFromFilename(filename: string): string {
  const cleaned = filename
    .replace(/\.pdf$/i, '')
    .replace(/^(?:logistik_)?Approved_rev_sign_/i, '')
    .replace(/\/LOG\/FPB\//i, '-FPB-')
    .trim();
  const match = cleaned.match(/([A-Z0-9]+-FPB-\d+-\d+)/i);
  return match ? match[1].toUpperCase() : cleaned;
}

async function loadReviewsFromR2OrLocal(): Promise<FpbReviewRecord[]> {
  if (isR2Configured()) {
    try {
      const obj = await getObjectFromR2(R2_FPB_REVIEWS_KEY);
      if (obj?.body) {
        const parsed = JSON.parse(Buffer.from(obj.body).toString('utf-8'));
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
  }
  if (fs.existsSync(LOCAL_REVIEWS_PATH)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(LOCAL_REVIEWS_PATH, 'utf-8'));
      if (Array.isArray(parsed)) return parsed;
    } catch {}
  }
  return [];
}

async function saveReviewsToR2AndLocal(records: FpbReviewRecord[]): Promise<void> {
  const jsonStr = JSON.stringify(records, null, 2);
  if (isR2Configured()) {
    try {
      await uploadToR2({
        key: R2_FPB_REVIEWS_KEY,
        body: Buffer.from(jsonStr, 'utf-8'),
        contentType: 'application/json',
        cacheControl: 'no-cache, no-store, must-revalidate',
      });
    } catch (err) {
      console.warn('[sync-efpb-files] Gagal menyimpan reviews.json ke R2:', err);
    }
  }
  try {
    fs.writeFileSync(LOCAL_REVIEWS_PATH, jsonStr, 'utf-8');
  } catch {}
}

/**
 * Endpoint Sinkronisasi e-FPB Mode Mandiri (Cloudflare R2 Single Source of Truth)
 * Semua pemanggilan otomatis ke server eksternal IT (e-fpb.cindaragroup.com) dinonaktifkan
 * untuk mencegah alarm firewall dan pemblokiran dari tim IT.
 */
export async function GET(req: NextRequest) {
  try {
    const records = await loadReviewsFromR2OrLocal();

    const fileMap = new Map<
      string,
      { fpbNumber: string; filename: string; url: string; source: 'r2' | 'local' }
    >();

    // 1. Pindai berkas PDF FPB yang tersimpan di Cloudflare R2 (sumber utama lintas domain Vercel/Railway/lokal)
    if (isR2Configured()) {
      const prefixes = ['fpb-signed/', 'fpb-pdfs/', 'fpb-raw/', 'dashboard-metadata/fpb-pdfs/'];
      const results = await Promise.all(prefixes.map((pfx) => listR2Objects(pfx, 5000)));
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

    // 2. Pindai folder lokal; jika ada PDF lokal yang belum masuk R2, otomatis unggah ke R2
    if (fs.existsSync(LOCAL_PDF_DIR)) {
      for (const name of fs.readdirSync(LOCAL_PDF_DIR)) {
        if (!/\.pdf$/i.test(name)) continue;
        const fpbNumber = extractFpbNumberFromFilename(name);
        if (!fpbNumber) continue;
        const normKey = fpbNumber.toLowerCase();
        if (!fileMap.has(normKey)) {
          let source: 'r2' | 'local' = 'local';
          if (isR2Configured()) {
            try {
              const buffer = fs.readFileSync(path.join(LOCAL_PDF_DIR, name));
              await uploadToR2({
                key: `fpb-pdfs/${fpbNumber}.pdf`,
                body: buffer,
                contentType: 'application/pdf',
              });
              source = 'r2';
            } catch (err) {
              console.warn(`[sync-efpb-files] Gagal migrasi ${name} ke R2:`, err);
            }
          }
          fileMap.set(normKey, {
            fpbNumber,
            filename: name,
            url: `/api/review-fpb/pdf?fpbNo=${encodeURIComponent(fpbNumber)}&type=signed`,
            source,
          });
        }
      }
    }

    const files = Array.from(fileMap.values());

    return NextResponse.json({
      success: true,
      mode: 'standalone',
      storage: isR2Configured() ? 'CLOUDFLARE_R2' : 'LOCAL_DISK',
      message: 'Mode Mandiri Aktif. Berkas PDF FPB disinkronkan dari Cloudflare R2.',
      totalRecords: records.length,
      records,
      totalFiles: files.length,
      files,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error?.message || 'Gagal membaca data FPB.' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const newRecords: FpbReviewRecord[] = Array.isArray(body?.records) ? body.records : [];

    if (newRecords.length === 0) {
      return NextResponse.json({
        success: true,
        mode: 'standalone',
        message: 'Mode Mandiri Aktif: Tidak ada request ke server eksternal IT.',
        importedCount: 0,
      });
    }

    const existing = await loadReviewsFromR2OrLocal();

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

    await saveReviewsToR2AndLocal(existing);

    return NextResponse.json({
      success: true,
      mode: 'standalone',
      message: `Berhasil mengimpor data ke Cloudflare R2: ${added} baru, ${updated} diperbarui.`,
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
