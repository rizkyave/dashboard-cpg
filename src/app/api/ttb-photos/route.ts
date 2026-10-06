import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import { put } from '@vercel/blob';
import { extractTakenAt, filenameMatchesTtb, parseNoTtb, extractTtbFromFilename } from '@/utils/ttbPhotoMatch';
import { getPhotosDir } from '@/utils/ttbPhotosDir';
import blobManifest from '@/data/ttb-photos-manifest.json';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const IMAGE_EXT = /\.(jpe?g|png|webp|gif)$/i;

const SOURCE: 'blob' | 'local' =
  (process.env.TTB_PHOTOS_SOURCE as 'blob' | 'local') || (process.env.VERCEL ? 'blob' : 'local');

// Manifest file path jika di lokal untuk update
const MANIFEST_PATH = path.join(process.cwd(), 'src', 'data', 'ttb-photos-manifest.json');
let manifest: Record<string, string> = { ...(blobManifest as Record<string, string>) };

let cache: { at: number; files: string[] } | null = null;
const listLocalFiles = async (): Promise<string[]> => {
  if (cache && Date.now() - cache.at < 60_000) return cache.files;
  try {
    const files = (await fs.readdir(getPhotosDir())).filter((f) => IMAGE_EXT.test(f));
    cache = { at: Date.now(), files };
    return files;
  } catch {
    return [];
  }
};

// GET /api/ttb-photos?ttb=... ATAU /api/ttb-photos?all=true&q=...&page=1&limit=60
export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const noTtb = searchParams.get('ttb') || '';
  const query = (searchParams.get('q') || '').trim().toLowerCase();
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
  const limit = Math.min(120, Math.max(12, parseInt(searchParams.get('limit') || '36', 10)));

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

// POST /api/ttb-photos: Upload foto baru dengan No TTB dan Armada/Keterangan
export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const noTtbRaw = ((formData.get('noTtb') as string) || '').trim();
    const armada = ((formData.get('armada') as string) || '').trim();

    if (!file) {
      return NextResponse.json({ error: 'Berkas foto tidak ditemukan.' }, { status: 400 });
    }

    if (!noTtbRaw) {
      return NextResponse.json({ error: 'Nomor TTB wajib diisi.' }, { status: 400 });
    }

    // Validasi ekstensi
    const originalExt = path.extname(file.name).toLowerCase() || '.jpeg';
    if (!IMAGE_EXT.test(originalExt)) {
      return NextResponse.json({ error: 'Format file harus berupa gambar (JPG, PNG, WEBP).' }, { status: 400 });
    }

    // Standardisasi nama file sesuai format TTB sistem:
    // Format: [ARMADA] [PREFIX-TTB XXXXX] YYYY-MM-DD at HH.MM.SS.ext
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const hh = String(now.getHours()).padStart(2, '0');
    const min = String(now.getMinutes()).padStart(2, '0');
    const ss = String(now.getSeconds()).padStart(2, '0');
    const timeStamp = `${yyyy}-${mm}-${dd} at ${hh}.${min}.${ss}`;

    // Pastikan format nomor TTB rapi (cth: CPL-TTB 04975 atau TTB 04975)
    let cleanTtb = noTtbRaw.toUpperCase().replace(/\s+/g, ' ');
    if (!cleanTtb.includes('TTB')) {
      cleanTtb = `TTB ${cleanTtb}`;
    }

    const armadaPrefix = armada ? `${armada.toUpperCase()} ` : '';
    const generatedFilename = `${armadaPrefix}${cleanTtb} ${timeStamp}${originalExt}`;

    const buffer = Buffer.from(await file.arrayBuffer());
    let publicUrl = '';

    // Coba simpan ke Vercel Blob jika token tersedia
    const blobToken = process.env.BLOB_READ_WRITE_TOKEN;
    if (blobToken) {
      try {
        const blobRes = await put(`ttb-photos/${generatedFilename}`, buffer, {
          access: 'public',
          addRandomSuffix: false,
          allowOverwrite: true,
          token: blobToken,
        });
        publicUrl = blobRes.url;
        manifest[generatedFilename] = publicUrl;

        // Jika di lokal, simpan juga ke manifest.json agar persisten
        try {
          await fs.writeFile(MANIFEST_PATH, JSON.stringify(manifest, null, 1), 'utf8');
        } catch {
          // Non-fatal di serverless
        }
      } catch (blobErr) {
        console.warn('Vercel Blob put error, fallback ke local storage:', blobErr);
      }
    }

    // Simpan ke storage lokal jika di laptop atau jika Vercel Blob tidak tersedia
    if (!publicUrl) {
      try {
        const localDir = getPhotosDir();
        await fs.mkdir(localDir, { recursive: true });
        await fs.writeFile(path.join(localDir, generatedFilename), buffer);
        publicUrl = `/api/ttb-photos/file?name=${encodeURIComponent(generatedFilename)}`;
        cache = null; // Reset cache file lokal
      } catch (fsErr) {
        if (!publicUrl) {
          throw new Error(`Gagal menyimpan file: ${(fsErr as Error).message}`);
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: `Foto untuk ${cleanTtb} berhasil diupload!`,
      photo: {
        name: generatedFilename,
        url: publicUrl,
        takenAt: `${dd}/${mm}/${yyyy} ${hh}:${min}:${ss}`,
        ttbInfo: extractTtbFromFilename(generatedFilename),
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: `Upload gagal: ${(error as Error).message}` },
      { status: 500 }
    );
  }
}
