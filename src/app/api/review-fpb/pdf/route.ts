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

/**
 * Update pdfUrl in local reviews file if a newer/better URL was resolved
 */
function updateReviewPdfUrl(fpbNo: string, newPdfUrl: string) {
  try {
    if (fs.existsSync(LOCAL_REVIEWS_PATH)) {
      const raw = fs.readFileSync(LOCAL_REVIEWS_PATH, 'utf-8');
      const records: FpbReviewRecord[] = JSON.parse(raw);
      const match = records.find((r) => r.fpbNo.toLowerCase() === fpbNo.toLowerCase());
      if (match && match.pdfUrl !== newPdfUrl) {
        match.pdfUrl = newPdfUrl;
        fs.writeFileSync(LOCAL_REVIEWS_PATH, JSON.stringify(records, null, 2), 'utf-8');
      }
    }
  } catch (err) {
    console.warn('[review-fpb/pdf] Gagal memperbarui pdfUrl di fpb-reviews.json:', err);
  }
}

/**
 * Mencari URL PDF asli di e-FPB FilesList via internal authentication search jika probing cepat 404
 */
async function searchFilesListForPdfUrl(cleanDoc: string): Promise<string | null> {
  const username = 'Hermansyah';
  const password = 'Biocpl24!@#';

  try {
    const loginRes = await fetch('https://e-fpb.cindaragroup.com/login', {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
      cache: 'no-store',
    });
    const initCookies = (loginRes.headers as any).getSetCookie
      ? (loginRes.headers as any).getSetCookie()
      : [loginRes.headers.get('set-cookie') || ''];
    const cookieHeader = initCookies.map((c: string) => c.split(';')[0]).join('; ');

    const html = await loginRes.text();
    const csrfName = html.split('name="csrf_name" value="')[1]?.split('"')[0] || '';
    const csrfVal = html.split('name="csrf_value" value="')[1]?.split('"')[0] || '';

    const fd = new FormData();
    if (csrfName) fd.append('csrf_name', csrfName);
    if (csrfVal) {
      fd.append('csrf_value', csrfVal);
      fd.append(csrfName, csrfVal);
    }
    fd.append('username', username);
    fd.append('password', password);

    const authRes = await fetch('https://e-fpb.cindaragroup.com/login', {
      method: 'POST',
      headers: {
        Cookie: cookieHeader,
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
      body: fd,
      redirect: 'manual',
      cache: 'no-store',
    });
    const authCookies = (authRes.headers as any).getSetCookie
      ? (authRes.headers as any).getSetCookie()
      : [authRes.headers.get('set-cookie') || ''];
    const fullCookie = [...initCookies, ...authCookies].map((c: string) => c.split(';')[0]).join('; ');

    // Coba dengan psearch (standar PHPMaker)
    const searchUrl = `https://e-fpb.cindaragroup.com/FilesList?psearch=${encodeURIComponent(cleanDoc)}`;
    const searchRes = await fetch(searchUrl, {
      headers: {
        Cookie: fullCookie,
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
      cache: 'no-store',
    });
    if (!searchRes.ok) return null;

    const searchHtml = await searchRes.text();
    const pdfMatches = searchHtml.match(/files\/[^\s"'\\]+\.pdf/gi) || [];
    if (pdfMatches.length === 0) return null;

    const cleanDocRaw = cleanDoc.replace(/[^A-Za-z0-9]/g, '').toLowerCase();
    const matchedPdf =
      pdfMatches.find((p) =>
        p.replace(/[^A-Za-z0-9]/g, '').toLowerCase().includes(cleanDocRaw)
      ) || pdfMatches[0];

    if (matchedPdf) {
      const rawPath = matchedPdf.replace(/^\/+/, '');
      return `https://e-fpb.cindaragroup.com/${rawPath}`;
    }
  } catch (err) {
    console.warn('[review-fpb/pdf] searchFilesListForPdfUrl failed:', err);
  }

  return null;
}

/**
 * Multi-layer PDF resolver:
 * 1. Checks known record pdfUrl and attachments
 * 2. Probes direct filenames (e.g. GAJ-FPB-26-0001082.pdf)
 * 3. Probes multi-revisions (Approved_rev_rev_sign..., logistik_Approved_...)
 * 4. Fallback search on e-FPB FilesList
 */
async function resolveEfpbPdf(
  cleanFpb: string,
  reviewRecord?: FpbReviewRecord | null,
  preferLogistik = false
): Promise<{ buffer: Buffer; url: string; isLogistik: boolean } | null> {
  const enc = encodeURIComponent(cleanFpb);
  const candidateUrls: Array<{ url: string; isLogistik: boolean }> = [];

  // 1. Logistik official signatures (if preferLogistik is requested)
  if (preferLogistik) {
    candidateUrls.push({
      url: `https://e-fpb.cindaragroup.com/files/logistik_Approved_rev_sign_${enc}.pdf`,
      isLogistik: true,
    });
    for (let r = 6; r >= 1; r--) {
      const revStr = Array(r).fill('rev').join('_') + '_';
      candidateUrls.push({
        url: `https://e-fpb.cindaragroup.com/files/logistik_Approved_${revStr}sign_${enc}.pdf`,
        isLogistik: true,
      });
    }
    candidateUrls.push({
      url: `https://e-fpb.cindaragroup.com/files/logistik_Approved_sign_${enc}.pdf`,
      isLogistik: true,
    });
  }

  // 2. Direct FPB name (e.g. GAJ-FPB-26-0001082.pdf) — very common in e-FPB revisions!
  candidateUrls.push({
    url: `https://e-fpb.cindaragroup.com/files/${enc}.pdf`,
    isLogistik: false,
  });
  candidateUrls.push({
    url: `https://e-fpb.cindaragroup.com/files/${cleanFpb.replace(/-/g, '_')}.pdf`,
    isLogistik: false,
  });

  // 3. Stored reviewRecord.pdfUrl if valid and not a standard 404
  if (reviewRecord?.pdfUrl && reviewRecord.pdfUrl.startsWith('http')) {
    candidateUrls.push({
      url: reviewRecord.pdfUrl,
      isLogistik: reviewRecord.pdfUrl.includes('logistik_'),
    });
  }

  // 4. Standard Approved revisions (from highest rev down to base)
  for (let r = 6; r >= 1; r--) {
    const revStr = Array(r).fill('rev').join('_') + '_';
    candidateUrls.push({
      url: `https://e-fpb.cindaragroup.com/files/Approved_${revStr}sign_${enc}.pdf`,
      isLogistik: false,
    });
  }
  candidateUrls.push({
    url: `https://e-fpb.cindaragroup.com/files/Approved_rev_sign_${enc}.pdf`,
    isLogistik: false,
  });
  candidateUrls.push({
    url: `https://e-fpb.cindaragroup.com/files/Approved_sign_${enc}.pdf`,
    isLogistik: false,
  });
  candidateUrls.push({
    url: `https://e-fpb.cindaragroup.com/files/Approved_${enc}.pdf`,
    isLogistik: false,
  });

  // 5. Check reviewRecord attachments for any candidate PDF
  if (reviewRecord?.attachments && reviewRecord.attachments.length > 0) {
    for (const att of reviewRecord.attachments) {
      if (att.url && (att.type === 'pdf' || att.url.toLowerCase().endsWith('.pdf'))) {
        candidateUrls.push({
          url: att.url,
          isLogistik: att.url.includes('logistik_'),
        });
      }
    }
  }

  // Deduplicate candidates maintaining priority order
  const uniqueCandidates: Array<{ url: string; isLogistik: boolean }> = [];
  const seenUrls = new Set<string>();
  for (const c of candidateUrls) {
    if (!seenUrls.has(c.url)) {
      seenUrls.add(c.url);
      uniqueCandidates.push(c);
    }
  }

  // Parallel probe with HEAD requests
  try {
    const probeResults = await Promise.all(
      uniqueCandidates.map(async (c) => {
        try {
          const res = await fetch(c.url, {
            method: 'HEAD',
            headers: {
              'User-Agent':
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            },
            cache: 'no-store',
          });
          return { ...c, ok: res.ok && res.status === 200 };
        } catch {
          return { ...c, ok: false };
        }
      })
    );

    const matched = probeResults.find((r) => r.ok);
    if (matched) {
      const getRes = await fetch(matched.url, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        },
        cache: 'no-store',
      });
      if (getRes.ok) {
        const ab = await getRes.arrayBuffer();
        return { buffer: Buffer.from(ab), url: matched.url, isLogistik: matched.isLogistik };
      }
    }
  } catch (probeErr) {
    console.warn('[review-fpb/pdf] Gagal saat probing berkas:', probeErr);
  }

  // 6. Fallback: Search on FilesList via authentication
  try {
    const filesListUrl = await searchFilesListForPdfUrl(cleanFpb);
    if (filesListUrl) {
      const getRes = await fetch(filesListUrl, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        },
        cache: 'no-store',
      });
      if (getRes.ok) {
        const ab = await getRes.arrayBuffer();
        return {
          buffer: Buffer.from(ab),
          url: filesListUrl,
          isLogistik: filesListUrl.includes('logistik_'),
        };
      }
    }
  } catch (searchErr) {
    console.warn('[review-fpb/pdf] Gagal saat fallback FilesList search:', searchErr);
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

    // -------------------------------------------------------------------------
    // Mode: Dokumen Asli Pemohon (Raw)
    // -------------------------------------------------------------------------
    if (type === 'raw') {
      const resolved = await resolveEfpbPdf(cleanFpb, reviewRecord, false);
      if (!resolved) {
        return NextResponse.json(
          { error: `Dokumen asli FPB ${cleanFpb} tidak ditemukan di server e-FPB.` },
          { status: 404 }
        );
      }

      // Update cached record URL if a valid direct file was resolved
      if (reviewRecord && reviewRecord.pdfUrl !== resolved.url) {
        updateReviewPdfUrl(cleanFpb, resolved.url);
      }

      return new NextResponse(new Uint8Array(resolved.buffer), {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `inline; filename="Asli_${cleanFpb}.pdf"`,
          'Cache-Control': 'public, max-age=3600',
        },
      });
    }

    // -------------------------------------------------------------------------
    // Mode: Dokumen Bertanda Tangan Logistik (Signed)
    // -------------------------------------------------------------------------
    // 1. Cek cache Cloudflare R2 untuk performa maksimal
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
        // Safe ignore cache miss
      }
    }

    // 2. Resolve PDF dari e-FPB (coba cek apakah logistik_ sudah ada atau ambil base file)
    const resolved = await resolveEfpbPdf(cleanFpb, reviewRecord, true);
    if (!resolved) {
      return NextResponse.json(
        { error: `Dokumen base FPB ${cleanFpb} tidak ditemukan di e-FPB.` },
        { status: 404 }
      );
    }

    // Update cached record URL if better URL resolved
    if (reviewRecord && reviewRecord.pdfUrl !== resolved.url && !resolved.isLogistik) {
      updateReviewPdfUrl(cleanFpb, resolved.url);
    }

    // Jika berkas yang ditemukan memang sudah resmi bertanda tangan dari logistik e-FPB:
    if (resolved.isLogistik) {
      return new NextResponse(new Uint8Array(resolved.buffer), {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `inline; filename="logistik_Approved_rev_sign_${cleanFpb}.pdf"`,
          'Cache-Control': 'public, max-age=86400',
        },
      });
    }

    // Jika belum disetujui logistik secara internal, kembalikan dokumen base asli
    const isApproved = Boolean(
      reviewRecord?.isReceivedLogistik ||
      reviewRecord?.reviewStatus === 'APPROVED_PO'
    );

    if (!isApproved) {
      return new NextResponse(new Uint8Array(resolved.buffer), {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `inline; filename="Approved_rev_sign_${cleanFpb}.pdf"`,
          'Cache-Control': 'public, max-age=1800',
        },
      });
    }

    // 3. Stempel Tanda Tangan Logistik Resmi secara Dinamis
    const signerName = reviewRecord?.reviewedBy || 'NOOR HASANAH';
    const reviewedAt = reviewRecord?.reviewedAt ? new Date(reviewRecord.reviewedAt) : new Date();

    const stampedBuffer = await stampFpbPdf({
      pdfBuffer: resolved.buffer,
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
