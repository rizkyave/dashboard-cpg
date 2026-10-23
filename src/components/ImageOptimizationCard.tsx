import React from 'react';
import { Camera, Save } from 'lucide-react';
import {
  getImageOptimizationSettings,
  saveImageOptimizationSettings,
} from '@/utils/imageCompressor';

interface ImageOptimizationCardProps {
  isAdmin: boolean;
  showToast?: (msg: string, type?: 'info' | 'success' | 'warning' | 'error') => void;
}

export default function ImageOptimizationCard({ isAdmin, showToast }: ImageOptimizationCardProps) {
  const [optMaxDimension, setOptMaxDimension] = React.useState<number>(1920);
  const [optQuality, setOptQuality] = React.useState<number>(0.82);
  const [optOutputFormat, setOptOutputFormat] = React.useState<'image/jpeg' | 'image/webp'>('image/jpeg');
  const [optMaxFileSizeMb, setOptMaxFileSizeMb] = React.useState<number>(25);

  React.useEffect(() => {
    const current = getImageOptimizationSettings();
    setOptMaxDimension(current.maxDimension);
    setOptQuality(current.quality);
    setOptOutputFormat(current.outputFormat);
    setOptMaxFileSizeMb(current.maxFileSizeMb);
  }, []);

  const handleSaveImageOptimization = () => {
    saveImageOptimizationSettings({
      maxDimension: optMaxDimension,
      quality: optQuality,
      outputFormat: optOutputFormat,
      maxFileSizeMb: optMaxFileSizeMb,
    });
    showToast?.('Pengaturan kompresi & auto-scaling foto berhasil disimpan!', 'success');
  };

  if (!isAdmin) return null;

  return (
    <div className="bg-card border border-border rounded-xl p-5 shadow-xs">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-4 pb-3 border-b border-border">
        <div className="flex items-center gap-2.5">
          <span className="p-2 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
            <Camera className="size-5" />
          </span>
          <div>
            <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
              <span>Pengaturan Optimasi &amp; Auto-Scaling Penyimpanan Foto</span>
              <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-blue-500/15 text-blue-700 dark:text-blue-300 border border-blue-500/30">
                Smart Compression &bull; Hemat Storage 90%
              </span>
            </h3>
            <p className="text-[11px] text-muted-foreground">
              Otomatis mengecilkan resolusi dan mengompres ukuran foto kamera HP saat diunggah pada modul FSTB dan TTB sebelum dikirim ke Cloudflare R2 / Server, sehingga menghemat ruang penyimpanan dan mempercepat loading.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleSaveImageOptimization}
          className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-xs cursor-pointer self-start md:self-auto"
        >
          <Save className="size-3.5" />
          <span>Simpan Aturan Foto</span>
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div>
          <label className="block text-xs font-semibold text-foreground mb-1">
            Batas Dimensi Maksimal (Scaling)
          </label>
          <select
            value={optMaxDimension}
            onChange={(e) => setOptMaxDimension(Number(e.target.value))}
            className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground text-xs focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
          >
            <option value={1280}>1280 px (Hemat Ekstrem - ~200 KB)</option>
            <option value={1600}>1600 px (Rekomendasi Cepat - ~350 KB)</option>
            <option value={1920}>1920 px (Full HD - Standar ~500 KB)</option>
            <option value={2560}>2560 px (2K Ultra Tajam - ~900 KB)</option>
            <option value={4096}>4096 px (Ukuran Asli / Tanpa Scaling)</option>
          </select>
          <p className="text-[10px] text-muted-foreground mt-1">
            Lebar/tinggi foto yang melebihi batas ini otomatis diperkecil proporsional.
          </p>
        </div>

        <div>
          <label className="block text-xs font-semibold text-foreground mb-1">
            Kualitas Kompresi ({Math.round(optQuality * 100)}%)
          </label>
          <select
            value={optQuality}
            onChange={(e) => setOptQuality(Number(e.target.value))}
            className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground text-xs focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
          >
            <option value={0.70}>70% (Kompresi Tinggi - File Sangat Kecil)</option>
            <option value={0.80}>80% (Keseimbangan Terbaik)</option>
            <option value={0.82}>82% (Rekomendasi Sistem CPG)</option>
            <option value={0.90}>90% (Kualitas Mendekati Sempurna)</option>
            <option value={0.95}>95% (Kompresi Minimal)</option>
          </select>
          <p className="text-[10px] text-muted-foreground mt-1">
            Kualitas visual 80-85% menjaga teks surat jalan tetap sangat tajam dan jelas.
          </p>
        </div>

        <div>
          <label className="block text-xs font-semibold text-foreground mb-1">
            Format Output Kompresi
          </label>
          <select
            value={optOutputFormat}
            onChange={(e) => setOptOutputFormat(e.target.value as any)}
            className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground text-xs focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
          >
            <option value="image/jpeg">JPEG (.jpg) - Universal &amp; Paling Kompatibel</option>
            <option value="image/webp">WebP (.webp) - Modern &amp; Lebih Hemat 25%</option>
          </select>
          <p className="text-[10px] text-muted-foreground mt-1">
            Format standar untuk menyimpan berkas foto serah terima.
          </p>
        </div>

        <div>
          <label className="block text-xs font-semibold text-foreground mb-1">
            Batas Maksimum Ukuran Mentah
          </label>
          <select
            value={optMaxFileSizeMb}
            onChange={(e) => setOptMaxFileSizeMb(Number(e.target.value))}
            className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground text-xs focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
          >
            <option value={10}>10 MB per berkas</option>
            <option value={20}>20 MB per berkas</option>
            <option value={25}>25 MB (Bawaan)</option>
            <option value={50}>50 MB per berkas</option>
          </select>
          <p className="text-[10px] text-muted-foreground mt-1">
            Mencegah upload file yang terlalu besar sebelum proses scaling.
          </p>
        </div>
      </div>
    </div>
  );
}

