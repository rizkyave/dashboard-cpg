import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import { sanitizeTtbNumber, formatTtbFilename } from '@/utils/ttbRename';
import { getPhotosDir } from '@/utils/ttbPhotosDir';
import { UploadedTtbItem, UploadTtbResponse } from '@/types/ttbUpload';
import {
  uploadToR2,
  isR2Configured,
  getR2FileUrl,
  getR2Config,
  getObjectFromR2,
  listR2Objects,
  getHeadObjectFromR2,
} from '@/utils/r2Client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ALLOWED_EXT = /\.(jpe?g|png|webp|gif|pdf)$/i;
const HISTORY_FILE_PATH = path.join(process.cwd(), 'src', 'data', 'ttb-uploads-history.json');
const MANIFEST_PATH = path.join(process.cwd(), 'src', 'data', 'ttb-photos-manifest.json');
const R2_METADATA_HISTORY_KEY = 'ttb-metadata/history.json';

// Helper penentuan MIME Type
function getMimeType(fileName: string, fallbackType?: string): string {
  const ext = path.extname(fileName).toLowerCase();
  switch (ext) {
    case '.pdf':
      return 'application/pdf';
    case '.png':
      return 'image/png';
    case '.webp':
      return 'image/webp';
    case '.gif':
      return 'image/gif';
    case '.jpg':
    case '.jpeg':
    default:
      return fallbackType || 'image/jpeg';
  }
}

// Baca riwayat upload dari Cloudflare R2 (dengan fallback ke disk lokal)
async function getHistory(): Promise<UploadedTtbItem[]> {
  // 1. Ambil dari Cloudflare R2 terlebih dahulu jika dikonfigurasi
  if (isR2Configured()) {
    try {
      const r2Obj = await getObjectFromR2(R2_METADATA_HISTORY_KEY);
      if (r2Obj && r2Obj.body) {
        const text = Buffer.from(r2Obj.body).toString('utf8');
        const parsed = JSON.parse(text);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch (err) {
      console.warn('Gagal membaca history dari Cloudflare R2:', err);
    }
  }

  // 2. Fallback disk lokal
  try {
    const raw = await fs.readFile(HISTORY_FILE_PATH, 'utf8');
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

// Simpan riwayat upload ke Cloudflare R2 dan disk lokal
async function saveHistory(records: UploadedTtbItem[]) {
  const jsonStr = JSON.stringify(records, null, 2);

  // 1. Simpan ke Cloudflare R2 agar persisten di serverless Vercel & Cloudflare Pages
  if (isR2Configured()) {
    try {
      await uploadToR2({
        key: R2_METADATA_HISTORY_KEY,
        body: Buffer.from(jsonStr, 'utf8'),
        contentType: 'application/json',
      });
    } catch (err) {
      console.warn('Gagal menyimpan history ke Cloudflare R2:', err);
    }
  }

  // 2. Simpan salinan ke disk lokal
  try {
    await fs.mkdir(path.dirname(HISTORY_FILE_PATH), { recursive: true });
    await fs.writeFile(HISTORY_FILE_PATH, jsonStr, 'utf8');
  } catch {
    // Non-fatal di serverless
  }
}

// GET: Ambil riwayat berkas TTB yang ada di Cloudflare R2
export async function GET() {
  try {
    const isR2Active = isR2Configured();
    const config = getR2Config();
    let history = await getHistory();

    // Jika R2 aktif, scan berkas fisik di ttb-documents/ untuk menjamin dokumen R2 selalu muncul
    if (isR2Active) {
      try {
        const docs = await listR2Objects('ttb-documents/', 1000);
        const existingKeys = new Set(
          history.map((h) => h.r2Key || `ttb-documents/${h.renamedFileName}`)
        );
        let hasNewDocs = false;

        for (const doc of docs) {
          if (!existingKeys.has(doc.key)) {
            const head = await getHeadObjectFromR2(doc.key);
            const fileName = doc.name;
            const meta = head?.metadata || {};
            const cleanTtb =
              meta.cleannottb ||
              meta.nottb ||
              sanitizeTtbNumber(fileName.replace(/\.pdf$/i, ''));

            history.push({
              id: `r2-${cleanTtb}-${doc.size}`,
              noTtb: meta.nottb || cleanTtb,
              cleanNoTtb: cleanTtb,
              armada: meta.armada || '-',
              receivedDate: doc.lastModified
                ? doc.lastModified.toISOString().slice(0, 10)
                : new Date().toISOString().slice(0, 10),
              keterangan: meta.keterangan || '',
              originalFileName: meta.originalname || fileName,
              renamedFileName: fileName,
              fileSize: doc.size,
              fileType: 'application/pdf',
              fileUrl: getR2FileUrl(doc.key),
              r2Key: doc.key,
              storageProvider: 'CLOUDFLARE_R2',
              uploadedAt: doc.lastModified
                ? doc.lastModified.toISOString()
                : new Date().toISOString(),
              status: 'STORED_IN_CLOUDFLARE_R2',
            });
            hasNewDocs = true;
          }
        }

        if (hasNewDocs) {
          history.sort(
            (a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime()
          );
          await saveHistory(history);
        }
      } catch (scanErr) {
        console.warn('Gagal scan berkas R2 secara live:', scanErr);
      }
    }

    // Pastikan URL file selalu merujuk ke endpoint yang valid
    const formattedHistory = history.map((item) => {
      if (item.r2Key && isR2Active) {
        return {
          ...item,
          fileUrl: getR2FileUrl(item.r2Key),
        };
      }
      return item;
    });

    formattedHistory.sort(
      (a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime()
    );

    return NextResponse.json({
      success: true,
      storageProvider: isR2Active ? 'CLOUDFLARE_R2' : 'LOCAL',
      bucketName: config.bucketName,
      isR2StorageActive: isR2Active,
      items: formattedHistory,
    });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: (err as Error).message },
      { status: 500 }
    );
  }
}

// POST: Unggah berkas baru, auto-rename, dan simpan langsung ke Cloudflare Storage (R2)
export async function POST(req: NextRequest): Promise<NextResponse<UploadTtbResponse>> {
  try {
    const formData = await req.formData();
    const noTtbRaw = ((formData.get('noTtb') as string) || '').trim();
    const armada = ((formData.get('armada') as string) || '').trim();
    const receivedDate = ((formData.get('receivedDate') as string) || '').trim();
    const keterangan = ((formData.get('keterangan') as string) || '').trim();

    if (!noTtbRaw) {
      return NextResponse.json(
        {
          success: false,
          message: 'Nomor TTB wajib diisi.',
          storageProvider: 'CLOUDFLARE_R2',
          uploadedFiles: [],
          error: 'Nomor TTB wajib diisi.',
        },
        { status: 400 }
      );
    }

    // Ambil semua file yang diupload
    const files: File[] = [];
    const allFiles = formData.getAll('files');
    if (allFiles.length > 0) {
      for (const item of allFiles) {
        if (item instanceof File && item.size > 0) {
          files.push(item);
        }
      }
    }
    const singleFile = formData.get('file');
    if (singleFile instanceof File && singleFile.size > 0 && files.length === 0) {
      files.push(singleFile);
    }

    if (files.length === 0) {
      return NextResponse.json(
        {
          success: false,
          message: 'Minimal pilih 1 file gambar atau dokumen scan PDF.',
          storageProvider: 'CLOUDFLARE_R2',
          uploadedFiles: [],
          error: 'Berkas tidak ditemukan.',
        },
        { status: 400 }
      );
    }

    // Validasi format
    for (const f of files) {
      const ext = path.extname(f.name).toLowerCase();
      if (!ALLOWED_EXT.test(ext)) {
        return NextResponse.json(
          {
            success: false,
            message: `Format file "${f.name}" tidak didukung. Harap unggah format JPG, PNG, WEBP, atau PDF.`,
            storageProvider: 'CLOUDFLARE_R2',
            uploadedFiles: [],
            error: 'Format file tidak didukung.',
          },
          { status: 400 }
        );
      }
    }

    const cleanNoTtb = sanitizeTtbNumber(noTtbRaw);
    const targetPhotosDir = getPhotosDir();
    try {
      await fs.mkdir(targetPhotosDir, { recursive: true });
    } catch {
      // Abaikan jika serverless readonly
    }

    const currentHistory = await getHistory();
    const newlyUploadedItems: UploadedTtbItem[] = [];
    const isR2Active = isR2Configured();
    const r2Config = getR2Config();

    // Baca manifest galeri foto jika ada untuk auto-sinkron foto baru
    let photoManifest: Record<string, string> = {};
    try {
      const rawManifest = await fs.readFile(MANIFEST_PATH, 'utf8');
      photoManifest = JSON.parse(rawManifest);
    } catch {
      photoManifest = {};
    }

    // Loop proses upload ke Cloudflare R2 & fallback lokal
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      const renamedFileName = formatTtbFilename(cleanNoTtb, f.name, i, files.length);
      const buffer = Buffer.from(await f.arrayBuffer());
      const isPdf = renamedFileName.toLowerCase().endsWith('.pdf');
      const mimeType = getMimeType(renamedFileName, f.type);

      // Tentukan lokasi prefix folder di Cloudflare R2
      const r2Key = isPdf ? `ttb-documents/${renamedFileName}` : `ttb-photos/${renamedFileName}`;

      let publicUrl = `/api/upload-ttb/file?name=${encodeURIComponent(renamedFileName)}`;
      let storageProvider: 'CLOUDFLARE_R2' | 'LOCAL' = 'LOCAL';

      // 1. Upload ke Cloudflare R2
      if (isR2Active) {
        try {
          const r2Res = await uploadToR2({
            key: r2Key,
            body: buffer,
            contentType: mimeType,
            metadata: {
              noTtb: noTtbRaw,
              cleanNoTtb,
              armada: armada || '-',
              originalName: f.name,
            },
          });
          publicUrl = r2Res.url;
          storageProvider = 'CLOUDFLARE_R2';

          // Jika berupa gambar, daftarkan juga ke manifest galeri foto TTB agar langsung muncul
          if (!isPdf) {
            photoManifest[renamedFileName] = publicUrl;
          }
        } catch (r2Err) {
          console.warn('Cloudflare R2 upload error, fallback ke penyimpanan lokal:', r2Err);
        }
      }

      // 2. Simpan salinan ke local storage jika diizinkan sistem file
      try {
        const localFilePath = path.join(targetPhotosDir, renamedFileName);
        await fs.writeFile(localFilePath, buffer);
      } catch {
        // Non-fatal di serverless
      }

      const record: UploadedTtbItem = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        noTtb: noTtbRaw,
        cleanNoTtb,
        armada: armada || '-',
        receivedDate: receivedDate || new Date().toISOString().slice(0, 10),
        keterangan: keterangan || '',
        originalFileName: f.name,
        renamedFileName,
        fileSize: f.size,
        fileType: mimeType,
        fileUrl: publicUrl,
        r2Key: isR2Active ? r2Key : undefined,
        r2Url: isR2Active ? publicUrl : undefined,
        storageProvider,
        uploadedAt: new Date().toISOString(),
        status: 'STORED_IN_CLOUDFLARE_R2',
      };

      newlyUploadedItems.push(record);
    }

    // Masukkan ke riwayat paling atas
    for (const item of newlyUploadedItems) {
      currentHistory.unshift(item);
    }

    await saveHistory(currentHistory);

    // Perbarui manifest galeri foto jika ada foto baru
    if (Object.keys(photoManifest).length > 0) {
      try {
        await fs.writeFile(MANIFEST_PATH, JSON.stringify(photoManifest, null, 1), 'utf8');
      } catch {
        // Non-fatal
      }
    }

    const renamedSummary = newlyUploadedItems.map((item) => item.renamedFileName).join(', ');
    const destinationText = isR2Active ? `Cloudflare Storage (${r2Config.bucketName})` : 'Penyimpanan Lokal';

    return NextResponse.json({
      success: true,
      message: `Berhasil mengunggah ${newlyUploadedItems.length} berkas ke ${destinationText}: ${renamedSummary}`,
      storageProvider: isR2Active ? 'CLOUDFLARE_R2' : 'LOCAL',
      bucketName: r2Config.bucketName,
      isR2StorageActive: isR2Active,
      uploadedFiles: newlyUploadedItems,
    });
  } catch (error) {
    console.error('Upload TTB error:', error);
    return NextResponse.json(
      {
        success: false,
        message: `Gagal mengunggah berkas: ${(error as Error).message}`,
        storageProvider: 'CLOUDFLARE_R2',
        uploadedFiles: [],
        error: (error as Error).message,
      },
      { status: 500 }
    );
  }
}
