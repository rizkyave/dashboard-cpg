/**
 * Opsi konfigurasi optimasi dan kompresi gambar
 */
export interface ImageOptimizationOptions {
  maxDimension?: number; // Maksimum lebar atau tinggi (default: 1920px Full HD)
  quality?: number; // Kualitas kompresi 0.1 - 1.0 (default: 0.82)
  outputFormat?: 'image/jpeg' | 'image/webp';
  maxFileSizeMb?: number; // Batas atas peringatan ukuran mentah (default: 20MB)
}

export const DEFAULT_OPTIMIZATION_SETTINGS: Required<ImageOptimizationOptions> = {
  maxDimension: 1920,
  quality: 0.82,
  outputFormat: 'image/jpeg',
  maxFileSizeMb: 25,
};

// Key LocalStorage untuk menyimpan konfigurasi kustom
export const IMAGE_OPTIMIZE_STORAGE_KEY = 'CPG_IMAGE_OPTIMIZE_SETTINGS';

/**
 * Ambil konfigurasi optimasi gambar dari LocalStorage atau default
 */
export function getImageOptimizationSettings(): Required<ImageOptimizationOptions> {
  if (typeof window === 'undefined') return DEFAULT_OPTIMIZATION_SETTINGS;
  try {
    const raw = localStorage.getItem(IMAGE_OPTIMIZE_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        maxDimension: Number(parsed.maxDimension) || DEFAULT_OPTIMIZATION_SETTINGS.maxDimension,
        quality: Number(parsed.quality) || DEFAULT_OPTIMIZATION_SETTINGS.quality,
        outputFormat: parsed.outputFormat || DEFAULT_OPTIMIZATION_SETTINGS.outputFormat,
        maxFileSizeMb: Number(parsed.maxFileSizeMb) || DEFAULT_OPTIMIZATION_SETTINGS.maxFileSizeMb,
      };
    }
  } catch {}
  return DEFAULT_OPTIMIZATION_SETTINGS;
}

/**
 * Simpan konfigurasi optimasi gambar ke LocalStorage
 */
export function saveImageOptimizationSettings(settings: ImageOptimizationOptions) {
  if (typeof window === 'undefined') return;
  try {
    const current = getImageOptimizationSettings();
    const updated = { ...current, ...settings };
    localStorage.setItem(IMAGE_OPTIMIZE_STORAGE_KEY, JSON.stringify(updated));
  } catch {}
}

export interface CompressResult {
  file: File;
  originalSize: number;
  compressedSize: number;
  savingsPercent: number;
  isCompressed: boolean;
  width: number;
  height: number;
}

/**
 * Kompresi dan scaling otomatis file foto di sisi klien (Browser HTML5 Canvas)
 * Jika file adalah PDF atau bukan gambar, file dikembalikan tanpa perubahan.
 */
export async function optimizeAndScaleImage(
  file: File,
  customOptions?: ImageOptimizationOptions
): Promise<CompressResult> {
  const originalSize = file.size;

  // Jika bukan gambar (misal PDF), kembalikan file asli
  if (!file.type.startsWith('image/')) {
    return {
      file,
      originalSize,
      compressedSize: originalSize,
      savingsPercent: 0,
      isCompressed: false,
      width: 0,
      height: 0,
    };
  }

  // Jika di serverless/Node environment tanpa window
  if (typeof window === 'undefined') {
    return {
      file,
      originalSize,
      compressedSize: originalSize,
      savingsPercent: 0,
      isCompressed: false,
      width: 0,
      height: 0,
    };
  }

  const settings = {
    ...getImageOptimizationSettings(),
    ...customOptions,
  };

  return new Promise((resolve) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);

      const origW = img.naturalWidth || img.width;
      const origH = img.naturalHeight || img.height;

      // Hitung dimensi target dengan mempertahankan rasio aspek
      let targetW = origW;
      let targetH = origH;

      if (targetW > settings.maxDimension || targetH > settings.maxDimension) {
        if (targetW >= targetH) {
          targetH = Math.round((origH * settings.maxDimension) / origW);
          targetW = settings.maxDimension;
        } else {
          targetW = Math.round((origW * settings.maxDimension) / origH);
          targetH = settings.maxDimension;
        }
      }

      // Buat canvas off-screen untuk rendering & resampling
      const canvas = document.createElement('canvas');
      canvas.width = targetW;
      canvas.height = targetH;
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        // Fallback jika context gagal dibuat
        return resolve({
          file,
          originalSize,
          compressedSize: originalSize,
          savingsPercent: 0,
          isCompressed: false,
          width: origW,
          height: origH,
        });
      }

      // Aktifkan image smoothing berkualitas tinggi
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';

      // Gambar foto dengan ukuran ter-skala
      ctx.drawImage(img, 0, 0, targetW, targetH);

      // Tentukan format output (default JPEG untuk kompatibilitas arsip surat/dokumen)
      const format = settings.outputFormat;
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            return resolve({
              file,
              originalSize,
              compressedSize: originalSize,
              savingsPercent: 0,
              isCompressed: false,
              width: origW,
              height: origH,
            });
          }

          // Jika ukuran setelah kompresi justru lebih besar dari aslinya, gunakan aslinya
          if (blob.size >= originalSize && targetW === origW && targetH === origH) {
            return resolve({
              file,
              originalSize,
              compressedSize: originalSize,
              savingsPercent: 0,
              isCompressed: false,
              width: origW,
              height: origH,
            });
          }

          // Buat nama ekstensi baru jika dikonversi
          let newName = file.name;
          if (format === 'image/jpeg' && !newName.match(/\.jpe?g$/i)) {
            newName = newName.replace(/\.[^.]+$/, '') + '.jpg';
          } else if (format === 'image/webp' && !newName.match(/\.webp$/i)) {
            newName = newName.replace(/\.[^.]+$/, '') + '.webp';
          }

          const compressedFile = new File([blob], newName, {
            type: format,
            lastModified: Date.now(),
          });

          const savingsPercent = Math.max(
            0,
            Math.round(((originalSize - blob.size) / originalSize) * 100)
          );

          resolve({
            file: compressedFile,
            originalSize,
            compressedSize: blob.size,
            savingsPercent,
            isCompressed: true,
            width: targetW,
            height: targetH,
          });
        },
        format,
        settings.quality
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      resolve({
        file,
        originalSize,
        compressedSize: originalSize,
        savingsPercent: 0,
        isCompressed: false,
        width: 0,
        height: 0,
      });
    };

    img.src = objectUrl;
  });
}

/**
 * Format ukuran byte ke string KB / MB
 */
export function formatByteSize(bytes: number): string {
  if (!bytes || bytes === 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}
