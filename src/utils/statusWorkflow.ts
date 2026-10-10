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

