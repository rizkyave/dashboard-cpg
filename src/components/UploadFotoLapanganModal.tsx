'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Upload,
  Camera,
  CheckCircle2,
  AlertCircle,
  FileText,
  Anchor,
  User,
  Calendar,
  Sparkles,
  Info,
} from 'lucide-react';
import { FotoLapangan } from '@/types/fotoLapangan';
import { saveFotoLapangan, compressImageFile } from '@/utils/fotoLapanganStorage';

interface SuggestionOption {
  noTtb: string;
  fpb?: string;
  noPo?: string;
  noFstb?: string;
  item?: string;
  armada?: string;
  picLap?: string;
}

interface UploadFotoLapanganModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultNoTtb?: string;
  defaultFpb?: string;
  defaultNoPo?: string;
  defaultNoFstb?: string;
  defaultItem?: string;
  defaultArmada?: string;
  defaultPicLap?: string;
  availableOptions?: SuggestionOption[];
  onSuccess?: (saved: FotoLapangan) => void;
  showToast?: (msg: string, type?: 'info' | 'success' | 'warning' | 'error') => void;
}

export default function UploadFotoLapanganModal({
  isOpen,
  onClose,
  defaultNoTtb = '',
  defaultFpb = '',
  defaultNoPo = '',
  defaultNoFstb = '',
  defaultItem = '',
  defaultArmada = '',
  defaultPicLap = 'AGUS',
  availableOptions = [],
  onSuccess,
  showToast,
}: UploadFotoLapanganModalProps) {
  const [noTtb, setNoTtb] = useState<string>(defaultNoTtb);
  const [fpb, setFpb] = useState<string>(defaultFpb);
  const [noPo, setNoPo] = useState<string>(defaultNoPo);
  const [noFstb, setNoFstb] = useState<string>(defaultNoFstb);
  const [itemDescription, setItemDescription] = useState<string>(defaultItem);
  const [armada, setArmada] = useState<string>(defaultArmada);
  const [picLapangan, setPicLapangan] = useState<string>(defaultPicLap || 'AGUS');
  const [tanggal, setTanggal] = useState<string>(
    new Date().toISOString().slice(0, 10)
  );
  const [catatan, setCatatan] = useState<string>('Barang diterima dalam kondisi baik & fisik lengkap.');

  // Image upload states
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [fileSizeInfo, setFileSizeInfo] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [isDragging, setIsDragging] = useState<boolean>(false);

  // Suggestions filter
  const [showSuggestions, setShowSuggestions] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (defaultNoTtb) setNoTtb(defaultNoTtb);
    if (defaultFpb) setFpb(defaultFpb);
    if (defaultNoPo) setNoPo(defaultNoPo);
    if (defaultNoFstb) setNoFstb(defaultNoFstb);
    if (defaultItem) setItemDescription(defaultItem);
    if (defaultArmada) setArmada(defaultArmada);
    if (defaultPicLap) setPicLapangan(defaultPicLap);
  }, [defaultNoTtb, defaultFpb, defaultNoPo, defaultNoFstb, defaultItem, defaultArmada, defaultPicLap]);

  if (!isOpen) return null;

  const filteredSuggestions = availableOptions.filter((opt) =>
    opt.noTtb.toLowerCase().includes(noTtb.toLowerCase())
  ).slice(0, 8);

  const handleSelectSuggestion = (opt: SuggestionOption) => {
    setNoTtb(opt.noTtb);
    if (opt.fpb) setFpb(opt.fpb);
    if (opt.noPo) setNoPo(opt.noPo);
    if (opt.noFstb) setNoFstb(opt.noFstb);
    if (opt.item) setItemDescription(opt.item);
    if (opt.armada) setArmada(opt.armada);
    if (opt.picLap) setPicLapangan(opt.picLap);
    setShowSuggestions(false);
  };

  const handleFileChange = (file: File) => {
    if (!file.type.startsWith('image/')) {
      showToast?.('Mohon pilih file gambar (JPG, PNG, WebP)', 'error');
      return;
    }
    setSelectedFile(file);
    const originalSizeKb = Math.round(file.size / 1024);
    setFileSizeInfo(`${originalSizeKb} KB`);

    const reader = new FileReader();
    reader.onload = (e) => {
      setImagePreview(e.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileChange(e.dataTransfer.files[0]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!noTtb.trim()) {
      showToast?.('Nomor TTB wajib diisi untuk mengintegrasikan foto lapangan!', 'warning');
      return;
    }

    if (!selectedFile && !imagePreview) {
      showToast?.('Silakan pilih atau unggah foto lapangan terlebih dahulu!', 'warning');
      return;
    }

    setIsProcessing(true);
    try {
      let finalDataUrl = imagePreview || '';
      let finalSizeKb = 0;

      if (selectedFile) {
        const compressed = await compressImageFile(selectedFile, 1600, 1600, 0.82);
        finalDataUrl = compressed.dataUrl;
        finalSizeKb = compressed.sizeKb;
      }

      const saved = await saveFotoLapangan({
        noTtb: noTtb.trim(),
        fpb: fpb.trim() || undefined,
        noPo: noPo.trim() || undefined,
        noFstb: noFstb.trim() || undefined,
        itemDescription: itemDescription.trim() || undefined,
        armada: armada.trim() || undefined,
        picLapangan: picLapangan.trim() || 'AGUS',
        tanggal,
        dataUrl: finalDataUrl,
        catatan: catatan.trim() || undefined,
        fileSizeKb: finalSizeKb,
        fileName: selectedFile?.name || `lapangan_${noTtb.replace(/[^a-zA-Z0-9]/g, '_')}.jpg`,
      });

      showToast?.(`Foto lapangan No. TTB ${noTtb} berhasil diunggah & terintegrasi!`, 'success');
      onSuccess?.(saved);
      onClose();
    } catch (err: any) {
      console.error('Error saving foto:', err);
      showToast?.(`Gagal menyimpan foto: ${err?.message || 'Error tidak diketahui'}`, 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-card border border-border rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden my-auto flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-border bg-muted/40 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center border border-blue-500/20">
              <Camera className="size-5" />
            </div>
            <div>
              <h3 className="font-bold text-foreground text-sm sm:text-base flex items-center gap-2">
                <span>Upload Foto Lapangan (In-App)</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 font-semibold">
                  Integrasi No. TTB
                </span>
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Simpan dokumentasi foto fisik penerimaan langsung ke sistem internal tanpa TimeMark eksternal
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition"
            title="Tutup Form"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-6 overflow-y-auto space-y-4">
          {/* Upload Area / Dropzone */}
          <div>
            <label className="block text-xs font-semibold text-foreground mb-1.5">
              Berkas Foto Lapangan <span className="text-rose-500">*</span>
            </label>
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`relative border-2 border-dashed rounded-xl p-4 sm:p-6 flex flex-col items-center justify-center text-center cursor-pointer transition ${
                isDragging
                  ? 'border-blue-500 bg-blue-500/5'
                  : imagePreview
                  ? 'border-emerald-500/40 bg-emerald-500/5'
                  : 'border-border hover:border-blue-400 hover:bg-muted/40'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files?.[0]) handleFileChange(e.target.files[0]);
                }}
              />

              {imagePreview ? (
                <div className="w-full flex flex-col items-center gap-3">
                  <div className="relative rounded-lg overflow-hidden max-h-56 max-w-full border border-border shadow-xs">
                    <img
                      src={imagePreview}
                      alt="Preview Foto Lapangan"
                      className="object-contain max-h-56 w-auto"
                    />
                  </div>
                  <div className="flex items-center gap-2 text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                    <CheckCircle2 className="size-4" />
                    <span>Foto siap disimpan ({fileSizeInfo})</span>
                    <span className="text-muted-foreground underline text-[11px] ml-2">
                      Klik untuk ganti foto
                    </span>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2 py-4">
                  <div className="size-12 rounded-full bg-muted flex items-center justify-center text-muted-foreground">
                    <Upload className="size-6 text-blue-500" />
                  </div>
                  <div className="space-y-0.5">
                    <p className="text-xs font-semibold text-foreground">
                      Tarik & letakkan foto di sini, atau klik untuk memilih
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      Mendukung format JPG, PNG, WEBP (Otomatis dikompresi agar ringan)
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Grid Input Data TTB & Verifikasi */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-1">
            {/* Input No. TTB (KUNCI INTEGRASI UTAMA) */}
            <div className="relative sm:col-span-2">
              <label className="block text-xs font-semibold text-foreground mb-1 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Sparkles className="size-3.5 text-blue-500" />
                  <span>Nomor TTB (Kunci Integrasi Lapangan)</span>
                  <span className="text-rose-500">*</span>
                </span>
                {availableOptions.length > 0 && (
                  <span className="text-[10px] text-muted-foreground font-normal">
                    Tersedia {availableOptions.length} berkas referensi
                  </span>
                )}
              </label>
              <input
                type="text"
                required
                value={noTtb}
                onChange={(e) => {
                  setNoTtb(e.target.value);
                  setShowSuggestions(true);
                }}
                onFocus={() => setShowSuggestions(true)}
                placeholder="Contoh: TTB-2024-00129 atau TTB/09/2024/..."
                className="w-full h-10 px-3 rounded-lg border border-border bg-background text-foreground text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono font-medium"
              />

              {/* Autocomplete Dropdown List */}
              {showSuggestions && filteredSuggestions.length > 0 && (
                <div className="absolute left-0 right-0 top-full mt-1 bg-card border border-border rounded-xl shadow-xl z-20 max-h-48 overflow-y-auto p-1 text-xs">
                  <div className="px-2 py-1 text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">
                    Pilih Nomor TTB Terkait (Auto-fill Otomatis)
                  </div>
                  {filteredSuggestions.map((opt, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleSelectSuggestion(opt)}
                      className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-muted flex items-center justify-between transition text-foreground"
                    >
                      <div className="font-mono font-semibold text-blue-600 dark:text-blue-400">
                        {opt.noTtb}
                      </div>
                      <div className="text-[11px] text-muted-foreground truncate max-w-[200px]">
                        {opt.armada || opt.item || opt.fpb || '-'}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* PIC Lapangan */}
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1 flex items-center gap-1.5">
                <User className="size-3.5 text-muted-foreground" />
                <span>PIC Tim Lapangan</span>
              </label>
              <div className="flex gap-2">
                <select
                  value={['AGUS', 'HERY'].includes(picLapangan.toUpperCase()) ? picLapangan.toUpperCase() : 'OTHER'}
                  onChange={(e) => {
                    if (e.target.value !== 'OTHER') setPicLapangan(e.target.value);
                  }}
                  className="h-10 px-3 rounded-lg border border-border bg-background text-foreground text-xs font-semibold"
                >
                  <option value="AGUS">AGUS</option>
                  <option value="HERY">HERY</option>
                  <option value="OTHER">Lainnya...</option>
                </select>
                <input
                  type="text"
                  value={picLapangan}
                  onChange={(e) => setPicLapangan(e.target.value)}
                  placeholder="Nama PIC"
                  className="flex-1 h-10 px-3 rounded-lg border border-border bg-background text-foreground text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 uppercase"
                />
              </div>
            </div>

            {/* Tanggal Dokumentasi */}
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1 flex items-center gap-1.5">
                <Calendar className="size-3.5 text-muted-foreground" />
                <span>Tanggal Dokumentasi</span>
              </label>
              <input
                type="date"
                value={tanggal}
                onChange={(e) => setTanggal(e.target.value)}
                className="w-full h-10 px-3 rounded-lg border border-border bg-background text-foreground text-xs font-mono"
              />
            </div>

            {/* Armada / Kapal */}
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1 flex items-center gap-1.5">
                <Anchor className="size-3.5 text-muted-foreground" />
                <span>Unit Armada / Kapal (Opsional)</span>
              </label>
              <input
                type="text"
                value={armada}
                onChange={(e) => setArmada(e.target.value)}
                placeholder="Contoh: TB. CINDARA 01"
                className="w-full h-10 px-3 rounded-lg border border-border bg-background text-foreground text-xs"
              />
            </div>

            {/* No. FPB Referensi */}
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1 flex items-center gap-1.5">
                <FileText className="size-3.5 text-muted-foreground" />
                <span>No. FPB Terkait (Opsional)</span>
              </label>
              <input
                type="text"
                value={fpb}
                onChange={(e) => setFpb(e.target.value)}
                placeholder="Contoh: FPB/2024/..."
                className="w-full h-10 px-3 rounded-lg border border-border bg-background text-foreground text-xs font-mono"
              />
            </div>

            {/* No. FSTB Referensi */}
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1">
                No. FSTB Terkait (Opsional)
              </label>
              <input
                type="text"
                value={noFstb}
                onChange={(e) => setNoFstb(e.target.value)}
                placeholder="Contoh: FSTB-..."
                className="w-full h-10 px-3 rounded-lg border border-border bg-background text-foreground text-xs font-mono"
              />
            </div>

            {/* Nama Barang / Uraian */}
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1">
                Deskripsi / Nama Barang (Opsional)
              </label>
              <input
                type="text"
                value={itemDescription}
                onChange={(e) => setItemDescription(e.target.value)}
                placeholder="Contoh: Filter Oli / Sparepart..."
                className="w-full h-10 px-3 rounded-lg border border-border bg-background text-foreground text-xs"
              />
            </div>

            {/* Catatan Fisik */}
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-foreground mb-1">
                Catatan Kondisi Fisik Lapangan
              </label>
              <textarea
                rows={2}
                value={catatan}
                onChange={(e) => setCatatan(e.target.value)}
                placeholder="Tuliskan catatan kondisi kemasan, kelengkapan, dll..."
                className="w-full p-2.5 rounded-lg border border-border bg-background text-foreground text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Info Integrasi */}
          <div className="p-3 bg-muted/50 rounded-xl border border-border text-[11px] text-muted-foreground flex items-start gap-2">
            <Info className="size-4 text-blue-500 shrink-0 mt-0.5" />
            <span>
              Foto yang disimpan akan langsung terhubung ke Nomor TTB ini dan dapat dilihat dari tabel pengadaan, modal audit berkas, maupun galeri foto lapangan tanpa perlu membuka website eksternal.
            </span>
          </div>

          {/* Form Actions */}
          <div className="pt-2 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="h-9 px-4 rounded-lg border border-border bg-muted hover:bg-muted/80 text-foreground text-xs font-medium transition"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isProcessing}
              className="h-9 px-5 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-semibold flex items-center gap-2 transition shadow-xs"
            >
              {isProcessing ? (
                <>
                  <div className="size-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Menyimpan Foto...</span>
                </>
              ) : (
                <>
                  <Camera className="size-4" />
                  <span>Simpan & Integrasikan Foto</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
