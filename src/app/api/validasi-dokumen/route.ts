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
} from '@/types/documentValidation';
import { UploadedFstbItem } from '@/types/fstbUpload';
import { UploadedTtbItem } from '@/types/ttbUpload';
import {
  isR2Configured,
  uploadToR2,
  getObjectFromR2,
} from '@/utils/r2Client';
import { stampFstbPdf, formatFstbStampDate, FstbStampRoleType } from '@/utils/fstbStamper';
import { getFstbPhotosDir } from '@/utils/fstbPhotosDir';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const VALIDATIONS_FILE_PATH = path.join(process.cwd(), 'src', 'data', 'document-validations.json');
const FSTB_HISTORY_FILE_PATH = path.join(process.cwd(), 'src', 'data', 'fstb-uploads-history.json');
const TTB_HISTORY_FILE_PATH = path.join(process.cwd(), 'src', 'data', 'ttb-uploads-history.json');

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

// Helper untuk menghitung status keseluruhan & jumlah lini yang telah sah
function computeValidationStatus(
  record: Pick<
    DocumentValidationRecord,
    'docType' | 'purchasingValidation' | 'logistikValidation' | 'lapanganValidation' | 'recipientValidation' | 'fstbSlots'
  >
): { completedCount: number; status: OverallValidationStatus; isReady: boolean } {
  if (record.docType === 'FSTB' && record.fstbSlots) {
    const s = record.fstbSlots;
    let slotCount = 0;
    if (s.deliveredBy?.isValidated) slotCount++;
    if (s.receivedBy?.isValidated) slotCount++;
    if (s.approvedBy?.isValidated) slotCount++;
    if (s.acknowledgedBy?.isValidated) slotCount++;

    const isReady = slotCount === 4;
    let status: OverallValidationStatus = 'MENUNGGU_VALIDASI';
    if (record.recipientValidation?.isSigned) {
      status = 'SUDAH_DITERIMA_ARMADA';
    } else if (isReady) {
      status = 'SIAP_KIRIM_ARMADA';
    } else if (slotCount > 0) {
      status = 'PROSES_VALIDASI';
    } else {
      status = 'MENUNGGU_VALIDASI';
    }

    // Pemetaan ke 3 Lini indikator dashboard (PCH, LOG, LAP):
    // PCH: deliveredBy (Purchasing Staff)
    // LOG: receivedBy (Logistic Staff)
    // LAP: approvedBy (Purchasing Spv) & acknowledgedBy (Logistic Spv)
    let count = 0;
    if (s.deliveredBy?.isValidated) count++;
    if (s.receivedBy?.isValidated) count++;
    if (s.approvedBy?.isValidated || s.acknowledgedBy?.isValidated) count++;

    return { completedCount: count, status, isReady };
  }

  let count = 0;
  if (record.purchasingValidation?.isValidated) count++;
  if (record.logistikValidation?.isValidated) count++;
  if (record.lapanganValidation?.isValidated) count++;

  const isReady = count === 3;
  let status: OverallValidationStatus = 'MENUNGGU_VALIDASI';

  if (record.recipientValidation?.isSigned) {
    status = 'SUDAH_DITERIMA_ARMADA';
  } else if (isReady) {
    status = 'SIAP_KIRIM_ARMADA';
  } else if (count > 0) {
    status = 'PROSES_VALIDASI';
  } else {
    status = 'MENUNGGU_VALIDASI';
  }

  return { completedCount: count, status, isReady };
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

    let hasNewDrafts = false;

    const existingMap = new Map<string, DocumentValidationRecord>();
    for (const rec of validationRecords) {
      if (rec.docType === 'FSTB' && !rec.fstbSlots) {
        rec.fstbSlots = {
          deliveredBy: rec.purchasingValidation || { isValidated: false },
          receivedBy: rec.logistikValidation || { isValidated: false },
          approvedBy: rec.lapanganValidation || { isValidated: false },
          acknowledgedBy: { isValidated: false },
        };
        hasNewDrafts = true;
      }
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

        const draft: DocumentValidationRecord = {
          id: `val-fstb-${fstb.id}`,
          docType: 'FSTB',
          docId: fstb.id,
          docNumber: fstb.noFstb,
          cleanDocNumber: fstb.cleanNoFstb || fstb.noFstb,
          armada: fstb.armada || '-',
          poNumber: fstb.doNo || '',
          fpbNumber: fstb.noFpb || '',
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
        const draft: DocumentValidationRecord = {
          id: `val-ttb-${ttb.id}`,
          docType: 'TTB',
          docId: ttb.id,
          docNumber: ttb.noTtb,
          cleanDocNumber: ttb.cleanNoTtb || ttb.noTtb,
          armada: ttb.armada || '-',
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
          lapanganValidation: {
            isValidated: false,
          },
          recipientValidation: ttb.isRecipientStamped
            ? {
                isSigned: true,
                recipientName: ttb.recipientName,
                recipientPhone: ttb.recipientPhone,
                signedAt: ttb.recipientStampedAt,
                signatureDataUrl: ttb.recipientSignatureDataUrl,
              }
            : undefined,
          overallStatus: 'MENUNGGU_VALIDASI',
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

    if (hasNewDrafts) {
      await saveValidations(validationRecords);
    }

    // Urutkan dari yang terbaru
    validationRecords.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

    // Hitung ringkasan metrik sebelum filter query
    const metrics: ValidationSummaryMetrics = {
      totalDocuments: validationRecords.length,
      totalFstb: validationRecords.filter((r) => r.docType === 'FSTB').length,
      totalTtb: validationRecords.filter((r) => r.docType === 'TTB').length,
      menungguValidasi: validationRecords.filter((r) => r.overallStatus === 'MENUNGGU_VALIDASI').length,
      prosesValidasi: validationRecords.filter((r) => r.overallStatus === 'PROSES_VALIDASI').length,
      siapKirimArmada: validationRecords.filter((r) => r.overallStatus === 'SIAP_KIRIM_ARMADA').length,
      sudahDiterimaArmada: validationRecords.filter((r) => r.overallStatus === 'SUDAH_DITERIMA_ARMADA').length,
    };

    // Terapkan filter jika ada parameter
    let filtered = [...validationRecords];

    if (filterType && filterType !== 'ALL') {
      filtered = filtered.filter((r) => r.docType === filterType);
    }

    if (filterStatus && filterStatus !== 'ALL') {
      filtered = filtered.filter((r) => r.overallStatus === filterStatus);
    }

    if (query) {
      filtered = filtered.filter((r) => {
        return (
          r.docNumber.toUpperCase().includes(query) ||
          r.cleanDocNumber.toUpperCase().includes(query) ||
          r.armada.toUpperCase().includes(query) ||
          (r.poNumber && r.poNumber.toUpperCase().includes(query)) ||
          (r.fpbNumber && r.fpbNumber.toUpperCase().includes(query)) ||
          r.renamedFileName.toUpperCase().includes(query) ||
          (r.purchasingValidation.validatorName && r.purchasingValidation.validatorName.toUpperCase().includes(query)) ||
          (r.logistikValidation.validatorName && r.logistikValidation.validatorName.toUpperCase().includes(query)) ||
          (r.lapanganValidation.validatorName && r.lapanganValidation.validatorName.toUpperCase().includes(query)) ||
          (r.recipientValidation?.recipientName && r.recipientValidation.recipientName.toUpperCase().includes(query))
        );
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

// POST: Rekam pembubuhan tanda tangan / validasi lini
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
      action = 'sign', // 'sign' | 'revoke'
    } = body;

    const isFstb = docType === 'FSTB' || Boolean(slotKey) || Boolean(slotKeys && slotKeys.length > 0);

    if (!isFstb && (!line || !['purchasing', 'logistik', 'lapangan'].includes(line))) {
      return NextResponse.json(
        { success: false, error: 'Lini validasi tidak valid (harus purchasing, logistik, atau lapangan).' },
        { status: 400 }
      );
    }

    let validationRecords = await getStoredValidations();

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

        // Sinkronkan ke 3 Lini agregat:
        if (record.fstbSlots.deliveredBy?.isValidated) {
          record.purchasingValidation = record.fstbSlots.deliveredBy;
        }
        if (record.fstbSlots.receivedBy?.isValidated) {
          record.logistikValidation = record.fstbSlots.receivedBy;
        }
        if (record.fstbSlots.approvedBy?.isValidated) {
          record.lapanganValidation = record.fstbSlots.approvedBy;
        } else if (record.fstbSlots.acknowledgedBy?.isValidated) {
          record.lapanganValidation = record.fstbSlots.acknowledgedBy;
        }
      } else {
        // Alur validasi standar TTB (3 Lini)
        const lineKey =
          line === 'purchasing'
            ? 'purchasingValidation'
            : line === 'logistik'
            ? 'logistikValidation'
            : 'lapanganValidation';

        const prefix = line === 'purchasing' ? 'PCH' : line === 'logistik' ? 'LOG' : 'LAP';
        const token = `VAL-${prefix}-${Date.now().toString(36).toUpperCase()}-${Math.random()
          .toString(36)
          .substring(2, 6)
          .toUpperCase()}`;

        record[lineKey] = {
          isValidated: true,
          validatorName,
          validatorUsername,
          validatorRole,
          validatorNik,
          validatorJabatan:
            validatorJabatan ||
            (line === 'purchasing'
              ? 'Staf Purchasing / Pengadaan'
              : line === 'logistik'
              ? 'Staf Logistik & Pergudangan'
              : 'Tim Lapangan / QC Distribusi'),
          signatureDataUrl,
          validatedAt: nowIso,
          notes: notes || 'Telah diverifikasi dan disetujui sesuai prosedur operasional standar.',
          verificationToken: token,
        };
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
