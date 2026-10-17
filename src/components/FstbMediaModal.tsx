'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  FileSpreadsheet,
  FileText,
  ExternalLink,
  Download,
  Copy,
  Check,
  CheckCircle2,
  Clock,
  AlertCircle,
  RefreshCw,
  Boxes,
  ShieldCheck,
  UserCheck,
  Maximize2,
  Minimize2,
  Calendar,
  Ship,
  FileCode,
  PenTool,
} from 'lucide-react';
import { UploadedFstbItem } from '@/types/fstbUpload';
import { extractFstbLast5 } from '@/utils/timemark';

export interface FstbMediaModalProps {
  isOpen: boolean;
  onClose: () => void;
  noFstb?: string;
  noPo?: string;
  noFpb?: string;
  armada?: string;
  itemDesc?: string;
  picFstb?: string;
  tglFstb?: string;
  showToast?: (msg: string, type?: 'info' | 'success' | 'warning' | 'error') => void;
}

export default function FstbMediaModal({
  isOpen,
  onClose,
  noFstb,
  noPo,
  noFpb,
  armada,
  itemDesc,
  picFstb,
  tglFstb,
  showToast,
}: FstbMediaModalProps) {
  const [documents, setDocuments] = useState<UploadedFstbItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [selectedDocIdx, setSelectedDocIdx] = useState<number>(0);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  // Bersihkan target query
  const cleanFstb = useMemo(() => (noFstb || '').trim(), [noFstb]);
  const cleanPo = useMemo(() => (noPo || '').trim(), [noPo]);
  const cleanFpb = useMemo(() => (noFpb || '').trim(), [noFpb]);
  const shortFstb = useMemo(() => extractFstbLast5(cleanFstb), [cleanFstb]);

  // Fetch data dari /api/upload-fstb saat modal dibuka
  useEffect(() => {
    if (!isOpen) {
      setDocuments([]);
      setIsLoading(true);
      setErrorMsg('');
      setSelectedDocIdx(0);
      setIsFullscreen(false);
      return;
    }

    let isMounted = true;
    setIsLoading(true);
    setErrorMsg('');

    const fetchFstbDocs = async () => {
      try {
        // 1. Coba cari dengan noFstb spesifik
        const searchTerms = [cleanFstb, shortFstb, cleanPo, cleanFpb].filter(Boolean) as string[];
        let matchedItems: UploadedFstbItem[] = [];

        // Ambil daftar lengkap atau spesifik
        const primaryQuery = cleanFstb || cleanPo || cleanFpb || '';
        const res = await fetch(`/api/upload-fstb?fstb=${encodeURIComponent(primaryQuery)}&_t=${Date.now()}`);
        if (!res.ok) throw new Error('Gagal menghubungi server berkas FSTB.');
        const data = await res.json();

        if (Array.isArray(data.items) && data.items.length > 0) {
          matchedItems = data.items;
        } else {
          // Fallback: Ambil seluruh history lalu filter cerdas di client-side
          const fallbackRes = await fetch(`/api/upload-fstb?_t=${Date.now()}`);
          if (fallbackRes.ok) {
            const fallbackData = await fallbackRes.json();
            if (Array.isArray(fallbackData.items)) {
              const all: UploadedFstbItem[] = fallbackData.items;
              matchedItems = all.filter((item) => {
                const uFstb = (item.noFstb || '').toUpperCase();
                const uCleanFstb = (item.cleanNoFstb || '').toUpperCase();
                const uDoNo = (item.doNo || '').toUpperCase();
                const uFpb = (item.noFpb || '').toUpperCase();
                const uFileName = (item.renamedFileName || '').toUpperCase();

                // Cek kesesuaian dengan setiap term
                for (const term of searchTerms) {
                  const uTerm = term.toUpperCase();
                  if (
                    uFstb.includes(uTerm) ||
                    uCleanFstb.includes(uTerm) ||
                    uDoNo.includes(uTerm) ||
                    uFpb.includes(uTerm) ||
                    uFileName.includes(uTerm)
                  ) {
                    return true;
                  }
                  // Cek digit akhir FSTB jika 5 angka
                  const termNum = term.replace(/\D/g, '');
                  if (termNum && termNum.length >= 4) {
                    const itemNum = (item.cleanNoFstb || item.noFstb || '').replace(/\D/g, '');
                    if (itemNum.endsWith(termNum)) return true;
                  }
                }
                return false;
              });
            }
          }
        }

        if (isMounted) {
          setDocuments(matchedItems);
          setSelectedDocIdx(0);
        }
      } catch (err: unknown) {
        if (isMounted) {
          const msg = err instanceof Error ? err.message : 'Terjadi kesalahan saat memuat berkas FSTB.';
          setErrorMsg(msg);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    fetchFstbDocs();

    return () => {
      isMounted = false;
    };
  }, [isOpen, cleanFstb, cleanPo, cleanFpb, shortFstb]);

  // Listener ESC untuk menutup modal
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

  const activeDoc = documents[selectedDocIdx] || null;

  const handleCopy = (text: string, fieldKey: string, label: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedField(fieldKey);
    if (showToast) {
      showToast(`${label} berhasil disalin ke clipboard!`, 'info');
    }
    setTimeout(() => {
      setCopiedField(null);
    }, 2000);
  };

  if (!isOpen) return null;

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
            : 'max-w-5xl w-full max-h-[92vh]'
        }`}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between p-3.5 sm:p-4 border-b border-border bg-muted/40 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="size-9 rounded-xl bg-teal-500/15 border border-teal-500/30 flex items-center justify-center text-teal-600 dark:text-teal-400 shrink-0 shadow-2xs">
              <Boxes className="size-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-sm sm:text-base font-bold text-foreground font-mono flex items-center gap-1.5 truncate">
                  <span>Dokumen FSTB Resmi</span>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-teal-500/15 text-teal-700 dark:text-teal-300 border border-teal-500/20">
                    Fase 3 • Serah Terima
                  </span>
                </h3>
              </div>
              <p className="text-xs text-muted-foreground truncate mt-0.5">
                No. FSTB: <strong className="text-foreground font-mono">{cleanFstb || activeDoc?.noFstb || '-'}</strong>
                {cleanPo && (
                  <>
                    {' '}• PO: <span className="font-mono text-foreground">{cleanPo}</span>
                  </>
                )}
                {armada && (
                  <>
                    {' '}• Armada: <span className="font-medium text-foreground">{armada}</span>
                  </>
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {activeDoc && (
              <>
                <a
                  href={activeDoc.fileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="h-8 px-2.5 rounded-lg border border-border bg-background hover:bg-muted text-xs font-medium text-foreground inline-flex items-center gap-1.5 transition cursor-pointer shadow-2xs"
                  title="Buka Dokumen di Tab Browser Baru"
                >
                  <ExternalLink className="size-3.5 text-muted-foreground" />
                  <span className="hidden sm:inline">Tab Baru</span>
                </a>
                <a
                  href={activeDoc.fileUrl}
                  download={activeDoc.renamedFileName}
                  className="h-8 px-2.5 rounded-lg border border-border bg-background hover:bg-muted text-xs font-medium text-foreground inline-flex items-center gap-1.5 transition cursor-pointer shadow-2xs"
                  title="Unduh Berkas FSTB"
                >
                  <Download className="size-3.5 text-muted-foreground" />
                  <span className="hidden sm:inline">Unduh</span>
                </a>
              </>
            )}
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

        {/* Tab Dokumen Jika Ada Lebih dari 1 Berkas FSTB */}
        {documents.length > 1 && (
          <div className="px-4 py-2 border-b border-border bg-muted/20 flex items-center gap-2 overflow-x-auto shrink-0">
            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider shrink-0 mr-1">
              Daftar Berkas ({documents.length}):
            </span>
            {documents.map((doc, idx) => (
              <button
                key={doc.id || idx}
                type="button"
                onClick={() => setSelectedDocIdx(idx)}
                className={`px-3 py-1 text-xs font-mono rounded-lg border transition shrink-0 inline-flex items-center gap-1.5 cursor-pointer ${
                  selectedDocIdx === idx
                    ? 'bg-teal-500/15 text-teal-700 dark:text-teal-300 border-teal-500/40 font-bold shadow-2xs'
                    : 'bg-background hover:bg-muted text-muted-foreground border-border'
                }`}
              >
                <FileText className="size-3" />
                <span>{doc.renamedFileName}</span>
              </button>
            ))}
          </div>
        )}

        {/* Modal Main Body */}
        <div className="flex-1 overflow-y-auto flex flex-col min-h-0 bg-background">
          {isLoading ? (
            <div className="flex-1 flex flex-col items-center justify-center p-12 space-y-3 min-h-[350px]">
              <RefreshCw className="size-8 text-teal-600 animate-spin" />
              <p className="text-sm font-medium text-foreground">
                Memuat dokumen scan FSTB dari Cloudflare R2...
              </p>
              <p className="text-xs text-muted-foreground font-mono">
                Mencari berkas terkait {cleanFstb || cleanPo || 'FSTB'}
              </p>
            </div>
          ) : errorMsg ? (
            <div className="flex-1 flex flex-col items-center justify-center p-12 space-y-3 min-h-[350px]">
              <div className="size-12 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center text-red-600">
                <AlertCircle className="size-6" />
              </div>
              <p className="text-sm font-bold text-foreground">Gagal Memuat Berkas FSTB</p>
              <p className="text-xs text-muted-foreground max-w-md text-center">{errorMsg}</p>
            </div>
          ) : documents.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center p-10 space-y-4 min-h-[380px] text-center">
              <div className="size-16 rounded-2xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center text-teal-600 dark:text-teal-400">
                <FileSpreadsheet className="size-8" />
              </div>
              <div className="space-y-1.5 max-w-md">
                <h4 className="text-base font-bold text-foreground">
                  Berkas FSTB Belum Diunggah
                </h4>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Belum ada dokumen PDF / scan formulir FSTB resmi yang diunggah ke sistem untuk nomor{' '}
                  <strong className="text-foreground font-mono font-bold">
                    {cleanFstb || cleanPo || 'transaksi ini'}
                  </strong>
                  .
                </p>
              </div>

              <div className="p-3.5 rounded-xl border border-border bg-muted/30 max-w-md w-full text-left space-y-1.5 text-xs">
                <div className="flex items-center justify-between text-muted-foreground">
                  <span>No. FSTB Database:</span>
                  <span className="font-mono font-semibold text-foreground">{cleanFstb || 'Belum Terbit'}</span>
                </div>
                {cleanPo && (
                  <div className="flex items-center justify-between text-muted-foreground">
                    <span>No. PO Terkait:</span>
                    <span className="font-mono text-foreground">{cleanPo}</span>
                  </div>
                )}
                {tglFstb && (
                  <div className="flex items-center justify-between text-muted-foreground">
                    <span>Tgl FSTB:</span>
                    <span className="font-mono text-foreground">{tglFstb}</span>
                  </div>
                )}
                {picFstb && (
                  <div className="flex items-center justify-between text-muted-foreground">
                    <span>PIC FSTB:</span>
                    <span className="font-semibold text-foreground">{picFstb}</span>
                  </div>
                )}
              </div>

              <p className="text-[11px] text-muted-foreground max-w-sm">
                Petugas logistik / purchasing dapat mengunggah dokumen fisik FSTB melalui tab menu{' '}
                <strong className="text-foreground">Upload FSTB</strong> pada sidebar.
              </p>
            </div>
          ) : activeDoc ? (
            <div className="flex-1 flex flex-col min-h-0">
              {/* Viewer Konten PDF / Gambar */}
              <div className="flex-1 bg-black/90 relative flex items-center justify-center min-h-[460px] sm:min-h-[550px] p-2">
                {activeDoc.fileType === 'application/pdf' ||
                activeDoc.renamedFileName.toLowerCase().endsWith('.pdf') ? (
                  <iframe
                    src={`${activeDoc.fileUrl}#view=FitH`}
                    title={activeDoc.renamedFileName}
                    className="w-full h-full min-h-[460px] sm:min-h-[550px] rounded-lg border-0 bg-white"
                  />
                ) : (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={activeDoc.fileUrl}
                    alt={activeDoc.renamedFileName}
                    className="max-w-full max-h-[80vh] object-contain rounded-lg shadow-2xl"
                  />
                )}
              </div>

              {/* Panel Informasi & Metadata Berkas FSTB */}
              <div className="p-4 border-t border-border bg-card space-y-3 shrink-0">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  {/* Kolom 1: No FSTB & PO */}
                  <div className="p-2.5 rounded-xl border border-border bg-muted/30 space-y-1">
                    <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider block">
                      No. FSTB Resmi
                    </span>
                    <div className="flex items-center justify-between gap-1">
                      <span className="font-mono font-bold text-foreground text-xs truncate">
                        {activeDoc.noFstb}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleCopy(activeDoc.noFstb, 'noFstb', 'No. FSTB')}
                        className="p-1 rounded text-muted-foreground hover:text-foreground transition cursor-pointer"
                        title="Salin No. FSTB"
                      >
                        {copiedField === 'noFstb' ? (
                          <Check className="size-3 text-emerald-500" />
                        ) : (
                          <Copy className="size-3" />
                        )}
                      </button>
                    </div>
                    {activeDoc.doNo && (
                      <div className="text-[10px] text-muted-foreground font-mono truncate">
                        PO: <strong className="text-foreground">{activeDoc.doNo}</strong>
                      </div>
                    )}
                  </div>

                  {/* Kolom 2: Armada & Tanggal */}
                  <div className="p-2.5 rounded-xl border border-border bg-muted/30 space-y-1">
                    <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider block">
                      Armada &amp; Waktu
                    </span>
                    <div className="flex items-center gap-1.5 text-foreground font-medium truncate">
                      <Ship className="size-3 text-teal-600 dark:text-teal-400 shrink-0" />
                      <span className="truncate">{activeDoc.armada || armada || '-'}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground font-mono truncate">
                      <Calendar className="size-3 shrink-0" />
                      <span>{activeDoc.fstbDate || activeDoc.receivedDate}</span>
                    </div>
                  </div>

                  {/* Kolom 3: Identitas Uploader */}
                  <div className="p-2.5 rounded-xl border border-border bg-muted/30 space-y-1">
                    <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider block">
                      Pengunggah Berkas
                    </span>
                    <div className="flex items-center gap-1.5 text-foreground font-semibold text-xs truncate">
                      <UserCheck className="size-3 text-blue-600 dark:text-blue-400 shrink-0" />
                      <span className="truncate">{activeDoc.uploaderName || 'Staff Purchasing'}</span>
                    </div>
                    <div className="flex items-center gap-1 text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">
                      {activeDoc.isAutoStamped ? (
                        <>
                          <PenTool className="size-2.5 shrink-0" />
                          <span>Digital Signature Valid</span>
                        </>
                      ) : (
                        <span className="text-muted-foreground">Diarsipkan Manual</span>
                      )}
                    </div>
                  </div>

                  {/* Kolom 4: Penyimpanan & Status */}
                  <div className="p-2.5 rounded-xl border border-border bg-muted/30 space-y-1">
                    <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider block">
                      Status Penyimpanan
                    </span>
                    <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
                      <CheckCircle2 className="size-3" />
                      <span>Cloudflare R2 Bucket</span>
                    </div>
                    <div className="text-[10px] text-muted-foreground font-mono truncate">
                      {activeDoc.renamedFileName}
                    </div>
                  </div>
                </div>

                {/* Info Tambahan Penerima Akhir jika ada */}
                {activeDoc.isRecipientStamped && (
                  <div className="p-2.5 rounded-xl border border-emerald-500/30 bg-emerald-500/5 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="size-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                      <span className="text-foreground">
                        Tanda Tangan Penerima Akhir:{' '}
                        <strong className="font-semibold text-emerald-700 dark:text-emerald-300">
                          {activeDoc.recipientName || 'Crew Kapal'}
                        </strong>
                        {activeDoc.recipientPhone && ` (${activeDoc.recipientPhone})`}
                      </span>
                    </div>
                    <span className="text-[10px] font-mono text-muted-foreground">
                      Tervalidasi Serah Terima
                    </span>
                  </div>
                )}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
