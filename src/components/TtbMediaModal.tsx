'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  Camera,
  ExternalLink,
  Copy,
  Check,
  Settings,
  X,
  Sparkles,
  Info,
  RotateCcw,
  Server,
  ImageOff,
  Loader2,
  Maximize2,
  Printer,
  FileText,
  Download,
  Eye,
  FileCheck,
  Ship,
  Layers,
  Calendar,
  CheckCircle2,
  Package,
  ArrowRight,
  ShieldCheck,
  LayoutGrid,
  FileSpreadsheet,
} from 'lucide-react';
import {
  extractFstbLast5,
  getTimemarkPortalUrl,
  setTimemarkPortalUrl,
  DEFAULT_TIMEMARK_PORTAL_URL,
  parseTtbList,
} from '@/utils/timemark';
import { UploadedTtbItem } from '@/types/ttbUpload';
import { formatFileSize } from '@/utils/ttbRename';

export interface PhotoItem {
  name: string;
  url: string;
  takenAt: string | null;
  ttbInfo?: {
    prefix: string | null;
    numbers: string[];
  };
}

export interface TtbMediaModalProps {
  isOpen: boolean;
  onClose: () => void;
  noFstb?: string;
  noTtb?: string;
  fpb?: string;
  po?: string;
  item?: string;
  armada?: string;
  entity?: string;
  statusBadge?: string;
  workflowStatus?: string;
  picPch?: string;
  picTtb?: string;
  picLap?: string;
  picAdm?: string;
  showToast?: (msg: string, type?: 'info' | 'success' | 'warning' | 'error') => void;
  onNavigateToUpload?: (ttb?: string) => void;
}

type ViewTab = 'split' | 'docs' | 'photos' | 'info';

export default function TtbMediaModal({
  isOpen,
  onClose,
  noFstb,
  noTtb,
  fpb,
  po,
  item,
  armada,
  entity,
  statusBadge,
  workflowStatus,
  picPch,
  picTtb,
  picLap,
  picAdm,
  showToast,
  onNavigateToUpload,
}: TtbMediaModalProps) {
  // Multi-TTB support: parse if multiple TTBs exist (e.g. "CPL-TTB-26-06713, 06714")
  const parsedTtbs = useMemo(() => {
    return parseTtbList(noTtb);
  }, [noTtb]);

  const [activeTtbIndex, setActiveTtbIndex] = useState<number>(0);

  // Current active TTB string
  const activeTtb = useMemo(() => {
    if (parsedTtbs.length > 0) {
      return parsedTtbs[Math.min(activeTtbIndex, parsedTtbs.length - 1)];
    }
    return (noTtb || '').trim();
  }, [parsedTtbs, activeTtbIndex, noTtb]);

  const [activeTab, setActiveTab] = useState<ViewTab>('split');
  const [copiedCode, setCopiedCode] = useState<boolean>(false);
  const [copiedTtb, setCopiedTtb] = useState<boolean>(false);

  // TimeMark portal state
  const [isConfigOpen, setIsConfigOpen] = useState<boolean>(false);
  const [portalUrl, setPortalUrlState] = useState<string>(DEFAULT_TIMEMARK_PORTAL_URL);
  const [customInputUrl, setCustomInputUrl] = useState<string>('');

  // Dokumen TTB (PDF/Berkas) dari Cloudflare R2
  const [documents, setDocuments] = useState<UploadedTtbItem[]>([]);
  const [docsLoading, setDocsLoading] = useState<boolean>(false);
  const [docsError, setDocsError] = useState<string>('');
  const [selectedDocIdx, setSelectedDocIdx] = useState<number>(0);

  // Foto Fisik Serah Terima Lapangan dari Cloudflare R2
  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  const [photosLoading, setPhotosLoading] = useState<boolean>(false);
  const [photosError, setPhotosError] = useState<string>('');
  const [selectedPhotoIdx, setSelectedPhotoIdx] = useState<number>(0);

  // Lightbox fullscreen photo viewer
  const [isFullscreenPhoto, setIsFullscreenPhoto] = useState<boolean>(false);

  // Kode 5 digit FSTB / TTB untuk TimeMark
  const shortCode = useMemo(() => {
    return extractFstbLast5(noFstb) || extractFstbLast5(activeTtb);
  }, [noFstb, activeTtb]);

  useEffect(() => {
    if (isOpen) {
      const current = getTimemarkPortalUrl();
      setPortalUrlState(current);
      setCustomInputUrl(current);
      setCopiedCode(false);
      setCopiedTtb(false);
      setIsConfigOpen(false);
      setIsFullscreenPhoto(false);
    }
  }, [isOpen]);

  // Fetch Dokumen Scan PDF dari Cloudflare R2 saat TTB berubah
  useEffect(() => {
    if (!isOpen || !activeTtb) {
      setDocuments([]);
      return;
    }
    let cancelled = false;
    setDocsLoading(true);
    setDocsError('');
    setSelectedDocIdx(0);

    fetch(`/api/upload-ttb?ttb=${encodeURIComponent(activeTtb)}&_t=${Date.now()}`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        if (data.items) {
          setDocuments(data.items);
        } else {
          setDocuments([]);
        }
        if (data.error) setDocsError(data.error);
      })
      .catch(() => {
        if (!cancelled) setDocsError('Gagal memuat dokumen scan TTB dari Cloudflare R2.');
      })
      .finally(() => {
        if (!cancelled) setDocsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isOpen, activeTtb]);

  // Fetch Foto Lapangan dari Cloudflare R2 saat TTB berubah
  useEffect(() => {
    if (!isOpen || !activeTtb) {
      setPhotos([]);
      return;
    }
    let cancelled = false;
    setPhotosLoading(true);
    setPhotosError('');
    setSelectedPhotoIdx(0);

    fetch(`/api/ttb-photos?ttb=${encodeURIComponent(activeTtb)}`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        setPhotos(data.photos || []);
        if (data.error) setPhotosError(data.error);
      })
      .catch(() => {
        if (!cancelled) setPhotosError('Gagal memuat galeri foto TTB dari Cloudflare R2.');
      })
      .finally(() => {
        if (!cancelled) setPhotosLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isOpen, activeTtb]);

  if (!isOpen) return null;

  const selectedDoc = documents[selectedDocIdx] || documents[0];
  const selectedPhoto = photos[selectedPhotoIdx] || photos[0];

  const handleCopyCode = async () => {
    if (!shortCode) return;
    try {
      await navigator.clipboard.writeText(shortCode);
      setCopiedCode(true);
      showToast?.(`Kode TimeMark "${shortCode}" disalin ke clipboard!`, 'success');
      setTimeout(() => setCopiedCode(false), 2000);
    } catch {
      showToast?.('Gagal menyalin kode ke clipboard.', 'warning');
    }
  };

  const handleCopyTtb = async () => {
    if (!activeTtb) return;
    try {
      await navigator.clipboard.writeText(activeTtb);
      setCopiedTtb(true);
      showToast?.(`Nomor TTB "${activeTtb}" disalin ke clipboard!`, 'success');
      setTimeout(() => setCopiedTtb(false), 2000);
    } catch {
      showToast?.('Gagal menyalin nomor TTB.', 'warning');
    }
  };

  const handleOpenPortal = async () => {
    if (shortCode) {
      try {
        await navigator.clipboard.writeText(shortCode);
      } catch {
        // continue
      }
    }
    window.open(portalUrl, '_blank', 'noopener,noreferrer');
    showToast?.(`Membuka portal TimeMark dengan kode pencarian "${shortCode}"...`, 'info');
  };

  const handleSaveConfig = () => {
    let target = customInputUrl.trim();
    if (!target) {
      target = DEFAULT_TIMEMARK_PORTAL_URL;
    } else if (!/^https?:\/\//i.test(target)) {
      target = `https://${target}`;
    }
    setTimemarkPortalUrl(target);
    setPortalUrlState(target);
    setIsConfigOpen(false);
    showToast?.('URL Portal TimeMark berhasil diperbarui!', 'success');
  };

  const handleResetConfig = () => {
    setTimemarkPortalUrl(DEFAULT_TIMEMARK_PORTAL_URL);
    setPortalUrlState(DEFAULT_TIMEMARK_PORTAL_URL);
    setCustomInputUrl(DEFAULT_TIMEMARK_PORTAL_URL);
    setIsConfigOpen(false);
    showToast?.('URL Portal TimeMark dikembalikan ke default.', 'info');
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 md:p-6 animate-in fade-in duration-200 printable-modal-overlay"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-card border border-border rounded-2xl w-full max-w-6xl max-h-[92vh] flex flex-col shadow-2xl text-card-foreground overflow-hidden printable-modal-content"
      >
        {/* Header Modal */}
        <div className="p-4 sm:p-5 border-b border-border bg-muted/40 shrink-0">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="size-10 rounded-xl bg-gradient-to-br from-cyan-500/20 to-purple-500/20 border border-cyan-500/30 flex items-center justify-center text-cyan-600 dark:text-cyan-400 shrink-0 shadow-xs">
                <FileCheck className="size-5" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-base font-bold text-foreground truncate">
                    Verifikasi Dokumen & Galeri Foto TTB
                  </h3>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-700 dark:text-cyan-300 border border-cyan-500/30 font-bold">
                    Cloudflare R2 Storage
                  </span>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap mt-0.5">
                  <span>FPB: <strong className="font-mono text-foreground">{fpb || '-'}</strong></span>
                  {po && po !== '-' && (
                    <>
                      <span>•</span>
                      <span>PO: <strong className="font-mono text-foreground">{po}</strong></span>
                    </>
                  )}
                  {armada && (
                    <>
                      <span>•</span>
                      <span className="truncate flex items-center gap-1 text-foreground font-medium">
                        <Ship className="size-3 text-cyan-500 shrink-0" />
                        <span>{armada}</span>
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>

            <button
              onClick={onClose}
              className="size-8 rounded-lg border border-border bg-background hover:bg-muted text-muted-foreground hover:text-foreground flex items-center justify-center transition shrink-0 cursor-pointer"
              title="Tutup Modal (Esc)"
            >
              <X className="size-4" />
            </button>
          </div>

          {/* Baris Multi-TTB Selector (jika ada lebih dari 1 TTB) */}
          {parsedTtbs.length > 1 && (
            <div className="mt-3 pt-3 border-t border-border/60 flex items-center gap-2 overflow-x-auto pb-1 text-xs">
              <span className="text-muted-foreground shrink-0 font-medium text-[11px]">Pilih Nomor TTB:</span>
              <div className="flex items-center gap-1.5 flex-wrap">
                {parsedTtbs.map((tNum, idx) => (
                  <button
                    key={tNum}
                    type="button"
                    onClick={() => setActiveTtbIndex(idx)}
                    className={`h-7 px-2.5 rounded-lg text-xs font-mono font-semibold transition active:scale-95 cursor-pointer border ${
                      idx === activeTtbIndex
                        ? 'bg-cyan-500 text-slate-950 border-cyan-400 shadow-xs'
                        : 'bg-background hover:bg-muted text-foreground border-border'
                    }`}
                  >
                    {tNum}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Tab Navigation */}
          <div className="mt-3 flex items-center justify-between gap-2 overflow-x-auto pb-0.5 pt-1">
            <div className="flex items-center gap-1.5 bg-muted/80 p-1 rounded-xl border border-border text-xs shrink-0">
              <button
                type="button"
                onClick={() => setActiveTab('split')}
                className={`h-7 px-3 rounded-lg font-medium transition cursor-pointer flex items-center gap-1.5 ${
                  activeTab === 'split'
                    ? 'bg-background text-foreground shadow-xs font-semibold'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <LayoutGrid className="size-3.5" />
                <span>Semua Media (Split)</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('docs')}
                className={`h-7 px-3 rounded-lg font-medium transition cursor-pointer flex items-center gap-1.5 ${
                  activeTab === 'docs'
                    ? 'bg-background text-foreground shadow-xs font-semibold'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <FileText className="size-3.5 text-cyan-500" />
                <span>Dokumen Scan (PDF)</span>
                {documents.length > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-cyan-500/20 text-cyan-700 dark:text-cyan-300 font-bold">
                    {documents.length}
                  </span>
                )}
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('photos')}
                className={`h-7 px-3 rounded-lg font-medium transition cursor-pointer flex items-center gap-1.5 ${
                  activeTab === 'photos'
                    ? 'bg-background text-foreground shadow-xs font-semibold'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Camera className="size-3.5 text-purple-500" />
                <span>Galeri Foto Fisik</span>
                {photos.length > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-purple-500/20 text-purple-700 dark:text-purple-300 font-bold">
                    {photos.length}
                  </span>
                )}
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('info')}
                className={`h-7 px-3 rounded-lg font-medium transition cursor-pointer flex items-center gap-1.5 ${
                  activeTab === 'info'
                    ? 'bg-background text-foreground shadow-xs font-semibold'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Info className="size-3.5 text-amber-500" />
                <span>TimeMark & Alur 5 Divisi</span>
              </button>
            </div>

            {/* Quick Active TTB Badge with Copy */}
            {activeTtb && (
              <div className="flex items-center gap-1 shrink-0 ml-auto">
                <span className="text-[11px] font-mono font-bold text-foreground bg-background px-2.5 py-1 rounded-lg border border-border shadow-xs">
                  {activeTtb}
                </span>
                <button
                  type="button"
                  onClick={handleCopyTtb}
                  className="size-7 rounded-lg border border-border bg-background hover:bg-muted text-muted-foreground hover:text-foreground flex items-center justify-center transition active:scale-95 cursor-pointer"
                  title="Salin Nomor TTB"
                >
                  {copiedTtb ? (
                    <Check className="size-3.5 text-emerald-500" />
                  ) : (
                    <Copy className="size-3.5" />
                  )}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
          {/* TAB 1: SPLIT VIEW (DOKUMEN SCAN KIRI + FOTO FISIK KANAN) */}
          {activeTab === 'split' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Kolom Kiri: Dokumen Scan TTB Resmi */}
              <div className="rounded-xl border border-cyan-500/30 bg-cyan-500/5 p-4 flex flex-col gap-3 min-h-[460px]">
                <div className="flex items-center justify-between gap-2 border-b border-cyan-500/20 pb-2.5">
                  <div className="flex items-center gap-2">
                    <div className="size-7 rounded-lg bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center text-cyan-600 dark:text-cyan-400 shrink-0">
                      <FileText className="size-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-foreground">Dokumen Scan Resmi TTB</h4>
                      <p className="text-[10px] text-muted-foreground">
                        Berkas bertandatangan & cap (Cloudflare R2)
                      </p>
                    </div>
                  </div>
                  {documents.length > 0 && (
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-500/15 text-cyan-700 dark:text-cyan-300 border border-cyan-500/30 font-semibold">
                      {documents.length} berkas
                    </span>
                  )}
                </div>

                {/* State Loading / Empty / Content Dokumen */}
                {docsLoading ? (
                  <div className="flex-1 flex flex-col items-center justify-center gap-2 text-muted-foreground text-xs min-h-[300px]">
                    <Loader2 className="size-7 animate-spin text-cyan-500" />
                    <span>Mencari dokumen TTB di Cloudflare R2...</span>
                  </div>
                ) : documents.length === 0 ? (
                  <div className="flex-1 flex flex-col items-center justify-center gap-2.5 text-muted-foreground text-xs text-center px-4 py-8 min-h-[300px]">
                    <div className="size-12 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-500/60">
                      <FileText className="size-6" />
                    </div>
                    <div className="space-y-1 max-w-sm">
                      <p className="font-semibold text-foreground">
                        Belum ada berkas scan resmi untuk TTB ini
                      </p>
                      <p className="text-[11px] text-muted-foreground leading-relaxed">
                        Dokumen scan tanda tangan basah / PDF resmi dari gudang logistik belum diunggah ke Cloudflare R2 storage.
                      </p>
                    </div>
                    {onNavigateToUpload && (
                      <button
                        type="button"
                        onClick={() => {
                          onClose();
                          onNavigateToUpload(activeTtb);
                        }}
                        className="mt-2 h-7 px-3 rounded-lg bg-cyan-500 hover:bg-cyan-600 text-slate-950 font-semibold text-[11px] inline-flex items-center gap-1.5 transition active:scale-95 cursor-pointer"
                      >
                        <FileCheck className="size-3.5" />
                        <span>Unggah Dokumen TTB</span>
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="flex-1 flex flex-col gap-3">
                    {/* Header info berkas yang dipilih */}
                    <div className="flex items-center justify-between gap-2 p-2.5 rounded-lg bg-background border border-border text-xs">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-semibold text-foreground truncate" title={selectedDoc?.renamedFileName}>
                            {selectedDoc?.renamedFileName}
                          </p>
                          {selectedDoc?.isRecipientStamped && (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 shrink-0">
                              <Check className="size-2.5" />
                              <span>TTD Armada: {selectedDoc.recipientName}</span>
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-muted-foreground flex items-center gap-1.5 flex-wrap mt-0.5">
                          <span>Ukuran: {formatFileSize(selectedDoc?.fileSize || 0)}</span>
                          <span>&bull;</span>
                          <span>Tgl: {selectedDoc?.receivedDate || '-'}</span>
                          {selectedDoc?.uploaderName && (
                            <>
                              <span>&bull;</span>
                              <span className="text-foreground/80 font-medium">
                                Uploader: {selectedDoc.uploaderName} {selectedDoc.uploaderNik ? `(${selectedDoc.uploaderNik})` : ''}
                              </span>
                            </>
                          )}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <a
                          href={selectedDoc?.fileUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="size-7 rounded-md border border-border bg-muted hover:bg-muted/80 text-foreground flex items-center justify-center transition"
                          title="Buka dokumen di tab baru"
                        >
                          <ExternalLink className="size-3.5" />
                        </a>
                        <a
                          href={selectedDoc?.fileUrl}
                          download={selectedDoc?.renamedFileName}
                          className="h-7 px-2.5 rounded-md bg-cyan-500 hover:bg-cyan-600 text-slate-950 font-semibold text-[11px] flex items-center gap-1 transition"
                          title="Unduh berkas PDF asli"
                        >
                          <Download className="size-3" />
                          <span>Unduh</span>
                        </a>
                      </div>
                    </div>

                    {/* Preview Iframe PDF / Gambar */}
                    <div className="flex-1 min-h-[340px] rounded-lg border border-border overflow-hidden bg-black/5 dark:bg-black/40 flex flex-col items-center justify-center relative">
                      {selectedDoc?.fileType === 'application/pdf' || selectedDoc?.renamedFileName?.toLowerCase().endsWith('.pdf') ? (
                        <iframe
                          src={`${selectedDoc.fileUrl}#toolbar=0&navpanes=0`}
                          className="w-full h-full min-h-[340px] border-none"
                          title={selectedDoc.renamedFileName}
                        />
                      ) : (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={selectedDoc?.fileUrl}
                          alt={selectedDoc?.renamedFileName}
                          className="w-full h-[340px] object-contain"
                        />
                      )}
                    </div>

                    {/* Thumbnail Selector Dokumen jika lebih dari 1 */}
                    {documents.length > 1 && (
                      <div className="flex gap-2 overflow-x-auto pb-1 pt-0.5">
                        {documents.map((doc, idx) => (
                          <button
                            key={doc.id || doc.renamedFileName}
                            type="button"
                            onClick={() => setSelectedDocIdx(idx)}
                            className={`shrink-0 px-2.5 py-1.5 rounded-lg border text-left transition text-xs font-mono max-w-[180px] truncate ${
                              idx === selectedDocIdx
                                ? 'bg-cyan-500/15 border-cyan-500 text-cyan-700 dark:text-cyan-300 font-bold'
                                : 'bg-background hover:bg-muted border-border text-muted-foreground'
                            }`}
                          >
                            <span className="block truncate">{doc.renamedFileName}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Kolom Kanan: Galeri Foto Fisik Lapangan */}
              <div className="rounded-xl border border-purple-500/30 bg-purple-500/5 p-4 flex flex-col gap-3 min-h-[460px]">
                <div className="flex items-center justify-between gap-2 border-b border-purple-500/20 pb-2.5">
                  <div className="flex items-center gap-2">
                    <div className="size-7 rounded-lg bg-purple-500/15 border border-purple-500/30 flex items-center justify-center text-purple-600 dark:text-purple-400 shrink-0">
                      <Camera className="size-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-foreground">Galeri Foto Fisik Serah Terima</h4>
                      <p className="text-[10px] text-muted-foreground">
                        Dokumentasi barang riil di lapangan (Cloudflare R2)
                      </p>
                    </div>
                  </div>
                  {photos.length > 0 && (
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-purple-500/15 text-purple-700 dark:text-purple-300 border border-purple-500/30 font-semibold">
                      {photos.length} foto
                    </span>
                  )}
                </div>

                {/* State Loading / Empty / Content Foto */}
                {photosLoading ? (
                  <div className="flex-1 flex flex-col items-center justify-center gap-2 text-muted-foreground text-xs min-h-[300px]">
                    <Loader2 className="size-7 animate-spin text-purple-500" />
                    <span>Mencari foto serah terima di Cloudflare R2...</span>
                  </div>
                ) : photos.length === 0 ? (
                  <div className="flex-1 flex flex-col items-center justify-center gap-2.5 text-muted-foreground text-xs text-center px-4 py-8 min-h-[300px]">
                    <div className="size-12 rounded-2xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-500/60">
                      <ImageOff className="size-6" />
                    </div>
                    <div className="space-y-1 max-w-sm">
                      <p className="font-semibold text-foreground">
                        Belum ada foto serah terima fisik untuk TTB ini
                      </p>
                      <p className="text-[11px] text-muted-foreground leading-relaxed">
                        Foto barang belum terindeks di Cloudflare R2 atau nomor TTB belum diinput oleh staf logistik.
                      </p>
                    </div>
                    {/* TimeMark Shortcut jika foto ada di portal TimeMark */}
                    {shortCode && (
                      <button
                        type="button"
                        onClick={handleOpenPortal}
                        className="mt-2 h-7 px-3 rounded-lg bg-amber-500 hover:bg-amber-600 text-slate-950 font-semibold text-[11px] inline-flex items-center gap-1.5 transition active:scale-95 cursor-pointer shadow-xs"
                      >
                        <Camera className="size-3.5" />
                        <span>Cek di TimeMark ({shortCode})</span>
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="flex-1 flex flex-col gap-3">
                    {/* Foto Utama */}
                    <div className="relative rounded-lg overflow-hidden border border-border bg-black/90 group flex items-center justify-center h-[340px]">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={selectedPhoto?.url}
                        alt={selectedPhoto?.name}
                        className="w-full h-full object-contain cursor-zoom-in"
                        onClick={() => setIsFullscreenPhoto(true)}
                      />
                      <button
                        type="button"
                        onClick={() => setIsFullscreenPhoto(true)}
                        className="absolute top-2.5 right-2.5 size-8 rounded-lg bg-black/70 hover:bg-black/90 text-white flex items-center justify-center opacity-80 group-hover:opacity-100 transition cursor-pointer"
                        title="Perbesar Ukuran Penuh"
                      >
                        <Maximize2 className="size-4" />
                      </button>
                    </div>

                    {/* Metadata Foto & Aksi */}
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <div className="min-w-0 text-[11px] text-muted-foreground">
                        <p className="font-mono text-foreground truncate" title={selectedPhoto?.name}>
                          {selectedPhoto?.name}
                        </p>
                        {selectedPhoto?.takenAt && <p>Waktu Pemotretan: {selectedPhoto.takenAt}</p>}
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <a
                          href={selectedPhoto?.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="size-7 rounded-md border border-border bg-background hover:bg-muted text-foreground flex items-center justify-center transition"
                          title="Buka di tab baru"
                        >
                          <ExternalLink className="size-3.5" />
                        </a>
                        <a
                          href={selectedPhoto?.url}
                          download={selectedPhoto?.name}
                          className="h-7 px-2.5 rounded-md bg-purple-500 hover:bg-purple-600 text-white font-semibold text-[11px] flex items-center gap-1 transition shadow-xs"
                          title="Unduh foto"
                        >
                          <Download className="size-3" />
                          <span>Unduh</span>
                        </a>
                      </div>
                    </div>

                    {/* Thumbnail Foto jika lebih dari 1 */}
                    {photos.length > 1 && (
                      <div className="flex gap-2 overflow-x-auto pb-1 pt-0.5">
                        {photos.map((p, idx) => (
                          <button
                            key={p.name}
                            type="button"
                            onClick={() => setSelectedPhotoIdx(idx)}
                            className={`shrink-0 size-16 rounded-md overflow-hidden border-2 transition cursor-pointer ${
                              idx === selectedPhotoIdx
                                ? 'border-purple-500 ring-2 ring-purple-500/20'
                                : 'border-transparent opacity-70 hover:opacity-100'
                            }`}
                            title={p.takenAt || p.name}
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={p.url} alt={p.name} loading="lazy" className="size-full object-cover" />
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: FOKUS DOKUMEN SCAN (PDF PENUH) */}
          {activeTab === 'docs' && (
            <div className="rounded-xl border border-cyan-500/30 bg-card p-4 sm:p-5 space-y-4">
              <div className="flex items-center justify-between gap-3 flex-wrap border-b border-border pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="size-9 rounded-xl bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center text-cyan-600 dark:text-cyan-400">
                    <FileText className="size-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-foreground">Dokumen Scan TTB Resmi (PDF)</h4>
                    <p className="text-xs text-muted-foreground font-mono">
                      Nomor: <strong className="text-foreground">{activeTtb || '-'}</strong>
                    </p>
                  </div>
                </div>

                {selectedDoc && (
                  <div className="flex items-center gap-2">
                    <a
                      href={selectedDoc.fileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="h-8 px-3 rounded-lg border border-border bg-background hover:bg-muted text-foreground text-xs font-medium inline-flex items-center gap-1.5 transition"
                    >
                      <ExternalLink className="size-3.5" />
                      <span>Buka di Tab Baru</span>
                    </a>
                    <a
                      href={selectedDoc.fileUrl}
                      download={selectedDoc.renamedFileName}
                      className="h-8 px-3.5 rounded-lg bg-cyan-500 hover:bg-cyan-600 text-slate-950 text-xs font-bold inline-flex items-center gap-1.5 transition shadow-xs"
                    >
                      <Download className="size-3.5" />
                      <span>Unduh PDF Asli</span>
                    </a>
                  </div>
                )}
              </div>

              {docsLoading ? (
                <div className="flex flex-col items-center justify-center gap-3 py-16 text-muted-foreground">
                  <Loader2 className="size-8 animate-spin text-cyan-500" />
                  <span className="text-sm">Memuat dokumen dari Cloudflare R2...</span>
                </div>
              ) : documents.length === 0 ? (
                <div className="py-16 text-center space-y-3">
                  <FileText className="size-12 mx-auto text-muted-foreground/40" />
                  <p className="text-sm font-semibold text-foreground">
                    Belum ada berkas scan resmi untuk TTB &quot;{activeTtb}&quot;
                  </p>
                  <p className="text-xs text-muted-foreground max-w-md mx-auto">
                    Dokumen PDF bertandatangan basah belum diunggah ke storage Cloudflare R2.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="w-full h-[550px] rounded-xl border border-border overflow-hidden bg-black/5 dark:bg-black/30">
                    {selectedDoc?.fileType === 'application/pdf' || selectedDoc?.renamedFileName?.toLowerCase().endsWith('.pdf') ? (
                      <iframe
                        src={`${selectedDoc.fileUrl}#toolbar=1`}
                        className="w-full h-full border-none"
                        title={selectedDoc.renamedFileName}
                      />
                    ) : (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={selectedDoc?.fileUrl}
                        alt={selectedDoc?.renamedFileName}
                        className="w-full h-full object-contain"
                      />
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: FOKUS GALERI FOTO FISIK (R2) */}
          {activeTab === 'photos' && (
            <div className="rounded-xl border border-purple-500/30 bg-card p-4 sm:p-5 space-y-4">
              <div className="flex items-center justify-between gap-3 flex-wrap border-b border-border pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="size-9 rounded-xl bg-purple-500/15 border border-purple-500/30 flex items-center justify-center text-purple-600 dark:text-purple-400">
                    <Camera className="size-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-foreground">Galeri Foto Serah Terima Fisik (R2)</h4>
                    <p className="text-xs text-muted-foreground font-mono">
                      Nomor: <strong className="text-foreground">{activeTtb || '-'}</strong> • Total: {photos.length} foto
                    </p>
                  </div>
                </div>

                {selectedPhoto && (
                  <div className="flex items-center gap-2">
                    <a
                      href={selectedPhoto.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="h-8 px-3 rounded-lg border border-border bg-background hover:bg-muted text-foreground text-xs font-medium inline-flex items-center gap-1.5 transition"
                    >
                      <ExternalLink className="size-3.5" />
                      <span>Buka Ukuran Asli</span>
                    </a>
                    <a
                      href={selectedPhoto.url}
                      download={selectedPhoto.name}
                      className="h-8 px-3.5 rounded-lg bg-purple-500 hover:bg-purple-600 text-white text-xs font-bold inline-flex items-center gap-1.5 transition shadow-xs"
                    >
                      <Download className="size-3.5" />
                      <span>Unduh Foto</span>
                    </a>
                  </div>
                )}
              </div>

              {photosLoading ? (
                <div className="flex flex-col items-center justify-center gap-3 py-16 text-muted-foreground">
                  <Loader2 className="size-8 animate-spin text-purple-500" />
                  <span className="text-sm">Memuat galeri foto dari Cloudflare R2...</span>
                </div>
              ) : photos.length === 0 ? (
                <div className="py-16 text-center space-y-3">
                  <ImageOff className="size-12 mx-auto text-muted-foreground/40" />
                  <p className="text-sm font-semibold text-foreground">
                    Belum ada foto serah terima fisik di server untuk TTB &quot;{activeTtb}&quot;
                  </p>
                  {shortCode && (
                    <button
                      type="button"
                      onClick={handleOpenPortal}
                      className="h-8 px-4 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-semibold text-xs inline-flex items-center gap-1.5 transition"
                    >
                      <Camera className="size-3.5" />
                      <span>Cek Foto di Portal TimeMark ({shortCode})</span>
                    </button>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Foto Utama Besar */}
                  <div className="w-full h-[520px] rounded-xl border border-border overflow-hidden bg-black/90 flex items-center justify-center relative group">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={selectedPhoto?.url}
                      alt={selectedPhoto?.name}
                      className="w-full h-full object-contain cursor-zoom-in"
                      onClick={() => setIsFullscreenPhoto(true)}
                    />
                    <button
                      type="button"
                      onClick={() => setIsFullscreenPhoto(true)}
                      className="absolute top-3 right-3 size-9 rounded-lg bg-black/70 hover:bg-black/90 text-white flex items-center justify-center transition cursor-pointer"
                      title="Perbesar Layar Penuh"
                    >
                      <Maximize2 className="size-4" />
                    </button>
                  </div>

                  {/* Strip Thumbnail Foto */}
                  {photos.length > 1 && (
                    <div className="flex gap-2.5 overflow-x-auto pb-2">
                      {photos.map((p, idx) => (
                        <button
                          key={p.name}
                          type="button"
                          onClick={() => setSelectedPhotoIdx(idx)}
                          className={`shrink-0 size-20 rounded-lg overflow-hidden border-2 transition cursor-pointer ${
                            idx === selectedPhotoIdx
                              ? 'border-purple-500 ring-2 ring-purple-500/30'
                              : 'border-transparent opacity-70 hover:opacity-100'
                          }`}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={p.url} alt={p.name} loading="lazy" className="size-full object-cover" />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* TAB 4: TIMEMARK & ALUR 5 DIVISI */}
          {activeTab === 'info' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Box 1: TimeMark 5 Digit Kode */}
              <div className="p-4 sm:p-5 rounded-xl border border-amber-500/30 bg-amber-500/5 space-y-3.5">
                <div className="flex items-center gap-2">
                  <div className="size-8 rounded-lg bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-600 dark:text-amber-400">
                    <Camera className="size-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-foreground">TimeMark Teamspace Integration</h4>
                    <p className="text-[10px] text-muted-foreground">Pencarian watermark 5 digit belakang</p>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-center space-y-2">
                  <span className="text-[11px] font-medium text-amber-800 dark:text-amber-300 block">
                    Kode Pencarian Foto di Portal TimeMark:
                  </span>
                  <div className="flex items-center justify-center gap-2">
                    <span className="text-2xl sm:text-3xl font-black font-mono tracking-widest text-amber-600 dark:text-amber-400 bg-background/90 px-4 py-1.5 rounded-lg border border-amber-500/30 shadow-inner">
                      {shortCode || '-'}
                    </span>
                    <button
                      type="button"
                      onClick={handleCopyCode}
                      disabled={!shortCode}
                      className="h-10 px-3 rounded-lg bg-background hover:bg-muted border border-border text-foreground text-xs font-semibold inline-flex items-center gap-1.5 transition active:scale-95 shadow-xs cursor-pointer"
                    >
                      {copiedCode ? (
                        <>
                          <Check className="size-4 text-emerald-500" />
                          <span className="text-emerald-500">Tersalin</span>
                        </>
                      ) : (
                        <>
                          <Copy className="size-4 text-muted-foreground" />
                          <span>Salin</span>
                        </>
                      )}
                    </button>
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-relaxed pt-1">
                    Cukup tekan tombol di bawah lalu <strong>Paste (Ctrl+V)</strong> di bilah pencarian portal TimeMark.
                  </p>
                </div>

                <div className="flex items-center justify-between gap-2 pt-1">
                  <button
                    type="button"
                    onClick={handleOpenPortal}
                    className="h-9 px-4 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-semibold text-xs shadow-md inline-flex items-center gap-1.5 transition active:scale-95 cursor-pointer"
                  >
                    <Camera className="size-4" />
                    <span>Buka Portal TimeMark</span>
                    <ExternalLink className="size-3.5 opacity-80" />
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsConfigOpen(!isConfigOpen)}
                    className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1 cursor-pointer"
                  >
                    <Settings className="size-3.5" />
                    <span>{isConfigOpen ? 'Tutup URL' : 'Ganti URL'}</span>
                  </button>
                </div>

                {isConfigOpen && (
                  <div className="p-3 rounded-lg bg-background border border-border space-y-2 text-xs">
                    <label className="text-[11px] text-muted-foreground block">
                      URL Portal TimeMark:
                    </label>
                    <input
                      type="text"
                      value={customInputUrl}
                      onChange={(e) => setCustomInputUrl(e.target.value)}
                      placeholder="https://teamspace.timemark.com"
                      className="w-full h-8 px-2.5 rounded-lg border border-border bg-background text-xs font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                    <div className="flex items-center justify-end gap-2 pt-1">
                      <button
                        type="button"
                        onClick={handleResetConfig}
                        className="h-7 px-2 text-[11px] text-muted-foreground hover:text-foreground inline-flex items-center gap-1 cursor-pointer"
                      >
                        <RotateCcw className="size-3" />
                        <span>Reset</span>
                      </button>
                      <button
                        type="button"
                        onClick={handleSaveConfig}
                        className="h-7 px-3 rounded-lg bg-primary text-primary-foreground font-medium text-[11px] hover:bg-primary/90 transition cursor-pointer"
                      >
                        Simpan Link
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Box 2: Rincian Metadata & Alur 5 Divisi */}
              <div className="p-4 sm:p-5 rounded-xl border border-border bg-muted/30 space-y-3 text-xs">
                <div className="flex items-center gap-2 border-b border-border pb-2.5">
                  <div className="size-8 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-500">
                    <Layers className="size-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-foreground">Rincian Metadata & Alur Rantai Fisik</h4>
                    <p className="text-[10px] text-muted-foreground">Posisi pertanggungjawaban berkas</p>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between items-center py-1 border-b border-border/50">
                    <span className="text-muted-foreground">Nomor FPB:</span>
                    <span className="font-mono font-semibold text-foreground">{fpb || '-'}</span>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b border-border/50">
                    <span className="text-muted-foreground">Nomor PO:</span>
                    <span className="font-mono text-foreground">{po || '-'}</span>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b border-border/50">
                    <span className="text-muted-foreground">Nomor FSTB:</span>
                    <span className="font-mono text-foreground">{noFstb || '-'}</span>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b border-border/50">
                    <span className="text-muted-foreground">Nomor TTB:</span>
                    <span className="font-mono font-bold text-cyan-600 dark:text-cyan-400">{activeTtb || '-'}</span>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b border-border/50">
                    <span className="text-muted-foreground">Armada / Unit:</span>
                    <span className="font-semibold text-foreground">{armada || '-'}</span>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b border-border/50">
                    <span className="text-muted-foreground">Nama Barang:</span>
                    <span className="font-medium text-foreground max-w-[220px] truncate text-right" title={item}>
                      {item || '-'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-1">
                    <span className="text-muted-foreground">Status Berkas:</span>
                    <span className="px-2 py-0.5 rounded-full font-bold text-[10px] bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/30">
                      {statusBadge || 'TERDATA'}
                    </span>
                  </div>
                </div>

                {/* PIC Rantai Alur */}
                <div className="pt-2 border-t border-border/60">
                  <span className="text-[11px] font-semibold text-muted-foreground block mb-1.5">
                    Petugas Penanggung Jawab (PIC):
                  </span>
                  <div className="grid grid-cols-2 gap-2 text-[11px]">
                    <div className="p-2 rounded-lg bg-background border border-border">
                      <span className="text-muted-foreground block text-[10px]">Purchasing:</span>
                      <strong className="text-foreground truncate block">{picPch || '-'}</strong>
                    </div>
                    <div className="p-2 rounded-lg bg-background border border-border">
                      <span className="text-muted-foreground block text-[10px]">Logistik TTB:</span>
                      <strong className="text-foreground truncate block">{picTtb || '-'}</strong>
                    </div>
                    <div className="p-2 rounded-lg bg-background border border-border">
                      <span className="text-muted-foreground block text-[10px]">Tim Lapangan:</span>
                      <strong className="text-foreground truncate block">{picLap || '-'}</strong>
                    </div>
                    <div className="p-2 rounded-lg bg-background border border-border">
                      <span className="text-muted-foreground block text-[10px]">Administrasi:</span>
                      <strong className="text-foreground truncate block">{picAdm || '-'}</strong>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Modal */}
        <div className="p-3.5 sm:p-4 border-t border-border bg-muted/40 shrink-0 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="size-2 rounded-full bg-emerald-500"></span>
            <span>Terhubung ke Cloudflare R2 Storage (Bucket cpg-storage)</span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => {
                if (typeof window !== 'undefined') window.print();
              }}
              className="h-8 px-3 rounded-lg border border-border bg-background hover:bg-muted text-foreground text-xs font-semibold inline-flex items-center gap-1.5 transition active:scale-95 cursor-pointer print:hidden"
            >
              <Printer className="size-3.5 text-primary" />
              <span>Print Bukti</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="h-8 px-4 rounded-lg bg-foreground text-background text-xs font-bold tracking-wide transition active:scale-95 cursor-pointer print:hidden"
            >
              TUTUP
            </button>
          </div>
        </div>
      </div>

      {/* Lightbox Fullscreen Photo Overlay */}
      {isFullscreenPhoto && selectedPhoto && (
        <div
          onClick={() => setIsFullscreenPhoto(false)}
          className="fixed inset-0 z-60 bg-black/95 flex items-center justify-center p-4 animate-in fade-in duration-200 cursor-zoom-out"
        >
          <div className="relative max-w-5xl max-h-[90vh] flex flex-col items-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={selectedPhoto.url}
              alt={selectedPhoto.name}
              className="max-h-[85vh] max-w-full object-contain rounded-lg shadow-2xl"
            />
            <div className="mt-3 text-center text-white text-xs space-y-0.5">
              <p className="font-mono font-medium">{selectedPhoto.name}</p>
              {selectedPhoto.takenAt && <p className="text-white/70">Waktu: {selectedPhoto.takenAt}</p>}
            </div>
            <button
              onClick={() => setIsFullscreenPhoto(false)}
              className="absolute top-2 right-2 size-9 rounded-full bg-black/60 hover:bg-black/90 text-white flex items-center justify-center transition cursor-pointer"
            >
              <X className="size-5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

