import { StatusTone } from '@/types/procurement';
import { formatDateDdMmYyDash } from '@/utils/formatDate';

export interface WorkflowStatusItem {
  value: string;
  label: string;
  moduleCode: 'PROCUREMENT' | 'LOGISTIK' | 'LAPANGAN' | 'FINANCE' | 'OTHER';
  moduleTitle: string;
  stepNumber: number;
  description?: string;
}

export interface WorkflowModuleGroup {
  moduleCode: string;
  moduleTitle: string;
  options: {
    value: string;
    label: string;
    stepNumber: number;
    count?: number;
  }[];
}

/**
 * Helper untuk menentukan apakah suatu nilai string memiliki isi yang valid
 * (bukan kosong, bukan '-', bukan '(kosong)', bukan 'nopo', dll).
 */
export function hasValue(val?: string | number | null): val is string | number {
  if (val === undefined || val === null) return false;
  const s = String(val).trim();
  if (
    s === '' ||
    s === '-' ||
    s.toLowerCase() === '(kosong)' ||
    s.toLowerCase() === 'null' ||
    s.toLowerCase() === 'nopo' ||
    s.toLowerCase() === 'undefined'
  ) {
    return false;
  }
  return true;
}

export interface EvaluatedStatusResult {
  statusBadge: string;
  statusTone: StatusTone;
  statusPenjelasan: string;
  picAktif: string;
}

export interface EvaluatableItem {
  fpb?: string;
  po?: string;
  noPo?: string;
  date?: string;
  tglPo?: string;
  tglFpb?: string;
  noFstb?: string;
  tglFstb?: string;
  tglInputFstb?: string;
  tglKePicTtb?: string;
  noTtb?: string;
  tglTtb?: string;
  tglInputTtb?: string;
  tglKeTimLapangan?: string;
  tglKeTimLap?: string;
  tglBarangDiantar?: string;
  tglDiantar?: string;
  tglTimLapKePicTtb?: string;
  tglTtbKePicPch?: string;
  tglKeAdmPch?: string;
  picAdm?: string;
  picPch?: string;
  picTtb?: string;
  picLap?: string;
  picAktif?: string;
  noSpp?: string;
  spp?: string;
  tglSpp?: string;
  tglInputSpp?: string;
  tglKeuangan?: string;
  tglKeKeuangan?: string;
  tglKeu?: string;
  statusArmada?: string;
  rawStatus?: string;
  statusBadge?: string;
  statusPenjelasan?: string;
  lapse?: number;
  lapseText?: string;
}

/**
 * Single source of truth untuk penentuan status dan keterangan alur transaksi:
 * Menilai urutan tertinggi yang telah tercapai dalam 4 modul supply chain.
 * Menjamin berkas yang memiliki PO tidak pernah berstatus "MENUNGGU PO" ("belum memiliki PO").
 */
export function evaluateTransactionStatus(item: EvaluatableItem): EvaluatedStatusResult {
  const rawStatusUpper = (item.statusBadge || item.statusArmada || item.rawStatus || '').toUpperCase().trim();
  if (
    rawStatusUpper.includes('BATAL') ||
    rawStatusUpper.includes('CANCEL') ||
    rawStatusUpper.includes('VOID') ||
    rawStatusUpper.includes('REJECT')
  ) {
    return {
      statusBadge: 'BATAL / REJECT',
      statusTone: 'rose',
      statusPenjelasan: `Transaksi FPB ${item.fpb || '-'} dibatalkan (BATAL)`,
      picAktif: item.picAktif || item.picPch || '-',
    };
  }

  const po = hasValue(item.po) ? String(item.po).trim() : hasValue(item.noPo) ? String(item.noPo).trim() : '';
  const fpb = item.fpb?.trim() || '';
  const noFstb = hasValue(item.noFstb) ? String(item.noFstb).trim() : '';
  const tglFstb = item.tglFstb || item.tglInputFstb || '';
  const noTtb = hasValue(item.noTtb) ? String(item.noTtb).trim() : '';
  const tglTtb = item.tglTtb || item.tglInputTtb || '';
  const tglKePicTtb = item.tglKePicTtb || '';
  const tglKeTimLap = item.tglKeTimLapangan || item.tglKeTimLap || '';
  const tglDiantar = item.tglBarangDiantar || item.tglDiantar || '';
  const tglTtbKePicPch = item.tglTtbKePicPch || '';
  const tglKeAdmPch = item.tglKeAdmPch || '';
  const noSpp = hasValue(item.noSpp) ? String(item.noSpp).trim() : hasValue(item.spp) ? String(item.spp).trim() : '';
  const tglSpp = item.tglSpp || item.tglInputSpp || '';
  const tglKeu = item.tglKeKeuangan || item.tglKeu || item.tglKeuangan || '';
  const tglPo = item.tglPo || item.date || '';
  const tglFpb = item.tglFpb || '';

  const picPch = item.picPch && item.picPch !== '-' && item.picPch.toLowerCase() !== 'purchasing' ? item.picPch.trim() : '';
  const picTtb = item.picTtb && item.picTtb !== '-' && item.picTtb.toLowerCase() !== 'logistik' ? item.picTtb.trim() : '';
  const picLap = item.picLap && item.picLap !== '-' ? item.picLap.trim() : '';
  const picAdm = item.picAdm && item.picAdm !== '-' ? item.picAdm.trim() : '';

  let statusBadge = '';
  let statusTone: StatusTone = 'cyan';
  let statusPenjelasan = '';
  let picAktif = '';

  const hasValidSpp = Boolean(noSpp);
  const hasValidKeu = hasValue(tglKeu);

  // 1. MODUL 4: FINANCE (SELESAI DI KEUANGAN)
  if (hasValidSpp && hasValidKeu) {
    statusBadge = 'SELESAI DI KEUANGAN';
    statusTone = 'emerald';
    statusPenjelasan = `Berkas selesai di keuangan pada ${formatDateDdMmYyDash(tglKeu)} (SPP: ${noSpp})`;
    picAktif = `${picAdm || picPch || 'Finance'} (ADM/PRC)`;
  }
  // 2. MODUL 4: FINANCE (PROSES SPP)
  else if (hasValidSpp || hasValue(tglSpp)) {
    statusBadge = 'PROSES SPP';
    statusTone = 'emerald';
    statusPenjelasan = `SPP ${noSpp || '-'} diterbitkan ${tglSpp ? formatDateDdMmYyDash(tglSpp) : '-'}`;
    picAktif = `${picAdm || picPch || 'Finance'} (ADM/PRC)`;
  }
  // 3. MODUL 4: FINANCE / ADM (PROSES ADM PURCHASING)
  else if (hasValidKeu || hasValue(tglKeAdmPch) || (picAdm && picAdm !== '-')) {
    statusBadge = 'PROSES ADM PURCHASING';
    statusTone = 'cyan';
    statusPenjelasan = 'Berkas di proses administrasi purchasing (menunggu nomor SPP)';
    picAktif = `${picAdm || 'Eka'} (ADM PCH)`;
  }
  // 4. MODUL 2: LOGISTIK (TTB KE PIC PCH)
  else if (hasValue(tglTtbKePicPch)) {
    statusBadge = 'TTB KE PIC PCH';
    statusTone = 'purple';
    statusPenjelasan = `Dokumen TTB diserahkan ke PIC Purchasing pada ${formatDateDdMmYyDash(tglTtbKePicPch)}`;
    picAktif = `${picPch || 'Purchasing'} (Purchasing)`;
  }
  // 5. MODUL 3: TIM LAPANGAN (DIANTAR KE LAPANGAN)
  else if (hasValue(tglDiantar)) {
    statusBadge = 'DIANTAR KE LAPANGAN';
    statusTone = 'amber';
    statusPenjelasan = `Barang telah diantar ke lapangan pada ${formatDateDdMmYyDash(tglDiantar)}`;
    picAktif = `${picLap || 'Tim Lapangan'} (Lapangan)`;
  }
  // 6. MODUL 3: TIM LAPANGAN (MENUNGGU DISTRIBUSI LAPANGAN)
  else if (hasValue(tglKeTimLap)) {
    statusBadge = 'MENUNGGU DISTRIBUSI LAPANGAN';
    statusTone = 'amber';
    statusPenjelasan = `Barang diteruskan ke tim lapangan pada ${formatDateDdMmYyDash(tglKeTimLap)}`;
    picAktif = `${picLap || 'Tim Lapangan'} (Lapangan)`;
  }
  // 7. MODUL 2: LOGISTIK (VALIDASI LOGISTIK TTB)
  else if (hasValue(noTtb) || hasValue(tglTtb)) {
    statusBadge = 'VALIDASI LOGISTIK TTB';
    statusTone = 'purple';
    statusPenjelasan = `TTB ${noTtb || '-'} divalidasi logistik (${tglTtb ? formatDateDdMmYyDash(tglTtb) : '-'})`;
    picAktif = `${picTtb || 'Davila/Fifi'} (Logistik)`;
  }
  // 8. MODUL 2: LOGISTIK (MENUNGGU PIC TTB)
  else if (hasValue(tglKePicTtb)) {
    statusBadge = 'MENUNGGU PIC TTB';
    statusTone = 'purple';
    statusPenjelasan = `Menunggu proses PIC TTB sejak ${formatDateDdMmYyDash(tglKePicTtb)}`;
    picAktif = `${picTtb || 'Davila/Fifi'} (Logistik)`;
  }
  // 9. MODUL 1: PROCUREMENT (PROSES FSTB)
  else if (hasValue(noFstb) || hasValue(tglFstb)) {
    statusBadge = 'PROSES FSTB';
    statusTone = 'cyan';
    statusPenjelasan = `FSTB ${noFstb || '-'} diterbitkan (${tglFstb ? formatDateDdMmYyDash(tglFstb) : '-'})`;
    picAktif = `${picPch || 'Purchasing'} (Purchasing)`;
  }
  // 10. SELESAI CLOSE DARI SISTEM / ARMADA
  else if (rawStatusUpper === 'CLOSE' || rawStatusUpper === 'SELESAI (CLOSE)') {
    statusBadge = 'SELESAI (CLOSE)';
    statusTone = 'emerald';
    statusPenjelasan = 'Layanan armada dan pemenuhan barang selesai (CLOSE)';
    picAktif = `${picPch || 'Purchasing'} (Purchasing)`;
  }
  // 11. MODUL 1: PROCUREMENT (MENUNGGU FSTB - KARENA PO SUDAH TERBIT)
  else if (hasValue(po)) {
    statusBadge = 'MENUNGGU FSTB';
    statusTone = 'cyan';
    statusPenjelasan = `PO ${po} terbit (${tglPo ? formatDateDdMmYyDash(tglPo) : '-'}), proses logistik / menunggu FSTB`;
    picAktif = `${picPch || 'Purchasing'} (Purchasing)`;
  }
  // 12. MODUL 1: PROCUREMENT (MENUNGGU PO - HANYA JIKA BENAR-BENAR BELUM ADA PO)
  else {
    statusBadge = 'MENUNGGU PO';
    statusTone = 'rose';
    statusPenjelasan = `FPB ${fpb || '-'} diajukan (${tglFpb ? formatDateDdMmYyDash(tglFpb) : '-'}), menunggu penerbitan PO`;
    picAktif = `${picPch ? picPch : 'Input PO'} (Purchasing)`;
  }

  // Cek SLA Lapse: Jika lapse > 5 hari dan bukan emerald, tandai tone rose
  if (item.lapseText !== 'TBC' && item.lapse !== undefined && item.lapse > 5 && statusTone !== 'emerald') {
    statusTone = 'rose';
  }

  return {
    statusBadge,
    statusTone,
    statusPenjelasan,
    picAktif,
  };
}

// Urutan kronologis alur supply chain akuntabilitas lintas modul
export const ORDERED_STATUS_WORKFLOW: WorkflowStatusItem[] = [
  // ── MODUL 1: PROCUREMENT / PURCHASING ──
  {
    value: 'MENUNGGU PO',
    label: '1. MENUNGGU PO',
    moduleCode: 'PROCUREMENT',
    moduleTitle: '1. Modul Procurement (Pengadaan & PO)',
    stepNumber: 1,
    description: 'FPB diajukan, menunggu penerbitan PO oleh Purchasing',
  },
  {
    value: 'MENUNGGU FSTB',
    label: '2. MENUNGGU FSTB',
    moduleCode: 'PROCUREMENT',
    moduleTitle: '1. Modul Procurement (Pengadaan & PO)',
    stepNumber: 2,
    description: 'PO terbit / alokasi stok gudang menunggu form serah terima barang',
  },
  {
    value: 'PROSES FSTB',
    label: '2b. PROSES FSTB',
    moduleCode: 'PROCUREMENT',
    moduleTitle: '1. Modul Procurement (Pengadaan & PO)',
    stepNumber: 2,
    description: 'FSTB telah diterbitkan',
  },

  // ── MODUL 2: LOGISTIK & GUDANG (PENERIMAAN TTB) ──
  {
    value: 'MENUNGGU PIC TTB',
    label: '3. MENUNGGU PIC TTB',
    moduleCode: 'LOGISTIK',
    moduleTitle: '2. Modul Logistik & Gudang (Penerimaan TTB)',
    stepNumber: 3,
    description: 'Barang fisik tiba di gudang, menunggu pemeriksaan & TTB',
  },
  {
    value: 'VALIDASI LOGISTIK TTB',
    label: '4. VALIDASI LOGISTIK TTB',
    moduleCode: 'LOGISTIK',
    moduleTitle: '2. Modul Logistik & Gudang (Penerimaan TTB)',
    stepNumber: 4,
    description: 'TTB diterbitkan dan divalidasi oleh logistik',
  },
  {
    value: 'TTB KE PIC PCH',
    label: '5. TTB KE PIC PCH',
    moduleCode: 'LOGISTIK',
    moduleTitle: '2. Modul Logistik & Gudang (Penerimaan TTB)',
    stepNumber: 5,
    description: 'Dokumen fisik TTB diserahkan kembali ke PIC Purchasing',
  },

  // ── MODUL 3: TIM LAPANGAN (DISTRIBUSI KE KAPAL/UNIT) ──
  {
    value: 'MENUNGGU DISTRIBUSI LAPANGAN',
    label: '6. MENUNGGU DISTRIBUSI LAPANGAN',
    moduleCode: 'LAPANGAN',
    moduleTitle: '3. Modul Tim Lapangan (Distribusi & Serah Terima)',
    stepNumber: 6,
    description: 'Barang diteruskan dan menunggu distribusi ke tim lapangan',
  },
  {
    value: 'DIANTAR KE LAPANGAN',
    label: '7. DIANTAR KE LAPANGAN',
    moduleCode: 'LAPANGAN',
    moduleTitle: '3. Modul Tim Lapangan (Distribusi & Serah Terima)',
    stepNumber: 7,
    description: 'Barang telah diantar dan diserahterimakan ke kapal/lapangan',
  },

  // ── MODUL 4: FINANCE & ADMINISTRASI (PEMBAYARAN) ──
  {
    value: 'PROSES ADM PURCHASING',
    label: '8. PROSES ADM PURCHASING',
    moduleCode: 'FINANCE',
    moduleTitle: '4. Modul Finance & ADM (Verifikasi & Pembayaran)',
    stepNumber: 8,
    description: 'Pemeriksaan berkas administrasi purchasing, menunggu nomor SPP',
  },
  {
    value: 'PROSES SPP',
    label: '9. PROSES SPP',
    moduleCode: 'FINANCE',
    moduleTitle: '4. Modul Finance & ADM (Verifikasi & Pembayaran)',
    stepNumber: 9,
    description: 'Surat Permintaan Pembayaran (SPP) diterbitkan untuk proses bayar',
  },
  {
    value: 'SELESAI DI KEUANGAN',
    label: '10. SELESAI DI KEUANGAN',
    moduleCode: 'FINANCE',
    moduleTitle: '4. Modul Finance & ADM (Verifikasi & Pembayaran)',
    stepNumber: 10,
    description: 'Verifikasi berkas keuangan tuntas dan pembayaran selesai',
  },
  {
    value: 'SELESAI (CLOSE)',
    label: '11. SELESAI (CLOSE)',
    moduleCode: 'FINANCE',
    moduleTitle: '4. Modul Finance & ADM (Verifikasi & Pembayaran)',
    stepNumber: 11,
    description: 'Penyelesaian penuh seluruh tahapan transaksi',
  },
];

/**
 * Mengelompokkan status yang ada di dataset ke dalam 4 modul alur supply chain.
 * Menjamin urutan opsi dropdown mengikuti kronologi alur proses (Procurement -> Logistik -> Lapangan -> Finance).
 */
export function getWorkflowGroupedStatuses(
  presentStatuses: string[],
  statusCounts?: Record<string, number>
): WorkflowModuleGroup[] {
  const presentSet = new Set(presentStatuses.map((s) => s.trim().toUpperCase()));
  const matchedValues = new Set<string>();

  // Siapkan map grup
  const groupMap = new Map<string, WorkflowModuleGroup>();

  // Inisialisasi 4 modul utama
  const moduleDefinitions = [
    { code: 'PROCUREMENT', title: '1. Modul Procurement (Pengadaan & PO)' },
    { code: 'LOGISTIK', title: '2. Modul Logistik & Gudang (Penerimaan TTB)' },
    { code: 'LAPANGAN', title: '3. Modul Tim Lapangan (Distribusi & Serah Terima)' },
    { code: 'FINANCE', title: '4. Modul Finance & ADM (Verifikasi & Pembayaran)' },
  ];

  moduleDefinitions.forEach((m) => {
    groupMap.set(m.code, {
      moduleCode: m.code,
      moduleTitle: m.title,
      options: [],
    });
  });

  // Isi opsi sesuai urutan kronologis yang ada di dataset
  ORDERED_STATUS_WORKFLOW.forEach((wfItem) => {
    const upperVal = wfItem.value.toUpperCase();
    if (presentSet.has(upperVal)) {
      matchedValues.add(upperVal);
      const group = groupMap.get(wfItem.moduleCode);
      if (group) {
        const count = statusCounts ? statusCounts[wfItem.value] : undefined;
        group.options.push({
          value: wfItem.value,
          label: wfItem.label,
          stepNumber: wfItem.stepNumber,
          count,
        });
      }
    }
  });

  // Tangani status di luar 4 modul jika ada
  const otherOptions: { value: string; label: string; stepNumber: number; count?: number }[] = [];
  presentStatuses.forEach((rawSt) => {
    const upper = rawSt.trim().toUpperCase();
    if (!matchedValues.has(upper) && rawSt.trim() !== '' && rawSt !== 'ALL') {
      const count = statusCounts ? statusCounts[rawSt] : undefined;
      otherOptions.push({
        value: rawSt,
        label: rawSt,
        stepNumber: 99,
        count,
      });
    }
  });

  // Hapus grup yang kosong (hanya tampilkan modul yang memiliki data aktif)
  const result: WorkflowModuleGroup[] = [];
  moduleDefinitions.forEach((m) => {
    const g = groupMap.get(m.code);
    if (g && g.options.length > 0) {
      result.push(g);
    }
  });

  if (otherOptions.length > 0) {
    result.push({
      moduleCode: 'OTHER',
      moduleTitle: 'Status Khusus / Tambahan',
      options: otherOptions,
    });
  }

  return result;
}

