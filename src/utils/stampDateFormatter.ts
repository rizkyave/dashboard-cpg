/**
 * Helper format tanggal stempel FSTB & TTB (Client-safe, tanpa dependensi server)
 */

export function formatFstbStampDate(dateInput?: string | Date): string {
  if (!dateInput) {
    const now = new Date();
    const d = String(now.getDate()).padStart(2, '0');
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const y = now.getFullYear();
    return `${d}/${m}/${y}`;
  }

  const dObj = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
  if (isNaN(dObj.getTime())) {
    return String(dateInput);
  }
  const d = String(dObj.getDate()).padStart(2, '0');
  const m = String(dObj.getMonth() + 1).padStart(2, '0');
  const y = dObj.getFullYear();
  return `${d}/${m}/${y}`;
}

export function formatTtbStampDate(dateInput?: string | Date): string {
  if (!dateInput) {
    const now = new Date();
    const d = String(now.getDate()).padStart(2, '0');
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const y = now.getFullYear();
    return `${d}/${m}/${y}`;
  }

  const dObj = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
  if (isNaN(dObj.getTime())) {
    return String(dateInput);
  }
  const d = String(dObj.getDate()).padStart(2, '0');
  const m = String(dObj.getMonth() + 1).padStart(2, '0');
  const y = dObj.getFullYear();
  return `${d}/${m}/${y}`;
}

export const DEFAULT_TTB_COORDINATES = {
  sigXRatio: 0.05,
  sigYRatio: 0.16,
  sigWidthRatio: 0.18,
  sigHeightRatio: 0.08,
  nameXRatio: 0.05,
  nameYRatio: 0.13,
  dateXRatio: 0.05,
  dateYRatio: 0.10,
};

/**
 * Konversi SVG Data URL menjadi PNG Data URL melalui browser canvas
 * (Dipanggil di sisi klien sebelum pengunggahan berkas)
 */
export async function convertSvgToPngDataUrl(
  svgDataUrl: string,
  width = 300,
  height = 100
): Promise<string> {
  if (typeof window === 'undefined') return svgDataUrl;
  if (svgDataUrl.startsWith('data:image/png;base64,')) return svgDataUrl;

  return new Promise((resolve) => {
    try {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.clearRect(0, 0, width, height);
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/png'));
        } else {
          resolve(svgDataUrl);
        }
      };
      img.onerror = () => resolve(svgDataUrl);
      img.src = svgDataUrl;
    } catch {
      resolve(svgDataUrl);
    }
  });
}

/**
 * Stempel Tanda Tangan Digital pada Berkas Gambar (JPG/PNG) di sisi klien
 */
export async function stampTtbImageFile({
  imageFile,
  signaturePngDataUrl,
  uploaderName,
  uploadDate,
}: {
  imageFile: File;
  signaturePngDataUrl?: string;
  uploaderName: string;
  uploadDate: string;
}): Promise<File> {
  if (typeof window === 'undefined') return imageFile;

  return new Promise((resolve) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(imageFile);

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      try {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return resolve(imageFile);

        // Gambar dasar dokumen TTB
        ctx.drawImage(img, 0, 0);

        // Koordinat gambar (asal koordinat kiri-atas)
        const sigX = img.width * DEFAULT_TTB_COORDINATES.sigXRatio;
        const sigY = img.height * (1 - DEFAULT_TTB_COORDINATES.sigYRatio - DEFAULT_TTB_COORDINATES.sigHeightRatio);
        const sigW = img.width * DEFAULT_TTB_COORDINATES.sigWidthRatio;
        const sigH = img.height * DEFAULT_TTB_COORDINATES.sigHeightRatio;

        const nameX = img.width * DEFAULT_TTB_COORDINATES.nameXRatio;
        const nameY = img.height * (1 - DEFAULT_TTB_COORDINATES.nameYRatio);

        const dateX = img.width * DEFAULT_TTB_COORDINATES.dateXRatio;
        const dateY = img.height * (1 - DEFAULT_TTB_COORDINATES.dateYRatio);

        const baseFontSize = Math.max(12, Math.min(22, Math.round(img.height * 0.016)));

        const drawStampOverlay = () => {
          ctx.font = `bold ${baseFontSize}px monospace, sans-serif`;
          ctx.fillStyle = '#0f172a';
          ctx.fillText(uploaderName.trim().toUpperCase(), nameX, nameY);

          ctx.font = `${Math.round(baseFontSize * 0.9)}px monospace, sans-serif`;
          ctx.fillStyle = '#334155';
          ctx.fillText(uploadDate.trim(), dateX, dateY);

          canvas.toBlob((blob) => {
            if (!blob) return resolve(imageFile);
            const stamped = new File([blob], imageFile.name, {
              type: imageFile.type || 'image/jpeg',
              lastModified: Date.now(),
            });
            resolve(stamped);
          }, imageFile.type || 'image/jpeg', 0.92);
        };

        if (signaturePngDataUrl) {
          const sigImg = new Image();
          sigImg.onload = () => {
            ctx.drawImage(sigImg, sigX, sigY, sigW, sigH);
            drawStampOverlay();
          };
          sigImg.onerror = () => drawStampOverlay();
          sigImg.src = signaturePngDataUrl;
        } else {
          drawStampOverlay();
        }
      } catch {
        resolve(imageFile);
      }
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(imageFile);
    };

    img.src = objectUrl;
  });
}

