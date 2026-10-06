'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  Images,
  Search,
  Filter,
  RefreshCw,
  ExternalLink,
  Maximize2,
  Calendar,
  Tag,
  Copy,
  Check,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  ImageOff,
  Loader2,
  SlidersHorizontal,
} from 'lucide-react';
import { extractFstbLast5 } from '@/utils/timemark';

interface PhotoItem {
  name: string;
  url: string;
  takenAt: string | null;
  ttbInfo?: {
    prefix: string | null;
    numbers: string[];
  };
}

interface TtbGalleryTabProps {
  showToast?: (msg: string, type?: 'info' | 'success' | 'warning' | 'error') => void;
}

export default function TtbGalleryTab({ showToast }: TtbGalleryTabProps) {
  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedPrefix, setSelectedPrefix] = useState<string>('ALL');
  const [page, setPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [totalPhotos, setTotalPhotos] = useState<number>(0);
  const [source, setSource] = useState<string>('');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [previewPhoto, setPreviewPhoto] = useState<PhotoItem | null>(null);

  const fetchPhotos = async (targetPage = 1, query = '') => {
    setIsLoading(true);
    try {
      const q = encodeURIComponent(query);
      const res = await fetch(`/api/ttb-photos?all=true&page=${targetPage}&limit=36&q=${q}`);
      const data = await res.json();
      if (data.photos) {
        setPhotos(data.photos);
        setPage(data.page || 1);
        setTotalPages(data.totalPages || 1);
        setTotalPhotos(data.total || 0);
        setSource(data.source || 'local');
      } else {
        setPhotos([]);
      }
    } catch {
      showToast?.('Gagal memuat galeri foto TTB.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const handler = setTimeout(() => {
      fetchPhotos(1, searchTerm);
    }, 300);
    return () => clearTimeout(handler);
  }, [searchTerm]);

  const handleCopy = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      showToast?.(`Nomor TTB "${text}" disalin ke clipboard!`, 'success');
      setTimeout(() => setCopiedKey(null), 2000);
    } catch {
      showToast?.('Gagal menyalin ke clipboard.', 'warning');
    }
  };

  const handlePageChange = (newPage: number) => {
    if (newPage < 1 || newPage > totalPages || newPage === page) return;
    fetchPhotos(newPage, searchTerm);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Filter prefix jika ada (CPL, GAJ, MO, HL, dll.)
  const displayedPhotos = useMemo(() => {
    if (selectedPrefix === 'ALL') return photos;
    return photos.filter((p) => p.ttbInfo?.prefix === selectedPrefix);
  }, [photos, selectedPrefix]);

  return (
    <div className="space-y-4 animate-in fade-in duration-200">
      {/* Top Banner & Control Bar */}
      <div className="bg-card border border-border rounded-xl p-4 sm:p-5 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-xl bg-purple-500/15 border border-purple-500/30 flex items-center justify-center text-purple-600 dark:text-purple-400 shrink-0">
              <Images className="size-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-foreground">Galeri Seluruh Foto TTB</h2>
                <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-700 dark:text-purple-300 border border-purple-500/20">
                  {totalPhotos.toLocaleString('id-ID')} Foto
                </span>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-muted text-muted-foreground border border-border uppercase">
                  {source === 'blob' ? 'Vercel Blob CDN' : 'Server Lokal'}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                Pencarian dan eksplorasi arsip foto bukti fisik penyerahan barang berdasarkan Nomor TTB &amp; Nama Armada
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => fetchPhotos(page, searchTerm)}
            disabled={isLoading}
            className="h-8.5 px-3 rounded-lg border border-border bg-background hover:bg-muted text-xs font-medium text-foreground inline-flex items-center gap-1.5 transition active:scale-95 self-start sm:self-auto shrink-0 cursor-pointer"
          >
            <RefreshCw className={`size-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Segarkan</span>
          </button>
        </div>

        {/* Filter & Search Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 pt-2 border-t border-border">
          <div className="relative sm:col-span-8 lg:col-span-9">
            <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Cari nomor TTB (cth: 04975), nama kapal/armada (cth: CINDARA, TEMASEK), atau tanggal..."
              className="w-full h-9 pl-9 pr-3 rounded-lg border border-border bg-background text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          <div className="sm:col-span-4 lg:col-span-3 flex gap-1.5">
            <select
              value={selectedPrefix}
              onChange={(e) => setSelectedPrefix(e.target.value)}
              className="flex-1 h-9 px-2.5 rounded-lg border border-border bg-background text-xs font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
            >
              <option value="ALL">Semua Perusahaan</option>
              <option value="CPL">CPL (Cindara Pratama)</option>
              <option value="GAJ">GAJ (Gunung Arjuna)</option>
              <option value="MO">MO (Mandar Ocean)</option>
              <option value="HL">HL (Hana Lines)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Gallery Grid */}
      {isLoading ? (
        <div className="p-16 flex flex-col items-center justify-center gap-2 text-muted-foreground text-xs bg-card border border-border rounded-xl">
          <Loader2 className="size-8 animate-spin text-purple-600 dark:text-purple-400" />
          <span>Memuat galeri foto TTB...</span>
        </div>
      ) : displayedPhotos.length === 0 ? (
        <div className="p-16 flex flex-col items-center justify-center gap-2 text-muted-foreground text-xs bg-card border border-border rounded-xl text-center">
          <ImageOff className="size-10 opacity-50 text-muted-foreground" />
          <span className="font-semibold text-foreground text-sm">Tidak Ada Foto Ditemukan</span>
          <p className="max-w-md text-xs text-muted-foreground">
            Tidak ditemukan foto dengan kata kunci &quot;{searchTerm}&quot;. Coba cari menggunakan 5 digit nomor TTB atau nama armada.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {displayedPhotos.map((photo) => {
            const ttbNum = photo.ttbInfo?.numbers[0] || '';
            const ttbLabel = photo.ttbInfo?.prefix && ttbNum ? `${photo.ttbInfo.prefix}-TTB ${ttbNum}` : ttbNum ? `TTB ${ttbNum}` : 'TTB';

            return (
              <div
                key={photo.name}
                className="group bg-card border border-border hover:border-purple-500/50 rounded-xl overflow-hidden shadow-xs hover:shadow-md transition-all flex flex-col"
              >
                {/* Image Box */}
                <div
                  onClick={() => setPreviewPhoto(photo)}
                  className="relative aspect-4/3 bg-black/90 overflow-hidden cursor-pointer"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={photo.url}
                    alt={photo.name}
                    loading="lazy"
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                    <span className="p-1.5 rounded-lg bg-black/60 text-white">
                      <Maximize2 className="size-4" />
                    </span>
                  </div>

                  {/* Badge TTB di atas foto */}
                  {ttbNum && (
                    <span className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded bg-black/75 backdrop-blur-xs text-purple-300 font-mono text-[9px] font-bold border border-purple-500/30">
                      {ttbLabel}
                    </span>
                  )}
                </div>

                {/* Info Box */}
                <div className="p-2 space-y-1 flex-1 flex flex-col justify-between text-[11px]">
                  <p
                    className="font-mono text-[10px] text-foreground truncate font-medium leading-tight"
                    title={photo.name}
                  >
                    {photo.name}
                  </p>

                  <div className="flex items-center justify-between text-[10px] text-muted-foreground pt-1 border-t border-border/60">
                    <span className="flex items-center gap-1 font-mono truncate" title={photo.takenAt || '-'}>
                      <Calendar className="size-2.5 shrink-0 opacity-70" />
                      <span>{photo.takenAt ? photo.takenAt.split(' ')[0] : '-'}</span>
                    </span>

                    {ttbNum && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCopy(ttbNum, photo.name);
                        }}
                        className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition"
                        title={`Salin nomor TTB ${ttbNum}`}
                      >
                        {copiedKey === photo.name ? (
                          <Check className="size-3 text-emerald-500" />
                        ) : (
                          <Copy className="size-3" />
                        )}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination Bar */}
      {totalPages > 1 && (
        <div className="bg-card border border-border rounded-xl p-3 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
          <span className="text-muted-foreground font-mono">
            Halaman <strong className="text-foreground">{page}</strong> dari{' '}
            <strong className="text-foreground">{totalPages}</strong> ({totalPhotos.toLocaleString('id-ID')} total foto)
          </span>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => handlePageChange(1)}
              disabled={page === 1}
              className="p-1.5 rounded-lg border border-border bg-background hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition"
              title="Halaman Pertama"
            >
              <ChevronsLeft className="size-3.5" />
            </button>
            <button
              type="button"
              onClick={() => handlePageChange(page - 1)}
              disabled={page === 1}
              className="p-1.5 rounded-lg border border-border bg-background hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition"
              title="Halaman Sebelumnya"
            >
              <ChevronLeft className="size-3.5" />
            </button>

            <span className="px-3 py-1 font-mono font-bold text-foreground">
              {page} / {totalPages}
            </span>

            <button
              type="button"
              onClick={() => handlePageChange(page + 1)}
              disabled={page === totalPages}
              className="p-1.5 rounded-lg border border-border bg-background hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition"
              title="Halaman Berikutnya"
            >
              <ChevronRight className="size-3.5" />
            </button>
            <button
              type="button"
              onClick={() => handlePageChange(totalPages)}
              disabled={page === totalPages}
              className="p-1.5 rounded-lg border border-border bg-background hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition"
              title="Halaman Terakhir"
            >
              <ChevronsRight className="size-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Lightbox Modal Fullscreen Preview */}
      {previewPhoto && (
        <div
          onClick={() => setPreviewPhoto(null)}
          className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 cursor-pointer animate-in fade-in duration-150"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-card border border-border rounded-2xl max-w-4xl w-full max-h-[92vh] overflow-hidden flex flex-col shadow-2xl cursor-default"
          >
            {/* Modal Header */}
            <div className="p-4 border-b border-border flex items-center justify-between gap-3">
              <div className="min-w-0">
                <h3 className="text-xs sm:text-sm font-bold font-mono text-foreground truncate" title={previewPhoto.name}>
                  {previewPhoto.name}
                </h3>
                {previewPhoto.takenAt && (
                  <p className="text-[11px] text-muted-foreground">Waktu foto: {previewPhoto.takenAt}</p>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <a
                  href={previewPhoto.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="h-8 px-2.5 rounded-lg border border-border bg-background hover:bg-muted text-xs font-medium text-foreground inline-flex items-center gap-1.5 transition"
                >
                  <ExternalLink className="size-3.5" />
                  <span>Ukuran Asli</span>
                </a>
                <button
                  type="button"
                  onClick={() => setPreviewPhoto(null)}
                  className="size-8 rounded-lg border border-border bg-background hover:bg-muted text-muted-foreground hover:text-foreground flex items-center justify-center transition"
                >
                  &times;
                </button>
              </div>
            </div>

            {/* Modal Image Body */}
            <div className="p-2 sm:p-4 bg-black flex-1 flex items-center justify-center overflow-auto max-h-[75vh]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={previewPhoto.url}
                alt={previewPhoto.name}
                className="max-w-full max-h-[70vh] object-contain rounded-lg"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

