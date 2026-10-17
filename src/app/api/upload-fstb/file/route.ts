import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import { getFstbPhotosDir } from '@/utils/fstbPhotosDir';
import { getObjectFromR2, isR2Configured } from '@/utils/r2Client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MIME_TYPES: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.pdf': 'application/pdf',
};

// GET /api/upload-fstb/file?name=<renamedFileName>&download=true
export async function GET(req: NextRequest) {
  const name = req.nextUrl.searchParams.get('name') || '';
  const download = req.nextUrl.searchParams.get('download') === 'true';

  if (!name || name !== path.basename(name)) {
    return new NextResponse('Nama file tidak valid.', { status: 400 });
  }

  const ext = path.extname(name).toLowerCase();
  const mime = MIME_TYPES[ext];
  if (!mime) {
    return new NextResponse('Format file tidak didukung.', { status: 415 });
  }

  // 1. Coba baca dari disk lokal
  try {
    const filePath = path.join(getFstbPhotosDir(), name);
    const data = await fs.readFile(filePath);

    const headers: Record<string, string> = {
      'Content-Type': mime,
      'Cache-Control': 'public, max-age=86400',
      'Content-Disposition': `${download ? 'attachment' : 'inline'}; filename="${encodeURIComponent(name)}"`,
    };

    return new NextResponse(new Uint8Array(data), { headers });
  } catch {
    // 2. Jika tidak ada di lokal, coba ambil dari Cloudflare R2
    if (isR2Configured()) {
      try {
        const isPdf = ext === '.pdf';
        const r2Key = isPdf ? `fstb-documents/${name}` : `fstb-photos/${name}`;
        let r2Object = await getObjectFromR2(r2Key);

        if (!r2Object) {
          const altKey = isPdf ? `fstb-photos/${name}` : `fstb-documents/${name}`;
          r2Object = await getObjectFromR2(altKey);
        }

        if (r2Object) {
          const headers: Record<string, string> = {
            'Content-Type': r2Object.contentType || mime,
            'Cache-Control': 'public, max-age=86400',
            'Content-Disposition': `${download ? 'attachment' : 'inline'}; filename="${encodeURIComponent(name)}"`,
          };

          return new NextResponse(new Uint8Array(r2Object.body), { headers });
        }
      } catch (err) {
        console.warn('Gagal membaca berkas FSTB dari Cloudflare R2:', err);
      }
    }

    return new NextResponse('Berkas FSTB tidak ditemukan di server.', { status: 404 });
  }
}
