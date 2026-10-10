'use client';

import React, { useState, useEffect } from 'react';
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
} from 'lucide-react';
import {
  extractFstbLast5,
  getTimemarkPortalUrl,
  setTimemarkPortalUrl,
  DEFAULT_TIMEMARK_PORTAL_URL,
} from '@/utils/timemark';

interface ServerPhoto {
  name: string;
  url: string;
  takenAt: string | null;
}

interface TimemarkModalProps {
  isOpen: boolean;
  onClose: () => void;
  noFstb: string;
  noTtb?: string;
  fpb?: string;
  item?: string;
  armada?: string;
  showToast?: (msg: string, type?: 'info' | 'success' | 'warning' | 'error') => void;
}

export default function TimemarkModal({
  isOpen,
  onClose,
  noFstb,
  noTtb,
  fpb,
  item,
  armada,
  showToast,
}: TimemarkModalProps) {
  const [copied, setCopied] = useState<boolean>(false);
  const [isConfigOpen, setIsConfigOpen] = useState<boolean>(false);
  const [portalUrl, setPortalUrlState] = useState<string>(DEFAULT_TIMEMARK_PORTAL_URL);
  const [customInputUrl, setCustomInputUrl] = useState<string>('');

  // Foto dari server (database sementara) berdasarkan No. TTB
  const [serverPhotos, setServerPhotos] = useState<ServerPhoto[]>([]);
  const [photosLoading, setPhotosLoading] = useState<boolean>(false);
  const [photosError, setPhotosError] = useState<string>('');
  const [selectedIdx, setSelectedIdx] = useState<number>(0);

  const shortCode = extractFstbLast5(noFstb);

  useEffect(() => {
    if (isOpen) {
      const current = getTimemarkPortalUrl();
      setPortalUrlState(current);
      setCustomInputUrl(current);
      setCopied(false);
      setIsConfigOpen(false);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || !noTtb) {
      setServerPhotos([]);
      return;
    }
    let cancelled = false;
    setPhotosLoading(true);
    setPhotosError('');
    setSelectedIdx(0);
    fetch(`/api/ttb-photos?ttb=${encodeURIComponent(noTtb)}`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        setServerPhotos(data.photos || []);
        if (data.error) setPhotosError(data.error);
      })
      .catch(() => !cancelled && setPhotosError('Gagal memuat foto dari server.'))
      .finally(() => !cancelled && setPhotosLoading(false));
    return () => {
      cancelled = true;
    };
  }, [isOpen, noTtb]);

  if (!isOpen) return null;

  const selectedPhoto = serverPhotos[selectedIdx];

  const handleCopy = async () => {
    if (!shortCode) return;
    try {
      await navigator.clipboard.writeText(shortCode);
      setCopied(true);
      showToast?.(`Kode "${shortCode}" disalin ke clipboard!`, 'success');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      showToast?.('Gagal menyalin kode ke clipboard.', 'warning');
    }
  };

  const handleOpenPortal = async () => {
    if (shortCode) {
      try {
        await navigator.clipboard.writeText(shortCode);
      } catch {
        // Continue opening portal
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
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 cursor-pointer animate-in fade-in duration-200 printable-modal-overlay"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-card border border-border rounded-2xl w-full max-w-5xl max-h-[92vh] overflow-y-auto shadow-2xl p-5 md:p-6 space-y-4 text-card-foreground cursor-default printable-modal-content"
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-border">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-600 dark:text-amber-400">
              <Camera className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-foreground flex items-center gap-1.5">
                <span>Cek Foto TimeMark</span>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 font-semibold">
                  5 Digit
                </span>
              </h3>
              <p className="text-[11px] text-muted-foreground">
                Verifikasi bukti fisik foto lapangan & watermark
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg border border-border bg-background hover:bg-muted text-muted-foreground hover:text-foreground flex items-center justify-center transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Split View: Kiri = TimeMark, Kanan = Foto Server */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* ===== Kolom Kiri: TimeMark ===== */}
        <div className="space-y-4 flex flex-col">
        {/* Content Box */}
        <div className="space-y-3">
          {/* Metadata Card */}
          <div className="p-3 rounded-xl bg-muted/40 border border-border space-y-1.5 text-xs min-w-0">
            <div className="flex justify-between items-center text-muted-foreground min-w-0 gap-2">
              <span className="shrink-0">Nomor FSTB:</span>
              <span className="font-mono font-semibold text-foreground truncate text-right min-w-0">{noFstb || '-'}</span>
            </div>
            {fpb && (
              <div className="flex justify-between items-center text-muted-foreground min-w-0 gap-2">
                <span className="shrink-0">Nomor FPB:</span>
                <span className="font-mono text-foreground truncate text-right min-w-0">{fpb}</span>
              </div>
            )}
            {armada && (
              <div className="flex justify-between items-center text-muted-foreground min-w-0 gap-2">
                <span className="shrink-0">Armada / Unit:</span>
                <span className="font-medium text-foreground truncate text-right min-w-0" title={armada}>{armada}</span>
              </div>
            )}
            {item && (
              <div className="flex justify-between items-center text-muted-foreground min-w-0 gap-2">
                <span className="shrink-0">Barang:</span>
                <span className="font-medium text-foreground truncate text-right min-w-0" title={item}>
                  {item}
                </span>
              </div>
            )}
          </div>

          {/* 5 Digit Shortcode Box */}
          <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-center space-y-2">
            <span className="text-[11px] font-medium text-amber-800 dark:text-amber-300 block">
              Kode Pencarian Foto di TimeMark (5 Angka Belakang):
            </span>
            <div className="flex items-center justify-center gap-2">
              <span className="text-2xl sm:text-3xl font-black font-mono tracking-widest text-amber-600 dark:text-amber-400 bg-background/80 px-4 py-1.5 rounded-lg border border-amber-500/30 shadow-inner">
                {shortCode || '-'}
              </span>
              <button
                type="button"
                onClick={handleCopy}
                disabled={!shortCode}
                className="h-10 px-3 rounded-lg bg-background hover:bg-muted border border-border text-foreground text-xs font-semibold inline-flex items-center gap-1.5 transition active:scale-95 shadow-xs"
                title="Salin kode ke clipboard"
              >
                {copied ? (
                  <>
                    <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    <span className="text-emerald-600 dark:text-emerald-400">Tersalin</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4 text-muted-foreground" />
                    <span>Salin</span>
                  </>
                )}
              </button>
            </div>
            <p className="text-[11px] text-muted-foreground leading-relaxed pt-1">
              Kode di atas otomatis disalin ke clipboard saat Anda menekan tombol di bawah. Cukup <strong>Paste (Ctrl+V)</strong> di bilah pencarian portal TimeMark.
            </p>
          </div>

          {/* Configuration Collapsible */}
          <div className="border border-border/80 rounded-xl p-3 bg-card text-xs space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground text-[11px] flex items-center gap-1.5 font-medium">
                <Info className="w-3.5 h-3.5 text-muted-foreground" />
                <span>Portal TimeMark:</span>
              </span>
              <button
                type="button"
                onClick={() => setIsConfigOpen(!isConfigOpen)}
                className="text-primary hover:underline text-[11px] font-medium inline-flex items-center gap-1"
              >
                <Settings className="w-3 h-3" />
                <span>{isConfigOpen ? 'Tutup Pengaturan' : 'Ganti Link Portal'}</span>
              </button>
            </div>
            <div className="font-mono text-[11px] text-muted-foreground truncate bg-muted/60 px-2 py-1 rounded border border-border/60">
              {portalUrl}
            </div>

            {isConfigOpen && (
              <div className="pt-2 border-t border-border space-y-2 animate-in fade-in duration-150">
                <label className="text-[11px] text-muted-foreground block">
                  Masukkan URL Portal / Teamspace TimeMark tim Anda:
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
                    className="h-7 px-2 rounded text-[11px] text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>Reset Default</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveConfig}
                    className="h-7 px-3 rounded-lg bg-primary text-primary-foreground font-medium text-[11px] hover:bg-primary/90 transition"
                  >
                    Simpan Link
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="mt-auto pt-2 flex items-center justify-end gap-2 flex-wrap">
          <button
            type="button"
            onClick={handleOpenPortal}
            className="h-9 px-4 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-semibold text-xs shadow-md inline-flex items-center gap-1.5 transition active:scale-95 mr-auto"
          >
            <Camera className="w-4 h-4" />
            <span>Buka Portal TimeMark</span>
            <ExternalLink className="w-3.5 h-3.5 opacity-80" />
          </button>
          <button
            type="button"
            onClick={() => {
              if (typeof window !== 'undefined') window.print();
            }}
            className="h-9 px-3.5 rounded-xl border border-border bg-background hover:bg-muted text-foreground text-xs font-semibold inline-flex items-center gap-1.5 transition active:scale-95 shadow-xs cursor-pointer print:hidden"
            title="Cetak atau simpan modul ini ke format PDF"
          >
            <Printer className="size-3.5 text-primary" />
            <span>Print PDF</span>
          </button>
          <button
            type="button"
            onClick={onClose}
            className="h-9 px-4 rounded-xl bg-foreground text-background text-xs font-bold tracking-wide transition active:scale-95 cursor-pointer print:hidden"
          >
            TUTUP
          </button>
        </div>
        </div>

        {/* ===== Kolom Kanan: Foto dari Server (Database Sementara) ===== */}
        <div className="rounded-xl border border-purple-500/30 bg-purple-500/5 p-3 flex flex-col gap-3 min-h-[360px]">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-7 h-7 rounded-lg bg-purple-500/15 border border-purple-500/30 flex items-center justify-center text-purple-600 dark:text-purple-400 shrink-0">
                <Server className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <h4 className="text-xs font-bold text-foreground">Foto Server (Database Sementara)</h4>
                <p className="text-[10px] text-muted-foreground font-mono truncate">
                  No. TTB: <span className="text-purple-600 dark:text-purple-400 font-semibold">{noTtb || '-'}</span>
                </p>
              </div>
            </div>
            {serverPhotos.length > 0 && (
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-700 dark:text-purple-300 border border-purple-500/20 font-semibold shrink-0">
                {serverPhotos.length} foto
              </span>
            )}
          </div>

          {photosLoading ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-2 text-muted-foreground text-xs">
              <Loader2 className="w-6 h-6 animate-spin" />
              <span>Mencari foto di server...</span>
            </div>
          ) : !noTtb || serverPhotos.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-2 text-muted-foreground text-xs text-center px-4">
              <ImageOff className="w-8 h-8 opacity-60" />
              <span className="font-medium">
                {!noTtb ? 'Nomor TTB belum tersedia.' : 'Belum ada foto untuk TTB ini di server.'}
              </span>
              {photosError && <span className="text-[10px] text-red-500">{photosError}</span>}
            </div>
          ) : (
            <>
              {/* Foto utama */}
              <a
                href={selectedPhoto?.url}
                target="_blank"
                rel="noopener noreferrer"
                className="group relative block rounded-lg overflow-hidden border border-border bg-black/80"
                title="Buka ukuran penuh"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={selectedPhoto?.url}
                  alt={selectedPhoto?.name}
                  className="w-full h-[320px] object-contain"
                />
                <span className="absolute top-2 right-2 w-7 h-7 rounded-md bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition">
                  <Maximize2 className="w-3.5 h-3.5" />
                </span>
              </a>
              <div className="text-[10px] text-muted-foreground space-y-0.5">
                <p className="font-mono truncate text-foreground" title={selectedPhoto?.name}>
                  {selectedPhoto?.name}
                </p>
                {selectedPhoto?.takenAt && <p>Diambil: {selectedPhoto.takenAt}</p>}
              </div>

              {/* Thumbnail */}
              {serverPhotos.length > 1 && (
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {serverPhotos.map((p, idx) => (
                    <button
                      key={p.name}
                      type="button"
                      onClick={() => setSelectedIdx(idx)}
                      className={`shrink-0 w-16 h-16 rounded-md overflow-hidden border-2 transition ${
                        idx === selectedIdx ? 'border-purple-500' : 'border-transparent opacity-70 hover:opacity-100'
                      }`}
                      title={p.takenAt || p.name}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={p.url} alt={p.name} loading="lazy" className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
        </div>
      </div>
    </div>
  );
}

