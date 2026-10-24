import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

export type TtbStampRoleType =
  | 'delivered_by' // Kolom 1: Delivered By : Logistic Staff
  | 'received_by' // Kolom 2: Received By : User
  | 'approved_by' // Kolom 3: Approved By : Logistic Supervisor
  | 'acknowledged_by' // Kolom 4: Acknowledge By : Procurement Manager
  | 'logistic'
  | 'lapangan'
  | 'logistic_spv'
  | 'purchasing_manager';

export interface StampTtbOptions {
  pdfBuffer: Buffer | Uint8Array;
  signatureDataUrl?: string; // PNG or JPEG base64 Data URL
  uploaderName: string;
  uploadDate: string;
  roleType?: TtbStampRoleType;
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
 * Rasio koordinat standar untuk formulir TTB resmi CPG (CPL-PRC-SOP-004-F02)
 * Koordinat dihitung dari kiri-bawah (standard PDF coordinate system)
 * Form Geometry 4 Kolom:
 * 1. Delivered By : Logistic Staff (Kolom 1)
 * 2. Received By : User / Lapangan (Kolom 2)
 * 3. Approved By : Logistic Supervisor (Kolom 3)
 * 4. Acknowledge By : Procurement Manager (Kolom 4)
 */
export const TTB_DELIVERED_BY_COORDINATES = {
  // Delivered By : Logistic Staff (Kolom 1)
  // Form Geometry: Label y=126.5, Line y=91.5, Role y=79.5, Name y=62.5, Date y=50.5
  sigXRatio: 0.0718,      // x = 43 pt (centered above line x=48..118)
  sigYRatio: 0.2392,      // y = 94.0 pt (sits exactly 2.5 pt cleanly above line y=91.5)
  sigWidthRatio: 0.1336,  // width = 80 pt
  sigHeightRatio: 0.0763, // height = 30 pt (top at y=124.0, safely below header y=126.5)
  nameXRatio: 0.1419,     // x = 85 pt (right after 'Name :' label at x=47)
  nameYRatio: 0.1590,     // y = 62.5 pt (aligns precisely with 'Name :' baseline)
  dateXRatio: 0.1419,     // x = 85 pt (right after 'Date :' label at x=47)
  dateYRatio: 0.1285,     // y = 50.5 pt (aligns precisely with 'Date :' baseline)
};

export const TTB_RECEIVED_BY_COORDINATES = {
  // Received By : User (Kolom 2)
  // Form Geometry: Label y=127.5, Line y=92.5, Role y=80.5, Name y=62.5, Date y=50.5
  sigXRatio: 0.3072,      // x = 184 pt (centered above line x=189..259)
  sigYRatio: 0.2392,      // y = 94.0 pt (sits 1.5 pt cleanly above line y=92.5)
  sigWidthRatio: 0.1336,  // width = 80 pt
  sigHeightRatio: 0.0763, // height = 30 pt (top at y=124.0, below header y=127.5)
  nameXRatio: 0.3790,     // x = 227 pt (right after 'Name :' label at x=189)
  nameYRatio: 0.1590,     // y = 62.5 pt (aligns with 'Name :' baseline)
  dateXRatio: 0.3790,     // x = 227 pt (right after 'Date :' label at x=189)
  dateYRatio: 0.1285,     // y = 50.5 pt (aligns with 'Date :' baseline)
  phoneBoxXRatio: 0.257,
  phoneBoxYRatio: 0.010,
  phoneBoxWidthRatio: 0.243,
  phoneBoxHeightRatio: 0.075,
};

export const TTB_APPROVED_BY_COORDINATES = {
  // Approved By : Logistic Supervisor (Kolom 3)
  // Form Geometry: Label y=128.5, Line y=92.5, Role y=81.5, Name y=62.5, Date y=50.5
  sigXRatio: 0.5142,      // x = 308 pt (centered above line x=313..383)
  sigYRatio: 0.2392,      // y = 94.0 pt (sits 1.5 pt cleanly above line y=92.5)
  sigWidthRatio: 0.1336,  // width = 80 pt
  sigHeightRatio: 0.0763, // height = 30 pt
  nameXRatio: 0.5860,     // x = 351 pt (right after 'Name :' label at x=313)
  nameYRatio: 0.1590,     // y = 62.5 pt
  dateXRatio: 0.5860,     // x = 351 pt
  dateYRatio: 0.1285,     // y = 50.5 pt
};

export const TTB_ACKNOWLEDGED_BY_COORDINATES = {
  // Acknowledge By : Procurement Manager (Kolom 4)
  // Form Geometry: Label y=128.5, Line y=92.5, Role y=81.5, Name y=62.5, Date y=50.5
  sigXRatio: 0.7312,      // x = 438 pt (centered above line x=443..513)
  sigYRatio: 0.2392,      // y = 94.0 pt (sits 1.5 pt cleanly above line y=92.5)
  sigWidthRatio: 0.1336,  // width = 80 pt
  sigHeightRatio: 0.0763, // height = 30 pt
  nameXRatio: 0.8030,     // x = 481 pt (right after 'Name :' label at x=443)
  nameYRatio: 0.1590,     // y = 62.5 pt
  dateXRatio: 0.8030,     // x = 481 pt
  dateYRatio: 0.1285,     // y = 50.5 pt
};

// Default alias untuk backwards compatibility
export const DEFAULT_TTB_COORDINATES = TTB_DELIVERED_BY_COORDINATES;
export const TTB_RECIPIENT_COORDINATES = TTB_RECEIVED_BY_COORDINATES;

/**
 * Format tanggal Indonesia ringkas (DD/MM/YYYY)
 */
export { formatTtbStampDate } from './stampDateFormatter';

/**
 * Stempel Tanda Tangan Digital, Nama Validator, dan Tanggal pada Dokumen PDF TTB
 */
export async function stampTtbPdf(options: StampTtbOptions): Promise<Buffer> {
  const {
    pdfBuffer,
    signatureDataUrl,
    uploaderName,
    uploadDate,
    roleType = 'delivered_by',
    verificationToken,
    customCoordinates = {},
  } = options;

  const pdfDoc = await PDFDocument.load(pdfBuffer, { ignoreEncryption: true });
  const pages = pdfDoc.getPages();
  if (pages.length === 0) {
    throw new Error('Dokumen PDF tidak memiliki halaman.');
  }

  // Selalu gunakan halaman terakhir untuk stempel tanda tangan digital TTB
  // (Jika dokumen memiliki > 1 halaman, kolom otorisasi tanda tangan terletak di halaman terakhir)
  const targetPage = pages[pages.length - 1];
  const { width: pageWidth, height: pageHeight } = targetPage.getSize();

  // Tentukan koordinat dasar berdasarkan kolom pengesahan (roleType)
  let baseCoords = TTB_DELIVERED_BY_COORDINATES;
  if (roleType === 'received_by' || roleType === 'lapangan') {
    baseCoords = TTB_RECEIVED_BY_COORDINATES;
  } else if (roleType === 'approved_by' || roleType === 'logistic_spv') {
    baseCoords = TTB_APPROVED_BY_COORDINATES;
  } else if (roleType === 'acknowledged_by' || roleType === 'purchasing_manager') {
    baseCoords = TTB_ACKNOWLEDGED_BY_COORDINATES;
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

  // 1. Sematkan Gambar Tanda Tangan Digital (jika ada) atau Cap Verifikasi Digital
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
        const embeddedImage = isPng
          ? await pdfDoc.embedPng(imgBytes)
          : await pdfDoc.embedJpg(imgBytes);

        // Bersihkan area tanda tangan terlebih dahulu dengan latar putih bersih agar menimpa cap lama/kotak hijau jika ada
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
      console.warn('Gagal menyematkan spesimen tanda tangan ke PDF TTB:', sigErr);
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

      const tokenText = (
        verificationToken || `VAL-TTB-${Date.now().toString(36).toUpperCase()}`
      ).slice(0, 20);
      targetPage.drawText(tokenText, {
        x: sigX + 5,
        y: sigY + 4,
        size: 5,
        font: fontNorm,
        color: rgb(0.35, 0.45, 0.55),
      });
    } catch (sealErr) {
      console.warn('Gagal membubuhkan cap digital verifikasi TTB:', sealErr);
    }
  }

  // 2. Sematkan Teks Nama Lengkap dan Tanggal
  try {
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const fontNorm = await pdfDoc.embedFont(StandardFonts.Helvetica);

    // Nama Uploader / Validator
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

    // Tanggal
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
    console.warn('Gagal menulis teks nama/tanggal ke PDF TTB:', textErr);
  }

  const modifiedBytes = await pdfDoc.save();
  return Buffer.from(modifiedBytes);
}

export interface StampTtbRecipientOptions {
  pdfBuffer: Buffer | Uint8Array;
  recipientSignatureDataUrl?: string; // PNG or JPEG base64 Data URL
  recipientName: string;
  receiptDate: string;
  recipientPhone?: string; // No WA / Telp Kapal atau Penerima
  customCoordinates?: {
    sigXRatio?: number;
    sigYRatio?: number;
    sigWidthRatio?: number;
    sigHeightRatio?: number;
    nameXRatio?: number;
    nameYRatio?: number;
    dateXRatio?: number;
    dateYRatio?: number;
    phoneBoxXRatio?: number;
    phoneBoxYRatio?: number;
    phoneBoxWidthRatio?: number;
    phoneBoxHeightRatio?: number;
  };
}

/**
 * Stempel Tanda Tangan Digital, Nama, Tanggal, dan No Telp/WA Penerima (Received By : User)
 * Serta Kotak Hitam No. WA/Telp Kapal pada Dokumen PDF TTB Resmi
 */
export async function stampTtbRecipientPdf(options: StampTtbRecipientOptions): Promise<Buffer> {
  const {
    pdfBuffer,
    recipientSignatureDataUrl,
    recipientName,
    receiptDate,
    recipientPhone,
    customCoordinates = {},
  } = options;

  const pdfDoc = await PDFDocument.load(pdfBuffer);
  const pages = pdfDoc.getPages();
  if (pages.length === 0) {
    throw new Error('Dokumen PDF tidak memiliki halaman.');
  }

  // Selalu gunakan halaman terakhir untuk stempel penerima lapangan TTB
  // (Jika berkas memiliki multi-halaman, tanda tangan selalu ditempatkan pada halaman paling akhir)
  const targetPage = pages[pages.length - 1];
  const { width: pageWidth, height: pageHeight } = targetPage.getSize();

  const coords = {
    ...TTB_RECIPIENT_COORDINATES,
    ...customCoordinates,
  };

  // 1. Sematkan Gambar Tanda Tangan Digital Penerima Akhir
  if (recipientSignatureDataUrl && typeof recipientSignatureDataUrl === 'string') {
    try {
      let imageBytes: Buffer | null = null;
      let isPng = true;

      if (recipientSignatureDataUrl.startsWith('data:image/png;base64,')) {
        imageBytes = Buffer.from(recipientSignatureDataUrl.replace(/^data:image\/png;base64,/, ''), 'base64');
        isPng = true;
      } else if (recipientSignatureDataUrl.startsWith('data:image/jpeg;base64,') || recipientSignatureDataUrl.startsWith('data:image/jpg;base64,')) {
        imageBytes = Buffer.from(recipientSignatureDataUrl.replace(/^data:image\/jpe?g;base64,/, ''), 'base64');
        isPng = false;
      } else {
        try {
          const sharpModule = await import('sharp');
          const sharp = sharpModule.default || sharpModule;
          if (recipientSignatureDataUrl.startsWith('data:image/svg+xml')) {
            let svgStr = '';
            if (recipientSignatureDataUrl.includes(';base64,')) {
              svgStr = Buffer.from(recipientSignatureDataUrl.split(';base64,')[1], 'base64').toString('utf8');
            } else {
              svgStr = decodeURIComponent(recipientSignatureDataUrl.replace(/^data:image\/svg\+xml;?(utf8)?,?/, ''));
            }
            imageBytes = await sharp(Buffer.from(svgStr)).png().toBuffer();
            isPng = true;
          } else if (recipientSignatureDataUrl.startsWith('data:image/')) {
            const raw = Buffer.from(recipientSignatureDataUrl.replace(/^data:image\/[a-zA-Z+]+;base64,/, ''), 'base64');
            imageBytes = await sharp(raw).png().toBuffer();
            isPng = true;
          }
        } catch (sharpErr) {
          console.warn('Konversi sharp tanda tangan penerima gagal:', sharpErr);
        }
      }

      if (imageBytes && imageBytes.length > 0) {
        const embeddedImage = isPng
          ? await pdfDoc.embedPng(imageBytes)
          : await pdfDoc.embedJpg(imageBytes);

        const sigX = coords.sigXRatio * pageWidth;
        const sigY = coords.sigYRatio * pageHeight;
        const sigW = coords.sigWidthRatio * pageWidth;
        const sigH = coords.sigHeightRatio * pageHeight;

        // Bersihkan area kotak tanda tangan terlebih dahulu dengan latar putih bersih
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

      targetPage.drawText(cleanName, {
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

      targetPage.drawText(cleanDate, {
        x: dateX,
        y: dateY,
        size: fontSize,
        font: fontNorm,
        color: rgb(0, 0, 0),
      });
    }

    // 3. Sematkan Kotak Hitam No. WA/Telp Kapal atau No. Penerima (Footer Bawah di bawah kolom Received By)
    if (recipientPhone && recipientPhone.trim()) {
      const cleanPhone = recipientPhone.trim();

      // Rasio posisi kotak hitam di footer bawah di bawah kolom Received By
      const boxX = (coords.phoneBoxXRatio ?? 0.257) * pageWidth;
      const boxY = (coords.phoneBoxYRatio ?? 0.010) * pageHeight;
      const boxW = (coords.phoneBoxWidthRatio ?? 0.243) * pageWidth;
      const boxH = (coords.phoneBoxHeightRatio ?? 0.075) * pageHeight;

      // Gambar bingkai kotak hitam rapi (border hitam tebal 1.5 pt, latar belakang putih)
      targetPage.drawRectangle({
        x: boxX,
        y: boxY,
        width: boxW,
        height: boxH,
        borderWidth: 1.5,
        borderColor: rgb(0, 0, 0),
        color: rgb(1, 1, 1),
      });

      const phoneText = `No. Telp/WA: ${cleanPhone}`;
      const phoneFontSize = Math.max(7, Math.min(8.5, pageHeight * 0.021));
      const textWidth = fontBold.widthOfTextAtSize(phoneText, phoneFontSize);

      if (textWidth <= boxW - 8) {
        // Muat 1 baris di tengah-tengah kotak
        const textX = boxX + (boxW - textWidth) / 2;
        const textY = boxY + (boxH - phoneFontSize) / 2 + 1;

        targetPage.drawText(phoneText, {
          x: textX,
          y: textY,
          size: phoneFontSize,
          font: fontBold,
          color: rgb(0, 0, 0),
        });
      } else {
        // Jika nomor panjang, bagi menjadi 2 baris terpusat rapi
        const labelText = 'No. Telp/WA:';
        const labelW = fontBold.widthOfTextAtSize(labelText, phoneFontSize);
        const phoneW = fontBold.widthOfTextAtSize(cleanPhone, phoneFontSize);

        const lineGap = 2;
        const totalTextH = phoneFontSize * 2 + lineGap;
        const startY = boxY + (boxH - totalTextH) / 2 + phoneFontSize + lineGap;

        targetPage.drawText(labelText, {
          x: boxX + (boxW - labelW) / 2,
          y: startY,
          size: phoneFontSize,
          font: fontBold,
          color: rgb(0, 0, 0),
        });

        targetPage.drawText(cleanPhone, {
          x: boxX + (boxW - phoneW) / 2,
          y: startY - phoneFontSize - lineGap,
          size: phoneFontSize,
          font: fontBold,
          color: rgb(0, 0, 0),
        });
      }
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

