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
const LOCAL_PDF_DIR = path.join(process.cwd(), 'public', 'uploads', 'fpb');

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

/**
 * PDF Resolver Mode Mandiri:
 * Membaca HANYA dari Cloudflare R2 dan penyimpanan lokal dashboard internal.
 * TIDAK PERNAH menghubungi e-fpb.cindaragroup.com demi keamanan sistem.
 */
async function resolveLocalOrR2Pdf(
  cleanFpb: string,
  type: string = 'signed'
): Promise<{ buffer: Buffer; filename: string } | null> {
  const enc = encodeURIComponent(cleanFpb);

  // 1. Cek Cloudflare R2
  if (isR2Configured()) {
    const r2Keys = [
      type === 'signed' ? `fpb-signed/${cleanFpb}.pdf` : null,
      `fpb-raw/${cleanFpb}.pdf`,
      `fpb-pdfs/${cleanFpb}.pdf`,
      `dashboard-metadata/fpb-pdfs/${cleanFpb}.pdf`,
    ].filter(Boolean) as string[];

    for (const key of r2Keys) {
      try {
        const obj = await getObjectFromR2(key);
        if (obj && obj.body) {
          return {
            buffer: Buffer.from(obj.body),
            filename: `${cleanFpb}.pdf`,
          };
        }
      } catch {
        // Continue to next key
      }
    }
  }

  // 2. Cek penyimpanan file lokal
  if (fs.existsSync(LOCAL_PDF_DIR)) {
    const candidateFiles = [
      path.join(LOCAL_PDF_DIR, `${cleanFpb}.pdf`),
      path.join(LOCAL_PDF_DIR, `Approved_rev_sign_${cleanFpb}.pdf`),
      path.join(LOCAL_PDF_DIR, `logistik_Approved_rev_sign_${cleanFpb}.pdf`),
    ];
    for (const p of candidateFiles) {
      if (fs.existsSync(p)) {
        return {
          buffer: fs.readFileSync(p),
          filename: `${cleanFpb}.pdf`,
        };
      }
    }
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
    const reviewRecord = await getReviewRecord(cleanFpb);

    // Ambil PDF dari R2 / Local
    const foundPdf = await resolveLocalOrR2Pdf(cleanFpb, type);

    if (foundPdf) {
      return new NextResponse(new Uint8Array(foundPdf.buffer), {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `inline; filename="${type === 'signed' ? 'logistik_' : ''}${cleanFpb}.pdf"`,
          'Cache-Control': 'public, max-age=86400',
        },
      });
    }

    // Jika belum ada di storage R2 / lokal, berikan respons informatif mandiri
    return NextResponse.json(
      {
        error: `Dokumen PDF untuk FPB ${cleanFpb} belum diunggah ke storage internal dashboard. Silakan unggah berkas PDF ini secara mandiri melalui tombol "Upload PDF FPB".`,
        isOfflineMode: true,
        fpbNo: cleanFpb,
      },
      { status: 404 }
    );
  } catch (error: any) {
    console.error('Error in GET /api/review-fpb/pdf:', error);
    return NextResponse.json(
      { error: error.message || 'Gagal memproses dokumen PDF FPB.' },
      { status: 500 }
    );
  }
}
