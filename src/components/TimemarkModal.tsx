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
} from 'lucide-react';
import {
  extractFstbLast5,
  getTimemarkPortalUrl,
  setTimemarkPortalUrl,
  DEFAULT_TIMEMARK_PORTAL_URL,
} from '@/utils/timemark';

interface TimemarkModalProps {
  isOpen: boolean;
  onClose: () => void;
  noFstb: string;
  fpb?: string;
  item?: string;
  armada?: string;
  showToast?: (msg: string, type?: 'info' | 'success' | 'warning' | 'error') => void;
}

export default function TimemarkModal({
  isOpen,
  onClose,
  noFstb,
  fpb,
  item,
  armada,
  showToast,
}: TimemarkModalProps) {
  const [copied, setCopied] = useState<boolean>(false);
  const [isConfigOpen, setIsConfigOpen] = useState<boolean>(false);
  const [portalUrl, setPortalUrlState] = useState<string>(DEFAULT_TIMEMARK_PORTAL_URL);
  const [customInputUrl, setCustomInputUrl] = useState<string>('');

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

  if (!isOpen) return null;

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
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 cursor-pointer animate-in fade-in duration-200"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-card border border-border rounded-2xl w-full max-w-md shadow-2xl p-5 md:p-6 space-y-4 text-card-foreground cursor-default"
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

        {/* Content Box */}
        <div className="space-y-3">
          {/* Metadata Card */}
          <div className="p-3 rounded-xl bg-muted/40 border border-border space-y-1.5 text-xs">
            <div className="flex justify-between items-center text-muted-foreground">
              <span>Nomor FSTB:</span>
              <span className="font-mono font-semibold text-foreground">{noFstb || '-'}</span>
            </div>
            {fpb && (
              <div className="flex justify-between items-center text-muted-foreground">
                <span>Nomor FPB:</span>
                <span className="font-mono text-foreground">{fpb}</span>
              </div>
            )}
            {armada && (
              <div className="flex justify-between items-center text-muted-foreground">
                <span>Armada / Unit:</span>
                <span className="font-medium text-foreground">{armada}</span>
              </div>
            )}
            {item && (
              <div className="flex justify-between items-center text-muted-foreground">
                <span>Barang:</span>
                <span className="font-medium text-foreground truncate max-w-[200px]" title={item}>
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
        <div className="pt-2 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="h-9 px-3.5 rounded-xl border border-border bg-background hover:bg-muted text-foreground text-xs font-medium transition"
          >
            Tutup
          </button>
          <button
            type="button"
            onClick={handleOpenPortal}
            className="h-9 px-4 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-semibold text-xs shadow-md inline-flex items-center gap-1.5 transition active:scale-95"
          >
            <Camera className="w-4 h-4" />
            <span>Buka Portal TimeMark</span>
            <ExternalLink className="w-3.5 h-3.5 opacity-80" />
          </button>
        </div>
      </div>
    </div>
  );
}
