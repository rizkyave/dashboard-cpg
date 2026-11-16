export interface SopFolder {
  id: string;
  name: string;
  code: string;
  description: string;
  icon: string; // 'FileText' | 'Shield' | 'Anchor' | 'Folder' | 'BookOpen' | 'CheckSquare'
  color: 'emerald' | 'blue' | 'amber' | 'purple' | 'cyan' | 'teal' | 'rose';
  order: number;
}

export type SopDocumentStatus = 'ACTIVE' | 'UNDER_REVIEW' | 'ARCHIVED';

export interface SopDocument {
  id: string;
  folderId: string;
  title: string;
  docNumber: string; // e.g. SOP-CPG-LOG-001
  version: string; // e.g. v1.0, v2.1
  effectiveDate: string; // e.g. 2026-01-01
  summary: string;
  tags: string[];
  fileName: string;
  fileUrl: string;
  fileSize: number; // bytes
  fileType: string; // 'pdf' | 'docx' | 'xlsx'
  status: SopDocumentStatus;
  uploadedBy: string;
  uploadedByName?: string;
  uploadedAt: string;
  lastModifiedAt?: string;
  viewCount?: number;
  downloadCount?: number;
  externalLink?: string;
}

export interface RegulasiSopData {
  folders: SopFolder[];
  documents: SopDocument[];
  lastUpdated: string;
}
