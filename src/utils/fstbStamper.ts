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
  // Form Geometry: Label y=134.5, Line y=98.5, Role y=86.5, Name y=74.5, Date y=61.5
  sigXRatio: 0.0651,      // x = 39 pt (aligns with Delivered By text & line)
  sigYRatio: 0.2394,      // y = 101.5 pt (sits 3pt cleanly above signature line y=98.5)
  sigWidthRatio: 0.1469,  // width = 88 pt
  sigHeightRatio: 0.0708, // height = 30 pt (top at y=131.5, below label y=134.5)
  nameXRatio: 0.1336,     // x = 80 pt (right after 'Name :' label)
  nameYRatio: 0.1757,     // y = 74.5 pt (on 'Name :' baseline)
  dateXRatio: 0.1336,     // x = 80 pt (right after 'Date :' label)
  dateYRatio: 0.1450,     // y = 61.5 pt (on 'Date :' baseline)
};

export const FSTB_RECEIVED_BY_COORDINATES = {
  // Received By : Logistic Staff (Kolom 2)
  sigXRatio: 0.3005,      // x = 180 pt
  sigYRatio: 0.2394,      // y = 101.5 pt
  sigWidthRatio: 0.1469,  // width = 88 pt
  sigHeightRatio: 0.0708, // height = 30 pt
  nameXRatio: 0.3673,     // x = 220 pt (right after 'Name :' label)
  nameYRatio: 0.1757,     // y = 74.5 pt
  dateXRatio: 0.3673,     // x = 220 pt (right after 'Date :' label)
  dateYRatio: 0.1450,     // y = 61.5 pt
};

export const FSTB_APPROVED_BY_COORDINATES = {
  // Approved By : Purchasing Supervisor (Kolom 3)
  sigXRatio: 0.5326,      // x = 319 pt
  sigYRatio: 0.2394,      // y = 101.5 pt
  sigWidthRatio: 0.1469,  // width = 88 pt
  sigHeightRatio: 0.0708, // height = 30 pt
  nameXRatio: 0.6010,     // x = 360 pt (right after 'Name :' label)
  nameYRatio: 0.1757,     // y = 74.5 pt
  dateXRatio: 0.6010,     // x = 360 pt (right after 'Date :' label)
  dateYRatio: 0.1450,     // y = 61.5 pt
};

export const FSTB_ACKNOWLEDGED_BY_COORDINATES = {
  // Acknowledged By : Logistic Supervisor (Kolom 4)
  sigXRatio: 0.7596,      // x = 455 pt
  sigYRatio: 0.2394,      // y = 101.5 pt
  sigWidthRatio: 0.1469,  // width = 88 pt
  sigHeightRatio: 0.0708, // height = 30 pt
  nameXRatio: 0.8264,     // x = 495 pt (right after 'Name :' label)
  nameYRatio: 0.1757,     // y = 74.5 pt
  dateXRatio: 0.8264,     // x = 495 pt (right after 'Date :' label)
  dateYRatio: 0.1450,     // y = 61.5 pt
};

// Aliases for backwards compatibility
export const FSTB_PURCHASING_COORDINATES = FSTB_DELIVERED_BY_COORDINATES;
export const FSTB_LOGISTIC_COORDINATES = FSTB_RECEIVED_BY_COORDINATES;

export { formatFstbStampDate } from './stampDateFormatter';

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
  if (signatureDataUrl && typeof signatureDataUrl === 'string') {
    try {
      let imgBytes: Buffer | null = null;
      let isPng = true;

      if (signatureDataUrl.startsWith('data:image/png;base64,')) {
        imgBytes = Buffer.from(signatureDataUrl.replace(/^data:image\/png;base64,/, ''), 'base64');
        isPng = true;
      } else if (signatureDataUrl.startsWith('data:image/jpeg;base64,') || signatureDataUrl.startsWith('data:image/jpg;base64,')) {
        imgBytes = Buffer.from(signatureDataUrl.replace(/^data:image\/jpe?g;base64,/, ''), 'base64');
        isPng = false;
      } else {
        // Konversi SVG/WebP atau format lain via sharp secara dinamis (server-side safe)
        try {
          const sharpModule = await import('sharp');
          const sharp = sharpModule.default || sharpModule;
          if (signatureDataUrl.startsWith('data:image/svg+xml')) {
            let svgStr = '';
            if (signatureDataUrl.includes(';base64,')) {
              svgStr = Buffer.from(signatureDataUrl.split(';base64,')[1], 'base64').toString('utf8');
            } else {
              svgStr = decodeURIComponent(signatureDataUrl.replace(/^data:image\/svg\+xml;?(utf8)?,?/, ''));
            }
            imgBytes = await sharp(Buffer.from(svgStr)).png().toBuffer();
            isPng = true;
          } else if (signatureDataUrl.startsWith('data:image/')) {
            const raw = Buffer.from(signatureDataUrl.replace(/^data:image\/[a-zA-Z+]+;base64,/, ''), 'base64');
            imgBytes = await sharp(raw).png().toBuffer();
            isPng = true;
          }
        } catch (sharpErr) {
          console.warn('Konversi format tanda tangan ke PNG gagal:', sharpErr);
        }
      }

      if (imgBytes && imgBytes.length > 0) {
        const embeddedImage = isPng ? await pdfDoc.embedPng(imgBytes) : await pdfDoc.embedJpg(imgBytes);

        // Bersihkan area kotak tanda tangan terlebih dahulu dengan latar putih bersih agar menimpa cap lama/kotak hijau jika ada
        targetPage.drawRectangle({
          x: sigX,
          y: sigY,
          width: sigW,
          height: sigH,
          color: rgb(1, 1, 1),
          borderWidth: 0,
        });

        targetPage.drawImage(embeddedImage, {
          x: sigX,
          y: sigY,
          width: sigW,
          height: sigH,
        });
        hasEmbeddedImage = true;
      }
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

      // Vector checkmark (WinAnsi safe)
      targetPage.drawLine({
        start: { x: sigX + 5, y: sigY + sigH - 7 },
        end: { x: sigX + 7.5, y: sigY + sigH - 10 },
        thickness: 1.2,
        color: rgb(0.05, 0.55, 0.28),
      });
      targetPage.drawLine({
        start: { x: sigX + 7.5, y: sigY + sigH - 10 },
        end: { x: sigX + 11.5, y: sigY + sigH - 5 },
        thickness: 1.2,
        color: rgb(0.05, 0.55, 0.28),
      });

      targetPage.drawText('VALIDASI DIGITAL', {
        x: sigX + 14,
        y: sigY + sigH - 9,
        size: 6.5,
        font: fontBold,
        color: rgb(0.05, 0.55, 0.28),
      });

      const displayName = (uploaderName || 'PETUGAS CPG').slice(0, 18).toUpperCase();
      targetPage.drawText(displayName, {
        x: sigX + 5,
        y: sigY + sigH - 18,
        size: 6,
        font: fontBold,
        color: rgb(0.09, 0.14, 0.23),
      });

      const tokenText = (verificationToken || `VAL-FSTB-${Date.now().toString(36).toUpperCase()}`).slice(0, 20);
      targetPage.drawText(tokenText, {
        x: sigX + 5,
        y: sigY + 4,
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

    if (uploaderName && uploaderName.trim()) {
      const cleanName = uploaderName.trim().toUpperCase();
      const nameX = nameXRatio * pageWidth;
      const nameY = nameYRatio * pageHeight;
      const nameFontSize = cleanName.length > 20 ? 6.5 : cleanName.length > 15 ? 7 : 7.5;

      targetPage.drawText(cleanName, {
        x: nameX,
        y: nameY,
        size: nameFontSize,
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
        size: 7.5,
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
