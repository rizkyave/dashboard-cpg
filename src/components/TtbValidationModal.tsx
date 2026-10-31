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
  Truck,
  Camera,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Image as ImageIcon,
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
    roleTitle: 'Penerima Barang di Kapal (Crew Armada / End User)',
    description: 'Menyatakan bahwa barang fisik telah diterima langsung oleh kru kapal / penerima di titik tujuan. Petugas kurir lapangan (Agus) bertugas mengantar barang & mendokumentasikan foto serah terima TimeMark.',
    authorityLabel: 'Penerima di Kapal / Crew Armada',
    declarationText: 'Saya menyatakan dengan sadar bahwa saya adalah penerima barang di kapal / armada dan barang telah diterima langsung dalam kondisi baik dan lengkap.',
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
      // Petugas kurir lapangan (Agus) TIDAK berhak menandatangani TTB sebagai penerima barang.
      if (
        role === 'staf_lapangan' ||
        jabatan.includes('lapangan') ||
        dept.includes('lapangan')
      ) {
        return {
          allowed: false,
          reason: 'Petugas kurir lapangan (Agus) bertugas mengirim barang & dokumentasi foto. TTB hanya sah ditandatangani oleh Kru Penerima di Kapal.',
        };
      }
      // Hanya sah jika ditandatangani oleh penerima barang di kapal (crew armada kapal, user pemohon)
      if (
        role === 'user' ||
        jabatan.includes('armada') ||
        jabatan.includes('kapal') ||
        jabatan.includes('crew') ||
        jabatan.includes('kapten') ||
        jabatan.includes('nakhoda') ||
        jabatan.includes('masinis') ||
        jabatan.includes('chief') ||
        dept.includes('armada')
      ) {
        return { allowed: true, reason: 'Wewenang Sah: Penerima / Kru Armada Kapal' };
      }
      return { allowed: false, reason: 'Hanya dapat divalidasi oleh Kru Penerima di Kapal / Armada' };

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

  // Data Foto Bukti Serah Terima Lapangan (TimeMark R2)
  interface PhotoItem {
    name: string;
    url: string;
    takenAt?: string | null;
    ttbInfo?: {
      prefix?: string | null;
      numbers?: string[];
    };
  }
  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  const [isLoadingPhotos, setIsLoadingPhotos] = useState<boolean>(false);
  const [showPhotoModal, setShowPhotoModal] = useState<boolean>(false);
  const [selectedPhotoIdx, setSelectedPhotoIdx] = useState<number>(0);
  const [leftPanelView, setLeftPanelView] = useState<'document' | 'photo'>('document');

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

  // Fetch Foto Lapangan Real-time dari Cloudflare R2
  useEffect(() => {
    if (!isOpen || !record?.docNumber) {
      setPhotos([]);
      setShowPhotoModal(false);
      setSelectedPhotoIdx(0);
      setLeftPanelView('document');
      return;
    }

    let isMounted = true;
    setIsLoadingPhotos(true);

    const cleanTtb = (record.docNumber || record.cleanDocNumber || '').trim();

    fetch(`/api/ttb-photos?ttb=${encodeURIComponent(cleanTtb)}&_t=${Date.now()}`)
      .then((r) => r.json())
      .then((data) => {
        if (!isMounted) return;
        if (Array.isArray(data.photos) && data.photos.length > 0) {
          setPhotos(data.photos);
        } else {
          setPhotos([]);
        }
      })
      .catch((err) => {
        console.warn('Gagal memuat foto TTB:', err);
        if (isMounted) setPhotos([]);
      })
      .finally(() => {
        if (isMounted) setIsLoadingPhotos(false);
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, record?.docNumber, record?.cleanDocNumber, pdfRefreshKey]);

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
        if (showPhotoModal) setShowPhotoModal(false);
        else if (isFullscreen) setIsFullscreen(false);
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
    record.ttbSlots?.receivedBy?.isValidated
  );

  const effectiveReceivedBy = isRecipientSigned
    ? {
        isValidated: true,
        validatorName:
          record.ttbSlots?.receivedBy?.validatorName ||
          record.recipientValidation?.recipientName ||
          'Kru Penerima di Kapal',
        validatorJabatan:
          record.ttbSlots?.receivedBy?.validatorJabatan ||
          'Penerima / Crew Armada Kapal',
        validatorRole: 'user',
        validatedAt:
          record.ttbSlots?.receivedBy?.validatedAt ||
          record.recipientValidation?.signedAt ||
          record.updatedAt,
        signatureDataUrl:
          record.ttbSlots?.receivedBy?.signatureDataUrl ||
          record.recipientValidation?.signatureDataUrl,
        notes:
          record.ttbSlots?.receivedBy?.notes ||
          'Barang fisik telah diterima langsung oleh kru kapal / armada di titik tujuan.',
        verificationToken:
          record.ttbSlots?.receivedBy?.verificationToken ||
          'VAL-SERAH-TERIMA-KAPAL',
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

      // Kirim Notifikasi In-App & WA Gateway bahwa TTB telah divalidasi dan siap untuk serah terima lapangan
      try {
        fetch('/api/notifications', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'TTB_VALIDATED',
            title: '🛡️ TTB Divalidasi & Disahkan',
            message: `User ${user?.name || 'Manager'} telah mengesahkan dokumen TTB ${record.docNumber} (${record.armada || 'Kapal/Unit'}). Berkas siap untuk proses serah terima di lapangan.`,
            senderName: user?.name || 'User Pengesah',
            senderUsername: user?.username || 'user',
            senderRole: user?.jabatan || user?.role || 'Manager/Atasan',
            targetRole: 'staf_lapangan',
            linkTab: 'serah-terima',
            metadata: {
              noTtb: record.docNumber,
              armada: record.armada,
              noPo: record.poNumber,
              noFpb: record.fpbNumber,
              itemSummary: (record as Record<string, any>).itemDetails || (record as Record<string, any>).itemSummary,
            },
          }),
        }).catch(() => {});
      } catch {}

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


              {/* ═══════════════════════════════════════════════════════════ */}
              {/* TOMBOL FOTO LAPANGAN (AREA KOTAK HITAM)                     */}
              {/* ═══════════════════════════════════════════════════════════ */}
              {isLoadingPhotos ? (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-muted text-muted-foreground border border-border">
                  <Loader2 className="size-3 animate-spin text-purple-500" />
                  <span>Memeriksa Foto...</span>
                </span>
              ) : photos.length > 0 ? (
                <button
                  type="button"
                  onClick={() => setShowPhotoModal(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-xs font-bold transition shadow-xs cursor-pointer active:scale-95 bg-purple-500/15 hover:bg-purple-500/25 text-purple-700 dark:text-purple-300 border border-purple-500/35 hover:border-purple-500/50 group"
                  title={`Klik untuk membuka ${photos.length} foto bukti fisik serah terima TimeMark dari kru/kurir lapangan`}
                >
                  <Camera className="size-3.5 text-purple-600 dark:text-purple-400 group-hover:scale-110 transition-transform" />
                  <span>Foto Lapangan ({photos.length})</span>
                  <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse ml-0.5" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    if (showToast) showToast('Belum ada foto serah terima yang diunggah untuk dokumen TTB ini.', 'info');
                  }}
                  className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-muted/60 hover:bg-muted text-muted-foreground border border-border/60 transition cursor-help"
                  title="Belum ada foto dokumentasi serah terima barang yang diunggah untuk No. TTB ini"
                >
                  <Camera className="size-3.5 text-muted-foreground/50" />
                  <span>Foto Lapangan (Belum Ada)</span>
                </button>
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
            <div className="p-2 sm:p-2.5 border-b border-border bg-muted/20 flex items-center justify-between text-xs text-muted-foreground flex-wrap gap-2">
              <div className="flex items-center gap-1 bg-background/80 p-0.5 rounded-lg border border-border/80">
                <button
                  type="button"
                  onClick={() => setLeftPanelView('document')}
                  className={`px-2.5 py-1 rounded-md text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer ${
                    leftPanelView === 'document'
                      ? 'bg-card text-foreground shadow-xs border border-border/60'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <FileText className="size-3.5 text-amber-500" />
                  <span>Dokumen PDF</span>
                </button>
                <button
                  type="button"
                  onClick={() => setLeftPanelView('photo')}
                  className={`px-2.5 py-1 rounded-md text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer ${
                    leftPanelView === 'photo'
                      ? 'bg-card text-purple-700 dark:text-purple-300 shadow-xs border border-purple-500/30'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <Camera className="size-3.5 text-purple-500" />
                  <span>Foto Fisik (${photos.length})</span>
                </button>
              </div>

              {leftPanelView === 'document' ? (
                <span className="text-[11px] font-mono text-muted-foreground">
                  {pdfPageCount
                    ? `Halaman 1 of ${pdfPageCount} • Memuat Kolom Pengesahan`
                    : 'Memuat 4 Kolom Pengesahan Lini Terkait'}
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowPhotoModal(true)}
                  className="text-[11px] font-semibold text-purple-600 dark:text-purple-400 hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <Maximize2 className="size-3" />
                  <span>Perbesar Lightbox</span>
                </button>
              )}
            </div>

            <div className="flex-1 p-2 sm:p-3 overflow-hidden bg-slate-900/10 flex flex-col min-h-[400px]">
              {leftPanelView === 'document' ? (
                <iframe
                  key={previewPdfUrl}
                  src={previewPdfUrl}
                  title={`Pratinjau ${record.docNumber}`}
                  className="w-full h-full rounded-xl border border-border bg-card shadow-inner"
                />
              ) : photos.length > 0 ? (
                <div className="w-full h-full rounded-xl border border-border bg-card shadow-inner flex flex-col overflow-hidden">
                  <div className="relative flex-1 bg-black/30 flex items-center justify-center p-3 overflow-hidden">
                    <img
                      src={photos[selectedPhotoIdx]?.url}
                      alt={photos[selectedPhotoIdx]?.name}
                      className="max-h-full max-w-full object-contain rounded-lg shadow-md cursor-pointer hover:scale-[1.01] transition-transform"
                      onClick={() => setShowPhotoModal(true)}
                      title="Klik untuk membuka foto di lightbox layar penuh"
                    />
                  </div>
                  {photos.length > 1 && (
                    <div className="p-2 border-t border-border bg-muted/30 flex items-center justify-center gap-1.5 overflow-x-auto">
                      {photos.map((p, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => setSelectedPhotoIdx(idx)}
                          className={`size-8 rounded overflow-hidden border-2 transition cursor-pointer ${
                            idx === selectedPhotoIdx ? 'border-purple-500 ring-2 ring-purple-500/30' : 'border-transparent opacity-60 hover:opacity-100'
                          }`}
                        >
                          <img src={p.url} alt={p.name} className="w-full h-full object-cover" />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="w-full h-full rounded-xl border border-dashed border-border bg-muted/20 flex flex-col items-center justify-center p-6 text-center text-muted-foreground gap-2">
                  <Camera className="size-8 text-muted-foreground/40" />
                  <p className="text-xs font-semibold">Belum Ada Foto Terunggah</p>
                  <p className="text-[11px] text-muted-foreground/80 max-w-xs">
                    Petugas kurir lapangan belum mengunggah foto serah terima TimeMark untuk No. TTB ini.
                  </p>
                </div>
              )}
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
                            <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/25 text-emerald-800 dark:text-emerald-200 text-[10.5px] space-y-2">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-1 font-bold text-emerald-700 dark:text-emerald-300">
                                  <CheckCircle2 className="size-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                                  <span className="truncate">Sah Diterima Kru di Kapal</span>
                                </div>
                                <span className="text-[9.5px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-800 dark:text-emerald-200">
                                  Kru Armada Kapal
                                </span>
                              </div>

                              <div className="text-[10px] text-muted-foreground leading-relaxed space-y-0.5">
                                <div><strong className="text-foreground">Penerima Sah:</strong> {currentSlotState?.validatorName || 'Crew Armada'}</div>
                                {record.recipientValidation?.recipientPhone && (
                                  <div><strong className="text-foreground">Kontak:</strong> {record.recipientValidation.recipientPhone}</div>
                                )}
                              </div>

                              {/* Indikator Dokumentasi Kurir Lapangan (Agus) */}
                              <div className="p-1.5 rounded bg-background/80 border border-border/80 text-[10px] space-y-0.5">
                                <div className="flex items-center gap-1 font-semibold text-blue-700 dark:text-blue-300">
                                  <Truck className="size-3 text-blue-600 shrink-0" />
                                  <span>Petugas Kurir Pengantaran:</span>
                                  <span className="font-bold">Agus (Tim Lapangan)</span>
                                </div>
                                <p className="text-[9.5px] text-muted-foreground leading-tight">
                                  Barang telah diantar fisik &amp; bukti serah terima TimeMark terverifikasi.
                                </p>
                              </div>

                              {currentSlotState?.signatureDataUrl && (
                                <div className="pt-0.5 flex items-center gap-2">
                                  <span className="text-[9.5px] text-muted-foreground font-medium shrink-0">TTD Kru Kapal:</span>
                                  <div className="h-7 px-1.5 bg-white rounded border border-border flex items-center shadow-2xs">
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img
                                      src={currentSlotState.signatureDataUrl}
                                      alt="Tanda Tangan Penerima Kapal"
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
                          {slot.key === 'receivedBy' && (
                            <div className="mb-2 p-2 rounded-lg bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200/60 dark:border-blue-800/40 text-[10px] space-y-1">
                              <div className="flex items-center gap-1.5 font-bold text-blue-700 dark:text-blue-300">
                                <Truck className="size-3 shrink-0" />
                                <span>Peran Kurir Lapangan (Agus):</span>
                              </div>
                              <p className="text-[9.5px] text-muted-foreground leading-tight">
                                Mengantar fisik barang &amp; mengunggah bukti dokumentasi foto serah terima TimeMark. Penandatanganan kolom ini merupakan wewenang sah Kru Penerima di Kapal.
                              </p>
                            </div>
                          )}
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

      {/* ═══════════════════════════════════════════════════════════ */}
      {/* MODAL LIGHTBOX FOTO SERAH TERIMA LAPANGAN                  */}
      {/* ═══════════════════════════════════════════════════════════ */}
      {showPhotoModal && photos.length > 0 && (
        <div className="fixed inset-0 z-[100] bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 animate-in fade-in duration-200">
          <div className="relative w-full max-w-4xl bg-card border border-border rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
            {/* Lightbox Header */}
            <div className="flex items-center justify-between px-4 sm:px-5 py-3 border-b border-border bg-muted/40">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="size-8 rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20 flex items-center justify-center shrink-0">
                  <Camera className="size-4" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-xs sm:text-sm font-bold text-foreground truncate flex items-center gap-1.5">
                    <span>Foto Dokumentasi Serah Terima Barang</span>
                    <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-700 dark:text-purple-300 border border-purple-500/20 font-semibold">
                      {record.docNumber}
                    </span>
                  </h3>
                  <p className="text-[10px] text-muted-foreground truncate">
                    Unit: <span className="font-semibold text-foreground">{record.armada}</span>
                    {photos.length > 1 && ` • Foto ${selectedPhotoIdx + 1} dari ${photos.length}`}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <a
                  href={photos[selectedPhotoIdx]?.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-1.5 sm:px-2.5 sm:py-1 rounded-lg border border-border bg-background hover:bg-muted text-foreground text-xs font-medium flex items-center gap-1 transition"
                  title="Buka Foto Asli di Tab Baru"
                >
                  <ExternalLink className="size-3.5" />
                  <span className="hidden sm:inline">Buka Penuh</span>
                </a>
                <a
                  href={photos[selectedPhotoIdx]?.url}
                  download={photos[selectedPhotoIdx]?.name || 'foto-ttb.jpg'}
                  className="p-1.5 sm:px-2.5 sm:py-1 rounded-lg border border-border bg-background hover:bg-muted text-foreground text-xs font-medium flex items-center gap-1 transition"
                  title="Unduh Berkas Foto"
                >
                  <Download className="size-3.5" />
                  <span className="hidden sm:inline">Unduh</span>
                </a>
                <button
                  type="button"
                  onClick={() => setShowPhotoModal(false)}
                  className="p-1.5 rounded-lg border border-border bg-background hover:bg-muted text-muted-foreground hover:text-foreground transition cursor-pointer"
                  title="Tutup Pratinjau Foto (Esc)"
                >
                  <X className="size-4" />
                </button>
              </div>
            </div>

            {/* Lightbox Body: Photo Display */}
            <div className="relative flex-1 bg-black/40 flex items-center justify-center p-3 sm:p-5 overflow-hidden min-h-[350px]">
              {photos[selectedPhotoIdx] && (
                <img
                  src={photos[selectedPhotoIdx].url}
                  alt={photos[selectedPhotoIdx].name}
                  className="max-h-[62vh] max-w-full object-contain rounded-lg shadow-xl border border-white/10"
                />
              )}

              {/* Prev / Next buttons if multiple photos */}
              {photos.length > 1 && (
                <>
                  <button
                    type="button"
                    onClick={() => setSelectedPhotoIdx((prev) => (prev > 0 ? prev - 1 : photos.length - 1))}
                    className="absolute left-3 top-1/2 -translate-y-1/2 size-9 rounded-full bg-black/60 hover:bg-black/80 text-white flex items-center justify-center transition border border-white/20 shadow-lg cursor-pointer"
                    title="Foto Sebelumnya"
                  >
                    <ChevronLeft className="size-5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedPhotoIdx((prev) => (prev < photos.length - 1 ? prev + 1 : 0))}
                    className="absolute right-3 top-1/2 -translate-y-1/2 size-9 rounded-full bg-black/60 hover:bg-black/80 text-white flex items-center justify-center transition border border-white/20 shadow-lg cursor-pointer"
                    title="Foto Berikutnya"
                  >
                    <ChevronRight className="size-5" />
                  </button>
                </>
              )}
            </div>

            {/* Lightbox Footer & Thumbnails */}
            <div className="px-4 py-3 border-t border-border bg-card flex flex-col sm:flex-row items-center justify-between gap-2.5 text-xs">
              <div className="flex items-center gap-2 min-w-0">
                <Sparkles className="size-3.5 text-purple-500 shrink-0" />
                <div className="min-w-0">
                  <span className="font-mono text-[11px] text-foreground truncate block">
                    {photos[selectedPhotoIdx]?.name}
                  </span>
                  <span className="text-[10px] text-muted-foreground block truncate">
                    {photos[selectedPhotoIdx]?.takenAt
                      ? `Waktu Foto: ${photos[selectedPhotoIdx].takenAt}`
                      : 'Dokumentasi Fisik TimeMark Lapangan • Cloudflare R2'}
                  </span>
                </div>
              </div>

              {/* Thumbnail strip if multiple photos */}
              {photos.length > 1 && (
                <div className="flex items-center gap-1.5 overflow-x-auto max-w-full py-0.5">
                  {photos.map((p, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setSelectedPhotoIdx(idx)}
                      className={`size-10 rounded-md overflow-hidden border-2 transition cursor-pointer shrink-0 ${
                        idx === selectedPhotoIdx
                          ? 'border-purple-500 ring-2 ring-purple-500/30'
                          : 'border-border/60 opacity-60 hover:opacity-100'
                      }`}
                      title={p.name}
                    >
                      <img src={p.url} alt={p.name} className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              )}

              <button
                type="button"
                onClick={() => setShowPhotoModal(false)}
                className="h-7 px-3 rounded-lg border border-border bg-muted hover:bg-muted/80 text-foreground text-xs font-semibold transition cursor-pointer shrink-0"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

        </div>
      </div>
    </div>
  );
}

