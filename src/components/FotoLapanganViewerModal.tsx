'use client';

import React, { useState, useEffect } from 'react';
import {
  X,
  Camera,
  ZoomIn,
  ZoomOut,
  RotateCw,
  Download,
  Trash2,
  Plus,
  Calendar,
  User,
  Anchor,
  FileText,
  ShieldCheck,
  ChevronLeft,
  ChevronRight,
  Maximize2,
} from 'lucide-react';
import { FotoLapangan } from '@/types/fotoLapangan';
import {
  getFotosByNoTtb,
  getFotosByFpbOrFstb,
  deleteFotoLapangan,
  getAllFotos,
} from '@/utils/fotoLapanganStorage';

interface FotoLapanganViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  noTtb?: string;
  noFstb?: string;
  fpb?: string;
  item?: string;
  armada?: string;
  onOpenUpload?: (suggestedTtb?: string) => void;
  showToast?: (msg: string, type?: 'info' | 'success' | 'warning' | 'error') => void;
}

export default function FotoLapanganViewerModal({
  isOpen,
  onClose,
  noTtb,
  noFstb,
  fpb,
  item,
  armada,
  onOpenUpload,
  showToast,
}: FotoLapanganViewerModalProps) {
  const [photos, setPhotos] = useState<FotoLapangan[]>([]);
  const [selectedIndex, setSelectedIndex] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Zoom & Rotation controls
  const [zoomScale, setZoomScale] = useState<number>(1);
  const [rotation, setRotation] = useState<number>(0);

  const loadPhotos = async () => {
    setIsLoading(true);
    try {
      let matched: FotoLapangan[] = [];

      if (noTtb && noTtb.trim() && noTtb.trim() !== '-') {
        matched = await getFotosByNoTtb(noTtb);
      }

      if (matched.length === 0 && (fpb || noFstb)) {
        matched = await getFotosByFpbOrFstb({ fpb, noFstb });
      }

      // If still empty and no filter given, load recent
      if (matched.length === 0 && !noTtb && !fpb && !noFstb) {
        const all = await getAllFotos();
        matched = all.slice(0, 10);
      }

      setPhotos(matched);
      setSelectedIndex(0);
      setZoomScale(1);
      setRotation(0);
    } catch (err) {
      console.error('Error fetching photos:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadPhotos();
    }
  }, [isOpen, noTtb, fpb, noFstb]);

  if (!isOpen) return null;

  const currentPhoto: FotoLapangan | undefined = photos[selectedIndex];

  const handleZoomIn = () => setZoomScale((prev) => Math.min(prev + 0.25, 3));
  const handleZoomOut = () => setZoomScale((prev) => Math.max(prev - 0.25, 0.5));
  const handleRotate = () => setRotation((prev) => (prev + 90) % 360);
  const handleResetView = () => {
    setZoomScale(1);
    setRotation(0);
  };

  const handleDownload = () => {
    if (!currentPhoto) return;
    const a = document.createElement('a');
    a.href = currentPhoto.dataUrl;
    a.download = `Foto_Lapangan_${currentPhoto.noTtb}_${currentPhoto.tanggal}.jpg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    showToast?.('Foto lapangan berhasil diunduh.', 'success');
  };

  const handleDelete = async () => {
    if (!currentPhoto) return;
    if (!confirm(`Hapus foto lapangan ini (TTB: ${currentPhoto.noTtb})?`)) return;

    try {
      await deleteFotoLapangan(currentPhoto.id);
      showToast?.('Foto lapangan berhasil dihapus.', 'info');
      await loadPhotos();
    } catch (err) {
      showToast?.('Gagal menghapus foto lapangan.', 'error');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 animate-in fade-in duration-200">
      <div className="bg-card border border-border rounded-2xl w-full max-w-5xl shadow-2xl overflow-hidden flex flex-col max-h-[95vh] h-[850px]">
        {/* Header Bar */}
        <div className="p-3.5 sm:p-4 border-b border-border bg-muted/40 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="size-9 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center border border-blue-500/20 shrink-0">
              <Camera className="size-4.5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-bold text-foreground text-sm truncate">
                  Dokumentasi Foto Lapangan In-App
                </h3>
                {noTtb && (
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-mono font-bold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                    TTB: {noTtb}
                  </span>
                )}
                {photos.length > 0 && (
                  <span className="text-xs text-muted-foreground">
                    ({selectedIndex + 1} dari {photos.length} foto)
                  </span>
                )}
              </div>
              <p className="text-[11px] text-muted-foreground truncate">
                {armada ? `Armada: ${armada}` : ''} {item ? `• ${item}` : ''}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {onOpenUpload && (
              <button
                onClick={() => onOpenUpload(noTtb)}
                className="h-8 px-3 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold flex items-center gap-1.5 transition shadow-xs"
                title="Tambah Foto untuk TTB Ini"
              >
                <Plus className="size-3.5" />
                <span className="hidden sm:inline">Tambah Foto</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition"
              title="Tutup Viewer"
            >
              <X className="size-5" />
            </button>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 flex flex-col lg:flex-row min-h-0 overflow-hidden">
          {/* Main Photo Canvas */}
          <div className="flex-1 bg-black/95 relative flex items-center justify-center overflow-hidden select-none">
            {isLoading ? (
              <div className="flex flex-col items-center gap-3 text-muted-foreground">
                <div className="size-8 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
                <span className="text-xs">Memuat foto lapangan...</span>
              </div>
            ) : currentPhoto ? (
              <div className="relative w-full h-full flex items-center justify-center p-4">
                <img
                  src={currentPhoto.dataUrl}
                  alt={`Foto TTB ${currentPhoto.noTtb}`}
                  style={{
                    transform: `scale(${zoomScale}) rotate(${rotation}deg)`,
                    transition: 'transform 0.2s ease',
                  }}
                  className="max-h-full max-w-full object-contain cursor-grab active:cursor-grabbing"
                />

                {/* Floating Image Control Bar */}
                <div className="absolute bottom-4 inset-x-0 flex items-center justify-center gap-1.5 pointer-events-none">
                  <div className="bg-background/90 backdrop-blur-md border border-border rounded-xl p-1.5 shadow-xl flex items-center gap-1 pointer-events-auto">
                    <button
                      onClick={handleZoomIn}
                      className="p-1.5 rounded-lg hover:bg-muted text-foreground transition"
                      title="Perbesar (Zoom In)"
                    >
                      <ZoomIn className="size-4" />
                    </button>
                    <button
                      onClick={handleZoomOut}
                      className="p-1.5 rounded-lg hover:bg-muted text-foreground transition"
                      title="Perkecil (Zoom Out)"
                    >
                      <ZoomOut className="size-4" />
                    </button>
                    <button
                      onClick={handleRotate}
                      className="p-1.5 rounded-lg hover:bg-muted text-foreground transition"
                      title="Putar 90° (Rotate)"
                    >
                      <RotateCw className="size-4" />
                    </button>
                    <button
                      onClick={handleResetView}
                      className="px-2 py-1 rounded-lg hover:bg-muted text-muted-foreground text-[11px] font-mono transition"
                      title="Reset Tampilan"
                    >
                      Reset
                    </button>
                    <div className="h-4 w-px bg-border mx-1" />
                    <button
                      onClick={handleDownload}
                      className="p-1.5 rounded-lg hover:bg-muted text-foreground transition"
                      title="Unduh Gambar"
                    >
                      <Download className="size-4" />
                    </button>
                    <button
                      onClick={handleDelete}
                      className="p-1.5 rounded-lg hover:bg-rose-500/10 text-rose-500 transition"
                      title="Hapus Foto"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                </div>

                {/* Previous & Next Arrows */}
                {photos.length > 1 && (
                  <>
                    <button
                      onClick={() => {
                        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : photos.length - 1));
                        handleResetView();
                      }}
                      className="absolute left-3 top-1/2 -translate-y-1/2 p-2 rounded-full bg-background/80 hover:bg-background border border-border text-foreground transition shadow-md"
                      title="Foto Sebelumnya"
                    >
                      <ChevronLeft className="size-5" />
                    </button>
                    <button
                      onClick={() => {
                        setSelectedIndex((prev) => (prev < photos.length - 1 ? prev + 1 : 0));
                        handleResetView();
                      }}
                      className="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-full bg-background/80 hover:bg-background border border-border text-foreground transition shadow-md"
                      title="Foto Selanjutnya"
                    >
                      <ChevronRight className="size-5" />
                    </button>
                  </>
                )}
              </div>
            ) : (
              <div className="p-8 text-center space-y-3 max-w-sm">
                <div className="size-14 rounded-2xl bg-muted flex items-center justify-center mx-auto text-muted-foreground">
                  <Camera className="size-7" />
                </div>
                <div>
                  <h4 className="font-semibold text-foreground text-sm">
                    Belum Ada Foto Lapangan
                  </h4>
                  <p className="text-xs text-muted-foreground mt-1">
                    {noTtb
                      ? `Belum ada dokumentasi foto yang diunggah untuk Nomor TTB: ${noTtb}`
                      : 'Belum ada foto lapangan yang tersimpan di sistem.'}
                  </p>
                </div>
                {onOpenUpload && (
                  <button
                    onClick={() => onOpenUpload(noTtb)}
                    className="h-9 px-4 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold inline-flex items-center gap-1.5 transition"
                  >
                    <Plus className="size-4" />
                    <span>Upload Foto Sekarang</span>
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Right Info Sidebar / Thumbnail Strip */}
          <div className="w-full lg:w-80 border-t lg:border-t-0 lg:border-l border-border bg-card p-4 overflow-y-auto shrink-0 space-y-4">
            {/* Metadata Card */}
            {currentPhoto && (
              <div className="space-y-3">
                <div className="p-3 bg-muted/40 rounded-xl border border-border space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                      Detail Integrasi
                    </span>
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 font-semibold">
                      Tersimpan In-App
                    </span>
                  </div>

                  <div className="space-y-1.5 text-xs">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Nomor TTB:</span>
                      <span className="font-mono font-bold text-foreground">
                        {currentPhoto.noTtb}
                      </span>
                    </div>

                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">PIC Lapangan:</span>
                      <span className="font-semibold px-2 py-0.5 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 text-[11px]">
                        {currentPhoto.picLapangan}
                      </span>
                    </div>

                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Tanggal:</span>
                      <span className="font-mono text-foreground">
                        {currentPhoto.tanggal} {currentPhoto.waktu ? `(${currentPhoto.waktu})` : ''}
                      </span>
                    </div>

                    {currentPhoto.armada && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Armada:</span>
                        <span className="text-foreground truncate max-w-[150px]">
                          {currentPhoto.armada}
                        </span>
                      </div>
                    )}

                    {currentPhoto.fpb && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">No. FPB:</span>
                        <span className="font-mono text-foreground truncate max-w-[150px]">
                          {currentPhoto.fpb}
                        </span>
                      </div>
                    )}

                    {currentPhoto.noFstb && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">No. FSTB:</span>
                        <span className="font-mono text-foreground truncate max-w-[150px]">
                          {currentPhoto.noFstb}
                        </span>
                      </div>
                    )}

                    {currentPhoto.fileSizeKb && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Ukuran Berkas:</span>
                        <span className="font-mono text-muted-foreground">
                          {currentPhoto.fileSizeKb} KB
                        </span>
                      </div>
                    )}
                  </div>

                  {currentPhoto.catatan && (
                    <div className="pt-2 border-t border-border">
                      <span className="text-[10px] text-muted-foreground font-semibold block mb-0.5">
                        Catatan Fisik:
                      </span>
                      <p className="text-xs text-foreground bg-background p-2 rounded-lg border border-border">
                        {currentPhoto.catatan}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Thumbnail Strip */}
            {photos.length > 1 && (
              <div className="space-y-2">
                <div className="text-xs font-semibold text-foreground flex items-center justify-between">
                  <span>Daftar Foto Terkait</span>
                  <span className="text-[10px] text-muted-foreground font-mono">
                    {photos.length} item
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {photos.map((item, idx) => (
                    <button
                      key={item.id}
                      onClick={() => {
                        setSelectedIndex(idx);
                        handleResetView();
                      }}
                      className={`relative aspect-square rounded-lg overflow-hidden border-2 transition ${
                        selectedIndex === idx
                          ? 'border-blue-500 shadow-md ring-2 ring-blue-500/20'
                          : 'border-border hover:border-muted-foreground/50 opacity-70 hover:opacity-100'
                      }`}
                    >
                      <img
                        src={item.dataUrl}
                        alt={`Thumb ${idx + 1}`}
                        className="w-full h-full object-cover"
                      />
                      <span className="absolute bottom-1 right-1 px-1 rounded bg-black/70 text-[9px] font-mono text-white">
                        #{idx + 1}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
