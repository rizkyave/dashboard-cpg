import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import { sanitizeTtbNumber, formatTtbFilename } from '@/utils/ttbRename';
import { getPhotosDir } from '@/utils/ttbPhotosDir';
import { UploadedTtbItem, UploadTtbResponse } from '@/types/ttbUpload';
import { uploadToR2, isR2Configured, getR2FileUrl } from '@/utils/r2Client';
import {
  DEFAULT_DRIVE_FOLDER_ID,
  DEFAULT_DRIVE_FOLDER_URL,
  uploadToGoogleDriveAppsScript,
  listGoogleDriveDatabaseItems,
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
    const urlParam = req.nextUrl.searchParams.get('scriptUrl') || '';
    const headerUrl = req.headers.get('x-google-drive-script-url') || '';
    const driveScriptUrl = urlParam || headerUrl || process.env.GOOGLE_DRIVE_SCRIPT_URL || '';

    const folderIdParam = req.nextUrl.searchParams.get('folderId') || '';
    const targetFolderId = folderIdParam || GOOGLE_DRIVE_FOLDER_ID;
    const targetFolderUrl = `https://drive.google.com/drive/folders/${targetFolderId}`;

    const isR2Active = isR2Configured();

    // 1. Ambil riwayat lokal/cache sebagai basis awal
    const localHistory = await getHistory();

    // Pastikan URL file ter-resolve ke Cloudflare R2 jika key R2 tersedia
    const formattedHistory = localHistory.map((item) => {
      if (item.r2Key && isR2Active) {
        return {
          ...item,
          fileUrl: getR2FileUrl(item.r2Key),
        };
      }
      return item;
    });

    // 2. Jika Google Apps Script Web App tersedia, baca langsung Database Spreadsheet Google Drive
    if (driveScriptUrl) {
      try {
        const driveResult = await listGoogleDriveDatabaseItems(driveScriptUrl, targetFolderId);
        if (driveResult.success && driveResult.items) {
          const mergedMap = new Map<string, UploadedTtbItem>();

          // Masukkan item dari Google Drive Spreadsheet terlebih dahulu
          for (const item of driveResult.items) {
            const key = (item.cleanNoTtb || item.noTtb) + '_' + item.renamedFileName;
            mergedMap.set(key, item);
          }

          // Tambahkan item lokal yang belum tercatat di Drive
          for (const item of formattedHistory) {
            const key = (item.cleanNoTtb || item.noTtb) + '_' + item.renamedFileName;
            if (!mergedMap.has(key)) {
              mergedMap.set(key, item);
            }
          }

          const mergedItems = Array.from(mergedMap.values()).sort(
            (a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime()
          );

          return NextResponse.json({
            success: true,
            folderId: targetFolderId,
            driveFolderUrl: targetFolderUrl,
            spreadsheetUrl: driveResult.spreadsheetUrl || formattedHistory.find((s) => s.spreadsheetUrl)?.spreadsheetUrl,
            isDriveDatabaseActive: true,
            isR2StorageActive: isR2Active,
            items: mergedItems,
          });
        }
      } catch (driveErr) {
        console.warn('Gagal membaca database Google Drive secara langsung, menggunakan cadangan lokal:', driveErr);
      }
    }

    // 3. Fallback jika scriptUrl belum diatur atau offline
    const sorted = [...formattedHistory].sort(
      (a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime()
    );

    const latestSpreadsheet = sorted.find((s) => s.spreadsheetUrl)?.spreadsheetUrl;

    return NextResponse.json({
      success: true,
      folderId: targetFolderId,
      driveFolderUrl: targetFolderUrl,
      spreadsheetUrl: latestSpreadsheet,
      isDriveDatabaseActive: !!driveScriptUrl,
      isR2StorageActive: isR2Active,
      items: sorted,
    });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: (err as Error).message },
      { status: 500 }
    );
  }
}

// POST: Unggah berkas baru, auto-rename, upload ke Cloudflare R2 & simpan ke Google Drive / Sheets
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
          driveFolderUrl: targetFolderUrl,
          folderId: targetFolderId,
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
    try {
      await fs.mkdir(targetPhotosDir, { recursive: true });
    } catch (mkdirErr) {
      console.warn('Lewati mkdir lokal:', mkdirErr);
    }

    const currentHistory = await getHistory();
    const newlyUploadedItems: UploadedTtbItem[] = [];
    const isR2Active = isR2Configured();

    // Baca manifest galeri foto jika ada untuk auto-sinkron foto baru
    let photoManifest: Record<string, string> = {};
    try {
      const rawManifest = await fs.readFile(MANIFEST_PATH, 'utf8');
      photoManifest = JSON.parse(rawManifest);
    } catch {
      photoManifest = {};
    }

    // Siapkan list payload untuk Google Apps Script
    const appsScriptFilesPayload: GoogleDriveUploadPayloadFile[] = [];

    // Loop proses upload ke Cloudflare R2 & storage lokal
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      const renamedFileName = formatTtbFilename(cleanNoTtb, f.name, i, files.length);
      const buffer = Buffer.from(await f.arrayBuffer());
      const isPdf = renamedFileName.toLowerCase().endsWith('.pdf');
      const mimeType = getMimeType(renamedFileName, f.type);

      // Tentukan folder di Cloudflare R2
      const r2Key = isPdf ? `ttb-documents/${renamedFileName}` : `ttb-photos/${renamedFileName}`;

      let publicUrl = `/api/upload-ttb/file?name=${encodeURIComponent(renamedFileName)}`;
      let storageProvider: 'CLOUDFLARE_R2' | 'LOCAL' = 'LOCAL';

      // 1. Upload ke Cloudflare R2 jika aktif
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

          // Jika berupa gambar, daftarkan juga ke manifest galeri foto TTB
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
      } catch (writeErr) {
        console.warn('Lewati penyimpanan disk lokal (serverless):', writeErr);
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
        r2Key: isR2Active ? r2Key : undefined,
        r2Url: isR2Active ? publicUrl : undefined,
        storageProvider,
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
          45000
        );

        if (driveResponse.success && driveResponse.files) {
          isDriveDatabaseActive = true;
          driveSpreadsheetUrl = driveResponse.spreadsheetUrl;

          for (const item of newlyUploadedItems) {
            const matchedDriveFile = driveResponse.files.find(
              (df) => df.fileName === item.renamedFileName
            );

            if (matchedDriveFile) {
              item.driveFileId = matchedDriveFile.fileId;
              item.driveViewUrl = matchedDriveFile.webViewLink;
              item.driveDownloadUrl = matchedDriveFile.downloadUrl;
              // Jika R2 aktif, simpan fileUrl dari R2; namun jika R2 belum ada, gunakan webViewLink Drive
              if (!isR2Active) {
                item.fileUrl = matchedDriveFile.webViewLink;
              }
              item.spreadsheetUrl = driveResponse.spreadsheetUrl;
              item.status = 'SAVED_TO_DRIVE_DATABASE';
            }
          }
        }
      } catch (driveErr) {
        console.warn('Gagal sinkron ke Google Apps Script:', driveErr);
      }
    }

    // Masukkan ke riwayat
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
    const destinationText = isR2Active ? 'Cloudflare R2' : 'Penyimpanan Lokal';
    const successMsg = isDriveDatabaseActive
      ? `Berhasil mengunggah ${newlyUploadedItems.length} berkas ke ${destinationText} & Google Drive Database (${renamedSummary}).`
      : `File berhasil diunggah ke ${destinationText}: ${renamedSummary}`;

    return NextResponse.json({
      success: true,
      message: successMsg,
      driveFolderUrl: targetFolderUrl,
      folderId: targetFolderId,
      spreadsheetUrl: driveSpreadsheetUrl,
      isDriveDatabaseActive,
      isR2StorageActive: isR2Active,
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
