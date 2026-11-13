import { PDFDocument, rgb, StandardFonts, PageSizes } from 'pdf-lib';
import { PratenderPackage, VendorBidSubmission } from '@/types/pratender';

/**
 * Format currency ke Rupiah
 */
function formatRupiah(val?: number): string {
  if (val === undefined || isNaN(val)) return 'Rp 0';
  return `Rp ${Math.round(val).toLocaleString('id-ID')}`;
}

export type TenderDocType = 'DOKUMEN_RKS' | 'TABULASI_CBT' | 'BERITA_ACARA_BAEP';

/**
 * 1. GENERATE DOKUMEN RKS & SPESIFIKASI TEKNIS (RFQ TENDER)
 */
export async function generateRksDocumentPdf(pkg: PratenderPackage): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);

  const page = pdfDoc.addPage(PageSizes.A4);
  const { width, height } = page.getSize();

  // Header Bar Biru Dongker
  page.drawRectangle({
    x: 0,
    y: height - 80,
    width,
    height: 80,
    color: rgb(0.06, 0.12, 0.24),
  });

  page.drawText('PT CINDARA PRATAMA LINES & GROUP', {
    x: 40,
    y: height - 35,
    size: 13,
    font: fontBold,
    color: rgb(1, 1, 1),
  });

  page.drawText('RENCANA KERJA & SYARAT-SYARAT (RKS) / REQUEST FOR QUOTATION (RFQ)', {
    x: 40,
    y: height - 52,
    size: 9,
    font: fontBold,
    color: rgb(0.22, 0.74, 0.97),
  });

  page.drawText(`KODE PAKET: ${pkg.packageNumber} • STATUS: ${pkg.status}`, {
    x: 40,
    y: height - 68,
    size: 8,
    font: fontRegular,
    color: rgb(0.85, 0.9, 0.98),
  });

  let curY = height - 105;

  // Metadata Box
  page.drawRectangle({
    x: 40,
    y: curY - 70,
    width: width - 80,
    height: 70,
    borderColor: rgb(0.82, 0.85, 0.9),
    borderWidth: 1,
    color: rgb(0.97, 0.98, 1.0),
  });

  const drawField = (label: string, val: string, x: number, y: number) => {
    page.drawText(label, { x, y, size: 8, font: fontRegular, color: rgb(0.4, 0.45, 0.55) });
    page.drawText(`: ${val}`, { x: x + 85, y, size: 8, font: fontBold, color: rgb(0.1, 0.15, 0.25) });
  };

  drawField('Nama Paket', (pkg.title || '-').slice(0, 36), 55, curY - 20);
  drawField('Kategori', pkg.category || 'General', 55, curY - 36);
  drawField('Metode Seleksi', pkg.procurementMethod || 'Tender Terbatas', 55, curY - 52);

  drawField('Batas Penawaran', pkg.targetClosingDate || '3 Hari Kerja', 330, curY - 20);
  drawField('Syarat Pengiriman', 'Franco Dermaga Somber', 330, curY - 36);
  drawField('Syarat Pembayaran', 'NET 30 Hari Setelah TTB', 330, curY - 52);

  curY -= 95;

  // Section: Rincian Kebutuhan Material & Spesifikasi
  page.drawText('A. DAFTAR SPESIFIKASI MATERIAL & VOLUME TENDER', {
    x: 40,
    y: curY,
    size: 9.5,
    font: fontBold,
    color: rgb(0.08, 0.15, 0.3),
  });

  curY -= 18;

  // Table Header
  page.drawRectangle({
    x: 40,
    y: curY - 18,
    width: width - 80,
    height: 18,
    color: rgb(0.92, 0.94, 0.98),
  });

  page.drawText('NO', { x: 48, y: curY - 12, size: 7.5, font: fontBold, color: rgb(0.2, 0.25, 0.35) });
  page.drawText('NAMA BARANG / SPESIFIKASI', { x: 75, y: curY - 12, size: 7.5, font: fontBold, color: rgb(0.2, 0.25, 0.35) });
  page.drawText('VOLUME', { x: 330, y: curY - 12, size: 7.5, font: fontBold, color: rgb(0.2, 0.25, 0.35) });
  page.drawText('SATUAN', { x: 390, y: curY - 12, size: 7.5, font: fontBold, color: rgb(0.2, 0.25, 0.35) });
  page.drawText('UNIT / ARMADA', { x: 445, y: curY - 12, size: 7.5, font: fontBold, color: rgb(0.2, 0.25, 0.35) });

  curY -= 20;

  (pkg.items || []).slice(0, 15).forEach((item, idx) => {
    const isEven = idx % 2 === 0;
    if (isEven) {
      page.drawRectangle({
        x: 40,
        y: curY - 14,
        width: width - 80,
        height: 16,
        color: rgb(0.98, 0.99, 1.0),
      });
    }

    page.drawText(String(idx + 1), { x: 50, y: curY - 9, size: 7.5, font: fontRegular, color: rgb(0.3, 0.35, 0.45) });
    page.drawText((item.itemName || '-').slice(0, 48), { x: 75, y: curY - 9, size: 7.5, font: fontBold, color: rgb(0.1, 0.15, 0.25) });
    page.drawText(String(item.totalQty || 1), { x: 335, y: curY - 9, size: 7.5, font: fontRegular, color: rgb(0.1, 0.15, 0.25) });
    page.drawText(item.satuan || 'Pcs', { x: 390, y: curY - 9, size: 7.5, font: fontRegular, color: rgb(0.3, 0.35, 0.45) });
    page.drawText(((item.vessels && item.vessels[0]) || 'Armada CPG').slice(0, 18), { x: 445, y: curY - 9, size: 7, font: fontRegular, color: rgb(0.3, 0.35, 0.45) });

    curY -= 17;
  });

  curY -= 15;

  // Section B: Syarat & Ketentuan Umum
  page.drawText('B. PERSYARATAN & KETENTUAN PESERTA TENDER', {
    x: 40,
    y: curY,
    size: 9.5,
    font: fontBold,
    color: rgb(0.08, 0.15, 0.3),
  });

  const terms = [
    '1. Penawaran harga bersifat tetap (fixed price) dan mencakup ongkos angkut Franco Dermaga Somber Balikpapan.',
    '2. Material yang dikirimkan wajib baru (100% original), bergaransi pabrik, dan dilengkapi Certificate of Origin / Mill Cert jika disyaratkan.',
    '3. Jadwal serah terima barang wajib mengacu pada lead time penawaran dan disertai Berita Acara / Surat Jalan resmi.',
    '4. Panitia pengadaan berhak melakukan klarifikasi teknis dan negosiasi harga final (Best and Final Offer / BAFO).',
  ];

  curY -= 16;
  terms.forEach((t) => {
    page.drawText(t, { x: 45, y: curY, size: 7.5, font: fontRegular, color: rgb(0.3, 0.35, 0.45) });
    curY -= 13;
  });

  // Footer Tanda Tangan
  curY -= 25;
  const signY = Math.max(50, curY);

  page.drawText('Dibuat & Diterbitkan Oleh,', { x: 70, y: signY + 45, size: 8, font: fontRegular, color: rgb(0.3, 0.35, 0.45) });
  page.drawText('TIM PENGADAAN & PPIC CPG', { x: 70, y: signY + 32, size: 8.5, font: fontBold, color: rgb(0.1, 0.15, 0.25) });
  page.drawText('( Staf Purchasing Desk )', { x: 70, y: signY, size: 7.5, font: fontRegular, color: rgb(0.4, 0.45, 0.55) });

  page.drawText('Disetujui Oleh,', { x: 380, y: signY + 45, size: 8, font: fontRegular, color: rgb(0.3, 0.35, 0.45) });
  page.drawText('PURCHASING & FLEET LOGISTIC MGR', { x: 380, y: signY + 32, size: 8.5, font: fontBold, color: rgb(0.1, 0.15, 0.25) });
  page.drawText('( Pejabat Berwenang )', { x: 380, y: signY, size: 7.5, font: fontRegular, color: rgb(0.4, 0.45, 0.55) });

  return await pdfDoc.save();
}

/**
 * 2. GENERATE BERITA ACARA EVALUASI PENGADAAN & PENETAPAN PEMENANG (BAEP)
 */
export async function generateBaepDocumentPdf(pkg: PratenderPackage): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);

  const page = pdfDoc.addPage(PageSizes.A4);
  const { width, height } = page.getSize();

  // Header Banner Emas/Emerald
  page.drawRectangle({
    x: 0,
    y: height - 80,
    width,
    height: 80,
    color: rgb(0.08, 0.2, 0.15),
  });

  page.drawText('PT CINDARA PRATAMA LINES & GROUP', {
    x: 40,
    y: height - 35,
    size: 13,
    font: fontBold,
    color: rgb(1, 1, 1),
  });

  page.drawText('BERITA ACARA EVALUASI PENGADAAN & PENETAPAN PEMENANG (BAEP)', {
    x: 40,
    y: height - 52,
    size: 9.5,
    font: fontBold,
    color: rgb(0.2, 0.85, 0.55),
  });

  page.drawText(`NO DOKUMEN: BAEP-${pkg.packageNumber} • TANGGAL: ${new Date().toLocaleDateString('id-ID')}`, {
    x: 40,
    y: height - 68,
    size: 8,
    font: fontRegular,
    color: rgb(0.85, 0.95, 0.9),
  });

  let curY = height - 110;

  // Winner Announcement Highlight Box
  page.drawRectangle({
    x: 40,
    y: curY - 65,
    width: width - 80,
    height: 65,
    borderColor: rgb(0.2, 0.75, 0.5),
    borderWidth: 1.5,
    color: rgb(0.95, 1.0, 0.97),
  });

  const winnerName = pkg.evaluationSummary?.winningVendorName || pkg.awardedVendor || (pkg.vendorBids && pkg.vendorBids[0]?.vendorName) || 'Rekanan Pemenang';
  const winnerAmount = pkg.evaluationSummary?.winningAmount || pkg.awardedValue || (pkg.vendorBids && (pkg.vendorBids[0]?.negotiatedGrandTotal || pkg.vendorBids[0]?.grandTotal)) || 0;
  const hps = pkg.ownerEstimateHps || pkg.totalEstimatedBudget || 0;
  const saving = hps > winnerAmount ? hps - winnerAmount : 0;

  page.drawText('REKOMENDASI PEMENANG TENDER (PERINGKAT I)', {
    x: 55,
    y: curY - 20,
    size: 8.5,
    font: fontBold,
    color: rgb(0.1, 0.55, 0.35),
  });

  page.drawText(winnerName, {
    x: 55,
    y: curY - 38,
    size: 13,
    font: fontBold,
    color: rgb(0.05, 0.15, 0.25),
  });

  page.drawText(`Nilai Kontrak / PO: ${formatRupiah(winnerAmount)}  |  Total Efisiensi (Saving vs HPS): ${formatRupiah(saving)}`, {
    x: 55,
    y: curY - 55,
    size: 8.5,
    font: fontBold,
    color: rgb(0.1, 0.55, 0.35),
  });

  curY -= 90;

  // Section: Ringkasan Hasil Komparasi Rekanan (CBT SAP ME49)
  page.drawText('HASIL TABULASI PENAWARAN & PERINGKAT REKANAN PESERTA', {
    x: 40,
    y: curY,
    size: 9.5,
    font: fontBold,
    color: rgb(0.08, 0.15, 0.3),
  });

  curY -= 18;

  // Header Table Bids
  page.drawRectangle({
    x: 40,
    y: curY - 18,
    width: width - 80,
    height: 18,
    color: rgb(0.92, 0.94, 0.98),
  });

  page.drawText('RANK', { x: 48, y: curY - 12, size: 7.5, font: fontBold, color: rgb(0.2, 0.25, 0.35) });
  page.drawText('NAMA VENDOR / REKANAN', { x: 85, y: curY - 12, size: 7.5, font: fontBold, color: rgb(0.2, 0.25, 0.35) });
  page.drawText('PENAWARAN AWAL', { x: 260, y: curY - 12, size: 7.5, font: fontBold, color: rgb(0.2, 0.25, 0.35) });
  page.drawText('HASIL BAFO / FINAL', { x: 360, y: curY - 12, size: 7.5, font: fontBold, color: rgb(0.2, 0.25, 0.35) });
  page.drawText('LEAD TIME', { x: 470, y: curY - 12, size: 7.5, font: fontBold, color: rgb(0.2, 0.25, 0.35) });

  curY -= 20;

  const bidsList: VendorBidSubmission[] = (pkg.vendorBids || []).slice();
  bidsList.sort((a, b) => {
    const pA = a.negotiatedGrandTotal || a.grandTotal;
    const pB = b.negotiatedGrandTotal || b.grandTotal;
    return pA - pB;
  });

  bidsList.forEach((bid, idx) => {
    const isWinner = idx === 0;
    if (isWinner) {
      page.drawRectangle({
        x: 40,
        y: curY - 14,
        width: width - 80,
        height: 16,
        color: rgb(0.9, 0.98, 0.93),
      });
    }

    page.drawText(`#${idx + 1}`, { x: 50, y: curY - 9, size: 7.5, font: fontBold, color: isWinner ? rgb(0.1, 0.6, 0.3) : rgb(0.3, 0.35, 0.45) });
    page.drawText((bid.vendorName || '-').slice(0, 32), { x: 85, y: curY - 9, size: 7.5, font: fontBold, color: rgb(0.1, 0.15, 0.25) });
    page.drawText(formatRupiah(bid.grandTotal), { x: 260, y: curY - 9, size: 7.5, font: fontRegular, color: rgb(0.3, 0.35, 0.45) });
    page.drawText(formatRupiah(bid.negotiatedGrandTotal || bid.grandTotal), { x: 360, y: curY - 9, size: 7.5, font: fontBold, color: isWinner ? rgb(0.1, 0.6, 0.3) : rgb(0.1, 0.15, 0.25) });
    page.drawText(`${bid.deliveryLeadTimeDays || 7} Hari`, { x: 470, y: curY - 9, size: 7.5, font: fontRegular, color: rgb(0.3, 0.35, 0.45) });

    curY -= 17;
  });

  curY -= 20;

  // Section: Penetapan PO & Kesimpulan
  page.drawText('KESIMPULAN & PENERBITAN PURCHASE ORDER (PO)', {
    x: 40,
    y: curY,
    size: 9.5,
    font: fontBold,
    color: rgb(0.08, 0.15, 0.3),
  });

  const notesText = `Berdasarkan evaluasi penawaran teknis, kualifikasi, dan tabulasi harga BAFO, disepakati untuk menetapkan ${winnerName} sebagai pemenang tender resmi paket ${pkg.packageNumber}. Nilai pekerjaan disepakati sebesar ${formatRupiah(winnerAmount)} dan siap diterbitkan dokumen Purchase Order (PO).`;
  
  curY -= 16;
  page.drawText(notesText.slice(0, 115), { x: 40, y: curY, size: 7.5, font: fontRegular, color: rgb(0.3, 0.35, 0.45) });
  curY -= 12;
  page.drawText(notesText.slice(115, 230), { x: 40, y: curY, size: 7.5, font: fontRegular, color: rgb(0.3, 0.35, 0.45) });

  // Signatures
  curY -= 40;
  const signY = Math.max(50, curY);

  page.drawText('Disusun Oleh (Evaluator):', { x: 70, y: signY + 45, size: 8, font: fontRegular, color: rgb(0.3, 0.35, 0.45) });
  page.drawText('PANITIA PENGADAAN CPG', { x: 70, y: signY + 32, size: 8.5, font: fontBold, color: rgb(0.1, 0.15, 0.25) });
  page.drawText('( Staf Purchasing & PPIC )', { x: 70, y: signY, size: 7.5, font: fontRegular, color: rgb(0.4, 0.45, 0.55) });

  page.drawText('Disetujui Oleh (Approval Pemenang):', { x: 360, y: signY + 45, size: 8, font: fontRegular, color: rgb(0.3, 0.35, 0.45) });
  page.drawText('DIREKSI / GENERAL MANAGER', { x: 360, y: signY + 32, size: 8.5, font: fontBold, color: rgb(0.1, 0.15, 0.25) });
  page.drawText('( Otoritas Penetapan Pemenang )', { x: 360, y: signY, size: 7.5, font: fontRegular, color: rgb(0.4, 0.45, 0.55) });

  return await pdfDoc.save();
}

/**
 * Trigger download file PDF di browser
 */
export function triggerBrowserPdfDownload(bytes: Uint8Array, filename: string) {
  const blob = new Blob([bytes as any], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 20000);
}
