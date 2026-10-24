import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import { extractTakenAt, filenameMatchesTtb, parseNoTtb, extractTtbFromFilename } from '@/utils/ttbPhotoMatch';
import { getPhotosDir } from '@/utils/ttbPhotosDir';
import { uploadToR2, isR2Configured, getR2FileUrl, listR2Objects, deleteFromR2, getObjectFromR2 } from '@/utils/r2Client';
import rawManifest from '@/data/ttb-photos-manifest.json';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const IMAGE_EXT = /\.(jpe?g|png|webp|gif)$/i;

// Manifest file path untuk update lokal & Cloudflare R2 key
const MANIFEST_PATH = path.join(process.cwd(), 'src', 'data', 'ttb-photos-manifest.json');
const R2_PHOTO_MANIFEST_KEY = 'ttb-metadata/photos-manifest.json';
let manifest: Record<string, string> = { ...(rawManifest as Record<string, string>) };

async function getManifest(): Promise<Record<string, string>> {
  if (isR2Configured()) {
    try {
      const r2Obj = await getObjectFromR2(R2_PHOTO_MANIFEST_KEY);
      if (r2Obj && r2Obj.body) {
        const text = Buffer.from(r2Obj.body).toString('utf8');
        const parsed = JSON.parse(text);
        if (parsed && typeof parsed === 'object') {
          manifest = parsed;
          return parsed;
        }
      }
    } catch {
      // Non-fatal
    }
  }

  try {
    const raw = await fs.readFile(MANIFEST_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') {
      manifest = parsed;
      return parsed;
    }
  } catch {
    // Non-fatal
  }

  return { ...(rawManifest as Record<string, string>) };
}

async function saveManifest(updatedManifest: Record<string, string>): Promise<void> {
  manifest = updatedManifest;
  const jsonStr = JSON.stringify(updatedManifest, null, 2);

  if (isR2Configured()) {
    try {
      await uploadToR2({
        key: R2_PHOTO_MANIFEST_KEY,
        body: Buffer.from(jsonStr, 'utf8'),
        contentType: 'application/json',
        cacheControl: 'no-cache, no-store, must-revalidate',
      });
    } catch (r2Err) {
      console.warn('Gagal menyimpan manifest foto ke R2:', r2Err);
    }
  }

  try {
    await fs.mkdir(path.dirname(MANIFEST_PATH), { recursive: true });
    await fs.writeFile(MANIFEST_PATH, jsonStr, 'utf8');
  } catch {
    // Non-fatal di serverless / read-only filesystem Vercel
  }
}

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

let r2Cache: { at: number; files: string[] } | null = null;
const listR2PhotoFiles = async (forceFresh = false): Promise<string[]> => {
  if (!isR2Configured()) return [];
  if (!forceFresh && r2Cache && Date.now() - r2Cache.at < 15_000) return r2Cache.files;
  try {
    const objects = await listR2Objects('ttb-photos/', 1000);
    const files = objects
      .map((o) => o.key.replace(/^ttb-photos\//, ''))
      .filter((name) => IMAGE_EXT.test(name));
    r2Cache = { at: Date.now(), files };
    return files;
  } catch {
    return [];
  }
};

/**
 * Menentukan URL foto terbaik (Cloudflare R2 jika sudah ada, manifest URL jika ada, atau Proxy Stream)
 */
function resolvePhotoUrl(filename: string, r2FileSet?: Set<string>): string {
  // 1. Jika berkas sudah terverifikasi ada di Cloudflare R2
  if (r2FileSet && r2FileSet.has(filename)) {
    return getR2FileUrl(`ttb-photos/${filename}`);
  }
  // 2. Jika di manifest sudah tersimpan URL langsung yang valid (R2 / CDN)
  if (manifest[filename] && manifest[filename].startsWith('http')) {
    return manifest[filename];
  }
  // 3. Jika Cloudflare R2 aktif, gunakan URL R2
  if (isR2Configured()) {
    return getR2FileUrl(`ttb-photos/${filename}`);
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
    const forceFresh = searchParams.get('fresh') === 'true' || searchParams.get('bust') === 'true';
    if (forceFresh) {
      r2Cache = null;
      cache = null;
    }
    manifest = await getManifest();

    // Kumpulkan daftar nama file: dari manifest, disk lokal, dan Cloudflare R2
    const [localFiles, r2Files] = await Promise.all([listLocalFiles(), listR2PhotoFiles(forceFresh)]);
    const r2FileSet = new Set<string>(r2Files);
    const localFileSet = new Set<string>(localFiles);

    // Filter file agar HANYA file yang benar-benar ada di R2, di disk lokal, atau URL valid yang ditampilkan
    const manifestKeys = Object.keys(manifest);
    const candidateSet = new Set<string>([...manifestKeys, ...localFiles, ...r2Files]);
    const files = Array.from(candidateSet).filter((f) => {
      if (r2FileSet.has(f)) return true;
      if (localFileSet.has(f)) return true;
      if (manifest[f] && manifest[f].startsWith('http')) return true;
      return false;
    });

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
          url: resolvePhotoUrl(name, r2FileSet),
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
      url: resolvePhotoUrl(name, r2FileSet),
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
        await saveManifest(manifest);
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

// DELETE /api/ttb-photos?action=clean ATAU /api/ttb-photos?name=...
export async function DELETE(req: NextRequest) {
  try {
    const userRole = req.headers.get('x-user-role');
    if (userRole !== 'admin') {
      return NextResponse.json(
        { success: false, error: 'Akses ditolak: Hanya Administrator yang berwenang menghapus foto TTB.' },
        { status: 403 }
      );
    }

    const searchParams = req.nextUrl.searchParams;
    const action = searchParams.get('action');
    const name = searchParams.get('name');

    // Refresh file dari R2 dan lokal
    const [localFiles, r2Files] = await Promise.all([listLocalFiles(), listR2PhotoFiles(true)]);
    const r2FileSet = new Set<string>(r2Files);
    const localFileSet = new Set<string>(localFiles);

    // Baca manifest terbaru
    let currentManifest = await getManifest();

    if (action === 'clean') {
      // Bersihkan semua index manifest yang berkas fisiknya tidak ada di R2 dan tidak ada di lokal
      const keys = Object.keys(currentManifest);
      let removedCount = 0;
      const cleanManifest: Record<string, string> = {};

      for (const key of keys) {
        const existsInR2 = r2FileSet.has(key);
        const existsInLocal = localFileSet.has(key);
        const isHttp = currentManifest[key] && currentManifest[key].startsWith('http');

        if (existsInR2 || existsInLocal || isHttp) {
          cleanManifest[key] = currentManifest[key];
        } else {
          removedCount++;
        }
      }

      // Masukkan juga semua file yang ada di R2 dan lokal ke manifest jika belum terdaftar
      for (const r2File of r2Files) {
        if (!cleanManifest[r2File]) {
          cleanManifest[r2File] = getR2FileUrl(`ttb-photos/${r2File}`);
        }
      }
      for (const locFile of localFiles) {
        if (!cleanManifest[locFile]) {
          cleanManifest[locFile] = `/api/ttb-photos/file?name=${encodeURIComponent(locFile)}`;
        }
      }

      await saveManifest(cleanManifest);
      cache = null;
      r2Cache = null;

      return NextResponse.json({
        success: true,
        message: `Berhasil membersihkan index! ${removedCount} index foto hilang telah dihapus.`,
        removedCount,
        remainingCount: Object.keys(cleanManifest).length,
      });
    }

    if (name) {
      // Hapus foto spesifik dari R2, lokal, dan manifest
      let deletedFromR2 = false;
      let deletedFromLocal = false;

      if (isR2Configured()) {
        try {
          await deleteFromR2(`ttb-photos/${name}`);
          deletedFromR2 = true;
        } catch (e) {
          console.warn('Gagal hapus dari R2:', e);
        }
      }

      try {
        const localDir = getPhotosDir();
        const filePath = path.join(localDir, name);
        await fs.unlink(filePath);
        deletedFromLocal = true;
      } catch {
        // Berkas mungkin tidak ada di lokal / read-only filesystem di serverless Vercel
      }

      delete currentManifest[name];
      await saveManifest(currentManifest);
      cache = null;
      r2Cache = null;

      return NextResponse.json({
        success: true,
        message: `Foto "${name}" berhasil dihapus.`,
        deletedFromR2,
        deletedFromLocal,
      });
    }

    return NextResponse.json({ error: 'Parameter name atau action=clean diperlukan.' }, { status: 400 });
  } catch (err) {
    return NextResponse.json(
      { error: `Gagal memproses penghapusan: ${(err as Error).message}` },
      { status: 500 }
    );
  }
}

