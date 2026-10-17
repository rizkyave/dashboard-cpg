import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

export interface StampTtbOptions {
  pdfBuffer: Buffer | Uint8Array;
  signatureDataUrl?: string; // PNG or JPEG base64 Data URL
  uploaderName: string;
  uploadDate: string;
  // Opsi custom koordinat jika diperlukan di masa depan
  customCoordinates?: {
    sigXRatio?: number;
    sigYRatio?: number;
    sigWidthRatio?: number;
    sigHeightRatio?: number;
    nameXRatio?: number;
    nameYRatio?: number;
    dateXRatio?: number;
    dateYRatio?: number;
  };
}

/**
 * Rasio koordinat standar untuk formulir TTB resmi CPG (CPL-PRC-SOP-004-F02)
 * Koordinat dihitung dari kiri-bawah (standard PDF coordinate system)
 */
export const DEFAULT_TTB_COORDINATES = {
  // Kotak Tanda Tangan (Delivered By : Logistic Staff)
  sigXRatio: 0.082,
  sigYRatio: 0.235,
  sigWidthRatio: 0.141,
  sigHeightRatio: 0.088,

  // Kotak Teks Nama (Name : [NAMA UPLOADER])
  nameXRatio: 0.126,
  nameYRatio: 0.155,

  // Kotak Teks Tanggal (Date : [DD/MM/YYYY])
  dateXRatio: 0.126,
  dateYRatio: 0.115,
};

/**
 * Rasio koordinat untuk kolom Penerima Barang (Received By : User)
 * Pada formulir TTB resmi CPG (CPL-PRC-SOP-004-F02)
 */
export const TTB_RECIPIENT_COORDINATES = {
  // Kotak Tanda Tangan (Received By : User)
  sigXRatio: 0.312,
  sigYRatio: 0.235,
  sigWidthRatio: 0.141,
  sigHeightRatio: 0.088,

  // Kotak Teks Nama (Name : [NAMA PENERIMA AKHIR])
  nameXRatio: 0.378,
  nameYRatio: 0.155,

  // Kotak Teks Tanggal (Date : [DD/MM/YYYY])
  dateXRatio: 0.378,
  dateYRatio: 0.115,
};

/**
 * Format tanggal Indonesia ringkas (DD/MM/YYYY)
 */
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

/**
 * Stempel Tanda Tangan Digital, Nama Uploader, dan Tanggal pada Dokumen PDF TTB
 */
export async function stampTtbPdf(options: StampTtbOptions): Promise<Buffer> {
  const {
    pdfBuffer,
    signatureDataUrl,
    uploaderName,
    uploadDate,
    customCoordinates = {},
  } = options;

  const pdfDoc = await PDFDocument.load(pdfBuffer);
  const pages = pdfDoc.getPages();
  if (pages.length === 0) {
    throw new Error('Dokumen PDF tidak memiliki halaman.');
  }

  // Gunakan halaman pertama untuk stempel TTB
  const firstPage = pages[0];
  const { width: pageWidth, height: pageHeight } = firstPage.getSize();

  const coords = {
    ...DEFAULT_TTB_COORDINATES,
    ...customCoordinates,
  };

  // 1. Sematkan Gambar Tanda Tangan Digital (jika ada)
  if (signatureDataUrl && signatureDataUrl.startsWith('data:image/')) {
    try {
      const isPng = signatureDataUrl.startsWith('data:image/png');
      const isJpg =
        signatureDataUrl.startsWith('data:image/jpeg') ||
        signatureDataUrl.startsWith('data:image/jpg');

      const base64Index = signatureDataUrl.indexOf('base64,');
      if (base64Index !== -1 && (isPng || isJpg)) {
        const base64Data = signatureDataUrl.substring(base64Index + 7);
        const imageBytes = Buffer.from(base64Data, 'base64');

        const embeddedImage = isPng
          ? await pdfDoc.embedPng(imageBytes)
          : await pdfDoc.embedJpg(imageBytes);

        const sigX = coords.sigXRatio * pageWidth;
        const sigY = coords.sigYRatio * pageHeight;
        const sigW = coords.sigWidthRatio * pageWidth;
        const sigH = coords.sigHeightRatio * pageHeight;

        firstPage.drawImage(embeddedImage, {
          x: sigX,
          y: sigY,
          width: sigW,
          height: sigH,
        });
      }
    } catch (sigErr) {
      console.warn('Gagal menyematkan spesimen tanda tangan ke PDF:', sigErr);
      // Tetap lanjutkan untuk membubuhkan Nama & Tanggal
    }
  }

  // 2. Sematkan Teks Nama Lengkap dan Tanggal
  try {
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const fontNorm = await pdfDoc.embedFont(StandardFonts.Helvetica);

    // Ukuran font proporsional terhadap tinggi halaman (standar ~7.5 pt untuk tinggi ~400 pt)
    const fontSize = Math.max(6.5, Math.min(9.5, pageHeight * 0.019));

    // Nama Uploader
    if (uploaderName && uploaderName.trim()) {
      const cleanName = uploaderName.trim().toUpperCase();
      const nameX = coords.nameXRatio * pageWidth;
      const nameY = coords.nameYRatio * pageHeight;

      firstPage.drawText(cleanName, {
        x: nameX,
        y: nameY,
        size: fontSize,
        font: fontBold,
        color: rgb(0, 0, 0),
      });
    }

    // Tanggal Upload
    if (uploadDate && uploadDate.trim()) {
      const cleanDate = uploadDate.trim();
      const dateX = coords.dateXRatio * pageWidth;
      const dateY = coords.dateYRatio * pageHeight;

      firstPage.drawText(cleanDate, {
        x: dateX,
        y: dateY,
        size: fontSize,
        font: fontNorm,
        color: rgb(0, 0, 0),
      });
    }
  } catch (textErr) {
    console.warn('Gagal menulis teks nama/tanggal ke PDF:', textErr);
  }

  const modifiedBytes = await pdfDoc.save();
  return Buffer.from(modifiedBytes);
}

export interface StampTtbRecipientOptions {
  pdfBuffer: Buffer | Uint8Array;
  recipientSignatureDataUrl?: string; // PNG or JPEG base64 Data URL
  recipientName: string;
  receiptDate: string;
  customCoordinates?: {
    sigXRatio?: number;
    sigYRatio?: number;
    sigWidthRatio?: number;
    sigHeightRatio?: number;
    nameXRatio?: number;
    nameYRatio?: number;
    dateXRatio?: number;
    dateYRatio?: number;
  };
}

/**
 * Stempel Tanda Tangan Digital, Nama, dan Tanggal Penerima Barang (Received By : User)
 * Pada Dokumen PDF TTB Resmi
 */
export async function stampTtbRecipientPdf(options: StampTtbRecipientOptions): Promise<Buffer> {
  const {
    pdfBuffer,
    recipientSignatureDataUrl,
    recipientName,
    receiptDate,
    customCoordinates = {},
  } = options;

  const pdfDoc = await PDFDocument.load(pdfBuffer);
  const pages = pdfDoc.getPages();
  if (pages.length === 0) {
    throw new Error('Dokumen PDF tidak memiliki halaman.');
  }

  const firstPage = pages[0];
  const { width: pageWidth, height: pageHeight } = firstPage.getSize();

  const coords = {
    ...TTB_RECIPIENT_COORDINATES,
    ...customCoordinates,
  };

  // 1. Sematkan Gambar Tanda Tangan Digital Penerima Akhir
  if (recipientSignatureDataUrl && recipientSignatureDataUrl.startsWith('data:image/')) {
    try {
      const isPng = recipientSignatureDataUrl.startsWith('data:image/png');
      const isJpg =
        recipientSignatureDataUrl.startsWith('data:image/jpeg') ||
        recipientSignatureDataUrl.startsWith('data:image/jpg');

      const base64Index = recipientSignatureDataUrl.indexOf('base64,');
      if (base64Index !== -1 && (isPng || isJpg)) {
        const base64Data = recipientSignatureDataUrl.substring(base64Index + 7);
        const imageBytes = Buffer.from(base64Data, 'base64');

        const embeddedImage = isPng
          ? await pdfDoc.embedPng(imageBytes)
          : await pdfDoc.embedJpg(imageBytes);

        const sigX = coords.sigXRatio * pageWidth;
        const sigY = coords.sigYRatio * pageHeight;
        const sigW = coords.sigWidthRatio * pageWidth;
        const sigH = coords.sigHeightRatio * pageHeight;

        firstPage.drawImage(embeddedImage, {
          x: sigX,
          y: sigY,
          width: sigW,
          height: sigH,
        });
      }
    } catch (sigErr) {
      console.warn('Gagal menyematkan tanda tangan penerima ke PDF:', sigErr);
    }
  }

  // 2. Sematkan Teks Nama Lengkap Penerima dan Tanggal Serah Terima
  try {
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const fontNorm = await pdfDoc.embedFont(StandardFonts.Helvetica);

    const fontSize = Math.max(6.5, Math.min(9.5, pageHeight * 0.019));

    // Nama Penerima Barang
    if (recipientName && recipientName.trim()) {
      const cleanName = recipientName.trim().toUpperCase();
      const nameX = coords.nameXRatio * pageWidth;
      const nameY = coords.nameYRatio * pageHeight;

      firstPage.drawText(cleanName, {
        x: nameX,
        y: nameY,
        size: fontSize,
        font: fontBold,
        color: rgb(0, 0, 0),
      });
    }

    // Tanggal Penerimaan
    if (receiptDate && receiptDate.trim()) {
      const cleanDate = receiptDate.trim();
      const dateX = coords.dateXRatio * pageWidth;
      const dateY = coords.dateYRatio * pageHeight;

      firstPage.drawText(cleanDate, {
        x: dateX,
        y: dateY,
        size: fontSize,
        font: fontNorm,
        color: rgb(0, 0, 0),
      });
    }
  } catch (textErr) {
    console.warn('Gagal menulis teks penerima ke PDF:', textErr);
  }

  const modifiedBytes = await pdfDoc.save();
  return Buffer.from(modifiedBytes);
}

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

        const fontSize = Math.max(10, Math.round(img.height * 0.019));

        const drawTextDetails = () => {
          ctx.fillStyle = '#000000';

          if (uploaderName) {
            ctx.font = `bold ${fontSize}px Helvetica, Arial, sans-serif`;
            ctx.fillText(uploaderName.trim().toUpperCase(), nameX, nameY);
          }

          if (uploadDate) {
            ctx.font = `normal ${fontSize}px Helvetica, Arial, sans-serif`;
            ctx.fillText(uploadDate.trim(), dateX, dateY);
          }

          canvas.toBlob(
            (blob) => {
              if (!blob) return resolve(imageFile);
              const stamped = new File([blob], imageFile.name, {
                type: imageFile.type || 'image/jpeg',
                lastModified: Date.now(),
              });
              resolve(stamped);
            },
            imageFile.type || 'image/jpeg',
            0.96
          );
        };

        if (signaturePngDataUrl) {
          const sigImg = new Image();
          sigImg.onload = () => {
            ctx.drawImage(sigImg, sigX, sigY, sigW, sigH);
            drawTextDetails();
          };
          sigImg.onerror = () => drawTextDetails();
          sigImg.src = signaturePngDataUrl;
        } else {
          drawTextDetails();
        }
      } catch (err) {
        console.warn('Gagal stempel gambar TTB:', err);
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

