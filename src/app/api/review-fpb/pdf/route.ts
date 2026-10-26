import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { stampFpbPdf, formatToStampDate, formatToStampTimestamp } from '@/utils/fpbStamper';
import { isR2Configured, getObjectFromR2, uploadToR2 } from '@/utils/r2Client';
import { FpbReviewRecord } from '@/types/fpbReview';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const maxDuration = 60;

const LOCAL_REVIEWS_PATH = path.join(process.cwd(), 'src', 'data', 'fpb-reviews.json');

async function getReviewRecord(fpbNo: string): Promise<FpbReviewRecord | null> {
  try {
    if (fs.existsSync(LOCAL_REVIEWS_PATH)) {
      const raw = fs.readFileSync(LOCAL_REVIEWS_PATH, 'utf-8');
      const records: FpbReviewRecord[] = JSON.parse(raw);
      const match = records.find((r) => r.fpbNo.toLowerCase() === fpbNo.toLowerCase());
      if (match) return match;
    }
  } catch (err) {
    console.warn('[review-fpb/pdf] Gagal membaca fpb-reviews.json:', err);
  }
  return null;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const fpbNo = searchParams.get('fpbNo')?.trim();
    const type = (searchParams.get('type') || 'signed').toLowerCase();

    if (!fpbNo) {
      return NextResponse.json({ error: 'Parameter fpbNo diperlukan' }, { status: 400 });
    }

    const cleanFpb = fpbNo;
    const rawUrl = `https://e-fpb.cindaragroup.com/files/Approved_rev_sign_${encodeURIComponent(cleanFpb)}.pdf`;
    const logistikUrl = `https://e-fpb.cindaragroup.com/files/logistik_Approved_rev_sign_${encodeURIComponent(cleanFpb)}.pdf`;

    // Mode: Dokumen Asli Pemohon (Raw)
    if (type === 'raw') {
      const rawRes = await fetch(rawUrl, { cache: 'no-store' });
      if (!rawRes.ok) {
        return NextResponse.json({ error: `Dokumen asli FPB ${cleanFpb} tidak ditemukan.` }, { status: 404 });
      }
      const rawBuffer = Buffer.from(await rawRes.arrayBuffer());
      return new NextResponse(new Uint8Array(rawBuffer), {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `inline; filename="Asli_${cleanFpb}.pdf"`,
          'Cache-Control': 'public, max-age=3600',
        },
      });
    }

    // Mode: Dokumen Bertanda Tangan Logistik (Signed)
    // 1. Cek apakah di server e-FPB sudah ada file logistik_Approved_rev_sign_*.pdf
    try {
      const headRes = await fetch(logistikUrl, { method: 'HEAD', cache: 'no-store' });
      if (headRes.ok) {
        const fullRes = await fetch(logistikUrl, { cache: 'no-store' });
        if (fullRes.ok) {
          const buf = Buffer.from(await fullRes.arrayBuffer());
          return new NextResponse(new Uint8Array(buf), {
            headers: {
              'Content-Type': 'application/pdf',
              'Content-Disposition': `inline; filename="logistik_Approved_rev_sign_${cleanFpb}.pdf"`,
              'Cache-Control': 'public, max-age=3600',
            },
          });
        }
      }
    } catch (e) {
      console.warn(`[review-fpb/pdf] Gagal fetch logistikUrl untuk ${cleanFpb}:`, e);
    }

    // 2. Jika tidak ada di e-FPB, cek Cloudflare R2 untuk versi stamped yang pernah digenerate
    const r2Key = `fpb-signed/${cleanFpb}.pdf`;
    if (isR2Configured()) {
      try {
        const r2Obj = await getObjectFromR2(r2Key);
        if (r2Obj && r2Obj.body) {
          return new NextResponse(new Uint8Array(r2Obj.body), {
            headers: {
              'Content-Type': 'application/pdf',
              'Content-Disposition': `inline; filename="logistik_Approved_rev_sign_${cleanFpb}.pdf"`,
              'Cache-Control': 'public, max-age=86400',
            },
          });
        }
      } catch (r2Err) {
        // Abaikan jika belum ada di R2, lanjutkan ke dynamic stamp
      }
    }

    // 3. Generate dynamic stamp jika belum ada
    // Ambil dokumen base dari e-FPB
    const baseRes = await fetch(rawUrl, { cache: 'no-store' });
    if (!baseRes.ok) {
      return NextResponse.json({ error: `Dokumen base FPB ${cleanFpb} tidak ditemukan di e-FPB.` }, { status: 404 });
    }
    const baseBuffer = Buffer.from(await baseRes.arrayBuffer());

    // Ambil metadata review (penandatangan & tanggal)
    const reviewRecord = await getReviewRecord(cleanFpb);
    const signerName = reviewRecord?.reviewedBy || 'NOOR HASANAH';
    const reviewedAt = reviewRecord?.reviewedAt ? new Date(reviewRecord.reviewedAt) : new Date();

    const stampedBuffer = await stampFpbPdf({
      pdfBuffer: baseBuffer,
      signerName,
      signDate: formatToStampDate(reviewedAt),
      receivedAt: formatToStampTimestamp(reviewedAt),
    });

    // Simpan ke Cloudflare R2 di background agar request berikutnya instan
    if (isR2Configured()) {
      uploadToR2({
        key: r2Key,
        body: stampedBuffer,
        contentType: 'application/pdf',
      }).catch((err) => {
        console.warn(`[review-fpb/pdf] Gagal upload stamped PDF ke R2 untuk ${cleanFpb}:`, err);
      });
    }

    return new NextResponse(new Uint8Array(stampedBuffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="logistik_Approved_rev_sign_${cleanFpb}.pdf"`,
        'Cache-Control': 'public, max-age=86400',
      },
    });
  } catch (error: any) {
    console.error('Error in GET /api/review-fpb/pdf:', error);
    return NextResponse.json(
      { error: error.message || 'Gagal memproses dokumen PDF FPB.' },
      { status: 500 }
    );
  }
}
