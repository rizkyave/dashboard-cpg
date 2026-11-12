'use client';

import React, { useState, useEffect, useMemo, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  Camera,
  CheckCircle2,
  Loader2,
  PackageCheck,
  Search,
  Ship,
  Trash2,
  Upload,
  User,
  AlertCircle,
  ImagePlus,
  RotateCcw,
} from 'lucide-react';
import CameraWatermarkModal from '@/components/CameraWatermarkModal';

interface TtbOption {
  noTtb: string;
  armada: string;
  photoCount?: number;
}

async function compressImage(file: File): Promise<File> {
  return new Promise((resolve) => {
    if (!file.type.startsWith('image/')) {
      resolve(file);
      return;
    }
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      const maxWidth = 1280;
      let width = img.width;
      let height = img.height;
      if (width > maxWidth) {
        height = Math.round((height * maxWidth) / width);
        width = maxWidth;
      }
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(file);
        return;
      }
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            resolve(file);
            return;
          }
          resolve(
            new File([blob], file.name.replace(/\.[^/.]+$/, '.jpg'), {
              type: 'image/jpeg',
              lastModified: Date.now(),
            })
          );
        },
        'image/jpeg',
        0.65
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(file);
    };
    img.src = objectUrl;
  });
}

function dataUrlToFile(dataUrl: string, filename: string): File {
  const arr = dataUrl.split(',');
  const mimeMatch = arr[0].match(/:(.*?);/);
  const mime = mimeMatch ? mimeMatch[1] : 'image/jpeg';
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }
  return new File([u8arr], filename, { type: mime });
}

function CekTtbContent() {
  const searchParams = useSearchParams();
  const initialNoTtb = (searchParams.get('noTtb') || '').trim();
  const initialArmada = (searchParams.get('armada') || '').trim();

  const [noTtb, setNoTtb] = useState<string>(initialNoTtb);
  const [armada, setArmada] = useState<string>(initialArmada);
  const [checkerName, setCheckerName] = useState<string>('');
  const [ttbOptions, setTtbOptions] = useState<TtbOption[]>([]);
  const [isLoadingList, setIsLoadingList] = useState<boolean>(true);
  const [ttbSearch, setTtbSearch] = useState<string>('');

  const [capturedPhotos, setCapturedPhotos] = useState<{ file: File; previewUrl: string }[]>([]);
  const [isCameraOpen, setIsCameraOpen] = useState<boolean>(false);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [uploadedResult, setUploadedResult] = useState<{
    message: string;
    files: string[];
  } | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedName = localStorage.getItem('CPG_TIM_TTB_CHECKER_NAME');
      if (savedName) setCheckerName(savedName);
    }
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch(`/api/upload-ttb?_t=${Date.now()}`);
        if (res.ok) {
          const json = await res.json();
          const map = new Map<string, TtbOption>();
          const records = Array.isArray(json.history)
            ? json.history
            : Array.isArray(json.records)
            ? json.records
            : [];
          records.forEach((r: any) => {
            const num = (r.noTtb || r.cleanNoTtb || '').trim();
            if (!num || num === '-') return;
            const cur = map.get(num) || {
              noTtb: num,
              armada: r.armada || '-',
              photoCount: 0,
            };
            if (!r.isPdf) cur.photoCount = (cur.photoCount || 0) + 1;
            map.set(num, cur);
          });
          if (active) {
            setTtbOptions(Array.from(map.values()).sort((a, b) => b.noTtb.localeCompare(a.noTtb)));
          }
        }
      } catch {
        // Non-fatal: petugas tetap bisa mengetik No. TTB manual
      } finally {
        if (active) setIsLoadingList(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const filteredOptions = useMemo(() => {
    const q = ttbSearch.trim().toLowerCase();
    if (!q) return ttbOptions.slice(0, 25);
    return ttbOptions
      .filter(
        (o) =>
          o.noTtb.toLowerCase().includes(q) ||
          o.armada.toLowerCase().includes(q)
      )
      .slice(0, 25);
  }, [ttbOptions, ttbSearch]);

  const handleSelectOption = (opt: TtbOption) => {
    setNoTtb(opt.noTtb);
    if (opt.armada && opt.armada !== '-') setArmada(opt.armada);
    setTtbSearch('');
  };

  const handleCameraCaptured = (dataUrl: string, filename: string) => {
    const file = dataUrlToFile(dataUrl, filename || `TTB_${Date.now()}.jpg`);
    setCapturedPhotos((prev) => {
      if (prev.length >= 10) return prev;
      return [...prev, { file, previewUrl: dataUrl }];
    });
    setIsCameraOpen(false);
    setErrorMsg('');
  };

  const handleGalleryPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(e.target.files || []);
    if (picked.length === 0) return;
    const remainingSlot = Math.max(0, 10 - capturedPhotos.length);
    const slice = picked.slice(0, remainingSlot);
    const processed = await Promise.all(
      slice.map(async (f) => {
        const compressed = await compressImage(f);
        return { file: compressed, previewUrl: URL.createObjectURL(compressed) };
      })
    );
    setCapturedPhotos((prev) => [...prev, ...processed]);
    setErrorMsg('');
    if (e.target) e.target.value = '';
  };

  const handleRemovePhoto = (idx: number) => {
    setCapturedPhotos((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    const cleanTtb = noTtb.trim().toUpperCase();
    if (!cleanTtb) {
      setErrorMsg('Nomor TTB wajib diisi atau dipilih terlebih dahulu.');
      return;
    }
    if (!checkerName.trim()) {
      setErrorMsg('Nama petugas penerima TTB wajib diisi.');
      return;
    }
    if (capturedPhotos.length === 0) {
      setErrorMsg('Ambil minimal 1 foto pengecekan barang terlebih dahulu.');
      return;
    }

    if (typeof window !== 'undefined') {
      localStorage.setItem('CPG_TIM_TTB_CHECKER_NAME', checkerName.trim());
    }

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append('noTtb', cleanTtb);
      formData.append('armada', armada.trim() || '-');
      formData.append('uploaderName', checkerName.trim());
      formData.append('uploaderJabatan', 'Tim TTB Penerima Barang');
      capturedPhotos.forEach((p) => {
        formData.append('files', p.file);
      });

      const res = await fetch('/api/upload-ttb', {
        method: 'POST',
        body: formData,
      });
      const json = await res.json();

      if (res.ok && json.success) {
        const names = Array.isArray(json.uploadedFiles)
          ? json.uploadedFiles.map((u: any) => u.renamedFileName || u.fileName || String(u))
          : [];
        setUploadedResult({
          message: json.message || `Foto pengecekan TTB ${cleanTtb} berhasil disimpan!`,
          files: names,
        });
        setCapturedPhotos([]);
      } else {
        setErrorMsg(json.message || json.error || 'Gagal mengunggah foto pengecekan TTB.');
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Terjadi kesalahan jaringan saat mengunggah foto.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleResetNext = () => {
    setUploadedResult(null);
    if (!initialNoTtb) {
      setNoTtb('');
      setArmada('');
    }
    setCapturedPhotos([]);
    setErrorMsg('');
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center p-4 pb-10">
      <div className="w-full max-w-md space-y-4">
        {/* Header Mobile */}
        <div className="p-4 rounded-2xl bg-gradient-to-br from-sky-500/20 via-slate-900 to-emerald-500/10 border border-sky-500/30 shadow-lg">
          <div className="flex items-center gap-3">
            <div className="size-11 rounded-xl bg-sky-500/20 border border-sky-400/40 flex items-center justify-center shrink-0">
              <PackageCheck className="size-6 text-sky-400" />
            </div>
            <div>
              <div className="text-[10px] font-mono uppercase tracking-wider text-sky-300 font-bold">
                CPG Mobile Field Capture
              </div>
              <h1 className="text-base font-bold text-white leading-tight">
                Cek &amp; Foto Tim TTB Penerima Barang
              </h1>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Penomoran file otomatis sesuai Nomor TTB &amp; watermark GPS.
              </p>
            </div>
          </div>
        </div>

        {uploadedResult ? (
          <div className="p-5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 space-y-4 text-center">
            <CheckCircle2 className="size-12 text-emerald-400 mx-auto" />
            <div className="space-y-1">
              <h2 className="text-base font-bold text-white">Foto Pengecekan Tersimpan!</h2>
              <p className="text-xs text-slate-300">{uploadedResult.message}</p>
            </div>
            {uploadedResult.files.length > 0 && (
              <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 text-left space-y-1">
                <div className="text-[10px] font-mono uppercase text-emerald-400 font-bold">
                  Nama File Otomatis di Server:
                </div>
                {uploadedResult.files.map((fn, i) => (
                  <div key={i} className="text-xs font-mono text-slate-200 truncate">
                    ✓ {fn}
                  </div>
                ))}
              </div>
            )}
            <button
              type="button"
              onClick={handleResetNext}
              className="w-full h-11 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm flex items-center justify-center gap-2 cursor-pointer transition"
            >
              <RotateCcw className="size-4" />
              <span>Foto / Cek TTB Lainnya</span>
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Step 1: Identitas TTB & Armada */}
            <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-200 flex items-center justify-between">
                  <span>Nomor TTB Resmi *</span>
                  {isLoadingList && <Loader2 className="size-3.5 animate-spin text-sky-400" />}
                </label>
                <input
                  type="text"
                  value={noTtb}
                  onChange={(e) => setNoTtb(e.target.value.toUpperCase())}
                  placeholder="Contoh: CPL-TTB-26-00449"
                  className="w-full h-11 px-3 rounded-xl bg-slate-950 border border-slate-700 text-sm font-mono font-bold text-white focus:outline-hidden focus:ring-2 focus:ring-sky-500"
                />

                {/* Quick Search dari Daftar TTB Server */}
                {!initialNoTtb && ttbOptions.length > 0 && (
                  <div className="space-y-1.5 pt-1">
                    <div className="relative">
                      <Search className="size-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={ttbSearch}
                        onChange={(e) => setTtbSearch(e.target.value)}
                        placeholder="Cari No. TTB atau Nama Kapal dari daftar..."
                        className="w-full h-9 pl-8 pr-3 rounded-xl bg-slate-950/70 border border-slate-800 text-xs text-slate-200 focus:outline-hidden focus:ring-1 focus:ring-sky-500"
                      />
                    </div>
                    {ttbSearch.trim().length > 0 && (
                      <div className="max-h-40 overflow-y-auto rounded-xl border border-slate-800 bg-slate-950 divide-y divide-slate-800/80">
                        {filteredOptions.length === 0 ? (
                          <div className="p-2.5 text-[11px] text-slate-500 text-center">
                            Tidak ditemukan di riwayat; ketik manual di kolom atas.
                          </div>
                        ) : (
                          filteredOptions.map((opt) => (
                            <button
                              key={opt.noTtb}
                              type="button"
                              onClick={() => handleSelectOption(opt)}
                              className="w-full px-3 py-2 text-left hover:bg-sky-500/10 flex items-center justify-between gap-2 cursor-pointer"
                            >
                              <div className="min-w-0">
                                <div className="text-xs font-mono font-bold text-sky-300">{opt.noTtb}</div>
                                <div className="text-[10px] text-slate-400 truncate">{opt.armada}</div>
                              </div>
                              <span className="text-[10px] font-mono text-slate-500 shrink-0">
                                {opt.photoCount || 0} foto
                              </span>
                            </button>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                  <Ship className="size-3.5 text-sky-400" />
                  <span>Nama Armada / Peruntukan</span>
                </label>
                <input
                  type="text"
                  value={armada}
                  onChange={(e) => setArmada(e.target.value)}
                  placeholder="Contoh: TB MAPAN 1405 / Gudang Somber"
                  className="w-full h-10 px-3 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white focus:outline-hidden focus:ring-2 focus:ring-sky-500"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                  <User className="size-3.5 text-emerald-400" />
                  <span>Nama Petugas TTB *</span>
                </label>
                <input
                  type="text"
                  value={checkerName}
                  onChange={(e) => setCheckerName(e.target.value)}
                  placeholder="Nama lengkap pemeriksa barang"
                  className="w-full h-10 px-3 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>

            {/* Step 2: Capture Foto Pola End User (CameraWatermarkModal) */}
            <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-200">
                  Foto Pengecekan ({capturedPhotos.length}/10)
                </span>
                <span className="text-[10px] font-mono text-sky-400">Watermark GPS + Waktu</span>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    if (!noTtb.trim()) {
                      setErrorMsg('Isi atau pilih Nomor TTB terlebih dahulu sebelum mengambil foto.');
                      return;
                    }
                    setErrorMsg('');
                    setIsCameraOpen(true);
                  }}
                  className="h-12 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs flex items-center justify-center gap-2 cursor-pointer transition shadow-md"
                >
                  <Camera className="size-4" />
                  <span>Buka Kamera</span>
                </button>

                <label className="h-12 rounded-xl border border-slate-700 bg-slate-950 hover:bg-slate-800 text-slate-200 font-semibold text-xs flex items-center justify-center gap-2 cursor-pointer transition">
                  <ImagePlus className="size-4 text-emerald-400" />
                  <span>Pilih Galeri</span>
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleGalleryPick}
                    className="hidden"
                  />
                </label>
              </div>

              {capturedPhotos.length > 0 && (
                <div className="grid grid-cols-3 gap-2 pt-1">
                  {capturedPhotos.map((p, idx) => (
                    <div
                      key={idx}
                      className="relative aspect-square rounded-xl overflow-hidden border border-slate-700 bg-slate-950"
                    >
                      <img src={p.previewUrl} alt={`Foto ${idx + 1}`} className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => handleRemovePhoto(idx)}
                        className="absolute top-1 right-1 p-1 rounded-lg bg-rose-600/90 text-white cursor-pointer"
                        title="Hapus foto"
                      >
                        <Trash2 className="size-3" />
                      </button>
                      <span className="absolute bottom-1 left-1 px-1.5 py-0.5 rounded bg-black/70 text-[9px] font-mono text-white">
                        #{idx + 1}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {errorMsg && (
              <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/40 text-rose-200 text-xs flex items-start gap-2">
                <AlertCircle className="size-4 text-rose-400 shrink-0 mt-0.5" />
                <span>{errorMsg}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={isUploading}
              className="w-full h-12 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-sm flex items-center justify-center gap-2 cursor-pointer shadow-lg disabled:opacity-60 transition"
            >
              {isUploading ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  <span>Mengunggah &amp; Penomoran Otomatis...</span>
                </>
              ) : (
                <>
                  <Upload className="size-4" />
                  <span>Upload Foto Pengecekan TTB</span>
                </>
              )}
            </button>
          </form>
        )}
      </div>

      {/* Modal Kamera Watermark (Pola Identik dengan End User) */}
      <CameraWatermarkModal
        isOpen={isCameraOpen}
        onClose={() => setIsCameraOpen(false)}
        docNumber={noTtb.trim().toUpperCase() || 'TTB'}
        docType="TTB"
        userName={checkerName.trim() || 'Tim TTB'}
        userJabatan="Tim TTB Penerima Barang"
        onPhotoCaptured={handleCameraCaptured}
      />
    </div>
  );
}

export default function CekTtbPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-950 text-slate-300 flex items-center justify-center text-xs">
          <Loader2 className="size-5 animate-spin mr-2 text-sky-400" />
          Memuat halaman pengecekan TTB...
        </div>
      }
    >
      <CekTtbContent />
    </Suspense>
  );
}
