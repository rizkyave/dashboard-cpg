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
  driveFolderUrl: string;
  uploadedAt: string;
  status: 'UPLOADED_TO_SYSTEM' | 'SYNCED_TO_DRIVE';
}

export interface UploadTtbResponse {
  success: boolean;
  message: string;
  driveFolderUrl: string;
  folderId: string;
  uploadedFiles: UploadedTtbItem[];
  error?: string;
}

