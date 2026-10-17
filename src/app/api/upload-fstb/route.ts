import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import { sanitizeFstbNumber, formatFstbFilename, extractFstbComponents } from '@/utils/fstbRename';
import { getFstbPhotosDir } from '@/utils/fstbPhotosDir';
import { UploadedFstbItem, UploadFstbResponse } from '@/types/fstbUpload';
import { stampFstbPdf, formatFstbStampDate } from '@/utils/fstbStamper';
import {
  uploadToR2,
  isR2Configured,
  getR2FileUrl,
  getR2Config,
  getObjectFromR2,
  listR2Objects,
  getHeadObjectFromR2,
  deleteFromR2,
} from '@/utils/r2Client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ALLOWED_EXT = /\.(jpe?g|png|webp|gif|pdf)$/i;
const HISTORY_FILE_PATH = path.join(process.cwd(), 'src', 'data', 'fstb-uploads-history.json');
const R2_METADATA_HISTORY_KEY = 'fstb-metadata/history.json';

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

// Baca riwayat upload FSTB dari Cloudflare R2 (dengan fallback ke disk lokal)
async function getHistory(): Promise<UploadedFstbItem[]> {
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
      console.warn('Gagal membaca history FSTB dari Cloudflare R2:', err);
    }
  }

  try {
    const raw = await fs.readFile(HISTORY_FILE_PATH, 'utf8');
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

// Simpan riwayat upload FSTB ke Cloudflare R2 dan disk lokal
async function saveHistory(records: UploadedFstbItem[]) {
  const jsonStr = JSON.stringify(records, null, 2);

  if (isR2Configured()) {
    try {
      await uploadToR2({
        key: R2_METADATA_HISTORY_KEY,
        body: Buffer.from(jsonStr, 'utf8'),
        contentType: 'application/json',
      });
    } catch (err) {
      console.warn('Gagal menyimpan history FSTB ke Cloudflare R2:', err);
    }
  }

  try {
    await fs.mkdir(path.dirname(HISTORY_FILE_PATH), { recursive: true });
    await fs.writeFile(HISTORY_FILE_PATH, jsonStr, 'utf8');
  } catch {
    // Non-fatal di serverless
  }
}

// GET: Ambil riwayat berkas FSTB di Cloudflare R2 / lokal
export async function GET(req: NextRequest) {
  try {
    const isR2Active = isR2Configured();
    const config = getR2Config();
    let history = await getHistory();

    // Jika R2 aktif, sinkronisasi dua arah dengan berkas fisik di Cloudflare R2
    if (isR2Active) {
      try {
        const docs = await listR2Objects('fstb-documents/', 1000);
        const liveR2Keys = new Set(docs.map((d) => d.key));
        const liveFileNames = new Set(docs.map((d) => d.name));
        let hasChanges = false;

        // 1. Bersihkan riwayat yang berkas fisiknya sudah terhapus di R2
        const initialCount = history.length;
        history = history.filter((h) => {
          const isR2Doc =
            h.storageProvider === 'CLOUDFLARE_R2' ||
            h.status === 'STORED_IN_CLOUDFLARE_R2' ||
            (h.r2Key && h.r2Key.startsWith('fstb-documents/')) ||
            (h.renamedFileName && h.renamedFileName.toLowerCase().endsWith('.pdf'));

          if (isR2Doc) {
            const fileKey = h.r2Key || `fstb-documents/${h.renamedFileName}`;
            const stillExists = liveR2Keys.has(fileKey) || liveFileNames.has(h.renamedFileName);
            if (!stillExists) {
              return false;
            }
          }
          return true;
        });

        if (history.length !== initialCount) {
          hasChanges = true;
        }

        // 2. Daftarkan berkas R2 yang belum tercatat di riwayat
        const knownKeys = new Set(history.map((h) => h.r2Key || `fstb-documents/${h.renamedFileName}`));
        const knownFileNames = new Set(history.map((h) => h.renamedFileName));

        for (const doc of docs) {
          if (!knownKeys.has(doc.key) && !knownFileNames.has(doc.name)) {
            const comp = extractFstbComponents(doc.name);
            const cleanNoFstb = comp.canonicalFstb || doc.name.replace(/\.[^.]+$/, '');
            const ext = path.extname(doc.name).toLowerCase();

            history.unshift({
              id: `r2-sync-${doc.key.replace(/[^a-zA-Z0-9]/g, '-')}`,
              noFstb: cleanNoFstb,
              cleanNoFstb,
              armada: '-',
              receivedDate: doc.lastModified ? doc.lastModified.toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10),
              keterangan: 'Auto-synced from Cloudflare R2 bucket',
              originalFileName: doc.name,
              renamedFileName: doc.name,
              fileSize: doc.size,
              fileType: getMimeType(doc.name),
              fileUrl: getR2FileUrl(doc.key),
              r2Key: doc.key,
              r2Url: getR2FileUrl(doc.key),
              storageProvider: 'CLOUDFLARE_R2',
              uploadedAt: doc.lastModified ? doc.lastModified.toISOString() : new Date().toISOString(),
              status: 'STORED_IN_CLOUDFLARE_R2',
            });
            hasChanges = true;
          }
        }

        if (hasChanges) {
          await saveHistory(history);
        }
      } catch (syncErr) {
        console.warn('Gagal sinkronisasi daftar dokumen R2 FSTB:', syncErr);
      }
    }

    // Filter berdasarkan nomor FSTB jika ada parameter ?fstb=...
    const filterFstb = req.nextUrl.searchParams.get('fstb') || req.nextUrl.searchParams.get('q');
    if (filterFstb) {
      const cleanTarget = filterFstb.toUpperCase().trim();
      const comp = extractFstbComponents(cleanTarget);
      const targetNum = comp.number || comp.rawNumber;

      const filtered = history.filter((item) => {
        if (item.noFstb && item.noFstb.toUpperCase().includes(cleanTarget)) return true;
        if (item.cleanNoFstb && item.cleanNoFstb.toUpperCase().includes(cleanTarget)) return true;
        if (item.armada && item.armada.toUpperCase().includes(cleanTarget)) return true;
        if (item.doNo && item.doNo.toUpperCase().includes(cleanTarget)) return true;
        if (item.noFpb && item.noFpb.toUpperCase().includes(cleanTarget)) return true;
        if (item.renamedFileName && item.renamedFileName.toUpperCase().includes(cleanTarget)) return true;

        if (targetNum) {
          const itemNum = item.cleanNoFstb?.replace(/\D/g, '') || '';
          if (itemNum.endsWith(targetNum)) return true;
        }

        return false;
      });

      return NextResponse.json({
        success: true,
        isR2StorageActive: isR2Active,
        storageProvider: isR2Active ? 'CLOUDFLARE_R2' : 'LOCAL',
        bucketName: config.bucketName,
        total: filtered.length,
        items: filtered,
      });
    }

    return NextResponse.json({
      success: true,
      isR2StorageActive: isR2Active,
      storageProvider: isR2Active ? 'CLOUDFLARE_R2' : 'LOCAL',
      bucketName: config.bucketName,
      total: history.length,
      items: history,
    });
  } catch (error) {
    console.error('Gagal mengambil history FSTB:', error);
    return NextResponse.json(
      {
        success: false,
        error: (error as Error).message || 'Gagal mengambil riwayat upload FSTB.',
        items: [],
      },
      { status: 500 }
    );
  }
}

// POST: Upload dokumen / foto FSTB ke Cloudflare R2
export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const files = formData.getAll('files') as File[];
    const noFstbRaw = (formData.get('noFstb') as string) || '';
    const armada = (formData.get('armada') as string) || '';
    const doNo = (formData.get('doNo') as string) || '';
    const noFpb = (formData.get('noFpb') as string) || '';
    const receivedDate = (formData.get('receivedDate') as string) || '';
    const fstbDate = (formData.get('fstbDate') as string) || '';
    const keterangan = (formData.get('keterangan') as string) || '';

    // Data Identitas Uploader
    const uploaderName = (formData.get('uploaderName') as string) || '';
    const uploaderUsername = (formData.get('uploaderUsername') as string) || '';
    const uploaderRole = (formData.get('uploaderRole') as string) || '';
    const uploaderNik = (formData.get('uploaderNik') as string) || '';
    const uploaderJabatan = (formData.get('uploaderJabatan') as string) || '';
    const autoStamp = formData.get('autoStamp') === 'true';
    const stampDate = (formData.get('stampDate') as string) || formatFstbStampDate(new Date());
    const signatureDataUrl = (formData.get('signatureDataUrl') as string) || '';

    if (!files || files.length === 0) {
      return NextResponse.json({ success: false, error: 'Tidak ada berkas yang dipilih.' }, { status: 400 });
    }

    if (!noFstbRaw) {
      return NextResponse.json({ success: false, error: 'Nomor FSTB wajib diisi.' }, { status: 400 });
    }

    // Validasi ekstensi berkas
    for (const f of files) {
      if (!ALLOWED_EXT.test(f.name)) {
        return NextResponse.json(
          { success: false, error: `Format berkas "${f.name}" tidak didukung. Harap gunakan PDF, JPG, atau PNG.` },
          { status: 400 }
        );
      }
    }

    const cleanNoFstb = sanitizeFstbNumber(noFstbRaw);
    const targetPhotosDir = getFstbPhotosDir();
    try {
      await fs.mkdir(targetPhotosDir, { recursive: true });
    } catch {
      // Non-fatal
    }

    const currentHistory = await getHistory();
    const newlyUploadedItems: UploadedFstbItem[] = [];
    const isR2Active = isR2Configured();

    // Loop upload setiap berkas
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      const renamedFileName = formatFstbFilename(cleanNoFstb, f.name, i, files.length);
      let buffer: Buffer = Buffer.from(await f.arrayBuffer());
      const isPdf = renamedFileName.toLowerCase().endsWith('.pdf');
      const mimeType = getMimeType(renamedFileName, f.type);
      let isFileStamped = false;

      // Auto-stamp tanda tangan jika diminta
      if (isPdf && autoStamp && (uploaderName || signatureDataUrl)) {
        try {
          const stamped = await stampFstbPdf({
            pdfBuffer: buffer,
            signatureDataUrl: signatureDataUrl || undefined,
            uploaderName,
            uploadDate: stampDate,
            roleType: 'purchasing',
          });
          buffer = stamped;
          isFileStamped = true;
        } catch (stampErr) {
          console.warn('Auto-stamp PDF FSTB gagal, menggunakan berkas asli:', stampErr);
        }
      }

      const r2Key = isPdf ? `fstb-documents/${renamedFileName}` : `fstb-photos/${renamedFileName}`;
      let publicUrl = `/api/upload-fstb/file?name=${encodeURIComponent(renamedFileName)}`;
      let storageProvider: 'CLOUDFLARE_R2' | 'LOCAL' = 'LOCAL';

      if (isR2Active) {
        try {
          const r2Res = await uploadToR2({
            key: r2Key,
            body: buffer,
            contentType: mimeType,
            metadata: {
              noFstb: noFstbRaw,
              cleanNoFstb,
              armada: armada || '-',
              doNo: doNo || '',
              noFpb: noFpb || '',
              originalName: f.name,
              uploaderName: uploaderName || '',
              uploaderNik: uploaderNik || '',
              uploaderJabatan: uploaderJabatan || '',
              isAutoStamped: isFileStamped ? 'true' : 'false',
            },
          });
          publicUrl = r2Res.url;
          storageProvider = 'CLOUDFLARE_R2';
        } catch (r2Err) {
          console.warn('Cloudflare R2 upload error FSTB, fallback lokal:', r2Err);
        }
      }

      // Simpan salinan lokal
      try {
        const localFilePath = path.join(targetPhotosDir, renamedFileName);
        await fs.writeFile(localFilePath, buffer);
      } catch {
        // Non-fatal
      }

      const record: UploadedFstbItem = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        noFstb: noFstbRaw,
        cleanNoFstb,
        armada: armada || '-',
        doNo: doNo || undefined,
        noFpb: noFpb || undefined,
        receivedDate: receivedDate || new Date().toISOString().slice(0, 10),
        fstbDate: fstbDate || undefined,
        keterangan: keterangan || '',
        originalFileName: f.name,
        renamedFileName,
        fileSize: buffer.length,
        fileType: mimeType,
        fileUrl: publicUrl,
        r2Key: storageProvider === 'CLOUDFLARE_R2' ? r2Key : undefined,
        r2Url: storageProvider === 'CLOUDFLARE_R2' ? publicUrl : undefined,
        storageProvider,
        uploadedAt: new Date().toISOString(),
        status: storageProvider === 'CLOUDFLARE_R2' ? 'STORED_IN_CLOUDFLARE_R2' : 'UPLOADED_TO_SYSTEM',
        uploaderName: uploaderName || undefined,
        uploaderUsername: uploaderUsername || undefined,
        uploaderRole: uploaderRole || undefined,
        uploaderNik: uploaderNik || undefined,
        uploaderJabatan: uploaderJabatan || undefined,
        isAutoStamped: isFileStamped,
        stampedAt: isFileStamped ? new Date().toISOString() : undefined,
      };

      newlyUploadedItems.push(record);
      currentHistory.unshift(record);
    }

    await saveHistory(currentHistory);

    const response: UploadFstbResponse = {
      success: true,
      message: `Berhasil mengunggah ${newlyUploadedItems.length} berkas FSTB ${cleanNoFstb} ke ${
        isR2Active ? 'Cloudflare R2 Storage' : 'penyimpanan lokal'
      }!`,
      storageProvider: isR2Active ? 'CLOUDFLARE_R2' : 'LOCAL',
      bucketName: getR2Config().bucketName,
      isR2StorageActive: isR2Active,
      uploadedFiles: newlyUploadedItems,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Upload FSTB error:', error);
    return NextResponse.json(
      { success: false, error: (error as Error).message || 'Terjadi kesalahan saat mengunggah berkas FSTB.' },
      { status: 500 }
    );
  }
}

// DELETE: Hapus berkas FSTB dari Cloudflare R2 dan riwayat
export async function DELETE(req: NextRequest) {
  try {
    const id = req.nextUrl.searchParams.get('id');
    const r2KeyParam = req.nextUrl.searchParams.get('r2Key');
    const fileNameParam = req.nextUrl.searchParams.get('name');

    if (!id && !r2KeyParam && !fileNameParam) {
      return NextResponse.json({ success: false, error: 'Parameter id, r2Key, atau name wajib disertakan.' }, { status: 400 });
    }

    const history = await getHistory();
    const itemToDelete = history.find(
      (h) =>
        (id && h.id === id) ||
        (r2KeyParam && h.r2Key === r2KeyParam) ||
        (fileNameParam && h.renamedFileName === fileNameParam)
    );

    const updated = history.filter((h) => h !== itemToDelete);

    if (itemToDelete) {
      const keyToDelete = itemToDelete.r2Key || (itemToDelete.fileType === 'application/pdf' ? `fstb-documents/${itemToDelete.renamedFileName}` : `fstb-photos/${itemToDelete.renamedFileName}`);

      if (isR2Configured() && keyToDelete) {
        try {
          await deleteFromR2(keyToDelete);
        } catch (r2Err) {
          console.warn('Gagal menghapus dari Cloudflare R2:', r2Err);
        }
      }

      try {
        const localPath = path.join(getFstbPhotosDir(), itemToDelete.renamedFileName);
        await fs.unlink(localPath);
      } catch {
        // Non-fatal
      }
    }

    await saveHistory(updated);

    return NextResponse.json({
      success: true,
      message: itemToDelete
        ? `Berkas FSTB "${itemToDelete.renamedFileName}" berhasil dihapus dari Cloudflare R2 & riwayat.`
        : 'Berkas berhasil dihapus.',
      remaining: updated.length,
    });
  } catch (error) {
    console.error('Delete FSTB error:', error);
    return NextResponse.json(
      { success: false, error: (error as Error).message || 'Gagal menghapus berkas FSTB.' },
      { status: 500 }
    );
  }
}

// PATCH: Edit metadata berkas FSTB
export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, armada, doNo, noFpb, keterangan, receivedDate, fstbDate } = body;

    if (!id) {
      return NextResponse.json({ success: false, error: 'ID berkas wajib disertakan.' }, { status: 400 });
    }

    const history = await getHistory();
    const index = history.findIndex((h) => h.id === id);
    if (index === -1) {
      return NextResponse.json({ success: false, error: 'Berkas FSTB tidak ditemukan.' }, { status: 404 });
    }

    history[index] = {
      ...history[index],
      armada: armada !== undefined ? armada : history[index].armada,
      doNo: doNo !== undefined ? doNo : history[index].doNo,
      noFpb: noFpb !== undefined ? noFpb : history[index].noFpb,
      keterangan: keterangan !== undefined ? keterangan : history[index].keterangan,
      receivedDate: receivedDate !== undefined ? receivedDate : history[index].receivedDate,
      fstbDate: fstbDate !== undefined ? fstbDate : history[index].fstbDate,
    };

    await saveHistory(history);

    return NextResponse.json({
      success: true,
      message: 'Data FSTB berhasil diperbarui.',
      item: history[index],
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: (error as Error).message || 'Gagal memperbarui data FSTB.' },
      { status: 500 }
    );
  }
}

