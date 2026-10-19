'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  FileCheck2,
  FileText,
  ExternalLink,
  Download,
  Copy,
  Check,
  CheckCircle2,
  Clock,
  AlertCircle,
  RefreshCw,
  ShieldCheck,
  UserCheck,
  Boxes,
  Truck,
  Ship,
  Maximize2,
  Minimize2,
  Lock,
  Unlock,
  QrCode,
  Sparkles,
  Info,
  Calendar,
  Layers,
} from 'lucide-react';
import {
  DocumentValidationRecord,
  FstbSlotKey,
} from '@/types/documentValidation';
import { useAuth } from '@/context/AuthContext';
import { AuthUser } from '@/types/auth';

export interface FstbValidationModalProps {
  isOpen: boolean;
  onClose: () => void;
  record: DocumentValidationRecord | null;
  onValidationSuccess: (updatedRecord: DocumentValidationRecord) => void;
  showToast?: (msg: string, type?: 'info' | 'success' | 'warning' | 'error') => void;
}

interface FstbSlotConfig {
  key: FstbSlotKey;
  code: string;
  columnNumber: number;
  headerTitle: string;
  roleTitle: string;
  description: string;
  authorityLabel: string;
  declarationText: string;
}

const FSTB_SLOTS: FstbSlotConfig[] = [
  {
    key: 'deliveredBy',
    code: 'PCH',
    columnNumber: 1,
    headerTitle: 'Delivered By :',
    roleTitle: 'Purchasing Staff',
    description: 'Menyatakan bahwa barang telah dipesan, spesifikasi dan kuantitas sesuai PO, serta diserahkan resmi ke bagian logistik.',
    authorityLabel: 'Staf Purchasing / Pengadaan',
    declarationText: 'Saya menyatakan barang telah diperiksa dan disetujui sesuai wewenang saya sebagai Purchasing Staff.',
  },
  {
    key: 'receivedBy',
    code: 'LOG',
    columnNumber: 2,
    headerTitle: 'Received By :',
    roleTitle: 'Logistic Staff',
    description: 'Menyatakan bahwa fisik barang telah diterima di gudang, jumlah fisik dihitung tepat, dan kondisi kemasan diperiksa baik.',
    authorityLabel: 'Staf Logistik & Pergudangan',
    declarationText: 'Saya menyatakan barang telah diperiksa dan disetujui sesuai wewenang saya sebagai Logistic Staff.',
  },
  {
    key: 'approvedBy',
    code: 'PCH-SPV',
    columnNumber: 3,
    headerTitle: 'Approved By :',
    roleTitle: 'Purchasing Supervisor',
    description: 'Menyetujui kesesuaian dokumen pengadaan, otorisasi anggaran/biaya, dan keabsahan berkas serah terima dari pihak supplier.',
    authorityLabel: 'Purchasing Supervisor / Lead',
    declarationText: 'Saya menyatakan barang telah diperiksa dan disetujui sesuai wewenang saya sebagai Purchasing Supervisor.',
  },
  {
    key: 'acknowledgedBy',
    code: 'LOG-SPV',
    columnNumber: 4,
    headerTitle: 'Acknowledged By :',
    roleTitle: 'Logistic Supervisor',
    description: 'Mengetahui dan mengesahkan penerimaan barang untuk kesiapan operasional dan proses serah terima lanjutan ke armada kapal.',
    authorityLabel: 'Logistic Supervisor / Head',
    declarationText: 'Saya menyatakan barang telah diperiksa dan disetujui sesuai wewenang saya sebagai Logistic Supervisor.',
  },
];

/**
 * Aturan hak akses / kewenangan checklist pengesahan FSTB
 */
function checkUserSlotAuthority(
  slotKey: FstbSlotKey,
  user: AuthUser | null
): { allowed: boolean; reason: string } {
  if (!user) return { allowed: false, reason: 'Pengguna belum login' };

  // Administrator memiliki wewenang penuh pada semua lini
  if (
    user.role === 'admin' ||
    user.username?.toLowerCase() === 'admin' ||
    user.username?.toLowerCase() === 'hermansyah'
  ) {
    return { allowed: true, reason: 'Akses Penuh Administrator' };
  }

  const role = (user.role || '').toLowerCase();
  const jabatan = (user.jabatan || '').toLowerCase();
  const dept = (user.department || '').toLowerCase();

  switch (slotKey) {
    case 'deliveredBy':
      if (
        role === 'manager' ||
        role === 'supervisor' ||
        role === 'staf_purchasing' ||
        jabatan.includes('purchasing') ||
        jabatan.includes('pengadaan') ||
        dept.includes('procurement') ||
        dept.includes('purchasing') ||
        role === 'user'
      ) {
        return { allowed: true, reason: 'Wewenang Sah: Staf / Supervisor / Manager Purchasing' };
      }
      return { allowed: false, reason: 'Hanya dapat divalidasi oleh Staf Purchasing' };

    case 'receivedBy':
      if (
        role === 'staf_ttb' ||
        jabatan.includes('logistik') ||
        jabatan.includes('pergudangan') ||
        dept.includes('logistik')
      ) {
        return { allowed: true, reason: 'Wewenang Sah: Staf Logistik' };
      }
      return { allowed: false, reason: 'Hanya dapat divalidasi oleh Staf Logistik' };

    case 'approvedBy':
      if (
        role === 'manager' ||
        role === 'supervisor' ||
        (jabatan.includes('supervisor') ||
          jabatan.includes('spv') ||
          jabatan.includes('lead') ||
          jabatan.includes('head') ||
          jabatan.includes('manager')) &&
        (jabatan.includes('purchasing') || jabatan.includes('procurement') || dept.includes('procurement') || dept.includes('purchasing'))
      ) {
        return { allowed: true, reason: 'Wewenang Sah: Purchasing Supervisor / Manager' };
      }
      return { allowed: false, reason: 'Hanya dapat disahkan oleh Purchasing Supervisor / Manager' };

    case 'acknowledgedBy':
      if (
        (jabatan.includes('supervisor') ||
          jabatan.includes('spv') ||
          jabatan.includes('lead') ||
          jabatan.includes('head') ||
          jabatan.includes('manager')) &&
        (jabatan.includes('logistik') || dept.includes('logistik'))
      ) {
        return { allowed: true, reason: 'Wewenang Sah: Logistic Supervisor' };
      }
      return { allowed: false, reason: 'Hanya dapat disahkan oleh Logistic Supervisor / Head' };

    default:
      return { allowed: false, reason: 'Wewenang tidak dikenal' };
  }
}

export default function FstbValidationModal({
  isOpen,
  onClose,
  record,
  onValidationSuccess,
  showToast,
}: FstbValidationModalProps) {
  const { user, isAdmin } = useAuth();

  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [activeTabMobile, setActiveTabMobile] = useState<'checklist' | 'document'>('checklist');

  // State Checklist Slot yang dipilih pengguna saat ini
  const [selectedSlots, setSelectedSlots] = useState<Record<FstbSlotKey, boolean>>({
    deliveredBy: false,
    receivedBy: false,
    approvedBy: false,
    acknowledgedBy: false,
  });

  // Tipe stempel digital: 'ACCOUNT_SIG' (jika ada spesimen) atau 'DIGITAL_QR' (cap hash)
  const [stampType, setStampType] = useState<'ACCOUNT_SIG' | 'DIGITAL_QR'>('ACCOUNT_SIG');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [pdfRefreshKey, setPdfRefreshKey] = useState<number>(Date.now());
  const [pdfPageCount, setPdfPageCount] = useState<number | null>(null);

  // Deteksi jumlah halaman riil PDF secara dinamis menggunakan pdf-lib
  useEffect(() => {
    let isMounted = true;
    async function fetchPageCount() {
      if (!record?.fileUrl) {
        setPdfPageCount(null);
        return;
      }
      try {
        const response = await fetch(record.fileUrl);
        if (!response.ok) return;
        const arrayBuffer = await response.arrayBuffer();
        const { PDFDocument } = await import('pdf-lib');
        const pdfDoc = await PDFDocument.load(arrayBuffer, { ignoreEncryption: true });
        if (isMounted) {
          setPdfPageCount(pdfDoc.getPageCount());
        }
      } catch (err) {
        console.warn('Gagal membaca metadata jumlah halaman PDF FSTB:', err);
      }
    }
    fetchPageCount();
    return () => {
      isMounted = false;
    };
  }, [record?.fileUrl, pdfRefreshKey]);

  // Reset state saat modal dibuka
  useEffect(() => {
    if (!isOpen || !record) {
      setSelectedSlots({
        deliveredBy: false,
        receivedBy: false,
        approvedBy: false,
        acknowledgedBy: false,
      });
      setIsFullscreen(false);
      return;
    }

    // Defaultkan jenis stempel ke ACCOUNT_SIG jika user memiliki spesimen tanda tangan
    if (user?.signature?.signatureDataUrl) {
      setStampType('ACCOUNT_SIG');
    } else {
      setStampType('DIGITAL_QR');
    }
  }, [isOpen, record, user]);

  // Shortcut keyboard Escape
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isFullscreen) setIsFullscreen(false);
        else onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isFullscreen, onClose]);

  if (!isOpen || !record) return null;

  // Hitung jumlah slot yang telah tervalidasi
  const fstbSlots = record.fstbSlots || {
    deliveredBy: record.purchasingValidation?.isValidated ? record.purchasingValidation : { isValidated: false },
    receivedBy: record.logistikValidation?.isValidated ? record.logistikValidation : { isValidated: false },
    approvedBy: { isValidated: false },
    acknowledgedBy: { isValidated: false },
  };

  const validatedCount =
    (fstbSlots.deliveredBy?.isValidated ? 1 : 0) +
    (fstbSlots.receivedBy?.isValidated ? 1 : 0) +
    (fstbSlots.approvedBy?.isValidated ? 1 : 0) +
    (fstbSlots.acknowledgedBy?.isValidated ? 1 : 0);

  // Evaluasi 2 Lini Departemen (Purchasing & Logistik)
  const isPchDeptValid = Boolean(
    fstbSlots.deliveredBy?.isValidated ||
    fstbSlots.approvedBy?.isValidated ||
    record.purchasingValidation?.isValidated
  );
  const isLogDeptValid = Boolean(
    fstbSlots.receivedBy?.isValidated ||
    fstbSlots.acknowledgedBy?.isValidated ||
    record.logistikValidation?.isValidated
  );
  const deptValidCount = (isPchDeptValid ? 1 : 0) + (isLogDeptValid ? 1 : 0);

  // Cek apakah ada slot baru yang dicentang
  const hasNewSelectedSlot = Object.keys(selectedSlots).some(
    (k) => selectedSlots[k as FstbSlotKey] && !fstbSlots[k as FstbSlotKey]?.isValidated
  );

  const handleCopyText = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    if (showToast) showToast(`Teks disalin: ${text}`, 'info');
    setTimeout(() => setCopiedKey(null), 2000);
  };

  // Toggle checklist wewenang
  const handleToggleSlot = (slotKey: FstbSlotKey) => {
    const auth = checkUserSlotAuthority(slotKey, user);
    if (!auth.allowed) {
      if (showToast) showToast(auth.reason, 'warning');
      return;
    }
    setSelectedSlots((prev) => ({
      ...prev,
      [slotKey]: !prev[slotKey],
    }));
  };

  // Eksekusi Submit Validasi & Pembubuhan Cap Digital ke Halaman 2 PDF
  const handleConfirmSubmit = async () => {
    if (!hasNewSelectedSlot) {
      if (showToast) showToast('Silakan centang minimal satu kolom pengesahan yang menjadi wewenang Anda.', 'warning');
      return;
    }

    const slotsToSign: FstbSlotKey[] = (
      Object.keys(selectedSlots) as FstbSlotKey[]
    ).filter((k) => selectedSlots[k] && !fstbSlots[k]?.isValidated);

    try {
      setIsSubmitting(true);

      // Siapkan tanda tangan (PNG aset pengguna atau QR verifikasi)
      let sigData = '';
      if (stampType === 'ACCOUNT_SIG' && user?.signature?.signatureDataUrl) {
        sigData = user.signature.signatureDataUrl;
      }

      const res = await fetch('/api/validasi-dokumen', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          validationId: record.id,
          docId: record.docId,
          docType: 'FSTB',
          slotKeys: slotsToSign,
          validatorName: user?.name || 'Administrator CPG',
          validatorUsername: user?.username || 'admin',
          validatorRole: user?.role || 'admin',
          validatorNik: user?.nik || 'CPG-AUTH-001',
          validatorJabatan: user?.jabatan || 'Staf Verifikasi FSTB',
          signatureDataUrl: sigData,
          notes: 'Diverifikasi dan disetujui melalui sistem terpadu CPG',
          action: 'sign',
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Gagal menyimpan pengesahan FSTB.');
      }

      if (showToast) {
        showToast(
          `Pengesahan ${slotsToSign.length} kolom FSTB (${record.docNumber}) berhasil dibubuhkan cap digital!`,
          'success'
        );
      }

      // Reset pilihan checklist
      setSelectedSlots({
        deliveredBy: false,
        receivedBy: false,
        approvedBy: false,
        acknowledgedBy: false,
      });

      setPdfRefreshKey(Date.now());
      onValidationSuccess(data.record);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Terjadi kegagalan saat merekam pengesahan.';
      if (showToast) showToast(msg, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Batalkan validasi pada slot tertentu (Admin Only)
  const handleRevokeSlot = async (slotKey: FstbSlotKey) => {
    if (!isAdmin) {
      if (showToast) showToast('Hanya administrator yang dapat membatalkan validasi.', 'warning');
      return;
    }
    if (!confirm('Apakah Anda yakin ingin membatalkan pengesahan pada kolom ini?')) return;

    try {
      setIsSubmitting(true);
      const res = await fetch('/api/validasi-dokumen', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          validationId: record.id,
          docId: record.docId,
          docType: 'FSTB',
          slotKey,
          action: 'revoke',
          notes: `Dibatalkan oleh ${user?.name || 'Administrator'}`,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Gagal membatalkan pengesahan.');
      }

      if (showToast) showToast('Pengesahan kolom FSTB berhasil dibatalkan.', 'info');
      setPdfRefreshKey(Date.now());
      onValidationSuccess(data.record);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Terjadi kesalahan saat membatalkan validasi.';
      if (showToast) showToast(msg, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const previewPdfUrl = `${record.fileUrl}${record.fileUrl.includes('?') ? '&' : '?'}v=${pdfRefreshKey}`;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="fstb-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200"
    >
      <div
        className={`relative w-full bg-card border border-border rounded-2xl shadow-2xl flex flex-col overflow-hidden transition-all duration-300 ${
          isFullscreen ? 'h-full max-w-full rounded-none' : 'max-h-[94vh] max-w-7xl'
        }`}
      >
        {/* ========================================================= */}
        {/* MODAL HEADER                                              */}
        {/* ========================================================= */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-5 py-4 border-b border-border bg-muted/40 shrink-0">
          <div className="space-y-1.5 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-black uppercase tracking-wider bg-teal-500/15 text-teal-700 dark:text-teal-300 border border-teal-500/30">
                Dokumen FSTB (Form Serah Terima Barang)
              </span>

              {validatedCount === 4 ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
                  <CheckCircle2 className="size-3.5" />
                  <span>Selesai (4/4 PIC Sah • Siap Terbit TTB)</span>
                </span>
              ) : validatedCount > 0 ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-500/15 text-blue-700 dark:text-blue-300 border border-blue-500/30">
                  <Clock className="size-3.5" />
                  <span>Dalam Proses ({validatedCount}/4 PIC Sah • {deptValidCount}/2 Departemen)</span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30">
                  <AlertCircle className="size-3.5" />
                  <span>Menunggu Validasi (0/4 PIC • 0/2 Departemen)</span>
                </span>
              )}
            </div>

            <div className="flex items-center gap-2 flex-wrap text-xs">
              <h2 id="fstb-modal-title" className="text-base sm:text-lg font-black text-foreground font-mono flex items-center gap-1.5">
                <span>{record.docNumber}</span>
                <button
                  type="button"
                  onClick={() => handleCopyText(record.docNumber, 'docNumber')}
                  className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted"
                  title="Salin No. FSTB"
                >
                  {copiedKey === 'docNumber' ? <Check className="size-3.5 text-emerald-500" /> : <Copy className="size-3.5" />}
                </button>
              </h2>

              <span className="text-muted-foreground/60">•</span>

              <span className="inline-flex items-center gap-1 font-semibold text-foreground bg-background px-2 py-0.5 rounded border border-border">
                <Ship className="size-3 text-indigo-500" />
                <span>Unit: {record.armada}</span>
              </span>

              {record.fpbNumber && (
                <>
                  <span className="text-muted-foreground/60">•</span>
                  <span className="inline-flex items-center gap-1 font-mono font-bold text-teal-700 dark:text-teal-300 bg-teal-500/10 px-2 py-0.5 rounded border border-teal-500/20">
                    <Boxes className="size-3 text-teal-600 dark:text-teal-400" />
                    <span>FPB: {record.fpbNumber}</span>
                  </span>
                </>
              )}

              {record.poNumber && (
                <>
                  <span className="text-muted-foreground/60">•</span>
                  <span className="inline-flex items-center gap-1 font-mono text-muted-foreground bg-background px-2 py-0.5 rounded border border-border">
                    <FileText className="size-3" />
                    <span>PO/DO: {record.poNumber}</span>
                  </span>
                </>
              )}

              {record.relatedDocuments?.relatedTtbs && record.relatedDocuments.relatedTtbs.length > 0 && (
                <>
                  <span className="text-muted-foreground/60">•</span>
                  <span className="inline-flex items-center gap-1 font-mono font-bold text-purple-700 dark:text-purple-300 bg-purple-500/10 px-2 py-0.5 rounded border border-purple-500/25">
                    <span>TTB Terkait: {record.relatedDocuments.relatedTtbs.join(', ')}</span>
                  </span>
                </>
              )}
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-1.5 self-end sm:self-center shrink-0">
            <button
              type="button"
              onClick={() => setPdfRefreshKey(Date.now())}
              className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted border border-border/80 transition"
              title="Segarkan Pratinjau Dokumen"
            >
              <RefreshCw className="size-4" />
            </button>

            <a
              href={record.fileUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted border border-border/80 transition"
              title="Buka Berkas PDF di Tab Baru"
            >
              <ExternalLink className="size-4" />
            </a>

            <a
              href={`/api/r2-file?key=${encodeURIComponent(record.r2Key || '')}&download=true`}
              className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted border border-border/80 transition"
              title="Unduh Berkas PDF Resmi"
            >
              <Download className="size-4" />
            </a>

            <button
              type="button"
              onClick={() => setIsFullscreen(!isFullscreen)}
              className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted border border-border/80 transition hidden sm:inline-flex"
              title={isFullscreen ? 'Kecilkan Tampilan' : 'Layar Penuh'}
            >
              {isFullscreen ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted border border-border/80 transition cursor-pointer"
              title="Tutup Modal (Esc)"
            >
              <X className="size-4" />
            </button>
          </div>
        </div>

        {/* Mobile View Switcher */}
        <div className="flex sm:hidden border-b border-border bg-muted/20">
          <button
            type="button"
            onClick={() => setActiveTabMobile('checklist')}
            className={`flex-1 py-2 text-xs font-bold text-center border-b-2 transition ${
              activeTabMobile === 'checklist'
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 bg-background'
                : 'border-transparent text-muted-foreground'
            }`}
          >
            Checklist 4 PIC ({validatedCount}/4)
          </button>
          <button
            type="button"
            onClick={() => setActiveTabMobile('document')}
            className={`flex-1 py-2 text-xs font-bold text-center border-b-2 transition ${
              activeTabMobile === 'document'
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 bg-background'
                : 'border-transparent text-muted-foreground'
            }`}
          >
            Pratinjau PDF
          </button>
        </div>

        {/* ========================================================= */}
        {/* MODAL BODY (SPLIT VIEW)                                   */}
        {/* ========================================================= */}
        <div className="flex-1 overflow-hidden grid grid-cols-1 lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-border">
          {/* SISI KIRI: PRATINJAU DOKUMEN PDF (5/12) */}
          <div
            className={`lg:col-span-5 flex flex-col bg-slate-950/20 overflow-hidden ${
              activeTabMobile === 'document' ? 'flex' : 'hidden lg:flex'
            }`}
          >
            <div className="p-3 border-b border-border bg-muted/20 flex items-center justify-between text-xs text-muted-foreground">
              <div className="flex items-center gap-2">
                <FileCheck2 className="size-4 text-indigo-500" />
                <span className="font-semibold text-foreground">
                  Pratinjau Berkas PDF Asli {pdfPageCount ? `(${pdfPageCount} Halaman • 1 of ${pdfPageCount})` : ''}
                </span>
              </div>
              <span className="text-[11px] font-mono text-muted-foreground">
                {pdfPageCount
                  ? `Halaman ${pdfPageCount} of ${pdfPageCount} memuat 4 Kolom Pengesahan PIC`
                  : 'Halaman Pengesahan PIC'}
              </span>
            </div>

            <div className="flex-1 p-2 sm:p-3 overflow-hidden bg-slate-900/10 flex flex-col min-h-[400px]">
              <iframe
                key={previewPdfUrl}
                src={previewPdfUrl}
                title={`Pratinjau ${record.docNumber}`}
                className="w-full h-full rounded-xl border border-border bg-card shadow-inner"
              />
            </div>
          </div>

          {/* SISI KANAN: PANEL AKSI CHECKLIST 4 PIC (7/12) */}
          <div
            className={`lg:col-span-7 flex flex-col overflow-y-auto bg-card ${
              activeTabMobile === 'checklist' ? 'flex' : 'hidden lg:flex'
            }`}
          >
            <div className="p-4 sm:p-5 space-y-4">
              {/* Notification Banner when FSTB Completed / Closed */}
              {validatedCount === 4 && (
                <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-3.5 text-xs text-emerald-950 dark:text-emerald-200 flex items-start gap-2.5 animate-in fade-in">
                  <CheckCircle2 className="size-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <div className="font-bold text-emerald-800 dark:text-emerald-300">
                      Berkas FSTB Lengkap &amp; Sah (Closed)
                    </div>
                    <p className="text-[11px] text-emerald-700 dark:text-emerald-300/90 leading-relaxed">
                      Ke-4 PIC sah dari Departemen Purchasing dan Logistik telah menandatangani dokumen ini. Berkas FSTB selesai dan siap diteruskan untuk pembuatan / penerbitan <strong>TTB (Tanda Terima Barang)</strong> ke unit penerima.
                    </p>
                  </div>
                </div>
              )}

              {/* Session Identity Badge */}
              <div className="rounded-xl border border-border/80 bg-muted/40 p-3 text-xs space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1">
                    <UserCheck className="size-3.5 text-indigo-500" />
                    <span>Akun Pengesah Aktif</span>
                  </span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border border-indigo-500/20 font-bold">
                    Otomatis Tercatat
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-1 border-t border-border/50 text-[11px]">
                  <div>
                    <span className="text-muted-foreground block text-[10px]">Nama:</span>
                    <strong className="text-foreground">{user?.name || 'Administrator CPG'}</strong>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[10px]">Jabatan:</span>
                    <span className="text-foreground truncate block">{user?.jabatan || 'Head of MIS & IT'}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[10px]">Role / ID:</span>
                    <span className="font-mono text-muted-foreground">{user?.role} ({user?.nik || user?.id || '-'})</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[10px]">Waktu Pengesahan:</span>
                    <span className="font-mono text-emerald-600 dark:text-emerald-400 font-semibold">Real-time Timestamp</span>
                  </div>
                </div>
              </div>

              {/* Title & Instructions */}
              <div className="space-y-1">
                <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Layers className="size-3.5 text-indigo-500" />
                  <span>Daftar 4 Kolom Pengesahan PIC (Halaman 2)</span>
                </h3>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  Centang kolom pengesahan yang menjadi wewenang jabatan Anda. Kolom di luar wewenang Anda akan berstatus terkunci (*disabled*).
                </p>
              </div>

              {/* 4 CHECKLIST CARDS - SUSUNAN 2 KOTAK MENDATAR (2x2 GRID) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {FSTB_SLOTS.map((slot) => {
                  const currentSlotState = fstbSlots[slot.key];
                  const isAlreadyValidated = Boolean(currentSlotState?.isValidated);
                  const authCheck = checkUserSlotAuthority(slot.key, user);
                  const isChecked = selectedSlots[slot.key];

                  return (
                    <div
                      key={slot.key}
                      className={`relative rounded-xl border p-3.5 transition flex flex-col justify-between ${
                        isAlreadyValidated
                          ? 'border-emerald-500/40 bg-emerald-500/5'
                          : authCheck.allowed
                          ? isChecked
                            ? 'border-indigo-600 bg-indigo-500/10 shadow-xs'
                            : 'border-border bg-card hover:border-indigo-500/40 hover:bg-muted/30 cursor-pointer'
                          : 'border-border/60 bg-muted/40 opacity-75'
                      }`}
                      onClick={() => {
                        if (!isAlreadyValidated && authCheck.allowed) {
                          handleToggleSlot(slot.key);
                        }
                      }}
                    >
                      <div>
                        {/* Top Header of Card */}
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="size-5 rounded-md bg-muted border border-border flex items-center justify-center font-mono font-bold text-[10px] text-muted-foreground shrink-0">
                              {slot.columnNumber}
                            </span>
                            <div className="min-w-0">
                              <span className="text-[10px] text-muted-foreground font-mono block truncate">
                                {slot.headerTitle}
                              </span>
                              <h4 className="text-xs font-bold text-foreground truncate">
                                <span>{slot.roleTitle}</span>
                              </h4>
                            </div>
                          </div>

                          {/* Status Badge */}
                          <div className="shrink-0">
                            {isAlreadyValidated ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 whitespace-nowrap">
                                <CheckCircle2 className="size-3 shrink-0" />
                                <span>Telah Disahkan</span>
                              </span>
                            ) : authCheck.allowed ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border border-indigo-500/30 whitespace-nowrap">
                                <Unlock className="size-3 shrink-0" />
                                <span>Wewenang Anda</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-500/15 text-slate-600 dark:text-slate-400 border border-slate-500/30 whitespace-nowrap">
                                <Lock className="size-3 shrink-0" />
                                <span>Terkunci</span>
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Description */}
                        <p className="text-[10.5px] text-muted-foreground mt-2 leading-relaxed">
                          {slot.description}
                        </p>
                      </div>

                      {/* State Details: Already Validated vs Pending Action */}
                      {isAlreadyValidated ? (
                        <div className="mt-3 pt-2.5 border-t border-emerald-500/20 text-[11px] space-y-1">
                          <div className="flex items-center justify-between text-emerald-800 dark:text-emerald-300 font-medium">
                            <span className="truncate pr-1 text-[10.5px]">Disahkan: <strong>{currentSlotState?.validatorName}</strong></span>
                            <span className="font-mono text-[10px] shrink-0">
                              {currentSlotState?.validatedAt ? currentSlotState.validatedAt.slice(0, 10) : ''}
                            </span>
                          </div>
                          {currentSlotState?.verificationToken && (
                            <div className="font-mono text-[9.5px] text-muted-foreground truncate">
                              Token: {currentSlotState.verificationToken}
                            </div>
                          )}

                          {isAdmin && (
                            <div className="pt-0.5 flex justify-end">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleRevokeSlot(slot.key);
                                }}
                                disabled={isSubmitting}
                                className="text-[10px] text-rose-600 dark:text-rose-400 underline font-semibold hover:text-rose-700 cursor-pointer"
                              >
                                Batalkan Pengesahan (Admin)
                              </button>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="mt-3 pt-2.5 border-t border-border/60">
                          {authCheck.allowed ? (
                            <label
                              className="flex items-start gap-2 cursor-pointer select-none"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => handleToggleSlot(slot.key)}
                                className="mt-0.5 size-4 rounded text-indigo-600 focus:ring-indigo-500 border-border cursor-pointer shrink-0"
                              />
                              <span className="text-[10.5px] font-medium text-foreground leading-snug">
                                {slot.declarationText}
                              </span>
                            </label>
                          ) : (
                            <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground/80 italic">
                              <Lock className="size-3 shrink-0" />
                              <span className="truncate">{authCheck.reason}</span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Digital Signature Mode Selection */}
              {hasNewSelectedSlot && (
                <div className="rounded-xl border border-indigo-500/30 bg-indigo-50/50 dark:bg-indigo-950/20 p-3 space-y-2 animate-in fade-in">
                  <span className="text-xs font-bold text-indigo-900 dark:text-indigo-300 flex items-center gap-1.5">
                    <Sparkles className="size-3.5 text-indigo-500" />
                    <span>Metode Cap Tanda Tangan Digital Resmi</span>
                  </span>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                    <button
                      type="button"
                      onClick={() => setStampType('ACCOUNT_SIG')}
                      className={`p-2 rounded-lg border text-left transition cursor-pointer ${
                        stampType === 'ACCOUNT_SIG'
                          ? 'border-indigo-600 bg-card text-foreground shadow-2xs font-bold'
                          : 'border-border bg-background/50 text-muted-foreground hover:bg-card'
                      }`}
                    >
                      <div className="flex items-center gap-1.5">
                        <CheckCircle2 className={`size-3.5 ${stampType === 'ACCOUNT_SIG' ? 'text-indigo-600' : 'text-muted-foreground'}`} />
                        <span>Tanda Tangan Akun</span>
                      </div>
                      <span className="text-[10px] text-muted-foreground block mt-0.5 font-normal">
                        Spesimen PNG akun login Anda
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setStampType('DIGITAL_QR')}
                      className={`p-2 rounded-lg border text-left transition cursor-pointer ${
                        stampType === 'DIGITAL_QR'
                          ? 'border-indigo-600 bg-card text-foreground shadow-2xs font-bold'
                          : 'border-border bg-background/50 text-muted-foreground hover:bg-card'
                      }`}
                    >
                      <div className="flex items-center gap-1.5">
                        <QrCode className={`size-3.5 ${stampType === 'DIGITAL_QR' ? 'text-indigo-600' : 'text-muted-foreground'}`} />
                        <span>Cap Hash Digital</span>
                      </div>
                      <span className="text-[10px] text-muted-foreground block mt-0.5 font-normal">
                        Token enkripsi &amp; verifikasi sistem
                      </span>
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Bottom Actions Footer */}
            <div className="mt-auto p-4 border-t border-border bg-muted/40 shrink-0 flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="text-[11px] text-muted-foreground w-full sm:w-auto text-center sm:text-left">
                {hasNewSelectedSlot ? (
                  <span className="text-indigo-600 dark:text-indigo-400 font-semibold">
                    ✓ Siap mengesahkan kolom yang dicentang
                  </span>
                ) : (
                  <span>Centang kolom wewenang untuk mengesahkan</span>
                )}
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={isSubmitting}
                  className="flex-1 sm:flex-none px-4 py-2 rounded-xl text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-muted border border-border transition cursor-pointer"
                >
                  Tutup
                </button>

                <button
                  type="button"
                  onClick={handleConfirmSubmit}
                  disabled={!hasNewSelectedSlot || isSubmitting}
                  className="flex-1 sm:flex-none px-5 py-2 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-md shadow-indigo-600/25 transition cursor-pointer inline-flex items-center justify-center gap-1.5"
                >
                  {isSubmitting ? (
                    <>
                      <RefreshCw className="size-3.5 animate-spin" />
                      <span>Membubuhkan Cap...</span>
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="size-3.5" />
                      <span>Konfirmasi Simpan &amp; Bubuhkan Cap</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

