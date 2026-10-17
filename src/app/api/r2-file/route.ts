import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import { promises as fs } from 'fs';
import { getObjectFromR2, isR2Configured, uploadToR2 } from '@/utils/r2Client';
import { getPhotosDir } from '@/utils/ttbPhotosDir';
import rawManifest from '@/data/ttb-photos-manifest.json';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MIME_MAP: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.pdf': 'application/pdf',
};

// GET /api/r2-file?key=<r2Key>&download=true
export async function GET(req: NextRequest) {
  const key = req.nextUrl.searchParams.get('key') || '';
  const download = req.nextUrl.searchParams.get('download') === 'true';

  if (!key) {
    return new NextResponse('Parameter key wajib disertakan', { status: 400 });
  }

  // Sanitize key untuk mencegah path traversal berisiko
  const normalizedKey = key.replace(/\\/g, '/').replace(/^\/+/, '');
  if (normalizedKey.includes('../')) {
    return new NextResponse('Kunci berkas tidak valid', { status: 400 });
  }

  const filename = path.basename(normalizedKey);
  const ext = path.extname(filename).toLowerCase();
  const fallbackMime = MIME_MAP[ext] || 'application/octet-stream';

  const isDocument = normalizedKey.startsWith('ttb-documents/') || ext === '.pdf' || req.nextUrl.searchParams.has('v');
  const cacheControl = isDocument
    ? 'no-cache, no-store, must-revalidate, max-age=0'
    : 'public, max-age=86400, stale-while-revalidate=604800';

  // 1. Coba ambil dari Cloudflare R2 jika telah dikonfigurasi
  if (isR2Configured()) {
    try {
      const r2Object = await getObjectFromR2(normalizedKey);
      if (r2Object) {
        const headers: Record<string, string> = {
          'Content-Type': r2Object.contentType || fallbackMime,
          'Cache-Control': cacheControl,
        };

        if (r2Object.contentLength) {
          headers['Content-Length'] = String(r2Object.contentLength);
        }
        if (r2Object.eTag) {
          headers['ETag'] = r2Object.eTag;
        }

        if (download) {
          headers['Content-Disposition'] = `attachment; filename="${encodeURIComponent(filename)}"`;
        } else {
          headers['Content-Disposition'] = `inline; filename="${encodeURIComponent(filename)}"`;
        }

        return new NextResponse(new Uint8Array(r2Object.body), { headers });
      }
    } catch (r2Err) {
      console.warn('Gagal membaca dari Cloudflare R2, mencoba fallback disk lokal:', r2Err);
    }
  }

  // 2. Fallback ke disk lokal jika file ada di folder photos_TTB
  try {
    const localDir = getPhotosDir();
    const localFilePath = path.join(localDir, filename);
    const fileBytes = await fs.readFile(localFilePath);

    const headers: Record<string, string> = {
      'Content-Type': fallbackMime,
      'Cache-Control': cacheControl,
    };

    if (download) {
      headers['Content-Disposition'] = `attachment; filename="${encodeURIComponent(filename)}"`;
    } else {
      headers['Content-Disposition'] = `inline; filename="${encodeURIComponent(filename)}"`;
    }

    return new NextResponse(new Uint8Array(fileBytes), { headers });
  } catch {
    // 3. Fallback: Ambil dari URL manifest jika sebelumnya ada di CDN (Vercel Blob / public link)
    const manifestUrl = (rawManifest as Record<string, string>)[filename];
    if (manifestUrl && manifestUrl.startsWith('http')) {
      try {
        const res = await fetch(manifestUrl);
        if (res.ok) {
          const arrayBuf = await res.arrayBuffer();
          const buf = Buffer.from(arrayBuf);
          const contentType = res.headers.get('content-type') || fallbackMime;

          // Simpan ke Cloudflare R2 di background agar berikutnya langsung diambil dari R2
          if (isR2Configured()) {
            uploadToR2({
              key: normalizedKey,
              body: buf,
              contentType,
            }).catch((err) => console.warn('Gagal auto-sync ke R2:', err));
          }

          const headers: Record<string, string> = {
            'Content-Type': contentType,
            'Cache-Control': cacheControl,
            'Content-Disposition': `${download ? 'attachment' : 'inline'}; filename="${encodeURIComponent(filename)}"`,
          };

          return new NextResponse(new Uint8Array(buf), { headers });
        }
      } catch (fetchErr) {
        console.warn('Gagal fetch fallback dari manifest URL:', fetchErr);
      }
    }

    return new NextResponse('Berkas tidak ditemukan di Cloudflare R2 maupun penyimpanan lokal.', {
      status: 404,
    });
  }
}

