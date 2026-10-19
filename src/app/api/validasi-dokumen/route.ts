import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import {
  DocumentValidationRecord,
  ValidationLineType,
  ValidationSummaryMetrics,
  OverallValidationStatus,
  ValidationSignatureRecord,
  FstbSlotKey,
  TtbSlotKey,
} from '@/types/documentValidation';
import { UploadedFstbItem } from '@/types/fstbUpload';
import { UploadedTtbItem } from '@/types/ttbUpload';
import {
  isR2Configured,
  uploadToR2,
  getObjectFromR2,
  listR2Objects,
  deleteFromR2,
} from '@/utils/r2Client';
import { stampFstbPdf, formatFstbStampDate, FstbStampRoleType } from '@/utils/fstbStamper';
import { getFstbPhotosDir } from '@/utils/fstbPhotosDir';
import { stampTtbPdf, formatTtbStampDate, TtbStampRoleType } from '@/utils/ttbStamper';
import { getPhotosDir as getTtbPhotosDir } from '@/utils/ttbPhotosDir';
import { computeValidationStatus } from '@/utils/validationHelper';
import { resolveDocRelation } from '@/utils/docRelationResolver';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const VALIDATIONS_FILE_PATH = path.join(process.cwd(), 'src', 'data', 'document-validations.json');
const FSTB_HISTORY_FILE_PATH = path.join(process.cwd(), 'src', 'data', 'fstb-uploads-history.json');
const TTB_HISTORY_FILE_PATH = path.join(process.cwd(), 'src', 'data', 'ttb-uploads-history.json');
const SERAH_TERIMA_HISTORY_PATH = path.join(process.cwd(), 'src', 'data', 'serah-terima-history.json');

const R2_METADATA_VALIDATION_KEY = 'validation-metadata/records.json';

// Baca data validasi dari Cloudflare R2 (dengan fallback ke disk lokal)
async function getStoredValidations(): Promise<DocumentValidationRecord[]> {
  if (isR2Configured()) {
    try {
      const r2Obj = await getObjectFromR2(R2_METADATA_VALIDATION_KEY);
      if (r2Obj && r2Obj.body) {
        const text = Buffer.from(r2Obj.body).toString('utf8');
        const parsed = JSON.parse(text);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch (err) {
      console.warn('Gagal membaca data validasi dari Cloudflare R2:', err);
    }
  }

  try {
    const raw = await fs.readFile(VALIDATIONS_FILE_PATH, 'utf8');
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

// Simpan data validasi ke Cloudflare R2 dan disk lokal
async function saveValidations(records: DocumentValidationRecord[]) {
  const jsonStr = JSON.stringify(records, null, 2);

  if (isR2Configured()) {
    try {
      await uploadToR2({
        key: R2_METADATA_VALIDATION_KEY,
        body: Buffer.from(jsonStr, 'utf8'),
        contentType: 'application/json',
      });
    } catch (err) {
      console.warn('Gagal menyimpan validasi ke Cloudflare R2:', err);
    }
  }

  try {
    await fs.mkdir(path.dirname(VALIDATIONS_FILE_PATH), { recursive: true });
    await fs.writeFile(VALIDATIONS_FILE_PATH, jsonStr, 'utf8');
  } catch {
    // Non-fatal
  }
}

// Baca data berkas FSTB yang terunggah
async function getFstbHistory(): Promise<UploadedFstbItem[]> {
  try {
    const raw = await fs.readFile(FSTB_HISTORY_FILE_PATH, 'utf8');
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

// Baca data berkas TTB yang terunggah
async function getTtbHistory(): Promise<UploadedTtbItem[]> {
  try {
    const raw = await fs.readFile(TTB_HISTORY_FILE_PATH, 'utf8');
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

// Baca data riwayat serah terima lapangan
async function getSerahTerimaHistory(): Promise<any[]> {
  try {
    const raw = await fs.readFile(SERAH_TERIMA_HISTORY_PATH, 'utf8');
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

// Helper pencocokan nomor TTB fleksibel
function matchTtbDoc(search: string, cand: string): boolean {
  if (!search || !cand) return false;
  const s1 = search.toUpperCase().replace(/\s+/g, '');
  const s2 = cand.toUpperCase().replace(/\s+/g, '');
  if (s1 === s2 || s1.includes(s2) || s2.includes(s1)) return true;
  const d1 = s1.replace(/\D/g, '');
  const d2 = s2.replace(/\D/g, '');
  if (d1.length >= 4 && d2.length >= 4 && (d1 === d2 || d1.includes(d2) || d2.includes(d1))) return true;
  return false;
}

function computeSummaryMetrics(records: DocumentValidationRecord[]): ValidationSummaryMetrics {
  return {
    totalDocuments: records.length,
    totalFstb: records.filter((r) => r.docType === 'FSTB').length,
    totalTtb: records.filter((r) => r.docType === 'TTB').length,
    menungguValidasi: records.filter((r) => r.overallStatus === 'MENUNGGU_VALIDASI').length,
    prosesValidasi: records.filter((r) => r.overallStatus === 'PROSES_VALIDASI').length,
    siapKirimArmada: records.filter((r) => r.overallStatus === 'SIAP_KIRIM_ARMADA').length,
    sudahDiterimaArmada: records.filter((r) => r.overallStatus === 'SUDAH_DITERIMA_ARMADA').length,
  };
}

// GET: Ambil daftar seluruh dokumen dan status validasi multi-lini
export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const filterType = searchParams.get('type'); // 'FSTB' | 'TTB' | null
    const filterStatus = searchParams.get('status'); // OverallValidationStatus | null
    const query = (searchParams.get('q') || '').trim().toUpperCase();

    let validationRecords = await getStoredValidations();
    const fstbItems = await getFstbHistory();
    const ttbItems = await getTtbHistory();
    const serahTerimaItems = await getSerahTerimaHistory();

    let hasNewDrafts = false;

    // Pastikan tabel validasi HANYA memuat berkas yang riil telah di-upload di sistem
    const validFstbKeys = new Set(fstbItems.map((f) => (f.cleanNoFstb || f.noFstb).toUpperCase().trim()));
    const validFstbIds = new Set(fstbItems.map((f) => f.id));
    const validTtbKeys = new Set(ttbItems.map((t) => (t.cleanNoTtb || t.noTtb).toUpperCase().trim()));
    const validTtbIds = new Set(ttbItems.map((t) => t.id));

    const initialLen = validationRecords.length;
    validationRecords = validationRecords.filter((rec) => {
      const docCode = (rec.cleanDocNumber || rec.docNumber || '').toUpperCase().trim();
      if (rec.docType === 'FSTB') {
        return validFstbIds.has(rec.docId) || validFstbKeys.has(docCode);
      } else {
        return validTtbIds.has(rec.docId) || validTtbKeys.has(docCode);
      }
    });

    if (validationRecords.length !== initialLen) {
      hasNewDrafts = true;
    }

    const existingMap = new Map<string, DocumentValidationRecord>();
    for (const rec of validationRecords) {
      if ((rec.fileUrl || rec.r2Key) && rec.fileExists !== true) {
        rec.fileExists = true;
        hasNewDrafts = true;
      }
      if (rec.docType === 'FSTB') {
        if (!rec.fstbSlots) {
          rec.fstbSlots = {
            deliveredBy: rec.purchasingValidation || { isValidated: false },
            receivedBy: rec.logistikValidation || { isValidated: false },
            approvedBy: { isValidated: false },
            acknowledgedBy: { isValidated: false },
          };
          hasNewDrafts = true;
        }
        // FSTB adalah serah terima hulu Purchasing -> Logistik/Gudang (tidak ada tahapan Lapangan)
        rec.lapanganValidation = { isValidated: false, notes: 'N/A - FSTB hanya mencakup Purchasing & Logistik' };
        const comp = computeValidationStatus(rec);
        if (rec.completedLinesCount !== comp.completedCount || rec.overallStatus !== comp.status || rec.isReadyForDispatch !== comp.isReady) {
          rec.completedLinesCount = comp.completedCount;
          rec.overallStatus = comp.status;
          rec.isReadyForDispatch = comp.isReady;
          hasNewDrafts = true;
        }
      }

      if (rec.docType === 'TTB') {
        if (!rec.ttbSlots) {
          rec.ttbSlots = {
            deliveredBy: rec.logistikValidation || { isValidated: false },
            receivedBy: rec.lapanganValidation || { isValidated: false },
            approvedBy: { isValidated: false },
            acknowledgedBy: rec.purchasingValidation || { isValidated: false },
          };
          hasNewDrafts = true;
        }

        // Cek apakah ada riwayat serah terima lapangan atau data stamp TTB
        const matchedSt = serahTerimaItems.find((s) =>
          matchTtbDoc(s.noTtb, rec.cleanDocNumber || rec.docNumber)
        );
        const matchedTtb = ttbItems.find((t) =>
          matchTtbDoc(t.noTtb || t.cleanNoTtb || '', rec.cleanDocNumber || rec.docNumber)
        );

        const hasRecipientStamp = Boolean(
          matchedTtb?.isRecipientStamped ||
          matchedSt?.penerimaSignature ||
          rec.recipientValidation?.isSigned
        );

        if (hasRecipientStamp && (!rec.ttbSlots.receivedBy?.isValidated || !rec.recipientValidation?.isSigned)) {
          const recName =
            matchedTtb?.recipientName ||
            matchedSt?.penerima ||
            rec.recipientValidation?.recipientName ||
            'Crew Armada Kapal';
          const recPhone =
            matchedTtb?.recipientPhone ||
            matchedSt?.kontakPenerima ||
            rec.recipientValidation?.recipientPhone;
          const signedTime =
            matchedTtb?.recipientStampedAt ||
            matchedSt?.tanggalSerahTerima ||
            rec.recipientValidation?.signedAt ||
            rec.updatedAt ||
            new Date().toISOString();
          const sigUrl =
            matchedTtb?.recipientSignatureDataUrl ||
            matchedSt?.penerimaSignature ||
            rec.recipientValidation?.signatureDataUrl;

          rec.recipientValidation = {
            isSigned: true,
            recipientName: recName,
            recipientPhone: recPhone,
            signedAt: signedTime,
            signatureDataUrl: sigUrl,
          };

          const sigRecord: ValidationSignatureRecord = {
            isValidated: true,
            validatorName: recName,
            validatorRole: 'staf_lapangan',
            validatorJabatan: 'Penerima / Crew Armada Kapal',
            validatedAt: signedTime,
            signatureDataUrl: sigUrl,
            notes: 'Pekerjaan pengantaran telah selesai dilakukan oleh tim logistik lapangan dan barang fisik telah diterima langsung oleh kru armada.',
            verificationToken:
              rec.ttbSlots.receivedBy?.verificationToken ||
              `VAL-STR-${Date.now().toString(36).toUpperCase()}`,
          };

          rec.lapanganValidation = { ...sigRecord };
          rec.ttbSlots.receivedBy = { ...sigRecord };

          if (matchedTtb?.fileUrl && matchedTtb.fileUrl !== rec.fileUrl) {
            rec.fileUrl = matchedTtb.fileUrl;
          }

          const comp = computeValidationStatus(rec);
          rec.completedLinesCount = comp.completedCount;
          rec.overallStatus = comp.status;
          rec.isReadyForDispatch = comp.isReady;
          rec.updatedAt = new Date().toISOString();
          hasNewDrafts = true;
        }
      }

      // Sinkronisasi Kunci Relasi No. FPB, PO & Rantai Dokumen Terkait
      const rel = resolveDocRelation(
        rec.docType,
        rec.cleanDocNumber || rec.docNumber,
        rec.fpbNumber,
        rec.poNumber
      );

      if (!rec.fpbNumber && rel.fpbNumber) {
        rec.fpbNumber = rel.fpbNumber;
        hasNewDrafts = true;
      }
      if (!rec.poNumber && rel.poNumber) {
        rec.poNumber = rel.poNumber;
        hasNewDrafts = true;
      }
      if ((!rec.armada || rec.armada === '-') && rel.armada) {
        rec.armada = rel.armada;
        hasNewDrafts = true;
      }
      rec.relatedDocuments = {
        relatedFstbs: rel.relatedFstbs,
        relatedTtbs: rel.relatedTtbs,
        relatedPos: rel.relatedPos,
      };

      existingMap.set(`${rec.docType}_${rec.docId}`, rec);
      existingMap.set(`${rec.docType}_${rec.cleanDocNumber}`, rec);
    }

    // 1. Sinkronisasi dokumen FSTB ke daftar validasi
    for (const fstb of fstbItems) {
      const keyId = `FSTB_${fstb.id}`;
      const keyNum = `FSTB_${fstb.cleanNoFstb || fstb.noFstb}`;
      if (!existingMap.has(keyId) && !existingMap.has(keyNum)) {
        // Cek apakah uploader adalah staf purchasing
        const isPurchasingUploader = Boolean(fstb.uploaderName);
        const pchSig: ValidationSignatureRecord = {
          isValidated: isPurchasingUploader,
          validatorName: fstb.uploaderName || undefined,
          validatorUsername: fstb.uploaderUsername,
          validatorRole: fstb.uploaderRole || 'purchasing',
          validatorNik: fstb.uploaderNik,
          validatorJabatan: fstb.uploaderJabatan || 'Purchasing Staff',
          validatedAt: fstb.stampedAt || fstb.uploadedAt,
          notes: isPurchasingUploader ? 'Tervalidasi otomatis saat pengunggahan berkas oleh Staf Purchasing' : undefined,
          verificationToken: isPurchasingUploader
            ? `VAL-PCH-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`
            : undefined,
        };

        const rel = resolveDocRelation(
          'FSTB',
          fstb.cleanNoFstb || fstb.noFstb,
          fstb.noFpb,
          fstb.doNo
        );

        const draft: DocumentValidationRecord = {
          id: `val-fstb-${fstb.id}`,
          docType: 'FSTB',
          docId: fstb.id,
          docNumber: fstb.noFstb,
          cleanDocNumber: fstb.cleanNoFstb || fstb.noFstb,
          armada: fstb.armada && fstb.armada !== '-' ? fstb.armada : rel.armada || '-',
          poNumber: fstb.doNo || rel.poNumber || '',
          fpbNumber: fstb.noFpb || rel.fpbNumber || '',
          relatedDocuments: {
            relatedFstbs: rel.relatedFstbs,
            relatedTtbs: rel.relatedTtbs,
            relatedPos: rel.relatedPos,
          },
          receivedDate: fstb.fstbDate || fstb.receivedDate || '',
          originalFileName: fstb.originalFileName,
          renamedFileName: fstb.renamedFileName,
          fileUrl: fstb.fileUrl,
          r2Key: fstb.r2Key,
          storageProvider: fstb.storageProvider || 'CLOUDFLARE_R2',
          purchasingValidation: pchSig,
          logistikValidation: {
            isValidated: false,
          },
          lapanganValidation: {
            isValidated: false,
            notes: 'N/A - FSTB hanya mencakup Purchasing & Logistik',
          },
          fstbSlots: {
            deliveredBy: { ...pchSig },
            receivedBy: { isValidated: false },
            approvedBy: { isValidated: false },
            acknowledgedBy: { isValidated: false },
          },
          recipientValidation: fstb.isRecipientStamped
            ? {
                isSigned: true,
                recipientName: fstb.recipientName,
                recipientPhone: fstb.recipientPhone,
                signedAt: fstb.recipientStampedAt,
                signatureDataUrl: fstb.recipientSignatureDataUrl,
              }
            : undefined,
          overallStatus: 'MENUNGGU_VALIDASI',
          completedLinesCount: 0,
          isReadyForDispatch: false,
          createdAt: fstb.uploadedAt || new Date().toISOString(),
          updatedAt: fstb.uploadedAt || new Date().toISOString(),
        };

        const comp = computeValidationStatus(draft);
        draft.completedLinesCount = comp.completedCount;
        draft.overallStatus = comp.status;
        draft.isReadyForDispatch = comp.isReady;

        validationRecords.push(draft);
        existingMap.set(keyId, draft);
        existingMap.set(keyNum, draft);
        hasNewDrafts = true;
      }
    }

    // 2. Sinkronisasi dokumen TTB ke daftar validasi
    for (const ttb of ttbItems) {
      const keyId = `TTB_${ttb.id}`;
      const keyNum = `TTB_${ttb.cleanNoTtb || ttb.noTtb}`;
      if (!existingMap.has(keyId) && !existingMap.has(keyNum)) {
        const isLogistikUploader = Boolean(ttb.uploaderName);
        const matchedSt = serahTerimaItems.find((s) =>
          matchTtbDoc(s.noTtb, ttb.cleanNoTtb || ttb.noTtb)
        );
        const hasRecipientStamp = Boolean(ttb.isRecipientStamped || matchedSt?.penerimaSignature);
        const recName = ttb.recipientName || matchedSt?.penerima || 'Crew Armada Kapal';
        const recPhone = ttb.recipientPhone || matchedSt?.kontakPenerima;
        const signedTime =
          ttb.recipientStampedAt || matchedSt?.tanggalSerahTerima || ttb.uploadedAt || new Date().toISOString();
        const sigUrl = ttb.recipientSignatureDataUrl || matchedSt?.penerimaSignature;

        const recipientSig: ValidationSignatureRecord = hasRecipientStamp
          ? {
              isValidated: true,
              validatorName: recName,
              validatorRole: 'staf_lapangan',
              validatorJabatan: 'Penerima / Crew Armada Kapal',
              validatedAt: signedTime,
              signatureDataUrl: sigUrl,
              notes: 'Pekerjaan pengantaran telah selesai dilakukan oleh tim logistik lapangan dan barang fisik telah diterima langsung oleh kru armada.',
              verificationToken: `VAL-STR-${Date.now().toString(36).toUpperCase()}`,
            }
          : { isValidated: false };

        const rel = resolveDocRelation(
          'TTB',
          ttb.cleanNoTtb || ttb.noTtb,
          ttb.noFpb,
          undefined
        );

        const draft: DocumentValidationRecord = {
          id: `val-ttb-${ttb.id}`,
          docType: 'TTB',
          docId: ttb.id,
          docNumber: ttb.noTtb,
          cleanDocNumber: ttb.cleanNoTtb || ttb.noTtb,
          armada: ttb.armada && ttb.armada !== '-' ? ttb.armada : rel.armada || '-',
          poNumber: rel.poNumber || '',
          fpbNumber: ttb.noFpb || rel.fpbNumber || '',
          relatedDocuments: {
            relatedFstbs: rel.relatedFstbs,
            relatedTtbs: rel.relatedTtbs,
            relatedPos: rel.relatedPos,
          },
          receivedDate: ttb.receivedDate || '',
          originalFileName: ttb.originalFileName,
          renamedFileName: ttb.renamedFileName,
          fileUrl: ttb.fileUrl,
          r2Key: ttb.r2Key,
          storageProvider: ttb.storageProvider || 'CLOUDFLARE_R2',
          purchasingValidation: {
            isValidated: false,
          },
          logistikValidation: {
            isValidated: isLogistikUploader,
            validatorName: ttb.uploaderName || undefined,
            validatorUsername: ttb.uploaderUsername,
            validatorRole: ttb.uploaderRole || 'staf_ttb',
            validatorNik: ttb.uploaderNik,
            validatorJabatan: ttb.uploaderJabatan || 'Staf Logistik & Pergudangan',
            validatedAt: ttb.stampedAt || ttb.uploadedAt,
            notes: isLogistikUploader ? 'Tervalidasi otomatis saat pengunggahan berkas oleh Staf Logistik' : undefined,
            verificationToken: isLogistikUploader
              ? `VAL-LOG-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`
              : undefined,
          },
          lapanganValidation: { ...recipientSig },
          recipientValidation: hasRecipientStamp
            ? {
                isSigned: true,
                recipientName: recName,
                recipientPhone: recPhone,
                signedAt: signedTime,
                signatureDataUrl: sigUrl,
              }
            : undefined,
          ttbSlots: {
            deliveredBy: {
              isValidated: isLogistikUploader,
              validatorName: ttb.uploaderName || undefined,
              validatorUsername: ttb.uploaderUsername,
              validatorRole: ttb.uploaderRole || 'staf_ttb',
              validatorNik: ttb.uploaderNik,
              validatorJabatan: ttb.uploaderJabatan || 'Staf Logistik & Pergudangan',
              validatedAt: ttb.stampedAt || ttb.uploadedAt,
            },
            receivedBy: { ...recipientSig },
            approvedBy: { isValidated: false },
            acknowledgedBy: { isValidated: false },
          },
          overallStatus: hasRecipientStamp ? 'SUDAH_DITERIMA_ARMADA' : 'MENUNGGU_VALIDASI',
          completedLinesCount: 0,
          isReadyForDispatch: false,
          createdAt: ttb.uploadedAt || new Date().toISOString(),
          updatedAt: ttb.uploadedAt || new Date().toISOString(),
        };

        const comp = computeValidationStatus(draft);
        draft.completedLinesCount = comp.completedCount;
        draft.overallStatus = comp.status;
        draft.isReadyForDispatch = comp.isReady;

        validationRecords.push(draft);
        existingMap.set(keyId, draft);
        existingMap.set(keyNum, draft);
        hasNewDrafts = true;
      }
    }

    // Cross-link dokumen validasi aktif yang memiliki No. FPB yang sama
    const fpbToFstbMap = new Map<string, string[]>();
    const fpbToTtbMap = new Map<string, string[]>();

    for (const rec of validationRecords) {
      if (rec.fpbNumber) {
        const fKey = rec.fpbNumber.toUpperCase().trim();
        if (rec.docType === 'FSTB') {
          const list = fpbToFstbMap.get(fKey) || [];
          if (!list.includes(rec.docNumber)) list.push(rec.docNumber);
          fpbToFstbMap.set(fKey, list);
        } else {
          const list = fpbToTtbMap.get(fKey) || [];
          if (!list.includes(rec.docNumber)) list.push(rec.docNumber);
          fpbToTtbMap.set(fKey, list);
        }
      }
    }

    for (const rec of validationRecords) {
      if (rec.fpbNumber) {
        const fKey = rec.fpbNumber.toUpperCase().trim();
        const liveTtbs = fpbToTtbMap.get(fKey) || [];
        const liveFstbs = fpbToFstbMap.get(fKey) || [];

        rec.relatedDocuments = rec.relatedDocuments || {};
        rec.relatedDocuments.relatedTtbs = Array.from(
          new Set([...(rec.relatedDocuments.relatedTtbs || []), ...liveTtbs])
        );
        rec.relatedDocuments.relatedFstbs = Array.from(
          new Set([...(rec.relatedDocuments.relatedFstbs || []), ...liveFstbs])
        );
      }
    }

    if (hasNewDrafts) {
      await saveValidations(validationRecords);
    }

    // Urutkan dari yang terbaru
    validationRecords.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

    // Hitung ringkasan metrik sebelum filter query
    const metrics = computeSummaryMetrics(validationRecords);

    // Terapkan filter jika ada parameter
    let filtered = [...validationRecords];

    if (filterType && filterType !== 'ALL') {
      filtered = filtered.filter((r) => r.docType === filterType);
    }

    if (filterStatus && filterStatus !== 'ALL') {
      filtered = filtered.filter((r) => r.overallStatus === filterStatus);
    }

    if (query) {
      const qDigits = query.replace(/\D/g, '');

      filtered = filtered.filter((r) => {
        // 1. Direct match pada Nomor Dokumen, FPB, PO, Armada, File Name, Validator
        if (
          r.docNumber.toUpperCase().includes(query) ||
          r.cleanDocNumber.toUpperCase().includes(query) ||
          r.armada.toUpperCase().includes(query) ||
          (r.poNumber && r.poNumber.toUpperCase().includes(query)) ||
          (r.fpbNumber && r.fpbNumber.toUpperCase().includes(query)) ||
          r.renamedFileName.toUpperCase().includes(query) ||
          (r.purchasingValidation.validatorName &&
            r.purchasingValidation.validatorName.toUpperCase().includes(query)) ||
          (r.logistikValidation.validatorName &&
            r.logistikValidation.validatorName.toUpperCase().includes(query)) ||
          (r.lapanganValidation.validatorName &&
            r.lapanganValidation.validatorName.toUpperCase().includes(query)) ||
          (r.recipientValidation?.recipientName &&
            r.recipientValidation.recipientName.toUpperCase().includes(query))
        ) {
          return true;
        }

        // 2. Numeric / digits match (misal mencari "000586" atau "586")
        if (qDigits && qDigits.length >= 3) {
          const fpbDigits = (r.fpbNumber || '').replace(/\D/g, '');
          const poDigits = (r.poNumber || '').replace(/\D/g, '');
          const docDigits = r.cleanDocNumber.replace(/\D/g, '');
          if (fpbDigits.includes(qDigits) || poDigits.includes(qDigits) || docDigits.includes(qDigits)) {
            return true;
          }
        }

        // 3. Match melalui rantai dokumen berelasi (rantai No. FPB yang sama)
        if (r.relatedDocuments) {
          const inTtbs = r.relatedDocuments.relatedTtbs?.some((t) => t.toUpperCase().includes(query));
          const inFstbs = r.relatedDocuments.relatedFstbs?.some((f) => f.toUpperCase().includes(query));
          const inPos = r.relatedDocuments.relatedPos?.some((p) => p.toUpperCase().includes(query));
          if (inTtbs || inFstbs || inPos) return true;
        }

        return false;
      });
    }

    return NextResponse.json({
      success: true,
      metrics,
      total: filtered.length,
      records: filtered,
    });
  } catch (err: unknown) {
    console.error('Error in GET /api/validasi-dokumen:', err);
    const msg = err instanceof Error ? err.message : 'Terjadi kesalahan sistem saat memuat data validasi.';
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

// POST: Rekam pembubuhan tanda tangan / validasi lini / sinkronisasi R2 / hapus dokumen
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      validationId,
      docId,
      docNumber,
      docType,
      line,
      slotKey,
      slotKeys,
      validatorName,
      validatorUsername,
      validatorRole,
      validatorNik,
      validatorJabatan,
      signatureDataUrl,
      notes,
      action = 'sign', // 'sign' | 'revoke' | 'sync_r2' | 'delete'
    } = body;

    let validationRecords = await getStoredValidations();

    // =========================================================================
    // AKSI 1: SINKRONISASI LENGKAP DENGAN CLOUDFLARE R2 & PENYIMPANAN LOKAL
    // =========================================================================
    if (action === 'sync_r2') {
      const ttbDir = getTtbPhotosDir();
      const fstbDir = getFstbPhotosDir();
      const altFstbDir = path.join(process.cwd(), 'src', 'app', 'public', 'photos_FSTB');
      const altTtbDir = path.join(process.cwd(), 'src', 'app', 'public', 'photos_TTB');

      let localTtbFiles: string[] = [];
      try {
        localTtbFiles = await fs.readdir(ttbDir);
      } catch {
        try {
          localTtbFiles = await fs.readdir(altTtbDir);
        } catch {}
      }

      let localFstbFiles: string[] = [];
      try {
        localFstbFiles = await fs.readdir(fstbDir);
      } catch {
        try {
          localFstbFiles = await fs.readdir(altFstbDir);
        } catch {}
      }

      // Ambil daftar file dari Cloudflare R2 jika aktif
      let r2Files: Array<{ key: string; name: string; size: number }> = [];
      if (isR2Configured()) {
        try {
          const ttbDocs = await listR2Objects('ttb-documents/');
          const fstbDocs = await listR2Objects('fstb-documents/');
          const ttbPhotos = await listR2Objects('ttb-photos/');
          r2Files = [...ttbDocs, ...fstbDocs, ...ttbPhotos];
        } catch (r2ListErr) {
          console.warn('Gagal list objek dari R2:', r2ListErr);
        }
      }

      let reLinkedCount = 0;
      let uploadedToR2Count = 0;
      let newlyRegisteredCount = 0;

      // 1. Periksa dan hubungkan ulang rekaman validasi yang sudah ada
      for (const rec of validationRecords) {
        const docCode = (rec.cleanDocNumber || rec.docNumber).toUpperCase();
        let foundBuffer: Buffer | null = null;
        let matchedFileName = rec.renamedFileName || `${rec.cleanDocNumber}.pdf`;
        let targetR2Key =
          rec.r2Key || (rec.docType === 'FSTB' ? `fstb-documents/${matchedFileName}` : `ttb-documents/${matchedFileName}`);

        // A. Cek di daftar R2
        const r2Match = r2Files.find(
          (f) => f.key === rec.r2Key || f.key.toUpperCase().includes(docCode)
        );

        if (r2Match) {
          rec.r2Key = r2Match.key;
          rec.fileUrl = `/api/r2-file?key=${encodeURIComponent(r2Match.key)}`;
          rec.fileExists = true;
          reLinkedCount++;
          continue;
        }

        // B. Cek di file lokal (exact match & fuzzy match)
        const isFstb = rec.docType === 'FSTB';
        const searchList = isFstb ? localFstbFiles : localTtbFiles;
        const searchDir = isFstb ? fstbDir : ttbDir;
        const altDir = isFstb ? altFstbDir : altTtbDir;

        const matchedLocal = searchList.find(
          (f) => f.toUpperCase().includes(docCode) || f.toLowerCase() === matchedFileName.toLowerCase()
        );

        if (matchedLocal) {
          matchedFileName = matchedLocal;
          rec.renamedFileName = matchedLocal;
          targetR2Key = isFstb ? `fstb-documents/${matchedLocal}` : `ttb-documents/${matchedLocal}`;

          try {
            foundBuffer = await fs.readFile(path.join(searchDir, matchedLocal));
          } catch {
            try {
              foundBuffer = await fs.readFile(path.join(altDir, matchedLocal));
            } catch {}
          }
        }

        if (foundBuffer) {
          rec.r2Key = targetR2Key;
          rec.fileUrl = `/api/r2-file?key=${encodeURIComponent(targetR2Key)}`;
          rec.fileExists = true;
          reLinkedCount++;

          // Upload ke R2 jika belum ada
          if (isR2Configured()) {
            try {
              const ext = path.extname(matchedFileName).toLowerCase();
              const cType = ext === '.pdf' ? 'application/pdf' : ext === '.png' ? 'image/png' : 'image/jpeg';
              await uploadToR2({
                key: targetR2Key,
                body: foundBuffer,
                contentType: cType,
              });
              uploadedToR2Count++;
            } catch (uErr) {
              console.warn('Gagal upload file saat sync R2:', uErr);
            }
          }
        } else {
          // Hanya jika r2Key dan fileUrl tidak ada
          if (!rec.r2Key && !rec.fileUrl) {
            rec.fileExists = false;
          } else {
            rec.fileExists = true;
          }
        }
      }

      await saveValidations(validationRecords);
      const metrics = computeSummaryMetrics(validationRecords);

      return NextResponse.json({
        success: true,
        message: `Sinkronisasi R2 berhasil! ${reLinkedCount} berkas disinkronkan, ${uploadedToR2Count} berkas diunggah ke R2, dan ${newlyRegisteredCount} berkas baru berhasil didaftarkan.`,
        reLinkedCount,
        uploadedToR2Count,
        newlyRegisteredCount,
        totalRecords: validationRecords.length,
        metrics,
        records: validationRecords,
      });
    }

    // =========================================================================
    // AKSI 2: PENGHAPUSAN BERKAS VALIDASI OLEH ADMINISTRATOR
    // =========================================================================
    if (action === 'delete') {
      const targetId = validationId || docId;
      if (!targetId && !docNumber) {
        return NextResponse.json(
          { success: false, error: 'ID atau nomor berkas wajib disertakan untuk penghapusan.' },
          { status: 400 }
        );
      }

      const targetIndex = validationRecords.findIndex(
        (r) =>
          (targetId && (r.id === targetId || r.docId === targetId)) ||
          (docNumber && (r.docNumber === docNumber || r.cleanDocNumber === docNumber))
      );

      if (targetIndex === -1) {
        return NextResponse.json(
          { success: false, error: 'Dokumen tidak ditemukan dalam sistem validasi.' },
          { status: 404 }
        );
      }

      const deleted = validationRecords[targetIndex];
      validationRecords.splice(targetIndex, 1);

      if (deleted.r2Key && isR2Configured()) {
        try {
          await deleteFromR2(deleted.r2Key);
        } catch (delErr) {
          console.warn('Gagal menghapus berkas dari Cloudflare R2:', delErr);
        }
      }

      await saveValidations(validationRecords);
      const metrics = computeSummaryMetrics(validationRecords);

      return NextResponse.json({
        success: true,
        message: `Dokumen ${deleted.docNumber} (${deleted.docType}) berhasil dihapus.`,
        deletedRecord: deleted,
        metrics,
        records: validationRecords,
      });
    }

    const hasSlot = Boolean(slotKey) || Boolean(slotKeys && slotKeys.length > 0);
    if (!hasSlot && (!line || !['purchasing', 'logistik', 'lapangan'].includes(line))) {
      return NextResponse.json(
        { success: false, error: 'Lini validasi tidak valid (harus purchasing, logistik, atau lapangan).' },
        { status: 400 }
      );
    }

    // Cari dokumen target
    let record = validationRecords.find(
      (r) =>
        (validationId && r.id === validationId) ||
        (docId && r.docId === docId && (!docType || r.docType === docType)) ||
        (docNumber &&
          (r.docNumber === docNumber || r.cleanDocNumber === docNumber) &&
          (!docType || r.docType === docType))
    );

    if (!record) {
      return NextResponse.json(
        { success: false, error: 'Dokumen berkas tidak ditemukan dalam sistem validasi.' },
        { status: 404 }
      );
    }

    const nowIso = new Date().toISOString();

    if (action === 'revoke') {
      // Pembatalan validasi (Admin only / koreksi)
      if (record.docType === 'FSTB' && (slotKey || (slotKeys && slotKeys.length > 0))) {
        const revSlots: FstbSlotKey[] = slotKeys && Array.isArray(slotKeys) ? slotKeys : slotKey ? [slotKey] : [];
        record.fstbSlots = record.fstbSlots || {};
        for (const s of revSlots) {
          record.fstbSlots[s] = {
            isValidated: false,
            notes: notes ? `Validasi dibatalkan: ${notes}` : 'Validasi dibatalkan oleh pengguna.',
          };
          if (s === 'deliveredBy') record.purchasingValidation = { isValidated: false, notes };
          if (s === 'receivedBy') record.logistikValidation = { isValidated: false, notes };
          if (s === 'approvedBy' || s === 'acknowledgedBy') {
            if (!record.fstbSlots.approvedBy?.isValidated && !record.fstbSlots.acknowledgedBy?.isValidated) {
              record.lapanganValidation = { isValidated: false, notes };
            }
          }
        }
      } else if (record.docType === 'TTB' && (slotKey || (slotKeys && slotKeys.length > 0))) {
        const revSlots: TtbSlotKey[] = slotKeys && Array.isArray(slotKeys) ? slotKeys : slotKey ? [slotKey] : [];
        record.ttbSlots = record.ttbSlots || {};
        for (const s of revSlots) {
          record.ttbSlots[s] = {
            isValidated: false,
            notes: notes ? `Validasi dibatalkan: ${notes}` : 'Validasi dibatalkan oleh pengguna.',
          };
          if (s === 'deliveredBy') {
            if (!record.ttbSlots.approvedBy?.isValidated) {
              record.logistikValidation = { isValidated: false, notes };
            }
          }
          if (s === 'receivedBy') {
            record.lapanganValidation = { isValidated: false, notes };
            if (record.recipientValidation) record.recipientValidation.isSigned = false;
          }
          if (s === 'approvedBy') {
            if (!record.ttbSlots.deliveredBy?.isValidated) {
              record.logistikValidation = { isValidated: false, notes };
            }
          }
          if (s === 'acknowledgedBy') {
            record.purchasingValidation = { isValidated: false, notes };
          }
        }
      } else {
        const lineKey =
          line === 'purchasing'
            ? 'purchasingValidation'
            : line === 'logistik'
            ? 'logistikValidation'
            : 'lapanganValidation';
        record[lineKey] = {
          isValidated: false,
          notes: notes ? `Validasi dibatalkan: ${notes}` : 'Validasi dibatalkan oleh pengguna.',
        };
        if (record.docType === 'TTB' && record.ttbSlots) {
          if (line === 'purchasing') record.ttbSlots.acknowledgedBy = { isValidated: false };
          if (line === 'logistik') {
            record.ttbSlots.deliveredBy = { isValidated: false };
            record.ttbSlots.approvedBy = { isValidated: false };
          }
          if (line === 'lapangan') {
            record.ttbSlots.receivedBy = { isValidated: false };
            if (record.recipientValidation) record.recipientValidation.isSigned = false;
          }
        }
      }
    } else {
      // Pembubuhan tanda tangan & validasi resmi
      if (!validatorName) {
        return NextResponse.json(
          { success: false, error: 'Nama penanda tangan / validator wajib diisi.' },
          { status: 400 }
        );
      }

      if (record.docType === 'FSTB') {
        // Tentukan slot yang hendak divalidasi
        let targetSlots: FstbSlotKey[] = [];
        if (slotKeys && Array.isArray(slotKeys) && slotKeys.length > 0) {
          targetSlots = slotKeys;
        } else if (slotKey) {
          targetSlots = [slotKey];
        } else if (line === 'purchasing') {
          targetSlots = ['deliveredBy'];
        } else if (line === 'logistik') {
          targetSlots = ['receivedBy'];
        } else if (line === 'lapangan') {
          targetSlots = ['approvedBy'];
        } else {
          targetSlots = ['deliveredBy'];
        }

        // Ambil berkas PDF fisik untuk dibubuhi stempel digital resmi
        let pdfBuffer: Buffer | null = null;
        const filename = record.renamedFileName || `${record.cleanDocNumber}.pdf`;
        const r2Key = record.r2Key || `fstb-documents/${filename}`;

        if (isR2Configured()) {
          try {
            const r2Obj = await getObjectFromR2(r2Key);
            if (r2Obj && r2Obj.body) {
              pdfBuffer = Buffer.from(r2Obj.body);
            }
          } catch (r2Err) {
            console.warn('Gagal membaca PDF FSTB dari Cloudflare R2, mencoba lokal:', r2Err);
          }
        }

        if (!pdfBuffer) {
          const localDir = getFstbPhotosDir();
          const localPath = path.join(localDir, filename);
          try {
            pdfBuffer = await fs.readFile(localPath);
          } catch {
            const altPath = path.join(process.cwd(), 'src', 'app', 'public', 'photos_FSTB', filename);
            try {
              pdfBuffer = await fs.readFile(altPath);
            } catch {
              console.warn('Berkas fisik PDF FSTB tidak ditemukan di disk lokal.');
            }
          }
        }

        record.fstbSlots = record.fstbSlots || {
          deliveredBy: { isValidated: false },
          receivedBy: { isValidated: false },
          approvedBy: { isValidated: false },
          acknowledgedBy: { isValidated: false },
        };

        const stampDate = formatFstbStampDate(new Date());

        for (const slot of targetSlots) {
          let roleType: FstbStampRoleType = 'delivered_by';
          let defaultJabatan = 'Purchasing Staff';
          let prefix = 'PCH';

          if (slot === 'receivedBy') {
            roleType = 'received_by';
            defaultJabatan = 'Logistic Staff';
            prefix = 'LOG';
          } else if (slot === 'approvedBy') {
            roleType = 'approved_by';
            defaultJabatan = 'Purchasing Supervisor';
            prefix = 'PCH-SPV';
          } else if (slot === 'acknowledgedBy') {
            roleType = 'acknowledged_by';
            defaultJabatan = 'Logistic Supervisor';
            prefix = 'LOG-SPV';
          }

          const token = `VAL-FSTB-${prefix}-${Date.now().toString(36).toUpperCase()}-${Math.random()
            .toString(36)
            .substring(2, 6)
            .toUpperCase()}`;

          if (pdfBuffer) {
            try {
              pdfBuffer = await stampFstbPdf({
                pdfBuffer,
                signatureDataUrl: signatureDataUrl || undefined,
                uploaderName: validatorName,
                uploadDate: stampDate,
                roleType,
                verificationToken: token,
              });
            } catch (stampErr) {
              console.warn(`Gagal membubuhkan stempel pada slot FSTB ${slot}:`, stampErr);
            }
          }

          record.fstbSlots[slot] = {
            isValidated: true,
            validatorName,
            validatorUsername,
            validatorRole,
            validatorNik,
            validatorJabatan: validatorJabatan || defaultJabatan,
            signatureDataUrl,
            validatedAt: nowIso,
            notes: notes || `Disetujui dan disahkan sesuai wewenang ${defaultJabatan}.`,
            verificationToken: token,
          };
        }

        // Simpan berkas PDF yang telah dibubuhi stempel kembali ke storage
        if (pdfBuffer) {
          if (isR2Configured()) {
            try {
              await uploadToR2({
                key: r2Key,
                body: pdfBuffer,
                contentType: 'application/pdf',
              });
            } catch (r2SaveErr) {
              console.warn('Gagal menyimpan PDF terstempel ke R2:', r2SaveErr);
            }
          }

          try {
            const localDir = getFstbPhotosDir();
            await fs.mkdir(localDir, { recursive: true });
            await fs.writeFile(path.join(localDir, filename), pdfBuffer);
            const altDir = path.join(process.cwd(), 'src', 'app', 'public', 'photos_FSTB');
            await fs.mkdir(altDir, { recursive: true });
            await fs.writeFile(path.join(altDir, filename), pdfBuffer);
          } catch {
            // Non-fatal
          }

          record.fileUrl = `/api/r2-file?key=${encodeURIComponent(r2Key)}&v=${Date.now()}`;
        }

        // Sinkronkan ke 2 Lini Departemen (Purchasing & Logistik):
        const isPchStaff = Boolean(record.fstbSlots.deliveredBy?.isValidated);
        const isPchSpv = Boolean(record.fstbSlots.approvedBy?.isValidated);
        if (isPchSpv && record.fstbSlots.approvedBy) {
          record.purchasingValidation = record.fstbSlots.approvedBy;
        } else if (isPchStaff && record.fstbSlots.deliveredBy) {
          record.purchasingValidation = record.fstbSlots.deliveredBy;
        }

        const isLogStaff = Boolean(record.fstbSlots.receivedBy?.isValidated);
        const isLogSpv = Boolean(record.fstbSlots.acknowledgedBy?.isValidated);
        if (isLogSpv && record.fstbSlots.acknowledgedBy) {
          record.logistikValidation = record.fstbSlots.acknowledgedBy;
        } else if (isLogStaff && record.fstbSlots.receivedBy) {
          record.logistikValidation = record.fstbSlots.receivedBy;
        }

        // FSTB murni serah terima hulu Purchasing ke Logistik/Gudang (tidak ada tahapan Lapangan)
        record.lapanganValidation = { isValidated: false, notes: 'N/A - FSTB hanya mencakup serah terima Purchasing ke Logistik/Gudang.' };
      } else {
        // Alur validasi formulir TTB (4 Kolom Pengesahan: Delivered By, Received By, Approved By, Acknowledge By)
        let targetSlots: TtbSlotKey[] = [];
        if (slotKeys && Array.isArray(slotKeys) && slotKeys.length > 0) {
          targetSlots = slotKeys;
        } else if (slotKey) {
          targetSlots = [slotKey];
        } else if (line === 'purchasing') {
          targetSlots = ['acknowledgedBy'];
        } else if (line === 'logistik') {
          targetSlots = ['deliveredBy'];
        } else if (line === 'lapangan') {
          targetSlots = ['receivedBy'];
        } else {
          targetSlots = ['deliveredBy'];
        }

        // Ambil berkas fisik PDF TTB untuk dibubuhi stempel digital resmi
        let pdfBuffer: Buffer | null = null;
        const filename = record.renamedFileName || `${record.cleanDocNumber}.pdf`;
        const r2Key = record.r2Key || `ttb-documents/${filename}`;

        if (isR2Configured()) {
          try {
            const r2Obj = await getObjectFromR2(r2Key);
            if (r2Obj && r2Obj.body) {
              pdfBuffer = Buffer.from(r2Obj.body);
            }
          } catch (r2Err) {
            console.warn('Gagal membaca PDF TTB dari Cloudflare R2, mencoba lokal:', r2Err);
          }
        }

        if (!pdfBuffer) {
          const localDir = getTtbPhotosDir();
          const localPath = path.join(localDir, filename);
          try {
            pdfBuffer = await fs.readFile(localPath);
          } catch {
            const altPath = path.join(process.cwd(), 'src', 'app', 'public', 'photos_TTB', filename);
            try {
              pdfBuffer = await fs.readFile(altPath);
            } catch {
              console.warn('Berkas fisik PDF TTB tidak ditemukan di disk lokal.');
            }
          }
        }

        record.ttbSlots = record.ttbSlots || {
          deliveredBy: record.logistikValidation?.isValidated ? record.logistikValidation : { isValidated: false },
          receivedBy: record.lapanganValidation?.isValidated ? record.lapanganValidation : { isValidated: false },
          approvedBy: { isValidated: false },
          acknowledgedBy: record.purchasingValidation?.isValidated ? record.purchasingValidation : { isValidated: false },
        };

        const stampDate = formatTtbStampDate(new Date());

        for (const slot of targetSlots) {
          let roleType: TtbStampRoleType = 'delivered_by';
          let defaultJabatan = 'Logistic Staff';
          let prefix = 'LOG';

          if (slot === 'receivedBy') {
            roleType = 'received_by';
            defaultJabatan = 'User / Tim Lapangan';
            prefix = 'LAP';
          } else if (slot === 'approvedBy') {
            roleType = 'approved_by';
            defaultJabatan = 'Logistic Supervisor';
            prefix = 'LOG-SPV';
          } else if (slot === 'acknowledgedBy') {
            roleType = 'acknowledged_by';
            defaultJabatan = validatorRole === 'manager' ? 'Procurement Manager' : 'Manager Procurement';
            prefix = 'PCH-MGR';
          }

          const token = `VAL-TTB-${prefix}-${Date.now().toString(36).toUpperCase()}-${Math.random()
            .toString(36)
            .substring(2, 6)
            .toUpperCase()}`;

          if (pdfBuffer) {
            try {
              pdfBuffer = await stampTtbPdf({
                pdfBuffer,
                signatureDataUrl: signatureDataUrl || undefined,
                uploaderName: validatorName,
                uploadDate: stampDate,
                roleType,
                verificationToken: token,
              });
            } catch (stampErr) {
              console.warn(`Gagal membubuhkan stempel pada slot TTB ${slot}:`, stampErr);
            }
          }

          record.ttbSlots[slot] = {
            isValidated: true,
            validatorName,
            validatorUsername,
            validatorRole,
            validatorNik,
            validatorJabatan: validatorJabatan || defaultJabatan,
            signatureDataUrl,
            validatedAt: nowIso,
            notes: notes || `Disetujui dan disahkan sesuai wewenang ${defaultJabatan}.`,
            verificationToken: token,
          };
        }

        // Simpan berkas PDF yang telah dibubuhi stempel kembali ke storage
        if (pdfBuffer) {
          if (isR2Configured()) {
            try {
              await uploadToR2({
                key: r2Key,
                body: pdfBuffer,
                contentType: 'application/pdf',
              });
            } catch (r2SaveErr) {
              console.warn('Gagal menyimpan PDF TTB terstempel ke R2:', r2SaveErr);
            }
          }

          try {
            const localDir = getTtbPhotosDir();
            await fs.mkdir(localDir, { recursive: true });
            await fs.writeFile(path.join(localDir, filename), pdfBuffer);
            const altDir = path.join(process.cwd(), 'src', 'app', 'public', 'photos_TTB');
            await fs.mkdir(altDir, { recursive: true });
            await fs.writeFile(path.join(altDir, filename), pdfBuffer);
          } catch {
            // Non-fatal
          }

          record.fileUrl = `/api/r2-file?key=${encodeURIComponent(r2Key)}&v=${Date.now()}`;
        }

        // Sinkronkan ke 3 Lini agregat:
        if (record.ttbSlots.acknowledgedBy?.isValidated) {
          record.purchasingValidation = record.ttbSlots.acknowledgedBy;
        }
        if (record.ttbSlots.deliveredBy?.isValidated) {
          record.logistikValidation = record.ttbSlots.deliveredBy;
        } else if (record.ttbSlots.approvedBy?.isValidated) {
          record.logistikValidation = record.ttbSlots.approvedBy;
        }
        if (record.ttbSlots.receivedBy?.isValidated) {
          record.lapanganValidation = record.ttbSlots.receivedBy;
          record.recipientValidation = {
            isSigned: true,
            recipientName: validatorName,
            signedAt: nowIso,
            signatureDataUrl,
          };
        }
      }
    }

    // Rekalkulasi status
    const comp = computeValidationStatus(record);
    record.completedLinesCount = comp.completedCount;
    record.overallStatus = comp.status;
    record.isReadyForDispatch = comp.isReady;
    record.updatedAt = nowIso;

    // Simpan ke storage
    await saveValidations(validationRecords);

    return NextResponse.json({
      success: true,
      message:
        action === 'revoke'
          ? `Validasi berkas berhasil dibatalkan.`
          : `Validasi dan pembubuhan cap digital resmi berhasil disahkan.`,
      record,
    });
  } catch (err: unknown) {
    console.error('Error in POST /api/validasi-dokumen:', err);
    const msg = err instanceof Error ? err.message : 'Terjadi kesalahan sistem saat menyimpan validasi.';
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const targetId = searchParams.get('id') || searchParams.get('validationId') || searchParams.get('docId');
    const docNumber = searchParams.get('docNumber');

    if (!targetId && !docNumber) {
      return NextResponse.json(
        { success: false, error: 'ID atau nomor berkas wajib disertakan untuk penghapusan.' },
        { status: 400 }
      );
    }

    const validationRecords: DocumentValidationRecord[] = await getStoredValidations();
    const targetIndex = validationRecords.findIndex(
      (r: DocumentValidationRecord) =>
        (targetId && (r.id === targetId || r.docId === targetId)) ||
        (docNumber && (r.docNumber === docNumber || r.cleanDocNumber === docNumber))
    );

    if (targetIndex === -1) {
      return NextResponse.json(
        { success: false, error: 'Dokumen tidak ditemukan dalam sistem validasi.' },
        { status: 404 }
      );
    }

    const deleted = validationRecords[targetIndex];
    validationRecords.splice(targetIndex, 1);

    if (deleted.r2Key && isR2Configured()) {
      try {
        await deleteFromR2(deleted.r2Key);
      } catch (delErr) {
        console.warn('Gagal menghapus berkas dari Cloudflare R2:', delErr);
      }
    }

    await saveValidations(validationRecords);
    const metrics = computeSummaryMetrics(validationRecords);

    return NextResponse.json({
      success: true,
      message: `Dokumen ${deleted.docNumber} (${deleted.docType}) berhasil dihapus.`,
      deletedRecord: deleted,
      metrics,
      records: validationRecords,
    });
  } catch (err: unknown) {
    console.error('Error in DELETE /api/validasi-dokumen:', err);
    const msg = err instanceof Error ? err.message : 'Terjadi kesalahan sistem saat menghapus data.';
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
