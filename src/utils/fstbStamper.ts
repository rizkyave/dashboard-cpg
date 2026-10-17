import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

export type FstbStampRoleType =
  | 'purchasing' // alias for delivered_by
  | 'logistic' // alias for received_by
  | 'delivered_by' // Delivered By: Purchasing Staff (Kolom 1)
  | 'received_by' // Received By: Logistic Staff (Kolom 2)
  | 'approved_by' // Approved By: Purchasing Supervisor (Kolom 3)
  | 'acknowledged_by' // Acknowledged By: Logistic Supervisor (Kolom 4)
  | 'purchasing_staff'
  | 'logistic_staff'
  | 'purchasing_spv'
  | 'logistic_spv';

export interface StampFstbOptions {
  pdfBuffer: Buffer | Uint8Array;
  signatureDataUrl?: string; // PNG or JPEG base64 Data URL
  uploaderName: string;
  uploadDate: string;
  roleType?: FstbStampRoleType;
  verificationToken?: string;
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
 * Tanda tangan ditempatkan pada halaman TERAKHIR (lembar tanda tangan halaman 2).
 */
export const FSTB_DELIVERED_BY_COORDINATES = {
  // Delivered By : Purchasing Staff (Kolom 1)
  sigXRatio: 0.075,
  sigYRatio: 0.178,
  sigWidthRatio: 0.145,
  sigHeightRatio: 0.082,
  nameXRatio: 0.095,
  nameYRatio: 0.135,
  dateXRatio: 0.090,
  dateYRatio: 0.108,
};

export const FSTB_RECEIVED_BY_COORDINATES = {
  // Received By : Logistic Staff (Kolom 2)
  sigXRatio: 0.280,
  sigYRatio: 0.178,
  sigWidthRatio: 0.145,
  sigHeightRatio: 0.082,
  nameXRatio: 0.300,
  nameYRatio: 0.135,
  dateXRatio: 0.295,
  dateYRatio: 0.108,
};

export const FSTB_APPROVED_BY_COORDINATES = {
  // Approved By : Purchasing Supervisor (Kolom 3)
  sigXRatio: 0.505,
  sigYRatio: 0.178,
  sigWidthRatio: 0.145,
  sigHeightRatio: 0.082,
  nameXRatio: 0.525,
  nameYRatio: 0.135,
  dateXRatio: 0.520,
  dateYRatio: 0.108,
};

export const FSTB_ACKNOWLEDGED_BY_COORDINATES = {
  // Acknowledged By : Logistic Supervisor (Kolom 4)
  sigXRatio: 0.725,
  sigYRatio: 0.178,
  sigWidthRatio: 0.145,
  sigHeightRatio: 0.082,
  nameXRatio: 0.745,
  nameYRatio: 0.135,
  dateXRatio: 0.740,
  dateYRatio: 0.108,
};

// Aliases for backwards compatibility
export const FSTB_PURCHASING_COORDINATES = FSTB_DELIVERED_BY_COORDINATES;
export const FSTB_LOGISTIC_COORDINATES = FSTB_RECEIVED_BY_COORDINATES;

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
    roleType = 'delivered_by',
    verificationToken,
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

  let baseCoords = FSTB_DELIVERED_BY_COORDINATES;
  if (roleType === 'received_by' || roleType === 'logistic' || roleType === 'logistic_staff') {
    baseCoords = FSTB_RECEIVED_BY_COORDINATES;
  } else if (roleType === 'approved_by' || roleType === 'purchasing_spv') {
    baseCoords = FSTB_APPROVED_BY_COORDINATES;
  } else if (roleType === 'acknowledged_by' || roleType === 'logistic_spv') {
    baseCoords = FSTB_ACKNOWLEDGED_BY_COORDINATES;
  }

  const sigXRatio = customCoordinates?.sigXRatio ?? baseCoords.sigXRatio;
  const sigYRatio = customCoordinates?.sigYRatio ?? baseCoords.sigYRatio;
  const sigWidthRatio = customCoordinates?.sigWidthRatio ?? baseCoords.sigWidthRatio;
  const sigHeightRatio = customCoordinates?.sigHeightRatio ?? baseCoords.sigHeightRatio;
  const nameXRatio = customCoordinates?.nameXRatio ?? baseCoords.nameXRatio;
  const nameYRatio = customCoordinates?.nameYRatio ?? baseCoords.nameYRatio;
  const dateXRatio = customCoordinates?.dateXRatio ?? baseCoords.dateXRatio;
  const dateYRatio = customCoordinates?.dateYRatio ?? baseCoords.dateYRatio;

  const sigX = sigXRatio * pageWidth;
  const sigY = sigYRatio * pageHeight;
  const sigW = sigWidthRatio * pageWidth;
  const sigH = sigHeightRatio * pageHeight;

  // 1. Sematkan Gambar Tanda Tangan Digital atau Cap Verifikasi Hash
  let hasEmbeddedImage = false;
  if (signatureDataUrl && (signatureDataUrl.startsWith('data:image/png') || signatureDataUrl.startsWith('data:image/jpeg') || signatureDataUrl.startsWith('data:image/jpg'))) {
    try {
      const isPng = signatureDataUrl.startsWith('data:image/png');
      const base64Data = signatureDataUrl.replace(/^data:image\/[a-zA-Z]+;base64,/, '');
      const imgBytes = Buffer.from(base64Data, 'base64');

      const embeddedImage = isPng ? await pdfDoc.embedPng(imgBytes) : await pdfDoc.embedJpg(imgBytes);

      targetPage.drawImage(embeddedImage, {
        x: sigX,
        y: sigY,
        width: sigW,
        height: sigH,
      });
      hasEmbeddedImage = true;
    } catch (sigErr) {
      console.warn('Gagal menyematkan tanda tangan ke PDF FSTB, beralih ke cap digital:', sigErr);
    }
  }

  if (!hasEmbeddedImage) {
    // Gambar cap digital stempel verifikasi profesional langsung di atas kotak tanda tangan
    try {
      const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
      const fontNorm = await pdfDoc.embedFont(StandardFonts.Helvetica);

      targetPage.drawRectangle({
        x: sigX,
        y: sigY,
        width: sigW,
        height: sigH,
        color: rgb(0.96, 0.99, 0.97),
        borderColor: rgb(0.05, 0.55, 0.28),
        borderWidth: 1.2,
      });

      targetPage.drawText('✓ VALIDASI DIGITAL', {
        x: sigX + 4,
        y: sigY + sigH - 10,
        size: 6.5,
        font: fontBold,
        color: rgb(0.05, 0.55, 0.28),
      });

      const displayName = (uploaderName || 'PETUGAS CPG').slice(0, 18).toUpperCase();
      targetPage.drawText(displayName, {
        x: sigX + 4,
        y: sigY + sigH - 18,
        size: 6,
        font: fontBold,
        color: rgb(0.09, 0.14, 0.23),
      });

      const tokenText = (verificationToken || `VAL-FSTB-${Date.now().toString(36).toUpperCase()}`).slice(0, 20);
      targetPage.drawText(tokenText, {
        x: sigX + 4,
        y: sigY + 5,
        size: 5,
        font: fontNorm,
        color: rgb(0.35, 0.45, 0.55),
      });
    } catch (sealErr) {
      console.warn('Gagal membubuhkan cap digital verifikasi:', sealErr);
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
