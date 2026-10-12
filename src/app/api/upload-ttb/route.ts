import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import { put } from '@vercel/blob';
import { sanitizeTtbNumber, formatTtbFilename } from '@/utils/ttbRename';
import { getPhotosDir } from '@/utils/ttbPhotosDir';
import { UploadedTtbItem, UploadTtbResponse } from '@/types/ttbUpload';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const GOOGLE_DRIVE_FOLDER_ID = '1Hd6FsgWiAlQ1jJyRvh8auY0FJGE9h5tf';
const GOOGLE_DRIVE_FOLDER_URL = `https://drive.google.com/drive/folders/${GOOGLE_DRIVE_FOLDER_ID}`;

const ALLOWED_EXT = /\.(jpe?g|png|webp|gif|pdf)$/i;
const HISTORY_FILE_PATH = path.join(process.cwd(), 'src', 'data', 'ttb-uploads-history.json');
const MANIFEST_PATH = path.join(process.cwd(), 'src', 'data', 'ttb-photos-manifest.json');

// Baca riwayat upload dari disk
async function getHistory(): Promise<UploadedTtbItem[]> {
  try {
    const raw = await fs.readFile(HISTORY_FILE_PATH, 'utf8');
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

// Simpan riwayat upload ke disk
async function saveHistory(records: UploadedTtbItem[]) {
  try {
    await fs.mkdir(path.dirname(HISTORY_FILE_PATH), { recursive: true });
    await fs.writeFile(HISTORY_FILE_PATH, JSON.stringify(records, null, 2), 'utf8');
  } catch (err) {
    console.warn('Gagal menyimpan file riwayat upload:', err);
  }
}

// GET: Ambil riwayat berkas TTB yang pernah diunggah
export async function GET(req: NextRequest) {
  try {
    const history = await getHistory();
    const sorted = [...history].sort(
      (a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime()
    );
    return NextResponse.json({
      success: true,
      folderId: GOOGLE_DRIVE_FOLDER_ID,
      driveFolderUrl: GOOGLE_DRIVE_FOLDER_URL,
      items: sorted,
    });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: (err as Error).message },
      { status: 500 }
    );
  }
}

// POST: Unggah berkas baru, lakukan auto-rename berbasis No. TTB, dan simpan
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
          driveFolderUrl: GOOGLE_DRIVE_FOLDER_URL,
          folderId: GOOGLE_DRIVE_FOLDER_ID,
          uploadedFiles: [],
          error: 'Nomor TTB wajib diisi.',
        },
        { status: 400 }
      );
    }

    // Ambil semua file yang diupload (baik dari 'files' maupun 'file')
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
          driveFolderUrl: GOOGLE_DRIVE_FOLDER_URL,
          folderId: GOOGLE_DRIVE_FOLDER_ID,
          uploadedFiles: [],
          error: 'Berkas tidak ditemukan.',
        },
        { status: 400 }
      );
    }

    // Validasi ekstensi setiap file
    for (const f of files) {
      const ext = path.extname(f.name).toLowerCase();
      if (!ALLOWED_EXT.test(ext)) {
        return NextResponse.json(
          {
            success: false,
            message: `Format file "${f.name}" tidak didukung. Harap unggah format JPG, PNG, WEBP, atau PDF.`,
            driveFolderUrl: GOOGLE_DRIVE_FOLDER_URL,
            folderId: GOOGLE_DRIVE_FOLDER_ID,
            uploadedFiles: [],
            error: 'Format file tidak didukung.',
          },
          { status: 400 }
        );
      }
    }

    const cleanNoTtb = sanitizeTtbNumber(noTtbRaw);
    const targetPhotosDir = getPhotosDir();
    await fs.mkdir(targetPhotosDir, { recursive: true });

    const currentHistory = await getHistory();
    const newlyUploadedItems: UploadedTtbItem[] = [];
    const blobToken = process.env.BLOB_READ_WRITE_TOKEN;

    // Baca manifest blob jika ada untuk sync gambar
    let manifest: Record<string, string> = {};
    if (blobToken) {
      try {
        const rawManifest = await fs.readFile(MANIFEST_PATH, 'utf8');
        manifest = JSON.parse(rawManifest);
      } catch {
        manifest = {};
      }
    }

    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      const renamedFileName = formatTtbFilename(cleanNoTtb, f.name, i, files.length);
      const buffer = Buffer.from(await f.arrayBuffer());
      const isPdf = renamedFileName.toLowerCase().endsWith('.pdf');

      // 1. Simpan ke local storage
      const localFilePath = path.join(targetPhotosDir, renamedFileName);
      await fs.writeFile(localFilePath, buffer);

      let publicUrl = `/api/upload-ttb/file?name=${encodeURIComponent(renamedFileName)}`;

      // 2. Jika Vercel Blob aktif dan file gambar, upload ke Vercel Blob
      if (blobToken && !isPdf) {
        try {
          const blobRes = await put(`ttb-photos/${renamedFileName}`, buffer, {
            access: 'public',
            addRandomSuffix: false,
            allowOverwrite: true,
            token: blobToken,
          });
          publicUrl = blobRes.url;
          manifest[renamedFileName] = publicUrl;
        } catch (blobErr) {
          console.warn('Vercel Blob upload skipped/failed:', blobErr);
        }
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
        fileType: isPdf ? 'application/pdf' : f.type || 'image/jpeg',
        fileUrl: publicUrl,
        driveFolderUrl: GOOGLE_DRIVE_FOLDER_URL,
        uploadedAt: new Date().toISOString(),
        status: 'SYNCED_TO_DRIVE',
      };

      newlyUploadedItems.push(record);
      currentHistory.unshift(record);
    }

    // Perbarui riwayat di file JSON
    await saveHistory(currentHistory);

    // Perbarui manifest Vercel Blob jika ada perubahan
    if (blobToken && Object.keys(manifest).length > 0) {
      try {
        await fs.writeFile(MANIFEST_PATH, JSON.stringify(manifest, null, 1), 'utf8');
      } catch {
        // Non-fatal
      }
    }

    const renamedSummary = newlyUploadedItems.map((item) => item.renamedFileName).join(', ');

    return NextResponse.json({
      success: true,
      message: `File berhasil disimpan sebagai: ${renamedSummary}`,
      driveFolderUrl: GOOGLE_DRIVE_FOLDER_URL,
      folderId: GOOGLE_DRIVE_FOLDER_ID,
      uploadedFiles: newlyUploadedItems,
    });
  } catch (error) {
    console.error('Upload TTB error:', error);
    return NextResponse.json(
      {
        success: false,
        message: `Gagal mengunggah berkas: ${(error as Error).message}`,
        driveFolderUrl: GOOGLE_DRIVE_FOLDER_URL,
        folderId: GOOGLE_DRIVE_FOLDER_ID,
        uploadedFiles: [],
        error: (error as Error).message,
      },
      { status: 500 }
    );
  }
}

