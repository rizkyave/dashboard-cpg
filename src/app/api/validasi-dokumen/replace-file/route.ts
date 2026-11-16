import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs/promises';
import {
  isR2Configured,
  uploadToR2,
  getObjectFromR2,
} from '@/utils/r2Client';
import { DocumentValidationRecord, TtbSlotKey, FstbSlotKey } from '@/types/documentValidation';
import { computeValidationStatus } from '@/utils/validationHelper';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const VALIDATIONS_FILE_PATH = path.join(process.cwd(), 'src', 'data', 'validation-records.json');
const R2_METADATA_VALIDATION_KEY = 'validation-metadata/records.json';

const TTB_HISTORY_FILE = path.join(process.cwd(), 'src', 'data', 'ttb-uploads-history.json');
const R2_TTB_HISTORY_KEY = 'ttb-metadata/history.json';

const FSTB_HISTORY_FILE = path.join(process.cwd(), 'src', 'data', 'fstb-uploads-history.json');
const R2_FSTB_HISTORY_KEY = 'fstb-metadata/history.json';

function getPhotosDir(docType: 'TTB' | 'FSTB'): string {
  const folder = docType === 'TTB' ? 'photos_TTB' : 'photos_FSTB';
  return path.join(process.cwd(), 'src', 'app', 'public', folder);
}

function sanitizeDocNumber(raw: string): string {
  return raw.replace(/[^A-Za-z0-9_-]/g, '').trim();
}

async function getStoredValidations(): Promise<DocumentValidationRecord[]> {
  if (isR2Configured()) {
    try {
      const r2Obj = await getObjectFromR2(R2_METADATA_VALIDATION_KEY);
      if (r2Obj?.body) {
        const text = Buffer.from(r2Obj.body).toString('utf8');
        const parsed = JSON.parse(text);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
  }
  try {
    const raw = await fs.readFile(VALIDATIONS_FILE_PATH, 'utf8');
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

async function saveValidations(records: DocumentValidationRecord[]) {
  const jsonStr = JSON.stringify(records, null, 2);
  if (isR2Configured()) {
    try {
      await uploadToR2({
        key: R2_METADATA_VALIDATION_KEY,
        body: Buffer.from(jsonStr, 'utf8'),
        contentType: 'application/json',
      });
    } catch (e) {
      console.warn('Gagal simpan validasi ke R2:', e);
    }
  }
  try {
    await fs.mkdir(path.dirname(VALIDATIONS_FILE_PATH), { recursive: true });
    await fs.writeFile(VALIDATIONS_FILE_PATH, jsonStr, 'utf8');
  } catch {}
}

async function clearPreDispatchForDoc(cleanDocNumber: string) {
  if (!cleanDocNumber) return;
  const PRE_DISPATCH_LOCAL = path.join(process.cwd(), 'src', 'data', 'pre-dispatch-records.json');
  const R2_PRE_KEY = 'ttb-metadata/pre-dispatch-records.json';
  if (isR2Configured()) {
    try {
      const obj = await getObjectFromR2(R2_PRE_KEY);
      if (obj?.body) {
        const parsed = JSON.parse(Buffer.from(obj.body).toString('utf8'));
        if (Array.isArray(parsed)) {
          const filtered = parsed.filter(
            (p: any) =>
              p.cleanNoTtb !== cleanDocNumber &&
              p.noTtb !== cleanDocNumber &&
              p.ttbId !== cleanDocNumber
          );
          if (filtered.length !== parsed.length) {
            await uploadToR2({
              key: R2_PRE_KEY,
              body: Buffer.from(JSON.stringify(filtered, null, 2), 'utf8'),
              contentType: 'application/json',
            });
          }
        }
      }
    } catch {}
  }
  try {
    const raw = await fs.readFile(PRE_DISPATCH_LOCAL, 'utf8');
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      const filtered = parsed.filter(
        (p: any) =>
          p.cleanNoTtb !== cleanDocNumber &&
          p.noTtb !== cleanDocNumber &&
          p.ttbId !== cleanDocNumber
      );
      if (filtered.length !== parsed.length) {
        await fs.writeFile(PRE_DISPATCH_LOCAL, JSON.stringify(filtered, null, 2), 'utf8');
      }
    }
  } catch {}
}

async function syncUploadHistory(
  docType: 'TTB' | 'FSTB',
  cleanDocNumber: string,
  fileName: string,
  fileSize: number,
  r2Key: string,
  nowIso: string,
  reason: string
) {
  const historyFile = docType === 'TTB' ? TTB_HISTORY_FILE : FSTB_HISTORY_FILE;
  const r2KeyHistory = docType === 'TTB' ? R2_TTB_HISTORY_KEY : R2_FSTB_HISTORY_KEY;

  let history: any[] = [];
  if (isR2Configured()) {
    try {
      const r2Obj = await getObjectFromR2(r2KeyHistory);
      if (r2Obj?.body) {
        const text = Buffer.from(r2Obj.body).toString('utf8');
        history = JSON.parse(text);
      }
    } catch {}
  }

  if (!Array.isArray(history) || history.length === 0) {
    try {
      const raw = await fs.readFile(historyFile, 'utf8');
      history = JSON.parse(raw);
    } catch {
      history = [];
    }
  }

  if (Array.isArray(history)) {
    const cleanLower = cleanDocNumber.toLowerCase();
    const item = history.find(
      (h) =>
        (h.cleanNoTtb && h.cleanNoTtb.toLowerCase() === cleanLower) ||
        (h.noTtb && h.noTtb.toLowerCase() === cleanLower) ||
        (h.cleanNoFstb && h.cleanNoFstb.toLowerCase() === cleanLower) ||
        (h.noFstb && h.noFstb.toLowerCase() === cleanLower) ||
        (h.renamedFileName && h.renamedFileName.toLowerCase() === fileName.toLowerCase())
    );

    if (item) {
      item.fileSize = fileSize;
      item.uploadedAt = nowIso;
      item.originalFileName = fileName;
      item.keterangan = `${item.keterangan || ''} (Direvisi: ${reason})`.trim();
      item.isAutoStamped = false;
      item.stampedAt = undefined;

      const updatedStr = JSON.stringify(history, null, 2);
      if (isR2Configured()) {
        try {
          await uploadToR2({
            key: r2KeyHistory,
            body: Buffer.from(updatedStr, 'utf8'),
            contentType: 'application/json',
          });
        } catch {}
      }
      try {
        await fs.mkdir(path.dirname(historyFile), { recursive: true });
        await fs.writeFile(historyFile, updatedStr, 'utf8');
      } catch {}
    }
  }
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const docNumber = (formData.get('docNumber') as string) || '';
    const cleanDocNumberRaw = (formData.get('cleanDocNumber') as string) || docNumber;
    const docType = ((formData.get('docType') as string) || 'TTB').toUpperCase() as 'TTB' | 'FSTB';
    const reason = ((formData.get('reason') as string) || '').trim();
    const resetMode = ((formData.get('resetMode') as string) || 'keep_staff') as 'keep_staff' | 'reset_all';
    const userName = (formData.get('userName') as string) || 'Administrator';
    const userRole = (formData.get('userRole') as string) || 'admin';

    if (!file) {
      return NextResponse.json({ success: false, error: 'Berkas PDF pengganti wajib diunggah.' }, { status: 400 });
    }

    if (!docNumber && !cleanDocNumberRaw) {
      return NextResponse.json({ success: false, error: 'Nomor dokumen wajib disertakan.' }, { status: 400 });
    }

    if (!reason) {
      return NextResponse.json({ success: false, error: 'Alasan revisi / penggantian berkas wajib diisi.' }, { status: 400 });
    }

    const cleanDocNumber = sanitizeDocNumber(cleanDocNumberRaw);
    const renamedFileName = `${cleanDocNumber}.pdf`;
    const buffer = Buffer.from(await file.arrayBuffer());
    const nowIso = new Date().toISOString();

    // 1. Upload file baru ke Cloudflare R2
    const r2Key = docType === 'TTB' ? `ttb-documents/${renamedFileName}` : `fstb-documents/${renamedFileName}`;
    let publicUrl = `/api/r2-file?key=${encodeURIComponent(r2Key)}&v=${Date.now()}`;
    let storageProvider: 'CLOUDFLARE_R2' | 'LOCAL' = 'LOCAL';

    if (isR2Configured()) {
      try {
        const r2Res = await uploadToR2({
          key: r2Key,
          body: buffer,
          contentType: 'application/pdf',
          metadata: {
            docNumber,
            cleanDocNumber,
            docType,
            revisedBy: userName,
            revisedAt: nowIso,
            reason,
          },
        });
        publicUrl = r2Res.url;
        storageProvider = 'CLOUDFLARE_R2';
      } catch (r2Err) {
        console.warn('Gagal unggah revisi ke R2, fallback lokal:', r2Err);
      }
    }

    // 2. Simpan juga salinan ke disk lokal
    try {
      const photosDir = getPhotosDir(docType);
      await fs.mkdir(photosDir, { recursive: true });
      await fs.writeFile(path.join(photosDir, renamedFileName), buffer);
    } catch {}

    // 3. Update Validation Record di database
    const validationRecords = await getStoredValidations();
    const cleanLower = cleanDocNumber.toLowerCase();
    const docLower = docNumber.toLowerCase();

    let record = validationRecords.find(
      (r) =>
        (r.cleanDocNumber && r.cleanDocNumber.toLowerCase() === cleanLower) ||
        (r.docNumber && r.docNumber.toLowerCase() === docLower) ||
        (r.cleanDocNumber && r.cleanDocNumber.toLowerCase() === docLower) ||
        (r.docNumber && r.docNumber.toLowerCase() === cleanLower)
    );

    if (!record) {
      return NextResponse.json(
        { success: false, error: `Dokumen ${cleanDocNumber} tidak ditemukan di sistem validasi.` },
        { status: 404 }
      );
    }

    record.fileUrl = publicUrl;
    record.r2Key = r2Key;
    record.storageProvider = storageProvider;
    record.originalFileName = file.name;
    record.renamedFileName = renamedFileName;
    record.fileExists = true;

    // Reset slot approval sesuai mode
    if (docType === 'TTB') {
      const staffSigned = resetMode === 'keep_staff';
      record.ttbSlots = {
        deliveredBy: {
          isValidated: staffSigned,
          notes: staffSigned ? 'Staf Logistik (Tanda tangan asal di berkas dipertahankan)' : undefined,
          validatedAt: staffSigned ? nowIso : undefined,
        },
        approvedBy: {
          isValidated: false,
          notes: `Dikosongkan untuk tanda tangan ulang (Revisi oleh ${userName}: ${reason})`,
        },
        acknowledgedBy: {
          isValidated: false,
          notes: `Dikosongkan untuk tanda tangan ulang (Revisi oleh ${userName}: ${reason})`,
        },
        receivedBy: {
          isValidated: false,
        },
      };
      record.purchasingValidation = { isValidated: false, notes: `Revisi: ${reason}` };
      record.logistikValidation = { isValidated: staffSigned, notes: staffSigned ? 'Staf Logistik valid' : `Revisi: ${reason}` };
      record.lapanganValidation = { isValidated: false, notes: `Revisi: ${reason}` };
      if (record.recipientValidation) {
        record.recipientValidation.isSigned = false;
      }
      await clearPreDispatchForDoc(cleanDocNumber);
    } else {
      // FSTB
      const staffSigned = resetMode === 'keep_staff';
      record.fstbSlots = {
        deliveredBy: {
          isValidated: staffSigned,
          notes: staffSigned ? 'Staf Purchasing (Tanda tangan asal di berkas dipertahankan)' : undefined,
          validatedAt: staffSigned ? nowIso : undefined,
        },
        receivedBy: {
          isValidated: false,
          notes: `Dikosongkan untuk tanda tangan ulang (Revisi oleh ${userName}: ${reason})`,
        },
        approvedBy: {
          isValidated: false,
          notes: `Dikosongkan untuk tanda tangan ulang (Revisi oleh ${userName}: ${reason})`,
        },
        acknowledgedBy: {
          isValidated: false,
          notes: `Dikosongkan untuk tanda tangan ulang (Revisi oleh ${userName}: ${reason})`,
        },
      };
      record.purchasingValidation = { isValidated: staffSigned, notes: staffSigned ? 'Staf Purchasing valid' : `Revisi: ${reason}` };
      record.logistikValidation = { isValidated: false, notes: `Revisi: ${reason}` };
      record.lapanganValidation = { isValidated: false, notes: `Revisi: ${reason}` };
    }

    // Rekam Riwayat Audit Revisi
    record.revisionHistory = record.revisionHistory || [];
    record.revisionHistory.push({
      revisedAt: nowIso,
      revisedBy: userName,
      role: userRole,
      reason,
      resetMode,
      originalFileName: file.name,
    });

    const comp = computeValidationStatus(record);
    record.completedLinesCount = comp.completedCount;
    record.overallStatus = comp.status;
    record.isReadyForDispatch = comp.isReady;
    record.updatedAt = nowIso;

    await saveValidations(validationRecords);

    // 4. Sinkronkan ke riwayat upload
    await syncUploadHistory(
      docType,
      cleanDocNumber,
      renamedFileName,
      buffer.length,
      r2Key,
      nowIso,
      reason
    );

    return NextResponse.json({
      success: true,
      message: `Berkas bersih pengganti berhasil diunggah! Seluruh tanda tangan yang salah posisi telah dibersihkan dan dokumen siap disahkan ulang secara urut dan sah.`,
      record,
    });
  } catch (err: unknown) {
    console.error('Error in POST /api/validasi-dokumen/replace-file:', err);
    const msg = err instanceof Error ? err.message : 'Terjadi kegagalan saat mengganti berkas validasi.';
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
