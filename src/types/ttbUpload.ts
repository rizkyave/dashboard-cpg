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
  storageProvider?: 'CLOUDFLARE_R2' | 'LOCAL' | 'GOOGLE_DRIVE';
  driveFolderUrl: string;
  driveFileId?: string;
  driveViewUrl?: string;
  driveDownloadUrl?: string;
  spreadsheetUrl?: string;
  uploadedAt: string;
  status: 'UPLOADED_TO_SYSTEM' | 'SYNCED_TO_DRIVE' | 'SAVED_TO_DRIVE_DATABASE';
}

export interface UploadTtbResponse {
  success: boolean;
  message: string;
  driveFolderUrl: string;
  folderId: string;
  spreadsheetUrl?: string;
  isDriveDatabaseActive?: boolean;
  isR2StorageActive?: boolean;
  uploadedFiles: UploadedTtbItem[];
  error?: string;
}
