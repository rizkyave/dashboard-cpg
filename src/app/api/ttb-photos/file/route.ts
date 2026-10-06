import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import { getPhotosDir } from '@/utils/ttbPhotosDir';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MIME: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
};

// GET /api/ttb-photos/file?name=<nama file>
export async function GET(req: NextRequest) {
  const name = req.nextUrl.searchParams.get('name') || '';
  // Cegah path traversal: hanya nama file, tanpa folder
  if (!name || name !== path.basename(name)) {
    return new NextResponse('Nama file tidak valid', { status: 400 });
  }
  const mime = MIME[path.extname(name).toLowerCase()];
  if (!mime) return new NextResponse('Format tidak didukung', { status: 415 });

  try {
    const data = await fs.readFile(path.join(getPhotosDir(), name));
    return new NextResponse(new Uint8Array(data), {
      headers: { 'Content-Type': mime, 'Cache-Control': 'public, max-age=86400' },
    });
  } catch {
    return new NextResponse('Foto tidak ditemukan', { status: 404 });
  }
}
