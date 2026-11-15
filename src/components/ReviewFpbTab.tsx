'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  FileCheck,
  ClipboardCheck,
  Search,
  Filter,
  RefreshCw,
  CloudDownload,
  Download,
  AlertTriangle,
  AlertOctagon,
  Clock,
  PackageCheck,
  CheckCircle2,
  Loader2,
  XCircle,
  HelpCircle,
  Eye,
  ExternalLink,
  ChevronRight,
  Layers,
  Building2,
  Ship,
  Truck,
  Calendar,
  UserCheck,
  FileText,
  Boxes,
  Sparkles,
  ArrowRight,
  X,
  FileSearch,
  KeyRound,
  Lock,
  Cookie,
  Settings,
  ShieldAlert,
  Zap,
  Timer,
  History,
  Paperclip,
  Image as ImageIcon,
  UploadCloud,
  Trash2,
  Maximize2,
  ZoomIn,
  Tag,
  MessageSquare,
  Phone,
  User,
  Copy,
  Plus,
  FileSpreadsheet,
  ShieldCheck,
  Upload,
  Archive,
  RotateCcw,
  BarChart3,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { downloadPurchasePlanningBatchExcel } from '@/utils/batchExcelGenerator';
import {
  formatFpbApprovalWaMessage,
  generateFpbApprovalWaLink,
} from '@/utils/whatsappNotifier';
import {
  FpbReviewRecord,
  FpbReviewStatus,
  FpbUrgency,
  FpbPriorityLevel,
  FPB_PRIORITIES,
  FpbItemReview,
  FpbAttachment,
  FpbReviewSummaryMetrics,
  ItemDecision,
} from '@/types/fpbReview';
import { useAuth } from '@/context/AuthContext';
import { findCrewOrArmadaContact, syncCrewContact } from '@/utils/crewKapalStorage';
import LogisticsApprovalCell from './LogisticsApprovalCell';
import LogisticsApprovalConfirmModal from './LogisticsApprovalConfirmModal';
import { checkFpbCycleAlignment } from '@/utils/fpbCycleHelper';

// Helper formatting WhatsApp URL
const getWaUrl = (phone: string, text: string) => {
  const clean = phone.replace(/[^0-9]/g, '');
  let formatted = clean;
  if (formatted.startsWith('0')) formatted = '62' + formatted.slice(1);
  else if (!formatted.startsWith('62')) formatted = '62' + formatted;
  return `https://wa.me/${formatted}?text=${encodeURIComponent(text)}`;
};

interface ReviewFpbTabProps {
  showToast?: (msg: string, type?: 'info' | 'success' | 'warning' | 'error') => void;
  initialSearch?: string;
}

const ENTITY_OPTIONS = [
  { code: 'ALL', label: 'Semua Entitas (8)' },
  { code: 'CPL', label: 'CPL (Cindara Pratama Lines)' },
  { code: 'PPI', label: 'PPI (Petro Perkasa Indonesia)' },
  { code: 'HL', label: 'HL (Hana Lines)' },
  { code: 'GAJ', label: 'GAJ (Galangan Aliran Jaya)' },
  { code: 'MIL', label: 'MIL (Mapan Indonesia Lines)' },
  { code: 'SP', label: 'SP (Sinar Pasifik)' },
  { code: 'SSK', label: 'SSK (Sinar Surya Konstruksi)' },
  { code: 'MO', label: 'MO (Mandar Ocean)' },
];

const PURCHASING_PICS = [
  'Wahyu Hidayat',
  'Rina Sugiarto',
  'Budi Santoso',
  'Achmad Fauzi',
  'Dewi Lestari',
  'Tim Purchasing Samarinda',
  'Tim Purchasing Balikpapan',
];

export default function ReviewFpbTab({ showToast, initialSearch }: ReviewFpbTabProps) {
  const { user, isAdmin: authIsAdmin } = useAuth();
  const isAdmin =
    authIsAdmin ||
    !user ||
    user.role === 'admin' ||
    user.role === 'direksi' ||
    user.role === 'manager' ||
    user.role === 'supervisor' ||
    user.role === 'staf_purchasing';

  // Data states
  const [reviews, setReviews] = useState<FpbReviewRecord[]>([]);
  const [metrics, setMetrics] = useState<FpbReviewSummaryMetrics>({
    total: 0,
    pending: 0,
    approvedPo: 0,
    fulfillStock: 0,
    needClarification: 0,
    rejected: 0,
    urgent: 0,
    emergency: 0,
    p1Count: 0,
    p2Count: 0,
    p3Count: 0,
    overdueCount: 0,
  });
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [syncMode, setSyncMode] = useState<'quick' | 'full'>('quick');

  // Filter states
  const [searchQuery, setSearchQuery] = useState<string>(initialSearch || '');

  useEffect(() => {
    if (initialSearch !== undefined) {
      setSearchQuery(initialSearch);
    }
  }, [initialSearch]);
  const [selectedEntity, setSelectedEntity] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [selectedUrgency, setSelectedUrgency] = useState<string>('ALL');
  const [selectedPriority, setSelectedPriority] = useState<string>('ALL');
  const [onlyDuplicates, setOnlyDuplicates] = useState<boolean>(false);

  // Modal / Drawer state
  const [selectedRecord, setSelectedRecord] = useState<FpbReviewRecord | null>(null);
  const [activeModalTab, setActiveModalTab] = useState<'items' | 'pdf' | 'attachments'>('items');
  const [pdfViewMode, setPdfViewMode] = useState<'raw' | 'signed'>('raw');
  const [isParsingItems, setIsParsingItems] = useState<boolean>(false);
  const [isSavingDecision, setIsSavingDecision] = useState<boolean>(false);

  // Form states inside modal
  const [formStatus, setFormStatus] = useState<FpbReviewStatus>('PENDING_REVIEW');
  const [formUrgency, setFormUrgency] = useState<FpbUrgency>('NORMAL');
  const [formPriority, setFormPriority] = useState<FpbPriorityLevel>('P3');
  const [formPic, setFormPic] = useState<string>('');
  const [formNotes, setFormNotes] = useState<string>('');
  const [formIsReceivedLogistik, setFormIsReceivedLogistik] = useState<boolean>(false);
  const [isApprovingLogistic, setIsApprovingLogistic] = useState<boolean>(false);
  const [isVerifyingEfpb, setIsVerifyingEfpb] = useState<boolean>(false);

  // Clean Sheet & Archive States
  const [sheetViewMode, setSheetViewMode] = useState<'active' | 'archived' | 'batch_summary'>('active');
  const [isCleanSheetModalOpen, setIsCleanSheetModalOpen] = useState<boolean>(false);
  const [isCleaningSheet, setIsCleaningSheet] = useState<boolean>(false);

  // Weekly Cut-Off & Batch PP States (Siklus Mingguan Jumat pk 10:00)
  const [nowDate, setNowDate] = useState<Date>(new Date());
  const [isFinalizeBatchModalOpen, setIsFinalizeBatchModalOpen] = useState<boolean>(false);
  const [customBatchCode, setCustomBatchCode] = useState<string>('');
  const [autoDownloadExcelOnFinalize, setAutoDownloadExcelOnFinalize] = useState<boolean>(true);
  const [archivedBatchFilter, setArchivedBatchFilter] = useState<string>('ALL');

  useEffect(() => {
    const timer = setInterval(() => {
      setNowDate(new Date());
    }, 30000);
    return () => clearInterval(timer);
  }, []);

  // Requester (Pembuat e-FPB) & Kontak WA state
  const [formRequestedBy, setFormRequestedBy] = useState<string>('');
  const [formRequesterPhone, setFormRequesterPhone] = useState<string>('');
  const [isFetchingRequester, setIsFetchingRequester] = useState<boolean>(false);
  const [isEditingPhone, setIsEditingPhone] = useState<boolean>(false);
  const [tempPhoneInput, setTempPhoneInput] = useState<string>('');

  // Verifikasi Pengesahan Dokumen di Real Server e-FPB
  const handleVerifyEfpb = async (rec: FpbReviewRecord) => {
    setIsVerifyingEfpb(true);
    try {
      const res = await fetch('/api/review-fpb', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'verify_efpb',
          fpbNo: rec.fpbNo,
        }),
      });
      const data = await res.json();
      if (data.success && data.record) {
        setReviews((prev) =>
          prev.map((r) =>
            r.fpbNo.toLowerCase() === rec.fpbNo.toLowerCase()
              ? {
                  ...r,
                  isReceivedLogistik: true,
                  pchLogistik: 'Received_Logistic',
                  pdfUrl: data.record.pdfUrl || r.pdfUrl,
                }
              : r
          )
        );
        setSelectedRecord((prev) =>
          prev && prev.fpbNo.toLowerCase() === rec.fpbNo.toLowerCase()
            ? {
                ...prev,
                isReceivedLogistik: true,
                pchLogistik: 'Received_Logistic',
                pdfUrl: data.record.pdfUrl || prev.pdfUrl,
              }
            : prev
        );
        setFormIsReceivedLogistik(true);
        setPdfViewMode('signed');
        showToast?.('Berhasil! Dokumen telah sah ditandatangani di e-FPB & berstatus Siap Pengadaan.', 'success');
      } else {
        showToast?.(
          data.message || 'Dokumen belum ditandatangani di e-FPB. Silakan tekan tombol Received_Logistic di web e-FPB terlebih dahulu.',
          'warning'
        );
      }
    } catch (err: any) {
      showToast?.('Gagal memeriksa status e-FPB: ' + err.message, 'error');
    } finally {
      setIsVerifyingEfpb(false);
    }
  };
  const [confirmApprovalRecord, setConfirmApprovalRecord] = useState<FpbReviewRecord | null>(null);
  const [formItems, setFormItems] = useState<FpbItemReview[]>([]);
  const [formAttachments, setFormAttachments] = useState<FpbAttachment[]>([]);
  const [isUploadingAttachment, setIsUploadingAttachment] = useState<boolean>(false);
  const [attachmentCaption, setAttachmentCaption] = useState<string>('');
  const [selectedAttachmentFile, setSelectedAttachmentFile] = useState<File | null>(null);
  const [previewImageModal, setPreviewImageModal] = useState<{ url: string; title: string } | null>(null);

  // Fetch reviews from API
  const fetchReviews = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/review-fpb', { cache: 'no-store' });
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        setReviews(json.data);
        if (json.metrics) setMetrics(json.metrics);
      } else {
        showToast?.(json.message || 'Gagal memuat data review FPB', 'error');
      }
    } catch (err: any) {
      console.error('Error fetching FPB reviews:', err);
      showToast?.('Gagal menghubungi server untuk memuat review FPB', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchReviews();
  }, []);

  // Refs untuk upload file mandiri
  const excelInputRef = React.useRef<HTMLInputElement>(null);
  const pdfInputRef = React.useRef<HTMLInputElement>(null);

  // Modal Input Manual Mandiri
  const [isCreateModalOpen, setIsCreateModalOpen] = useState<boolean>(false);
  const [newFpbNo, setNewFpbNo] = useState<string>('');
  const [newEntity, setNewEntity] = useState<string>('CPL');
  const [newArmada, setNewArmada] = useState<string>('');
  const [newDate, setNewDate] = useState<string>(() => {
    const d = new Date();
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yy = String(d.getFullYear()).slice(-2);
    return `${dd}/${mm}/${yy}`;
  });
  const [newPurpose, setNewPurpose] = useState<string>('');
  const [newPriority, setNewPriority] = useState<FpbPriorityLevel>('P2');
  const [newUrgency, setNewUrgency] = useState<FpbUrgency>('NORMAL');
  const [newItems, setNewItems] = useState<Array<{ itemName: string; qty: number; unit: string; description: string }>>([
    { itemName: '', qty: 1, unit: 'PCS', description: '' },
  ]);

  // Import Excel/CSV Mandiri
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        setIsSyncing(true);
        const data = evt.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const firstSheet = workbook.SheetNames[0];
        const sheet = workbook.Sheets[firstSheet];
        const rows: any[] = XLSX.utils.sheet_to_json(sheet, { defval: '' });

        if (rows.length === 0) {
          showToast?.('File Excel/CSV kosong.', 'warning');
          return;
        }

        const importedRecords: FpbReviewRecord[] = [];
        for (const r of rows) {
          const fpbRaw = r['No FPB'] || r['NO FPB'] || r['No. FPB'] || r['fpb'] || r['FPB'] || r['NO FPB ACCURATE'] || r['Nomor FPB'] || '';
          if (!fpbRaw || String(fpbRaw).trim().length < 5) continue;

          const fpbNo = String(fpbRaw).trim().replace(/\/LOG\/FPB\//i, '-FPB-');
          const armada = r['Armada'] || r['ARMADA'] || r['DEPT/ARMADA/PROJECT'] || r['Kapal'] || r['Dept'] || 'Armada Kapal';
          const entity = r['Entity'] || r['ENTITY'] || r['COMPANY'] || r['Perusahaan'] || (fpbNo.split('-')[0] || 'CPL');
          const date = r['Tanggal'] || r['TGL'] || r['Date'] || r['Created at'] || '';
          const purpose = r['Peruntukan'] || r['KETERANGAN'] || r['Keperluan'] || '';
          const statusLogistik = String(r['PCH / LOGISTIK'] || r['Status Logistik'] || '').toLowerCase();
          const isReceived = statusLogistik.includes('received') || statusLogistik.includes('diterima');

          importedRecords.push({
            id: `fpb-rev-${fpbNo}`,
            fpbNo,
            originalFpb: String(fpbRaw).trim(),
            entity: String(entity).toUpperCase().slice(0, 5),
            armada: String(armada),
            date: String(date) || new Date().toLocaleDateString('id-ID'),
            purpose: String(purpose),
            efpbStatus: 'Approved',
            isReceivedLogistik: isReceived,
            pdfUrl: `/api/review-fpb/pdf?fpbNo=${encodeURIComponent(fpbNo)}&type=signed`,
            reviewStatus: 'PENDING_REVIEW',
            urgency: 'NORMAL',
            priorityLevel: 'P3',
            picPurchasing: '-',
            reviewNotes: 'Diimpor dari file Excel/CSV mandiri',
            items: [],
            duplicateAlerts: [],
            relatedDocs: { poNos: [], fstbNos: [], ttbNos: [] },
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });
        }

        if (importedRecords.length === 0) {
          showToast?.('Tidak ditemukan kolom nomor FPB yang valid pada file.', 'warning');
          return;
        }

        const res = await fetch('/api/review-fpb', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'import_records',
            records: importedRecords,
          }),
        });

        const json = await res.json();
        if (json.success) {
          showToast?.(json.message || `Berhasil mengimpor ${importedRecords.length} berkas FPB!`, 'success');
          fetchReviews();
        } else {
          showToast?.(json.message || 'Gagal mengimpor file', 'error');
        }
      } catch (err: any) {
        console.error('Error importing file:', err);
        showToast?.('Gagal memproses file Excel/CSV: ' + err.message, 'error');
      } finally {
        setIsSyncing(false);
        if (e.target) e.target.value = '';
      }
    };
    reader.readAsBinaryString(file);
  };

  // Upload Multi-PDF FPB Mandiri & Ekstrak Item Sekaligus
  const handlePdfUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;
    const files = Array.from(fileList);

    try {
      setIsSyncing(true);
      showToast?.(`Memulai pemrosesan ${files.length} berkas PDF FPB...`, 'info');

      const extractedRecords: FpbReviewRecord[] = [];
      const incompleteSignatures: { fpbNo: string; missing: string[] }[] = [];
      const outOfCycleList: { fpbNo: string; date: string; originalBatch: string; daysLate: number }[] = [];
      let successCount = 0;
      let failCount = 0;

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        showToast?.(`Mengekstrak PDF (${i + 1}/${files.length}): ${file.name}...`, 'info');

        try {
          const formData = new FormData();
          formData.append('file', file);

          const res = await fetch('/api/parse-fpb-pdf', {
            method: 'POST',
            body: formData,
          });

          const json = await res.json();
          if (json.success && json.data) {
            const pd = json.data;
            const cleanNo = (pd.fpbNo || file.name.replace(/\.pdf$/i, '')).trim();
            const sigVerification = pd.signatureVerification;

            if (sigVerification && !sigVerification.isComplete) {
              incompleteSignatures.push({
                fpbNo: cleanNo,
                missing: sigVerification.missingSignatures || ['Reviewer/Penyetuju'],
              });
            }

            const fpbDateStr = pd.fpbDate || new Date().toLocaleDateString('id-ID');
            const cycleAlign = checkFpbCycleAlignment(fpbDateStr, nowDate, cycleInfo.batchSeq);

            if (cycleAlign.isPastCycle) {
              outOfCycleList.push({
                fpbNo: cleanNo,
                date: fpbDateStr,
                originalBatch: cycleAlign.originalBatchName,
                daysLate: cycleAlign.daysLate,
              });
            }

            let reviewNoteText = 'Diekstrak dari unggahan berkas PDF fisik (Multi-Upload)';
            if (cycleAlign.isPastCycle) {
              reviewNoteText = `[DOKUMEN SUSULAN]: FPB tertanggal ${fpbDateStr} (Periode ${cycleAlign.originalBatchName}, terlambat ${cycleAlign.daysLate} hari dari cut-off). Diterima sebagai susulan di ${cycleInfo.batchName}.`;
            } else if (sigVerification && !sigVerification.isComplete) {
              reviewNoteText = `[PERIKSA TTD]: ${sigVerification.statusText}`;
            }

            const newRecord: FpbReviewRecord = {
              id: `fpb-rev-${cleanNo}`,
              fpbNo: cleanNo,
              originalFpb: cleanNo,
              entity: cleanNo.split('-')[0] || 'CPL',
              armada: pd.userArmada || 'Armada Kapal',
              date: fpbDateStr,
              purpose: pd.tujuanPeruntukan || 'Pengadaan suku cadang/kebutuhan armada',
              efpbStatus: 'Approved',
              isReceivedLogistik: true,
              pchLogistik: 'Received_Logistic',
              pdfUrl: `/api/review-fpb/pdf?fpbNo=${encodeURIComponent(cleanNo)}&type=signed`,
              reviewStatus: 'PENDING_REVIEW',
              urgency: 'NORMAL',
              priorityLevel: 'P2',
              picPurchasing: '-',
              reviewNotes: reviewNoteText,
              isArchived: false,
              signatureVerification: sigVerification,
              isLateEntry: cycleAlign.isPastCycle,
              lateDays: cycleAlign.daysLate,
              originalCycleBatch: cycleAlign.originalBatchName,
              cycleDisposition: cycleAlign.isPastCycle ? 'LATE_ENTRY' : 'REGULAR',
              requestedBy: pd.requestedBy || '',
              reviewedBy: pd.reviewedBy || '',
              items: (pd.items || []).map((it: any, idx: number) => ({
                no: it.no || idx + 1,
                itemCode: it.itemCode || '-',
                itemName: it.itemName || `Barang ${idx + 1}`,
                qty: Number(it.qty) || 1,
                unit: it.unit || 'PCS',
                description: it.description || '',
                priority: it.priority || 'P2',
                stockAvailable: 0,
                stockStatus: 'OUT_OF_STOCK',
                decision: 'PO',
                notes: 'Menunggu review tim purchasing',
              })),
              duplicateAlerts: [],
              relatedDocs: { poNos: [], fstbNos: [], ttbNos: [] },
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            };

            extractedRecords.push(newRecord);
            successCount++;
          } else {
            failCount++;
            console.warn(`Gagal parse PDF ${file.name}:`, json.message);
          }
        } catch (fileErr) {
          failCount++;
          console.error(`Error processing PDF ${file.name}:`, fileErr);
        }
      }

      if (extractedRecords.length > 0) {
        showToast?.(`Menyimpan ${extractedRecords.length} berkas FPB baru ke lembar kerja aktif...`, 'info');
        const saveRes = await fetch('/api/review-fpb', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'import_records',
            records: extractedRecords,
          }),
        });

        const saveJson = await saveRes.json();
        if (saveJson.success) {
          showToast?.(
            `Berhasil mengimpor ${extractedRecords.length} berkas FPB ke lembar aktif!${failCount > 0 ? ` (${failCount} berkas gagal)` : ''}`,
            'success'
          );

          if (incompleteSignatures.length > 0) {
            setTimeout(() => {
              showToast?.(
                `⚠️ Verifikasi TTD: ${incompleteSignatures.length} berkas terdeteksi belum lengkap tanda tangannya (${incompleteSignatures.map((x) => `${x.fpbNo}: kurang ${x.missing.join(', ')}`).join('; ')})`,
                'warning'
              );
            }, 1200);
          } else {
            setTimeout(() => {
              showToast?.('✅ Semua berkas PDF yang diunggah terverifikasi bertanda tangan lengkap & sah.', 'success');
            }, 1200);
          }

          if (outOfCycleList.length > 0) {
            setTimeout(() => {
              showToast?.(
                `⚠️ Aturan Siklus: ${outOfCycleList.length} berkas terdeteksi dari periode lampau (${outOfCycleList.map((x) => `${x.fpbNo}: ${x.originalBatch}, +${x.daysLate}hr`).join('; ')}). Berkas otomatis ditandai sebagai [Susulan / Late Entry].`,
                'warning'
              );
            }, 2400);
          }

          setSheetViewMode('active');
          fetchReviews();
        }
      } else {
        showToast?.('Tidak ada berkas PDF yang berhasil diekstrak.', 'warning');
      }
    } catch (err: any) {
      console.error('Error uploading PDF FPB batch:', err);
      showToast?.('Gagal memproses batch PDF: ' + err.message, 'error');
    } finally {
      setIsSyncing(false);
      if (e.target) e.target.value = '';
    }
  };

  // Handler Clean Sheet (Arsipkan Semua FPB Aktif)
  const handleExecuteCleanSheet = async () => {
    try {
      setIsCleaningSheet(true);
      const res = await fetch('/api/review-fpb', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'clean_sheet_archive',
          archivedBy: user?.name || user?.username || 'Administrator',
        }),
      });

      const json = await res.json();
      if (json.success) {
        showToast?.(
          json.message || 'Lembar kerja berhasil dibersihkan (Clean Sheet). Data lama aman tersimpan di riwayat arsip.',
          'success'
        );
        setIsCleanSheetModalOpen(false);
        setSheetViewMode('active');
        fetchReviews();
      } else {
        showToast?.(json.message || 'Gagal membersihkan lembar kerja.', 'error');
      }
    } catch (err: any) {
      showToast?.('Error saat clean sheet: ' + err.message, 'error');
    } finally {
      setIsCleaningSheet(false);
    }
  };

  // Handler Restore Record from Archive
  const handleRestoreFromArchive = async (fpbNos?: string[]) => {
    try {
      const res = await fetch('/api/review-fpb', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'restore_archive',
          fpbNos,
        }),
      });

      const json = await res.json();
      if (json.success) {
        showToast?.(json.message || 'Berkas FPB berhasil dikembalikan ke lembar aktif.', 'success');
        fetchReviews();
      } else {
        showToast?.(json.message || 'Gagal mengembalikan berkas.', 'error');
      }
    } catch (err: any) {
      showToast?.('Error saat restore arsip: ' + err.message, 'error');
    }
  };

  // ── SIKLUS MINGGUAN & BATAS CUT-OFF PP JUMAT PK 10:00 ──
  const cycleInfo = useMemo(() => {
    const now = nowDate;
    const currentYear = now.getFullYear();

    // Helper konversi angka ke Romawi (I, II, III, ..., LII)
    const toRoman = (num: number): string => {
      if (num <= 0) return 'I';
      const romanMap: [number, string][] = [
        [100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'],
        [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']
      ];
      let res = '';
      let n = num;
      for (const [val, sym] of romanMap) {
        while (n >= val) {
          res += sym;
          n -= val;
        }
      }
      return res || String(num);
    };

    // Hitung nomor minggu dalam setahun (1-52)
    const jan1 = new Date(currentYear, 0, 1);
    const dayOfYear = Math.floor((now.getTime() - jan1.getTime()) / (24 * 60 * 60 * 1000));
    const weekNumber = Math.ceil((dayOfYear + jan1.getDay() + 1) / 7);

    // Cari tahu berapa batch yang sudah diarsipkan pada TAHUN BERJALAN (currentYear)
    // Sesuai aturan siklus tahunan: batch di-reset setiap awal tahun baru (1 Januari)
    const existingBatchesThisYear = new Set<string>();
    let maxBatchNumberThisYear = 0;

    reviews.forEach((r) => {
      if (r.batchNo) {
        const yearMatch = r.batchNo.match(/(?:20\d{2})/);
        const batchYear = yearMatch ? parseInt(yearMatch[0], 10) : null;
        if (
          batchYear === currentYear ||
          (!batchYear && (r.archivedAt?.includes(String(currentYear)) || r.date?.includes(String(currentYear))))
        ) {
          existingBatchesThisYear.add(r.batchNo);
          const numMatch = r.batchNo.match(/[B\-_](\d+)/i) || r.batchNo.match(/Batch\s*(\d+)/i);
          if (numMatch) {
            const parsed = parseInt(numMatch[1], 10);
            if (!isNaN(parsed) && parsed > maxBatchNumberThisYear) {
              maxBatchNumberThisYear = parsed;
            }
          }
        }
      }
    });

    // Baseline untuk tahun 2026:
    // Batch I dan Batch II sudah pernah dilaksanakan sebelumnya, sehingga batch aktif saat ini adalah Batch III (B03).
    // Untuk tahun 2027 dan seterusnya, siklus otomatis di-reset mulai dari 1 (Batch I / B01).
    const baseOffset = currentYear === 2026 ? 2 : 0;
    const computedSeq = Math.max(existingBatchesThisYear.size + baseOffset + 1, maxBatchNumberThisYear + 1);
    const batchSeq = Math.max(currentYear === 2026 ? 3 : 1, computedSeq);

    const romanBatch = toRoman(batchSeq);
    const batchName = `Batch ${romanBatch} (Minggu ${weekNumber})`;
    const defaultBatchCode = `CPG-PP-${currentYear}-B${String(batchSeq).padStart(2, '0')}`;

    // Tentukan waktu cut-off Jumat jam 10:00:00
    const day = now.getDay(); // 0 = Minggu, 5 = Jumat
    const cutoff = new Date(now);
    cutoff.setHours(10, 0, 0, 0);

    let isPastCutoff = false;
    if (day === 5) {
      if (now.getTime() >= cutoff.getTime()) {
        isPastCutoff = true;
      }
    } else if (day > 5) {
      isPastCutoff = true;
    }

    const targetCutoff = new Date(cutoff);
    if (day === 5) {
      if (now.getTime() >= cutoff.getTime()) {
        targetCutoff.setDate(targetCutoff.getDate() + 7);
      }
    } else if (day < 5) {
      targetCutoff.setDate(targetCutoff.getDate() + (5 - day));
    } else {
      targetCutoff.setDate(targetCutoff.getDate() + 6);
    }

    const diffMs = targetCutoff.getTime() - now.getTime();
    const isApproaching = diffMs > 0 && diffMs <= 24 * 60 * 60 * 1000;

    const daysLeft = Math.floor(diffMs / (24 * 60 * 60 * 1000));
    const hoursLeft = Math.floor((diffMs % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
    const minsLeft = Math.floor((diffMs % (60 * 60 * 1000)) / (60 * 1000));

    let countdownFormatted = '';
    if (daysLeft > 0) {
      countdownFormatted = `${daysLeft} Hari ${hoursLeft} Jam ${minsLeft} Mnt`;
    } else if (hoursLeft > 0) {
      countdownFormatted = `${hoursLeft} Jam ${minsLeft} Mnt`;
    } else if (minsLeft > 0) {
      countdownFormatted = `${minsLeft} Menit`;
    } else {
      countdownFormatted = 'Kurang dari 1 menit';
    }

    const cutoffFormatted = targetCutoff.toLocaleDateString('id-ID', {
      weekday: 'long',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }) + ' pk 10:00 WITA';

    // Rangkuman FPB aktif yang telah disetujui masuk Purchase Planning
    const activeApprovedReviews = reviews.filter(
      (r) => !r.isArchived && (r.reviewStatus === 'APPROVED_PO' || (r.items && r.items.some((i) => i.decision === 'PO')))
    );

    let approvedItemsCount = 0;
    let approvedEstimatedBudget = 0;

    activeApprovedReviews.forEach((r) => {
      const poItems = (r.items || []).filter(
        (i) => i.decision === 'PO' || (r.reviewStatus === 'APPROVED_PO' && i.decision !== 'STOCK' && i.decision !== 'REJECT')
      );
      poItems.forEach((i) => {
        const qty = Number(i.qty) || 1;
        const totalStock = Number(i.stockAvailable) || (Number(i.stockSomber) || 0) + (Number(i.stockKariangau) || 0);
        const netQty = Math.max(0, qty - totalStock) || qty;
        const unitPrice = 750000;
        approvedItemsCount += 1;
        approvedEstimatedBudget += netQty * unitPrice;
      });
    });

    return {
      batchSeq,
      batchName,
      batchCode: defaultBatchCode,
      weekNumber,
      targetCutoff,
      cutoffFormatted,
      isApproaching,
      isPastCutoff,
      countdownFormatted,
      activeApprovedCount: activeApprovedReviews.length,
      approvedItemsCount,
      approvedEstimatedBudget,
      activeApprovedReviews,
    };
  }, [nowDate, reviews]);

  // Daftar batch yang ada di riwayat arsip
  const uniqueArchivedBatches = useMemo(() => {
    const setB = new Set<string>();
    reviews.forEach((r) => {
      if (r.isArchived && r.batchNo) {
        setB.add(r.batchNo);
      }
    });
    return Array.from(setB).sort();
  }, [reviews]);

  // Handler Ekspor Excel Resmi Purchase Planning Batch (.xlsx) Multi-Sheet Sesuai Standar Template CPG (3-Tab: SUMMARY, DETAIL, PETUNJUK)
  const handleDownloadBatchExcel = async (
    recordsToExport?: FpbReviewRecord[],
    customBatchLabel?: string,
    customBatchName?: string
  ) => {
    const targetRecords =
      recordsToExport && recordsToExport.length > 0
        ? recordsToExport
        : cycleInfo.activeApprovedReviews.length > 0
        ? cycleInfo.activeApprovedReviews
        : reviews.filter((r) => !r.isArchived);

    if (!targetRecords || targetRecords.length === 0) {
      showToast?.('Belum ada dokumen FPB yang disetujui untuk diterbitkan ke Excel Batch ini.', 'warning');
      return;
    }

    const batchCodeToUse = customBatchLabel || customBatchCode.trim() || cycleInfo.batchCode;
    const batchNameToUse = customBatchName || customBatchLabel || cycleInfo.batchName;

    try {
      showToast?.('Menyiapkan berkas Excel Purchase Planning resmi CPG (3 Tab & Analisa Audit)...', 'info');
      await downloadPurchasePlanningBatchExcel(targetRecords, batchCodeToUse, batchNameToUse);
      showToast?.(`✓ Berhasil mengunduh Excel Purchase Planning (${batchCodeToUse}) dengan format resmi 3 Tab!`, 'success');
    } catch (err: any) {
      console.error('Gagal generate batch excel:', err);
      showToast?.('Gagal mengunduh Excel Purchase Planning: ' + err.message, 'error');
    }
  };

  // Handler Finalisasi & Rilis Batch PP (Cut-Off Execution)
  const handleFinalizeBatch = async () => {
    setIsCleaningSheet(true);
    const batchCodeToUse = customBatchCode.trim() || cycleInfo.batchCode;
    try {
      const res = await fetch('/api/review-fpb', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'clean_sheet_archive',
          batchNo: batchCodeToUse,
          archivedBy: user?.name || user?.username || 'Administrator CPG',
        }),
      });
      const json = await res.json();
      if (json.success) {
        if (autoDownloadExcelOnFinalize) {
          handleDownloadBatchExcel(cycleInfo.activeApprovedReviews, batchCodeToUse);
        }
        await fetchReviews();
        setIsFinalizeBatchModalOpen(false);
        showToast?.(
          `Siklus ${batchCodeToUse} berhasil difinalisasi dan diterbitkan ke Purchase Planning! Lembar kerja baru siap digunakan.`,
          'success'
        );
      } else {
        showToast?.(json.message || 'Gagal memfinalisasi batch.', 'error');
      }
    } catch (err: any) {
      showToast?.(`Error finalisasi batch: ${err.message}`, 'error');
    } finally {
      setIsCleaningSheet(false);
    }
  };

  // Simpan FPB Baru Manual
  const handleCreateFpb = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFpbNo.trim()) {
      showToast?.('Nomor FPB wajib diisi.', 'warning');
      return;
    }

    try {
      setIsSyncing(true);
      const cleanNo = newFpbNo.trim();
      const nowIso = new Date().toISOString();

      const items: FpbItemReview[] = newItems
        .filter((it) => it.itemName.trim() !== '')
        .map((it, idx) => ({
          no: idx + 1,
          itemCode: '-',
          itemName: it.itemName.trim(),
          qty: Number(it.qty) || 1,
          unit: it.unit || 'PCS',
          description: it.description || '',
          priority: newPriority,
          stockAvailable: 0,
          stockStatus: 'OUT_OF_STOCK',
          decision: 'PO',
          notes: 'Dibuat secara mandiri',
        }));

      const newRecord: FpbReviewRecord = {
        id: `fpb-rev-${cleanNo}`,
        fpbNo: cleanNo,
        originalFpb: cleanNo,
        entity: newEntity,
        armada: newArmada.trim() || 'Armada Kapal',
        date: newDate.trim() || new Date().toLocaleDateString('id-ID'),
        purpose: newPurpose.trim() || 'Kebutuhan Operasional Armada',
        efpbStatus: 'Approved',
        isReceivedLogistik: true,
        pdfUrl: `/api/review-fpb/pdf?fpbNo=${encodeURIComponent(cleanNo)}&type=signed`,
        reviewStatus: 'PENDING_REVIEW',
        urgency: newUrgency,
        priorityLevel: newPriority,
        picPurchasing: '-',
        reviewNotes: 'Catatan pengajuan mandiri',
        items,
        duplicateAlerts: [],
        relatedDocs: { poNos: [], fstbNos: [], ttbNos: [] },
        createdAt: nowIso,
        updatedAt: nowIso,
      };

      const res = await fetch('/api/review-fpb', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'import_records',
          records: [newRecord],
        }),
      });

      const json = await res.json();
      if (json.success) {
        showToast?.(`Berkas FPB ${cleanNo} berhasil dicatat secara mandiri!`, 'success');
        setIsCreateModalOpen(false);
        setNewFpbNo('');
        setNewArmada('');
        setNewPurpose('');
        setNewItems([{ itemName: '', qty: 1, unit: 'PCS', description: '' }]);
        fetchReviews();
      } else {
        showToast?.(json.message || 'Gagal menyimpan FPB baru', 'error');
      }
    } catch (err: any) {
      showToast?.('Gagal menyimpan FPB: ' + err.message, 'error');
    } finally {
      setIsSyncing(false);
    }
  };

  // E-FPB Credentials & Sync Modal State
  const [isSyncModalOpen, setIsSyncModalOpen] = useState<boolean>(false);
  const [efpbUsername, setEfpbUsername] = useState<string>('Hermansyah');
  const [efpbPassword, setEfpbPassword] = useState<string>('Biocpl24!@#');
  const [efpbSessionId, setEfpbSessionId] = useState<string>('');
  const [efpbAuthMethod, setEfpbAuthMethod] = useState<'cookie' | 'account'>('cookie');
  const [authErrorMsg, setAuthErrorMsg] = useState<string | null>(null);

  // Handle Sync dengan data lokal/R2 mandiri
  const handleSyncEfpb = async (mode: 'quick' | 'full', customSessionId?: string) => {
    fetchReviews();
    showToast?.('Data pengajuan FPB berhasil diperbarui dari database mandiri.', 'success');
  };

  // Open Review Detail Modal
  const handleOpenReview = (rec: FpbReviewRecord) => {
    setSelectedRecord(rec);
    setFormStatus(rec.reviewStatus || 'PENDING_REVIEW');
    setFormUrgency(rec.urgency || 'NORMAL');
    setFormPriority(rec.priorityLevel || 'P3');
    setFormPic(rec.picPurchasing || '');
    setFormNotes(rec.reviewNotes || '');
    setFormIsReceivedLogistik(Boolean(rec.isReceivedLogistik));
    setFormItems(rec.items ? JSON.parse(JSON.stringify(rec.items)) : []);
    setFormAttachments(rec.attachments ? JSON.parse(JSON.stringify(rec.attachments)) : []);
    setSelectedAttachmentFile(null);
    setAttachmentCaption('');
    setActiveModalTab('items');
    const isApprovedInitial = Boolean(rec.isReceivedLogistik || rec.pchLogistik === 'Received_Logistic' || rec.pdfUrl?.includes('logistik_Approved_'));
    setPdfViewMode(isApprovedInitial ? 'signed' : 'raw');

    // Inisialisasi Kontak Pembuat e-FPB dari record / Awak & Armada
    setIsEditingPhone(false);
    const existingReq = (rec.requestedBy || '').trim();
    setFormRequestedBy(existingReq);

    const matched = findCrewOrArmadaContact(existingReq, rec.armada);
    const effectivePhone = rec.requesterPhone || matched.phone || '';
    setFormRequesterPhone(effectivePhone);
    setTempPhoneInput(effectivePhone);

    // Jika nama pembuat belum ada di record, fetch otomatis dari PDF parser
    if (!existingReq) {
      setIsFetchingRequester(true);
      fetch(`/api/parse-fpb-pdf?fpb=${encodeURIComponent(rec.fpbNo)}`)
        .then((res) => res.json())
        .then((json) => {
          if (json.success && json.data?.requestedBy) {
            const parsedName = json.data.requestedBy;
            setFormRequestedBy(parsedName);

            const newMatched = findCrewOrArmadaContact(parsedName, rec.armada);
            if (newMatched.phone && !rec.requesterPhone) {
              setFormRequesterPhone(newMatched.phone);
              setTempPhoneInput(newMatched.phone);
            }

            setSelectedRecord((prev) => (prev ? { ...prev, requestedBy: parsedName } : null));
            setReviews((prev) =>
              prev.map((r) => (r.fpbNo.toLowerCase() === rec.fpbNo.toLowerCase() ? { ...r, requestedBy: parsedName } : r))
            );
          }
        })
        .catch((err) => console.warn('Error fetching requester from PDF:', err))
        .finally(() => setIsFetchingRequester(false));
    }
  };

  // Upload New Attachment
  const handleUploadAttachment = async () => {
    if (!selectedRecord || !selectedAttachmentFile) {
      showToast?.('Pilih berkas foto/dokumen lampiran terlebih dahulu', 'warning');
      return;
    }
    setIsUploadingAttachment(true);
    try {
      const fd = new FormData();
      fd.append('action', 'upload_attachment');
      fd.append('fpbNo', selectedRecord.fpbNo);
      fd.append('caption', attachmentCaption.trim());
      fd.append('uploadedBy', user?.name || user?.username || 'Tim Review FPB');
      fd.append('source', 'REVIEWER_UPLOAD');
      fd.append('file', selectedAttachmentFile);

      const res = await fetch('/api/review-fpb', {
        method: 'POST',
        body: fd,
      });
      const data = await res.json();
      if (data.success && data.attachment) {
        const updatedAtts = [...formAttachments, data.attachment];
        setFormAttachments(updatedAtts);
        setReviews((prev) =>
          prev.map((r) =>
            r.fpbNo.toLowerCase() === selectedRecord.fpbNo.toLowerCase()
              ? { ...r, attachments: updatedAtts }
              : r
          )
        );
        setSelectedAttachmentFile(null);
        setAttachmentCaption('');
        showToast?.(data.message || 'Lampiran berhasil diunggah ke Cloud Storage!', 'success');
      } else {
        showToast?.(data.message || 'Gagal mengunggah lampiran', 'error');
      }
    } catch (err: any) {
      showToast?.(err.message || 'Gagal mengunggah lampiran', 'error');
    } finally {
      setIsUploadingAttachment(false);
    }
  };

  // Delete Attachment
  const handleDeleteAttachment = async (attachmentId: string) => {
    if (!selectedRecord) return;
    if (!confirm('Hapus berkas lampiran ini?')) return;
    try {
      const res = await fetch('/api/review-fpb', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'delete_attachment',
          fpbNo: selectedRecord.fpbNo,
          attachmentId,
        }),
      });
      const data = await res.json();
      if (data.success) {
        const updated = formAttachments.filter((a) => a.id !== attachmentId);
        setFormAttachments(updated);
        setReviews((prev) =>
          prev.map((r) =>
            r.fpbNo.toLowerCase() === selectedRecord.fpbNo.toLowerCase()
              ? { ...r, attachments: updated }
              : r
          )
        );
        showToast?.('Lampiran berhasil dihapus', 'info');
      }
    } catch (err: any) {
      showToast?.('Gagal menghapus berkas lampiran', 'error');
    }
  };

  // Sync / Verify Single FPB Attachments from e-FPB
  const [isSyncingAttachments, setIsSyncingAttachments] = useState<boolean>(false);
  const handleSyncEfpbAttachments = async () => {
    if (!selectedRecord) return;
    setIsSyncingAttachments(true);
    try {
      const res = await fetch('/api/review-fpb', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'sync_single_efpb_attachments',
          fpbNo: selectedRecord.fpbNo,
          originalFpb: selectedRecord.originalFpb,
        }),
      });
      const data = await res.json();
      if (data.success && Array.isArray(data.attachments)) {
        setFormAttachments(data.attachments);
        setReviews((prev) =>
          prev.map((r) =>
            r.fpbNo.toLowerCase() === selectedRecord.fpbNo.toLowerCase()
              ? { ...r, attachments: data.attachments }
              : r
          )
        );
        showToast?.(data.message || 'Lampiran berhasil disinkronkan dari e-FPB!', 'success');
      } else {
        showToast?.(data.message || 'Tidak ada lampiran terpisah dari e-FPB', 'info');
      }
    } catch (err: any) {
      showToast?.(err.message || 'Gagal menyinkronkan lampiran dari e-FPB', 'error');
    } finally {
      setIsSyncingAttachments(false);
    }
  };

  // Quick / Direct Logistics Approval (Received_Logistic) from Table or Modal
  const handleQuickApproveLogistic = async (
    rec: FpbReviewRecord,
    overrideState?: boolean,
    signerName?: string,
    sessionId?: string
  ) => {
    setIsApprovingLogistic(true);
    const newIsReceived = overrideState !== undefined ? overrideState : !rec.isReceivedLogistik;
    try {
      const effectiveSigner = signerName || user?.name || user?.username || 'NOOR HASANAH';
      const effectiveSession = sessionId !== undefined ? sessionId : efpbSessionId;
      if (sessionId && typeof window !== 'undefined') {
        localStorage.setItem('EFPB_SESSION_ID', sessionId);
        setEfpbSessionId(sessionId);
      }
      const res = await fetch('/api/review-fpb', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'approve_logistic',
          fpbNo: rec.fpbNo,
          isReceived: newIsReceived,
          approvedBy: effectiveSigner,
          sessionId: effectiveSession,
        }),
      });
      const data = await res.json();
      if (data.success && data.record) {
        setReviews((prev) =>
          prev.map((r) =>
            r.fpbNo.toLowerCase() === rec.fpbNo.toLowerCase()
              ? {
                  ...r,
                  isReceivedLogistik: newIsReceived,
                  pchLogistik: newIsReceived ? 'Received_Logistic' : '-',
                  pdfUrl: data.record.pdfUrl || r.pdfUrl,
                  reviewedBy: data.record.reviewedBy || r.reviewedBy,
                  reviewedAt: data.record.reviewedAt || r.reviewedAt,
                }
              : r
          )
        );
        if (selectedRecord && selectedRecord.fpbNo.toLowerCase() === rec.fpbNo.toLowerCase()) {
          setSelectedRecord((prev) =>
            prev
              ? {
                  ...prev,
                  isReceivedLogistik: newIsReceived,
                  pchLogistik: newIsReceived ? 'Received_Logistic' : '-',
                  pdfUrl: data.record.pdfUrl || prev.pdfUrl,
                  reviewedBy: data.record.reviewedBy || prev.reviewedBy,
                  reviewedAt: data.record.reviewedAt || prev.reviewedAt,
                }
              : null
          );
          setFormIsReceivedLogistik(newIsReceived);
          if (newIsReceived) {
            setPdfViewMode('signed');
          }
        }
        showToast?.(
          data.message ||
            (newIsReceived
              ? 'Dokumen berhasil disetujui Logistik & diteruskan ke Purchasing!'
              : 'Status persetujuan Logistik (Received_Logistic) dibatalkan.'),
          'success'
        );
      } else {
        showToast?.(data.message || 'Gagal mengubah status persetujuan logistik', 'error');
      }
    } catch (err: any) {
      showToast?.(err.message || 'Gagal mengubah status persetujuan logistik', 'error');
    } finally {
      setIsApprovingLogistic(false);
    }
  };

  // Close Modal
  const handleCloseModal = () => {
    setSelectedRecord(null);
  };

  // Trigger Parse PDF & Check Warehouse Stock
  const handleParsePdfItems = async () => {
    if (!selectedRecord) return;
    setIsParsingItems(true);
    try {
      const res = await fetch('/api/review-fpb', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'parse_items',
          fpbNo: selectedRecord.fpbNo,
        }),
      });
      const json = await res.json();
      if (json.success && Array.isArray(json.items)) {
        setFormItems(json.items);
        showToast?.(json.message || 'Item barang & keperluan berhasil diekstrak!', 'success');

        const updatedPurpose = json.purpose || selectedRecord.purpose;
        const updatedAlerts = Array.isArray(json.duplicateAlerts) ? json.duplicateAlerts : [];
        const updatedPriority = json.priorityLevel || formPriority;
        const updatedUrgency = json.urgency || formUrgency;
        const updatedRequestedBy = json.requestedBy || formRequestedBy;

        if (json.requestedBy) {
          setFormRequestedBy(json.requestedBy);
          const newMatched = findCrewOrArmadaContact(json.requestedBy, selectedRecord.armada);
          if (newMatched.phone && !formRequesterPhone) {
            setFormRequesterPhone(newMatched.phone);
            setTempPhoneInput(newMatched.phone);
          }
        }

        setSelectedRecord((prev) => {
          if (!prev) return null;
          return {
            ...prev,
            items: json.items,
            purpose: updatedPurpose,
            duplicateAlerts: updatedAlerts,
            priorityLevel: updatedPriority,
            urgency: updatedUrgency,
            requestedBy: updatedRequestedBy,
          };
        });

        // Update list tabel review
        setReviews((prevList) =>
          prevList.map((r) =>
            r.fpbNo.toLowerCase() === selectedRecord.fpbNo.toLowerCase()
              ? {
                  ...r,
                  items: json.items,
                  purpose: updatedPurpose,
                  duplicateAlerts: updatedAlerts,
                  priorityLevel: updatedPriority,
                  urgency: updatedUrgency,
                  requestedBy: updatedRequestedBy,
                }
              : r
          )
        );

        // Auto-detect skala prioritas dari item barang (P1: Utama 1-2 hari, P2: Menengah 3-14 hari, P3: Rutin 14-30 hari)
        let autoP: FpbPriorityLevel = 'P3';
        for (const it of json.items) {
          const p = (it.priority || '').toUpperCase().trim();
          if (p === 'P1' || p.includes('P1') || p.includes('EMERGENCY') || p.includes('DARURAT') || p.includes('URGENT') || p.includes('KRITIS')) {
            autoP = 'P1';
            break;
          } else if (p === 'P2' || p.includes('P2') || p.includes('URGENT') || p.includes('MENENGAH')) {
            autoP = 'P2';
          }
        }
        setFormPriority(autoP);
        if (autoP === 'P1') setFormUrgency('EMERGENCY');
        else if (autoP === 'P2') setFormUrgency('URGENT');

        // Automatically suggest status if all items are in stock
        const allInStock = json.items.every((it: FpbItemReview) => it.stockStatus === 'IN_STOCK');
        if (allInStock && formStatus === 'PENDING_REVIEW') {
          setFormStatus('FULFILL_STOCK');
        }
      } else {
        showToast?.(json.message || 'Gagal membaca isi PDF e-FPB.', 'warning');
      }
    } catch (err: any) {
      console.error('Error parsing PDF:', err);
      showToast?.('Gagal mengekstrak item PDF dari server.', 'error');
    } finally {
      setIsParsingItems(false);
    }
  };

  // Update a single item decision in form
  const handleUpdateItemDecision = (idx: number, decision: ItemDecision) => {
    setFormItems((prev) => {
      const updated = [...prev];
      updated[idx] = { ...updated[idx], decision };
      return updated;
    });
  };

  // Update a single item note in form
  const handleUpdateItemNote = (idx: number, notes: string) => {
    setFormItems((prev) => {
      const updated = [...prev];
      updated[idx] = { ...updated[idx], notes };
      return updated;
    });
  };

  // Kalkulasi statistik ketersediaan stok fisik gudang
  const stockStats = useMemo(() => {
    let inStock = 0;
    let partial = 0;
    let outOfStock = 0;
    formItems.forEach((item) => {
      if (item.stockStatus === 'IN_STOCK' || (item.stockAvailable && item.stockAvailable >= item.qty)) {
        inStock++;
      } else if (item.stockStatus === 'PARTIAL' || (item.stockAvailable && item.stockAvailable > 0)) {
        partial++;
      } else {
        outOfStock++;
      }
    });
    return {
      inStock,
      partial,
      outOfStock,
      total: formItems.length,
      hasAvailableStock: inStock > 0 || partial > 0,
      allInStock: inStock === formItems.length && formItems.length > 0,
    };
  }, [formItems]);

  // Helper: Terapkan rekomendasi cerdas alokasi stok vs PO secara otomatis
  const handleApplySmartStockAdvisory = () => {
    if (formItems.length === 0) return;

    const stockItemNames: string[] = [];
    const poItemNames: string[] = [];

    const updatedItems = formItems.map((item) => {
      const isAvail =
        item.stockStatus === 'IN_STOCK' ||
        (item.stockAvailable !== undefined && item.stockAvailable >= item.qty);

      if (isAvail) {
        stockItemNames.push(item.itemName);
        return {
          ...item,
          decision: 'STOCK' as ItemDecision,
          notes: item.notes || `Penuhi dari stok fisik gudang (${item.stockAvailable || item.qty} ${item.unit})`,
        };
      } else {
        poItemNames.push(item.itemName);
        return {
          ...item,
          decision: 'PO' as ItemDecision,
          notes:
            item.notes ||
            (item.stockStatus === 'PARTIAL'
              ? `Stok kurang ${item.qty - (item.stockAvailable || 0)} unit, buat PO sisa`
              : 'Stok kosong di gudang, buat PO pengadaan'),
        };
      }
    });

    setFormItems(updatedItems);

    if (stockItemNames.length > 0 && poItemNames.length === 0) {
      setFormStatus('FULFILL_STOCK');
      setFormNotes(
        (prev) =>
          prev ||
          `100% kebutuhan (${stockItemNames.length} item) tersedia di persediaan gudang. Dipenuhi langsung via TTB Mutasi Stok tanpa PO baru.`
      );
      showToast?.(
        `Semua item (${stockItemNames.length}) tersedia di gudang! Status diatur ke "Dipenuhi dari Stok Gudang".`,
        'success'
      );
    } else {
      setFormStatus('APPROVED_PO');
      const autoNote = `Alokasi Cerdas: ${stockItemNames.length} item dipenuhi dari stok fisik gudang (${stockItemNames.slice(0, 2).join(', ')}${
        stockItemNames.length > 2 ? ' dll' : ''
      }). Sisa ${poItemNames.length} item diterbitkan PO pengadaan oleh Purchasing.`;
      setFormNotes((prev) => prev || autoNote);
      showToast?.(
        `Advis diterapkan: ${stockItemNames.length} item penuhi stok gudang, ${poItemNames.length} item buat PO Purchasing!`,
        'success'
      );
    }
  };

  // Helper: Set semua item ke PO (Purchase Planning)
  const handleSetAllPo = () => {
    const updatedItems = formItems.map((item) => ({
      ...item,
      decision: 'PO' as ItemDecision,
    }));
    setFormItems(updatedItems);
    setFormStatus('APPROVED_PO');
    showToast?.('Semua item diatur untuk Purchase Planning (PO).', 'info');
  };

  // Save Review Decision to Cloud Storage
  const handleSaveDecision = async () => {
    if (!selectedRecord) return;
    setIsSavingDecision(true);
    try {
      const payload = {
        action: 'save_review',
        fpbNo: selectedRecord.fpbNo,
        reviewStatus: formStatus,
        urgency: formUrgency,
        priorityLevel: formPriority,
        picPurchasing: formPic,
        reviewNotes: formNotes,
        items: formItems,
        attachments: formAttachments,
        reviewedBy: user?.name || user?.username || 'Tim FPB',
        requestedBy: formRequestedBy || selectedRecord.requestedBy,
        requesterPhone: formRequesterPhone || selectedRecord.requesterPhone,
        isReceivedLogistik: formIsReceivedLogistik,
        pchLogistik: formIsReceivedLogistik ? 'Received_Logistic' : '-',
      };

      const res = await fetch('/api/review-fpb', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (json.success) {
        showToast?.(json.message || 'Keputusan review berhasil disimpan ke Cloud Storage!', 'success');
        // Sinkronkan kontak ke database Awak & Armada jika ada nomor
        if (formRequesterPhone && formRequestedBy) {
          syncCrewContact(formRequestedBy, formRequesterPhone, selectedRecord.armada);
        }

        // Update local state
        setReviews((prev) =>
          prev.map((r) =>
            r.fpbNo.toLowerCase() === selectedRecord.fpbNo.toLowerCase()
              ? {
                  ...r,
                  reviewStatus: formStatus,
                  tkbNo: json.tkbNo || json.record?.tkbNo || (formStatus === 'APPROVED_PO' ? r.tkbNo : undefined),
                  urgency: formUrgency,
                  priorityLevel: formPriority,
                  picPurchasing: formPic,
                  reviewNotes: formNotes,
                  items: formItems,
                  attachments: formAttachments,
                  requestedBy: formRequestedBy || selectedRecord.requestedBy,
                  requesterPhone: formRequesterPhone || selectedRecord.requesterPhone,
                  reviewedBy: user?.name || user?.username || 'Tim FPB',
                  reviewedAt: new Date().toISOString(),
                  isReceivedLogistik: formIsReceivedLogistik,
                  pchLogistik: formIsReceivedLogistik ? 'Received_Logistic' : '-',
                  updatedAt: new Date().toISOString(),
                }
              : r
          )
        );
        if (json.metrics) setMetrics(json.metrics);
        handleCloseModal();
        fetchReviews();
      } else {
        showToast?.(json.message || 'Gagal menyimpan keputusan review', 'error');
      }
    } catch (err: any) {
      console.error('Error saving decision:', err);
      showToast?.('Gagal menyimpan keputusan ke server', 'error');
    } finally {
      setIsSavingDecision(false);
    }
  };

  // Export filtered data to CSV
  const handleExportCsv = () => {
    if (filteredReviews.length === 0) {
      showToast?.('Tidak ada data untuk diekspor', 'warning');
      return;
    }

    const headers = [
      'No. FPB',
      'Entitas',
      'Skala Prioritas',
      'Target SLA',
      'Sisa Hari SLA',
      'Status SLA',
      'Armada / Dept',
      'Tanggal',
      'Peruntukan',
      'Status e-FPB',
      'Status Review Tim FPB',
      'Urgensi',
      'No. Agenda Planning',
      'PIC Purchasing',
      'Catatan Review',
      'Jumlah Item',
      'Item Tersedia di Stok',
      'Item Purchase Planning (PO)',
      'No. PO Terkait',
      'No. FSTB Terkait',
      'No. TTB Terkait',
    ];

    const rows = filteredReviews.map((r) => {
      const itemsCount = r.items ? r.items.length : 0;
      const inStockCount = r.items ? r.items.filter((i) => i.decision === 'STOCK').length : 0;
      const poCount = r.items ? r.items.filter((i) => i.decision === 'PO').length : 0;

      return [
        `"${r.fpbNo}"`,
        `"${r.entity}"`,
        `"${r.priorityLevel || 'P3'}"`,
        `"${r.slaTargetDate || '-'}"`,
        `"${r.slaDaysRemaining !== undefined ? r.slaDaysRemaining : '-'}"`,
        `"${r.slaStatus || '-'}"`,
        `"${r.armada}"`,
        `"${r.date}"`,
        `"${(r.purpose || '').replace(/"/g, '""')}"`,
        `"${r.efpbStatus}"`,
        `"${r.reviewStatus}"`,
        `"${r.urgency}"`,
        `"${r.tkbNo || '-'}"`,
        `"${r.picPurchasing || '-'}"`,
        `"${(r.reviewNotes || '').replace(/"/g, '""')}"`,
        itemsCount,
        inStockCount,
        poCount,
        `"${r.relatedDocs?.poNos?.join(', ') || '-'}"`,
        `"${r.relatedDocs?.fstbNos?.join(', ') || '-'}"`,
        `"${r.relatedDocs?.ttbNos?.join(', ') || '-'}"`,
      ].join(',');
    });

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Review_FPB_CPG_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    showToast?.('Data review FPB berhasil diekspor ke CSV!', 'success');
  };

  // Filtered Reviews Memo
  const filteredReviews = useMemo(() => {
    return reviews.filter((r) => {
      // 0. Sheet View Mode (Lembar Aktif vs Arsip Riwayat)
      if (sheetViewMode === 'active') {
        if (r.isArchived) return false;
      } else if (sheetViewMode === 'archived') {
        if (!r.isArchived) return false;
        if (archivedBatchFilter !== 'ALL' && (r.batchNo || 'NON-BATCH') !== archivedBatchFilter) {
          return false;
        }
      }

      // 1. Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const fpbMatch = r.fpbNo.toLowerCase().includes(q);
        const tkbMatch = (r.tkbNo || '').toLowerCase().includes(q);
        const armadaMatch = r.armada.toLowerCase().includes(q);
        const purposeMatch = (r.purpose || '').toLowerCase().includes(q);
        const picMatch = (r.picPurchasing || '').toLowerCase().includes(q);
        const notesMatch = (r.reviewNotes || '').toLowerCase().includes(q);
        const poMatch = r.relatedDocs?.poNos?.some((p) => p.toLowerCase().includes(q));
        if (!fpbMatch && !tkbMatch && !armadaMatch && !purposeMatch && !picMatch && !notesMatch && !poMatch) {
          return false;
        }
      }

      // 2. Entity Filter
      if (selectedEntity !== 'ALL' && r.entity.toUpperCase() !== selectedEntity) {
        return false;
      }

      // 3. Status Review Filter
      if (selectedStatus !== 'ALL' && r.reviewStatus !== selectedStatus) {
        return false;
      }

      // 4. Urgency Filter
      if (selectedUrgency !== 'ALL' && r.urgency !== selectedUrgency) {
        return false;
      }

      // 5. Priority Level Filter (P1, P2, P3, or OVERDUE)
      if (selectedPriority !== 'ALL') {
        if (selectedPriority === 'OVERDUE') {
          if (r.slaStatus !== 'OVERDUE') return false;
        } else if ((r.priorityLevel || 'P3') !== selectedPriority) {
          return false;
        }
      }

      // 6. Only Duplicates
      if (onlyDuplicates && (!r.duplicateAlerts || r.duplicateAlerts.length === 0)) {
        return false;
      }

      return true;
    });
  }, [reviews, sheetViewMode, archivedBatchFilter, searchQuery, selectedEntity, selectedStatus, selectedUrgency, selectedPriority, onlyDuplicates]);

  // Statistik Berkas Aktif vs Diarsipkan
  const activeCount = useMemo(() => reviews.filter((r) => !r.isArchived).length, [reviews]);
  const archivedCount = useMemo(() => reviews.filter((r) => Boolean(r.isArchived)).length, [reviews]);

  // Metrik KPI tersaring dinamis berdasarkan lembar/siklus yang sedang aktif dilihat pengguna
  // Menjamin jika sedang melihat Lembar Aktif, angka HANYA menghitung siklus berjalan (1 siklus saja)
  const currentViewMetrics = useMemo<FpbReviewSummaryMetrics>(() => {
    const targetRecords = reviews.filter((r) => {
      if (sheetViewMode === 'active') {
        return !r.isArchived;
      }
      if (sheetViewMode === 'archived') {
        if (!r.isArchived) return false;
        if (archivedBatchFilter !== 'ALL' && (r.batchNo || 'NON-BATCH') !== archivedBatchFilter) {
          return false;
        }
        return true;
      }
      // 'batch_summary': Tampilkan akumulasi seluruh siklus tahun berjalan
      return true;
    });

    let pending = 0;
    let approvedPo = 0;
    let fulfillStock = 0;
    let needClarification = 0;
    let rejected = 0;
    let urgent = 0;
    let emergency = 0;
    let p1Count = 0;
    let p2Count = 0;
    let p3Count = 0;
    let overdueCount = 0;

    targetRecords.forEach((r) => {
      if (r.reviewStatus === 'APPROVED_PO') approvedPo++;
      else if (r.reviewStatus === 'FULFILL_STOCK') fulfillStock++;
      else if (r.reviewStatus === 'NEED_CLARIFICATION') needClarification++;
      else if (r.reviewStatus === 'REJECTED') rejected++;
      else pending++;

      if (r.urgency === 'URGENT') urgent++;
      if (r.urgency === 'EMERGENCY') emergency++;

      const prio = r.priorityLevel || 'P3';
      if (prio === 'P1') p1Count++;
      else if (prio === 'P2') p2Count++;
      else p3Count++;

      if (r.slaStatus === 'OVERDUE') overdueCount++;
    });

    return {
      total: targetRecords.length,
      pending,
      approvedPo,
      fulfillStock,
      needClarification,
      rejected,
      urgent,
      emergency,
      p1Count,
      p2Count,
      p3Count,
      overdueCount,
    };
  }, [reviews, sheetViewMode, archivedBatchFilter]);

  // Data Matriks Rekapitulasi & Konklusi Per Batch Pengadaan
  const batchSummaryList = useMemo(() => {
    interface BatchSummaryItem {
      batchCode: string;
      batchName: string;
      cutoffLabel: string;
      isCurrentActive: boolean;
      records: FpbReviewRecord[];
      totalFpb: number;
      approvedPo: number;
      fulfillStock: number;
      pending: number;
      rejected: number;
      needClarification: number;
      totalItems: number;
      totalNetDemand: number;
      totalEstCost: number;
    }

    const map = new Map<string, BatchSummaryItem>();

    // 1. Inisialisasi Siklus Berjalan (Aktif)
    map.set(cycleInfo.batchCode, {
      batchCode: cycleInfo.batchCode,
      batchName: cycleInfo.batchName,
      cutoffLabel: cycleInfo.cutoffFormatted,
      isCurrentActive: true,
      records: [],
      totalFpb: 0,
      approvedPo: 0,
      fulfillStock: 0,
      pending: 0,
      rejected: 0,
      needClarification: 0,
      totalItems: 0,
      totalNetDemand: 0,
      totalEstCost: 0,
    });

    // 2. Inisialisasi batch historis standar
    map.set('CPG-PP-2026-B02', {
      batchCode: 'CPG-PP-2026-B02',
      batchName: 'Batch II (Minggu 46)',
      cutoffLabel: 'Jumat, 14 Nov 2026 pk 10:00 WITA',
      isCurrentActive: false,
      records: [],
      totalFpb: 0,
      approvedPo: 0,
      fulfillStock: 0,
      pending: 0,
      rejected: 0,
      needClarification: 0,
      totalItems: 0,
      totalNetDemand: 0,
      totalEstCost: 0,
    });

    map.set('CPG-PP-2026-B01', {
      batchCode: 'CPG-PP-2026-B01',
      batchName: 'Batch I (Minggu 45)',
      cutoffLabel: 'Jumat, 07 Nov 2026 pk 10:00 WITA',
      isCurrentActive: false,
      records: [],
      totalFpb: 0,
      approvedPo: 0,
      fulfillStock: 0,
      pending: 0,
      rejected: 0,
      needClarification: 0,
      totalItems: 0,
      totalNetDemand: 0,
      totalEstCost: 0,
    });

    // 3. Masukkan records ke batch masing-masing
    reviews.forEach((r) => {
      let bCode = r.batchNo;
      if (!bCode) {
        bCode = r.isArchived ? 'CPG-PP-2026-B01' : cycleInfo.batchCode;
      }

      let entry = map.get(bCode);
      if (!entry) {
        entry = {
          batchCode: bCode,
          batchName: bCode,
          cutoffLabel: 'Siklus Pengadaan',
          isCurrentActive: !r.isArchived,
          records: [],
          totalFpb: 0,
          approvedPo: 0,
          fulfillStock: 0,
          pending: 0,
          rejected: 0,
          needClarification: 0,
          totalItems: 0,
          totalNetDemand: 0,
          totalEstCost: 0,
        };
        map.set(bCode, entry);
      }

      entry.records.push(r);
      entry.totalFpb++;
      if (r.reviewStatus === 'APPROVED_PO') entry.approvedPo++;
      else if (r.reviewStatus === 'FULFILL_STOCK') entry.fulfillStock++;
      else if (r.reviewStatus === 'REJECTED') entry.rejected++;
      else if (r.reviewStatus === 'NEED_CLARIFICATION') entry.needClarification++;
      else entry.pending++;

      (r.items || []).forEach((it) => {
        entry!.totalItems++;
        const req = Number(it.qty) || 1;
        const s1 = Number(it.stockSomber) || Number(it.stockAvailable) || 0;
        const s2 = Number(it.stockKariangau) || 0;
        const net = Math.max(0, req - (s1 + s2));
        entry!.totalNetDemand += net > 0 ? net : req;
        entry!.totalEstCost += (net > 0 ? net : req) * 750000;
      });
    });

    return Array.from(map.values()).sort((a, b) => b.batchCode.localeCompare(a.batchCode));
  }, [reviews, cycleInfo]);

  // Helper Priority Badge
  const getPriorityBadge = (priority?: FpbPriorityLevel) => {
    switch (priority) {
      case 'P1':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-rose-600 text-white shadow-xs">
            <AlertOctagon className="size-3" />
            P1 (Utama: 1-2 Hari)
          </span>
        );
      case 'P2':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30">
            <AlertTriangle className="size-3" />
            P2 (Menengah: 3-14 Hari)
          </span>
        );
      case 'P3':
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-blue-500/10 text-blue-700 dark:text-blue-300 border border-blue-500/20">
            <Clock className="size-3" />
            P3 (Rutin: 14-30 Hari)
          </span>
        );
    }
  };

  // Helper SLA Badge
  const getSlaBadge = (rec: FpbReviewRecord) => {
    if (!rec.slaTargetDate) return null;
    const isOverdue = rec.slaStatus === 'OVERDUE';
    const isDueSoon = rec.slaStatus === 'DUE_SOON';

    return (
      <div className="flex flex-col text-[10px] leading-tight mt-0.5">
        <span className={isOverdue ? 'font-bold text-rose-600 dark:text-rose-400' : isDueSoon ? 'font-semibold text-amber-600 dark:text-amber-400' : 'text-muted-foreground'}>
          {isOverdue
            ? `⚠️ Lewat SLA (${Math.abs(rec.slaDaysRemaining || 0)} hr)`
            : isDueSoon
            ? `⏳ Sisa ${rec.slaDaysRemaining} hari`
            : `Sisa ${rec.slaDaysRemaining} hari`}
        </span>
        <span className="text-[9px] text-muted-foreground opacity-80">
          Target: {rec.slaTargetDate}
        </span>
      </div>
    );
  };

  // Helper badge styles
  const getReviewStatusBadge = (status: FpbReviewStatus) => {
    switch (status) {
      case 'APPROVED_PO':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
            <CheckCircle2 className="size-3.5" />
            Disetujui Masuk Purchase Planning
          </span>
        );
      case 'FULFILL_STOCK':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20">
            <PackageCheck className="size-3.5" />
            Penuhi dari Stok
          </span>
        );
      case 'NEED_CLARIFICATION':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
            <HelpCircle className="size-3.5" />
            Perlu Klarifikasi
          </span>
        );
      case 'REJECTED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
            <XCircle className="size-3.5" />
            Ditolak
          </span>
        );
      case 'PENDING_REVIEW':
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
            <Clock className="size-3.5" />
            Menunggu Analisa
          </span>
        );
    }
  };

  const getUrgencyBadge = (urgency: FpbUrgency) => {
    switch (urgency) {
      case 'EMERGENCY':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-rose-500 text-white animate-pulse shadow-xs">
            <AlertOctagon className="size-3" />
            EMERGENCY
          </span>
        );
      case 'URGENT':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30">
            <AlertTriangle className="size-3" />
            URGENT
          </span>
        );
      case 'NORMAL':
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-muted text-muted-foreground border border-border">
            Normal
          </span>
        );
    }
  };

  // Helper: Ikon Armada/Departemen Dinamis (Truk/Darat, Gedung/Kantor/Site, Kapal/Marine)
  const renderArmadaIcon = (armadaName?: string) => {
    const name = (armadaName || '').toUpperCase();
    if (
      name.includes('TRUCK') ||
      name.includes('TANKI') ||
      name.includes('MOBIL') ||
      name.includes('KENDARAAN') ||
      /\bKT\s*\d+/i.test(name)
    ) {
      return <Truck className="size-3.5 text-blue-600 dark:text-blue-400 shrink-0" />;
    }
    if (
      name.includes('OFFICE') ||
      name.includes('SITE') ||
      name.includes('DEPT') ||
      name.includes('DEPARTEMENT') ||
      name.includes('WORKSHOP') ||
      name.includes('GUDANG') ||
      name.includes('DEPO') ||
      name.includes('MUSHOLLA') ||
      name.includes('POS') ||
      name.includes('MESS')
    ) {
      return <Building2 className="size-3.5 text-amber-600 dark:text-amber-400 shrink-0" />;
    }
    return <Ship className="size-3.5 text-cyan-600 dark:text-cyan-400 shrink-0" />;
  };

  const getEntityBadge = (entity: string) => {
    const ent = (entity || 'CPL').toUpperCase();
    let bg = 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20';
    if (ent === 'MO') bg = 'bg-teal-500/10 text-teal-600 dark:text-teal-400 border-teal-500/20';
    if (ent === 'GAJ') bg = 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20';
    if (ent === 'HL') bg = 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20';
    if (ent === 'SP') bg = 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20';

    return (
      <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold border ${bg}`}>
        {ent}
      </span>
    );
  };

  return (
    <div className="space-y-6 animate-in fade-in-50 duration-200">
      {/* ======================================================== */}
      {/* 1. Header & Actions Hub (Mode Mandiri)                    */}
      {/* ======================================================== */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 rounded-2xl bg-card border border-border shadow-xs">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-primary/10 text-primary">
              <ClipboardCheck className="size-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-xl font-bold tracking-tight text-foreground">
                  Review &amp; Analisa FPB
                </h2>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                  <ShieldCheck className="size-3.5" />
                  <span>Terintegrasi &bull; Real-Time</span>
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Pusat review FPB armada, analisa ketersediaan stok gudang master persediaan, deteksi duplikasi, dan disposisi logistik secara terintegrasi.
              </p>
            </div>
          </div>
        </div>

        {/* Hidden File Inputs untuk Import Mandiri */}
        <input
          type="file"
          ref={excelInputRef}
          onChange={handleFileUpload}
          accept=".xlsx,.xls,.csv"
          className="hidden"
        />
        <input
          type="file"
          ref={pdfInputRef}
          onChange={handlePdfUpload}
          accept=".pdf"
          multiple
          className="hidden"
        />

        {/* Action Buttons Mandiri */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Refresh Data Internal */}
          <button
            type="button"
            onClick={fetchReviews}
            disabled={isLoading || isSyncing}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-xl border border-border bg-background hover:bg-muted text-foreground transition shadow-2xs cursor-pointer disabled:opacity-50"
            title="Refresh data dari database lokal & Cloud Storage"
          >
            <RefreshCw className={`size-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </button>

          {/* Export Data ke CSV */}
          <button
            type="button"
            onClick={handleExportCsv}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-xl border border-border bg-background hover:bg-muted text-foreground transition shadow-2xs cursor-pointer"
            title="Ekspor daftar review ke CSV"
          >
            <Download className="size-3.5 text-muted-foreground" />
            Export CSV
          </button>

          {/* Import File Excel / CSV Hasil Download e-FPB */}
          <button
            type="button"
            onClick={() => excelInputRef.current?.click()}
            disabled={isSyncing}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/20 transition shadow-2xs cursor-pointer disabled:opacity-50"
            title="Unggah file ekspor Excel/CSV dari e-FPB atau Accurate secara mandiri"
          >
            <FileSpreadsheet className="size-4 text-emerald-600 dark:text-emerald-400" />
            <span>Import Excel / CSV</span>
          </button>

          {/* Upload File PDF FPB Fisik (Multi-Upload) */}
          <button
            type="button"
            onClick={() => pdfInputRef.current?.click()}
            disabled={isSyncing}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl border border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-300 hover:bg-sky-500/20 transition shadow-2xs cursor-pointer disabled:opacity-50"
            title="Unggah satu atau banyak berkas PDF FPB sekaligus (Multi-Select) untuk diekstrak otomatis"
          >
            <Upload className="size-4 text-sky-600 dark:text-sky-400" />
            <span>Upload PDF FPB (Multi)</span>
          </button>

          {/* Tombol Clean Sheet & Arsip (Always visible di bilah aksi) */}
          <button
            type="button"
            onClick={() => {
              if (!isAdmin) {
                showToast?.('Akses terbatas: Fitur Clean Sheet hanya dapat diakses oleh Administrator & Tim Pengadaan.', 'warning');
                return;
              }
              setIsCleanSheetModalOpen(true);
            }}
            disabled={activeCount === 0 || isSyncing}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl border border-amber-500/40 bg-amber-500/15 text-amber-800 dark:text-amber-200 hover:bg-amber-500/25 transition shadow-2xs cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            title={
              activeCount === 0
                ? 'Lembar aktif saat ini sudah bersih (tidak ada berkas aktif untuk diarsipkan)'
                : 'Arsipkan seluruh berkas FPB saat ini ke riwayat database & buat lembar bersih (Clean Sheet)'
            }
          >
            <Archive className="size-4 text-amber-600 dark:text-amber-400" />
            <span>Arsipkan &amp; Clean Sheet</span>
          </button>

          {/* Tombol Input Manual Mandiri */}
          <button
            type="button"
            onClick={() => setIsCreateModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 transition shadow-xs cursor-pointer"
            title="Catat pengajuan FPB baru secara manual (misal permintaan mendadak dari kapal via WhatsApp)"
          >
            <Plus className="size-4" />
            <span>Catat FPB Baru</span>
          </button>
        </div>
      </div>

      {/* ── WIDGET SIKLUS MINGGUAN & BATAS CUT-OFF PP (JUMAT PK 10:00) ── */}
      <div className="p-4 rounded-2xl border border-border bg-gradient-to-r from-card via-card to-muted/30 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        {/* Kolom Kiri: Info Siklus, Countdown, & Status */}
        <div className="space-y-1.5 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-sky-500/10 text-sky-700 dark:text-sky-300 border border-sky-500/25">
              <Timer className="size-3.5 text-sky-600 dark:text-sky-400" />
              <span>Siklus Mingguan: {cycleInfo.batchName}</span>
            </span>

            {cycleInfo.isPastCutoff ? (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-500/15 text-rose-700 dark:text-rose-300 border border-rose-500/30">
                <span className="size-2 rounded-full bg-rose-500 animate-pulse" />
                <span>Batas Cut-off Tercapai (Siap Terbit PP)</span>
              </span>
            ) : cycleInfo.isApproaching ? (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30">
                <span className="size-2 rounded-full bg-amber-500 animate-pulse" />
                <span>⚠️ &lt; 24 Jam Menuju Cut-off</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
                <span className="size-2 rounded-full bg-emerald-500" />
                <span>Siklus Berjalan (Aktif)</span>
              </span>
            )}

            <span className="text-[11px] font-mono text-muted-foreground bg-muted px-2 py-0.5 rounded">
              Ref: {cycleInfo.batchCode}
            </span>
          </div>

          <div className="flex items-baseline gap-3 flex-wrap">
            <div className="text-sm sm:text-base font-extrabold text-foreground flex items-center gap-1.5">
              <Clock className="size-4 text-primary shrink-0" />
              <span>Cut-Off: {cycleInfo.cutoffFormatted}</span>
            </div>
            <div className="text-xs font-semibold text-muted-foreground">
              Sisa Waktu: <strong className="text-primary font-mono">{cycleInfo.countdownFormatted}</strong>
            </div>
          </div>

          <p className="text-[11px] text-muted-foreground">
            Semua pengajuan FPB yang disetujui sebelum cut-off Jumat pk 10:00 dikonsolidasikan ke dalam 1 siklus Purchase Planning ({cycleInfo.batchName}). Berkas yang disetujui lewat dari batas waktu otomatis dialihkan ke siklus minggu berikutnya.
          </p>
        </div>

        {/* Kolom Kanan: Statistik Akumulasi & Tombol Aksi */}
        <div className="flex flex-col sm:flex-row lg:flex-col items-start sm:items-center lg:items-end justify-between gap-3 shrink-0 pt-2 lg:pt-0 border-t lg:border-t-0 border-border/60">
          {/* Akumulasi Item Terkonfirmasi */}
          <div className="flex items-center gap-3 text-xs bg-muted/50 px-3 py-1.5 rounded-xl border border-border">
            <div className="text-left sm:text-right">
              <span className="text-[10px] text-muted-foreground block">Akumulasi Siklus Ini:</span>
              <span className="font-bold text-foreground">
                <strong className="text-emerald-600 dark:text-emerald-400">{cycleInfo.activeApprovedCount} FPB Disetujui</strong> &bull; {cycleInfo.approvedItemsCount} Item Material
              </span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Download Excel Batch */}
            <button
              type="button"
              onClick={() => handleDownloadBatchExcel()}
              disabled={cycleInfo.activeApprovedCount === 0}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-xl border border-emerald-500/40 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white shadow-2xs transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              title="Unduh rekap resmi berkas Excel (.xlsx) Multi-Sheet untuk seluruh kebutuhan material siklus batch ini"
            >
              <FileSpreadsheet className="size-3.5" />
              <span>Download Excel Batch PP (.xlsx)</span>
            </button>

            {/* Finalisasi & Terbitkan Batch */}
            {isAdmin && (
              <button
                type="button"
                onClick={() => {
                  setCustomBatchCode(cycleInfo.batchCode);
                  setIsFinalizeBatchModalOpen(true);
                }}
                disabled={cycleInfo.activeApprovedCount === 0 || isCleaningSheet}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-xl border border-indigo-500/40 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white shadow-2xs transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                title="Kunci siklus ini, terbitkan nomor batch resmi ke Purchase Planning, dan bersihkan lembar kerja aktif untuk siklus berikutnya"
              >
                <Lock className="size-3.5" />
                <span>Finalisasi &amp; Terbitkan Batch</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Toggle Lembar Aktif vs Arsip Riwayat FPB vs Rekap Per Batch */}
      <div className="flex items-center justify-between flex-wrap gap-2 pt-1">
        <div className="flex items-center p-1 rounded-xl bg-muted border border-border text-xs gap-1">
          <button
            type="button"
            onClick={() => setSheetViewMode('active')}
            className={`px-3.5 py-1.5 rounded-lg font-semibold transition cursor-pointer flex items-center gap-1.5 ${
              sheetViewMode === 'active'
                ? 'bg-card text-foreground shadow-xs font-bold'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Sparkles className="size-3.5 text-primary" />
            <span>Siklus Aktif: {cycleInfo.batchName} ({activeCount})</span>
          </button>
          <button
            type="button"
            onClick={() => setSheetViewMode('archived')}
            className={`px-3.5 py-1.5 rounded-lg font-semibold transition cursor-pointer flex items-center gap-1.5 ${
              sheetViewMode === 'archived'
                ? 'bg-card text-foreground shadow-xs font-bold'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Archive className="size-3.5 text-amber-600" />
            <span>Arsip Riwayat ({archivedCount})</span>
          </button>
          <button
            type="button"
            onClick={() => setSheetViewMode('batch_summary')}
            className={`px-3.5 py-1.5 rounded-lg font-semibold transition cursor-pointer flex items-center gap-1.5 ${
              sheetViewMode === 'batch_summary'
                ? 'bg-card text-indigo-600 dark:text-indigo-400 shadow-xs font-bold'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <BarChart3 className="size-3.5 text-indigo-500" />
            <span>Rekap &amp; Konklusi Per Batch</span>
          </button>
        </div>

        {sheetViewMode === 'archived' && (
          <div className="flex items-center gap-2 text-xs flex-wrap">
            <span className="text-muted-foreground text-[11px]">
              Filter Batch Riwayat:
            </span>

            {/* Filter Dropdown Batch */}
            <select
              value={archivedBatchFilter}
              onChange={(e) => setArchivedBatchFilter(e.target.value)}
              className="text-xs px-2.5 py-1 rounded-lg bg-background border border-border text-foreground font-semibold cursor-pointer shadow-2xs"
            >
              <option value="ALL">Semua Batch Riwayat ({archivedCount})</option>
              {uniqueArchivedBatches.map((b) => {
                const countInB = reviews.filter((r) => r.isArchived && r.batchNo === b).length;
                return (
                  <option key={b} value={b}>
                    📦 {b} ({countInB} FPB)
                  </option>
                );
              })}
            </select>

            {/* Tombol Unduh Excel untuk Batch Terpilih di Arsip */}
            {archivedBatchFilter !== 'ALL' && (
              <button
                type="button"
                onClick={() => {
                  const batchRecords = reviews.filter((r) => r.isArchived && r.batchNo === archivedBatchFilter);
                  handleDownloadBatchExcel(batchRecords, archivedBatchFilter);
                }}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 text-xs font-bold transition cursor-pointer shadow-2xs"
                title={`Unduh berkas Excel untuk arsip ${archivedBatchFilter}`}
              >
                <FileSpreadsheet className="size-3 text-emerald-600 dark:text-emerald-400" />
                <span>Unduh Excel {archivedBatchFilter}</span>
              </button>
            )}

            {isAdmin && archivedCount > 0 && (
              <button
                type="button"
                onClick={() => {
                  if (confirm('Kembalikan seluruh berkas dari arsip ke lembar aktif?')) {
                    handleRestoreFromArchive();
                  }
                }}
                className="px-2.5 py-1 rounded-lg border border-border bg-background hover:bg-muted text-foreground text-xs font-medium inline-flex items-center gap-1 cursor-pointer"
                title="Pulihkan seluruh berkas arsip kembali ke lembar aktif"
              >
                <RotateCcw className="size-3 text-sky-600" />
                <span>Pulihkan Semua</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Label Konteks Indikator KPI */}
      <div className="flex items-center justify-between text-xs px-1">
        <div className="flex items-center gap-2">
          {sheetViewMode === 'active' ? (
            <span className="font-bold text-foreground flex items-center gap-1.5">
              <Sparkles className="size-3.5 text-primary" />
              Indikator Siklus Berjalan: <span className="text-primary">{cycleInfo.batchName}</span> ({currentViewMetrics.total} Dokumen FPB)
            </span>
          ) : sheetViewMode === 'archived' ? (
            <span className="font-bold text-foreground flex items-center gap-1.5">
              <Archive className="size-3.5 text-amber-600" />
              Indikator Arsip Riwayat: <span className="text-amber-600">{archivedBatchFilter === 'ALL' ? 'Semua Batch Selesai' : archivedBatchFilter}</span> ({currentViewMetrics.total} Dokumen FPB)
            </span>
          ) : (
            <span className="font-bold text-foreground flex items-center gap-1.5">
              <BarChart3 className="size-3.5 text-indigo-500" />
              Akumulasi Realisasi Tahunan 2026: <span className="text-indigo-600 dark:text-indigo-400">Seluruh Batch Pengadaan</span> ({reviews.length} Dokumen FPB)
            </span>
          )}
        </div>
        <span className="text-[11px] text-muted-foreground hidden sm:inline">
          {sheetViewMode === 'active'
            ? 'Metrik difilter khusus untuk siklus aktif saat ini'
            : sheetViewMode === 'archived'
            ? 'Metrik dokumen yang telah difinalisasi & diarsipkan'
            : 'Akumulasi menyeluruh lintas siklus'}
        </span>
      </div>

      {/* ======================================================== */}
      {/* 2. Top Summary KPI Cards: Prioritas & Disposisi FPB      */}
      {/* ======================================================== */}
      <div className="space-y-3">
        {/* Row 1: Skala Prioritas & SLA Lead Time Pengadaan */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {/* P1: Utama (1-2 Hari) */}
          <div
            onClick={() => setSelectedPriority(selectedPriority === 'P1' ? 'ALL' : 'P1')}
            className={`p-4 rounded-xl border transition cursor-pointer ${
              selectedPriority === 'P1'
                ? 'bg-rose-500/15 border-rose-500 shadow-sm ring-2 ring-rose-500/20'
                : 'bg-card border-border hover:border-rose-500/40 shadow-xs'
            }`}
          >
            <div className="flex items-center justify-between text-rose-600 dark:text-rose-400 mb-1.5">
              <span className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5">
                <AlertOctagon className="size-4 text-rose-500" />
                P1 - Utama
              </span>
              <span className="text-[10px] px-1.5 py-0.5 rounded font-bold bg-rose-500/10 border border-rose-500/30">
                1 - 2 Hari
              </span>
            </div>
            <div className="text-2xl font-bold text-rose-600 dark:text-rose-400">{currentViewMetrics.p1Count}</div>
            <div className="text-[11px] text-muted-foreground mt-0.5">Darurat / Kritis breakdown armada</div>
          </div>

          {/* P2: Menengah (3-14 Hari) */}
          <div
            onClick={() => setSelectedPriority(selectedPriority === 'P2' ? 'ALL' : 'P2')}
            className={`p-4 rounded-xl border transition cursor-pointer ${
              selectedPriority === 'P2'
                ? 'bg-amber-500/15 border-amber-500 shadow-sm ring-2 ring-amber-500/20'
                : 'bg-card border-border hover:border-amber-500/40 shadow-xs'
            }`}
          >
            <div className="flex items-center justify-between text-amber-600 dark:text-amber-400 mb-1.5">
              <span className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5">
                <AlertTriangle className="size-4 text-amber-500" />
                P2 - Menengah
              </span>
              <span className="text-[10px] px-1.5 py-0.5 rounded font-semibold bg-amber-500/10 border border-amber-500/30">
                3 - 14 Hari
              </span>
            </div>
            <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">{currentViewMetrics.p2Count}</div>
            <div className="text-[11px] text-muted-foreground mt-0.5">Pemeliharaan & operasional terjadwal</div>
          </div>

          {/* P3: Rutin (14-30 Hari) */}
          <div
            onClick={() => setSelectedPriority(selectedPriority === 'P3' ? 'ALL' : 'P3')}
            className={`p-4 rounded-xl border transition cursor-pointer ${
              selectedPriority === 'P3'
                ? 'bg-blue-500/15 border-blue-500 shadow-sm ring-2 ring-blue-500/20'
                : 'bg-card border-border hover:border-blue-500/40 shadow-xs'
            }`}
          >
            <div className="flex items-center justify-between text-blue-600 dark:text-blue-400 mb-1.5">
              <span className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5">
                <Clock className="size-4 text-blue-500" />
                P3 - Rutin
              </span>
              <span className="text-[10px] px-1.5 py-0.5 rounded font-medium bg-blue-500/10 border border-blue-500/30">
                14 - 30 Hari
              </span>
            </div>
            <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{currentViewMetrics.p3Count}</div>
            <div className="text-[11px] text-muted-foreground mt-0.5">Buffer stok cadangan gudang</div>
          </div>

          {/* Lewat Batas SLA */}
          <div
            onClick={() => setSelectedPriority(selectedPriority === 'OVERDUE' ? 'ALL' : 'OVERDUE')}
            className={`p-4 rounded-xl border transition cursor-pointer ${
              selectedPriority === 'OVERDUE'
                ? 'bg-rose-500/15 border-rose-500 shadow-sm ring-2 ring-rose-500/20'
                : currentViewMetrics.overdueCount > 0
                ? 'bg-card border-rose-500/30 hover:border-rose-500 shadow-xs'
                : 'bg-card border-border hover:border-border/80 shadow-xs'
            }`}
          >
            <div className="flex items-center justify-between text-rose-600 dark:text-rose-400 mb-1.5">
              <span className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5">
                <Timer className="size-4 text-rose-500" />
                Lewat Batas SLA
              </span>
              {currentViewMetrics.overdueCount > 0 && (
                <span className="text-[10px] px-1.5 py-0.5 rounded font-bold bg-rose-600 text-white animate-pulse">
                  Perlu Tindakan
                </span>
              )}
            </div>
            <div className="text-2xl font-bold text-rose-600 dark:text-rose-400">{currentViewMetrics.overdueCount}</div>
            <div className="text-[11px] text-muted-foreground mt-0.5">Melebihi target lead time pengadaan</div>
          </div>
        </div>

        {/* Row 2: Status Disposisi Analisa Tim FPB */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {/* Total FPB */}
          <div
            onClick={() => {
              setSelectedStatus('ALL');
              setSelectedPriority('ALL');
              setSelectedEntity('ALL');
            }}
            className="p-3.5 rounded-xl bg-card border border-border shadow-xs hover:border-primary/40 transition cursor-pointer"
            title="Klik untuk reset semua filter"
          >
            <div className="flex items-center justify-between text-muted-foreground mb-1">
              <span className="text-xs font-medium">Total FPB</span>
              <Layers className="size-4 text-blue-500" />
            </div>
            <div className="text-xl font-bold text-foreground">{currentViewMetrics.total}</div>
            <div className="text-[10px] text-muted-foreground">Berkas terdata</div>
          </div>

          {/* Menunggu Analisa */}
          <div
            onClick={() => setSelectedStatus(selectedStatus === 'PENDING_REVIEW' ? 'ALL' : 'PENDING_REVIEW')}
            className={`p-3.5 rounded-xl border transition cursor-pointer ${
              selectedStatus === 'PENDING_REVIEW'
                ? 'bg-amber-500/15 border-amber-500 shadow-xs'
                : 'bg-card border-amber-500/20 hover:border-amber-500/40 shadow-xs'
            }`}
          >
            <div className="flex items-center justify-between text-amber-600 dark:text-amber-400 mb-1">
              <span className="text-xs font-medium">Menunggu Analisa</span>
              <Clock className="size-4 text-amber-500" />
            </div>
            <div className="text-xl font-bold text-amber-600 dark:text-amber-400">{currentViewMetrics.pending}</div>
            <div className="text-[10px] text-muted-foreground">Perlu review tim</div>
          </div>

          {/* Disetujui Masuk Purchase Planning */}
          <div
            onClick={() => setSelectedStatus(selectedStatus === 'APPROVED_PO' ? 'ALL' : 'APPROVED_PO')}
            className={`p-3.5 rounded-xl border transition cursor-pointer ${
              selectedStatus === 'APPROVED_PO'
                ? 'bg-emerald-500/15 border-emerald-500 shadow-xs'
                : 'bg-card border-emerald-500/20 hover:border-emerald-500/40 shadow-xs'
            }`}
          >
            <div className="flex items-center justify-between text-emerald-600 dark:text-emerald-400 mb-1">
              <span className="text-xs font-medium">Purchase Planning</span>
              <FileCheck className="size-4 text-emerald-500" />
            </div>
            <div className="text-xl font-bold text-emerald-600 dark:text-emerald-400">{currentViewMetrics.approvedPo}</div>
            <div className="text-[10px] text-muted-foreground">Masuk perencanaan</div>
          </div>

          {/* Penuhi dari Stok */}
          <div
            onClick={() => setSelectedStatus(selectedStatus === 'FULFILL_STOCK' ? 'ALL' : 'FULFILL_STOCK')}
            className={`p-3.5 rounded-xl border transition cursor-pointer ${
              selectedStatus === 'FULFILL_STOCK'
                ? 'bg-cyan-500/15 border-cyan-500 shadow-xs'
                : 'bg-card border-cyan-500/20 hover:border-cyan-500/40 shadow-xs'
            }`}
          >
            <div className="flex items-center justify-between text-cyan-600 dark:text-cyan-400 mb-1">
              <span className="text-xs font-medium">Stok Gudang</span>
              <PackageCheck className="size-4 text-cyan-500" />
            </div>
            <div className="text-xl font-bold text-cyan-600 dark:text-cyan-400">{currentViewMetrics.fulfillStock}</div>
            <div className="text-[10px] text-muted-foreground">Cukup persediaan</div>
          </div>

          {/* Perlu Klarifikasi */}
          <div
            onClick={() => setSelectedStatus(selectedStatus === 'NEED_CLARIFICATION' ? 'ALL' : 'NEED_CLARIFICATION')}
            className={`p-3.5 rounded-xl border transition cursor-pointer ${
              selectedStatus === 'NEED_CLARIFICATION'
                ? 'bg-amber-500/15 border-amber-500 shadow-xs'
                : 'bg-card border-border hover:border-amber-500/40 shadow-xs'
            }`}
          >
            <div className="flex items-center justify-between text-amber-600 dark:text-amber-400 mb-1">
              <span className="text-xs font-medium">Klarifikasi</span>
              <HelpCircle className="size-4 text-amber-500" />
            </div>
            <div className="text-xl font-bold text-foreground">{currentViewMetrics.needClarification}</div>
            <div className="text-[10px] text-muted-foreground">Tanya ke armada</div>
          </div>

          {/* Ditolak */}
          <div
            onClick={() => setSelectedStatus(selectedStatus === 'REJECTED' ? 'ALL' : 'REJECTED')}
            className={`p-3.5 rounded-xl border transition cursor-pointer ${
              selectedStatus === 'REJECTED'
                ? 'bg-rose-500/15 border-rose-500 shadow-xs'
                : 'bg-card border-border hover:border-rose-500/40 shadow-xs'
            }`}
          >
            <div className="flex items-center justify-between text-rose-600 dark:text-rose-400 mb-1">
              <span className="text-xs font-medium">Ditolak</span>
              <XCircle className="size-4 text-rose-500" />
            </div>
            <div className="text-xl font-bold text-foreground">{currentViewMetrics.rejected}</div>
            <div className="text-[10px] text-muted-foreground">Pengajuan batal</div>
          </div>
        </div>
      </div>

      {sheetViewMode === 'batch_summary' ? (
        /* Matriks Rekapitulasi & Konklusi Antar Batch */
        <div className="space-y-4">
          <div className="p-4 rounded-xl bg-card border border-border shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="space-y-1">
              <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                <BarChart3 className="size-5 text-indigo-500" />
                Matriks Konklusi &amp; Evaluasi Antar Batch (Purchase Planning)
              </h3>
              <p className="text-xs text-muted-foreground">
                Ringkasan akumulasi seluruh batch pengadaan tahun 2026, status finalisasi berkas, item material net demand, serta unduhan laporan Excel per siklus mingguan.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  const allApproved = reviews.filter((r) => r.reviewStatus === 'APPROVED_PO');
                  handleDownloadBatchExcel(allApproved.length > 0 ? allApproved : reviews, 'CPG-PP-2026-ALL', 'Akumulasi Seluruh Batch 2026');
                }}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-xl border border-emerald-500/40 bg-emerald-600 hover:bg-emerald-500 text-white shadow-xs transition cursor-pointer"
                title="Unduh seluruh FPB yang disetujui sepanjang tahun 2026 ke dalam format Excel Purchase Planning"
              >
                <FileSpreadsheet className="size-4" />
                <span>Unduh Konsolidasi Tahunan (.xlsx)</span>
              </button>
            </div>
          </div>

          {/* Tabel Matriks Antar Batch */}
          <div className="rounded-xl border border-border bg-card overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  <tr className="border-b border-border bg-muted/60 text-muted-foreground font-semibold">
                    <th className="py-3 px-4">Nama Batch &amp; Ref Planning</th>
                    <th className="py-3 px-4">Batas Cut-Off Siklus</th>
                    <th className="py-3 px-4 text-center">Total FPB</th>
                    <th className="py-3 px-4">Disposisi Analisa</th>
                    <th className="py-3 px-4 text-center">Item Material</th>
                    <th className="py-3 px-4 text-right">Est. Anggaran (Net)</th>
                    <th className="py-3 px-4 text-center">Status Siklus</th>
                    <th className="py-3 px-4 text-right">Aksi Dokumen</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {batchSummaryList.map((b) => (
                    <tr
                      key={b.batchCode}
                      className={`hover:bg-muted/40 transition ${
                        b.isCurrentActive ? 'bg-primary/5 font-medium' : ''
                      }`}
                    >
                      {/* Nama & Ref */}
                      <td className="py-3 px-4">
                        <div className="flex flex-col gap-0.5">
                          <span className="font-bold text-foreground text-sm flex items-center gap-1.5">
                            {b.batchName}
                            {b.isCurrentActive && (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-primary text-primary-foreground">
                                AKTIF
                              </span>
                            )}
                          </span>
                          <span className="text-[11px] font-mono text-muted-foreground">
                            {b.batchCode}
                          </span>
                        </div>
                      </td>

                      {/* Cut-Off */}
                      <td className="py-3 px-4 text-muted-foreground">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="size-3.5 text-muted-foreground" />
                          <span>{b.cutoffLabel}</span>
                        </div>
                      </td>

                      {/* Total FPB */}
                      <td className="py-3 px-4 text-center">
                        <span className="font-bold text-sm text-foreground">
                          {b.totalFpb}
                        </span>
                        <span className="text-[10px] text-muted-foreground block">
                          berkas
                        </span>
                      </td>

                      {/* Disposisi */}
                      <td className="py-3 px-4">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="px-2 py-0.5 rounded font-semibold text-[11px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                            {b.approvedPo} Disetujui PO
                          </span>
                          {b.fulfillStock > 0 && (
                            <span className="px-2 py-0.5 rounded font-semibold text-[11px] bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20">
                              {b.fulfillStock} Stok
                            </span>
                          )}
                          {b.pending > 0 && (
                            <span className="px-2 py-0.5 rounded font-medium text-[11px] bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                              {b.pending} Menunggu
                            </span>
                          )}
                          {b.needClarification > 0 && (
                            <span className="px-2 py-0.5 rounded font-medium text-[11px] bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
                              {b.needClarification} Tanya
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Item Material */}
                      <td className="py-3 px-4 text-center">
                        <span className="font-bold text-foreground">
                          {b.totalItems} item
                        </span>
                        <span className="text-[10px] text-muted-foreground block">
                          ({b.totalNetDemand} Qty Beli)
                        </span>
                      </td>

                      {/* Est Anggaran */}
                      <td className="py-3 px-4 text-right font-mono font-semibold text-foreground">
                        Rp {b.totalEstCost.toLocaleString('id-ID')}
                      </td>

                      {/* Status Siklus */}
                      <td className="py-3 px-4 text-center">
                        {b.isCurrentActive ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                            <span className="size-2 rounded-full bg-emerald-500 animate-pulse"></span>
                            Siklus Berjalan (Aktif)
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-muted text-muted-foreground border border-border">
                            <CheckCircle2 className="size-3 text-emerald-600" />
                            Selesai (Diarsipkan)
                          </span>
                        )}
                      </td>

                      {/* Aksi */}
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {b.isCurrentActive ? (
                            <button
                              type="button"
                              onClick={() => setSheetViewMode('active')}
                              className="px-2.5 py-1 rounded-lg border border-primary/30 bg-primary/10 hover:bg-primary/20 text-primary font-semibold text-xs transition cursor-pointer"
                            >
                              Buka Lembar Aktif
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => {
                                setArchivedBatchFilter(b.batchCode);
                                setSheetViewMode('archived');
                              }}
                              className="px-2.5 py-1 rounded-lg border border-border bg-background hover:bg-muted text-foreground font-medium text-xs transition cursor-pointer"
                            >
                              Buka di Arsip
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => {
                              const bRecords =
                                b.records.length > 0
                                  ? b.records
                                  : reviews.filter((r) => r.batchNo === b.batchCode || (!r.isArchived && b.isCurrentActive));
                              handleDownloadBatchExcel(bRecords, b.batchCode, b.batchName);
                            }}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs font-semibold transition cursor-pointer shadow-2xs"
                            title={`Unduh berkas Excel untuk ${b.batchName}`}
                          >
                            <FileSpreadsheet className="size-3.5" />
                            <span>Unduh Excel</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        <>
          {/* ======================================================== */}
          {/* 3. Filter & Search Toolbar                                */}
          {/* ======================================================== */}
      <div className="p-4 rounded-xl bg-card border border-border shadow-xs space-y-3">
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
          {/* Search Bar */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari No. FPB, No. Agenda Planning, Armada, Keperluan, PIC, atau No. PO..."
              className="w-full pl-9 pr-4 py-2 text-xs rounded-lg border border-border bg-background focus:outline-hidden focus:ring-2 focus:ring-primary/20 focus:border-primary text-foreground placeholder:text-muted-foreground transition"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground text-xs"
              >
                ✕
              </button>
            )}
          </div>

          {/* Quick Filters */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Entity Filter */}
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-muted-foreground shrink-0 flex items-center gap-1">
                <Building2 className="size-3.5" />
                Entitas:
              </span>
              <select
                value={selectedEntity}
                onChange={(e) => setSelectedEntity(e.target.value)}
                className="py-1.5 px-2.5 text-xs rounded-lg border border-border bg-background text-foreground focus:outline-hidden focus:ring-2 focus:ring-primary/20"
              >
                {ENTITY_OPTIONS.map((ent) => (
                  <option key={ent.code} value={ent.code}>
                    {ent.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Status Review Filter */}
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-muted-foreground shrink-0 flex items-center gap-1">
                <Filter className="size-3.5" />
                Status:
              </span>
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="py-1.5 px-2.5 text-xs rounded-lg border border-border bg-background text-foreground focus:outline-hidden focus:ring-2 focus:ring-primary/20"
              >
                <option value="ALL">Semua Status Review</option>
                <option value="PENDING_REVIEW">Menunggu Analisa</option>
                <option value="APPROVED_PO">Disetujui Masuk Purchase Planning</option>
                <option value="FULFILL_STOCK">Dipenuhi dari Stok</option>
                <option value="NEED_CLARIFICATION">Perlu Klarifikasi</option>
                <option value="REJECTED">Ditolak</option>
              </select>
            </div>

            {/* Priority & SLA Filter */}
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-muted-foreground shrink-0 flex items-center gap-1">
                <Zap className="size-3.5 text-amber-500" />
                Prioritas:
              </span>
              <select
                value={selectedPriority}
                onChange={(e) => setSelectedPriority(e.target.value)}
                className="py-1.5 px-2.5 text-xs rounded-lg border border-border bg-background text-foreground focus:outline-hidden focus:ring-2 focus:ring-primary/20"
              >
                <option value="ALL">Semua Prioritas</option>
                <option value="P1">🚨 P1 - Utama (1-2 Hari)</option>
                <option value="P2">⚠️ P2 - Menengah (3-14 Hari)</option>
                <option value="P3">📦 P3 - Rutin (14-30 Hari)</option>
                <option value="OVERDUE">⚠️ Lewat Batas SLA</option>
              </select>
            </div>

            {/* Urgency Filter */}
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-muted-foreground shrink-0">Urgensi:</span>
              <select
                value={selectedUrgency}
                onChange={(e) => setSelectedUrgency(e.target.value)}
                className="py-1.5 px-2.5 text-xs rounded-lg border border-border bg-background text-foreground focus:outline-hidden focus:ring-2 focus:ring-primary/20"
              >
                <option value="ALL">Semua Tingkat</option>
                <option value="NORMAL">Normal</option>
                <option value="URGENT">Urgent</option>
                <option value="EMERGENCY">Emergency</option>
              </select>
            </div>

            {/* Only Duplicates Toggle */}
            <button
              type="button"
              onClick={() => setOnlyDuplicates(!onlyDuplicates)}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-lg border transition cursor-pointer ${
                onlyDuplicates
                  ? 'bg-amber-500/15 border-amber-500 text-amber-700 dark:text-amber-400 font-semibold'
                  : 'bg-background border-border text-muted-foreground hover:text-foreground'
              }`}
            >
              <AlertTriangle className="size-3.5" />
              <span>Ada Alert Duplikasi</span>
            </button>
          </div>
        </div>

        {/* Counter Info */}
        <div className="flex items-center justify-between text-xs text-muted-foreground pt-1 border-t border-border/50">
          <div>
            Menampilkan <span className="font-semibold text-foreground">{filteredReviews.length}</span> dari{' '}
            <span className="font-semibold text-foreground">{reviews.length}</span> pengajuan FPB
          </div>
          {onlyDuplicates && (
            <div className="text-amber-600 dark:text-amber-400 font-medium">
              * Filter aktif: Menampilkan FPB dengan riwayat pengajuan armada serupa dalam 60 hari terakhir
            </div>
          )}
        </div>
      </div>

      {/* ======================================================== */}
      {/* 4. FPB Review Interactive Table                          */}
      {/* ======================================================== */}
      <div className="rounded-xl border border-border bg-card overflow-hidden shadow-xs">
        {isLoading ? (
          <div className="p-12 text-center">
            <RefreshCw className="size-8 animate-spin mx-auto text-primary mb-3" />
            <p className="text-sm font-medium text-foreground">Memuat antrean analisa & review FPB...</p>
            <p className="text-xs text-muted-foreground mt-1">Mengambil data dari Cloud Storage dan sinkronisasi status</p>
          </div>
        ) : filteredReviews.length === 0 ? (
          sheetViewMode === 'active' && activeCount === 0 ? (
            <div className="p-12 text-center space-y-4">
              <div className="size-16 rounded-2xl bg-primary/10 text-primary mx-auto flex items-center justify-center">
                <Sparkles className="size-8" />
              </div>
              <div className="space-y-1">
                <h4 className="text-base font-bold text-foreground">Lembar Kerja Bersih (Clean Sheet Aktif)</h4>
                <p className="text-xs text-muted-foreground max-w-lg mx-auto">
                  Seluruh berkas FPB batch sebelumnya telah aman diarsipkan ke database riwayat ({archivedCount} berkas). Lembar review saat ini kosong dan siap menerima berkas FPB baru sebagai dasar perencanaan pengadaan barang.
                </p>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => pdfInputRef.current?.click()}
                  className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs inline-flex items-center gap-1.5 shadow-sm transition cursor-pointer"
                >
                  <Upload className="size-4" />
                  <span>Upload PDF FPB (Multi-Select)</span>
                </button>
                <button
                  type="button"
                  onClick={() => excelInputRef.current?.click()}
                  className="px-4 py-2 rounded-xl border border-border bg-background hover:bg-muted text-foreground font-semibold text-xs inline-flex items-center gap-1.5 transition cursor-pointer"
                >
                  <FileSpreadsheet className="size-4 text-emerald-600" />
                  <span>Import Excel / CSV</span>
                </button>
                {archivedCount > 0 && (
                  <button
                    type="button"
                    onClick={() => setSheetViewMode('archived')}
                    className="px-3.5 py-2 rounded-xl border border-border bg-background hover:bg-muted text-muted-foreground hover:text-foreground text-xs inline-flex items-center gap-1.5 transition cursor-pointer"
                  >
                    <Archive className="size-3.5 text-amber-600" />
                    <span>Lihat Riwayat Arsip ({archivedCount})</span>
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="p-12 text-center space-y-3">
              <FileSearch className="size-10 mx-auto text-muted-foreground/60" />
              <p className="text-sm font-semibold text-foreground">Tidak ada FPB yang cocok dengan kriteria filter</p>
              <p className="text-xs text-muted-foreground max-w-md mx-auto">
                Coba atur ulang kata kunci pencarian atau ganti mode filter lembar tampilan.
              </p>
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setSelectedEntity('ALL');
                  setSelectedStatus('ALL');
                  setSelectedPriority('ALL');
                  setSelectedUrgency('ALL');
                  setOnlyDuplicates(false);
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border border-border bg-background text-foreground hover:bg-muted transition cursor-pointer"
              >
                Reset Semua Filter
              </button>
            </div>
          )
        ) : (
          <>
            <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-muted/50 text-muted-foreground border-b border-border font-medium">
                <tr>
                  <th className="py-3 px-4 min-w-[190px]">No. FPB & Entitas</th>
                  <th className="py-3 px-3 whitespace-nowrap min-w-[125px]" title="Target batas waktu pengadaan: P1 Utama (1-2 hari untuk Urgent/Darurat), P2 Menengah (3-14 hari), P3 Rutin (14-30 hari)">Prioritas & SLA</th>
                  <th className="py-3 px-4 min-w-[140px]">Armada Kapal / Dept</th>
                  <th className="py-3 px-3 whitespace-nowrap min-w-[95px]">Tanggal</th>
                  <th className="py-3 px-4 min-w-[220px] w-full">Peruntukan / Keperluan</th>
                  <th className="py-3 px-3 whitespace-nowrap min-w-[140px] w-36" title="Alur logistik berurutan: Menunggu Review -> Disetujui Tim Review -> Sahkan di e-FPB -> Siap Pengadaan">Persetujuan Logistik</th>
                  <th className="py-3 px-3 whitespace-nowrap min-w-[140px] w-36">Status Review Tim FPB</th>
                  <th className="py-3 px-3 whitespace-nowrap min-w-[90px] w-24" title="Tingkat kegentingan operasional armada (Normal / Urgent / Emergency). Pengajuan Urgent otomatis diprioritaskan P1 (SLA 1-2 hari)">Urgensi</th>
                  <th className="py-3 px-3 text-center whitespace-nowrap min-w-[90px] w-24" title="Nomor urutan registrasi antrean masuk Purchase Planning mingguan">Ref. Planning</th>
                  <th className="py-3 px-3 whitespace-nowrap min-w-[110px] w-28" title="Status alokasi barang (Dalam analisa tim sebelum disetujui, Perlu PO / Stok gudang setelah disetujui)">Item & Stok</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredReviews.map((rec) => {
                  const hasDuplicates = rec.duplicateAlerts && rec.duplicateAlerts.length > 0;
                  const itemsCount = rec.items ? rec.items.length : 0;
                  const inStockCount = rec.items ? rec.items.filter((i) => i.decision === 'STOCK').length : 0;

                  return (
                    <tr
                      key={rec.id}
                      className="hover:bg-muted/40 transition group cursor-pointer"
                      onClick={() => handleOpenReview(rec)}
                    >
                      {/* No. FPB & Entitas */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2 flex-wrap">
                          {getEntityBadge(rec.entity)}
                          <span className="font-semibold text-foreground group-hover:text-primary transition">
                            {rec.fpbNo}
                          </span>
                          {/* Badge Susulan / Late Entry */}
                          {(() => {
                            const align = checkFpbCycleAlignment(rec.date, nowDate, cycleInfo.batchSeq);
                            const isLate = rec.isLateEntry || align.isPastCycle;
                            if (!isLate) return null;
                            const batchOrigin = rec.originalCycleBatch || align.originalBatchName;
                            const days = rec.lateDays || align.daysLate;
                            return (
                              <span
                                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500/15 text-amber-800 dark:text-amber-300 border border-amber-500/35"
                                title={`FPB tertanggal ${rec.date} (diterbitkan pada periode ${batchOrigin}, terlambat ${days} hari dari batas cut-off ${cycleInfo.batchName}). Masuk sebagai dokumen susulan resmi.`}
                              >
                                <AlertTriangle className="size-2.5 text-amber-600 dark:text-amber-400" />
                                Susulan ({batchOrigin})
                              </span>
                            );
                          })()}
                          {rec.isRevised && (
                            <span
                              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/30"
                              title={rec.revisionNote || 'FPB ini telah direvisi. Menampilkan berkas e-FPB tanggal terkini.'}
                            >
                              <History className="size-3" />
                              Revisi{rec.revisionCount && rec.revisionCount > 1 ? ` (${rec.revisionCount}x)` : ''}
                            </span>
                          )}
                          {rec.isArchived && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (confirm(`Kembalikan FPB ${rec.fpbNo} ke lembar aktif?`)) {
                                  handleRestoreFromArchive([rec.fpbNo]);
                                }
                              }}
                              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold text-amber-700 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/25 transition cursor-pointer"
                              title="Pulihkan berkas ini kembali ke Lembar Aktif"
                            >
                              <RotateCcw className="size-2.5" />
                              <span>Pulihkan</span>
                            </button>
                          )}
                          {rec.attachments && rec.attachments.length > 0 && (
                            <span
                              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/30"
                              title={`${rec.attachments.length} berkas lampiran fisik/foto dari pembuat e-FPB`}
                            >
                              <Paperclip className="size-2.5" />
                              {rec.attachments.length} Lampiran
                            </span>
                          )}
                        </div>
                        {hasDuplicates && (
                          <div className="flex items-center gap-1 mt-1 text-[11px] text-amber-600 dark:text-amber-400 font-medium">
                            <AlertTriangle className="size-3 shrink-0" />
                            <span>{rec.duplicateAlerts.length} Riwayat Serupa</span>
                          </div>
                        )}
                      </td>

                      {/* Prioritas & Target SLA */}
                      <td className="py-3 px-3 whitespace-nowrap">
                        <div className="flex flex-col gap-1 items-start">
                          {getPriorityBadge(rec.priorityLevel)}
                          {getSlaBadge(rec)}
                        </div>
                      </td>

                      {/* Armada */}
                      <td className="py-3 px-4 font-medium text-foreground">
                        <div className="flex items-center gap-1.5">
                          {renderArmadaIcon(rec.armada)}
                          <span>{rec.armada}</span>
                        </div>
                      </td>

                      {/* Tanggal */}
                      <td className="py-3 px-3 text-muted-foreground whitespace-nowrap">
                        <div className="flex items-center gap-1">
                          <Calendar className="size-3 text-muted-foreground" />
                          <span>{rec.date}</span>
                        </div>
                      </td>

                      {/* Peruntukan */}
                      <td className="py-3 px-4 text-foreground" title={rec.purpose}>
                        <div className="line-clamp-2 max-w-xl">
                          {rec.purpose || '-'}
                        </div>
                      </td>

                      {/* Persetujuan Logistik */}
                      <td className="py-3 px-3 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                        <LogisticsApprovalCell
                          record={rec}
                          onApproveClick={(targetRec) => setConfirmApprovalRecord(targetRec)}
                          isLoading={isApprovingLogistic}
                        />
                      </td>

                      {/* Status Review Tim FPB */}
                      <td className="py-3 px-3 whitespace-nowrap">
                        {getReviewStatusBadge(rec.reviewStatus)}
                      </td>

                      {/* Urgensi */}
                      <td className="py-3 px-3 whitespace-nowrap">
                        {getUrgencyBadge(rec.urgency)}
                      </td>

                      {/* Ref. Planning / No. Agenda Masuk Purchase Planning */}
                      <td className="py-3 px-3 whitespace-nowrap text-center">
                        {rec.reviewStatus === 'APPROVED_PO' && rec.tkbNo ? (
                          <span
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-mono font-bold bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/25 shadow-xs"
                            title={`Nomor agenda antrean masuk Purchase Planning: ${rec.tkbNo}`}
                          >
                            <Tag className="size-3 text-emerald-500 shrink-0" />
                            <span>{rec.tkbNo}</span>
                          </span>
                        ) : (
                          <span className="text-muted-foreground font-mono">-</span>
                        )}
                      </td>

                      {/* Item & Stok Gudang */}
                      <td className="py-3 px-3 whitespace-nowrap">
                        {itemsCount > 0 ? (
                          <div className="flex flex-col">
                            <span className="font-semibold text-foreground">
                              {itemsCount} item
                            </span>
                            {/* Status kolom "Item & Stok" (misal: "Perlu PO") hanya boleh aktif setelah FPB disetujui, bukan saat berkas masih di tahap analisa awal */}
                            {rec.reviewStatus === 'APPROVED_PO' ? (
                              <span className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                                {inStockCount > 0 ? `${inStockCount} stok / sisa Planning` : 'Purchase Planning'}
                              </span>
                            ) : rec.reviewStatus === 'FULFILL_STOCK' ? (
                              <span className="text-[11px] font-medium text-cyan-600 dark:text-cyan-400">
                                Penuhi dari stok
                              </span>
                            ) : rec.reviewStatus === 'NEED_CLARIFICATION' ? (
                              <span className="text-[11px] text-amber-600 dark:text-amber-400">
                                Perlu klarifikasi
                              </span>
                            ) : rec.reviewStatus === 'REJECTED' ? (
                              <span className="text-[11px] text-rose-500 line-through">
                                Dibatalkan
                              </span>
                            ) : (
                              <span className="text-[11px] text-muted-foreground italic">
                                Dalam analisa tim
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-[11px] text-muted-foreground italic">
                            Belum diekstrak
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

        {/* Bottom Search Bar & Footer Info */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3.5 border-t border-border bg-muted/20 text-xs">
          <div className="relative w-full sm:w-96">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari No. FPB, No. Agenda Planning, Armada, Keperluan, PIC, atau No. PO..."
              className="w-full pl-9 pr-8 py-2 text-xs rounded-lg border border-border bg-background focus:outline-hidden focus:ring-2 focus:ring-primary/20 focus:border-primary text-foreground placeholder:text-muted-foreground transition shadow-xs"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground text-xs p-0.5 cursor-pointer"
                title="Hapus pencarian"
              >
                ✕
              </button>
            )}
          </div>
          <div className="text-xs text-muted-foreground">
            Menampilkan <span className="font-semibold text-foreground">{filteredReviews.length}</span> dari{' '}
            <span className="font-semibold text-foreground">
              {sheetViewMode === 'active' ? activeCount : sheetViewMode === 'archived' ? archivedCount : reviews.length}
            </span>{' '}
            pengajuan FPB {sheetViewMode === 'active' && <span className="text-primary font-medium">({cycleInfo.batchName})</span>}
          </div>
        </div>
          </>
        )}
      </div>
    </>
  )}

      {/* ======================================================== */}
      {/* 5. Detail & Review Decision Modal (Split-View Drawer)    */}
      {/* ======================================================== */}
      {selectedRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-background/80 backdrop-blur-sm animate-in fade-in-50">
          <div className="relative w-full max-w-6xl max-h-[92vh] flex flex-col rounded-2xl bg-card border border-border shadow-2xl overflow-hidden animate-in zoom-in-95">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-5 border-b border-border bg-muted/30">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-primary/10 text-primary">
                  <ClipboardCheck className="size-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    {getEntityBadge(selectedRecord.entity)}
                    <h3 className="text-lg font-bold text-foreground">
                      Analisa & Review: {selectedRecord.fpbNo}
                    </h3>
                    {selectedRecord.isRevised && (
                      <span
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/30"
                        title={selectedRecord.revisionNote || 'FPB ini telah direvisi. Menampilkan berkas e-FPB tanggal terkini.'}
                      >
                        <History className="size-3.5" />
                        Revisi{selectedRecord.revisionCount && selectedRecord.revisionCount > 1 ? ` (${selectedRecord.revisionCount}x)` : ''}
                      </span>
                    )}
                    {getPriorityBadge(formPriority)}
                    {getReviewStatusBadge(formStatus)}
                    {getUrgencyBadge(formUrgency)}
                    {/* Badge Susulan / Late Entry di Modal Header */}
                    {(() => {
                      const align = checkFpbCycleAlignment(selectedRecord.date, nowDate, cycleInfo.batchSeq);
                      const isLate = selectedRecord.isLateEntry || align.isPastCycle;
                      if (!isLate) return null;
                      const batchOrigin = selectedRecord.originalCycleBatch || align.originalBatchName;
                      return (
                        <span
                          className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/15 text-amber-800 dark:text-amber-300 border border-amber-500/35 flex items-center gap-1"
                          title={`Dokumen susulan dari periode ${batchOrigin} (FPB: ${selectedRecord.date}). Diterima masuk ${cycleInfo.batchName}.`}
                        >
                          <AlertTriangle className="size-3 text-amber-600 dark:text-amber-400" />
                          Susulan ({batchOrigin})
                        </span>
                      );
                    })()}
                  </div>
                  <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground mt-0.5">
                    <span className="flex items-center gap-1 font-medium text-foreground">
                      {renderArmadaIcon(selectedRecord.armada)}
                      {selectedRecord.armada}
                    </span>
                    <span>•</span>
                    <span className="flex items-center gap-1">
                      <Calendar className="size-3.5 text-muted-foreground" />
                      {selectedRecord.date}
                    </span>
                    <span>•</span>
                    <span>Status Server: {selectedRecord.isReceivedLogistik ? 'Diterima Logistik' : 'Terdaftar'}</span>
                    {selectedRecord.slaTargetDate && (
                      <>
                        <span>•</span>
                        <span className={selectedRecord.slaStatus === 'OVERDUE' ? 'font-bold text-rose-600 dark:text-rose-400' : 'text-primary font-medium'}>
                          Target SLA: {selectedRecord.slaTargetDate} ({selectedRecord.slaDaysRemaining !== undefined ? (selectedRecord.slaDaysRemaining < 0 ? `Lewat ${Math.abs(selectedRecord.slaDaysRemaining)} hr` : `Sisa ${selectedRecord.slaDaysRemaining} hr`) : ''})
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Close Button */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition cursor-pointer"
                  title="Tutup (Esc)"
                >
                  <X className="size-5" />
                </button>
              </div>
            </div>

            {/* Duplicate Detection Alert Banner */}
            {selectedRecord.duplicateAlerts && selectedRecord.duplicateAlerts.length > 0 && (
              <div className="p-3.5 mx-5 mt-4 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-3">
                <AlertTriangle className="size-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <div className="text-xs text-amber-900 dark:text-amber-200">
                  <div className="font-bold flex items-center gap-1.5">
                    Peringatan Deteksi Permintaan Serupa / Berulang:
                  </div>
                  <ul className="mt-1 space-y-1 list-disc list-inside">
                    {selectedRecord.duplicateAlerts.map((dup, i) => (
                      <li key={i}>
                        <span className="font-semibold">{dup.fpbNo}</span> ({dup.date}) dari {dup.armada}:{' '}
                        <span className="italic">{dup.matchedItem}</span>
                      </li>
                    ))}
                  </ul>
                  <p className="mt-1 text-[11px] text-amber-700 dark:text-amber-300">
                    Mohon cek apakah barang dari pengajuan sebelumnya sudah pernah diserahkan ke armada untuk menghindari duplikasi pembelian ganda.
                  </p>
                </div>
              </div>
            )}

            {/* Revision Notification Alert Banner */}
            {selectedRecord.isRevised && (
              <div className="p-3.5 mx-5 mt-3 rounded-xl bg-blue-500/10 border border-blue-500/30 flex items-start gap-3">
                <History className="size-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                <div className="text-xs text-blue-900 dark:text-blue-200">
                  <div className="font-bold flex items-center gap-1.5">
                    Notifikasi Revisi Berkas e-FPB{selectedRecord.revisionCount && selectedRecord.revisionCount > 1 ? ` (${selectedRecord.revisionCount}x Revisi)` : ''}:
                  </div>
                  <p className="mt-1">
                    {selectedRecord.revisionNote || 'Ditemukan berkas ganda dengan nomor FPB yang sama di server e-FPB. Sistem otomatis memilih dan menggunakan berkas dengan tanggal dan waktu terkini.'}
                  </p>
                  <p className="mt-1 text-[11px] text-blue-700 dark:text-blue-300">
                    Semua rincian barang dan tautan dokumen PDF resmi yang ditampilkan mengacu pada revisi tanggal terkini.
                  </p>
                </div>
              </div>
            )}

            {/* Out-of-Cycle / Late Entry Notification Banner */}
            {(() => {
              const align = checkFpbCycleAlignment(selectedRecord.date, nowDate, cycleInfo.batchSeq);
              const isLate = selectedRecord.isLateEntry || align.isPastCycle;
              if (!isLate) return null;
              const batchOrigin = selectedRecord.originalCycleBatch || align.originalBatchName;
              const days = selectedRecord.lateDays || align.daysLate;
              return (
                <div className="p-3 mx-5 mt-3 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <AlertTriangle className="size-4 text-amber-600 dark:text-amber-400 shrink-0" />
                    <div className="text-amber-950 dark:text-amber-200">
                      <span className="font-bold">Aturan Siklus &amp; Disiplin Cut-Off:</span> Dokumen FPB ini tertanggal <strong>{selectedRecord.date}</strong> (asal periode <strong>{batchOrigin}</strong>, selisih {days} hari). Diterima sebagai dokumen <strong>Susulan Resmi (Late Entry)</strong> pada siklus <strong>{cycleInfo.batchName}</strong>.
                    </div>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500 text-white shrink-0">
                    Late Entry
                  </span>
                </div>
              );
            })()}

            {/* Modal Tab Navigation */}
            <div className="flex items-center gap-1 px-5 pt-3 border-b border-border bg-background">
              <button
                type="button"
                onClick={() => setActiveModalTab('items')}
                className={`flex items-center gap-2 py-2 px-3 text-xs font-semibold border-b-2 transition cursor-pointer ${
                  activeModalTab === 'items'
                    ? 'border-primary text-primary'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                <Boxes className="size-4" />
                <span>Item Barang & Cek Stok Gudang</span>
                {formItems.length > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-primary/10 text-primary">
                    {formItems.length}
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={() => setActiveModalTab('pdf')}
                className={`flex items-center gap-2 py-2 px-3 text-xs font-semibold border-b-2 transition cursor-pointer ${
                  activeModalTab === 'pdf'
                    ? 'border-primary text-primary'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                <FileText className="size-4" />
                <span>Pratinjau Dokumen PDF Resmi</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveModalTab('attachments')}
                className={`flex items-center gap-2 py-2 px-3 text-xs font-semibold border-b-2 transition cursor-pointer ${
                  activeModalTab === 'attachments'
                    ? 'border-primary text-primary'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                <Paperclip className="size-4" />
                <span>Lampiran &amp; Foto Fisik Pemohon</span>
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                  formAttachments.length > 0
                    ? 'bg-primary/15 text-primary'
                    : 'bg-muted text-muted-foreground'
                }`}>
                  {formAttachments.length}
                </span>
              </button>
            </div>

            {/* Modal Body Area */}
            <div className="flex-1 overflow-y-auto p-5 space-y-5">
              {/* TAB 1: Item Barang & Cek Stok Gudang */}
              {activeModalTab === 'items' && (
                <div className="space-y-4">
                  {/* Top action inside item tab */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl bg-muted/40 border border-border">
                    <div>
                      <h4 className="text-xs font-bold text-foreground flex items-center gap-1.5">
                        <Sparkles className="size-4 text-primary" />
                        Analisa Ketersediaan Stok Gudang (Master Persediaan CPG)
                      </h4>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        Sistem secara otomatis mencocokkan item pengajuan e-FPB dengan stok persediaan fisik gudang perusahaan.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={handleParsePdfItems}
                      disabled={isParsingItems}
                      className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-semibold rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition shadow-xs cursor-pointer disabled:opacity-50 shrink-0"
                    >
                      <RefreshCw className={`size-3.5 ${isParsingItems ? 'animate-spin' : ''}`} />
                      <span>{isParsingItems ? 'Mengekstrak PDF & Cek Stok...' : 'Ekstraksi Item dari PDF'}</span>
                    </button>
                  </div>

                  {/* Purpose Box */}
                  <div className="p-3 rounded-lg border border-border bg-card text-xs">
                    <span className="font-semibold text-foreground">Tujuan / Keperluan FPB: </span>
                    <span className="text-muted-foreground">{selectedRecord.purpose || 'Pengadaan Kebutuhan Operasional Kapal'}</span>
                  </div>

                  {/* Smart Stock Advisory Card */}
                  {stockStats.total > 0 && (
                    <div className={`p-3.5 rounded-xl border transition-all ${
                      stockStats.hasAvailableStock
                        ? 'border-cyan-500/30 bg-cyan-500/5 dark:bg-cyan-950/20'
                        : 'border-border bg-card'
                    }`}>
                      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <Boxes className="size-4 text-cyan-600 dark:text-cyan-400 shrink-0" />
                            <span className="text-xs font-bold text-foreground">
                              Advis Alokasi Material &amp; Ketersediaan Stok Gudang
                            </span>
                            {stockStats.allInStock && (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-600 text-white shadow-2xs">
                                100% Stok Tersedia di Gudang
                              </span>
                            )}
                          </div>

                          {/* Breakdown badge */}
                          <div className="flex flex-wrap items-center gap-2 text-xs">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 text-[11px]">
                              <CheckCircle2 className="size-3" />
                              {stockStats.inStock} Tersedia Penuh di Gudang
                            </span>
                            {stockStats.partial > 0 && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 text-[11px]">
                                <AlertTriangle className="size-3" />
                                {stockStats.partial} Stok Parsial
                              </span>
                            )}
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-medium bg-muted text-muted-foreground border border-border text-[11px]">
                              {stockStats.outOfStock} Perlu PO Baru
                            </span>
                          </div>

                          <p className="text-[11px] text-muted-foreground">
                            {stockStats.hasAvailableStock ? (
                              <>
                                💡 <strong className="text-foreground">Advis Efisiensi:</strong> Ditemukan{' '}
                                <strong className="text-cyan-600 dark:text-cyan-400 font-bold">
                                  {stockStats.inStock + stockStats.partial} item
                                </strong>{' '}
                                persediaan tersedia di gudang galangan perusahaan. Disarankan memenuhi item tersebut langsung dari stok gudang (TTB Mutasi) untuk memotong lead time menjadi <strong>0 hari kerja</strong> dan menghemat pengeluaran kas perusahaan.
                              </>
                            ) : (
                              'Seluruh item stok kosong di gudang fisik, alokasi diarahkan 100% untuk penerbitan PO baru ke vendor.'
                            )}
                          </p>
                        </div>

                        {/* Quick Action Buttons */}
                        <div className="flex flex-wrap items-center gap-2 shrink-0">
                          {stockStats.hasAvailableStock && (
                            <button
                              type="button"
                              onClick={handleApplySmartStockAdvisory}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg bg-cyan-600 hover:bg-cyan-700 active:bg-cyan-800 text-white shadow-xs transition cursor-pointer"
                              title="Otomatis alokasikan item yang tersedia ke stok gudang, dan sisanya ke PO purchasing"
                            >
                              <Sparkles className="size-3.5" />
                              <span>Terapkan Alokasi Otomatis (Stok ➔ Gudang, Sisa ➔ PO)</span>
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={handleSetAllPo}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg border border-border bg-background hover:bg-muted text-foreground transition cursor-pointer"
                            title="Tetapkan semua item untuk diproses ke Purchase Planning (PO)"
                          >
                            <span>Set Semua PO</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Items Table */}
                  {formItems.length === 0 ? (
                    <div className="p-8 text-center border border-dashed border-border rounded-xl space-y-2">
                      <Boxes className="size-8 mx-auto text-muted-foreground/60" />
                      <p className="text-xs font-semibold text-foreground">Item barang belum diekstrak dari PDF e-FPB</p>
                      <p className="text-[11px] text-muted-foreground max-w-sm mx-auto">
                        Klik tombol "Ekstraksi Item dari PDF" di atas untuk mengambil daftar item barang secara otomatis dan mengecek ketersediaan stok di gudang.
                      </p>
                    </div>
                  ) : (
                    <div className="rounded-xl border border-border overflow-hidden">
                      <table className="w-full text-xs text-left">
                        <thead className="bg-muted/60 text-muted-foreground font-semibold border-b border-border">
                          <tr>
                            <th className="py-2.5 px-3 w-8">No</th>
                            <th className="py-2.5 px-3">Kode & Nama Item Barang</th>
                            <th className="py-2.5 px-3 w-24">Permintaan</th>
                            <th className="py-2.5 px-3">Ketersediaan Stok Gudang</th>
                            <th className="py-2.5 px-3 w-36">Tindakan Keputusan</th>
                            <th className="py-2.5 px-3">Catatan / Instruksi Purchasing</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {formItems.map((item, idx) => {
                            const isStockOk = item.stockStatus === 'IN_STOCK';
                            const isStockPartial = item.stockStatus === 'PARTIAL';

                            return (
                              <tr key={idx} className="hover:bg-muted/30 transition">
                                <td className="py-2.5 px-3 font-medium text-muted-foreground">{item.no || idx + 1}</td>
                                <td className="py-2.5 px-3">
                                  <div className="font-bold text-foreground">{item.itemName}</div>
                                  <div className="text-[11px] text-muted-foreground flex flex-wrap items-center gap-2 mt-0.5">
                                    <span>Kode: {item.itemCode || '-'}</span>
                                    {item.priority && (
                                      <span
                                        className={`inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-bold ${
                                          item.priority.toUpperCase().includes('P1')
                                            ? 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30'
                                            : item.priority.toUpperCase().includes('P2')
                                            ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30'
                                            : 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/30'
                                        }`}
                                      >
                                        SLA: {item.priority}
                                      </span>
                                    )}
                                  </div>
                                  {item.description && (
                                    <div className="text-[11px] text-muted-foreground italic mt-0.5">
                                      "{item.description}"
                                    </div>
                                  )}
                                </td>

                                {/* Qty Permintaan */}
                                <td className="py-2.5 px-3 font-semibold text-foreground whitespace-nowrap">
                                  {item.qty} {item.unit}
                                </td>

                                {/* Ketersediaan Stok Gudang */}
                                <td className="py-2.5 px-3">
                                  {isStockOk ? (
                                    <div className="space-y-0.5">
                                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                                        <CheckCircle2 className="size-3" />
                                        Tersedia ({item.stockAvailable} {item.unit})
                                      </span>
                                      {item.matchedInventoryItem && (
                                        <div className="text-[10px] text-muted-foreground truncate max-w-xs" title={item.matchedInventoryItem}>
                                          {item.matchedInventoryItem}
                                        </div>
                                      )}
                                    </div>
                                  ) : isStockPartial ? (
                                    <div className="space-y-0.5">
                                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                                        <AlertTriangle className="size-3" />
                                        Stok Parsial ({item.stockAvailable} {item.unit})
                                      </span>
                                      <div className="text-[10px] text-muted-foreground">
                                        Kurang {item.qty - (item.stockAvailable || 0)} {item.unit}
                                      </div>
                                    </div>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
                                      <XCircle className="size-3" />
                                      Stok Gudang Kosong
                                    </span>
                                  )}
                                </td>

                                {/* Decision Dropdown */}
                                <td className="py-2.5 px-3">
                                  <select
                                    value={item.decision || 'PO'}
                                    onChange={(e) => handleUpdateItemDecision(idx, e.target.value as ItemDecision)}
                                    className={`w-full py-1.5 px-2 text-xs font-semibold rounded-lg border transition ${
                                      item.decision === 'STOCK'
                                        ? 'bg-cyan-500/10 text-cyan-700 dark:text-cyan-300 border-cyan-500/30'
                                        : item.decision === 'PO'
                                        ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30'
                                        : item.decision === 'HOLD'
                                        ? 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30'
                                        : 'bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/30'
                                    }`}
                                  >
                                    <option value="STOCK">Penuhi Stok</option>
                                    <option value="PO">Purchase Planning (PO)</option>
                                    <option value="HOLD">Tahan (Hold)</option>
                                    <option value="REJECT">Tolak Item</option>
                                  </select>

                                  {/* Peringatan Anti-Pembelian Ganda jika stok fisik tersedia tapi diset ke PO */}
                                  {isStockOk && item.decision === 'PO' && (
                                    <div
                                      className="text-[10px] text-amber-600 dark:text-amber-400 font-medium flex items-center gap-1 mt-1 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20"
                                      title="Stok fisik barang ini tersedia di gudang perusahaan. Pertimbangkan untuk memenuhinya langsung dari stok (TTB Mutasi) tanpa menerbitkan PO baru."
                                    >
                                      <AlertTriangle className="size-3 shrink-0" />
                                      <span>Stok fisik ada ({item.stockAvailable} {item.unit})!</span>
                                    </div>
                                  )}
                                  {isStockPartial && item.decision === 'PO' && (
                                    <div
                                      className="text-[10px] text-cyan-600 dark:text-cyan-400 font-medium flex items-center gap-1 mt-1 bg-cyan-500/10 px-1.5 py-0.5 rounded border border-cyan-500/20"
                                      title="Ada stok parsial di gudang. Bisa diambil dari stok sebagian dan sisanya dibuatkan PO."
                                    >
                                      <Boxes className="size-3 shrink-0" />
                                      <span>Ada {item.stockAvailable} {item.unit} di stok</span>
                                    </div>
                                  )}
                                </td>

                                {/* Notes Input */}
                                <td className="py-2.5 px-3">
                                  <input
                                    type="text"
                                    value={item.notes || ''}
                                    onChange={(e) => handleUpdateItemNote(idx, e.target.value)}
                                    placeholder="Catatan alokasi stok / instruksi PO..."
                                    className="w-full py-1 px-2 text-xs rounded border border-border bg-background text-foreground focus:outline-hidden focus:ring-1 focus:ring-primary"
                                  />
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 2: Pratinjau Dokumen PDF Resmi */}
              {activeModalTab === 'pdf' && (() => {
                const cleanFpb = (selectedRecord.fpbNo || '').trim();
                const rawPdfUrl = `/api/review-fpb/pdf?fpbNo=${encodeURIComponent(cleanFpb)}&type=raw`;
                const signedPdfUrl = `/api/review-fpb/pdf?fpbNo=${encodeURIComponent(cleanFpb)}&type=signed`;

                // Cek apakah dokumen berstatus Siap Pengadaan (Disetujui Logistik)
                const isApproved = Boolean(formIsReceivedLogistik || selectedRecord.isReceivedLogistik || selectedRecord.pchLogistik === 'Received_Logistic');

                // URL aktif yang ditampilkan: default Dokumen Bertanda Tangan jika disetujui, atau Dokumen Asli jika belum
                const activePdfUrl = (isApproved && pdfViewMode === 'signed') ? signedPdfUrl : rawPdfUrl;

                return (
                  <div className="w-full h-[640px] rounded-xl border border-border overflow-hidden bg-muted/20 shadow-xs">
                    <iframe
                      src={`${activePdfUrl}#toolbar=0&navpanes=0`}
                      title={`Dokumen Resmi FPB ${selectedRecord.fpbNo}`}
                      className="w-full h-full border-none"
                    />
                  </div>
                );
              })()}

              {/* TAB 3: Lampiran & Foto Fisik Pemohon */}
              {activeModalTab === 'attachments' && (
                <div className="space-y-4">
                  {/* Info Header */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl bg-muted/40 border border-border">
                    <div className="space-y-0.5">
                      <h4 className="text-xs font-bold text-foreground flex items-center gap-1.5">
                        <Paperclip className="size-4 text-primary" />
                        Lampiran Berkas &amp; Foto Fisik Barang
                      </h4>
                      <p className="text-[11px] text-muted-foreground">
                        Foto fisik kondisi kerusakan, foto plat nameplate spesifikasi mesin/unit, atau dokumen penawaran dari pembuat e-FPB.
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleSyncEfpbAttachments}
                        disabled={isSyncingAttachments}
                        className="px-2.5 py-1 rounded-lg border border-border bg-background text-xs font-semibold text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                        title="Tarik berkas lampiran & foto fisik dari e-FPB"
                      >
                        <RefreshCw className={`size-3 ${isSyncingAttachments ? 'animate-spin' : ''}`} />
                        <span>{isSyncingAttachments ? 'Memindai...' : 'Tarik dari e-FPB'}</span>
                      </button>
                      <span className="text-[11px] text-muted-foreground">
                        Total tersimpan: <strong className="text-foreground font-mono">{formAttachments.length} berkas</strong>
                      </span>
                    </div>
                  </div>

                  {/* Form Upload Lampiran Baru */}
                  <div className="p-4 rounded-xl border-2 border-dashed border-border bg-card/60 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                        <UploadCloud className="size-4 text-primary" />
                        Unggah Foto / Berkas Lampiran Tambahan (Disimpan ke Cloud Storage)
                      </span>
                      {selectedAttachmentFile && (
                        <button
                          type="button"
                          onClick={() => setSelectedAttachmentFile(null)}
                          className="text-[11px] text-rose-500 hover:underline cursor-pointer"
                        >
                          Batal pilih
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
                      <div className="md:col-span-5">
                        <label className="block text-[11px] font-semibold text-muted-foreground mb-1">
                          Pilih Berkas (Foto JPG, PNG, WEBP, atau Dokumen PDF)
                        </label>
                        <input
                          type="file"
                          accept="image/*,.pdf"
                          onChange={(e) => {
                            if (e.target.files && e.target.files[0]) {
                              setSelectedAttachmentFile(e.target.files[0]);
                            }
                          }}
                          className="w-full text-xs file:mr-2.5 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-primary file:text-primary-foreground hover:file:bg-primary/90 file:cursor-pointer text-muted-foreground"
                        />
                      </div>

                      <div className="md:col-span-5">
                        <label className="block text-[11px] font-semibold text-muted-foreground mb-1">
                          Catatan / Keterangan Lampiran (Opsional)
                        </label>
                        <input
                          type="text"
                          value={attachmentCaption}
                          onChange={(e) => setAttachmentCaption(e.target.value)}
                          placeholder="Contoh: Foto lampu belakang pecah sebelum diganti..."
                          className="w-full py-1.5 px-3 text-xs rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-hidden focus:ring-1 focus:ring-primary"
                        />
                      </div>

                      <div className="md:col-span-2">
                        <button
                          type="button"
                          onClick={handleUploadAttachment}
                          disabled={isUploadingAttachment || !selectedAttachmentFile}
                          className="w-full py-2 px-3 text-xs font-bold rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition shadow-xs cursor-pointer disabled:opacity-50 inline-flex items-center justify-center gap-1.5"
                        >
                          <UploadCloud className={`size-3.5 ${isUploadingAttachment ? 'animate-spin' : ''}`} />
                          <span>{isUploadingAttachment ? 'Mengunggah...' : 'Unggah'}</span>
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Galeri Lampiran */}
                  {formAttachments.length === 0 ? (
                    <div className="p-10 border border-border rounded-xl bg-card text-center space-y-2">
                      <ImageIcon className="size-10 mx-auto text-muted-foreground/40" />
                      <p className="text-xs font-semibold text-foreground">
                        Belum ada berkas lampiran tambahan untuk FPB ini.
                      </p>
                      <p className="text-[11px] text-muted-foreground max-w-md mx-auto">
                        Dokumen permohonan FPB resmi dari user pemohon dapat diperiksa pada tab <strong>&quot;Pratinjau Dokumen PDF Resmi&quot;</strong>. Jika Anda menerima foto kondisi fisik/bukti kerusakan tambahan (misal dari WhatsApp atau laporan tim lapangan), Anda dapat mengunggahnya melalui form di atas untuk disimpan permanen di Cloud Storage.
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                      {formAttachments.map((att, idx) => {
                        const isImg = att.type === 'image' || /\.(jpe?g|png|webp|gif|bmp)$/i.test(att.url || att.name);

                        return (
                          <div
                            key={att.id || idx}
                            className="group relative rounded-xl border border-border bg-card overflow-hidden shadow-xs hover:border-primary/40 transition flex flex-col justify-between"
                          >
                            {/* Preview Area */}
                            {isImg ? (
                              <div
                                onClick={() => setPreviewImageModal({ url: att.url, title: att.caption || att.name })}
                                className="relative h-44 w-full bg-black/10 overflow-hidden cursor-pointer"
                              >
                                <img
                                  src={att.url}
                                  alt={att.name}
                                  className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                                />
                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center gap-2">
                                  <span className="p-2 rounded-full bg-white/20 text-white backdrop-blur-xs">
                                    <ZoomIn className="size-4" />
                                  </span>
                                  <span className="text-white text-[11px] font-bold">Perbesar</span>
                                </div>
                              </div>
                            ) : (
                              <div className="h-36 w-full bg-muted/40 flex flex-col items-center justify-center p-4 text-center">
                                <FileText className="size-10 text-primary mb-2 opacity-80" />
                                <span className="text-xs font-bold text-foreground truncate max-w-full">
                                  {att.name}
                                </span>
                                <span className="text-[10px] text-muted-foreground mt-0.5">
                                  {att.size ? `${Math.round(att.size / 1024)} KB` : 'Dokumen PDF'}
                                </span>
                              </div>
                            )}

                            {/* Meta & Actions */}
                            <div className="p-3 space-y-2">
                              <div className="flex items-start justify-between gap-1.5">
                                <div className="min-w-0">
                                  <span className="font-semibold text-xs text-foreground block truncate" title={att.name}>
                                    {att.name}
                                  </span>
                                  {att.caption && (
                                    <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2">
                                      {att.caption}
                                    </p>
                                  )}
                                </div>

                                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded shrink-0 ${
                                  att.source === 'EFPB_MAKER'
                                    ? 'bg-cyan-500/10 text-cyan-700 dark:text-cyan-300 border border-cyan-500/20'
                                    : 'bg-purple-500/10 text-purple-700 dark:text-purple-300 border border-purple-500/20'
                                }`}>
                                  {att.source === 'EFPB_MAKER' ? 'FPB Maker' : 'Reviewer'}
                                </span>
                              </div>

                              <div className="flex items-center justify-between pt-2 border-t border-border/60 text-[10px] text-muted-foreground">
                                <span>{att.uploadedBy || 'User'}</span>

                                <div className="flex items-center gap-1.5">
                                  <a
                                    href={att.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition cursor-pointer"
                                    title="Buka di tab baru / Unduh"
                                  >
                                    <Download className="size-3.5" />
                                  </a>
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteAttachment(att.id)}
                                    className="p-1 rounded hover:bg-rose-500/10 text-rose-500 transition cursor-pointer"
                                    title="Hapus lampiran"
                                  >
                                    <Trash2 className="size-3.5" />
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Modal Footer: Keputusan Review Tim FPB */}
            <div className="p-5 border-t border-border bg-muted/30 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* 1. Skala Prioritas Dokumen (SLA Lead Time) */}
                <div>
                  <label className="block text-xs font-bold text-foreground mb-1.5 flex items-center gap-1.5">
                    <Zap className="size-3.5 text-amber-500" />
                    Prioritas FPB (SLA)
                  </label>
                  <select
                    value={formPriority}
                    onChange={(e) => {
                      const p = e.target.value as FpbPriorityLevel;
                      setFormPriority(p);
                      if (p === 'P1' && formUrgency === 'NORMAL') {
                        setFormUrgency('URGENT');
                      }
                    }}
                    className="w-full py-2 px-3 text-xs font-semibold rounded-lg border border-border bg-background text-foreground focus:outline-hidden focus:ring-2 focus:ring-primary/20"
                  >
                    <option value="P1">🚨 P1 - Utama (1-2 Hari)</option>
                    <option value="P2">⚠️ P2 - Menengah (3-14 Hari)</option>
                    <option value="P3">📦 P3 - Rutin (14-30 Hari)</option>
                  </select>
                  <div className="text-[10px] text-muted-foreground mt-1">
                    {formPriority === 'P1' && '⚡ Darurat / Breakdown (1-2 hr)'}
                    {formPriority === 'P2' && '⏱️ Pemeliharaan rutin (3-14 hr)'}
                    {formPriority === 'P3' && '📅 Buffer stok gudang (14-30 hr)'}
                  </div>
                </div>

                {/* 2. Status Keputusan */}
                <div>
                  <label className="block text-xs font-bold text-foreground mb-1.5">
                    Keputusan Tindak Lanjut Tim FPB
                  </label>
                  <select
                    value={formStatus}
                    onChange={(e) => {
                      const st = e.target.value as FpbReviewStatus;
                      setFormStatus(st);
                      if (st === 'APPROVED_PO') {
                        setFormIsReceivedLogistik(true);
                        if (selectedRecord) handleQuickApproveLogistic(selectedRecord, true);
                      } else if (st === 'PENDING_REVIEW') {
                        setFormIsReceivedLogistik(false);
                        if (selectedRecord) handleQuickApproveLogistic(selectedRecord, false);
                      }
                    }}
                    className="w-full py-2 px-3 text-xs font-semibold rounded-lg border border-border bg-background text-foreground focus:outline-hidden focus:ring-2 focus:ring-primary/20"
                  >
                    <option value="PENDING_REVIEW">⏳ Menunggu Analisa / Belum Selesai</option>
                    <option value="APPROVED_PO">✅ Disetujui Masuk Purchase Planning</option>
                    <option value="FULFILL_STOCK">📦 Dipenuhi dari Stok Gudang (Logistik)</option>
                    <option value="NEED_CLARIFICATION">❓ Perlu Klarifikasi ke Armada</option>
                    <option value="REJECTED">❌ Ditolak / Dibatalkan</option>
                  </select>
                </div>

                {/* 3. Tingkat Urgensi */}
                <div>
                  <label className="block text-xs font-bold text-foreground mb-1.5">
                    Tingkat Urgensi Pengadaan
                  </label>
                  <select
                    value={formUrgency}
                    onChange={(e) => {
                      const u = e.target.value as FpbUrgency;
                      setFormUrgency(u);
                      if (u === 'URGENT' || u === 'EMERGENCY') {
                        setFormPriority('P1');
                      }
                    }}
                    className="w-full py-2 px-3 text-xs font-semibold rounded-lg border border-border bg-background text-foreground focus:outline-hidden focus:ring-2 focus:ring-primary/20"
                  >
                    <option value="NORMAL">Normal (Rutin)</option>
                    <option value="URGENT">⚠️ Urgent (Mendesak - Auto P1)</option>
                    <option value="EMERGENCY">🚨 EMERGENCY (Darurat Kapal - Auto P1)</option>
                  </select>
                </div>

                {/* 4. No. Agenda Planning / PIC Purchasing */}
                <div>
                  <label className="block text-xs font-bold text-foreground mb-1.5 flex items-center justify-between">
                    <span>No. Agenda Planning</span>
                    {selectedRecord.tkbNo && (
                      <span className="inline-flex items-center gap-1 font-mono text-[11px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                        <Tag className="size-2.5" />
                        {selectedRecord.tkbNo}
                      </span>
                    )}
                  </label>
                  {formStatus === 'APPROVED_PO' ? (
                    <div className="py-2 px-3 text-xs rounded-lg border border-emerald-500/30 bg-emerald-500/5 text-foreground flex items-center justify-between">
                      <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                        <Tag className="size-3.5" />
                        {selectedRecord.tkbNo || 'Auto-Register PP (Saat Disetujui)'}
                      </span>
                      <span className="text-[10px] text-muted-foreground">Antrean Masuk Planning</span>
                    </div>
                  ) : (
                    <input
                      type="text"
                      list="pic-purchasing-list"
                      value={formPic}
                      onChange={(e) => setFormPic(e.target.value)}
                      placeholder="PIC Purchasing (Opsional)..."
                      className="w-full py-2 px-3 text-xs rounded-lg border border-border bg-background text-foreground focus:outline-hidden focus:ring-2 focus:ring-primary/20"
                    />
                  )}
                  <datalist id="pic-purchasing-list">
                    {PURCHASING_PICS.map((p) => (
                      <option key={p} value={p} />
                    ))}
                  </datalist>
                </div>
              </div>

              {/* Catatan Review */}
              <div>
                <label className="block text-xs font-bold text-foreground mb-1">
                  Catatan Analisa Tim FPB (untuk Purchasing & Logistik)
                </label>
                <textarea
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  rows={2}
                  placeholder="Contoh: Stok tersedia di gudang CPL Samarinda 2 pcs, sisa 2 pcs dibuatkan PO kilat ke vendor..."
                  className="w-full p-2.5 text-xs rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-hidden focus:ring-2 focus:ring-primary/20"
                />
              </div>

              {/* Bottom Footer: Data Pembuat e-FPB (Kotak Hitam) + Action Buttons */}
              {(() => {
                const matchedContact = findCrewOrArmadaContact(formRequestedBy, selectedRecord.armada);
                return (
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pt-3 border-t border-border/80">
                    {/* KOTAK HITAM: Data Pembuat e-FPB & Sinkronisasi WA dari Menu Awak & Armada */}
                    <div className="flex items-center justify-between gap-3 p-2.5 rounded-xl bg-muted/40 border border-border/80 hover:border-emerald-500/40 transition flex-1 max-w-xl shadow-2xs">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="size-9 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 flex items-center justify-center shrink-0">
                          <MessageSquare className="size-4" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-[10px] font-mono font-bold uppercase text-muted-foreground">
                              Pembuat e-FPB:
                            </span>
                            <strong className="text-xs font-bold text-foreground truncate">
                              {formRequestedBy || (isFetchingRequester ? 'Mengekstrak nama dari PDF...' : 'Belum Terdata')}
                            </strong>
                            {matchedContact?.matchedFrom === 'crew' && (
                              <span className="text-[9px] font-mono px-1.5 py-0.2 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-semibold border border-emerald-500/20">
                                Sync Awak & Armada
                              </span>
                            )}
                            {matchedContact?.matchedFrom === 'default' && (
                              <span className="text-[9px] font-mono px-1.5 py-0.2 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-semibold border border-emerald-500/20">
                                Terverifikasi
                              </span>
                            )}
                            {matchedContact?.matchedFrom === 'armada' && (
                              <span className="text-[9px] font-mono px-1.5 py-0.2 rounded-full bg-blue-500/15 text-blue-600 dark:text-blue-400 font-semibold border border-blue-500/20">
                                Radio Armada
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground mt-0.5">
                            <span className="font-medium text-foreground">{selectedRecord.armada}</span>
                            {formRequesterPhone ? (
                              <>
                                <span>&bull;</span>
                                <span className="font-mono font-semibold text-emerald-600 dark:text-emerald-400">
                                  {formRequesterPhone}
                                </span>
                                {matchedContact?.role && (
                                  <span className="text-[10px] italic text-muted-foreground truncate hidden sm:inline">
                                    ({matchedContact.role})
                                  </span>
                                )}
                              </>
                            ) : (
                              <>
                                <span>&bull;</span>
                                <span className="text-amber-600 dark:text-amber-400 text-[10px]">
                                  Nomor WA belum tersinkron
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* WhatsApp Action Button / Phone Input */}
                      <div className="shrink-0 flex items-center gap-1.5">
                        {isEditingPhone ? (
                          <div className="flex items-center gap-1">
                            <input
                              type="text"
                              value={tempPhoneInput}
                              onChange={(e) => setTempPhoneInput(e.target.value)}
                              placeholder="0812xxxx"
                              className="w-28 h-7 px-2 text-[11px] font-mono rounded border border-border bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-emerald-500"
                            />
                            <button
                              type="button"
                              onClick={() => {
                                const clean = tempPhoneInput.trim();
                                setFormRequesterPhone(clean);
                                setIsEditingPhone(false);
                                if (clean && formRequestedBy) {
                                  syncCrewContact(formRequestedBy, clean, selectedRecord.armada);
                                  showToast?.(`Nomor WA ${clean} berhasil disinkronkan ke menu Awak & Armada!`, 'success');
                                }
                              }}
                              className="h-7 px-2 text-[10px] font-bold rounded bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer active:scale-95"
                            >
                              Simpan
                            </button>
                            <button
                              type="button"
                              onClick={() => setIsEditingPhone(false)}
                              className="h-7 px-1.5 text-[10px] rounded border border-border text-muted-foreground hover:text-foreground cursor-pointer"
                            >
                              ✕
                            </button>
                          </div>
                        ) : formRequesterPhone ? (
                          <div className="flex items-center gap-1">
                            <a
                              href={getWaUrl(
                                formRequesterPhone,
                                `Halo ${formRequestedBy || 'Bpk/Ibu'} (${selectedRecord.armada}), kami dari Tim Analisa & Review FPB Logistik CPG ingin mengonfirmasi pengajuan berkas FPB ${selectedRecord.fpbNo} dengan peruntukan: "${selectedRecord.purpose || '-'}". Mohon info detail spesifikasi kebutuhan barang tersebut. Terima kasih.`
                              )}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="h-7 px-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold inline-flex items-center gap-1 transition shadow-xs cursor-pointer active:scale-95"
                              title="Hubungi pembuat e-FPB langsung secara online melalui WhatsApp"
                            >
                              <MessageSquare className="size-3" />
                              <span>Chat WA</span>
                            </a>
                            <button
                              type="button"
                              onClick={() => {
                                setTempPhoneInput(formRequesterPhone);
                                setIsEditingPhone(true);
                              }}
                              className="size-7 rounded-lg border border-border bg-background hover:bg-muted text-muted-foreground hover:text-foreground flex items-center justify-center text-[10px] cursor-pointer"
                              title="Ubah / sinkronkan nomor WhatsApp baru"
                            >
                              ✎
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              setTempPhoneInput(formRequesterPhone);
                              setIsEditingPhone(true);
                            }}
                            className="h-7 px-2.5 rounded-lg border border-border bg-background hover:bg-muted text-foreground text-[11px] font-semibold inline-flex items-center gap-1 cursor-pointer active:scale-95"
                            title="Atur nomor WhatsApp pemohon untuk komunikasi langsung"
                          >
                            <Phone className="size-3 text-emerald-500" />
                            <span>+ No. WA</span>
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center justify-end gap-2.5 shrink-0 flex-wrap">
                      {/* Tombol Notifikasi WA ke Tim Purchasing (dengan No. Agenda Planning) */}
                      {(formStatus === 'APPROVED_PO' || selectedRecord.reviewStatus === 'APPROVED_PO') && (
                        <div className="flex items-center gap-1">
                          <a
                            href={generateFpbApprovalWaLink({
                              ...selectedRecord,
                              reviewStatus: 'APPROVED_PO',
                              tkbNo: selectedRecord.tkbNo || 'Auto-Register PP',
                              reviewNotes: formNotes,
                              urgency: formUrgency,
                              priorityLevel: formPriority,
                            })}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-lg bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white shadow-xs hover:shadow transition select-none cursor-pointer"
                            title={`Kirim notifikasi WhatsApp ke Tim Purchasing/Procurement bahwa pengajuan ini disetujui masuk Purchase Planning (${selectedRecord.tkbNo ? `No. Agenda: ${selectedRecord.tkbNo}` : 'Auto-Register PP'})`}
                          >
                            <MessageSquare className="size-3.5" />
                            <span>Kirim WA Purchasing</span>
                            {selectedRecord.tkbNo && (
                              <span className="font-mono text-[10px] bg-emerald-800/80 px-1.5 py-0.5 rounded text-emerald-100 font-bold">
                                {selectedRecord.tkbNo}
                              </span>
                            )}
                          </a>
                          <button
                            type="button"
                            onClick={() => {
                              const text = formatFpbApprovalWaMessage({
                                ...selectedRecord,
                                reviewStatus: 'APPROVED_PO',
                                tkbNo: selectedRecord.tkbNo || 'Auto-Register PP',
                                reviewNotes: formNotes,
                                urgency: formUrgency,
                                priorityLevel: formPriority,
                              });
                              navigator.clipboard.writeText(text);
                              showToast?.('Format pesan WhatsApp persetujuan Purchase Planning & No. Agenda berhasil disalin ke clipboard!', 'success');
                            }}
                            className="p-2 rounded-lg border border-border bg-background hover:bg-muted text-muted-foreground hover:text-foreground transition cursor-pointer"
                            title="Salin format pesan WhatsApp ke clipboard"
                          >
                            <Copy className="size-3.5" />
                          </button>
                        </div>
                      )}

                      {/* Tombol Kompak: Setujui Masuk Purchase Planning */}
                      <button
                        type="button"
                        onClick={() => {
                          if (formStatus === 'APPROVED_PO') {
                            setFormStatus('PENDING_REVIEW');
                            setFormIsReceivedLogistik(false);
                            if (selectedRecord) handleQuickApproveLogistic(selectedRecord, false);
                            showToast?.('Status approval dikembalikan ke Menunggu Analisa.', 'info');
                          } else {
                            setFormStatus('APPROVED_PO');
                            setFormIsReceivedLogistik(true);
                            if (selectedRecord) handleQuickApproveLogistic(selectedRecord, true);
                            showToast?.('Pengajuan FPB disetujui masuk Purchase Planning!', 'success');
                          }
                        }}
                        disabled={isApprovingLogistic}
                        className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-lg transition shadow-xs cursor-pointer select-none disabled:opacity-50 ${
                          formStatus === 'APPROVED_PO'
                            ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-500/20'
                            : formStatus === 'FULFILL_STOCK'
                            ? 'bg-cyan-600 hover:bg-cyan-700 text-white'
                            : 'bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-white shadow-amber-500/20'
                        }`}
                        title={
                          formStatus === 'APPROVED_PO'
                            ? 'Telah disetujui masuk Purchase Planning. Klik untuk membatalkan.'
                            : 'Klik untuk menyetujui pengajuan ini masuk ke Purchase Planning'
                        }
                      >
                        <CheckCircle2 className="size-3.5" />
                        <span>
                          {formStatus === 'APPROVED_PO'
                            ? '✓ Disetujui Masuk PP'
                            : formStatus === 'FULFILL_STOCK'
                            ? '✓ Disetujui Penuhi Stok'
                            : 'Setujui Masuk Purchase Planning'}
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={handleCloseModal}
                        className="px-4 py-2 text-xs font-medium rounded-lg border border-border bg-background text-foreground hover:bg-muted transition cursor-pointer"
                      >
                        Batal
                      </button>

                      <button
                        type="button"
                        onClick={handleSaveDecision}
                        disabled={isSavingDecision}
                        className="inline-flex items-center gap-1.5 px-6 py-2 text-xs font-bold rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition shadow-md cursor-pointer disabled:opacity-50"
                      >
                        <FileCheck className={`size-4 ${isSavingDecision ? 'animate-spin' : ''}`} />
                        <span>{isSavingDecision ? 'Menyimpan...' : 'Simpan'}</span>
                      </button>
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 6. Modal Input FPB Baru Secara Mandiri                  */}
      {/* ======================================================== */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in-50">
          <div className="relative w-full max-w-2xl max-h-[90vh] rounded-2xl bg-card border border-border shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 border-b border-border bg-muted/40">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-primary/10 text-primary">
                  <Plus className="size-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-foreground">
                    Catat Pengajuan FPB Baru (Mode Mandiri)
                  </h3>
                  <p className="text-[11px] text-muted-foreground">
                    Input pengajuan kebutuhan armada kapal langsung ke database internal tanpa tergantung web e-FPB.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(false)}
                className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition cursor-pointer"
              >
                <X className="size-4" />
              </button>
            </div>

            {/* Modal Form Body */}
            <form onSubmit={handleCreateFpb} className="overflow-y-auto p-5 space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Nomor FPB */}
                <div className="space-y-1">
                  <label className="font-bold text-foreground flex items-center gap-1">
                    <span>Nomor FPB</span>
                    <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={newFpbNo}
                    onChange={(e) => setNewFpbNo(e.target.value.toUpperCase())}
                    placeholder="Contoh: MIL-FPB-26-0000072"
                    className="w-full px-3 py-2 rounded-xl border border-border bg-background text-foreground font-mono focus:outline-hidden focus:ring-1 focus:ring-primary"
                  />
                </div>

                {/* Entitas Perusahaan */}
                <div className="space-y-1">
                  <label className="font-bold text-foreground">Entitas PT</label>
                  <select
                    value={newEntity}
                    onChange={(e) => setNewEntity(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-border bg-background text-foreground focus:outline-hidden focus:ring-1 focus:ring-primary cursor-pointer"
                  >
                    {ENTITY_OPTIONS.filter((o) => o.code !== 'ALL').map((opt) => (
                      <option key={opt.code} value={opt.code}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Armada / Kapal */}
                <div className="space-y-1">
                  <label className="font-bold text-foreground">Armada Kapal / Dept</label>
                  <input
                    type="text"
                    required
                    value={newArmada}
                    onChange={(e) => setNewArmada(e.target.value)}
                    placeholder="Contoh: TB MUARA MEGA"
                    className="w-full px-3 py-2 rounded-xl border border-border bg-background text-foreground focus:outline-hidden focus:ring-1 focus:ring-primary"
                  />
                </div>

                {/* Tanggal FPB */}
                <div className="space-y-1">
                  <label className="font-bold text-foreground">Tanggal Pengajuan</label>
                  <input
                    type="text"
                    value={newDate}
                    onChange={(e) => setNewDate(e.target.value)}
                    placeholder="DD/MM/YY"
                    className="w-full px-3 py-2 rounded-xl border border-border bg-background text-foreground font-mono focus:outline-hidden focus:ring-1 focus:ring-primary"
                  />
                </div>

                {/* Skala Prioritas */}
                <div className="space-y-1">
                  <label className="font-bold text-foreground">Skala Prioritas &amp; SLA</label>
                  <select
                    value={newPriority}
                    onChange={(e) => setNewPriority(e.target.value as FpbPriorityLevel)}
                    className="w-full px-3 py-2 rounded-xl border border-border bg-background text-foreground focus:outline-hidden focus:ring-1 focus:ring-primary cursor-pointer"
                  >
                    <option value="P1">P1 - Utama (1-2 Hari) Kritis / Breakdown</option>
                    <option value="P2">P2 - Menengah (3-14 Hari) Pemeliharaan</option>
                    <option value="P3">P3 - Rutin (14-30 Hari) Buffer Stok</option>
                  </select>
                </div>

                {/* Urgensi */}
                <div className="space-y-1">
                  <label className="font-bold text-foreground">Tingkat Urgensi</label>
                  <select
                    value={newUrgency}
                    onChange={(e) => setNewUrgency(e.target.value as FpbUrgency)}
                    className="w-full px-3 py-2 rounded-xl border border-border bg-background text-foreground focus:outline-hidden focus:ring-1 focus:ring-primary cursor-pointer"
                  >
                    <option value="NORMAL">Normal</option>
                    <option value="URGENT">URGENT</option>
                    <option value="EMERGENCY">EMERGENCY (Kapal Tidak Bisa Operasi)</option>
                  </select>
                </div>
              </div>

              {/* Peruntukan / Keperluan */}
              <div className="space-y-1">
                <label className="font-bold text-foreground">Peruntukan / Keperluan Operasional</label>
                <textarea
                  rows={2}
                  value={newPurpose}
                  onChange={(e) => setNewPurpose(e.target.value)}
                  placeholder="Contoh: Kebutuhan suku cadang perbaikan mesin bantu (AE Kanan) & consumable bulanan kapal"
                  className="w-full px-3 py-2 rounded-xl border border-border bg-background text-foreground focus:outline-hidden focus:ring-1 focus:ring-primary"
                />
              </div>

              {/* Daftar Barang Material */}
              <div className="space-y-2 pt-2 border-t border-border">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-foreground flex items-center gap-1.5">
                    <Boxes className="size-4 text-primary" />
                    <span>Rincian Item Barang ({newItems.length} Barang)</span>
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setNewItems([
                        ...newItems,
                        { itemName: '', qty: 1, unit: 'PCS', description: '' },
                      ])
                    }
                    className="px-2.5 py-1 rounded-lg border border-primary/30 text-primary hover:bg-primary/10 font-bold transition flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="size-3.5" />
                    <span>Tambah Baris</span>
                  </button>
                </div>

                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {newItems.map((item, idx) => (
                    <div
                      key={idx}
                      className="p-2.5 rounded-xl border border-border bg-muted/20 grid grid-cols-12 gap-2 items-center"
                    >
                      <div className="col-span-5">
                        <input
                          type="text"
                          required
                          value={item.itemName}
                          onChange={(e) => {
                            const updated = [...newItems];
                            updated[idx].itemName = e.target.value;
                            setNewItems(updated);
                          }}
                          placeholder={`Nama barang #${idx + 1}`}
                          className="w-full px-2.5 py-1.5 rounded-lg border border-border bg-background text-foreground"
                        />
                      </div>
                      <div className="col-span-2">
                        <input
                          type="number"
                          min={1}
                          value={item.qty}
                          onChange={(e) => {
                            const updated = [...newItems];
                            updated[idx].qty = Number(e.target.value) || 1;
                            setNewItems(updated);
                          }}
                          placeholder="Qty"
                          className="w-full px-2 py-1.5 rounded-lg border border-border bg-background text-foreground font-mono text-center"
                        />
                      </div>
                      <div className="col-span-2">
                        <input
                          type="text"
                          value={item.unit}
                          onChange={(e) => {
                            const updated = [...newItems];
                            updated[idx].unit = e.target.value.toUpperCase();
                            setNewItems(updated);
                          }}
                          placeholder="Satuan"
                          className="w-full px-2 py-1.5 rounded-lg border border-border bg-background text-foreground font-mono text-center"
                        />
                      </div>
                      <div className="col-span-2">
                        <input
                          type="text"
                          value={item.description}
                          onChange={(e) => {
                            const updated = [...newItems];
                            updated[idx].description = e.target.value;
                            setNewItems(updated);
                          }}
                          placeholder="Keterangan"
                          className="w-full px-2 py-1.5 rounded-lg border border-border bg-background text-foreground"
                        />
                      </div>
                      <div className="col-span-1 flex justify-center">
                        {newItems.length > 1 && (
                          <button
                            type="button"
                            onClick={() => setNewItems(newItems.filter((_, i) => i !== idx))}
                            className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-500/10 transition cursor-pointer"
                            title="Hapus baris"
                          >
                            <Trash2 className="size-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Modal Footer */}
              <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-border">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  disabled={isSyncing}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-muted hover:bg-muted/80 text-foreground transition cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSyncing}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-primary text-primary-foreground hover:bg-primary/90 transition shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {isSyncing ? (
                    <>
                      <Loader2 className="size-3.5 animate-spin" />
                      <span>Menyimpan...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="size-3.5" />
                      <span>Simpan FPB Baru</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL KONFIRMASI PERSETUJUAN LOGISTIK */}
      <LogisticsApprovalConfirmModal
        isOpen={Boolean(confirmApprovalRecord)}
        record={confirmApprovalRecord}
        onClose={() => setConfirmApprovalRecord(null)}
        onConfirm={async (targetRec, signerName, sessId) => {
          await handleQuickApproveLogistic(targetRec, true, signerName, sessId);
          setConfirmApprovalRecord(null);
        }}
        isLoading={isApprovingLogistic}
        efpbSessionId={efpbSessionId}
        onOpenSyncModal={() => setIsSyncModalOpen(true)}
      />

      {/* IMAGE PREVIEW LIGHTBOX MODAL */}
      {previewImageModal && (
        <div
          onClick={() => setPreviewImageModal(null)}
          className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-in fade-in-50 cursor-zoom-out"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative max-w-4xl max-h-[90vh] bg-card border border-border rounded-2xl shadow-2xl overflow-hidden flex flex-col cursor-default"
          >
            <div className="flex items-center justify-between p-3.5 border-b border-border bg-muted/60">
              <span className="text-xs font-bold text-foreground truncate max-w-md">
                {previewImageModal.title}
              </span>
              <div className="flex items-center gap-2">
                <a
                  href={previewImageModal.url}
                  download
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition cursor-pointer"
                  title="Unduh Berkas Asli"
                >
                  <Download className="size-4" />
                </a>
                <button
                  type="button"
                  onClick={() => setPreviewImageModal(null)}
                  className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition cursor-pointer"
                >
                  <X className="size-4" />
                </button>
              </div>
            </div>
            <div className="p-2 overflow-auto max-h-[80vh] flex items-center justify-center bg-black/20">
              <img
                src={previewImageModal.url}
                alt={previewImageModal.title}
                className="max-w-full max-h-[75vh] object-contain rounded-lg shadow-md"
              />
            </div>
          </div>
        </div>
      )}

      {/* MODAL KONFIRMASI CLEAN SHEET (ARSIP BATCH FPB) */}
      {isCleanSheetModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150"
          onClick={() => setIsCleanSheetModalOpen(false)}
        >
          <div
            className="relative w-full max-w-md bg-card border border-border rounded-2xl shadow-2xl p-5 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-2xl bg-amber-500/10 text-amber-600 border border-amber-500/20">
                <Archive className="size-6" />
              </div>
              <div>
                <h3 className="font-bold text-foreground text-sm">
                  Mulai Lembar Bersih (Clean Sheet)?
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Arsipkan seluruh FPB aktif untuk memulai siklus perencanaan pengadaan baru.
                </p>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-muted/60 border border-border text-xs space-y-2 text-muted-foreground">
              <p>
                Tindakan ini akan memindahkan <strong className="text-foreground">{activeCount} berkas FPB aktif</strong> ke database riwayat/arsip.
              </p>
              <div className="p-2.5 rounded-lg bg-background border border-border text-[11px] text-amber-800 dark:text-amber-300 flex items-start gap-1.5">
                <ShieldCheck className="size-3.5 shrink-0 mt-0.5 text-emerald-600" />
                <span>
                  <strong>Data Aman 100%:</strong> Seluruh berkas FPB lama tidak dihapus. Anda dapat melihat kembali atau memulihkannya kapan saja melalui tab <strong>Arsip Riwayat</strong>.
                </span>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-border">
              <button
                type="button"
                onClick={() => setIsCleanSheetModalOpen(false)}
                disabled={isCleaningSheet}
                className="px-3.5 py-1.5 rounded-xl border border-border bg-background hover:bg-muted text-xs font-semibold text-foreground transition cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleExecuteCleanSheet}
                disabled={isCleaningSheet}
                className="px-4 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs inline-flex items-center gap-1.5 shadow-sm transition cursor-pointer disabled:opacity-50"
              >
                {isCleaningSheet ? (
                  <>
                    <RefreshCw className="size-3.5 animate-spin" />
                    <span>Mengarsipkan...</span>
                  </>
                ) : (
                  <>
                    <Archive className="size-3.5" />
                    <span>Ya, Arsipkan &amp; Clean Sheet</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL FINALISASI & TERBITKAN BATCH PURCHASE PLANNING ── */}
      {isFinalizeBatchModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-card border border-border rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-border flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-indigo-500/10 border border-indigo-500/25 text-indigo-600 dark:text-indigo-400">
                  <Lock className="size-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-foreground">
                    Finalisasi &amp; Terbitkan Batch PP
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Siklus Mingguan &bull; Cut-Off Jumat pk 10:00
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsFinalizeBatchModalOpen(false)}
                className="p-1 rounded-lg text-muted-foreground hover:bg-muted transition cursor-pointer"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs">
              <div className="p-3.5 rounded-xl bg-indigo-500/10 border border-indigo-500/25 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-muted-foreground">Siklus Berjalan:</span>
                  <span className="font-bold text-foreground">{cycleInfo.batchName}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-muted-foreground">Total FPB Siap Diterbitkan:</span>
                  <span className="font-bold text-emerald-600 dark:text-emerald-400">{cycleInfo.activeApprovedCount} Berkas FPB</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-muted-foreground">Total Item Material Bersih:</span>
                  <span className="font-bold text-foreground">{cycleInfo.approvedItemsCount} Item Siap Order</span>
                </div>
              </div>

              <div>
                <label className="block font-bold text-foreground mb-1">
                  Nomor / Kode Batch Resmi:
                </label>
                <input
                  type="text"
                  value={customBatchCode}
                  onChange={(e) => setCustomBatchCode(e.target.value)}
                  placeholder="Misal: CPG-PP-2026-B03"
                  className="w-full text-xs font-mono font-bold px-3 py-2 rounded-xl bg-background border border-border text-foreground focus:outline-hidden focus:ring-2 focus:ring-primary/20"
                />
                <p className="text-[11px] text-muted-foreground mt-1">
                  Kode ini akan disematkan ke setiap berkas FPB dan terbaca otomatis di menu Perencanaan Pengadaan (Purchase Planning).
                </p>
              </div>

              <label className="flex items-center gap-2 cursor-pointer p-2.5 rounded-xl border border-border bg-muted/30">
                <input
                  type="checkbox"
                  checked={autoDownloadExcelOnFinalize}
                  onChange={(e) => setAutoDownloadExcelOnFinalize(e.target.checked)}
                  className="size-4 rounded border-border text-primary cursor-pointer accent-primary"
                />
                <span className="text-xs font-medium text-foreground">
                  Otomatis unduh berkas resmi Excel (.xlsx) Multi-Sheet saat batch difinalisasi
                </span>
              </label>

              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/25 text-amber-800 dark:text-amber-200 text-[11px] leading-relaxed">
                ℹ️ <strong>Ketentuan Cut-Off:</strong> Seluruh berkas FPB pada siklus ini akan diarsipkan dengan kode batch di atas, lalu lembar kerja akan dibersihkan (*Clean Sheet*) untuk memulai siklus minggu berikutnya.
              </div>
            </div>

            <div className="p-4 border-t border-border bg-muted/20 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsFinalizeBatchModalOpen(false)}
                disabled={isCleaningSheet}
                className="px-3.5 py-2 rounded-xl border border-border bg-background hover:bg-muted text-foreground text-xs font-semibold cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleFinalizeBatch}
                disabled={isCleaningSheet}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold cursor-pointer transition shadow-xs disabled:opacity-50"
              >
                {isCleaningSheet ? (
                  <>
                    <Loader2 className="size-3.5 animate-spin" />
                    <span>Menerbitkan Batch...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="size-3.5" />
                    <span>Konfirmasi &amp; Terbitkan Batch</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

