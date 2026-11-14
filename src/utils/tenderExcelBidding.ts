import * as XLSX from 'xlsx';
import { PratenderPackage, VendorBidItem } from '@/types/pratender';
import { isNonMaterialOrSignature } from '@/utils/tenderSanitizer';

/**
 * Generate Excel file template untuk penawaran harga rekanan (Bidding Sheet)
 */
export function generateTenderBiddingExcel(pkg: PratenderPackage, vendorName: string = ''): void {
  const wb = XLSX.utils.book_new();

  // Validasi & filter ketat: hanya item material fisik yang masuk ke sheet Excel
  const validItems = (pkg.items || []).filter(
    (item) => !isNonMaterialOrSignature(item.itemName, item.itemId)
  );

  // Header info
  const sheetData: any[][] = [
    ['FORMULIR PENAWARAN HARGA RESMI REKANAN (COMMERCIAL QUOTATION)'],
    ['PT CINDARA PRATAMA LINES - SISTEM PENGADAAN & LOGISTIK ARMADA'],
    [],
    ['Nomor Tender / RFQ', pkg.packageNumber],
    ['Nama Paket Pengadaan', pkg.title],
    ['Kategori Pengadaan', pkg.category],
    ['Batas Akhir Penawaran', pkg.targetClosingDate || 'Sesuai Jadwal RKS'],
    ['Nama Perusahaan Rekanan', vendorName || 'Diisi Nama Vendor'],
    ['Nomor Surat Penawaran (Quotation No)', 'Diisi No Penawaran Resmi'],
    ['Term of Payment (TOP)', 'NET 30 Hari'],
    ['Lead Time Pengiriman (Hari)', 7],
    ['Franco Penyerahan', 'Gudang Somber Balikpapan / Dermaga CPG'],
    [],
    [
      'PETUNJUK REKANAN: Isi kolom "Merk Ditawarkan", "Harga Satuan Penawaran (Rp)", dan "Catatan Spesifikasi". Jangan mengubah Kode Item atau Kuantitas Kebutuhan.',
    ],
    [],
    // Table Headers
    [
      'No',
      'Kode Item',
      'Deskripsi Material / Spesifikasi Kebutuhan',
      'Satuan',
      'Kuantitas Kebutuhan',
      'Merk / Brand Ditawarkan (Vendor)',
      'Harga Satuan Penawaran (Rp)',
      'Total Harga Penawaran (Rp)',
      'Catatan / Garansi / Lead Time Vendor',
    ],
  ];

  // Rows
  const startRowIdx = sheetData.length + 1; // 1-indexed Excel row
  validItems.forEach((item, idx) => {
    const rowNum = startRowIdx + idx;
    sheetData.push([
      idx + 1,
      item.itemId,
      item.itemName,
      item.satuan,
      item.totalQty,
      '', // Merk ditawarkan (kosong untuk diisi vendor)
      '', // Harga satuan (kosong untuk diisi vendor)
      { f: `E${rowNum}*G${rowNum}` }, // Formula Total = Qty * Harga
      item.notes || '',
    ]);
  });

  // Summary Rows
  const lastItemRow = startRowIdx + Math.max(validItems.length - 1, 0);
  sheetData.push([]);
  sheetData.push([
    '',
    '',
    '',
    '',
    '',
    '',
    'SUBTOTAL PENAWARAN (Rp):',
    { f: `SUM(H${startRowIdx}:H${lastItemRow})` },
    '',
  ]);
  sheetData.push([
    '',
    '',
    '',
    '',
    '',
    '',
    'PPN 11% (Rp):',
    { f: `H${lastItemRow + 2}*0.11` },
    '',
  ]);
  sheetData.push([
    '',
    '',
    '',
    '',
    '',
    '',
    'GRAND TOTAL PENAWARAN (Rp):',
    { f: `H${lastItemRow + 2}+H${lastItemRow + 3}` },
    '',
  ]);

  const ws = XLSX.utils.aoa_to_sheet(sheetData);

  // Styling column widths
  ws['!cols'] = [
    { wch: 6 }, // No
    { wch: 20 }, // Kode Item
    { wch: 45 }, // Deskripsi
    { wch: 10 }, // Satuan
    { wch: 18 }, // Qty
    { wch: 25 }, // Merk
    { wch: 24 }, // Harga Satuan
    { wch: 24 }, // Total
    { wch: 35 }, // Catatan
  ];

  XLSX.utils.book_append_sheet(wb, ws, 'Penawaran Rekanan');

  const cleanNo = pkg.packageNumber.replace(/[^a-zA-Z0-9_-]/g, '_');
  const filename = `BLANKO_PENAWARAN_HARGA_${cleanNo}.xlsx`;
  XLSX.writeFile(wb, filename);
}

/**
 * Parsing file Excel yang diunggah oleh rekanan untuk otomatisasi pengisian quotation
 */
export function parseTenderBiddingExcel(
  fileBuffer: ArrayBuffer,
  pkg: PratenderPackage
): {
  success: boolean;
  message?: string;
  items?: VendorBidItem[];
  subtotal?: number;
  ppnAmount?: number;
  grandTotal?: number;
  vendorName?: string;
  quotationRefNo?: string;
  termOfPayment?: string;
  leadTimeDays?: number;
} {
  try {
    const wb = XLSX.read(fileBuffer, { type: 'array' });
    const sheetName = wb.SheetNames[0];
    if (!sheetName) {
      return { success: false, message: 'Lembar kerja (sheet) tidak ditemukan dalam file Excel.' };
    }

    const ws = wb.Sheets[sheetName];
    const rawRows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

    if (!rawRows || rawRows.length < 5) {
      return { success: false, message: 'Format file Excel tidak sesuai dengan template tender CPG.' };
    }

    // Ekstrak metadata rekanan jika ada di header
    let extractedVendorName = '';
    let extractedQuotationRef = '';
    let extractedTop = 'NET 30 Hari';
    let extractedLeadTime = 7;

    rawRows.slice(0, 15).forEach((row) => {
      const label = String(row[0] || '').toLowerCase();
      const val = row[1];
      if (label.includes('nama perusahaan rekanan') && val) extractedVendorName = String(val).trim();
      if (label.includes('nomor surat penawaran') && val) extractedQuotationRef = String(val).trim();
      if (label.includes('term of payment') && val) extractedTop = String(val).trim();
      if (label.includes('lead time') && typeof val === 'number') extractedLeadTime = val;
    });

    // Cari baris header tabel ("Kode Item", "Harga Satuan")
    let headerRowIdx = -1;
    for (let r = 0; r < rawRows.length; r++) {
      const row = rawRows[r].map((cell: any) => String(cell || '').toLowerCase().trim());
      if (row.includes('kode item') || row.includes('harga satuan penawaran (rp)')) {
        headerRowIdx = r;
        break;
      }
    }

    if (headerRowIdx === -1) {
      return {
        success: false,
        message: 'Tabel penawaran harga tidak ditemukan. Pastikan menggunakan format template resmi CPG.',
      };
    }

    const header = rawRows[headerRowIdx].map((c: any) => String(c || '').toLowerCase().trim());
    const kodeItemCol = header.findIndex((h: string) => h.includes('kode item'));
    const brandCol = header.findIndex((h: string) => h.includes('merk') || h.includes('brand'));
    const priceCol = header.findIndex((h: string) => h.includes('harga satuan'));
    const notesCol = header.findIndex((h: string) => h.includes('catatan') || h.includes('spesifikasi'));

    const parsedItems: VendorBidItem[] = [];
    let subtotal = 0;

    // Map existing pkg items by itemId (hanya valid material items)
    const validPkgItems = (pkg.items || []).filter(
      (it) => !isNonMaterialOrSignature(it.itemName, it.itemId)
    );
    const itemMap = new Map(validPkgItems.map((it) => [it.itemId.trim().toLowerCase(), it]));

    for (let r = headerRowIdx + 1; r < rawRows.length; r++) {
      const row = rawRows[r];
      if (!row || row.length === 0) continue;

      const rowText = row.join(' ').toLowerCase();
      if (rowText.includes('subtotal') || rowText.includes('grand total')) break;

      const rawCode = kodeItemCol !== -1 ? String(row[kodeItemCol] || '').trim().toLowerCase() : '';
      if (!rawCode) continue;

      const targetPkgItem = itemMap.get(rawCode);
      if (!targetPkgItem) continue;

      const rawPrice = priceCol !== -1 ? Number(row[priceCol]) || 0 : 0;
      const rawBrand = brandCol !== -1 ? String(row[brandCol] || '').trim() : '';
      const rawNotes = notesCol !== -1 ? String(row[notesCol] || '').trim() : '';

      const lineTotal = targetPkgItem.totalQty * rawPrice;
      subtotal += lineTotal;

      parsedItems.push({
        itemId: targetPkgItem.itemId,
        itemName: targetPkgItem.itemName,
        qty: targetPkgItem.totalQty,
        unitPrice: rawPrice,
        totalPrice: lineTotal,
        brandOffered: rawBrand || undefined,
        notes: rawNotes || undefined,
        compliance: 'COMPLIANT',
      });
    }

    if (parsedItems.length === 0) {
      return {
        success: false,
        message: 'Tidak ada item tender yang cocok atau harga penawaran belum diisi.',
      };
    }

    const ppnAmount = Math.round(subtotal * 0.11);
    const grandTotal = subtotal + ppnAmount;

    return {
      success: true,
      items: parsedItems,
      subtotal,
      ppnAmount,
      grandTotal,
      vendorName: extractedVendorName || undefined,
      quotationRefNo: extractedQuotationRef || undefined,
      termOfPayment: extractedTop,
      leadTimeDays: extractedLeadTime,
    };
  } catch (err: any) {
    return {
      success: false,
      message: `Gagal membaca file Excel: ${err.message || 'Format tidak valid'}`,
    };
  }
}
