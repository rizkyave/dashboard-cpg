import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import { extractTakenAt, filenameMatchesTtb, parseNoTtb, extractTtbFromFilename } from '@/utils/ttbPhotoMatch';
import { getPhotosDir } from '@/utils/ttbPhotosDir';
import { uploadToR2, isR2Configured, getR2FileUrl, listR2Objects } from '@/utils/r2Client';
import rawManifest from '@/data/ttb-photos-manifest.json';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const IMAGE_EXT = /\.(jpe?g|png|webp|gif)$/i;

// Manifest file path untuk update lokal
const MANIFEST_PATH = path.join(process.cwd(), 'src', 'data', 'ttb-photos-manifest.json');
let manifest: Record<string, string> = { ...(rawManifest as Record<string, string>) };

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

/**
 * Menentukan URL foto terbaik (Cloudflare R2, Proxy Stream, atau Disk Lokal)
 */
function resolvePhotoUrl(filename: string): string {
  if (isR2Configured()) {
    return getR2FileUrl(`ttb-photos/${filename}`);
  }
  // Jika manifest sudah punya URL selain vercel-storage (cth: R2 direct URL)
  if (manifest[filename] && !manifest[filename].includes('vercel-storage.com')) {
    return manifest[filename];
  }
  return `/api/ttb-photos/file?name=${encodeURIComponent(filename)}`;
}

// GET /api/ttb-photos?ttb=... ATAU /api/ttb-photos?all=true&q=...&page=1&limit=36
export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const noTtb = searchParams.get('ttb') || '';
  const query = (searchParams.get('q') || '').trim().toLowerCase();
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
  const limit = Math.min(120, Math.max(12, parseInt(searchParams.get('limit') || '36', 10)));

  const sourceName = isR2Configured() ? 'r2' : 'local';

  try {
    // Kumpulkan daftar nama file: dari manifest dan disk lokal
    const localFiles = await listLocalFiles();
    const manifestKeys = Object.keys(manifest);
    const fileSet = new Set<string>([...manifestKeys, ...localFiles]);
    const files = Array.from(fileSet);

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
          url: resolvePhotoUrl(name),
          takenAt: extractTakenAt(name),
          ttbInfo: extractTtbFromFilename(name),
        }))
        .sort((a, b) => b.name.localeCompare(a.name));

      return NextResponse.json({
        ttb: noTtb,
        number: target.numbers[0],
        source: sourceName,
        photos,
        isR2Active: isR2Configured(),
      });
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
      url: resolvePhotoUrl(name),
      takenAt: extractTakenAt(name),
      ttbInfo: extractTtbFromFilename(name),
    }));

    return NextResponse.json({
      source: sourceName,
      isR2Active: isR2Configured(),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      photos,
    });
  } catch (err) {
    return NextResponse.json(
      { photos: [], source: sourceName, error: `Gagal memuat galeri foto: ${(err as Error).message}` },
      { status: 500 }
    );
  }
}

// POST /api/ttb-photos: Upload foto baru dengan No TTB dan Armada ke Cloudflare R2
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

    // Validasi format gambar
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
    let storageProvider = 'LOCAL';

    // 1. Simpan ke Cloudflare R2 jika telah dikonfigurasi
    if (isR2Configured()) {
      try {
        const r2Result = await uploadToR2({
          key: `ttb-photos/${generatedFilename}`,
          body: buffer,
          contentType: file.type || 'image/jpeg',
          metadata: {
            noTtb: cleanTtb,
            armada: armada || '',
            originalFileName: file.name,
          },
        });
        publicUrl = r2Result.url;
        storageProvider = 'CLOUDFLARE_R2';
        manifest[generatedFilename] = publicUrl;

        // Simpan ke manifest file agar terindeks cepat
        try {
          await fs.writeFile(MANIFEST_PATH, JSON.stringify(manifest, null, 1), 'utf8');
        } catch {
          // Non-fatal di serverless
        }
      } catch (r2Err) {
        console.warn('Cloudflare R2 upload error, fallback ke local storage:', r2Err);
      }
    }

    // 2. Simpan juga ke disk lokal sebagai salinan lokal jika di lingkungan lokal
    try {
      const localDir = getPhotosDir();
      await fs.mkdir(localDir, { recursive: true });
      await fs.writeFile(path.join(localDir, generatedFilename), buffer);
      cache = null; // Reset cache lokal
      if (!publicUrl) {
        publicUrl = `/api/ttb-photos/file?name=${encodeURIComponent(generatedFilename)}`;
      }
    } catch (fsErr) {
      if (!publicUrl) {
        throw new Error(`Gagal menyimpan file ke penyimpanan: ${(fsErr as Error).message}`);
      }
    }

    return NextResponse.json({
      success: true,
      message: `Foto untuk ${cleanTtb} berhasil diupload ke ${storageProvider === 'CLOUDFLARE_R2' ? 'Cloudflare R2' : 'penyimpanan lokal'}!`,
      storageProvider,
      isR2Active: isR2Configured(),
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
