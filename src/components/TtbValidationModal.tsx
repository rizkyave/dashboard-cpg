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
  Ship,
  Maximize2,
  Minimize2,
  Lock,
  Unlock,
  QrCode,
  Sparkles,
  Layers,
  Phone,
} from 'lucide-react';
import {
  DocumentValidationRecord,
  TtbSlotKey,
} from '@/types/documentValidation';
import { useAuth } from '@/context/AuthContext';
import { AuthUser } from '@/types/auth';

export interface TtbValidationModalProps {
  isOpen: boolean;
  onClose: () => void;
  record: DocumentValidationRecord | null;
  onValidationSuccess: (updatedRecord: DocumentValidationRecord) => void;
  showToast?: (msg: string, type?: 'info' | 'success' | 'warning' | 'error') => void;
}

interface TtbSlotConfig {
  key: TtbSlotKey;
  code: string;
  columnNumber: number;
  headerTitle: string;
  roleTitle: string;
  description: string;
  authorityLabel: string;
  declarationText: string;
}

const TTB_SLOTS: TtbSlotConfig[] = [
  {
    key: 'deliveredBy',
    code: 'LOG STF',
    columnNumber: 1,
    headerTitle: 'Delivered By :',
    roleTitle: 'Logistic Staff',
    description: 'Menyatakan bahwa fisik barang telah disiapkan dan diperiksa dari gudang logistik, jumlah fisik akurat, dan kondisi kemasan baik.',
    authorityLabel: 'Staf Logistik & Pergudangan',
    declarationText: 'Saya menyatakan barang telah diperiksa fisiknya dan diserahkan sesuai wewenang saya sebagai Logistic Staff.',
  },
  {
    key: 'approvedBy',
    code: 'LOG SPV',
    columnNumber: 2,
    headerTitle: 'Approved By :',
    roleTitle: 'Logistic Supervisor',
    description: 'Menyetujui kesesuaian serah terima fisik barang gudang logistik dan otorisasi pengeluaran barang inventaris ke armada kapal.',
    authorityLabel: 'Logistic Supervisor / Head',
    declarationText: 'Saya menyetujui pengeluaran dan serah terima barang sesuai wewenang saya sebagai Logistic Supervisor.',
  },
  {
    key: 'acknowledgedBy',
    code: 'PCH MGR',
    columnNumber: 3,
    headerTitle: 'Acknowledge By :',
    roleTitle: 'Procurement Manager',
    description: 'Mengetahui dan mengesahkan seluruh proses pengadaan dan serah terima barang dari sisi otorisasi Procurement & Purchasing.',
    authorityLabel: 'Manager Procurement / Purchasing',
    declarationText: 'Saya menyatakan serah terima barang ini telah diketahui dan disahkan sesuai wewenang saya sebagai Procurement Manager.',
  },
  {
    key: 'receivedBy',
    code: 'RCV / LAP',
    columnNumber: 4,
    headerTitle: 'Received By :',
    roleTitle: 'User / Tim Lapangan / Armada',
    description: 'Menyatakan bahwa barang fisik telah diterima langsung oleh pemohon / crew armada kapal dalam kondisi baik dan lengkap.',
    authorityLabel: 'Tim Lapangan / Penerima Akhir / Crew Armada',
    declarationText: 'Saya menyatakan barang telah diterima dengan baik dan lengkap di lapangan / armada kapal.',
  },
];

/**
 * Aturan hak akses / kewenangan checklist pengesahan TTB
 */
function checkUserTtbSlotAuthority(
  slotKey: TtbSlotKey,
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
        role === 'staf_ttb' ||
        jabatan.includes('logistik') ||
        jabatan.includes('pergudangan') ||
        dept.includes('logistik')
      ) {
        return { allowed: true, reason: 'Wewenang Sah: Staf Logistik' };
      }
      return { allowed: false, reason: 'Hanya dapat disahkan oleh Staf Logistik' };

    case 'receivedBy':
      if (
        role === 'staf_lapangan' ||
        role === 'user' ||
        jabatan.includes('lapangan') ||
        dept.includes('lapangan') ||
        jabatan.includes('armada') ||
        jabatan.includes('kapal')
      ) {
        return { allowed: true, reason: 'Wewenang Sah: Tim Lapangan / Penerima' };
      }
      return { allowed: false, reason: 'Hanya dapat divalidasi oleh Tim Lapangan / Penerima Akhir' };

    case 'approvedBy':
      if (
        role === 'supervisor' ||
        role === 'manager' ||
        ((jabatan.includes('supervisor') ||
          jabatan.includes('spv') ||
          jabatan.includes('lead') ||
          jabatan.includes('head') ||
          jabatan.includes('manager')) &&
          (jabatan.includes('logistik') || dept.includes('logistik')))
      ) {
        return { allowed: true, reason: 'Wewenang Sah: Logistic Supervisor' };
      }
      return { allowed: false, reason: 'Hanya dapat disahkan oleh Logistic Supervisor' };

    case 'acknowledgedBy':
      if (
        role === 'manager' ||
        ((jabatan.includes('manager') || jabatan.includes('head')) &&
          (jabatan.includes('purchasing') ||
            jabatan.includes('procurement') ||
            dept.includes('procurement') ||
            dept.includes('purchasing')))
      ) {
        return { allowed: true, reason: 'Wewenang Sah: Procurement Manager' };
      }
      return { allowed: false, reason: 'Hanya dapat disahkan oleh Procurement Manager' };

    default:
      return { allowed: false, reason: 'Wewenang tidak dikenal' };
  }
}

export default function TtbValidationModal({
  isOpen,
  onClose,
  record,
  onValidationSuccess,
  showToast,
}: TtbValidationModalProps) {
  const { user, isAdmin } = useAuth();

  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [activeTabMobile, setActiveTabMobile] = useState<'checklist' | 'document'>('checklist');

  // State Checklist Slot yang dipilih pengguna saat ini
  const [selectedSlots, setSelectedSlots] = useState<Record<TtbSlotKey, boolean>>({
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
        console.warn('Gagal membaca metadata jumlah halaman PDF TTB:', err);
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

  // Cek apakah penerima / kru armada telah menandatangani melalui Serah Terima Lapangan atau Validasi Digital
  const isRecipientSigned = Boolean(
    record.recipientValidation?.isSigned ||
    record.lapanganValidation?.isValidated ||
    record.ttbSlots?.receivedBy?.isValidated
  );

  const effectiveReceivedBy = isRecipientSigned
    ? {
        isValidated: true,
        validatorName:
          record.ttbSlots?.receivedBy?.validatorName ||
          record.recipientValidation?.recipientName ||
          record.lapanganValidation?.validatorName ||
          'Penerima / Kru Armada Lapangan',
        validatorJabatan:
          record.ttbSlots?.receivedBy?.validatorJabatan ||
          record.lapanganValidation?.validatorJabatan ||
          'Penerima / Crew Armada Kapal',
        validatorRole: 'staf_lapangan',
        validatedAt:
          record.ttbSlots?.receivedBy?.validatedAt ||
          record.recipientValidation?.signedAt ||
          record.lapanganValidation?.validatedAt ||
          record.updatedAt,
        signatureDataUrl:
          record.ttbSlots?.receivedBy?.signatureDataUrl ||
          record.recipientValidation?.signatureDataUrl ||
          record.lapanganValidation?.signatureDataUrl,
        notes:
          record.ttbSlots?.receivedBy?.notes ||
          'Pekerjaan pengantaran telah selesai dilakukan oleh tim logistik lapangan & barang fisik telah diterima kru armada kapal.',
        verificationToken:
          record.ttbSlots?.receivedBy?.verificationToken ||
          record.lapanganValidation?.verificationToken ||
          'VAL-SERAH-TERIMA-LAPANGAN',
      }
    : { isValidated: false };

  // Hitung jumlah slot yang telah tervalidasi
  const ttbSlots = {
    deliveredBy: record.ttbSlots?.deliveredBy?.isValidated
      ? record.ttbSlots.deliveredBy
      : record.logistikValidation?.isValidated
      ? record.logistikValidation
      : { isValidated: false },
    receivedBy: effectiveReceivedBy,
    approvedBy: record.ttbSlots?.approvedBy?.isValidated
      ? record.ttbSlots.approvedBy
      : { isValidated: false },
    acknowledgedBy: record.ttbSlots?.acknowledgedBy?.isValidated
      ? record.ttbSlots.acknowledgedBy
      : record.purchasingValidation?.isValidated
      ? record.purchasingValidation
      : { isValidated: false },
  };

  const validatedCount =
    (ttbSlots.deliveredBy?.isValidated ? 1 : 0) +
    (ttbSlots.receivedBy?.isValidated ? 1 : 0) +
    (ttbSlots.approvedBy?.isValidated ? 1 : 0) +
    (ttbSlots.acknowledgedBy?.isValidated ? 1 : 0);

  // Cek apakah ada slot baru yang dicentang
  const hasNewSelectedSlot = Object.keys(selectedSlots).some(
    (k) => selectedSlots[k as TtbSlotKey] && !ttbSlots[k as TtbSlotKey]?.isValidated
  );

  const handleCopyText = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    if (showToast) showToast(`Teks disalin: ${text}`, 'info');
    setTimeout(() => setCopiedKey(null), 2000);
  };

  // Toggle checklist wewenang
  const handleToggleSlot = (slotKey: TtbSlotKey) => {
    const auth = checkUserTtbSlotAuthority(slotKey, user);
    if (!auth.allowed) {
      if (showToast) showToast(auth.reason, 'warning');
      return;
    }
    setSelectedSlots((prev) => ({
      ...prev,
      [slotKey]: !prev[slotKey],
    }));
  };

  // Eksekusi Submit Validasi & Pembubuhan Cap Digital ke Dokumen PDF TTB
  const handleConfirmSubmit = async () => {
    if (!hasNewSelectedSlot) {
      if (showToast) showToast('Silakan centang minimal satu kolom pengesahan yang menjadi wewenang Anda.', 'warning');
      return;
    }

    const slotsToSign: TtbSlotKey[] = (
      Object.keys(selectedSlots) as TtbSlotKey[]
    ).filter((k) => selectedSlots[k] && !ttbSlots[k]?.isValidated);

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
          docType: 'TTB',
          slotKeys: slotsToSign,
          validatorName: user?.name || 'Administrator CPG',
          validatorUsername: user?.username || 'admin',
          validatorRole: user?.role || 'admin',
          validatorNik: user?.nik || 'CPG-AUTH-001',
          validatorJabatan: user?.jabatan || (user?.role === 'manager' ? 'Procurement Manager' : 'Staf Logistik'),
          signatureDataUrl: sigData,
          notes: 'Diverifikasi dan disahkan melalui sistem validasi digital terpadu CPG',
          action: 'sign',
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Gagal menyimpan pengesahan TTB.');
      }

      if (showToast) {
        showToast(
          `Pengesahan ${slotsToSign.length} kolom TTB (${record.docNumber}) berhasil dibubuhkan cap digital!`,
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
  const handleRevokeSlot = async (slotKey: TtbSlotKey) => {
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
          docType: 'TTB',
          slotKey,
          action: 'revoke',
          notes: `Dibatalkan oleh ${user?.name || 'Administrator'}`,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Gagal membatalkan pengesahan.');
      }

      if (showToast) showToast('Pengesahan kolom TTB berhasil dibatalkan.', 'info');
      setPdfRefreshKey(Date.now());
      onValidationSuccess(data.record);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Gagal membatalkan pengesahan.';
      if (showToast) showToast(msg, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // URL Dokumen PDF dengan cache-buster saat direfresh
  const previewPdfUrl = useMemo(() => {
    if (!record?.fileUrl) return '';
    const sep = record.fileUrl.includes('?') ? '&' : '?';
    return `${record.fileUrl}${sep}t=${pdfRefreshKey}`;
  }, [record?.fileUrl, pdfRefreshKey]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="ttb-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200"
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
              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-black uppercase tracking-wider bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30">
                Dokumen TTB (Tanda Terima Barang)
              </span>

              {validatedCount === 4 ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
                  <CheckCircle2 className="size-3.5" />
                  <span>Pengantaran Selesai &amp; Sah Lengkap (4/4 Kolom)</span>
                </span>
              ) : validatedCount >= 3 ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
                  <ShieldCheck className="size-3.5" />
                  <span>Sah Lengkap ({validatedCount}/4 Kolom)</span>
                </span>
              ) : validatedCount > 0 ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-500/15 text-blue-700 dark:text-blue-300 border border-blue-500/30">
                  <Clock className="size-3.5" />
                  <span>Dalam Proses ({validatedCount}/4 Kolom Sah)</span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30">
                  <AlertCircle className="size-3.5" />
                  <span>Menunggu Validasi (0/4)</span>
                </span>
              )}
            </div>

            <div className="flex items-center gap-2 flex-wrap text-xs">
              <h2 id="ttb-modal-title" className="text-base sm:text-lg font-black text-foreground font-mono flex items-center gap-1.5">
                <span>{record.docNumber}</span>
                <button
                  type="button"
                  onClick={() => handleCopyText(record.docNumber, 'docNumber')}
                  className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted"
                  title="Salin No. TTB"
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
                  <span className="inline-flex items-center gap-1 font-mono font-bold text-amber-700 dark:text-amber-300 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                    <FileText className="size-3 text-amber-600 dark:text-amber-400" />
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

              {record.relatedDocuments?.relatedFstbs && record.relatedDocuments.relatedFstbs.length > 0 && (
                <>
                  <span className="text-muted-foreground/60">•</span>
                  <span className="inline-flex items-center gap-1 font-mono font-bold text-teal-700 dark:text-teal-300 bg-teal-500/10 px-2 py-0.5 rounded border border-teal-500/25">
                    <span>FSTB Asal: {record.relatedDocuments.relatedFstbs.join(', ')}</span>
                  </span>
                </>
              )}

              {record.recipientValidation?.recipientPhone && (
                <>
                  <span className="text-muted-foreground/60">•</span>
                  <span className="inline-flex items-center gap-1 font-mono text-muted-foreground bg-background px-2 py-0.5 rounded border border-border">
                    <Phone className="size-3 text-teal-500" />
                    <span>{record.recipientValidation.recipientPhone}</span>
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
              className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted border border-border/80 transition"
              title="Tutup Modal (Esc)"
            >
              <X className="size-4" />
            </button>
          </div>
        </div>

        {/* Mobile View Toggle */}
        <div className="flex border-b border-border lg:hidden bg-muted/20">
          <button
            type="button"
            onClick={() => setActiveTabMobile('checklist')}
            className={`flex-1 py-2.5 text-xs font-semibold text-center border-b-2 transition ${
              activeTabMobile === 'checklist'
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 bg-background'
                : 'border-transparent text-muted-foreground'
            }`}
          >
            Checklist Wewenang PIC ({validatedCount}/4)
          </button>
          <button
            type="button"
            onClick={() => setActiveTabMobile('document')}
            className={`flex-1 py-2.5 text-xs font-semibold text-center border-b-2 transition ${
              activeTabMobile === 'document'
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 bg-background'
                : 'border-transparent text-muted-foreground'
            }`}
          >
            Pratinjau Dokumen PDF
          </button>
        </div>

        {/* ========================================================= */}
        {/* MODAL BODY (SPLIT VIEW)                                   */}
        {/* ========================================================= */}
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 overflow-hidden min-h-0">
          {/* SISI KIRI: PRATINJAU DOKUMEN PDF (5/12) */}
          <div
            className={`lg:col-span-5 border-r border-border flex flex-col bg-slate-950/5 dark:bg-slate-950/40 overflow-hidden ${
              activeTabMobile === 'document' ? 'flex' : 'hidden lg:flex'
            }`}
          >
            <div className="p-3 border-b border-border bg-muted/20 flex items-center justify-between text-xs text-muted-foreground">
              <div className="flex items-center gap-2">
                <FileCheck2 className="size-4 text-amber-500" />
                <span className="font-semibold text-foreground">
                  Pratinjau Dokumen TTB Resmi {pdfPageCount ? `(${pdfPageCount} Halaman • 1 of ${pdfPageCount})` : ''}
                </span>
              </div>
              <span className="text-[11px] font-mono text-muted-foreground">
                {pdfPageCount
                  ? `Halaman 1 of ${pdfPageCount} • Memuat Kolom Pengesahan`
                  : 'Memuat 4 Kolom Pengesahan Lini Terkait'}
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
                    <span className="text-foreground truncate block">{user?.jabatan || 'Head of Operations'}</span>
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
                  <span>Daftar 4 Kolom Pengesahan TTB (Formulir Resmi)</span>
                </h3>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  Centang kolom pengesahan yang menjadi wewenang jabatan Anda. Kolom di luar wewenang Anda akan berstatus terkunci (*disabled*).
                </p>
              </div>

              {/* 4 CHECKLIST CARDS - SUSUNAN 2 KOTAK MENDATAR (2x2 GRID) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {TTB_SLOTS.map((slot) => {
                  const currentSlotState = ttbSlots[slot.key];
                  const isAlreadyValidated = Boolean(currentSlotState?.isValidated);
                  const authCheck = checkUserTtbSlotAuthority(slot.key, user);
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
                                <span>{slot.key === 'receivedBy' ? 'Diterima Kru' : 'Telah Disahkan'}</span>
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
                        <div className="mt-3 pt-2.5 border-t border-emerald-500/20 text-[11px] space-y-2">
                          <div className="flex items-center justify-between text-emerald-800 dark:text-emerald-300 font-medium">
                            <span className="truncate pr-1 text-[10.5px]">
                              {slot.key === 'receivedBy' ? 'Diterima:' : 'Disahkan:'}{' '}
                              <strong>{currentSlotState?.validatorName}</strong>
                            </span>
                            <span className="font-mono text-[10px] shrink-0">
                              {currentSlotState?.validatedAt ? currentSlotState.validatedAt.slice(0, 10) : ''}
                            </span>
                          </div>

                          {slot.key === 'receivedBy' && (
                            <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/25 text-emerald-800 dark:text-emerald-200 text-[10.5px] space-y-1">
                              <div className="flex items-center gap-1 font-bold text-emerald-700 dark:text-emerald-300">
                                <CheckCircle2 className="size-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                                <span className="truncate">Pengantaran Selesai &amp; Sah</span>
                              </div>
                              <p className="text-[10px] leading-tight text-muted-foreground line-clamp-2">
                                Diterima langsung oleh kru armada &amp; bertanda tangan digital lapangan.
                              </p>
                              {currentSlotState?.signatureDataUrl && (
                                <div className="pt-0.5 flex items-center gap-2">
                                  <span className="text-[9.5px] text-muted-foreground font-medium shrink-0">TTD Kru:</span>
                                  <div className="h-7 px-1.5 bg-white rounded border border-border flex items-center shadow-2xs">
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img
                                      src={currentSlotState.signatureDataUrl}
                                      alt="Tanda Tangan Penerima Lapangan"
                                      className="h-5 w-auto object-contain max-w-[120px]"
                                    />
                                  </div>
                                </div>
                              )}
                            </div>
                          )}

                          {slot.key !== 'receivedBy' && currentSlotState?.signatureDataUrl && (
                            <div className="pt-0.5 flex items-center gap-2">
                              <span className="text-[9.5px] text-muted-foreground font-medium shrink-0">TTD Sah:</span>
                              <div className="h-7 px-1.5 bg-white rounded border border-emerald-500/30 flex items-center shadow-2xs">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                  src={currentSlotState.signatureDataUrl}
                                  alt={`TTD ${currentSlotState.validatorName || 'Validator'}`}
                                  className="h-5 w-auto object-contain max-w-[120px]"
                                />
                              </div>
                            </div>
                          )}

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

