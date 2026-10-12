import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import { getPhotosDir } from '@/utils/ttbPhotosDir';

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

// GET /api/upload-ttb/file?name=<renamedFileName>&download=true
export async function GET(req: NextRequest) {
  const name = req.nextUrl.searchParams.get('name') || '';
  const download = req.nextUrl.searchParams.get('download') === 'true';

  // Cegah path traversal: hanya nama file langsung tanpa karakter slash
  if (!name || name !== path.basename(name)) {
    return new NextResponse('Nama file tidak valid.', { status: 400 });
  }

  const ext = path.extname(name).toLowerCase();
  const mime = MIME_TYPES[ext];
  if (!mime) {
    return new NextResponse('Format file tidak didukung.', { status: 415 });
  }

  try {
    const filePath = path.join(getPhotosDir(), name);
    const data = await fs.readFile(filePath);

    const headers: Record<string, string> = {
      'Content-Type': mime,
      'Cache-Control': 'public, max-age=86400',
    };

    if (download) {
      headers['Content-Disposition'] = `attachment; filename="${name}"`;
    } else {
      headers['Content-Disposition'] = `inline; filename="${name}"`;
    }

    return new NextResponse(new Uint8Array(data), { headers });
  } catch {
    return new NextResponse('Berkas tidak ditemukan pada server.', { status: 404 });
  }
}

