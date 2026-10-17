'use client';

import React, { useState, useRef, useEffect } from 'react';
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
  PenTool,
  RotateCcw,
  Boxes,
  Truck,
  ShoppingBag,
  PackageCheck,
  Calendar,
  Ship,
  Maximize2,
  Minimize2,
  ShieldAlert,
  Info,
} from 'lucide-react';
import {
  DocumentValidationRecord,
  ValidationLineType,
} from '@/types/documentValidation';
import { useAuth } from '@/context/AuthContext';

export interface ValidationSignatureModalProps {
  isOpen: boolean;
  onClose: () => void;
  record: DocumentValidationRecord | null;
  onValidationSuccess: (updatedRecord: DocumentValidationRecord) => void;
  showToast?: (msg: string, type?: 'info' | 'success' | 'warning' | 'error') => void;
}

export default function ValidationSignatureModal({
  isOpen,
  onClose,
  record,
  onValidationSuccess,
  showToast,
}: ValidationSignatureModalProps) {
  const { user, isAdmin } = useAuth();

  // Active view layout & fullscreen
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [activeTabMobile, setActiveTabMobile] = useState<'matrix' | 'document'>('matrix');

  // Form State Validasi & TTD
  const [activeSigningLine, setActiveSigningLine] = useState<ValidationLineType>('purchasing');
  const [validatorName, setValidatorName] = useState<string>('');
  const [validatorNik, setValidatorNik] = useState<string>('');
  const [validatorJabatan, setValidatorJabatan] = useState<string>('');
  const [validationNotes, setValidationNotes] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Digital Signature Canvas State
  const sigCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawingSig, setIsDrawingSig] = useState<boolean>(false);
  const [hasDrawnSig, setHasDrawnSig] = useState<boolean>(false);
  const [sigDataUrl, setSigDataUrl] = useState<string>('');

  // Sinkronisasi data awal saat modal dibuka atau record berganti
  useEffect(() => {
    if (!isOpen || !record) {
      setSigDataUrl('');
      setHasDrawnSig(false);
      setIsFullscreen(false);
      return;
    }

    // Defaultkan nama dan data validator dari akun login
    if (user?.name) {
      setValidatorName(user.name);
    } else {
      setValidatorName('');
    }

    // Tentukan lini aktif otomatis berdasarkan role pengguna atau status lini yang masih kosong
    if (user?.role === 'staf_ttb') {
      setActiveSigningLine('logistik');
    } else if (user?.role === 'staf_lapangan') {
      setActiveSigningLine('lapangan');
    } else {
      // Default: Pilih lini pertama yang belum tervalidasi
      if (!record.purchasingValidation.isValidated) {
        setActiveSigningLine('purchasing');
      } else if (!record.logistikValidation.isValidated) {
        setActiveSigningLine('logistik');
      } else if (!record.lapanganValidation.isValidated) {
        setActiveSigningLine('lapangan');
      } else {
        setActiveSigningLine('purchasing');
      }
    }
  }, [isOpen, record, user]);

  // Update default jabatan ketika lini aktif berubah
  useEffect(() => {
    if (activeSigningLine === 'purchasing') {
      setValidatorJabatan('Staf Purchasing / Pengadaan');
      setValidationNotes('Kesesuaian PO, spesifikasi item, dan harga telah diverifikasi.');
    } else if (activeSigningLine === 'logistik') {
      setValidatorJabatan('Staf Logistik & Pergudangan');
      setValidationNotes('Fisik barang, jumlah kuantitas, dan kondisi kemasan telah diperiksa.');
    } else if (activeSigningLine === 'lapangan') {
      setValidatorJabatan('Tim Lapangan / QC Distribusi');
      setValidationNotes('Pemeriksaan pra-distribusi selesai. Barang siap diserahterimakan ke kapal.');
    }
  }, [activeSigningLine]);

  // Canvas Drawing Handlers
  const getCanvasCoordinates = (
    e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>
  ) => {
    const canvas = sigCanvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    if ('touches' in e) {
      const touch = e.touches[0];
      return {
        x: (touch.clientX - rect.left) * scaleX,
        y: (touch.clientY - rect.top) * scaleY,
      };
    }
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  };

  const startDrawing = (
    e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>
  ) => {
    const canvas = sigCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const coords = getCanvasCoordinates(e);
    ctx.beginPath();
    ctx.moveTo(coords.x, coords.y);
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#0f172a'; // Tinta gelap
    setIsDrawingSig(true);
    setHasDrawnSig(true);
  };

  const draw = (
    e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>
  ) => {
    if (!isDrawingSig) return;
    const canvas = sigCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const coords = getCanvasCoordinates(e);
    ctx.lineTo(coords.x, coords.y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    if (!isDrawingSig) return;
    setIsDrawingSig(false);
    const canvas = sigCanvasRef.current;
    if (canvas) {
      setSigDataUrl(canvas.toDataURL('image/png'));
    }
  };

  const clearSignature = () => {
    const canvas = sigCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasDrawnSig(false);
    setSigDataUrl('');
  };

  // Keyboard shortcut Esc
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isFullscreen) {
          setIsFullscreen(false);
        } else {
          onClose();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isFullscreen, onClose]);

  // Eksekusi Submit Tanda Tangan Validasi
  const handleSubmitValidation = async () => {
    if (!record) return;

    if (!validatorName.trim()) {
      if (showToast) showToast('Nama penanda tangan wajib diisi!', 'warning');
      return;
    }

    if (!hasDrawnSig && !sigDataUrl) {
      if (showToast) showToast('Silakan bubuhkan tanda tangan digital pada kotak yang tersedia!', 'warning');
      return;
    }

    try {
      setIsSubmitting(true);
      const res = await fetch('/api/validasi-dokumen', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          validationId: record.id,
          docId: record.docId,
          docType: record.docType,
          line: activeSigningLine,
          validatorName: validatorName.trim(),
          validatorUsername: user?.username || 'user',
          validatorRole: user?.role || 'staf_ttb',
          validatorNik: validatorNik.trim() || undefined,
          validatorJabatan: validatorJabatan.trim() || undefined,
          signatureDataUrl: sigDataUrl,
          notes: validationNotes.trim(),
          action: 'sign',
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Gagal menyimpan tanda tangan validasi.');
      }

      if (showToast) {
        showToast(
          `Tanda tangan digital Lini ${
            activeSigningLine === 'purchasing'
              ? 'Purchasing'
              : activeSigningLine === 'logistik'
              ? 'Logistik'
              : 'Tim Lapangan'
          } berhasil disahkan!`,
          'success'
        );
      }

      onValidationSuccess(data.record);
      clearSignature();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Terjadi kegagalan saat merekam validasi.';
      if (showToast) showToast(msg, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Eksekusi Pembatalan Validasi (Admin Only)
  const handleRevokeValidation = async (line: ValidationLineType) => {
    if (!record) return;
    if (!confirm(`Apakah Anda yakin ingin membatalkan validasi lini ${line.toUpperCase()}?`)) {
      return;
    }

    try {
      setIsSubmitting(true);
      const res = await fetch('/api/validasi-dokumen', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          validationId: record.id,
          docId: record.docId,
          docType: record.docType,
          line,
          action: 'revoke',
          notes: `Dibatalkan oleh ${user?.name || 'Admin'}`,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Gagal membatalkan validasi.');
      }

      if (showToast) showToast(`Validasi lini ${line} berhasil dibatalkan.`, 'info');
      onValidationSuccess(data.record);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Gagal membatalkan validasi.';
      if (showToast) showToast(msg, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCopy = (text: string, id: string, label: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    if (showToast) showToast(`${label} disalin!`, 'info');
    setTimeout(() => setCopiedId(null), 2000);
  };

  if (!isOpen || !record) return null;

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 animate-in fade-in duration-150"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`bg-card border border-border rounded-2xl flex flex-col shadow-2xl overflow-hidden cursor-default text-card-foreground animate-in zoom-in-95 duration-150 transition-all ${
          isFullscreen
            ? 'w-full h-full max-w-none max-h-none rounded-none'
            : 'max-w-6xl w-full max-h-[94vh]'
        }`}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between p-3.5 sm:p-4 border-b border-border bg-muted/40 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="size-9 rounded-xl bg-primary/15 border border-primary/30 flex items-center justify-center text-primary shrink-0 shadow-2xs">
              <FileCheck2 className="size-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-sm sm:text-base font-bold text-foreground font-mono flex items-center gap-1.5 truncate">
                  <span>Validasi &amp; Tanda Tangan Multi-Lini</span>
                  <span
                    className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border uppercase ${
                      record.docType === 'FSTB'
                        ? 'bg-teal-500/15 text-teal-700 dark:text-teal-300 border-teal-500/20'
                        : 'bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-500/20'
                    }`}
                  >
                    {record.docType} Resmi
                  </span>
                </h3>
              </div>
              <p className="text-xs text-muted-foreground truncate mt-0.5">
                No. Dokumen: <strong className="text-foreground font-mono">{record.docNumber}</strong>
                {record.poNumber && (
                  <>
                    {' '}• PO: <span className="font-mono text-foreground">{record.poNumber}</span>
                  </>
                )}
                {record.armada && (
                  <>
                    {' '}• Armada: <span className="font-medium text-foreground">{record.armada}</span>
                  </>
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <a
              href={record.fileUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="h-8 px-2.5 rounded-lg border border-border bg-background hover:bg-muted text-xs font-medium text-foreground inline-flex items-center gap-1.5 transition cursor-pointer shadow-2xs"
              title="Buka Dokumen di Tab Baru"
            >
              <ExternalLink className="size-3.5 text-muted-foreground" />
              <span className="hidden sm:inline">Tab Baru</span>
            </a>
            <a
              href={record.fileUrl}
              download={record.renamedFileName}
              className="h-8 px-2.5 rounded-lg border border-border bg-background hover:bg-muted text-xs font-medium text-foreground inline-flex items-center gap-1.5 transition cursor-pointer shadow-2xs"
              title="Unduh Berkas"
            >
              <Download className="size-3.5 text-muted-foreground" />
              <span className="hidden sm:inline">Unduh</span>
            </a>
            <button
              type="button"
              onClick={() => setIsFullscreen(!isFullscreen)}
              className="size-8 rounded-lg border border-border bg-background hover:bg-muted text-muted-foreground hover:text-foreground flex items-center justify-center transition cursor-pointer"
              title={isFullscreen ? 'Keluar Layar Penuh' : 'Layar Penuh'}
            >
              {isFullscreen ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="size-8 rounded-lg border border-border bg-background hover:bg-muted text-muted-foreground hover:text-foreground flex items-center justify-center transition cursor-pointer"
              title="Tutup (Esc)"
            >
              <X className="size-4" />
            </button>
          </div>
        </div>

        {/* Tab Toggle untuk Layar Mobile */}
        <div className="flex lg:hidden border-b border-border bg-muted/20 shrink-0">
          <button
            type="button"
            onClick={() => setActiveTabMobile('matrix')}
            className={`flex-1 py-2 text-xs font-semibold text-center border-b-2 transition ${
              activeTabMobile === 'matrix'
                ? 'border-primary text-primary bg-primary/5'
                : 'border-transparent text-muted-foreground'
            }`}
          >
            Matriks Validasi ({record.completedLinesCount}/3)
          </button>
          <button
            type="button"
            onClick={() => setActiveTabMobile('document')}
            className={`flex-1 py-2 text-xs font-semibold text-center border-b-2 transition ${
              activeTabMobile === 'document'
                ? 'border-primary text-primary bg-primary/5'
                : 'border-transparent text-muted-foreground'
            }`}
          >
            Pratinjau Dokumen
          </button>
        </div>

        {/* Modal Main Content: Dual Pane Layout */}
        <div className="flex-1 overflow-y-auto flex flex-col lg:flex-row min-h-0 bg-background divide-y lg:divide-y-0 lg:divide-x divide-border">
          {/* Pane Kiri: Document Viewer (PDF / Image) */}
          <div
            className={`flex-1 bg-black/95 relative flex items-center justify-center p-2 min-h-[350px] lg:min-h-0 ${
              activeTabMobile === 'matrix' ? 'hidden lg:flex' : 'flex'
            }`}
          >
            {record.originalFileName.toLowerCase().endsWith('.pdf') ||
            record.renamedFileName.toLowerCase().endsWith('.pdf') ? (
              <iframe
                src={`${record.fileUrl}#view=FitH`}
                title={record.renamedFileName}
                className="w-full h-full min-h-[480px] lg:min-h-[600px] rounded-lg border-0 bg-white"
              />
            ) : (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={record.fileUrl}
                alt={record.renamedFileName}
                className="max-w-full max-h-[85vh] object-contain rounded-lg shadow-2xl"
              />
            )}
          </div>

          {/* Pane Kanan: Multi-Tier Signature Matrix & Signing Pad */}
          <div
            className={`w-full lg:w-[460px] xl:w-[500px] flex flex-col overflow-y-auto p-4 sm:p-5 space-y-4 shrink-0 bg-card ${
              activeTabMobile === 'document' ? 'hidden lg:flex' : 'flex'
            }`}
          >
            {/* Status Kelayakan Header Card */}
            <div
              className={`p-3.5 rounded-xl border flex items-center justify-between gap-3 shadow-2xs ${
                record.overallStatus === 'SUDAH_DITERIMA_ARMADA'
                  ? 'bg-teal-500/10 border-teal-500/30 text-teal-800 dark:text-teal-200'
                  : record.overallStatus === 'SIAP_KIRIM_ARMADA'
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-800 dark:text-emerald-200'
                  : record.overallStatus === 'PROSES_VALIDASI'
                  ? 'bg-blue-500/10 border-blue-500/30 text-blue-800 dark:text-blue-200'
                  : 'bg-amber-500/10 border-amber-500/30 text-amber-800 dark:text-amber-200'
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div
                  className={`size-8 rounded-lg flex items-center justify-center shrink-0 ${
                    record.isReadyForDispatch || record.overallStatus === 'SUDAH_DITERIMA_ARMADA'
                      ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400'
                      : 'bg-amber-500/20 text-amber-600 dark:text-amber-400'
                  }`}
                >
                  <ShieldCheck className="size-4.5" />
                </div>
                <div className="min-w-0">
                  <h4 className="text-xs font-bold font-mono uppercase truncate">
                    {record.overallStatus === 'SUDAH_DITERIMA_ARMADA'
                      ? 'Sudah Diterima Armada'
                      : record.overallStatus === 'SIAP_KIRIM_ARMADA'
                      ? 'Siap Dikirim ke Armada'
                      : record.overallStatus === 'PROSES_VALIDASI'
                      ? `Dalam Proses Validasi (${record.completedLinesCount}/3)`
                      : 'Menunggu Validasi (0/3)'}
                  </h4>
                  <p className="text-[11px] opacity-80 truncate">
                    {record.isReadyForDispatch
                      ? 'Dokumen sah & berkekuatan validasi penuh multi-lini'
                      : `Perlu persetujuan ${3 - record.completedLinesCount} lini sebelum diserahkan`}
                  </p>
                </div>
              </div>

              <div className="font-mono font-bold text-xs shrink-0 px-2.5 py-1 rounded-md bg-background/60 border border-border">
                {record.completedLinesCount}/3 LINI
              </div>
            </div>

            {/* Matrix 3 Lini Validasi */}
            <div className="space-y-2.5">
              <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block">
                Daftar Persetujuan 3 Lini Terkait:
              </span>

              {/* Lini 1: Purchasing */}
              <div
                className={`p-3 rounded-xl border transition ${
                  record.purchasingValidation.isValidated
                    ? 'border-emerald-500/30 bg-emerald-500/5'
                    : 'border-border bg-muted/20'
                }`}
              >
                <div className="flex items-center justify-between pb-1.5 border-b border-border/50">
                  <div className="flex items-center gap-1.5 font-bold text-xs text-foreground">
                    <ShoppingBag className="size-3.5 text-cyan-600 dark:text-cyan-400" />
                    <span>1. Purchasing / Pengadaan</span>
                  </div>
                  {record.purchasingValidation.isValidated ? (
                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/15 px-2 py-0.5 rounded-full">
                      <Check className="size-3" />
                      Tervalidasi Sah
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                      <Clock className="size-3" />
                      Menunggu TTD
                    </span>
                  )}
                </div>

                <div className="mt-2 text-xs space-y-1">
                  <div className="flex items-center justify-between text-muted-foreground">
                    <span>Penanda Tangan:</span>
                    <strong className="text-foreground font-mono">
                      {record.purchasingValidation.validatorName || '-'}
                    </strong>
                  </div>
                  {record.purchasingValidation.validatedAt && (
                    <div className="flex items-center justify-between text-muted-foreground text-[11px]">
                      <span>Waktu:</span>
                      <span className="font-mono text-foreground">
                        {record.purchasingValidation.validatedAt.slice(0, 16).replace('T', ' ')}
                      </span>
                    </div>
                  )}
                  {record.purchasingValidation.notes && (
                    <p className="text-[11px] text-muted-foreground italic bg-background/50 p-1.5 rounded-md border border-border/40 mt-1">
                      &quot;{record.purchasingValidation.notes}&quot;
                    </p>
                  )}
                  {record.purchasingValidation.signatureDataUrl && (
                    <div className="mt-1.5 pt-1.5 border-t border-border/40 flex items-center justify-between">
                      <span className="text-[10px] text-muted-foreground">Stempel Digital:</span>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={record.purchasingValidation.signatureDataUrl}
                        alt="TTD Purchasing"
                        className="h-8 max-w-[120px] object-contain bg-white rounded border border-border p-0.5"
                      />
                    </div>
                  )}
                </div>

                {isAdmin && record.purchasingValidation.isValidated && (
                  <button
                    type="button"
                    onClick={() => handleRevokeValidation('purchasing')}
                    disabled={isSubmitting}
                    className="mt-2 text-[10px] text-red-600 hover:text-red-700 underline cursor-pointer"
                  >
                    Batalkan TTD Purchasing
                  </button>
                )}
              </div>

              {/* Lini 2: Logistik & Pergudangan */}
              <div
                className={`p-3 rounded-xl border transition ${
                  record.logistikValidation.isValidated
                    ? 'border-emerald-500/30 bg-emerald-500/5'
                    : 'border-border bg-muted/20'
                }`}
              >
                <div className="flex items-center justify-between pb-1.5 border-b border-border/50">
                  <div className="flex items-center gap-1.5 font-bold text-xs text-foreground">
                    <PackageCheck className="size-3.5 text-purple-600 dark:text-purple-400" />
                    <span>2. Logistik &amp; Pergudangan</span>
                  </div>
                  {record.logistikValidation.isValidated ? (
                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/15 px-2 py-0.5 rounded-full">
                      <Check className="size-3" />
                      Tervalidasi Sah
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                      <Clock className="size-3" />
                      Menunggu TTD
                    </span>
                  )}
                </div>

                <div className="mt-2 text-xs space-y-1">
                  <div className="flex items-center justify-between text-muted-foreground">
                    <span>Penanda Tangan:</span>
                    <strong className="text-foreground font-mono">
                      {record.logistikValidation.validatorName || '-'}
                    </strong>
                  </div>
                  {record.logistikValidation.validatedAt && (
                    <div className="flex items-center justify-between text-muted-foreground text-[11px]">
                      <span>Waktu:</span>
                      <span className="font-mono text-foreground">
                        {record.logistikValidation.validatedAt.slice(0, 16).replace('T', ' ')}
                      </span>
                    </div>
                  )}
                  {record.logistikValidation.notes && (
                    <p className="text-[11px] text-muted-foreground italic bg-background/50 p-1.5 rounded-md border border-border/40 mt-1">
                      &quot;{record.logistikValidation.notes}&quot;
                    </p>
                  )}
                  {record.logistikValidation.signatureDataUrl && (
                    <div className="mt-1.5 pt-1.5 border-t border-border/40 flex items-center justify-between">
                      <span className="text-[10px] text-muted-foreground">Stempel Digital:</span>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={record.logistikValidation.signatureDataUrl}
                        alt="TTD Logistik"
                        className="h-8 max-w-[120px] object-contain bg-white rounded border border-border p-0.5"
                      />
                    </div>
                  )}
                </div>

                {isAdmin && record.logistikValidation.isValidated && (
                  <button
                    type="button"
                    onClick={() => handleRevokeValidation('logistik')}
                    disabled={isSubmitting}
                    className="mt-2 text-[10px] text-red-600 hover:text-red-700 underline cursor-pointer"
                  >
                    Batalkan TTD Logistik
                  </button>
                )}
              </div>

              {/* Lini 3: Tim Lapangan / QC Distribusi */}
              <div
                className={`p-3 rounded-xl border transition ${
                  record.lapanganValidation.isValidated
                    ? 'border-emerald-500/30 bg-emerald-500/5'
                    : 'border-border bg-muted/20'
                }`}
              >
                <div className="flex items-center justify-between pb-1.5 border-b border-border/50">
                  <div className="flex items-center gap-1.5 font-bold text-xs text-foreground">
                    <Truck className="size-3.5 text-amber-600 dark:text-amber-400" />
                    <span>3. Tim Lapangan / QC Distribusi</span>
                  </div>
                  {record.lapanganValidation.isValidated ? (
                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/15 px-2 py-0.5 rounded-full">
                      <Check className="size-3" />
                      Tervalidasi Sah
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                      <Clock className="size-3" />
                      Menunggu TTD
                    </span>
                  )}
                </div>

                <div className="mt-2 text-xs space-y-1">
                  <div className="flex items-center justify-between text-muted-foreground">
                    <span>Penanda Tangan:</span>
                    <strong className="text-foreground font-mono">
                      {record.lapanganValidation.validatorName || '-'}
                    </strong>
                  </div>
                  {record.lapanganValidation.validatedAt && (
                    <div className="flex items-center justify-between text-muted-foreground text-[11px]">
                      <span>Waktu:</span>
                      <span className="font-mono text-foreground">
                        {record.lapanganValidation.validatedAt.slice(0, 16).replace('T', ' ')}
                      </span>
                    </div>
                  )}
                  {record.lapanganValidation.notes && (
                    <p className="text-[11px] text-muted-foreground italic bg-background/50 p-1.5 rounded-md border border-border/40 mt-1">
                      &quot;{record.lapanganValidation.notes}&quot;
                    </p>
                  )}
                  {record.lapanganValidation.signatureDataUrl && (
                    <div className="mt-1.5 pt-1.5 border-t border-border/40 flex items-center justify-between">
                      <span className="text-[10px] text-muted-foreground">Stempel Digital:</span>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={record.lapanganValidation.signatureDataUrl}
                        alt="TTD Lapangan"
                        className="h-8 max-w-[120px] object-contain bg-white rounded border border-border p-0.5"
                      />
                    </div>
                  )}
                </div>

                {isAdmin && record.lapanganValidation.isValidated && (
                  <button
                    type="button"
                    onClick={() => handleRevokeValidation('lapangan')}
                    disabled={isSubmitting}
                    className="mt-2 text-[10px] text-red-600 hover:text-red-700 underline cursor-pointer"
                  >
                    Batalkan TTD Lapangan
                  </button>
                )}
              </div>
            </div>

            {/* Form Input & Signature Pad Box */}
            <div className="p-4 rounded-xl border border-primary/30 bg-primary/5 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 font-bold text-xs text-primary">
                  <PenTool className="size-4" />
                  <span>Form Pembubuhan Tanda Tangan Digital</span>
                </div>
              </div>

              {/* Selector Lini yang akan Ditandatangani */}
              <div>
                <label className="text-[11px] font-semibold text-foreground block mb-1">
                  Pilih Lini yang Ditandatangani:
                </label>
                <div className="grid grid-cols-3 gap-1.5 text-xs">
                  <button
                    type="button"
                    onClick={() => setActiveSigningLine('purchasing')}
                    className={`p-1.5 rounded-lg border text-center font-medium transition cursor-pointer ${
                      activeSigningLine === 'purchasing'
                        ? 'bg-cyan-500/20 text-cyan-800 dark:text-cyan-200 border-cyan-500/50 font-bold shadow-2xs'
                        : 'bg-background hover:bg-muted text-muted-foreground border-border'
                    }`}
                  >
                    1. Purchasing
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveSigningLine('logistik')}
                    className={`p-1.5 rounded-lg border text-center font-medium transition cursor-pointer ${
                      activeSigningLine === 'logistik'
                        ? 'bg-purple-500/20 text-purple-800 dark:text-purple-200 border-purple-500/50 font-bold shadow-2xs'
                        : 'bg-background hover:bg-muted text-muted-foreground border-border'
                    }`}
                  >
                    2. Logistik
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveSigningLine('lapangan')}
                    className={`p-1.5 rounded-lg border text-center font-medium transition cursor-pointer ${
                      activeSigningLine === 'lapangan'
                        ? 'bg-amber-500/20 text-amber-800 dark:text-amber-200 border-amber-500/50 font-bold shadow-2xs'
                        : 'bg-background hover:bg-muted text-muted-foreground border-border'
                    }`}
                  >
                    3. Lapangan
                  </button>
                </div>
              </div>

              {/* Nama & Jabatan */}
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <label className="text-[10px] font-semibold text-muted-foreground block mb-0.5">
                    Nama Validator:
                  </label>
                  <input
                    type="text"
                    value={validatorName}
                    onChange={(e) => setValidatorName(e.target.value)}
                    placeholder="Nama lengkap"
                    className="w-full h-8 px-2.5 rounded-lg border border-border bg-background text-foreground font-medium text-xs focus:ring-1 focus:ring-primary focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-semibold text-muted-foreground block mb-0.5">
                    Jabatan / Role:
                  </label>
                  <input
                    type="text"
                    value={validatorJabatan}
                    onChange={(e) => setValidatorJabatan(e.target.value)}
                    placeholder="Contoh: Staf Logistik"
                    className="w-full h-8 px-2.5 rounded-lg border border-border bg-background text-foreground text-xs focus:ring-1 focus:ring-primary focus:outline-none"
                  />
                </div>
              </div>

              {/* Catatan Verifikasi */}
              <div>
                <label className="text-[10px] font-semibold text-muted-foreground block mb-0.5">
                  Catatan Pemeriksaan:
                </label>
                <input
                  type="text"
                  value={validationNotes}
                  onChange={(e) => setValidationNotes(e.target.value)}
                  placeholder="Catatan hasil verifikasi barang..."
                  className="w-full h-8 px-2.5 rounded-lg border border-border bg-background text-foreground text-xs focus:ring-1 focus:ring-primary focus:outline-none"
                />
              </div>

              {/* Pad Tanda Tangan Canvas */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[10px] font-semibold text-muted-foreground">
                    Goreskan Tanda Tangan di Kotak Ini:
                  </label>
                  <button
                    type="button"
                    onClick={clearSignature}
                    className="text-[10px] text-muted-foreground hover:text-foreground flex items-center gap-1 cursor-pointer transition"
                  >
                    <RotateCcw className="size-3" />
                    <span>Hapus</span>
                  </button>
                </div>

                <div className="border border-border/80 rounded-xl bg-white relative overflow-hidden shadow-inner">
                  <canvas
                    ref={sigCanvasRef}
                    width={400}
                    height={110}
                    onMouseDown={startDrawing}
                    onMouseMove={draw}
                    onMouseUp={stopDrawing}
                    onMouseLeave={stopDrawing}
                    onTouchStart={startDrawing}
                    onTouchMove={draw}
                    onTouchEnd={stopDrawing}
                    className="w-full h-[110px] touch-none cursor-crosshair block"
                  />
                  {!hasDrawnSig && (
                    <div className="absolute inset-0 pointer-events-none flex items-center justify-center text-slate-400 text-xs italic">
                      Sentuh atau gunakan mouse untuk tanda tangan
                    </div>
                  )}
                </div>
              </div>

              {/* Tombol Sahkan */}
              <button
                type="button"
                onClick={handleSubmitValidation}
                disabled={isSubmitting || !validatorName.trim() || (!hasDrawnSig && !sigDataUrl)}
                className="w-full h-9 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-xs inline-flex items-center justify-center gap-2 shadow-md transition active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                {isSubmitting ? (
                  <>
                    <RefreshCw className="size-3.5 animate-spin" />
                    <span>Mengesahkan Lini...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="size-4" />
                    <span>
                      Sahkan TTD Lini{' '}
                      {activeSigningLine === 'purchasing'
                        ? 'Purchasing'
                        : activeSigningLine === 'logistik'
                        ? 'Logistik'
                        : 'Lapangan'}
                    </span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
