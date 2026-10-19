import {
  DocumentValidationRecord,
  OverallValidationStatus,
  ValidationSignatureRecord,
} from '@/types/documentValidation';

/**
 * Helper untuk menghitung status keseluruhan & jumlah PIC yang telah sah
 * pada dokumen FSTB dan TTB sesuai dengan 4 Kolom Pengesahan PIC
 */
export function computeValidationStatus(
  record: Pick<
    DocumentValidationRecord,
    | 'docType'
    | 'purchasingValidation'
    | 'logistikValidation'
    | 'lapanganValidation'
    | 'recipientValidation'
    | 'fstbSlots'
    | 'ttbSlots'
  >
): { completedCount: number; status: OverallValidationStatus; isReady: boolean } {
  // =========================================================================
  // 1. DOKUMEN FSTB (4 Kolom Pengesahan PIC: PCH-STF, LOG-STF, PCH-SPV, LOG-SPV)
  // =========================================================================
  if (record.docType === 'FSTB') {
    const s = record.fstbSlots;
    const isPchStaff = Boolean(s?.deliveredBy?.isValidated || record.purchasingValidation?.isValidated);
    const isLogStaff = Boolean(s?.receivedBy?.isValidated || record.logistikValidation?.isValidated);
    const isPchSpv = Boolean(s?.approvedBy?.isValidated);
    const isLogSpv = Boolean(s?.acknowledgedBy?.isValidated);

    let slotCount = 0;
    if (isPchStaff) slotCount++;
    if (isLogStaff) slotCount++;
    if (isPchSpv) slotCount++;
    if (isLogSpv) slotCount++;

    // FSTB siap terbit TTB jika ke-4 PIC sah
    const isReady = slotCount === 4;
    let status: OverallValidationStatus = 'MENUNGGU_VALIDASI';

    if (isReady) {
      status = 'SIAP_KIRIM_ARMADA'; // Siap Terbit TTB (4/4 Lengkap)
    } else if (slotCount > 0) {
      status = 'PROSES_VALIDASI';
    } else {
      status = 'MENUNGGU_VALIDASI';
    }

    return { completedCount: slotCount, status, isReady };
  }

  // =========================================================================
  // 2. DOKUMEN TTB (4 Kolom Pengesahan PIC: LOG-STF, RCV-LAP, LOG-SPV, PCH-MGR)
  // =========================================================================
  if (record.docType === 'TTB') {
    const s = record.ttbSlots;
    const isLogStaff = Boolean(s?.deliveredBy?.isValidated || record.logistikValidation?.isValidated);
    const isRcvLap = Boolean(
      s?.receivedBy?.isValidated ||
      record.recipientValidation?.isSigned ||
      record.lapanganValidation?.isValidated
    );
    const isLogSpv = Boolean(s?.approvedBy?.isValidated);
    const isPchMgr = Boolean(s?.acknowledgedBy?.isValidated || record.purchasingValidation?.isValidated);

    let slotCount = 0;
    if (isLogStaff) slotCount++;
    if (isRcvLap) slotCount++;
    if (isLogSpv) slotCount++;
    if (isPchMgr) slotCount++;

    // Ready for dispatch jika pengirim gudang, SPV, dan Mgr sudah acc (3 PIC internal)
    const isReady = (isLogStaff && isLogSpv && isPchMgr) || slotCount >= 3;
    let status: OverallValidationStatus = 'MENUNGGU_VALIDASI';

    if (slotCount === 4 || (isRcvLap && isReady)) {
      status = 'SUDAH_DITERIMA_ARMADA'; // Diterima Penerima (4/4 Selesai)
    } else if (isRcvLap) {
      status = 'SUDAH_DITERIMA_ARMADA';
    } else if (isReady) {
      status = 'SIAP_KIRIM_ARMADA'; // Siap Kirim / Diantar (3/4)
    } else if (slotCount > 0) {
      status = 'PROSES_VALIDASI';
    } else {
      status = 'MENUNGGU_VALIDASI';
    }

    return { completedCount: slotCount, status, isReady };
  }

  // =========================================================================
  // 3. FALLBACK: 3 LINI STANDAR (Purchasing, Logistik, Lapangan)
  // =========================================================================
  const isLapValid = Boolean(record.lapanganValidation?.isValidated || record.recipientValidation?.isSigned);
  let count = 0;
  if (record.purchasingValidation?.isValidated) count++;
  if (record.logistikValidation?.isValidated) count++;
  if (isLapValid) count++;

  const isReady = count === 3;
  let status: OverallValidationStatus = 'MENUNGGU_VALIDASI';

  if (record.recipientValidation?.isSigned || isLapValid) {
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

