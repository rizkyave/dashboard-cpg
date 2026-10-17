export interface UploadedTtbItem {
  id: string;
  noTtb: string;
  cleanNoTtb: string;
  armada: string;
  receivedDate: string;
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
  // Legacy fields untuk kompatibilitas data riwayat lama
  driveFolderUrl?: string;
  driveFileId?: string;
  driveViewUrl?: string;
  driveDownloadUrl?: string;
  spreadsheetUrl?: string;
}

export interface UploadTtbResponse {
  success: boolean;
  message: string;
  storageProvider: 'CLOUDFLARE_R2' | 'LOCAL';
  bucketName?: string;
  isR2StorageActive?: boolean;
  uploadedFiles: UploadedTtbItem[];
  error?: string;
}
