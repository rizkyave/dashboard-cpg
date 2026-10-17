import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

export interface StampFstbOptions {
  pdfBuffer: Buffer | Uint8Array;
  signatureDataUrl?: string; // PNG or JPEG base64 Data URL
  uploaderName: string;
  uploadDate: string;
  roleType?: 'purchasing' | 'logistic'; // Default purchasing (Delivered By) atau logistic (Received By)
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
 * Koordinat standar tanda tangan pada formulir FSTB resmi CPG (CPL-PRC-SOP-001-F03)
 * Tanda tangan ditempatkan pada halaman TERAKHIR (lembar tanda tangan).
 */
export const FSTB_PURCHASING_COORDINATES = {
  // Delivered By : Purchasing Staff (Kolom 1)
  sigXRatio: 0.080,
  sigYRatio: 0.180,
  sigWidthRatio: 0.140,
  sigHeightRatio: 0.080,
  nameXRatio: 0.115,
  nameYRatio: 0.138,
  dateXRatio: 0.115,
  dateYRatio: 0.112,
};

export const FSTB_LOGISTIC_COORDINATES = {
  // Received By : Logistic Staff (Kolom 2)
  sigXRatio: 0.280,
  sigYRatio: 0.180,
  sigWidthRatio: 0.140,
  sigHeightRatio: 0.080,
  nameXRatio: 0.335,
  nameYRatio: 0.138,
  dateXRatio: 0.335,
  dateYRatio: 0.112,
};

export function formatFstbStampDate(dateInput?: string | Date): string {
  if (!dateInput) {
    const now = new Date();
    const d = String(now.getDate()).padStart(2, '0');
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const y = now.getFullYear();
    return `${d}/${m}/${y}`;
  }

  if (dateInput instanceof Date) {
    const d = String(dateInput.getDate()).padStart(2, '0');
    const m = String(dateInput.getMonth() + 1).padStart(2, '0');
    const y = dateInput.getFullYear();
    return `${d}/${m}/${y}`;
  }

  const s = String(dateInput).trim();
  const mIso = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (mIso) {
    const [, yyyy, mm, dd] = mIso;
    return `${dd.padStart(2, '0')}/${mm.padStart(2, '0')}/${yyyy}`;
  }

  const mSlash = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/);
  if (mSlash) {
    const [, dd, mm, yyyy] = mSlash;
    return `${dd.padStart(2, '0')}/${mm.padStart(2, '0')}/${yyyy}`;
  }

  return s;
}

/**
 * Stempel Tanda Tangan Digital & Identitas pada Dokumen PDF FSTB Resmi CPG
 */
export async function stampFstbPdf(options: StampFstbOptions): Promise<Buffer> {
  const {
    pdfBuffer,
    signatureDataUrl,
    uploaderName,
    uploadDate,
    roleType = 'purchasing',
    customCoordinates,
  } = options;

  const pdfDoc = await PDFDocument.load(pdfBuffer, { ignoreEncryption: true });
  const pages = pdfDoc.getPages();
  if (pages.length === 0) {
    throw new Error('Dokumen PDF FSTB tidak memiliki halaman.');
  }

  // Tanda tangan FSTB selalu berada di halaman terakhir (Page 2 dari 2)
  const targetPage = pages[pages.length - 1];
  const { width: pageWidth, height: pageHeight } = targetPage.getSize();

  const baseCoords =
    roleType === 'logistic' ? FSTB_LOGISTIC_COORDINATES : FSTB_PURCHASING_COORDINATES;

  const sigXRatio = customCoordinates?.sigXRatio ?? baseCoords.sigXRatio;
  const sigYRatio = customCoordinates?.sigYRatio ?? baseCoords.sigYRatio;
  const sigWidthRatio = customCoordinates?.sigWidthRatio ?? baseCoords.sigWidthRatio;
  const sigHeightRatio = customCoordinates?.sigHeightRatio ?? baseCoords.sigHeightRatio;
  const nameXRatio = customCoordinates?.nameXRatio ?? baseCoords.nameXRatio;
  const nameYRatio = customCoordinates?.nameYRatio ?? baseCoords.nameYRatio;
  const dateXRatio = customCoordinates?.dateXRatio ?? baseCoords.dateXRatio;
  const dateYRatio = customCoordinates?.dateYRatio ?? baseCoords.dateYRatio;

  // 1. Sematkan Gambar Tanda Tangan Digital jika ada
  if (signatureDataUrl && signatureDataUrl.startsWith('data:image/')) {
    try {
      const isPng = signatureDataUrl.startsWith('data:image/png');
      const base64Data = signatureDataUrl.replace(/^data:image\/[a-zA-Z]+;base64,/, '');
      const imgBytes = Buffer.from(base64Data, 'base64');

      let embeddedImage;
      if (isPng) {
        embeddedImage = await pdfDoc.embedPng(imgBytes);
      } else {
        embeddedImage = await pdfDoc.embedJpg(imgBytes);
      }

      const sigX = sigXRatio * pageWidth;
      const sigY = sigYRatio * pageHeight;
      const sigW = sigWidthRatio * pageWidth;
      const sigH = sigHeightRatio * pageHeight;

      targetPage.drawImage(embeddedImage, {
        x: sigX,
        y: sigY,
        width: sigW,
        height: sigH,
      });
    } catch (sigErr) {
      console.warn('Gagal menyematkan tanda tangan ke PDF FSTB:', sigErr);
    }
  }

  // 2. Sematkan Teks Nama & Tanggal
  try {
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const fontNorm = await pdfDoc.embedFont(StandardFonts.Helvetica);

    const isLandscape = pageWidth >= pageHeight;
    const baseFontSize = isLandscape ? pageHeight * 0.020 : pageWidth * 0.020;
    const fontSize = Math.max(7, Math.min(9.5, baseFontSize));

    if (uploaderName && uploaderName.trim()) {
      const cleanName = uploaderName.trim().toUpperCase();
      const nameX = nameXRatio * pageWidth;
      const nameY = nameYRatio * pageHeight;

      targetPage.drawText(cleanName, {
        x: nameX,
        y: nameY,
        size: fontSize,
        font: fontBold,
        color: rgb(0, 0, 0),
      });
    }

    if (uploadDate && uploadDate.trim()) {
      const cleanDate = uploadDate.trim();
      const dateX = dateXRatio * pageWidth;
      const dateY = dateYRatio * pageHeight;

      targetPage.drawText(cleanDate, {
        x: dateX,
        y: dateY,
        size: fontSize,
        font: fontNorm,
        color: rgb(0, 0, 0),
      });
    }
  } catch (textErr) {
    console.warn('Gagal menulis teks pada PDF FSTB:', textErr);
  }

  const modifiedBytes = await pdfDoc.save();
  return Buffer.from(modifiedBytes);
}
