'use client';

import React, { useState } from 'react';
import {
  ClipboardCheck,
  Truck,
  Ship,
  FileText,
  PackageCheck,
  ShieldCheck,
  AlertCircle,
  X,
  Loader2,
  CheckCircle2,
  Eye,
  Download,
  ExternalLink,
  Images,
  Maximize2,
  Columns,
  Camera,
} from 'lucide-react';
import { PreDispatchChecklistData } from '@/types/preDispatch';

export interface PhotoItem {
  name: string;
  url: string;
  takenAt?: string | null;
  size?: number;
}

export interface PreDispatchModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetTtb: {
    noTtb: string;
    cleanNoTtb?: string;
    armada: string;
    noFpb?: string;
    noPo?: string;
    itemSummary: string;
    fileUrl?: string;
  };
  courierName: string;
  onSuccess: (data: PreDispatchChecklistData) => void;
  showToast?: (message: string, type?: 'success' | 'error' | 'info' | 'warning') => void;
}

export default function PreDispatchModal({
  isOpen,
  onClose,
  targetTtb,
  courierName,
  onSuccess,
  showToast,
}: PreDispatchModalProps) {
  const [itemsVerified, setItemsVerified] = useState(false);
  const [packagingGood, setPackagingGood] = useState(false);
  const [documentsReady, setDocumentsReady] = useState(false);
  const [dispatchNotes, setDispatchNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // State untuk pratinjau Berkas PDF Asli & Foto Tim TTB
  const [showMediaModal, setShowMediaModal] = useState(false);
  const [activeMediaTab, setActiveMediaTab] = useState<'split' | 'pdf' | 'photos'>('split');
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState<string | null>(targetTtb.fileUrl || null);
  const [isLoadingPdf, setIsLoadingPdf] = useState(false);
  const [pdfLoadError, setPdfLoadError] = useState<string | null>(null);

  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  const [isLoadingPhotos, setIsLoadingPhotos] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState<PhotoItem | null>(null);
  const [fullscreenPhoto, setFullscreenPhoto] = useState<PhotoItem | null>(null);

  if (!isOpen) return null;

  const isAllChecked = itemsVerified && packagingGood && documentsReady;

  const handleOpenMedia = async () => {
    setShowMediaModal(true);
    setPdfLoadError(null);
    setIsLoadingPdf(true);
    setIsLoadingPhotos(true);

    const clean = targetTtb.cleanNoTtb || targetTtb.noTtb;

    // 1. Resolve PDF URL
    if (targetTtb.fileUrl) {
      setPdfPreviewUrl(targetTtb.fileUrl);
      setIsLoadingPdf(false);
    } else {
      try {
        let foundPdfUrl: string | null = null;
        const resTtb = await fetch(`/api/upload-ttb?ttb=${encodeURIComponent(clean)}&_t=${Date.now()}`);
        if (resTtb.ok) {
          const data = await resTtb.json();
          if (data.success && Array.isArray(data.items) && data.items.length > 0) {
            const doc = data.items.find((d: any) => d.fileUrl) || data.items[0];
            if (doc?.fileUrl) foundPdfUrl = doc.fileUrl;
          }
        }

        if (!foundPdfUrl) {
          const resVal = await fetch(`/api/validasi-dokumen?type=TTB&q=${encodeURIComponent(clean)}&_t=${Date.now()}`);
          if (resVal.ok) {
            const dataVal = await resVal.json();
            if (dataVal.success && Array.isArray(dataVal.records) && dataVal.records.length > 0) {
              const doc = dataVal.records.find((d: any) => d.fileUrl) || dataVal.records[0];
              if (doc?.fileUrl) foundPdfUrl = doc.fileUrl;
            }
          }
        }

        if (foundPdfUrl) {
          setPdfPreviewUrl(foundPdfUrl);
        } else {
          setPdfLoadError(`Berkas scan PDF resmi untuk ${targetTtb.noTtb} belum diunggah atau tidak ditemukan.`);
        }
      } catch {
        setPdfLoadError('Gagal memuat pratinjau dokumen PDF.');
      } finally {
        setIsLoadingPdf(false);
      }
    }

    // 2. Resolve Photos from /api/ttb-photos & /api/serah-terima
    try {
      const photoMap = new Map<string, PhotoItem>();

      // Ambil foto tim TTB dari /api/ttb-photos
      const resPhotos = await fetch(`/api/ttb-photos?ttb=${encodeURIComponent(clean)}&_t=${Date.now()}`);
      if (resPhotos.ok) {
        const pData = await resPhotos.json();
        if (Array.isArray(pData.photos)) {
          pData.photos.forEach((p: any) => {
            if (p.url) {
              photoMap.set(p.url, {
                name: p.name || 'Foto TTB',
                url: p.url,
                takenAt: p.takenAt || null,
              });
            }
          });
        }
      }

      // Ambil foto jika ada dari riwayat serah terima
      const resSt = await fetch(`/api/serah-terima?ttb=${encodeURIComponent(clean)}&_t=${Date.now()}`);
      if (resSt.ok) {
        const stData = await resSt.json();
        if (Array.isArray(stData.records)) {
          stData.records.forEach((rec: any) => {
            if (Array.isArray(rec.photos)) {
              rec.photos.forEach((p: any) => {
                if (p.url && !photoMap.has(p.url)) {
                  photoMap.set(p.url, {
                    name: p.name || p.originalName || 'Foto Lapangan',
                    url: p.url,
                    takenAt: rec.tanggalSerahTerima || null,
                  });
                }
              });
            }
          });
        }
      }

      const list = Array.from(photoMap.values());
      setPhotos(list);
      if (list.length > 0) {
        setSelectedPhoto(list[0]);
        setActiveMediaTab('split');
      } else {
        setActiveMediaTab('pdf');
      }
    } catch {
      // Non-fatal
    } finally {
      setIsLoadingPhotos(false);
    }
  };

  const handleConfirmDispatch = async () => {
    if (!isAllChecked) return;

    setIsSubmitting(true);
    setSubmitError(null);

    const payload: PreDispatchChecklistData = {
      ttbId: targetTtb.cleanNoTtb || targetTtb.noTtb,
      cleanNoTtb: targetTtb.cleanNoTtb,
      noTtb: targetTtb.noTtb,
      armada: targetTtb.armada,
      noFpb: targetTtb.noFpb,
      noPo: targetTtb.noPo,
      itemSummary: targetTtb.itemSummary,
      itemsVerified,
      packagingGood,
      documentsReady,
      dispatchNotes: dispatchNotes.trim(),
      dispatchedAt: new Date().toISOString(),
      courierName: courierName || 'Petugas Lapangan',
    };

    try {
      const res = await fetch('/api/pre-dispatch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Gagal menyimpan checklist pre-dispatch');
      }

      if (showToast) {
        showToast(
          `Pemeriksaan fisik TTB ${targetTtb.noTtb} selesai! Status diperbarui: Dalam Pengantaran.`,
          'success'
        );
      }

      onSuccess(data.record || payload);
      onClose();
    } catch (err) {
      const msg = (err as Error).message || 'Terjadi kesalahan sistem';
      setSubmitError(msg);
      if (showToast) showToast(msg, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <div
        role="dialog"
        aria-modal="true"
        className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-150"
      >
        <div className="bg-card text-card-foreground border-2 border-border rounded-3xl max-w-xl w-full max-h-[92vh] flex flex-col shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150">
          {/* Header */}
          <div className="p-4 sm:p-5 border-b border-border bg-gradient-to-r from-indigo-500/10 via-background to-blue-500/10 flex items-start justify-between gap-3 shrink-0">
            <div className="flex items-center gap-3">
              <div className="size-11 sm:size-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-600/30 shrink-0">
                <ClipboardCheck className="size-6" />
              </div>
              <div>
                <h3 className="text-base sm:text-lg font-black text-foreground leading-tight flex items-center gap-2">
                  <span>Pemeriksaan Barang Sebelum Berangkat</span>
                  <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 border border-indigo-500/30">
                    Pre-Check
                  </span>
                </h3>
                <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                  Pastikan fisik barang dan dokumen pelengkap sudah sesuai sebelum dibawa ke armada/titik tujuan.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="p-1.5 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted transition cursor-pointer shrink-0"
              title="Tutup"
            >
              <X className="size-5" />
            </button>
          </div>

          {/* Scrollable Content Body */}
          <div className="p-4 sm:p-6 overflow-y-auto space-y-4.5 flex-1">
            {/* Summary Card */}
            <div className="rounded-2xl border border-indigo-200 dark:border-indigo-900/50 bg-indigo-50/50 dark:bg-indigo-950/20 p-4 space-y-3">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                {/* Tombol Nomor TTB Resmi -> Menampilkan Berkas PDF Asli & Foto Tim TTB */}
                <button
                  type="button"
                  onClick={handleOpenMedia}
                  className="group inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs sm:text-sm font-black bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white shadow-sm transition-all cursor-pointer ring-2 ring-indigo-400/30 hover:ring-indigo-400"
                  title="Klik untuk melihat berkas PDF TTB asli dan foto fisik dari tim TTB"
                >
                  <FileText className="size-3.5 shrink-0" />
                  <span className="font-mono">{targetTtb.noTtb}</span>
                  <span className="inline-flex items-center gap-1.5 text-[11px] font-bold px-2 py-0.5 rounded-md bg-white/20 text-white group-hover:bg-white group-hover:text-indigo-700 transition">
                    <Eye className="size-3" />
                    <span>Lihat PDF &amp; Foto</span>
                  </span>
                </button>

                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs sm:text-sm font-black bg-background border border-border text-foreground shadow-2xs">
                  <Ship className="size-3.5 text-cyan-500" />
                  <span>{targetTtb.armada}</span>
                </span>
              </div>

              {(targetTtb.noFpb || targetTtb.noPo) && (
                <div className="flex items-center gap-2 text-xs font-mono text-muted-foreground flex-wrap">
                  {targetTtb.noFpb && (
                    <span className="px-2 py-0.5 rounded-md bg-background/80 border border-border">
                      FPB: <strong className="text-foreground">{targetTtb.noFpb}</strong>
                    </span>
                  )}
                  {targetTtb.noPo && (
                    <span className="px-2 py-0.5 rounded-md bg-background/80 border border-border">
                      PO: <strong className="text-foreground">{targetTtb.noPo}</strong>
                    </span>
                  )}
                </div>
              )}

              <div className="pt-1 border-t border-indigo-200/60 dark:border-indigo-900/40">
                <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1 flex items-center gap-1.5">
                  <PackageCheck className="size-3.5 text-indigo-500" />
                  <span>Rincian Item Barang:</span>
                </div>
                <p className="text-xs sm:text-sm font-semibold text-foreground leading-relaxed bg-background/90 p-2.5 rounded-xl border border-border/80">
                  {targetTtb.itemSummary || 'Tidak ada keterangan rincian barang.'}
                </p>
              </div>
            </div>

            {/* Mandatory Checklist Items */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black uppercase tracking-wider text-foreground flex items-center gap-1.5">
                  <ShieldCheck className="size-4 text-emerald-500" />
                  <span>Checklist Verifikasi Fisik (Wajib Diisi):</span>
                </span>
                <span className="text-[11px] font-mono font-bold text-muted-foreground">
                  {[itemsVerified, packagingGood, documentsReady].filter(Boolean).length}/3 Selesai
                </span>
              </div>

              {/* Checkbox 1: Kesesuaian Fisik & Jumlah */}
              <label
                className={`flex items-start gap-3 p-3.5 rounded-2xl border-2 transition-all cursor-pointer ${
                  itemsVerified
                    ? 'border-emerald-500/80 bg-emerald-500/10 dark:bg-emerald-500/15 text-foreground'
                    : 'border-border hover:border-border/80 bg-background hover:bg-muted/30 text-muted-foreground'
                }`}
              >
                <input
                  type="checkbox"
                  checked={itemsVerified}
                  onChange={(e) => setItemsVerified(e.target.checked)}
                  className="mt-1 size-5 rounded-md border-border text-emerald-600 focus:ring-emerald-500 cursor-pointer accent-emerald-600"
                />
                <div className="flex-1 select-none">
                  <div className="text-xs sm:text-sm font-black text-foreground">
                    1. Kesesuaian Fisik &amp; Jumlah
                  </div>
                  <div className="text-xs mt-0.5 leading-relaxed">
                    Fisik barang dan jumlah koli/unit telah dicocokkan dengan rincian TTB.
                  </div>
                </div>
              </label>

              {/* Checkbox 2: Kondisi Kemasan / Segel */}
              <label
                className={`flex items-start gap-3 p-3.5 rounded-2xl border-2 transition-all cursor-pointer ${
                  packagingGood
                    ? 'border-emerald-500/80 bg-emerald-500/10 dark:bg-emerald-500/15 text-foreground'
                    : 'border-border hover:border-border/80 bg-background hover:bg-muted/30 text-muted-foreground'
                }`}
              >
                <input
                  type="checkbox"
                  checked={packagingGood}
                  onChange={(e) => setPackagingGood(e.target.checked)}
                  className="mt-1 size-5 rounded-md border-border text-emerald-600 focus:ring-emerald-500 cursor-pointer accent-emerald-600"
                />
                <div className="flex-1 select-none">
                  <div className="text-xs sm:text-sm font-black text-foreground">
                    2. Kondisi Kemasan / Segel
                  </div>
                  <div className="text-xs mt-0.5 leading-relaxed">
                    Barang dalam kondisi baik, kemasan rapi/segel utuh tanpa cacat fisik.
                  </div>
                </div>
              </label>

              {/* Checkbox 3: Kesiapan Dokumen Serah Terima */}
              <label
                className={`flex items-start gap-3 p-3.5 rounded-2xl border-2 transition-all cursor-pointer ${
                  documentsReady
                    ? 'border-emerald-500/80 bg-emerald-500/10 dark:bg-emerald-500/15 text-foreground'
                    : 'border-border hover:border-border/80 bg-background hover:bg-muted/30 text-muted-foreground'
                }`}
              >
                <input
                  type="checkbox"
                  checked={documentsReady}
                  onChange={(e) => setDocumentsReady(e.target.checked)}
                  className="mt-1 size-5 rounded-md border-border text-emerald-600 focus:ring-emerald-500 cursor-pointer accent-emerald-600"
                />
                <div className="flex-1 select-none">
                  <div className="text-xs sm:text-sm font-black text-foreground">
                    3. Kesiapan Dokumen Serah Terima
                  </div>
                  <div className="text-xs mt-0.5 leading-relaxed">
                    Membawa lembar TTB fisik / siap melakukan dokumentasi serah terima kepada pihak penerima di kapal.
                  </div>
                </div>
              </label>
            </div>

            {/* Optional Notes / Anomaly Input */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-foreground flex items-center justify-between">
                <span>Catatan Khusus Kondisi Barang (Opsional)</span>
                <span className="text-[11px] text-muted-foreground font-normal">Jika ada cacat minor/koli tambahan</span>
              </label>
              <textarea
                rows={2}
                value={dispatchNotes}
                onChange={(e) => setDispatchNotes(e.target.value)}
                placeholder="Contoh: Barang dibungkus plastik pelindung tambahan karena cuaca hujan..."
                className="w-full px-3.5 py-2 text-xs sm:text-sm rounded-xl border border-border bg-background text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 resize-none"
              />
            </div>

            {/* Courier Identity Info Banner */}
            <div className="px-3.5 py-2.5 rounded-xl bg-muted/50 border border-border flex items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2">
                <Truck className="size-4 text-cyan-600 dark:text-cyan-400 shrink-0" />
                <span className="text-muted-foreground">Petugas Pengantar:</span>
                <strong className="text-foreground">{courierName || 'Petugas Lapangan'}</strong>
              </div>
              <span className="text-[11px] font-mono text-muted-foreground">
                {new Date().toLocaleDateString('id-ID')}
              </span>
            </div>

            {/* Submit Error */}
            {submitError && (
              <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-600 dark:text-rose-400 text-xs flex items-center gap-2">
                <AlertCircle className="size-4 shrink-0" />
                <span>{submitError}</span>
              </div>
            )}
          </div>

          {/* Footer Actions */}
          <div className="p-4 sm:p-5 border-t border-border bg-muted/30 flex items-center justify-end gap-3 shrink-0">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold border border-border bg-background hover:bg-muted text-foreground transition cursor-pointer disabled:opacity-50"
            >
              Batal
            </button>

            <button
              type="button"
              onClick={handleConfirmDispatch}
              disabled={!isAllChecked || isSubmitting}
              className={`px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold inline-flex items-center gap-2 shadow-md transition-all cursor-pointer ${
                isAllChecked && !isSubmitting
                  ? 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-600/30 active:scale-95'
                  : 'bg-muted text-muted-foreground/60 border border-border cursor-not-allowed opacity-60'
              }`}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  <span>Memproses...</span>
                </>
              ) : (
                <>
                  <Truck className="size-4" />
                  <span>Konfirmasi &amp; Mulai Pengantaran</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* MODAL PRATINJAU GANDA: PDF ASLI & FOTO BARANG TIM TTB */}
      {showMediaModal && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-[60] flex items-center justify-center p-2 sm:p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-150"
        >
          <div className="bg-card text-card-foreground border-2 border-border rounded-3xl max-w-6xl w-full h-[92vh] flex flex-col shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150">
            {/* Modal Header with Navigation Tabs */}
            <div className="p-3.5 sm:p-4 border-b border-border bg-gradient-to-r from-indigo-500/10 via-background to-blue-500/10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shrink-0">
              <div className="flex items-center gap-3 min-w-0">
                <div className="size-10 sm:size-11 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-600/30 shrink-0">
                  <FileText className="size-5" />
                </div>
                <div className="min-w-0">
                  <h4 className="text-sm sm:text-base font-black text-foreground truncate flex items-center gap-2">
                    <span>Dokumen &amp; Foto Fisik TTB</span>
                    <span className="font-mono text-xs px-2 py-0.5 rounded-md bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 font-bold">
                      {targetTtb.noTtb}
                    </span>
                  </h4>
                  <p className="text-xs text-muted-foreground truncate mt-0.5">
                    Armada: <strong className="text-foreground">{targetTtb.armada}</strong> • Dokumen PDF &amp; Bukti Foto Tim TTB
                  </p>
                </div>
              </div>

              {/* View Switcher Controls (Split / PDF / Photos) */}
              <div className="flex items-center gap-2 self-stretch sm:self-auto justify-between sm:justify-end flex-wrap">
                <div className="inline-flex items-center p-1 rounded-xl bg-muted border border-border text-xs font-bold">
                  <button
                    type="button"
                    onClick={() => setActiveMediaTab('split')}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition cursor-pointer ${
                      activeMediaTab === 'split'
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                    title="Tampilan berdampingan PDF dan Foto"
                  >
                    <Columns className="size-3.5" />
                    <span>Split (PDF &amp; Foto)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveMediaTab('pdf')}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition cursor-pointer ${
                      activeMediaTab === 'pdf'
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <FileText className="size-3.5" />
                    <span>PDF Asli</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveMediaTab('photos')}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition cursor-pointer ${
                      activeMediaTab === 'photos'
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <Images className="size-3.5" />
                    <span>Foto Tim TTB ({photos.length})</span>
                  </button>
                </div>

                {pdfPreviewUrl && (
                  <div className="hidden lg:flex items-center gap-1.5">
                    <a
                      href={pdfPreviewUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted border border-border transition cursor-pointer"
                      title="Buka PDF di tab baru"
                    >
                      <ExternalLink className="size-4" />
                    </a>
                    <a
                      href={pdfPreviewUrl}
                      download={`${targetTtb.noTtb}.pdf`}
                      className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted border border-border transition cursor-pointer"
                      title="Unduh PDF"
                    >
                      <Download className="size-4" />
                    </a>
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => setShowMediaModal(false)}
                  className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted border border-border transition cursor-pointer"
                  title="Tutup Pratinjau"
                >
                  <X className="size-4.5" />
                </button>
              </div>
            </div>

            {/* Modal Body with dynamic tabs */}
            <div className="flex-1 overflow-hidden bg-slate-900/5 dark:bg-black/40 p-2 sm:p-3 flex flex-col">
              {activeMediaTab === 'split' ? (
                /* --- MODE SPLIT: DOKUMEN PDF (KIRI) + FOTO TIM TTB (KANAN) --- */
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 h-full overflow-y-auto lg:overflow-hidden">
                  {/* Left Column: PDF Viewer (7 Cols) */}
                  <div className="lg:col-span-7 h-[420px] lg:h-full rounded-2xl border border-border overflow-hidden bg-white dark:bg-slate-900 shadow-xs flex flex-col">
                    <div className="px-3.5 py-2 border-b border-border bg-muted/60 flex items-center justify-between text-xs font-bold text-foreground shrink-0">
                      <span className="flex items-center gap-1.5 text-indigo-700 dark:text-indigo-300">
                        <FileText className="size-4" />
                        <span>Dokumen Scan TTB Asli</span>
                      </span>
                      {pdfPreviewUrl && (
                        <a
                          href={pdfPreviewUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[11px] font-mono text-indigo-600 dark:text-indigo-400 hover:underline inline-flex items-center gap-1"
                        >
                          <span>Tab Baru</span>
                          <ExternalLink className="size-3" />
                        </a>
                      )}
                    </div>
                    <div className="flex-1 w-full h-full relative overflow-hidden bg-white">
                      {isLoadingPdf ? (
                        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-4 text-center">
                          <Loader2 className="size-6 text-indigo-600 animate-spin" />
                          <span className="text-xs font-semibold text-foreground">Memuat PDF resmi...</span>
                        </div>
                      ) : pdfPreviewUrl ? (
                        <iframe
                          src={`${pdfPreviewUrl}#view=FitH&toolbar=1`}
                          title={`PDF ${targetTtb.noTtb}`}
                          className="w-full h-full border-0"
                        />
                      ) : (
                        <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center text-xs text-muted-foreground">
                          <AlertCircle className="size-8 text-amber-500 mb-2" />
                          <p>{pdfLoadError || 'Dokumen PDF scan belum diunggah.'}</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Right Column: Foto Tim TTB (5 Cols) */}
                  <div className="lg:col-span-5 h-[420px] lg:h-full rounded-2xl border border-border overflow-hidden bg-card shadow-xs flex flex-col">
                    <div className="px-3.5 py-2 border-b border-border bg-muted/60 flex items-center justify-between text-xs font-bold text-foreground shrink-0">
                      <span className="flex items-center gap-1.5 text-cyan-700 dark:text-cyan-300">
                        <Camera className="size-4" />
                        <span>Foto Fisik Barang Tim TTB ({photos.length})</span>
                      </span>
                      {selectedPhoto && (
                        <button
                          type="button"
                          onClick={() => setFullscreenPhoto(selectedPhoto)}
                          className="text-[11px] text-cyan-600 dark:text-cyan-400 hover:underline inline-flex items-center gap-1 cursor-pointer"
                        >
                          <Maximize2 className="size-3" />
                          <span>Perbesar</span>
                        </button>
                      )}
                    </div>

                    <div className="flex-1 flex flex-col overflow-hidden p-2.5 space-y-2">
                      {/* Active Large Photo Viewer */}
                      <div className="flex-1 relative rounded-xl border border-border overflow-hidden bg-black/80 flex items-center justify-center min-h-[220px]">
                        {isLoadingPhotos ? (
                          <div className="flex flex-col items-center justify-center gap-2 text-white p-4">
                            <Loader2 className="size-6 text-cyan-400 animate-spin" />
                            <span className="text-xs">Memuat foto tim TTB...</span>
                          </div>
                        ) : selectedPhoto ? (
                          <>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={selectedPhoto.url}
                              alt={selectedPhoto.name}
                              className="w-full h-full object-contain cursor-pointer"
                              onClick={() => setFullscreenPhoto(selectedPhoto)}
                            />
                            {selectedPhoto.takenAt && (
                              <div className="absolute bottom-2 left-2 px-2.5 py-1 rounded-md bg-black/70 backdrop-blur-xs text-[11px] font-mono text-white">
                                {selectedPhoto.takenAt}
                              </div>
                            )}
                          </>
                        ) : (
                          <div className="p-6 text-center text-xs text-muted-foreground flex flex-col items-center justify-center">
                            <Images className="size-8 text-muted-foreground/50 mb-2" />
                            <p>Belum ada foto fisik barang yang diunggah oleh tim TTB.</p>
                          </div>
                        )}
                      </div>

                      {/* Photo Thumbnails Strip */}
                      {photos.length > 1 && (
                        <div className="flex items-center gap-2 overflow-x-auto pb-1 shrink-0">
                          {photos.map((p, idx) => (
                            <button
                              key={p.url + idx}
                              type="button"
                              onClick={() => setSelectedPhoto(p)}
                              className={`size-14 rounded-lg overflow-hidden border-2 transition shrink-0 cursor-pointer ${
                                selectedPhoto?.url === p.url
                                  ? 'border-indigo-600 ring-2 ring-indigo-500/30'
                                  : 'border-border/80 opacity-70 hover:opacity-100'
                              }`}
                            >
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={p.url} alt={p.name} className="w-full h-full object-cover" />
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ) : activeMediaTab === 'pdf' ? (
                /* --- MODE PENUH: DOKUMEN PDF ASLI --- */
                <div className="w-full h-full rounded-2xl border border-border overflow-hidden bg-white shadow-inner flex flex-col">
                  {isLoadingPdf ? (
                    <div className="flex-1 flex flex-col items-center justify-center gap-3 p-8">
                      <Loader2 className="size-8 text-indigo-600 animate-spin" />
                      <span className="text-sm font-bold text-foreground">Memuat berkas PDF resmi...</span>
                    </div>
                  ) : pdfPreviewUrl ? (
                    <iframe
                      src={`${pdfPreviewUrl}#view=FitH&toolbar=1`}
                      title={`PDF ${targetTtb.noTtb}`}
                      className="w-full h-full min-h-[450px] border-0"
                    />
                  ) : (
                    <div className="flex-1 p-8 text-center max-w-md mx-auto flex flex-col items-center justify-center space-y-3">
                      <AlertCircle className="size-10 text-amber-500" />
                      <h5 className="text-base font-bold text-foreground">Berkas PDF Belum Tersedia</h5>
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        {pdfLoadError || `Dokumen scan resmi untuk TTB ${targetTtb.noTtb} belum diunggah.`}
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                /* --- MODE PENUH: GALERI FOTO TIM TTB --- */
                <div className="w-full h-full rounded-2xl border border-border overflow-hidden bg-card p-4 flex flex-col space-y-3">
                  {isLoadingPhotos ? (
                    <div className="flex-1 flex flex-col items-center justify-center gap-3">
                      <Loader2 className="size-8 text-cyan-500 animate-spin" />
                      <span className="text-sm font-bold text-foreground">Memuat galeri foto fisik...</span>
                    </div>
                  ) : photos.length === 0 ? (
                    <div className="flex-1 flex flex-col items-center justify-center text-center p-8 space-y-2">
                      <Images className="size-12 text-muted-foreground/40" />
                      <h5 className="text-base font-bold text-foreground">Belum Ada Foto Fisik</h5>
                      <p className="text-xs text-muted-foreground max-w-sm">
                        Tim TTB belum mengunggah dokumentasi foto fisik barang untuk nomor {targetTtb.noTtb}.
                      </p>
                    </div>
                  ) : (
                    <div className="flex-1 flex flex-col lg:flex-row gap-4 overflow-hidden">
                      {/* Large Preview */}
                      <div className="flex-1 rounded-2xl border border-border bg-black/90 relative overflow-hidden flex items-center justify-center">
                        {selectedPhoto && (
                          <>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={selectedPhoto.url}
                              alt={selectedPhoto.name}
                              className="max-h-full max-w-full object-contain cursor-zoom-in"
                              onClick={() => setFullscreenPhoto(selectedPhoto)}
                            />
                            <div className="absolute top-3 right-3 flex items-center gap-2">
                              <a
                                href={selectedPhoto.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-2 rounded-xl bg-black/60 text-white hover:bg-black/80 transition"
                                title="Buka gambar penuh"
                              >
                                <ExternalLink className="size-4" />
                              </a>
                            </div>
                            <div className="absolute bottom-3 left-3 px-3 py-1.5 rounded-xl bg-black/70 backdrop-blur-xs text-xs font-mono text-white">
                              {selectedPhoto.name} {selectedPhoto.takenAt ? `• ${selectedPhoto.takenAt}` : ''}
                            </div>
                          </>
                        )}
                      </div>

                      {/* Thumbnails Grid List */}
                      <div className="w-full lg:w-72 overflow-y-auto space-y-2 p-1 border-t lg:border-t-0 lg:border-l border-border shrink-0">
                        <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider px-1">
                          Daftar Foto ({photos.length})
                        </div>
                        <div className="grid grid-cols-3 lg:grid-cols-2 gap-2">
                          {photos.map((p, idx) => (
                            <button
                              key={p.url + idx}
                              type="button"
                              onClick={() => setSelectedPhoto(p)}
                              className={`aspect-square rounded-xl overflow-hidden border-2 transition cursor-pointer relative group ${
                                selectedPhoto?.url === p.url
                                  ? 'border-indigo-600 ring-2 ring-indigo-500/40'
                                  : 'border-border hover:border-border/80'
                              }`}
                            >
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={p.url} alt={p.name} className="w-full h-full object-cover" />
                              <div className="absolute inset-0 bg-black/20 group-hover:bg-transparent transition" />
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* FULLSCREEN LIGHTBOX FOR PHOTOS */}
      {fullscreenPhoto && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setFullscreenPhoto(null)}
          className="fixed inset-0 z-[70] bg-black/95 backdrop-blur-md flex items-center justify-center p-3 animate-in fade-in duration-150 cursor-zoom-out"
        >
          <div className="relative max-w-5xl max-h-[92vh] flex flex-col items-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={fullscreenPhoto.url}
              alt={fullscreenPhoto.name}
              className="max-h-[85vh] max-w-full object-contain rounded-xl shadow-2xl"
            />
            <div className="mt-3 text-center text-white text-xs font-mono bg-black/70 px-4 py-2 rounded-xl backdrop-blur-xs flex items-center gap-3">
              <span>{fullscreenPhoto.name}</span>
              {fullscreenPhoto.takenAt && <span>• {fullscreenPhoto.takenAt}</span>}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setFullscreenPhoto(null);
                }}
                className="ml-2 text-rose-400 hover:text-rose-300 font-bold"
              >
                Tutup (Esc)
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
