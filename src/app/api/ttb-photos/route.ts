import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import { extractTakenAt, filenameMatchesTtb, parseNoTtb, extractTtbFromFilename } from '@/utils/ttbPhotoMatch';
import { getPhotosDir } from '@/utils/ttbPhotosDir';
import blobManifest from '@/data/ttb-photos-manifest.json';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const IMAGE_EXT = /\.(jpe?g|png|webp|gif)$/i;

const SOURCE: 'blob' | 'local' =
  (process.env.TTB_PHOTOS_SOURCE as 'blob' | 'local') || (process.env.VERCEL ? 'blob' : 'local');

const manifest = blobManifest as Record<string, string>;

let cache: { at: number; files: string[] } | null = null;
const listLocalFiles = async (): Promise<string[]> => {
  if (cache && Date.now() - cache.at < 60_000) return cache.files;
  const files = (await fs.readdir(getPhotosDir())).filter((f) => IMAGE_EXT.test(f));
  cache = { at: Date.now(), files };
  return files;
};

// GET /api/ttb-photos?ttb=... ATAU /api/ttb-photos?all=true&q=...&page=1&limit=60
export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const noTtb = searchParams.get('ttb') || '';
  const isAll = searchParams.get('all') === 'true';
  const query = (searchParams.get('q') || '').trim().toLowerCase();
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
  const limit = Math.min(120, Math.max(12, parseInt(searchParams.get('limit') || '48', 10)));

  try {
    const files = SOURCE === 'blob' ? Object.keys(manifest) : await listLocalFiles();

    // Mode 1: Pencarian spesifik nomor TTB (untuk popup/modal)
    if (noTtb) {
      const target = parseNoTtb(noTtb);
      if (target.numbers.length === 0) {
        return NextResponse.json({ ttb: noTtb, photos: [], error: 'Nomor TTB tidak valid' }, { status: 400 });
      }

      const photos = files
        .filter((f) => filenameMatchesTtb(f, target))
        .map((name) => ({
          name,
          url:
            SOURCE === 'blob'
              ? manifest[name]
              : `/api/ttb-photos/file?name=${encodeURIComponent(name)}`,
          takenAt: extractTakenAt(name),
          ttbInfo: extractTtbFromFilename(name),
        }))
        .sort((a, b) => b.name.localeCompare(a.name));

      return NextResponse.json({ ttb: noTtb, number: target.numbers[0], source: SOURCE, photos });
    }

    // Mode 2: Galeri Semua Foto TTB (dengan search & pagination)
    let matchedFiles = files;
    if (query) {
      matchedFiles = files.filter((f) => f.toLowerCase().includes(query));
    }

    // Urutkan file terbaru dulu (berdasarkan pola tanggal di nama file jika ada)
    matchedFiles.sort((a, b) => {
      const dateA = a.match(/(\d{4}-\d{2}-\d{2})/) ? a : '';
      const dateB = b.match(/(\d{4}-\d{2}-\d{2})/) ? b : '';
      return dateB.localeCompare(dateA) || a.localeCompare(b);
    });

    const total = matchedFiles.length;
    const startIndex = (page - 1) * limit;
    const pagedFiles = matchedFiles.slice(startIndex, startIndex + limit);

    const photos = pagedFiles.map((name) => ({
      name,
      url:
        SOURCE === 'blob'
          ? manifest[name]
          : `/api/ttb-photos/file?name=${encodeURIComponent(name)}`,
      takenAt: extractTakenAt(name),
      ttbInfo: extractTtbFromFilename(name),
    }));

    return NextResponse.json({
      source: SOURCE,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      photos,
    });
  } catch (err) {
    return NextResponse.json(
      { photos: [], source: SOURCE, error: `Gagal memuat galeri foto: ${(err as Error).message}` },
      { status: 500 }
    );
  }
}
