import {
  DocumentValidationRecord,
  OverallValidationStatus,
} from '@/types/documentValidation';

export interface PendingSlotInfo {
  key: string;
  code: string;
  label: string;
  roleName: string;
}

export interface UserActionInfo {
  canValidate: boolean;
  actionLabel: 'Validasi & TTD' | 'Lihat Berkas';
  tooltip: string;
  isCompleted: boolean;
  completedCount: number;
  nextPending: PendingSlotInfo | null;
}

/**
 * Helper untuk menghitung status keseluruhan & jumlah PIC yang telah sah
 * pada dokumen FSTB dan TTB dengan STRICT LOGIC:
 * - 4/4 PIC sah = Siap Terbit TTB / Sudah Diterima Armada (HIJAU)
 * - 1-3/4 PIC sah = Dalam Proses (KUNING / ORANYE)
 * - 0/4 PIC sah = Menunggu Validasi (AMBER / ABU-ABU)
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
  // 1. DOKUMEN FSTB (4 Kolom Pengesahan: PCH-STF, LOG-STF, PCH-SPV, LOG-SPV)
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

    const isReady = slotCount === 4;
    let status: OverallValidationStatus = 'MENUNGGU_VALIDASI';

    if (isReady) {
      status = 'SIAP_KIRIM_ARMADA'; // 4/4 Selesai (Siap Terbit TTB)
    } else if (slotCount > 0) {
      status = 'PROSES_VALIDASI'; // 1-3 PIC telah sah (Dalam Proses)
    } else {
      status = 'MENUNGGU_VALIDASI'; // 0/4 PIC sah
    }

    return { completedCount: slotCount, status, isReady };
  }

  // =========================================================================
  // 2. DOKUMEN TTB (4 Kolom Pengesahan Kronologis: RCV/LAP, LOG-STF, LOG-SPV, PCH-MGR)
  // =========================================================================
  if (record.docType === 'TTB') {
    const s = record.ttbSlots;
    const isRcvLap = Boolean(
      s?.receivedBy?.isValidated ||
      record.recipientValidation?.isSigned ||
      record.lapanganValidation?.isValidated
    );
    const isLogStaff = Boolean(s?.deliveredBy?.isValidated || record.logistikValidation?.isValidated);
    const isLogSpv = Boolean(s?.approvedBy?.isValidated);
    const isPchMgr = Boolean(s?.acknowledgedBy?.isValidated || record.purchasingValidation?.isValidated);

    let slotCount = 0;
    if (isRcvLap) slotCount++;
    if (isLogStaff) slotCount++;
    if (isLogSpv) slotCount++;
    if (isPchMgr) slotCount++;

    // STRICT LOGIC: HANYA jika ke-4 PIC seluruhnya sudah sah baru berstatus SUDAH_DITERIMA_ARMADA
    const isReady = slotCount === 4;
    let status: OverallValidationStatus = 'MENUNGGU_VALIDASI';

    if (slotCount === 4) {
      status = 'SUDAH_DITERIMA_ARMADA'; // 4/4 Selesai Lengkap (Diterima Penerima)
    } else if (slotCount > 0) {
      status = 'PROSES_VALIDASI'; // 1-3 PIC telah sah (Dalam Proses)
    } else {
      status = 'MENUNGGU_VALIDASI'; // 0/4 PIC sah
    }

    return { completedCount: slotCount, status, isReady };
  }

  // =========================================================================
  // 3. FALLBACK DEFAULT
  // =========================================================================
  const isLapValid = Boolean(record.lapanganValidation?.isValidated || record.recipientValidation?.isSigned);
  let count = 0;
  if (record.purchasingValidation?.isValidated) count++;
  if (record.logistikValidation?.isValidated) count++;
  if (isLapValid) count++;

  const isReady = count === 3;
  let status: OverallValidationStatus = 'MENUNGGU_VALIDASI';

  if (count === 3) {
    status = 'SUDAH_DITERIMA_ARMADA';
  } else if (count > 0) {
    status = 'PROSES_VALIDASI';
  } else {
    status = 'MENUNGGU_VALIDASI';
  }

  return { completedCount: count, status, isReady };
}

/**
 * Validasi Role Pengguna terhadap slot pending pada dokumen FSTB atau TTB
 */
export function getUserActionForRecord(
  record: DocumentValidationRecord,
  user: {
    role?: string;
    jabatan?: string;
    department?: string;
    username?: string;
  } | null,
  isAdmin: boolean
): UserActionInfo {
  const comp = computeValidationStatus(record);

  // Jika sudah 4/4 selesai
  if (comp.completedCount === 4) {
    return {
      canValidate: false,
      actionLabel: 'Lihat Berkas',
      tooltip: record.docType === 'FSTB'
        ? 'Pengesahan 4 PIC Lengkap (Siap Terbit TTB) - Klik untuk lihat berkas'
        : 'Pengesahan 4 PIC Lengkap (Diterima Penerima) - Klik untuk lihat berkas',
      isCompleted: true,
      completedCount: 4,
      nextPending: null,
    };
  }

  const role = (user?.role || '').toLowerCase();
  const jabatan = (user?.jabatan || '').toLowerCase();
  const dept = (user?.department || '').toLowerCase();

  // =========================================================================
  // DOKUMEN TTB: Urutan Kronologis (1. RCV/LAP -> 2. LOG STF -> 3. LOG SPV -> 4. PCH MGR)
  // =========================================================================
  if (record.docType === 'TTB') {
    const s = record.ttbSlots;
    const isRcvLap = Boolean(
      s?.receivedBy?.isValidated ||
      record.recipientValidation?.isSigned ||
      record.lapanganValidation?.isValidated
    );
    const isLogStaff = Boolean(s?.deliveredBy?.isValidated || record.logistikValidation?.isValidated);
    const isLogSpv = Boolean(s?.approvedBy?.isValidated);
    const isPchMgr = Boolean(s?.acknowledgedBy?.isValidated || record.purchasingValidation?.isValidated);

    const slotStates: Array<PendingSlotInfo & { isValid: boolean; hasAuthority: boolean }> = [
      {
        key: 'receivedBy',
        code: 'RCV / LAP',
        label: 'RCV / LAP',
        roleName: 'Penerima / Tim Lapangan',
        isValid: isRcvLap,
        hasAuthority:
          isAdmin ||
          role === 'staf_lapangan' ||
          role === 'user' ||
          jabatan.includes('lapangan') ||
          dept.includes('lapangan') ||
          jabatan.includes('armada') ||
          jabatan.includes('kapal'),
      },
      {
        key: 'deliveredBy',
        code: 'LOG STF',
        label: 'LOG STF',
        roleName: 'Staf Logistik',
        isValid: isLogStaff,
        hasAuthority:
          isAdmin ||
          role === 'staf_ttb' ||
          jabatan.includes('logistik') ||
          jabatan.includes('pergudangan') ||
          dept.includes('logistik'),
      },
      {
        key: 'approvedBy',
        code: 'LOG SPV',
        label: 'LOG SPV',
        roleName: 'Supervisi Logistik',
        isValid: isLogSpv,
        hasAuthority:
          isAdmin ||
          role === 'supervisor' ||
          role === 'manager' ||
          ((jabatan.includes('supervisor') ||
            jabatan.includes('spv') ||
            jabatan.includes('lead') ||
            jabatan.includes('head') ||
            jabatan.includes('manager')) &&
            (jabatan.includes('logistik') || dept.includes('logistik'))),
      },
      {
        key: 'acknowledgedBy',
        code: 'PCH MGR',
        label: 'PCH MGR',
        roleName: 'Purchasing Manager',
        isValid: isPchMgr,
        hasAuthority:
          isAdmin ||
          role === 'manager' ||
          ((jabatan.includes('manager') || jabatan.includes('head')) &&
            (jabatan.includes('purchasing') ||
              jabatan.includes('procurement') ||
              dept.includes('procurement') ||
              dept.includes('purchasing'))),
      },
    ];

    // Cari slot pertama yang masih pending sesuai urutan kronologis
    const firstPending = slotStates.find((slot) => !slot.isValid);

    if (!firstPending) {
      return {
        canValidate: false,
        actionLabel: 'Lihat Berkas',
        tooltip: 'Pengesahan 4 PIC Lengkap',
        isCompleted: true,
        completedCount: 4,
        nextPending: null,
      };
    }

    // Jika user saat ini memiliki wewenang pada slot pending tersebut (atau admin)
    if (firstPending.hasAuthority) {
      return {
        canValidate: true,
        actionLabel: 'Validasi & TTD',
        tooltip: `Otorisasi Anda Diperlukan: Validasi & TTD (${firstPending.label})`,
        isCompleted: false,
        completedCount: comp.completedCount,
        nextPending: firstPending,
      };
    }

    return {
      canValidate: false,
      actionLabel: 'Lihat Berkas',
      tooltip: `Menunggu validasi ${firstPending.code} (${firstPending.roleName})`,
      isCompleted: false,
      completedCount: comp.completedCount,
      nextPending: firstPending,
    };
  }

  // =========================================================================
  // DOKUMEN FSTB: (1. PCH STF -> 2. LOG STF -> 3. PCH SPV -> 4. LOG SPV)
  // =========================================================================
  const s = record.fstbSlots;
  const isPchStaff = Boolean(s?.deliveredBy?.isValidated || record.purchasingValidation?.isValidated);
  const isLogStaff = Boolean(s?.receivedBy?.isValidated || record.logistikValidation?.isValidated);
  const isPchSpv = Boolean(s?.approvedBy?.isValidated);
  const isLogSpv = Boolean(s?.acknowledgedBy?.isValidated);

  const fstbSlotStates: Array<PendingSlotInfo & { isValid: boolean; hasAuthority: boolean }> = [
    {
      key: 'deliveredBy',
      code: 'PCH STF',
      label: 'PCH STF',
      roleName: 'Staf Purchasing',
      isValid: isPchStaff,
      hasAuthority:
        isAdmin ||
        role === 'staf_purchasing' ||
        jabatan.includes('purchasing') ||
        dept.includes('purchasing'),
    },
    {
      key: 'receivedBy',
      code: 'LOG STF',
      label: 'LOG STF',
      roleName: 'Staf Logistik',
      isValid: isLogStaff,
      hasAuthority:
        isAdmin ||
        role === 'staf_ttb' ||
        jabatan.includes('logistik') ||
        dept.includes('logistik'),
    },
    {
      key: 'approvedBy',
      code: 'PCH SPV',
      label: 'PCH SPV',
      roleName: 'Supervisi Purchasing',
      isValid: isPchSpv,
      hasAuthority:
        isAdmin ||
        role === 'supervisor' ||
        role === 'manager' ||
        ((jabatan.includes('supervisor') || jabatan.includes('spv')) &&
          (jabatan.includes('purchasing') || dept.includes('purchasing'))),
    },
    {
      key: 'acknowledgedBy',
      code: 'LOG SPV',
      label: 'LOG SPV',
      roleName: 'Supervisi Logistik',
      isValid: isLogSpv,
      hasAuthority:
        isAdmin ||
        role === 'supervisor' ||
        role === 'manager' ||
        ((jabatan.includes('supervisor') || jabatan.includes('spv')) &&
          (jabatan.includes('logistik') || dept.includes('logistik'))),
    },
  ];

  const firstPendingFstb = fstbSlotStates.find((slot) => !slot.isValid);

  if (!firstPendingFstb) {
    return {
      canValidate: false,
      actionLabel: 'Lihat Berkas',
      tooltip: 'Pengesahan 4 PIC Lengkap',
      isCompleted: true,
      completedCount: 4,
      nextPending: null,
    };
  }

  if (firstPendingFstb.hasAuthority) {
    return {
      canValidate: true,
      actionLabel: 'Validasi & TTD',
      tooltip: `Otorisasi Anda Diperlukan: Validasi & TTD (${firstPendingFstb.label})`,
      isCompleted: false,
      completedCount: comp.completedCount,
      nextPending: firstPendingFstb,
    };
  }

  return {
    canValidate: false,
    actionLabel: 'Lihat Berkas',
    tooltip: `Menunggu validasi ${firstPendingFstb.code} (${firstPendingFstb.roleName})`,
    isCompleted: false,
    completedCount: comp.completedCount,
    nextPending: firstPendingFstb,
  };
}
