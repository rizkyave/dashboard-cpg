import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import { extractTakenAt, filenameMatchesTtb, parseNoTtb } from '@/utils/ttbPhotoMatch';
import { getPhotosDir } from '@/utils/ttbPhotosDir';
import blobManifest from '@/data/ttb-photos-manifest.json';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const IMAGE_EXT = /\.(jpe?g|png|webp|gif)$/i;

/**
 * Sumber foto:
 * - "blob"  : Vercel Blob, daftar file dari src/data/ttb-photos-manifest.json (default saat di Vercel)
 * - "local" : folder lokal getPhotosDir() (default saat dijalankan di komputer/server biasa)
 * Bisa dipaksa lewat env TTB_PHOTOS_SOURCE=blob|local
 */
const SOURCE: 'blob' | 'local' =
  (process.env.TTB_PHOTOS_SOURCE as 'blob' | 'local') || (process.env.VERCEL ? 'blob' : 'local');

const manifest = blobManifest as Record<string, string>;

// Cache daftar file lokal di memori server (diperbarui tiap 60 detik) agar tidak scan 3000+ file tiap request
let cache: { at: number; files: string[] } | null = null;
const listLocalFiles = async (): Promise<string[]> => {
  if (cache && Date.now() - cache.at < 60_000) return cache.files;
  const files = (await fs.readdir(getPhotosDir())).filter((f) => IMAGE_EXT.test(f));
  cache = { at: Date.now(), files };
  return files;
};

// GET /api/ttb-photos?ttb=CPL-TTB-26-04975
export async function GET(req: NextRequest) {
  const noTtb = req.nextUrl.searchParams.get('ttb') || '';
  const target = parseNoTtb(noTtb);
  if (target.numbers.length === 0) {
    return NextResponse.json({ ttb: noTtb, photos: [], error: 'Nomor TTB tidak valid' }, { status: 400 });
  }

  try {
    const files = SOURCE === 'blob' ? Object.keys(manifest) : await listLocalFiles();
    const photos = files
      .filter((f) => filenameMatchesTtb(f, target))
      .map((name) => ({
        name,
        url:
          SOURCE === 'blob'
            ? manifest[name] // URL publik Vercel Blob (CDN langsung, tanpa lewat server)
            : `/api/ttb-photos/file?name=${encodeURIComponent(name)}`,
        takenAt: extractTakenAt(name),
      }))
      .sort((a, b) => b.name.localeCompare(a.name));

    return NextResponse.json({ ttb: noTtb, number: target.numbers[0], source: SOURCE, photos });
  } catch (err) {
    return NextResponse.json(
      { ttb: noTtb, photos: [], source: SOURCE, error: `Folder foto tidak dapat dibaca: ${(err as Error).message}` },
      { status: 500 }
    );
  }
}
