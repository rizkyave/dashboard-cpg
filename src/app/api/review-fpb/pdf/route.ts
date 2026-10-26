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
    // 1. Cek apakah di server e-FPB sudah ada file resmi logistik_Approved_rev_sign_*.pdf
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

    // 2. Jika di e-FPB belum ada dan status di database belum disetujui, kembalikan dokumen asli (belum bertanda tangan)
    const reviewRecord = await getReviewRecord(cleanFpb);
    if (!reviewRecord?.isReceivedLogistik) {
      const baseRes = await fetch(rawUrl, { cache: 'no-store' });
      if (baseRes.ok) {
        const baseBuffer = Buffer.from(await baseRes.arrayBuffer());
        return new NextResponse(new Uint8Array(baseBuffer), {
          headers: {
            'Content-Type': 'application/pdf',
            'Content-Disposition': `inline; filename="Approved_rev_sign_${cleanFpb}.pdf"`,
            'Cache-Control': 'public, max-age=1800',
          },
        });
      }
    }

    // 3. Jika status internal sudah disahkan, cek R2 atau generate dynamic stamp
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
      } catch (r2Err) {}
    }

    // Fallback ambil dokumen base dari e-FPB
    const baseRes = await fetch(rawUrl, { cache: 'no-store' });
    if (!baseRes.ok) {
      return NextResponse.json({ error: `Dokumen base FPB ${cleanFpb} tidak ditemukan di e-FPB.` }, { status: 404 });
    }
    const baseBuffer = Buffer.from(await baseRes.arrayBuffer());

    const signerName = reviewRecord?.reviewedBy || 'NOOR HASANAH';
    const reviewedAt = reviewRecord?.reviewedAt ? new Date(reviewRecord.reviewedAt) : new Date();

    const stampedBuffer = await stampFpbPdf({
      pdfBuffer: baseBuffer,
      signerName,
      signDate: formatToStampDate(reviewedAt),
      receivedAt: formatToStampTimestamp(reviewedAt),
    });

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
