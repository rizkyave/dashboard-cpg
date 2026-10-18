import {
  DocumentValidationRecord,
  OverallValidationStatus,
  ValidationSignatureRecord,
} from '@/types/documentValidation';

/**
 * Helper untuk menghitung status keseluruhan & jumlah lini yang telah sah
 * pada dokumen FSTB dan TTB
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
  // 1. DOKUMEN FSTB (4 Slot: Delivered, Received, Approved, Acknowledged)
  // =========================================================================
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

  // =========================================================================
  // 2. DOKUMEN TTB (4 Slot: Delivered, Received, Approved, Acknowledged)
  // =========================================================================
  if (record.docType === 'TTB' && record.ttbSlots) {
    const s = record.ttbSlots;
    const isReceivedByValid = Boolean(
      s.receivedBy?.isValidated ||
      record.recipientValidation?.isSigned ||
      record.lapanganValidation?.isValidated
    );

    let slotCount = 0;
    if (s.deliveredBy?.isValidated) slotCount++;
    if (isReceivedByValid) slotCount++;
    if (s.approvedBy?.isValidated) slotCount++;
    if (s.acknowledgedBy?.isValidated) slotCount++;

    const isReady = slotCount >= 3;
    let status: OverallValidationStatus = 'MENUNGGU_VALIDASI';

    // Jika penerima di armada/lapangan sudah tanda tangan, status otomatis menjadi SUDAH_DITERIMA_ARMADA
    if (isReceivedByValid) {
      status = 'SUDAH_DITERIMA_ARMADA';
    } else if (isReady) {
      status = 'SIAP_KIRIM_ARMADA';
    } else if (slotCount > 0) {
      status = 'PROSES_VALIDASI';
    } else {
      status = 'MENUNGGU_VALIDASI';
    }

    // Pemetaan ke 3 Lini indikator dashboard (PCH, LOG, LAP):
    // PCH: acknowledgedBy (Procurement Manager)
    // LOG: deliveredBy (Logistic Staff) & approvedBy (Logistic Spv)
    // LAP: receivedBy (User / Lapangan)
    let count = 0;
    if (s.acknowledgedBy?.isValidated || record.purchasingValidation?.isValidated) count++;
    if (s.deliveredBy?.isValidated || s.approvedBy?.isValidated || record.logistikValidation?.isValidated) count++;
    if (isReceivedByValid) count++;

    return { completedCount: count, status, isReady };
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
