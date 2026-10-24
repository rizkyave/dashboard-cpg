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
} from 'lucide-react';
import { PreDispatchChecklistData } from '@/types/preDispatch';

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

  // State untuk pratinjau PDF Asli
  const [showPdfModal, setShowPdfModal] = useState(false);
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState<string | null>(targetTtb.fileUrl || null);
  const [isLoadingPdf, setIsLoadingPdf] = useState(false);
  const [pdfLoadError, setPdfLoadError] = useState<string | null>(null);

  if (!isOpen) return null;

  const isAllChecked = itemsVerified && packagingGood && documentsReady;

  const handleOpenPdf = async () => {
    setShowPdfModal(true);
    setPdfLoadError(null);

    // Jika URL berkas sudah ada, gunakan langsung
    if (pdfPreviewUrl || targetTtb.fileUrl) {
      setPdfPreviewUrl(pdfPreviewUrl || targetTtb.fileUrl || null);
      return;
    }

    try {
      setIsLoadingPdf(true);
      const clean = targetTtb.cleanNoTtb || targetTtb.noTtb;

      // 1. Coba cari dari /api/upload-ttb
      const resTtb = await fetch(`/api/upload-ttb?ttb=${encodeURIComponent(clean)}&_t=${Date.now()}`);
      if (resTtb.ok) {
        const data = await resTtb.json();
        if (data.success && Array.isArray(data.items) && data.items.length > 0) {
          const doc = data.items.find((d: any) => d.fileUrl) || data.items[0];
          if (doc?.fileUrl) {
            setPdfPreviewUrl(doc.fileUrl);
            return;
          }
        }
      }

      // 2. Coba cari dari /api/validasi-dokumen
      const resVal = await fetch(`/api/validasi-dokumen?type=TTB&q=${encodeURIComponent(clean)}&_t=${Date.now()}`);
      if (resVal.ok) {
        const dataVal = await resVal.json();
        if (dataVal.success && Array.isArray(dataVal.records) && dataVal.records.length > 0) {
          const doc = dataVal.records.find((d: any) => d.fileUrl) || dataVal.records[0];
          if (doc?.fileUrl) {
            setPdfPreviewUrl(doc.fileUrl);
            return;
          }
        }
      }

      setPdfLoadError(`Berkas scan PDF resmi untuk ${targetTtb.noTtb} belum diunggah atau tidak ditemukan.`);
    } catch {
      setPdfLoadError('Gagal memuat pratinjau dokumen PDF.');
    } finally {
      setIsLoadingPdf(false);
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
                {/* Tombol Nomor TTB Resmi -> Menampilkan Berkas PDF Asli */}
                <button
                  type="button"
                  onClick={handleOpenPdf}
                  className="group inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs sm:text-sm font-black bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white shadow-sm transition-all cursor-pointer ring-2 ring-indigo-400/30 hover:ring-indigo-400"
                  title="Klik untuk melihat berkas PDF TTB asli"
                >
                  <FileText className="size-3.5 shrink-0" />
                  <span className="font-mono">{targetTtb.noTtb}</span>
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-md bg-white/20 text-white group-hover:bg-white group-hover:text-indigo-700 transition">
                    <Eye className="size-3" />
                    <span>Lihat PDF</span>
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

      {/* Modal Pratinjau Dokumen PDF TTB Asli */}
      {showPdfModal && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-[60] flex items-center justify-center p-3 sm:p-5 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-150"
        >
          <div className="bg-card text-card-foreground border-2 border-border rounded-3xl max-w-4xl w-full h-[88vh] flex flex-col shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="p-4 sm:p-5 border-b border-border bg-gradient-to-r from-indigo-500/10 via-background to-blue-500/10 flex items-center justify-between gap-3 shrink-0">
              <div className="flex items-center gap-3 min-w-0">
                <div className="size-10 sm:size-11 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-600/30 shrink-0">
                  <FileText className="size-5" />
                </div>
                <div className="min-w-0">
                  <h4 className="text-sm sm:text-base font-black text-foreground truncate flex items-center gap-2">
                    <span>Dokumen PDF TTB Asli</span>
                    <span className="font-mono text-xs px-2 py-0.5 rounded-md bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 font-bold">
                      {targetTtb.noTtb}
                    </span>
                  </h4>
                  <p className="text-xs text-muted-foreground truncate mt-0.5">
                    Armada: <strong className="text-foreground">{targetTtb.armada}</strong> • Dokumen Scan Logistik
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {pdfPreviewUrl && (
                  <>
                    <a
                      href={pdfPreviewUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border border-border bg-background hover:bg-muted text-foreground transition cursor-pointer"
                      title="Buka di tab baru"
                    >
                      <ExternalLink className="size-3.5" />
                      <span className="hidden sm:inline">Buka Tab Baru</span>
                    </a>
                    <a
                      href={pdfPreviewUrl}
                      download={`${targetTtb.noTtb}.pdf`}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white transition cursor-pointer shadow-xs"
                      title="Unduh berkas PDF"
                    >
                      <Download className="size-3.5" />
                      <span className="hidden sm:inline">Unduh PDF</span>
                    </a>
                  </>
                )}
                <button
                  type="button"
                  onClick={() => setShowPdfModal(false)}
                  className="p-1.5 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted transition cursor-pointer"
                  title="Tutup Pratinjau"
                >
                  <X className="size-5" />
                </button>
              </div>
            </div>

            {/* Content Body: iframe viewer */}
            <div className="flex-1 bg-slate-900/5 dark:bg-black/40 p-2 sm:p-4 overflow-hidden flex flex-col justify-center items-center">
              {isLoadingPdf ? (
                <div className="flex flex-col items-center justify-center gap-3 p-8">
                  <Loader2 className="size-8 text-indigo-600 animate-spin" />
                  <span className="text-sm font-bold text-foreground">Memuat berkas PDF resmi...</span>
                  <span className="text-xs text-muted-foreground">Menghubungkan ke Cloudflare R2 storage</span>
                </div>
              ) : pdfPreviewUrl ? (
                <div className="w-full h-full rounded-2xl border border-border overflow-hidden bg-white shadow-inner flex flex-col">
                  <iframe
                    src={`${pdfPreviewUrl}#view=FitH&toolbar=1`}
                    title={`PDF ${targetTtb.noTtb}`}
                    className="w-full h-full min-h-[450px] border-0"
                  />
                </div>
              ) : (
                <div className="p-8 text-center max-w-md space-y-3">
                  <div className="size-14 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-600 dark:text-amber-400 mx-auto flex items-center justify-center">
                    <AlertCircle className="size-7" />
                  </div>
                  <h5 className="text-base font-bold text-foreground">Berkas PDF Belum Tersedia</h5>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {pdfLoadError || `Dokumen scan resmi untuk TTB ${targetTtb.noTtb} belum diunggah ke penyimpanan Cloudflare R2.`}
                  </p>
                  <button
                    type="button"
                    onClick={() => setShowPdfModal(false)}
                    className="px-4 py-2 rounded-xl text-xs font-bold bg-indigo-600 text-white hover:bg-indigo-700 transition cursor-pointer"
                  >
                    Kembali ke Checklist
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
