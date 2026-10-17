export type ValidationLineType = 'purchasing' | 'logistik' | 'lapangan';

export type OverallValidationStatus =
  | 'MENUNGGU_VALIDASI' // 0 dari 3 Lini
  | 'PROSES_VALIDASI' // 1 atau 2 dari 3 Lini
  | 'SIAP_KIRIM_ARMADA' // 3/3 Lini tervalidasi lengkap (Kekuatan Validasi Penuh)
  | 'SUDAH_DITERIMA_ARMADA'; // Penerima akhir (crew armada) sudah tanda tangan

export interface ValidationSignatureRecord {
  isValidated: boolean;
  validatorName?: string;
  validatorUsername?: string;
  validatorRole?: string;
  validatorNik?: string;
  validatorJabatan?: string;
  signatureDataUrl?: string;
  validatedAt?: string;
  notes?: string;
  verificationToken?: string; // Token verifikasi kriptografis unik
}

export interface DocumentValidationRecord {
  id: string; // e.g. "val-fstb-xxx" atau "val-ttb-xxx"
  docType: 'FSTB' | 'TTB';
  docId: string; // ID dari berkas sumber FSTB/TTB
  docNumber: string; // Nomor resmi (contoh: CPL-FSTB-26-05241 atau CPL-TTB-26-06465)
  cleanDocNumber: string;
  armada: string;
  poNumber?: string;
  fpbNumber?: string;
  receivedDate?: string;
  originalFileName: string;
  renamedFileName: string;
  fileUrl: string;
  r2Key?: string;
  storageProvider?: 'CLOUDFLARE_R2' | 'LOCAL';

  // Lini 1: Purchasing / Pengadaan (Kesesuaian PO, Spesifikasi, Vendor)
  purchasingValidation: ValidationSignatureRecord;

  // Lini 2: Logistik & Pergudangan (Pemeriksaan Fisik Barang, Jumlah, Kondisi)
  logistikValidation: ValidationSignatureRecord;

  // Lini 3: Tim Lapangan / QC (Pemeriksaan Pra-Distribusi & Kesiapan Muat Kapal)
  lapanganValidation: ValidationSignatureRecord;

  // Lini Akhir: Crew Kapal / Penerima Akhir
  recipientValidation?: {
    isSigned: boolean;
    recipientName?: string;
    recipientPhone?: string;
    signedAt?: string;
    signatureDataUrl?: string;
  };

  // Status & Indikator Agregat
  overallStatus: OverallValidationStatus;
  completedLinesCount: number; // 0, 1, 2, atau 3
  isReadyForDispatch: boolean; // True jika seluruh 3 lini internal sudah sah
  createdAt: string;
  updatedAt: string;
}

export interface ValidationSummaryMetrics {
  totalDocuments: number;
  totalFstb: number;
  totalTtb: number;
  menungguValidasi: number;
  prosesValidasi: number;
  siapKirimArmada: number;
  sudahDiterimaArmada: number;
}
