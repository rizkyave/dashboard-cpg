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
  XCircle,
  HelpCircle,
  Eye,
  ExternalLink,
  ChevronRight,
  Layers,
  Building2,
  Ship,
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
} from 'lucide-react';
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

interface ReviewFpbTabProps {
  showToast?: (msg: string, type?: 'info' | 'success' | 'warning' | 'error') => void;
}

const ENTITY_OPTIONS = [
  { code: 'ALL', label: 'Semua Entitas' },
  { code: 'CPL', label: 'CPL (Cindara Pratama Lines)' },
  { code: 'MO', label: 'MO (Mandar Ocean)' },
  { code: 'GAJ', label: 'GAJ (Galangan Aliran Jaya)' },
  { code: 'HL', label: 'HL (Hana Lines)' },
  { code: 'SP', label: 'SP (Sinar Pasifik)' },
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

export default function ReviewFpbTab({ showToast }: ReviewFpbTabProps) {
  const { user } = useAuth();

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
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedEntity, setSelectedEntity] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [selectedUrgency, setSelectedUrgency] = useState<string>('ALL');
  const [selectedPriority, setSelectedPriority] = useState<string>('ALL');
  const [onlyDuplicates, setOnlyDuplicates] = useState<boolean>(false);

  // Modal / Drawer state
  const [selectedRecord, setSelectedRecord] = useState<FpbReviewRecord | null>(null);
  const [activeModalTab, setActiveModalTab] = useState<'items' | 'pdf' | 'attachments' | 'relations'>('items');
  const [isParsingItems, setIsParsingItems] = useState<boolean>(false);
  const [isSavingDecision, setIsSavingDecision] = useState<boolean>(false);

  // Form states inside modal
  const [formStatus, setFormStatus] = useState<FpbReviewStatus>('PENDING_REVIEW');
  const [formUrgency, setFormUrgency] = useState<FpbUrgency>('NORMAL');
  const [formPriority, setFormPriority] = useState<FpbPriorityLevel>('P3');
  const [formPic, setFormPic] = useState<string>('');
  const [formNotes, setFormNotes] = useState<string>('');
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

  // E-FPB Credentials & Sync Modal State
  const [isSyncModalOpen, setIsSyncModalOpen] = useState<boolean>(false);
  const [efpbUsername, setEfpbUsername] = useState<string>('Hermansyah');
  const [efpbPassword, setEfpbPassword] = useState<string>('Biocpl24!@#');
  const [efpbSessionId, setEfpbSessionId] = useState<string>('');
  const [efpbAuthMethod, setEfpbAuthMethod] = useState<'cookie' | 'account'>('cookie');
  const [authErrorMsg, setAuthErrorMsg] = useState<string | null>(null);

  // Load saved credentials from localStorage on client
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const u = localStorage.getItem('EFPB_USERNAME');
      const p = localStorage.getItem('EFPB_PASSWORD');
      const s = localStorage.getItem('EFPB_SESSION_ID');
      if (u) setEfpbUsername(u);
      if (p) setEfpbPassword(p);
      if (s) setEfpbSessionId(s);
    }
  }, []);

  // Handle Sync with E-FPB
  const handleSyncEfpb = async (mode: 'quick' | 'full', customSessionId?: string) => {
    setIsSyncing(true);
    setSyncMode(mode);
    setAuthErrorMsg(null);
    try {
      const sess = customSessionId !== undefined ? customSessionId : efpbSessionId;
      const res = await fetch('/api/review-fpb', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'sync_efpb',
          mode,
          username: efpbUsername,
          password: efpbPassword,
          sessionId: sess,
        }),
      });
      const json = await res.json();
      if (json.success) {
        showToast?.(json.message, 'success');
        if (Array.isArray(json.data)) {
          setReviews(json.data);
          if (json.metrics) setMetrics(json.metrics);
        } else {
          fetchReviews();
        }
        setIsSyncModalOpen(false);
      } else {
        const msg = json.message || 'Gagal sinkronisasi dengan server e-FPB';
        setAuthErrorMsg(msg);
        showToast?.(msg, 'warning');
        if (json.requiresAuth || msg.includes('terkunci') || msg.includes('login') || msg.includes('401')) {
          setIsSyncModalOpen(true);
        }
      }
    } catch (err: any) {
      console.error('Error syncing e-FPB:', err);
      showToast?.('Gagal melakukan sinkronisasi dengan server e-FPB', 'error');
    } finally {
      setIsSyncing(false);
    }
  };

  // Open Review Detail Modal
  const handleOpenReview = (rec: FpbReviewRecord) => {
    setSelectedRecord(rec);
    setFormStatus(rec.reviewStatus || 'PENDING_REVIEW');
    setFormUrgency(rec.urgency || 'NORMAL');
    setFormPriority(rec.priorityLevel || 'P3');
    setFormPic(rec.picPurchasing || '');
    setFormNotes(rec.reviewNotes || '');
    setFormItems(rec.items ? JSON.parse(JSON.stringify(rec.items)) : []);
    setFormAttachments(rec.attachments ? JSON.parse(JSON.stringify(rec.attachments)) : []);
    setSelectedAttachmentFile(null);
    setAttachmentCaption('');
    setActiveModalTab('items');
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
        showToast?.(data.message || 'Lampiran berhasil diunggah ke Cloudflare R2!', 'success');
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
        showToast?.(json.message || 'Item barang berhasil diekstrak dan dicocokkan dengan stok!', 'success');

        // Auto-detect skala prioritas dari item barang (P1: Utama 1-2 hari, P2: Menengah 3-14 hari, P3: Rutin 14-30 hari)
        let autoP: FpbPriorityLevel = 'P3';
        for (const it of json.items) {
          const p = (it.priority || '').toUpperCase().trim();
          if (p === 'P1' || p.includes('P1') || p.includes('EMERGENCY') || p.includes('DARURAT')) {
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

  // Save Review Decision to Cloudflare R2
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
      };

      const res = await fetch('/api/review-fpb', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (json.success) {
        showToast?.(json.message || 'Keputusan review berhasil disimpan ke Cloudflare R2!', 'success');
        // Update local state
        setReviews((prev) =>
          prev.map((r) =>
            r.fpbNo.toLowerCase() === selectedRecord.fpbNo.toLowerCase()
              ? {
                  ...r,
                  reviewStatus: formStatus,
                  urgency: formUrgency,
                  priorityLevel: formPriority,
                  picPurchasing: formPic,
                  reviewNotes: formNotes,
                  items: formItems,
                  attachments: formAttachments,
                  reviewedBy: user?.name || user?.username || 'Tim FPB',
                  reviewedAt: new Date().toISOString(),
                  updatedAt: new Date().toISOString(),
                }
              : r
          )
        );
        if (json.metrics) setMetrics(json.metrics);
        handleCloseModal();
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
      'PIC Purchasing',
      'Catatan Review',
      'Jumlah Item',
      'Item Tersedia di Stok',
      'Item PO Beli Baru',
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
      // 1. Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const fpbMatch = r.fpbNo.toLowerCase().includes(q);
        const armadaMatch = r.armada.toLowerCase().includes(q);
        const purposeMatch = (r.purpose || '').toLowerCase().includes(q);
        const picMatch = (r.picPurchasing || '').toLowerCase().includes(q);
        const notesMatch = (r.reviewNotes || '').toLowerCase().includes(q);
        const poMatch = r.relatedDocs?.poNos?.some((p) => p.toLowerCase().includes(q));
        if (!fpbMatch && !armadaMatch && !purposeMatch && !picMatch && !notesMatch && !poMatch) {
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
  }, [reviews, searchQuery, selectedEntity, selectedStatus, selectedUrgency, selectedPriority, onlyDuplicates]);

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
            Disetujui Terbit PO
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
      {/* 1. Header & Actions Hub                                   */}
      {/* ======================================================== */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 rounded-2xl bg-card border border-border shadow-xs">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-primary/10 text-primary">
              <ClipboardCheck className="size-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold tracking-tight text-foreground">
                  Review & Analisa FPB
                </h2>
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                  e-FPB Server Connected
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Sinkronisasi berkas e-FPB, analisa ketersediaan stok gudang master persediaan, deteksi duplikasi permintaan armada, dan disposisi tindak lanjut PO / Logistik.
              </p>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={fetchReviews}
            disabled={isLoading || isSyncing}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border border-border bg-background hover:bg-muted text-foreground transition shadow-xs cursor-pointer disabled:opacity-50"
            title="Refresh data dari database Cloudflare R2"
          >
            <RefreshCw className={`size-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </button>

          <button
            type="button"
            onClick={handleExportCsv}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border border-border bg-background hover:bg-muted text-foreground transition shadow-xs cursor-pointer"
            title="Ekspor daftar review ke CSV"
          >
            <Download className="size-3.5 text-muted-foreground" />
            Export CSV
          </button>

          {/* Sync e-FPB Quick Button */}
          <button
            type="button"
            onClick={() => handleSyncEfpb('quick')}
            disabled={isSyncing}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition shadow-xs cursor-pointer disabled:opacity-50"
            title="Tarik 20 berkas FPB terbaru dari server e-FPB FilesList"
          >
            <CloudDownload className={`size-4 ${isSyncing && syncMode === 'quick' ? 'animate-bounce' : ''}`} />
            <span>{isSyncing && syncMode === 'quick' ? 'Menyinkronkan...' : 'Sync E-FPB (20 Terbaru)'}</span>
          </button>

          {/* Sync e-FPB Full Button */}
          <button
            type="button"
            onClick={() => handleSyncEfpb('full')}
            disabled={isSyncing}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border border-primary/30 text-primary hover:bg-primary/10 transition shadow-xs cursor-pointer disabled:opacity-50"
            title="Tarik seluruh riwayat FPB dari semua halaman e-FPB FilesList"
          >
            <Layers className="size-3.5" />
            Full Sync All
          </button>

          {/* Settings & Credentials Modal Button */}
          <button
            type="button"
            onClick={() => setIsSyncModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border border-border bg-background hover:bg-muted text-foreground transition shadow-xs cursor-pointer"
            title="Konfigurasi Login & Session Cookie (PHPSESSID) e-FPB"
          >
            <KeyRound className="size-3.5 text-muted-foreground" />
            <span>Kredensial</span>
          </button>
        </div>
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
            <div className="text-2xl font-bold text-rose-600 dark:text-rose-400">{metrics.p1Count}</div>
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
            <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">{metrics.p2Count}</div>
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
            <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{metrics.p3Count}</div>
            <div className="text-[11px] text-muted-foreground mt-0.5">Buffer stok cadangan gudang</div>
          </div>

          {/* Lewat Batas SLA */}
          <div
            onClick={() => setSelectedPriority(selectedPriority === 'OVERDUE' ? 'ALL' : 'OVERDUE')}
            className={`p-4 rounded-xl border transition cursor-pointer ${
              selectedPriority === 'OVERDUE'
                ? 'bg-rose-500/15 border-rose-500 shadow-sm ring-2 ring-rose-500/20'
                : metrics.overdueCount > 0
                ? 'bg-card border-rose-500/30 hover:border-rose-500 shadow-xs'
                : 'bg-card border-border hover:border-border/80 shadow-xs'
            }`}
          >
            <div className="flex items-center justify-between text-rose-600 dark:text-rose-400 mb-1.5">
              <span className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5">
                <Timer className="size-4 text-rose-500" />
                Lewat Batas SLA
              </span>
              {metrics.overdueCount > 0 && (
                <span className="text-[10px] px-1.5 py-0.5 rounded font-bold bg-rose-600 text-white animate-pulse">
                  Perlu Tindakan
                </span>
              )}
            </div>
            <div className="text-2xl font-bold text-rose-600 dark:text-rose-400">{metrics.overdueCount}</div>
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
            <div className="text-xl font-bold text-foreground">{metrics.total}</div>
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
            <div className="text-xl font-bold text-amber-600 dark:text-amber-400">{metrics.pending}</div>
            <div className="text-[10px] text-muted-foreground">Perlu review tim</div>
          </div>

          {/* Disetujui Terbit PO */}
          <div
            onClick={() => setSelectedStatus(selectedStatus === 'APPROVED_PO' ? 'ALL' : 'APPROVED_PO')}
            className={`p-3.5 rounded-xl border transition cursor-pointer ${
              selectedStatus === 'APPROVED_PO'
                ? 'bg-emerald-500/15 border-emerald-500 shadow-xs'
                : 'bg-card border-emerald-500/20 hover:border-emerald-500/40 shadow-xs'
            }`}
          >
            <div className="flex items-center justify-between text-emerald-600 dark:text-emerald-400 mb-1">
              <span className="text-xs font-medium">Disetujui PO</span>
              <FileCheck className="size-4 text-emerald-500" />
            </div>
            <div className="text-xl font-bold text-emerald-600 dark:text-emerald-400">{metrics.approvedPo}</div>
            <div className="text-[10px] text-muted-foreground">Diproses purchasing</div>
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
            <div className="text-xl font-bold text-cyan-600 dark:text-cyan-400">{metrics.fulfillStock}</div>
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
            <div className="text-xl font-bold text-foreground">{metrics.needClarification}</div>
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
            <div className="text-xl font-bold text-foreground">{metrics.rejected}</div>
            <div className="text-[10px] text-muted-foreground">Pengajuan batal</div>
          </div>
        </div>
      </div>

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
              placeholder="Cari No. FPB, Armada Kapal, Keperluan, PIC, atau No. PO..."
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
                <option value="APPROVED_PO">Disetujui Terbit PO</option>
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
            <p className="text-xs text-muted-foreground mt-1">Mengambil data dari Cloudflare R2 dan sinkronisasi status</p>
          </div>
        ) : filteredReviews.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <FileSearch className="size-10 mx-auto text-muted-foreground/60" />
            <p className="text-sm font-semibold text-foreground">Tidak ada FPB yang cocok dengan kriteria filter</p>
            <p className="text-xs text-muted-foreground max-w-md mx-auto">
              Coba atur ulang kata kunci pencarian atau klik tombol "Sync E-FPB" untuk menarik berkas terbaru dari server e-FPB.
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
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border border-border bg-background text-foreground hover:bg-muted transition"
            >
              Reset Semua Filter
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-muted/50 text-muted-foreground border-b border-border font-medium">
                <tr>
                  <th className="py-3 px-4">No. FPB & Entitas</th>
                  <th className="py-3 px-3">Prioritas & SLA</th>
                  <th className="py-3 px-4">Armada Kapal / Dept</th>
                  <th className="py-3 px-3">Tanggal</th>
                  <th className="py-3 px-4">Peruntukan / Keperluan</th>
                  <th className="py-3 px-3">Status e-FPB</th>
                  <th className="py-3 px-3">Status Review Tim FPB</th>
                  <th className="py-3 px-3">Urgensi</th>
                  <th className="py-3 px-3">PIC Purchasing</th>
                  <th className="py-3 px-3">Item & Stok</th>
                  <th className="py-3 px-3">Dokumen Terkait</th>
                  <th className="py-3 px-4 text-center">Aksi</th>
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
                          {rec.isRevised && (
                            <span
                              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/30"
                              title={rec.revisionNote || 'FPB ini telah direvisi. Menampilkan berkas e-FPB tanggal terkini.'}
                            >
                              <History className="size-3" />
                              Revisi{rec.revisionCount && rec.revisionCount > 1 ? ` (${rec.revisionCount}x)` : ''}
                            </span>
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
                          <Ship className="size-3.5 text-muted-foreground shrink-0" />
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
                      <td className="py-3 px-4 max-w-xs truncate text-foreground" title={rec.purpose}>
                        {rec.purpose || '-'}
                      </td>

                      {/* Status e-FPB */}
                      <td className="py-3 px-3 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                          {rec.isReceivedLogistik ? 'Diterima Logistik' : 'e-FPB Terdaftar'}
                        </span>
                      </td>

                      {/* Status Review Tim FPB */}
                      <td className="py-3 px-3 whitespace-nowrap">
                        {getReviewStatusBadge(rec.reviewStatus)}
                      </td>

                      {/* Urgensi */}
                      <td className="py-3 px-3 whitespace-nowrap">
                        {getUrgencyBadge(rec.urgency)}
                      </td>

                      {/* PIC Purchasing */}
                      <td className="py-3 px-3 whitespace-nowrap text-foreground font-medium">
                        {rec.picPurchasing && rec.picPurchasing !== '-' ? (
                          <div className="flex items-center gap-1 text-primary">
                            <UserCheck className="size-3" />
                            <span>{rec.picPurchasing}</span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </td>

                      {/* Item & Stok Gudang */}
                      <td className="py-3 px-3 whitespace-nowrap">
                        {itemsCount > 0 ? (
                          <div className="flex flex-col">
                            <span className="font-semibold text-foreground">
                              {itemsCount} item
                            </span>
                            <span className="text-[11px] text-muted-foreground">
                              {inStockCount > 0 ? `${inStockCount} dari stok gudang` : 'Perlu PO'}
                            </span>
                          </div>
                        ) : (
                          <span className="text-[11px] text-muted-foreground italic">
                            Belum diekstrak
                          </span>
                        )}
                      </td>

                      {/* Dokumen Terkait */}
                      <td className="py-3 px-3 whitespace-nowrap">
                        <div className="flex flex-col gap-0.5">
                          {rec.relatedDocs?.poNos && rec.relatedDocs.poNos.length > 0 ? (
                            <span className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                              PO: {rec.relatedDocs.poNos.join(', ')}
                            </span>
                          ) : (
                            <span className="text-[11px] text-muted-foreground">PO: Belum ada</span>
                          )}
                          {rec.relatedDocs?.ttbNos && rec.relatedDocs.ttbNos.length > 0 && (
                            <span className="text-[10px] text-muted-foreground">
                              TTB: {rec.relatedDocs.ttbNos[0]}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Aksi */}
                      <td className="py-3 px-4 text-center whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={() => handleOpenReview(rec)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground transition shadow-2xs cursor-pointer"
                        >
                          <FileSearch className="size-3.5" />
                          <span>Review</span>
                          <ChevronRight className="size-3" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

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
                  </div>
                  <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground mt-0.5">
                    <span className="flex items-center gap-1 font-medium text-foreground">
                      <Ship className="size-3.5 text-muted-foreground" />
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

              {/* Close & External Links */}
              <div className="flex items-center gap-2">
                <a
                  href={selectedRecord.pdfUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg border border-border bg-background hover:bg-muted text-foreground transition"
                  title="Buka dokumen PDF resmi e-FPB di tab baru"
                >
                  <ExternalLink className="size-3.5" />
                  PDF Asli
                </a>
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition cursor-pointer"
                  title="Tutup"
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

              <button
                type="button"
                onClick={() => setActiveModalTab('relations')}
                className={`flex items-center gap-2 py-2 px-3 text-xs font-semibold border-b-2 transition cursor-pointer ${
                  activeModalTab === 'relations'
                    ? 'border-primary text-primary'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                <Layers className="size-4" />
                <span>Alur Dokumen & PO</span>
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
                                      Stok Kosong / Beli Baru
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
                                    <option value="PO">Beli Baru (PO)</option>
                                    <option value="HOLD">Tahan (Hold)</option>
                                    <option value="REJECT">Tolak Item</option>
                                  </select>
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
              {activeModalTab === 'pdf' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 rounded-lg bg-muted/40 border border-border text-xs">
                    <div>
                      <span className="font-semibold text-foreground">Berkas PDF e-FPB: </span>
                      <span className="text-muted-foreground">{selectedRecord.pdfUrl}</span>
                    </div>
                    <a
                      href={selectedRecord.pdfUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition shadow-xs"
                    >
                      <ExternalLink className="size-3.5" />
                      Buka di Tab Baru
                    </a>
                  </div>

                  <div className="w-full h-[520px] rounded-xl border border-border overflow-hidden bg-muted/20">
                    <iframe
                      src={selectedRecord.pdfUrl}
                      title={`PDF ${selectedRecord.fpbNo}`}
                      className="w-full h-full border-none"
                    />
                  </div>
                </div>
              )}

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
                        Unggah Foto / Berkas Lampiran Tambahan (Disimpan ke Cloudflare R2)
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
                        Dokumen permohonan FPB resmi dari user pemohon dapat diperiksa pada tab <strong>&quot;Pratinjau Dokumen PDF Resmi&quot;</strong>. Jika Anda menerima foto kondisi fisik/bukti kerusakan tambahan (misal dari WhatsApp atau laporan tim lapangan), Anda dapat mengunggahnya melalui form di atas untuk disimpan permanen di Cloudflare R2.
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

              {/* TAB 4: Relasi Dokumen */}
              {activeModalTab === 'relations' && (
                <div className="space-y-4">
                  <div className="p-4 rounded-xl border border-border bg-card space-y-3">
                    <h4 className="text-xs font-bold text-foreground flex items-center gap-2">
                      <Layers className="size-4 text-primary" />
                      Rantai Dokumen Terkait FPB {selectedRecord.fpbNo}
                    </h4>
                    <p className="text-xs text-muted-foreground">
                      Relasi otomatis yang dihubungkan melalui modul sinkronisasi database pengadaan CPG (FPB ↔ PO ↔ FSTB ↔ TTB).
                    </p>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                      {/* PO */}
                      <div className="p-3 rounded-lg border border-border bg-muted/30">
                        <div className="text-[11px] font-semibold text-muted-foreground uppercase">Nomor PO (Purchasing)</div>
                        <div className="text-sm font-bold text-foreground mt-1">
                          {selectedRecord.relatedDocs?.poNos && selectedRecord.relatedDocs.poNos.length > 0 ? (
                            selectedRecord.relatedDocs.poNos.map((po, i) => (
                              <div key={i} className="text-primary font-mono">{po}</div>
                            ))
                          ) : (
                            <span className="text-muted-foreground italic text-xs">Belum ada PO terbit</span>
                          )}
                        </div>
                      </div>

                      {/* FSTB */}
                      <div className="p-3 rounded-lg border border-border bg-muted/30">
                        <div className="text-[11px] font-semibold text-muted-foreground uppercase">Nomor FSTB (Serah Terima Barang)</div>
                        <div className="text-sm font-bold text-foreground mt-1">
                          {selectedRecord.relatedDocs?.fstbNos && selectedRecord.relatedDocs.fstbNos.length > 0 ? (
                            selectedRecord.relatedDocs.fstbNos.map((fstb, i) => (
                              <div key={i} className="text-emerald-600 dark:text-emerald-400 font-mono">{fstb}</div>
                            ))
                          ) : (
                            <span className="text-muted-foreground italic text-xs">Belum ada FSTB</span>
                          )}
                        </div>
                      </div>

                      {/* TTB */}
                      <div className="p-3 rounded-lg border border-border bg-muted/30">
                        <div className="text-[11px] font-semibold text-muted-foreground uppercase">Nomor TTB (Tanda Terima Barang)</div>
                        <div className="text-sm font-bold text-foreground mt-1">
                          {selectedRecord.relatedDocs?.ttbNos && selectedRecord.relatedDocs.ttbNos.length > 0 ? (
                            selectedRecord.relatedDocs.ttbNos.map((ttb, i) => (
                              <div key={i} className="text-blue-600 dark:text-blue-400 font-mono">{ttb}</div>
                            ))
                          ) : (
                            <span className="text-muted-foreground italic text-xs">Belum ada TTB</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
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
                      if (p === 'P1') setFormUrgency('EMERGENCY');
                      else if (p === 'P2') setFormUrgency('URGENT');
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
                    onChange={(e) => setFormStatus(e.target.value as FpbReviewStatus)}
                    className="w-full py-2 px-3 text-xs font-semibold rounded-lg border border-border bg-background text-foreground focus:outline-hidden focus:ring-2 focus:ring-primary/20"
                  >
                    <option value="PENDING_REVIEW">⏳ Menunggu Analisa / Belum Selesai</option>
                    <option value="APPROVED_PO">✅ Disetujui untuk Terbit PO (Purchasing)</option>
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
                    onChange={(e) => setFormUrgency(e.target.value as FpbUrgency)}
                    className="w-full py-2 px-3 text-xs font-semibold rounded-lg border border-border bg-background text-foreground focus:outline-hidden focus:ring-2 focus:ring-primary/20"
                  >
                    <option value="NORMAL">Normal (Rutin)</option>
                    <option value="URGENT">⚠️ Urgent (Mendesak)</option>
                    <option value="EMERGENCY">🚨 EMERGENCY (Darurat Kapal / Breakdown)</option>
                  </select>
                </div>

                {/* 4. PIC Purchasing */}
                <div>
                  <label className="block text-xs font-bold text-foreground mb-1.5">
                    Penugasan PIC Purchasing
                  </label>
                  <input
                    type="text"
                    list="pic-purchasing-list"
                    value={formPic}
                    onChange={(e) => setFormPic(e.target.value)}
                    placeholder="Pilih atau ketik nama PIC..."
                    className="w-full py-2 px-3 text-xs rounded-lg border border-border bg-background text-foreground focus:outline-hidden focus:ring-2 focus:ring-primary/20"
                  />
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

              {/* Buttons */}
              <div className="flex items-center justify-end gap-3 pt-2">
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
                  className="inline-flex items-center gap-2 px-5 py-2 text-xs font-bold rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition shadow-md cursor-pointer disabled:opacity-50"
                >
                  <FileCheck className={`size-4 ${isSavingDecision ? 'animate-spin' : ''}`} />
                  <span>{isSavingDecision ? 'Menyimpan & Menyinkronkan...' : 'Simpan & Sinkronkan Keputusan ke Cloud'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 6. Modal Konfigurasi / Login Server E-FPB               */}
      {/* ======================================================== */}
      {isSyncModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in-50">
          <div className="relative w-full max-w-lg rounded-2xl bg-card border border-border shadow-2xl overflow-hidden animate-in zoom-in-95">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 border-b border-border bg-muted/40">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-primary/10 text-primary">
                  <KeyRound className="size-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-foreground">
                    Sinkronisasi & Kredensial e-FPB
                  </h3>
                  <p className="text-[11px] text-muted-foreground">
                    e-fpb.cindaragroup.com/FilesList
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsSyncModalOpen(false)}
                className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition cursor-pointer"
              >
                <X className="size-4" />
              </button>
            </div>

            {/* Error / Locked Warning Banner */}
            {authErrorMsg && (
              <div className="p-3 mx-4 mt-4 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-start gap-2.5">
                <ShieldAlert className="size-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                <div className="text-xs text-rose-900 dark:text-rose-200">
                  <div className="font-semibold">Pesan dari Server e-FPB:</div>
                  <div className="mt-0.5">{authErrorMsg}</div>
                </div>
              </div>
            )}

            {/* Modal Body */}
            <div className="p-4 space-y-4">
              {/* Tab Selector: Cookie vs Account */}
              <div className="flex items-center p-1 rounded-lg bg-muted border border-border">
                <button
                  type="button"
                  onClick={() => setEfpbAuthMethod('cookie')}
                  className={`flex-1 py-1.5 px-3 text-xs font-semibold rounded-md transition flex items-center justify-center gap-1.5 cursor-pointer ${
                    efpbAuthMethod === 'cookie'
                      ? 'bg-card text-foreground shadow-xs'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <Cookie className="size-3.5 text-amber-500" />
                  <span>Session Cookie (PHPSESSID)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setEfpbAuthMethod('account')}
                  className={`flex-1 py-1.5 px-3 text-xs font-semibold rounded-md transition flex items-center justify-center gap-1.5 cursor-pointer ${
                    efpbAuthMethod === 'account'
                      ? 'bg-card text-foreground shadow-xs'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <Lock className="size-3.5" />
                  <span>Username & Password</span>
                </button>
              </div>

              {/* METHOD 1: Cookie (Recommended during lockout) */}
              {efpbAuthMethod === 'cookie' ? (
                <div className="space-y-3">
                  <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs text-amber-900 dark:text-amber-200 space-y-1">
                    <p className="font-semibold flex items-center gap-1">
                      💡 Solusi Cepat / Bypass Limit Akun 20 Menit:
                    </p>
                    <p className="text-[11px] text-amber-800 dark:text-amber-300">
                      Jika Anda sedang membuka website e-FPB di browser Anda:
                    </p>
                    <ol className="text-[11px] list-decimal list-inside space-y-0.5 text-amber-800 dark:text-amber-300">
                      <li>Buka tab browser yang membuka <strong>e-fpb.cindaragroup.com</strong></li>
                      <li>Tekan <strong>F12</strong> &rarr; tab <strong>Application</strong> &rarr; <strong>Cookies</strong></li>
                      <li>Copy nilai cookie <strong>PHPSESSID</strong> dan tempel di bawah:</li>
                    </ol>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-foreground mb-1">
                      Nilai Cookie PHPSESSID:
                    </label>
                    <input
                      type="text"
                      value={efpbSessionId}
                      onChange={(e) => {
                        const val = e.target.value.trim();
                        setEfpbSessionId(val);
                        if (typeof window !== 'undefined') {
                          localStorage.setItem('EFPB_SESSION_ID', val);
                        }
                      }}
                      placeholder="Contoh: ogbrngqaj76poogae69oju40db"
                      className="w-full py-2 px-3 text-xs font-mono rounded-lg border border-border bg-background text-foreground focus:outline-hidden focus:ring-2 focus:ring-primary/20"
                    />
                  </div>
                </div>
              ) : (
                /* METHOD 2: Username & Password */
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-foreground mb-1">
                      Username e-FPB:
                    </label>
                    <input
                      type="text"
                      value={efpbUsername}
                      onChange={(e) => {
                        setEfpbUsername(e.target.value);
                        if (typeof window !== 'undefined') {
                          localStorage.setItem('EFPB_USERNAME', e.target.value);
                        }
                      }}
                      placeholder="Username..."
                      className="w-full py-2 px-3 text-xs rounded-lg border border-border bg-background text-foreground focus:outline-hidden focus:ring-2 focus:ring-primary/20"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-foreground mb-1">
                      Password e-FPB:
                    </label>
                    <input
                      type="password"
                      value={efpbPassword}
                      onChange={(e) => {
                        setEfpbPassword(e.target.value);
                        if (typeof window !== 'undefined') {
                          localStorage.setItem('EFPB_PASSWORD', e.target.value);
                        }
                      }}
                      placeholder="Password..."
                      className="w-full py-2 px-3 text-xs rounded-lg border border-border bg-background text-foreground focus:outline-hidden focus:ring-2 focus:ring-primary/20"
                    />
                  </div>
                </div>
              )}

              {/* Mode Selection */}
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1.5">
                  Mode Pengambilan Data:
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setSyncMode('quick')}
                    className={`p-2.5 rounded-lg border text-left transition cursor-pointer ${
                      syncMode === 'quick'
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border bg-background text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <div className="text-xs font-bold">Quick Sync (20 FPB)</div>
                    <div className="text-[10px] mt-0.5 opacity-80">Hanya berkas terbaru</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSyncMode('full')}
                    className={`p-2.5 rounded-lg border text-left transition cursor-pointer ${
                      syncMode === 'full'
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border bg-background text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <div className="text-xs font-bold">Full Sync (Semua)</div>
                    <div className="text-[10px] mt-0.5 opacity-80">Menyeluruh seluruh arsip</div>
                  </button>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-end gap-2.5 p-4 border-t border-border bg-muted/40">
              <button
                type="button"
                onClick={() => setIsSyncModalOpen(false)}
                className="px-3.5 py-1.5 text-xs font-medium rounded-lg border border-border bg-background hover:bg-muted transition text-foreground cursor-pointer"
              >
                Tutup
              </button>

              <button
                type="button"
                onClick={() => handleSyncEfpb(syncMode)}
                disabled={isSyncing}
                className="inline-flex items-center gap-2 px-4 py-1.5 text-xs font-bold rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition shadow-xs cursor-pointer disabled:opacity-50"
              >
                <CloudDownload className={`size-3.5 ${isSyncing ? 'animate-bounce' : ''}`} />
                <span>{isSyncing ? 'Menghubungkan...' : 'Mulai Sinkronisasi'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

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
    </div>
  );
}

