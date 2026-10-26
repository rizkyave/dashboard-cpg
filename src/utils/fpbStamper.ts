import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { getStaffSignature } from './fpbSignatureAssets';

export interface StampFpbOptions {
  pdfBuffer: Buffer | Uint8Array;
  signerName?: string;
  signDate?: string; // Format: DD-MM-YYYY
  receivedAt?: string; // Format: DD-MM-YYYY HH:mm:ss
}

/**
 * Format date to Indonesian standard DD-MM-YYYY
 */
export function formatToStampDate(dateInput?: string | Date): string {
  const d = dateInput ? new Date(dateInput) : new Date();
  if (isNaN(d.getTime())) {
    const today = new Date();
    const day = String(today.getDate()).padStart(2, '0');
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const year = today.getFullYear();
    return `${day}-${month}-${year}`;
  }
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}-${month}-${year}`;
}

/**
 * Format timestamp to e-FPB standard DD-MM-YYYY HH:mm:ss
 */
export function formatToStampTimestamp(dateInput?: string | Date): string {
  const d = dateInput ? new Date(dateInput) : new Date();
  const dateStr = formatToStampDate(d);
  if (isNaN(d.getTime())) {
    return `${dateStr} 12:00:00`;
  }
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const seconds = String(d.getSeconds()).padStart(2, '0');
  return `${dateStr} ${hours}:${minutes}:${seconds}`;
}

/**
 * Stempel Tanda Tangan Staf Logistik Operasional & Cap Resmi Received pada Dokumen e-FPB
 * Koordinat diambil presisi dari stream dokumen asli logistik_Approved_rev_sign_*.pdf di e-FPB CPG.
 */
export async function stampFpbPdf(options: StampFpbOptions): Promise<Buffer> {
  const { pdfBuffer, signerName, signDate, receivedAt } = options;

  const pdfDoc = await PDFDocument.load(pdfBuffer, { ignoreEncryption: true });
  const pages = pdfDoc.getPages();
  if (pages.length === 0) {
    throw new Error('Dokumen PDF FPB tidak memiliki halaman.');
  }

  // Lembar form tanda tangan FPB selalu berada pada halaman pertama
  const targetPage = pages[0];

  const { staff, stampBase64 } = getStaffSignature(signerName);

  // Decode base64 PNG images
  const sigBytes = Buffer.from(staff.signatureBase64.replace(/^data:image\/png;base64,/, ''), 'base64');
  const stampBytes = Buffer.from(stampBase64.replace(/^data:image\/png;base64,/, ''), 'base64');

  const sigImg = await pdfDoc.embedPng(sigBytes);
  const stampImg = await pdfDoc.embedPng(stampBytes);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

  const formattedDate = signDate || formatToStampDate();
  const formattedTimestamp = receivedAt || formatToStampTimestamp();

  // 1. Tanda Tangan Staf Logistik di dalam kotak "Received By: (Logistic Staff)"
  // Koordinat presisi e-FPB: x = 425.20, y = 530.08, w = 113.39, h = 56.69
  targetPage.drawImage(sigImg, {
    x: 425.20,
    y: 530.08,
    width: 113.39,
    height: 56.69,
  });

  // 2. Nama Staf Logistik (misal: NOOR HASANAH atau MELINDA DWI PUTRI)
  // Koordinat presisi e-FPB: x = 504.57, y = 516.04
  targetPage.drawText(staff.name, {
    x: 504.57,
    y: 516.04,
    size: 9.0,
    font,
    color: rgb(0, 0, 0),
  });

  // 3. Tanggal Tanda Tangan (DD-MM-YYYY)
  // Koordinat presisi e-FPB: x = 504.57, y = 504.70
  targetPage.drawText(formattedDate, {
    x: 504.57,
    y: 504.70,
    size: 9.0,
    font,
    color: rgb(0, 0, 0),
  });

  // 4. Cap Resmi "DITERIMA LOGISTIK / APPROVED"
  // Koordinat presisi e-FPB: x = 396.85, y = 388.35, w = 113.39, h = 85.04
  targetPage.drawImage(stampImg, {
    x: 396.85,
    y: 388.35,
    width: 113.39,
    height: 85.04,
  });

  // 5. Teks Timestamp Penerimaan Logistik
  // Koordinat presisi e-FPB: x = 456.38, y = 382.81
  targetPage.drawText(`Received: ${formattedTimestamp}`, {
    x: 456.38,
    y: 382.81,
    size: 9.0,
    font,
    color: rgb(0, 0, 0),
  });

  const savedBytes = await pdfDoc.save();
  return Buffer.from(savedBytes);
}

