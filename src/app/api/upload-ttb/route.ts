import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import { put } from '@vercel/blob';
import { sanitizeTtbNumber, formatTtbFilename } from '@/utils/ttbRename';
import { getPhotosDir } from '@/utils/ttbPhotosDir';
import { UploadedTtbItem, UploadTtbResponse } from '@/types/ttbUpload';
import {
  DEFAULT_DRIVE_FOLDER_ID,
  DEFAULT_DRIVE_FOLDER_URL,
  uploadToGoogleDriveAppsScript,
  GoogleDriveUploadPayloadFile,
} from '@/utils/googleDriveAppsScript';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const GOOGLE_DRIVE_FOLDER_ID = process.env.GOOGLE_DRIVE_TTB_FOLDER_ID || DEFAULT_DRIVE_FOLDER_ID;
const GOOGLE_DRIVE_FOLDER_URL = `https://drive.google.com/drive/folders/${GOOGLE_DRIVE_FOLDER_ID}`;

const ALLOWED_EXT = /\.(jpe?g|png|webp|gif|pdf)$/i;
const HISTORY_FILE_PATH = path.join(process.cwd(), 'src', 'data', 'ttb-uploads-history.json');
const MANIFEST_PATH = path.join(process.cwd(), 'src', 'data', 'ttb-photos-manifest.json');

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

    // Cari spreadsheetUrl terbaru jika ada
    const latestSpreadsheet = sorted.find((s) => s.spreadsheetUrl)?.spreadsheetUrl;

    return NextResponse.json({
      success: true,
      folderId: GOOGLE_DRIVE_FOLDER_ID,
      driveFolderUrl: GOOGLE_DRIVE_FOLDER_URL,
      spreadsheetUrl: latestSpreadsheet,
      items: sorted,
    });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: (err as Error).message },
      { status: 500 }
    );
  }
}

// POST: Unggah berkas baru, auto-rename, upload ke Google Drive Apps Script & simpan ke Database Google Sheets
export async function POST(req: NextRequest): Promise<NextResponse<UploadTtbResponse>> {
  try {
    const formData = await req.formData();
    const noTtbRaw = ((formData.get('noTtb') as string) || '').trim();
    const armada = ((formData.get('armada') as string) || '').trim();
    const receivedDate = ((formData.get('receivedDate') as string) || '').trim();
    const keterangan = ((formData.get('keterangan') as string) || '').trim();

    // Script URL & Folder ID dari form data, header, atau env
    const scriptUrlParam = ((formData.get('driveScriptUrl') as string) || '').trim();
    const headerScriptUrl = req.headers.get('x-google-drive-script-url') || '';
    const driveScriptUrl = scriptUrlParam || headerScriptUrl || process.env.GOOGLE_DRIVE_SCRIPT_URL || '';

    const folderIdParam = ((formData.get('folderId') as string) || '').trim();
    const targetFolderId = folderIdParam || GOOGLE_DRIVE_FOLDER_ID;
    const targetFolderUrl = `https://drive.google.com/drive/folders/${targetFolderId}`;

    if (!noTtbRaw) {
      return NextResponse.json(
        {
          success: false,
          message: 'Nomor TTB wajib diisi.',
          driveFolderUrl: targetFolderUrl,
          folderId: targetFolderId,
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
          driveFolderUrl: targetFolderUrl,
          folderId: targetFolderId,
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
            driveFolderUrl: targetFolderUrl,
            folderId: targetFolderId,
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

    // Siapkan list payload untuk Google Apps Script
    const appsScriptFilesPayload: GoogleDriveUploadPayloadFile[] = [];

    // Loop proses simpan lokal & siapkan payload
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      const renamedFileName = formatTtbFilename(cleanNoTtb, f.name, i, files.length);
      const buffer = Buffer.from(await f.arrayBuffer());
      const isPdf = renamedFileName.toLowerCase().endsWith('.pdf');
      const mimeType = getMimeType(renamedFileName, f.type);

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

      // Siapkan payload base64 untuk Google Drive
      appsScriptFilesPayload.push({
        fileName: renamedFileName,
        originalFileName: f.name,
        mimeType,
        base64: buffer.toString('base64'),
      });

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
        driveFolderUrl: targetFolderUrl,
        uploadedAt: new Date().toISOString(),
        status: 'SYNCED_TO_DRIVE',
      };

      newlyUploadedItems.push(record);
    }

    // 3. Kirim ke Database Google Drive (via Google Apps Script Web App jika URL tersedia)
    let isDriveDatabaseActive = false;
    let driveSpreadsheetUrl: string | undefined = undefined;

    if (driveScriptUrl) {
      try {
        const driveResponse = await uploadToGoogleDriveAppsScript(
          driveScriptUrl,
          {
            action: 'upload',
            folderId: targetFolderId,
            metadata: {
              noTtb: noTtbRaw,
              cleanNoTtb,
              armada: armada || '-',
              receivedDate: receivedDate || new Date().toISOString().slice(0, 10),
              keterangan,
            },
            files: appsScriptFilesPayload,
          },
          45000 // 45 detik timeout untuk pengiriman file besar
        );

        if (driveResponse.success && driveResponse.files) {
          isDriveDatabaseActive = true;
          driveSpreadsheetUrl = driveResponse.spreadsheetUrl;

          // Cocokkan metadata file dari Google Drive
          for (const item of newlyUploadedItems) {
            const matchedDriveFile = driveResponse.files.find(
              (df) => df.fileName === item.renamedFileName
            );

            if (matchedDriveFile) {
              item.driveFileId = matchedDriveFile.fileId;
              item.driveViewUrl = matchedDriveFile.webViewLink;
              item.driveDownloadUrl = matchedDriveFile.downloadUrl;
              item.spreadsheetUrl = driveResponse.spreadsheetUrl;
              item.status = 'SAVED_TO_DRIVE_DATABASE';
            }
          }
        }
      } catch (driveErr) {
        console.warn('Gagal sinkron langsung ke Google Apps Script:', driveErr);
        // Tetap lanjut, file sudah aman di lokal storage
      }
    }

    // Masukkan ke history
    for (const item of newlyUploadedItems) {
      currentHistory.unshift(item);
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
    const successMsg = isDriveDatabaseActive
      ? `Berhasil mengunggah ${newlyUploadedItems.length} berkas ke Google Drive & Database Google Sheets (${renamedSummary}).`
      : `File berhasil disimpan lokal & di-rename: ${renamedSummary}`;

    return NextResponse.json({
      success: true,
      message: successMsg,
      driveFolderUrl: targetFolderUrl,
      folderId: targetFolderId,
      spreadsheetUrl: driveSpreadsheetUrl,
      isDriveDatabaseActive,
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
