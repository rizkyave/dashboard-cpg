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
  // 1. DOKUMEN FSTB (Hulu: Purchasing & Logistik/Gudang - 2 Lini Departemen)
  // =========================================================================
  if (record.docType === 'FSTB' && record.fstbSlots) {
    const s = record.fstbSlots;
    let slotCount = 0;
    if (s.deliveredBy?.isValidated) slotCount++;
    if (s.receivedBy?.isValidated) slotCount++;
    if (s.approvedBy?.isValidated) slotCount++;
    if (s.acknowledgedBy?.isValidated) slotCount++;

    // Evaluasi 2 Lini Departemen:
    // Lini 1: Purchasing (Staff: deliveredBy, SPV: approvedBy)
    const isPchValid = Boolean(
      s.deliveredBy?.isValidated ||
      s.approvedBy?.isValidated ||
      record.purchasingValidation?.isValidated
    );

    // Lini 2: Logistik/Gudang (Staff: receivedBy, SPV: acknowledgedBy)
    const isLogValid = Boolean(
      s.receivedBy?.isValidated ||
      s.acknowledgedBy?.isValidated ||
      record.logistikValidation?.isValidated
    );

    let count = 0;
    if (isPchValid) count++;
    if (isLogValid) count++;

    // FSTB siap terbit TTB jika ke-4 PIC sah atau kedua departemen PCH & LOG telah menyetujui
    const isReady = slotCount === 4 || (isPchValid && isLogValid);
    let status: OverallValidationStatus = 'MENUNGGU_VALIDASI';

    if (isReady) {
      status = 'SIAP_KIRIM_ARMADA'; // Siap Terbit TTB (2/2 Selesai)
    } else if (slotCount > 0) {
      status = 'PROSES_VALIDASI';
    } else {
      status = 'MENUNGGU_VALIDASI';
    }

    return { completedCount: count, status, isReady };
  }

  // =========================================================================
  // 2. DOKUMEN TTB (Hilir: LOG Pengirim -> EXP/TRANS Pengiriman -> RCV Penerima)
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

    // 3 Tahapan Distribusi TTB:
    // 1. LOG: Pengirim Gudang TTB (deliveredBy / logistikValidation)
    const isLogValid = Boolean(s.deliveredBy?.isValidated || record.logistikValidation?.isValidated);
    // 2. EXP/TRANS: Otorisasi & Pengiriman (approvedBy / acknowledgedBy / purchasingValidation)
    const isTransValid = Boolean(s.approvedBy?.isValidated || s.acknowledgedBy?.isValidated || record.purchasingValidation?.isValidated);
    // 3. RCV/PENERIMA: Penerima Akhir (Armada Kapal atau Unit Darat seperti Finance)
    const isRcvValid = isReceivedByValid;

    let count = 0;
    if (isLogValid) count++;
    if (isTransValid) count++;
    if (isRcvValid) count++;

    const isReady = (isLogValid && isTransValid) || slotCount >= 3;
    let status: OverallValidationStatus = 'MENUNGGU_VALIDASI';

    if (isRcvValid) {
      status = 'SUDAH_DITERIMA_ARMADA'; // Diterima Penerima (Armada / Unit Darat)
    } else if (isReady) {
      status = 'SIAP_KIRIM_ARMADA'; // Siap Kirim / Diantar
    } else if (slotCount > 0) {
      status = 'PROSES_VALIDASI';
    } else {
      status = 'MENUNGGU_VALIDASI';
    }

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

