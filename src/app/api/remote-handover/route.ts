import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import crypto from 'crypto';
import {
  uploadToR2,
  isR2Configured,
  getR2FileUrl,
  getObjectFromR2,
} from '@/utils/r2Client';
import { getPhotosDir } from '@/utils/ttbPhotosDir';
import { sanitizeTtbNumber, extractTtbComponents } from '@/utils/ttbRename';
import { stampTtbRecipientPdf, formatTtbStampDate } from '@/utils/ttbStamper';
import { computeValidationStatus } from '@/utils/validationHelper';
import { DocumentValidationRecord } from '@/types/documentValidation';
import { SerahTerimaItem } from '@/types/serahTerima';
import { UploadedTtbItem } from '@/types/ttbUpload';
import { RemoteHandoverTokenData, RemoteHandoverResponse } from '@/types/remoteHandover';
import { PreDispatchChecklistData } from '@/types/preDispatch';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const R2_REMOTE_TOKENS_KEY = 'ttb-metadata/remote-handover-tokens.json';
const LOCAL_REMOTE_TOKENS_PATH = path.join(process.cwd(), 'src', 'data', 'remote-handover-tokens.json');

const R2_PRE_DISPATCH_KEY = 'ttb-metadata/pre-dispatch-records.json';
const LOCAL_PRE_DISPATCH_PATH = path.join(process.cwd(), 'src', 'data', 'pre-dispatch-records.json');

const R2_SERAH_TERIMA_HISTORY_KEY = 'ttb-metadata/serah-terima-history.json';
const LOCAL_SERAH_TERIMA_PATH = path.join(process.cwd(), 'src', 'data', 'serah-terima-history.json');

const R2_TTB_HISTORY_KEY = 'ttb-metadata/history.json';
const LOCAL_TTB_HISTORY_PATH = path.join(process.cwd(), 'src', 'data', 'ttb-uploads-history.json');

const R2_VALIDATION_KEY = 'validation-metadata/records.json';
const LOCAL_VALIDATION_PATH = path.join(process.cwd(), 'src', 'data', 'document-validations.json');

const R2_PHOTO_MANIFEST_KEY = 'ttb-metadata/photos-manifest.json';
const LOCAL_PHOTO_MANIFEST_PATH = path.join(process.cwd(), 'src', 'data', 'ttb-photos-manifest.json');

// --- Helper Storage: Remote Handover Tokens ---

async function getRemoteTokens(): Promise<RemoteHandoverTokenData[]> {
  if (isR2Configured()) {
    try {
      const r2Obj = await getObjectFromR2(R2_REMOTE_TOKENS_KEY);
      if (r2Obj && r2Obj.body) {
        const parsed = JSON.parse(Buffer.from(r2Obj.body).toString('utf8'));
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {
      // Fallback
    }
  }

  try {
    const raw = await fs.readFile(LOCAL_REMOTE_TOKENS_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed;
  } catch {
    // Non-fatal
  }

  return [];
}

async function saveRemoteTokens(tokens: RemoteHandoverTokenData[]): Promise<void> {
  const jsonStr = JSON.stringify(tokens, null, 2);

  if (isR2Configured()) {
    try {
      await uploadToR2({
        key: R2_REMOTE_TOKENS_KEY,
        body: Buffer.from(jsonStr, 'utf8'),
        contentType: 'application/json',
      });
    } catch (err) {
      console.warn('Gagal menyimpan remote tokens ke Cloudflare R2:', err);
    }
  }

  try {
    await fs.mkdir(path.dirname(LOCAL_REMOTE_TOKENS_PATH), { recursive: true });
    await fs.writeFile(LOCAL_REMOTE_TOKENS_PATH, jsonStr, 'utf8');
  } catch (err) {
    console.error('Gagal menyimpan remote tokens ke file lokal:', err);
  }
}

// --- Helper Storage: Pre-Dispatch Records ---
async function getPreDispatchRecords(): Promise<PreDispatchChecklistData[]> {
  if (isR2Configured()) {
    try {
      const r2Obj = await getObjectFromR2(R2_PRE_DISPATCH_KEY);
      if (r2Obj?.body) {
        const parsed = JSON.parse(Buffer.from(r2Obj.body).toString('utf8'));
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {
      // Fallback
    }
  }
  try {
    const raw = await fs.readFile(LOCAL_PRE_DISPATCH_PATH, 'utf8');
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

async function savePreDispatchRecords(records: PreDispatchChecklistData[]): Promise<void> {
  const jsonStr = JSON.stringify(records, null, 2);
  if (isR2Configured()) {
    try {
      await uploadToR2({
        key: R2_PRE_DISPATCH_KEY,
        body: Buffer.from(jsonStr, 'utf8'),
        contentType: 'application/json',
      });
    } catch {}
  }
  try {
    await fs.mkdir(path.dirname(LOCAL_PRE_DISPATCH_PATH), { recursive: true });
    await fs.writeFile(LOCAL_PRE_DISPATCH_PATH, jsonStr, 'utf8');
  } catch {}
}

// --- Helper Storage: Document Validations ---
async function getStoredValidations(): Promise<DocumentValidationRecord[]> {
  if (isR2Configured()) {
    try {
      const r2Obj = await getObjectFromR2(R2_VALIDATION_KEY);
      if (r2Obj?.body) {
        const parsed = JSON.parse(Buffer.from(r2Obj.body).toString('utf8'));
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
  }
  try {
    const raw = await fs.readFile(LOCAL_VALIDATION_PATH, 'utf8');
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

async function saveStoredValidations(validations: DocumentValidationRecord[]): Promise<void> {
  const jsonStr = JSON.stringify(validations, null, 2);
  if (isR2Configured()) {
    try {
      await uploadToR2({
        key: R2_VALIDATION_KEY,
        body: Buffer.from(jsonStr, 'utf8'),
        contentType: 'application/json',
      });
    } catch {}
  }
  try {
    await fs.mkdir(path.dirname(LOCAL_VALIDATION_PATH), { recursive: true });
    await fs.writeFile(LOCAL_VALIDATION_PATH, jsonStr, 'utf8');
  } catch {}
}

// --- Helper Storage: Serah Terima History ---
async function getSerahTerimaHistory(): Promise<SerahTerimaItem[]> {
  if (isR2Configured()) {
    try {
      const r2Obj = await getObjectFromR2(R2_SERAH_TERIMA_HISTORY_KEY);
      if (r2Obj?.body) {
        const parsed = JSON.parse(Buffer.from(r2Obj.body).toString('utf8'));
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {}
  }
  try {
    const raw = await fs.readFile(LOCAL_SERAH_TERIMA_PATH, 'utf8');
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

async function saveSerahTerimaHistory(records: SerahTerimaItem[]): Promise<void> {
  const jsonStr = JSON.stringify(records, null, 2);
  if (isR2Configured()) {
    try {
      await uploadToR2({
        key: R2_SERAH_TERIMA_HISTORY_KEY,
        body: Buffer.from(jsonStr, 'utf8'),
        contentType: 'application/json',
      });
    } catch {}
  }
  try {
    await fs.mkdir(path.dirname(LOCAL_SERAH_TERIMA_PATH), { recursive: true });
    await fs.writeFile(LOCAL_SERAH_TERIMA_PATH, jsonStr, 'utf8');
  } catch {}
}

// --- Helper Storage: TTB Upload History ---
async function getTtbUploadHistory(): Promise<UploadedTtbItem[]> {
  if (isR2Configured()) {
    try {
      const r2HistObj = await getObjectFromR2(R2_TTB_HISTORY_KEY);
      if (r2HistObj?.body) {
        const parsed = JSON.parse(Buffer.from(r2HistObj.body).toString('utf8'));
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {}
  }
  try {
    const raw = await fs.readFile(LOCAL_TTB_HISTORY_PATH, 'utf8');
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

async function saveTtbUploadHistory(items: UploadedTtbItem[]): Promise<void> {
  const jsonStr = JSON.stringify(items, null, 2);
  if (isR2Configured()) {
    try {
      await uploadToR2({
        key: R2_TTB_HISTORY_KEY,
        body: Buffer.from(jsonStr, 'utf8'),
        contentType: 'application/json',
      });
    } catch {}
  }
  try {
    await fs.mkdir(path.dirname(LOCAL_TTB_HISTORY_PATH), { recursive: true });
    await fs.writeFile(LOCAL_TTB_HISTORY_PATH, jsonStr, 'utf8');
  } catch {}
}

// --- Helper Storage: Photo Manifest ---
async function updatePhotoManifest(newEntries: Record<string, string>): Promise<void> {
  let manifest: Record<string, string> = {};
  if (isR2Configured()) {
    try {
      const r2Obj = await getObjectFromR2(R2_PHOTO_MANIFEST_KEY);
      if (r2Obj?.body) {
        manifest = JSON.parse(Buffer.from(r2Obj.body).toString('utf8'));
      }
    } catch {}
  }
  if (Object.keys(manifest).length === 0) {
    try {
      const raw = await fs.readFile(LOCAL_PHOTO_MANIFEST_PATH, 'utf8');
      manifest = JSON.parse(raw);
    } catch {}
  }

  Object.assign(manifest, newEntries);
  const jsonStr = JSON.stringify(manifest, null, 2);

  if (isR2Configured()) {
    try {
      await uploadToR2({
        key: R2_PHOTO_MANIFEST_KEY,
        body: Buffer.from(jsonStr, 'utf8'),
        contentType: 'application/json',
      });
    } catch {}
  }
  try {
    await fs.mkdir(path.dirname(LOCAL_PHOTO_MANIFEST_PATH), { recursive: true });
    await fs.writeFile(LOCAL_PHOTO_MANIFEST_PATH, jsonStr, 'utf8');
  } catch {}
}

// -----------------------------------------------------------------------------
// GET: Cek validitas token atau ambil daftar remote tokens
// -----------------------------------------------------------------------------
export async function GET(req: NextRequest): Promise<NextResponse<RemoteHandoverResponse>> {
  try {
    const { searchParams } = new URL(req.url);
    const tokenParam = searchParams.get('token');
    const ttbParam = searchParams.get('noTtb') || searchParams.get('cleanNoTtb');

    const tokens = await getRemoteTokens();

    // 1. Query spesifik berdasarkan token (untuk halaman publik mobile)
    if (tokenParam) {
      const found = tokens.find((t) => t.token === tokenParam);
      if (!found) {
        return NextResponse.json(
          {
            success: false,
            status: 'not_found',
            message: 'Tautan konfirmasi tidak ditemukan atau tidak valid.',
          },
          { status: 404 }
        );
      }

      const now = Date.now();
      const expiresAtMs = new Date(found.expiresAt).getTime();

      if (found.isUsed) {
        return NextResponse.json({
          success: true,
          status: 'used',
          message: 'Tanda terima ini telah berhasil disahkan sebelumnya.',
          data: found,
        });
      }

      if (now > expiresAtMs) {
        return NextResponse.json({
          success: false,
          status: 'expired',
          message: 'Tautan konfirmasi telah kedaluwarsa (melebihi batas 7 hari). Hubungi tim logistik kantor.',
          data: found,
        });
      }

      return NextResponse.json({
        success: true,
        status: 'valid',
        message: 'Tautan valid untuk serah terima barang.',
        data: found,
      });
    }

    // 2. Query berdasarkan noTtb (untuk pengecekan status di tabel logistik)
    if (ttbParam) {
      const cleanTarget = sanitizeTtbNumber(ttbParam);
      const matched = tokens.find(
        (t) =>
          sanitizeTtbNumber(t.noTtb) === cleanTarget ||
          sanitizeTtbNumber(t.cleanNoTtb) === cleanTarget ||
          t.noTtb.includes(ttbParam)
      );

      return NextResponse.json({
        success: true,
        data: matched || undefined,
      });
    }

    // 3. Ambil semua token
    return NextResponse.json({
      success: true,
      tokens,
    });
  } catch (err) {
    return NextResponse.json(
      {
        success: false,
        error: (err as Error).message,
        message: 'Gagal memproses pengecekan token remote handover.',
      },
      { status: 500 }
    );
  }
}

// -----------------------------------------------------------------------------
// POST: Buat token link serah terima mandiri (Office / Logistics view)
// -----------------------------------------------------------------------------
export async function POST(req: NextRequest): Promise<NextResponse<RemoteHandoverResponse>> {
  try {
    const body = await req.json();
    const {
      ttbId,
      noTtb,
      cleanNoTtb,
      armada,
      noFpb = '',
      noPo = '',
      itemSummary = '',
      fileUrl = '',
      shippingMethod = 'Travel / Mobil Titipan',
      carrierContact,
      trackingNumber = '',
      recipientPhone,
      recipientNameTarget = '',
      dispatchedBy = 'Staf Logistik',
    } = body;

    if (!noTtb || !armada || !recipientPhone || !carrierContact) {
      return NextResponse.json(
        {
          success: false,
          error: 'Nomor TTB, Armada, Kontak Pembawa, dan No. WhatsApp Penerima wajib diisi.',
        },
        { status: 400 }
      );
    }

    // Generate token acak URL-safe (24 karakter hex)
    const token = crypto.randomBytes(12).toString('hex');
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString(); // 7 hari

    const cleanTtb = cleanNoTtb || sanitizeTtbNumber(noTtb);

    const newTokenRecord: RemoteHandoverTokenData = {
      id: crypto.randomUUID(),
      token,
      ttbId: ttbId || cleanTtb,
      noTtb,
      cleanNoTtb: cleanTtb,
      armada,
      noFpb,
      noPo,
      itemSummary,
      fileUrl,
      shippingMethod,
      carrierContact,
      trackingNumber,
      recipientPhone,
      recipientNameTarget,
      createdAt: now.toISOString(),
      expiresAt,
      isUsed: false,
      dispatchedBy,
      dispatchedAt: now.toISOString(),
    };

    // 1. Simpan ke daftar remote handover tokens
    const tokens = await getRemoteTokens();
    // Jika sudah ada token aktif yang belum digunakan untuk TTB yang sama, gantikan/perbarui
    const existingIdx = tokens.findIndex(
      (t) => !t.isUsed && sanitizeTtbNumber(t.noTtb) === cleanTtb
    );
    if (existingIdx !== -1) {
      tokens[existingIdx] = newTokenRecord;
    } else {
      tokens.unshift(newTokenRecord);
    }
    await saveRemoteTokens(tokens);

    // 2. Sinkronkan ke Pre-Dispatch Records agar status tabel berubah menjadi "Dalam Pengiriman (Pihak Ketiga / Remote)"
    try {
      const preRecords = await getPreDispatchRecords();
      const preIdx = preRecords.findIndex(
        (p) => sanitizeTtbNumber(p.noTtb || '') === cleanTtb || p.ttbId === cleanTtb
      );
      const preItem: PreDispatchChecklistData = {
        ttbId: cleanTtb,
        noTtb,
        armada,
        noFpb,
        noPo,
        itemSummary,
        itemsVerified: true,
        packagingGood: true,
        documentsReady: true,
        dispatchNotes: `Pengiriman Pihak Ketiga: ${shippingMethod} (${carrierContact})${
          trackingNumber ? ` | Resi: ${trackingNumber}` : ''
        }`,
        dispatchedAt: now.toISOString(),
        courierName: carrierContact,
      };

      if (preIdx !== -1) {
        preRecords[preIdx] = preItem;
      } else {
        preRecords.unshift(preItem);
      }
      await savePreDispatchRecords(preRecords);
    } catch (e) {
      console.warn('Gagal mencatat pre-dispatch remote:', e);
    }

    // Bangun URL Share publik
    const host = req.headers.get('host') || 'localhost:3000';
    const proto = req.headers.get('x-forwarded-proto') || (host.includes('localhost') ? 'http' : 'https');
    const shareUrl = `${proto}://${host}/terima-ttb/${token}`;

    return NextResponse.json({
      success: true,
      message: 'Tautan serah terima mandiri berhasil diterbitkan.',
      token,
      shareUrl,
      data: newTokenRecord,
    });
  } catch (err) {
    return NextResponse.json(
      {
        success: false,
        error: (err as Error).message,
        message: 'Gagal menerbitkan tautan serah terima.',
      },
      { status: 500 }
    );
  }
}

// -----------------------------------------------------------------------------
// PUT: Konfirmasi Serah Terima oleh Penerima di Kapal (Mobile Public Page)
// -----------------------------------------------------------------------------
export async function PUT(req: NextRequest): Promise<NextResponse<RemoteHandoverResponse>> {
  try {
    const contentType = req.headers.get('content-type') || '';
    let token = '';
    let receiverName = '';
    let receiverRole = '';
    let signatureDataUrl = '';
    let completionNotes = '';
    let geolocation: { latitude: number; longitude: number; accuracy?: number } | undefined;
    const photoBuffers: { buffer: Buffer; fileName: string; mimeType: string }[] = [];

    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData();
      token = (formData.get('token') as string) || '';
      receiverName = (formData.get('receiverName') as string) || '';
      receiverRole = (formData.get('receiverRole') as string) || '';
      signatureDataUrl = (formData.get('signatureDataUrl') as string) || '';
      completionNotes = (formData.get('completionNotes') as string) || '';

      const geoStr = formData.get('geolocation') as string;
      if (geoStr) {
        try {
          geolocation = JSON.parse(geoStr);
        } catch {}
      }

      // Ambil foto-foto yang diunggah
      const files = formData.getAll('photos') as File[];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (file && typeof file.arrayBuffer === 'function') {
          const buf = Buffer.from(await file.arrayBuffer());
          const ext = path.extname(file.name).toLowerCase() || '.jpg';
          const safeName = `ttb-remote-${Date.now()}-${i + 1}${ext}`;
          photoBuffers.push({
            buffer: buf,
            fileName: safeName,
            mimeType: file.type || 'image/jpeg',
          });
        }
      }
    } else {
      const json = await req.json();
      token = json.token || '';
      receiverName = json.receiverName || '';
      receiverRole = json.receiverRole || '';
      signatureDataUrl = json.signatureDataUrl || '';
      completionNotes = json.completionNotes || '';
      geolocation = json.geolocation;

      if (Array.isArray(json.photoDataUrls)) {
        json.photoDataUrls.forEach((dataUrl: string, idx: number) => {
          if (dataUrl && dataUrl.startsWith('data:image/')) {
            const matches = dataUrl.match(/^data:(image\/[a-zA-Z+]+);base64,(.+)$/);
            if (matches) {
              const mime = matches[1];
              const ext = mime.includes('png') ? '.png' : mime.includes('webp') ? '.webp' : '.jpg';
              photoBuffers.push({
                buffer: Buffer.from(matches[2], 'base64'),
                fileName: `ttb-remote-${Date.now()}-${idx + 1}${ext}`,
                mimeType: mime,
              });
            }
          }
        });
      }
    }

    if (!token) {
      return NextResponse.json(
        { success: false, error: 'Token serah terima wajib disertakan.' },
        { status: 400 }
      );
    }

    if (!receiverName.trim() || !signatureDataUrl) {
      return NextResponse.json(
        { success: false, error: 'Nama penerima dan tanda tangan digital wajib diisi.' },
        { status: 400 }
      );
    }

    // 1. Validasi Token
    const tokens = await getRemoteTokens();
    const tokenIndex = tokens.findIndex((t) => t.token === token);
    if (tokenIndex === -1) {
      return NextResponse.json(
        { success: false, error: 'Tautan serah terima tidak valid atau tidak ditemukan.' },
        { status: 404 }
      );
    }

    const tokenRecord = tokens[tokenIndex];
    if (tokenRecord.isUsed) {
      return NextResponse.json(
        {
          success: false,
          error: 'Tautan serah terima ini telah digunakan dan sudah disahkan sebelumnya.',
        },
        { status: 409 }
      );
    }

    const nowIso = new Date().toISOString();
    const nowMs = Date.now();
    if (nowMs > new Date(tokenRecord.expiresAt).getTime()) {
      return NextResponse.json(
        {
          success: false,
          error: 'Tautan serah terima telah kedaluwarsa. Hubungi staf logistik untuk menerbitkan tautan baru.',
        },
        { status: 410 }
      );
    }

    const isR2Active = isR2Configured();
    const localPhotosDir = getPhotosDir();
    const uploadedPhotoUrls: string[] = [];
    const newManifestEntries: Record<string, string> = {};

    // 2. Simpan Bukti Foto ke Cloudflare R2 dan/atau disk lokal
    for (const p of photoBuffers) {
      const r2Key = `ttb-photos/${p.fileName}`;
      if (isR2Active) {
        try {
          await uploadToR2({
            key: r2Key,
            body: p.buffer,
            contentType: p.mimeType,
          });
          const publicUrl = getR2FileUrl(r2Key);
          uploadedPhotoUrls.push(publicUrl);
          newManifestEntries[p.fileName] = publicUrl;
        } catch (r2Err) {
          console.warn('Gagal upload foto remote ke R2:', r2Err);
        }
      }

      try {
        await fs.mkdir(localPhotosDir, { recursive: true });
        const localPath = path.join(localPhotosDir, p.fileName);
        await fs.writeFile(localPath, p.buffer);
        if (!isR2Active) {
          const localUrl = `/api/ttb-photos/file?name=${encodeURIComponent(p.fileName)}`;
          uploadedPhotoUrls.push(localUrl);
          newManifestEntries[p.fileName] = localUrl;
        }
      } catch (localErr) {
        console.warn('Gagal menyimpan foto remote ke lokal:', localErr);
      }
    }

    if (Object.keys(newManifestEntries).length > 0) {
      await updatePhotoManifest(newManifestEntries);
    }

    // 3. Stamping TTB PDF dengan Tanda Tangan Penerima di Kolom "Received By (User)"
    const cleanSearch = sanitizeTtbNumber(tokenRecord.cleanNoTtb || tokenRecord.noTtb);
    const ttbHistory = await getTtbUploadHistory();
    const matchedTtbIndex = ttbHistory.findIndex(
      (t) => sanitizeTtbNumber(t.noTtb || '') === cleanSearch || t.cleanNoTtb === cleanSearch
    );
    const targetTtbItem = matchedTtbIndex !== -1 ? ttbHistory[matchedTtbIndex] : null;

    let stampedPdfUrl = tokenRecord.fileUrl || targetTtbItem?.fileUrl;

    if (targetTtbItem || tokenRecord.fileUrl) {
      try {
        let pdfBuffer: Buffer | null = null;
        let targetKey = targetTtbItem?.r2Key;
        const targetFileName = targetTtbItem?.renamedFileName || `${cleanSearch}.pdf`;

        if (isR2Active) {
          const keysToTry = [
            targetKey,
            `ttb-documents/${targetFileName}`,
            `ttb-documents/${cleanSearch}.pdf`,
          ].filter(Boolean) as string[];

          for (const k of keysToTry) {
            try {
              const r2Obj = await getObjectFromR2(k);
              if (r2Obj?.body && r2Obj.body.length > 0) {
                pdfBuffer = Buffer.from(r2Obj.body);
                targetKey = k;
                break;
              }
            } catch {}
          }
        }

        if (!pdfBuffer) {
          try {
            const localFile = path.join(localPhotosDir, targetFileName);
            pdfBuffer = await fs.readFile(localFile);
          } catch {}
        }

        if (pdfBuffer && pdfBuffer.length > 0) {
          const stampedPdfBuffer = await stampTtbRecipientPdf({
            pdfBuffer,
            recipientSignatureDataUrl: signatureDataUrl,
            recipientName: receiverName,
            receiptDate: formatTtbStampDate(nowIso.slice(0, 10)),
            recipientPhone: tokenRecord.recipientPhone,
          });

          const finalKey = targetKey || `ttb-documents/${targetFileName}`;
          const freshTimestamp = Date.now();
          stampedPdfUrl = `/api/r2-file?key=${encodeURIComponent(finalKey)}&v=${freshTimestamp}`;

          if (isR2Active) {
            await uploadToR2({
              key: finalKey,
              body: stampedPdfBuffer,
              contentType: 'application/pdf',
            });
          }

          try {
            await fs.mkdir(localPhotosDir, { recursive: true });
            await fs.writeFile(path.join(localPhotosDir, targetFileName), stampedPdfBuffer);
          } catch {}
        }
      } catch (stampErr) {
        console.warn('Stamping PDF pada remote handover gagal (non-fatal):', stampErr);
      }
    }

    // 4. Catat ke Serah Terima History
    const serahTerimaRecords = await getSerahTerimaHistory();
    const newSerahTerimaItem: SerahTerimaItem = {
      id: crypto.randomUUID(),
      noTtb: tokenRecord.noTtb,
      cleanNoTtb: tokenRecord.cleanNoTtb,
      armada: tokenRecord.armada,
      noFpb: tokenRecord.noFpb || '',
      noPo: tokenRecord.noPo || '',
      petugas: `${tokenRecord.shippingMethod} - ${tokenRecord.carrierContact}`,
      penerima: receiverName,
      kontakPenerima: tokenRecord.recipientPhone,
      tanggalSerahTerima: nowIso.slice(0, 10),
      kondisi: 'LENGKAP_BAIK',
      catatan: completionNotes || `Diserahkan via ${tokenRecord.shippingMethod} (${tokenRecord.carrierContact})`,
      photos: uploadedPhotoUrls.map((url, i) => ({
        name: photoBuffers[i]?.fileName || `foto-${i + 1}.jpg`,
        originalName: photoBuffers[i]?.fileName || `foto-${i + 1}.jpg`,
        url,
        size: photoBuffers[i]?.buffer.length || 0,
      })),
      penerimaSignature: signatureDataUrl,
      isTtbDocumentStamped: true,
      ttbDocumentUrl: stampedPdfUrl,
      storageProvider: isR2Active ? 'CLOUDFLARE_R2' : 'LOCAL',
      createdAt: nowIso,
    };

    serahTerimaRecords.unshift(newSerahTerimaItem);
    await saveSerahTerimaHistory(serahTerimaRecords);

    // 5. Perbarui Dokumen Validasi (document-validations.json) -> Selesaikan Tahap 4/4
    try {
      const validationRecords = await getStoredValidations();
      const valIndex = validationRecords.findIndex((v) => {
        if (v.docType !== 'TTB') return false;
        const vClean = sanitizeTtbNumber(v.cleanDocNumber || v.docNumber || '');
        return vClean === cleanSearch || v.docNumber.includes(tokenRecord.noTtb);
      });

      if (valIndex !== -1) {
        const targetVal = validationRecords[valIndex];
        targetVal.ttbSlots = targetVal.ttbSlots || {};
        targetVal.ttbSlots.receivedBy = {
          isValidated: true,
          validatorName: receiverName,
          validatorJabatan: receiverRole || 'Nakhoda / User Kapal',
          signatureDataUrl,
          validatedAt: nowIso,
          notes: `Disahkan secara mandiri di kapal oleh ${receiverName} (${receiverRole || 'Nakhoda'}) via Tautan Mandiri.`,
        };

        targetVal.recipientValidation = {
          isSigned: true,
          recipientName: receiverName,
          recipientPhone: tokenRecord.recipientPhone,
          signedAt: nowIso,
          signatureDataUrl,
        };

        if (stampedPdfUrl) targetVal.fileUrl = stampedPdfUrl;

        // Hitung ulang status metrik kelayakan
        computeValidationStatus(targetVal);
        targetVal.overallStatus = 'SUDAH_DITERIMA_ARMADA';

        await saveStoredValidations(validationRecords);
      }
    } catch (valErr) {
      console.warn('Gagal memperbarui status dokumen validasi:', valErr);
    }

    // 6. Perbarui riwayat upload TTB
    if (matchedTtbIndex !== -1 && ttbHistory[matchedTtbIndex]) {
      ttbHistory[matchedTtbIndex].isRecipientStamped = true;
      ttbHistory[matchedTtbIndex].recipientName = receiverName;
      ttbHistory[matchedTtbIndex].recipientPhone = tokenRecord.recipientPhone;
      ttbHistory[matchedTtbIndex].recipientSignatureDataUrl = signatureDataUrl;
      ttbHistory[matchedTtbIndex].recipientStampedAt = nowIso;
      if (stampedPdfUrl) ttbHistory[matchedTtbIndex].fileUrl = stampedPdfUrl;
      await saveTtbUploadHistory(ttbHistory);
    }

    // 7. Tandai Token sudah digunakan (isUsed: true)
    tokenRecord.isUsed = true;
    tokenRecord.usedAt = nowIso;
    tokenRecord.receiverName = receiverName;
    tokenRecord.receiverRole = receiverRole;
    tokenRecord.receiverSignatureDataUrl = signatureDataUrl;
    tokenRecord.receiverPhotos = uploadedPhotoUrls;
    tokenRecord.geolocation = geolocation;
    tokenRecord.completionNotes = completionNotes;

    tokens[tokenIndex] = tokenRecord;
    await saveRemoteTokens(tokens);

    return NextResponse.json({
      success: true,
      message: 'Serah terima digital berhasil disahkan oleh penerima kapal!',
      data: tokenRecord,
    });
  } catch (err) {
    return NextResponse.json(
      {
        success: false,
        error: (err as Error).message,
        message: 'Gagal memproses konfirmasi serah terima mandiri.',
      },
      { status: 500 }
    );
  }
}
