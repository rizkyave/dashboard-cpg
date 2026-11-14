import { PDFDocument, rgb, StandardFonts, PageSizes } from 'pdf-lib';
import { PratenderPackage, VendorBidSubmission } from '@/types/pratender';
import { isNonMaterialOrSignature } from '@/utils/tenderSanitizer';

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

  let activePage = page;

  // Helper untuk menambah halaman baru secara dinamis jika baris item melebihi kapasitas
  const addNewPageIfOverflow = (neededHeight: number) => {
    if (curY - neededHeight < 40) {
      activePage = pdfDoc.addPage(PageSizes.A4);
      const { width: pWidth, height: pHeight } = activePage.getSize();

      activePage.drawRectangle({
        x: 0,
        y: pHeight - 45,
        width: pWidth,
        height: 45,
        color: rgb(0.06, 0.12, 0.24),
      });

      activePage.drawText('PT CINDARA PRATAMA LINES - DOKUMEN RKS (LANJUTAN)', {
        x: 40,
        y: pHeight - 22,
        size: 9,
        font: fontBold,
        color: rgb(1, 1, 1),
      });

      activePage.drawText(`KODE PAKET: ${pkg.packageNumber}   •   ${pkg.title}`, {
        x: 40,
        y: pHeight - 36,
        size: 7.5,
        font: fontRegular,
        color: rgb(0.7, 0.85, 1.0),
      });

      curY = pHeight - 65;

      // Gambar ulang Table Header di halaman baru
      activePage.drawRectangle({
        x: 40,
        y: curY - 18,
        width: pWidth - 80,
        height: 18,
        color: rgb(0.92, 0.94, 0.98),
      });

      activePage.drawText('NO', { x: 48, y: curY - 12, size: 7.5, font: fontBold, color: rgb(0.2, 0.25, 0.35) });
      activePage.drawText('NAMA BARANG / SPESIFIKASI', { x: 75, y: curY - 12, size: 7.5, font: fontBold, color: rgb(0.2, 0.25, 0.35) });
      activePage.drawText('VOLUME', { x: 330, y: curY - 12, size: 7.5, font: fontBold, color: rgb(0.2, 0.25, 0.35) });
      activePage.drawText('SATUAN', { x: 390, y: curY - 12, size: 7.5, font: fontBold, color: rgb(0.2, 0.25, 0.35) });
      activePage.drawText('UNIT / ARMADA', { x: 445, y: curY - 12, size: 7.5, font: fontBold, color: rgb(0.2, 0.25, 0.35) });

      curY -= 20;
      return true;
    }
    return false;
  };

  // Iterasi seluruh item material fisik valid (membersihkan baris footnote/signature jika ada)
  const validItems = (pkg.items || []).filter(
    (item) => !isNonMaterialOrSignature(item.itemName, item.itemId)
  );

  validItems.forEach((item, idx) => {
    addNewPageIfOverflow(25);

    const isEven = idx % 2 === 0;
    if (isEven) {
      activePage.drawRectangle({
        x: 40,
        y: curY - 14,
        width: width - 80,
        height: 16,
        color: rgb(0.98, 0.99, 1.0),
      });
    }

    activePage.drawText(String(idx + 1), { x: 50, y: curY - 9, size: 7.5, font: fontRegular, color: rgb(0.3, 0.35, 0.45) });
    activePage.drawText((item.itemName || '-').slice(0, 48), { x: 75, y: curY - 9, size: 7.5, font: fontBold, color: rgb(0.1, 0.15, 0.25) });
    activePage.drawText(String(item.totalQty || 1), { x: 335, y: curY - 9, size: 7.5, font: fontRegular, color: rgb(0.1, 0.15, 0.25) });
    activePage.drawText(item.satuan || 'Pcs', { x: 390, y: curY - 9, size: 7.5, font: fontRegular, color: rgb(0.3, 0.35, 0.45) });
    activePage.drawText(((item.vessels && item.vessels[0]) || 'Armada CPG').slice(0, 18), { x: 445, y: curY - 9, size: 7, font: fontRegular, color: rgb(0.3, 0.35, 0.45) });

    curY -= 17;
  });

  // Pastikan ada ruang cukup untuk Bagian Syarat & Tanda Tangan (butuh ~140px)
  addNewPageIfOverflow(150);

  curY -= 15;

  // Section B: Syarat & Ketentuan Umum
  activePage.drawText('B. PERSYARATAN & KETENTUAN PESERTA TENDER', {
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
    activePage.drawText(t, { x: 45, y: curY, size: 7.5, font: fontRegular, color: rgb(0.3, 0.35, 0.45) });
    curY -= 13;
  });

  // Footer Tanda Tangan
  curY -= 28;
  const signTopY = curY;

  activePage.drawText('Dibuat & Diterbitkan Oleh,', { x: 70, y: signTopY, size: 8, font: fontRegular, color: rgb(0.3, 0.35, 0.45) });
  activePage.drawText('Disetujui Oleh,', { x: 380, y: signTopY, size: 8, font: fontRegular, color: rgb(0.3, 0.35, 0.45) });

  const signOrgY = signTopY - 14;
  activePage.drawText('TIM PENGADAAN & PPIC CPG', { x: 70, y: signOrgY, size: 8.5, font: fontBold, color: rgb(0.1, 0.15, 0.25) });
  activePage.drawText('PURCHASING & FLEET LOGISTIC MGR', { x: 380, y: signOrgY, size: 8.5, font: fontBold, color: rgb(0.1, 0.15, 0.25) });

  const signBottomY = signOrgY - 44;
  activePage.drawLine({
    start: { x: 70, y: signBottomY + 12 },
    end: { x: 230, y: signBottomY + 12 },
    thickness: 0.75,
    color: rgb(0.75, 0.8, 0.85),
  });
  activePage.drawLine({
    start: { x: 380, y: signBottomY + 12 },
    end: { x: 540, y: signBottomY + 12 },
    thickness: 0.75,
    color: rgb(0.75, 0.8, 0.85),
  });

  activePage.drawText('( Staf Purchasing Desk )', { x: 70, y: signBottomY, size: 7.5, font: fontRegular, color: rgb(0.4, 0.45, 0.55) });
  activePage.drawText('( Pejabat Berwenang )', { x: 380, y: signBottomY, size: 7.5, font: fontRegular, color: rgb(0.4, 0.45, 0.55) });

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
    const isFailedA = a.technicalStatus === 'FAILED';
    const isFailedB = b.technicalStatus === 'FAILED';
    if (isFailedA && !isFailedB) return 1;
    if (!isFailedA && isFailedB) return -1;
    const pA = a.negotiatedGrandTotal || a.grandTotal;
    const pB = b.negotiatedGrandTotal || b.grandTotal;
    return pA - pB;
  });

  bidsList.forEach((bid, idx) => {
    const isDisqualified = bid.technicalStatus === 'FAILED';
    const isWinner = !isDisqualified && idx === 0;
    if (isWinner) {
      page.drawRectangle({
        x: 40,
        y: curY - 14,
        width: width - 80,
        height: 16,
        color: rgb(0.9, 0.98, 0.93),
      });
    } else if (isDisqualified) {
      page.drawRectangle({
        x: 40,
        y: curY - 14,
        width: width - 80,
        height: 16,
        color: rgb(0.99, 0.94, 0.94),
      });
    }

    const rankLabel = isDisqualified ? 'GUGUR' : `#${idx + 1}`;
    page.drawText(rankLabel, {
      x: 46,
      y: curY - 9,
      size: 7,
      font: fontBold,
      color: isWinner ? rgb(0.1, 0.6, 0.3) : isDisqualified ? rgb(0.8, 0.2, 0.2) : rgb(0.3, 0.35, 0.45),
    });
    const vendorDisplayName = isDisqualified
      ? `${(bid.vendorName || '-').slice(0, 24)} (GUGUR I)`
      : (bid.vendorName || '-').slice(0, 32);
    page.drawText(vendorDisplayName, {
      x: 85,
      y: curY - 9,
      size: 7.5,
      font: fontBold,
      color: isDisqualified ? rgb(0.7, 0.2, 0.2) : rgb(0.1, 0.15, 0.25),
    });
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
  curY -= 28;
  const signTopY = curY;

  page.drawText('Disusun Oleh (Evaluator):', { x: 70, y: signTopY, size: 8, font: fontRegular, color: rgb(0.3, 0.35, 0.45) });
  page.drawText('Disetujui Oleh (Approval Pemenang):', { x: 360, y: signTopY, size: 8, font: fontRegular, color: rgb(0.3, 0.35, 0.45) });

  const signOrgY = signTopY - 14;
  page.drawText('PANITIA PENGADAAN CPG', { x: 70, y: signOrgY, size: 8.5, font: fontBold, color: rgb(0.1, 0.15, 0.25) });
  page.drawText('DIREKSI / GENERAL MANAGER', { x: 360, y: signOrgY, size: 8.5, font: fontBold, color: rgb(0.1, 0.15, 0.25) });

  const signBottomY = signOrgY - 44;
  page.drawLine({
    start: { x: 70, y: signBottomY + 12 },
    end: { x: 230, y: signBottomY + 12 },
    thickness: 0.75,
    color: rgb(0.75, 0.8, 0.85),
  });
  page.drawLine({
    start: { x: 360, y: signBottomY + 12 },
    end: { x: 530, y: signBottomY + 12 },
    thickness: 0.75,
    color: rgb(0.75, 0.8, 0.85),
  });

  page.drawText('( Staf Purchasing & PPIC )', { x: 70, y: signBottomY, size: 7.5, font: fontRegular, color: rgb(0.4, 0.45, 0.55) });
  page.drawText('( Otoritas Penetapan Pemenang )', { x: 360, y: signBottomY, size: 7.5, font: fontRegular, color: rgb(0.4, 0.45, 0.55) });

  return await pdfDoc.save();
}

/**
 * 3. GENERATE DOKUMEN PURCHASE ORDER (PO AWARD) KEPADA PEMENANG TENDER
 */
export async function generatePoAwardDocumentPdf(
  pkg: PratenderPackage,
  poNumberOverride?: string
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);

  const page = pdfDoc.addPage(PageSizes.A4);
  const { width, height } = page.getSize();

  // Header Banner Biru Gelap Korporat
  page.drawRectangle({
    x: 0,
    y: height - 85,
    width,
    height: 85,
    color: rgb(0.04, 0.1, 0.22),
  });

  page.drawText('PT CINDARA PRATAMA LINES & GROUP', {
    x: 40,
    y: height - 32,
    size: 14,
    font: fontBold,
    color: rgb(1, 1, 1),
  });

  page.drawText('PURCHASE ORDER (PO) RESMI PENGADAAN & LOGISTIK ARMADA', {
    x: 40,
    y: height - 50,
    size: 9.5,
    font: fontBold,
    color: rgb(0.2, 0.75, 0.95),
  });

  const entityPrefix = (pkg.items && pkg.items[0]?.vessels?.[0]?.split(' ')[0]) || 'CPL';
  const cleanEntity = ['CPL', 'MO', 'HL', 'GAJ', 'SP'].includes(entityPrefix) ? entityPrefix : 'CPL';
  const poNumber =
    poNumberOverride ||
    pkg.poNumberGenerated ||
    `${cleanEntity}-PO-26-${String(Math.floor(10000 + Math.random() * 90000))}`;

  page.drawText(`NOMOR PO: ${poNumber}   •   REF PAKET: ${pkg.packageNumber}`, {
    x: 40,
    y: height - 68,
    size: 8.5,
    font: fontBold,
    color: rgb(0.9, 0.95, 1.0),
  });

  let curY = height - 110;

  // 2 Kolom Informasi: Kiri Vendor Pemenang, Kanan Pengiriman & Entitas CPG
  page.drawRectangle({
    x: 40,
    y: curY - 80,
    width: width - 80,
    height: 80,
    borderColor: rgb(0.8, 0.85, 0.9),
    borderWidth: 1,
    color: rgb(0.98, 0.99, 1.0),
  });

  const winner = (pkg.vendorBids && pkg.vendorBids.find((b) => b.id === pkg.evaluationSummary?.winningVendorId))
    || (pkg.vendorBids && pkg.vendorBids.find((b) => b.technicalStatus !== 'FAILED'))
    || (pkg.vendorBids && pkg.vendorBids[0])
    || null;
  const vendorName = pkg.evaluationSummary?.winningVendorName || pkg.awardedVendor || winner?.vendorName || 'PT. Vendor Pemenang Tender';
  const termOfPayment = winner?.termOfPayment || 'NET 30 Hari Setelah TTB';
  const leadTimeDays = winner?.deliveryLeadTimeDays || 4;
  const francoPoint = winner?.francoDeliveryPoint || 'Franco Somber Balikpapan';

  // Kolom Kiri (Vendor)
  page.drawText('KEPADA (VENDOR PEMENANG):', { x: 55, y: curY - 18, size: 8, font: fontBold, color: rgb(0.1, 0.45, 0.75) });
  page.drawText(vendorName.slice(0, 36), { x: 55, y: curY - 34, size: 10, font: fontBold, color: rgb(0.1, 0.15, 0.25) });
  page.drawText(`PIC: ${winner?.vendorPic || 'Bagian Pemasaran / Sales'}`, { x: 55, y: curY - 48, size: 7.5, font: fontRegular, color: rgb(0.3, 0.35, 0.45) });
  page.drawText(`Telp: ${winner?.vendorContact || '+62 812-xxxx-xxxx'}`, { x: 55, y: curY - 62, size: 7.5, font: fontRegular, color: rgb(0.3, 0.35, 0.45) });
  page.drawText(`No. Penawaran: ${winner?.quotationRefNo || 'BAFO/TDR/2026'}`, { x: 55, y: curY - 74, size: 7.5, font: fontRegular, color: rgb(0.3, 0.35, 0.45) });

  // Kolom Kanan (PO Detail & Franco)
  page.drawText('KETENTUAN PENGIRIMAN & PENAGIHAN:', { x: 320, y: curY - 18, size: 8, font: fontBold, color: rgb(0.1, 0.45, 0.75) });
  page.drawText(`Tanggal PO     : ${new Date().toLocaleDateString('id-ID', { dateStyle: 'long' })}`, { x: 320, y: curY - 34, size: 7.5, font: fontRegular, color: rgb(0.2, 0.25, 0.35) });
  page.drawText(`Titik Serah    : ${francoPoint.slice(0, 32)}`, { x: 320, y: curY - 48, size: 7.5, font: fontRegular, color: rgb(0.2, 0.25, 0.35) });
  page.drawText(`Waktu Kirim    : Maksimal ${leadTimeDays} Hari Kerja`, { x: 320, y: curY - 62, size: 7.5, font: fontBold, color: rgb(0.1, 0.15, 0.25) });
  page.drawText(`Term Pembayaran: ${termOfPayment}`, { x: 320, y: curY - 74, size: 7.5, font: fontBold, color: rgb(0.1, 0.55, 0.3) });

  curY -= 105;

  // Section Table: Rincian Barang yang Dipesan
  page.drawText('RINCIAN MATERIAL PENGADAAN (PURCHASE ORDER ITEMS)', {
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
  page.drawText('DESKRIPSI BARANG & SPESIFIKASI', { x: 75, y: curY - 12, size: 7.5, font: fontBold, color: rgb(0.2, 0.25, 0.35) });
  page.drawText('QTY', { x: 290, y: curY - 12, size: 7.5, font: fontBold, color: rgb(0.2, 0.25, 0.35) });
  page.drawText('SATUAN', { x: 330, y: curY - 12, size: 7.5, font: fontBold, color: rgb(0.2, 0.25, 0.35) });
  page.drawText('HARGA SATUAN', { x: 380, y: curY - 12, size: 7.5, font: fontBold, color: rgb(0.2, 0.25, 0.35) });
  page.drawText('TOTAL HARGA', { x: 470, y: curY - 12, size: 7.5, font: fontBold, color: rgb(0.2, 0.25, 0.35) });

  curY -= 20;

  let activePage = page;

  // Helper untuk menambah halaman baru jika tabel atau footer melebihi kapasitas
  const addNewPageIfOverflow = (neededHeight: number) => {
    if (curY - neededHeight < 40) {
      activePage = pdfDoc.addPage(PageSizes.A4);
      const { width: pWidth, height: pHeight } = activePage.getSize();
      activePage.drawRectangle({
        x: 0,
        y: pHeight - 45,
        width: pWidth,
        height: 45,
        color: rgb(0.04, 0.1, 0.22),
      });
      activePage.drawText(`PT CINDARA PRATAMA LINES - PURCHASE ORDER (LANJUTAN)`, {
        x: 40,
        y: pHeight - 22,
        size: 9,
        font: fontBold,
        color: rgb(1, 1, 1),
      });
      activePage.drawText(`NOMOR PO: ${poNumber}   •   REF PAKET: ${pkg.packageNumber}`, {
        x: 40,
        y: pHeight - 36,
        size: 7.5,
        font: fontRegular,
        color: rgb(0.7, 0.85, 1.0),
      });
      curY = pHeight - 65;
      return true;
    }
    return false;
  };

  let grandTotalPo = 0;
  const validPoItems = (pkg.items || []).filter(
    (item) => !isNonMaterialOrSignature(item.itemName, item.itemId)
  );
  validPoItems.forEach((item, idx) => {
    // Check if new row fits on current page
    const isNewPage = addNewPageIfOverflow(25);
    if (isNewPage) {
      activePage.drawRectangle({
        x: 40,
        y: curY - 18,
        width: width - 80,
        height: 18,
        color: rgb(0.92, 0.94, 0.98),
      });
      activePage.drawText('NO', { x: 48, y: curY - 12, size: 7.5, font: fontBold, color: rgb(0.2, 0.25, 0.35) });
      activePage.drawText('DESKRIPSI BARANG & SPESIFIKASI', { x: 75, y: curY - 12, size: 7.5, font: fontBold, color: rgb(0.2, 0.25, 0.35) });
      activePage.drawText('QTY', { x: 290, y: curY - 12, size: 7.5, font: fontBold, color: rgb(0.2, 0.25, 0.35) });
      activePage.drawText('SATUAN', { x: 330, y: curY - 12, size: 7.5, font: fontBold, color: rgb(0.2, 0.25, 0.35) });
      activePage.drawText('HARGA SATUAN', { x: 380, y: curY - 12, size: 7.5, font: fontBold, color: rgb(0.2, 0.25, 0.35) });
      activePage.drawText('TOTAL HARGA', { x: 470, y: curY - 12, size: 7.5, font: fontBold, color: rgb(0.2, 0.25, 0.35) });
      curY -= 20;
    }

    // Ambil harga satuan dari penawaran vendor jika ada, atau target price
    const vendorLine = winner?.items?.find((vi) => vi.itemId === item.itemId);
    const unitPrice = vendorLine && vendorLine.unitPrice > 0 ? vendorLine.unitPrice : (item.targetPrice || 0);
    const lineTotal = unitPrice * item.totalQty;
    grandTotalPo += lineTotal;

    const isEven = idx % 2 === 0;
    if (isEven) {
      activePage.drawRectangle({
        x: 40,
        y: curY - 14,
        width: width - 80,
        height: 16,
        color: rgb(0.98, 0.99, 1.0),
      });
    }

    activePage.drawText(String(idx + 1), { x: 50, y: curY - 9, size: 7.5, font: fontRegular, color: rgb(0.3, 0.35, 0.45) });
    activePage.drawText((item.itemName || '-').slice(0, 42), { x: 75, y: curY - 9, size: 7.5, font: fontBold, color: rgb(0.1, 0.15, 0.25) });
    activePage.drawText(String(item.totalQty || 1), { x: 295, y: curY - 9, size: 7.5, font: fontBold, color: rgb(0.1, 0.15, 0.25) });
    activePage.drawText(item.satuan || 'Pcs', { x: 330, y: curY - 9, size: 7.5, font: fontRegular, color: rgb(0.3, 0.35, 0.45) });
    activePage.drawText(formatRupiah(unitPrice), { x: 380, y: curY - 9, size: 7.5, font: fontRegular, color: rgb(0.2, 0.25, 0.35) });
    activePage.drawText(formatRupiah(lineTotal), { x: 470, y: curY - 9, size: 7.5, font: fontBold, color: rgb(0.1, 0.15, 0.25) });

    curY -= 17;
  });

  // Jika ada nilai awarded / negosiasi khusus, gunakan itu sebagai total akhir
  const finalPoVal =
    pkg.evaluationSummary?.winningAmount ||
    pkg.awardedValue ||
    (winner && (winner.negotiatedGrandTotal || winner.grandTotal)) ||
    grandTotalPo;

  // Pastikan ruang cukup untuk Box Total PO, Syarat Ketentuan, dan Tanda Tangan (butuh ~175 pt)
  addNewPageIfOverflow(175);

  // Box Total PO
  curY -= 6;
  activePage.drawRectangle({
    x: 350,
    y: curY - 22,
    width: width - 390,
    height: 22,
    borderColor: rgb(0.2, 0.7, 0.4),
    borderWidth: 1,
    color: rgb(0.94, 0.99, 0.96),
  });

  activePage.drawText('TOTAL PURCHASE ORDER:', { x: 360, y: curY - 14, size: 8, font: fontBold, color: rgb(0.1, 0.45, 0.25) });
  activePage.drawText(formatRupiah(finalPoVal), { x: 470, y: curY - 14, size: 9, font: fontBold, color: rgb(0.08, 0.5, 0.25) });

  curY -= 34;

  // Catatan Instruksi Pengantaran & Dokumen Penagihan
  activePage.drawText('SYARAT & KETENTUAN PENERIMAAN / PENAGIHAN VENDOR:', {
    x: 40,
    y: curY,
    size: 8.5,
    font: fontBold,
    color: rgb(0.08, 0.15, 0.3),
  });

  const poNotes = [
    '1. Surat Jalan & Invoice penagihan wajib mencantumkan Nomor PO resmi ini secara jelas.',
    '2. Pengiriman barang wajib diperiksa oleh Petugas Gudang / Tim TTB CPG dan diterbitkan Formulir TTB resmi.',
    '3. Penagihan (Invoice) wajib melampirkan berkas lengkap: Asli PO, Asli Surat Jalan / FSTB, dan Lembar Asli TTB.',
  ];

  curY -= 14;
  poNotes.forEach((n) => {
    activePage.drawText(n, { x: 45, y: curY, size: 7, font: fontRegular, color: rgb(0.3, 0.35, 0.45) });
    curY -= 11;
  });

  // Signatures PO - Jarak aman ke bawah tanpa tumpang tindih
  curY -= 24;
  const signTopY = curY;

  activePage.drawText('Dipesan Oleh (Purchasing):', { x: 60, y: signTopY, size: 7.5, font: fontRegular, color: rgb(0.3, 0.35, 0.45) });
  activePage.drawText('Disetujui Oleh (Management):', { x: 235, y: signTopY, size: 7.5, font: fontRegular, color: rgb(0.3, 0.35, 0.45) });
  activePage.drawText('Dikonfirmasi Oleh Vendor:', { x: 410, y: signTopY, size: 7.5, font: fontRegular, color: rgb(0.3, 0.35, 0.45) });

  const signOrgY = signTopY - 14;
  activePage.drawText('PT CINDARA PRATAMA LINES', { x: 60, y: signOrgY, size: 8, font: fontBold, color: rgb(0.1, 0.15, 0.25) });
  activePage.drawText('PURCHASING & LOGISTIC MGR', { x: 235, y: signOrgY, size: 8, font: fontBold, color: rgb(0.1, 0.15, 0.25) });
  activePage.drawText(vendorName.slice(0, 24).toUpperCase(), { x: 410, y: signOrgY, size: 8, font: fontBold, color: rgb(0.1, 0.15, 0.25) });

  const signBottomY = signOrgY - 44;

  activePage.drawLine({
    start: { x: 60, y: signBottomY + 12 },
    end: { x: 195, y: signBottomY + 12 },
    thickness: 0.75,
    color: rgb(0.75, 0.8, 0.85),
  });
  activePage.drawLine({
    start: { x: 235, y: signBottomY + 12 },
    end: { x: 370, y: signBottomY + 12 },
    thickness: 0.75,
    color: rgb(0.75, 0.8, 0.85),
  });
  activePage.drawLine({
    start: { x: 410, y: signBottomY + 12 },
    end: { x: 545, y: signBottomY + 12 },
    thickness: 0.75,
    color: rgb(0.75, 0.8, 0.85),
  });

  activePage.drawText('( Bagian Pengadaan / Purchasing )', { x: 60, y: signBottomY, size: 7, font: fontRegular, color: rgb(0.4, 0.45, 0.55) });
  activePage.drawText('( Pejabat Berwenang )', { x: 235, y: signBottomY, size: 7, font: fontRegular, color: rgb(0.4, 0.45, 0.55) });
  activePage.drawText('( Tanda Tangan & Cap Perusahaan )', { x: 410, y: signBottomY, size: 7, font: fontRegular, color: rgb(0.4, 0.45, 0.55) });

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
