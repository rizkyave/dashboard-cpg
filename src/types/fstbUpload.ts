export interface UploadedFstbItem {
  id: string;
  noFstb: string;
  cleanNoFstb: string;
  armada: string;
  doNo?: string; // Nomor DO / PO terkait (contoh: CPL-PO-26-04738)
  noFpb?: string; // Nomor FPB terkait (contoh: CPL-FPB-26-000396)
  receivedDate: string;
  fstbDate?: string; // Tanggal FSTB resmi (contoh: 09/01/2026)
  supplier?: string; // Supplier / Vendor (contoh: PT. WAHYU MANDIRI AMARA CIPTA)
  keterangan?: string;
  originalFileName: string;
  renamedFileName: string;
  fileSize: number;
  fileType: string;
  fileUrl: string;
  r2Key?: string;
  r2Url?: string;
  storageProvider?: 'CLOUDFLARE_R2' | 'LOCAL';
  uploadedAt: string;
  status: 'STORED_IN_CLOUDFLARE_R2' | 'UPLOADED_TO_SYSTEM';
  // Identitas Pengunggah (Uploader)
  uploaderName?: string;
  uploaderUsername?: string;
  uploaderRole?: string;
  uploaderNik?: string;
  uploaderJabatan?: string;
  isAutoStamped?: boolean;
  stampedAt?: string;
  // Identitas & Tanda Tangan Penerima / Pemeriksa
  isRecipientStamped?: boolean;
  recipientName?: string;
  recipientPhone?: string;
  recipientSignatureDataUrl?: string;
  recipientStampedAt?: string;
}

export interface UploadFstbResponse {
  success: boolean;
  message: string;
  storageProvider: 'CLOUDFLARE_R2' | 'LOCAL';
  bucketName?: string;
  isR2StorageActive?: boolean;
  uploadedFiles: UploadedFstbItem[];
  error?: string;
}
