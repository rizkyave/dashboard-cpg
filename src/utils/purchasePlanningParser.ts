import * as XLSX from 'xlsx';
import { PurchasePlanningItem, PurchasePlanningResponse } from '@/app/api/purchase-planning/route';

/**
 * Estimasi harga satuan wajar berbasis kategori & nama barang jika di file tidak ada kolom harga
 */
export function estimateUnitPrice(name: string, category: string): number {
  const n = name.toUpperCase();
  const c = category.toUpperCase();

  if (n.includes('TALI') || n.includes('MOORING') || n.includes('ROPE')) return 12500000;
  if (n.includes('MEDITRAN') || n.includes('TURALIK') || n.includes('OLI') || n.includes('OIL') || n.includes('LUBRICANT')) {
    if (n.includes('DRUM') || n.includes('209')) return 8500000;
    if (n.includes('PAIL') || n.includes('20')) return 950000;
    return 150000;
  }
  if (n.includes('FILTER') || n.includes('ELEMENT')) return 650000;
  if (n.includes('HARNEST') || n.includes('HARNESS') || n.includes('SAFETY BELT')) return 750000;
  if (n.includes('RELAY') || n.includes('OMRON')) return 185000;
  if (n.includes('DETERJEN') || n.includes('SABUN') || n.includes('CLEANING')) return 45000;
  if (n.includes('APAR') || n.includes('POWDER 9')) return 685000;
  if (n.includes('CAT') || n.includes('PAINT') || n.includes('EPOXY')) return 2450000;
  if (n.includes('ACCU') || n.includes('BATTERY') || n.includes('AKI')) return 1850000;
  if (n.includes('IMPELLER') || n.includes('POMPA')) return 3500000;
  if (n.includes('BEARING')) return 450000;
  if (n.includes('PACKING') || n.includes('GASKET')) return 250000;
  if (n.includes('KABEL')) return 120000;
  if (n.includes('SEPATU SAFETY') || n.includes('BOOTS')) return 350000;
  if (n.includes('HELM SAFETY')) return 85000;

  if (c.includes('SUKU CADANG') || c.includes('MECHANICAL')) return 1250000;
  if (c.includes('ELECTRICAL')) return 350000;
  if (c.includes('CONSUMABLE')) return 85000;
  if (c.includes('SAFETY')) return 250000;

  return 150000;
}

/**
 * Estimasi lead time pengadaan (hari) berbasis kategori
 */
export function estimateLeadTime(category: string): number {
  const c = category.toUpperCase();
  if (c.includes('SUKU CADANG') || c.includes('MECHANICAL') || c.includes('MESIN')) return 14;
  if (c.includes('ELECTRICAL')) return 10;
  if (c.includes('MOORING') || c.includes('DECK')) return 10;
  if (c.includes('SAFETY') || c.includes('K3')) return 7;
  if (c.includes('CONSUMABLE') || c.includes('PELUMAS')) return 4;
  return 7;
}

/**
 * Estimasi persentase diskon pembelian borongan (bulk tender)
 */
export function estimateBulkDiscount(qty: number): number {
  if (qty >= 50) return 15.0;
  if (qty >= 20) return 12.0;
  if (qty >= 10) return 8.5;
  if (qty >= 5) return 5.0;
  return 3.0;
}

/**
 * Parser file Excel / CSV Purchase Planning (mendukung format Accurate & Batch CPG)
 */
export function parsePurchasePlanningWorkbook(workbook: XLSX.WorkBook): PurchasePlanningResponse {
  // 1. Pilih sheet target
  let targetSheetName =
    workbook.SheetNames.find((n) => n.toUpperCase().includes('DETAIL')) ||
    workbook.SheetNames.find((n) => n.toUpperCase().includes('PLANNING')) ||
    workbook.SheetNames.find((n) => n.toUpperCase().includes('PERENCANAAN')) ||
    workbook.SheetNames[0];

  const sheet = workbook.Sheets[targetSheetName];
  if (!sheet) {
    throw new Error('Sheet data perencanaan tidak ditemukan pada berkas Excel.');
  }

  const rawData = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1, defval: '' });
  if (rawData.length === 0) {
    throw new Error('Berkas Excel kosong atau tidak memiliki data.');
  }

  // 2. Deteksi baris header
  let headerIdx = -1;
  for (let i = 0; i < Math.min(20, rawData.length); i++) {
    const rowStr = rawData[i].map((c) => String(c).toUpperCase().trim());
    if (
      rowStr.includes('KODE BARANG') ||
      rowStr.includes('NO. BARANG') ||
      rowStr.includes('NO BARANG') ||
      rowStr.includes('ITEM NO') ||
      (rowStr.includes('NAMA BARANG') && (rowStr.includes('JML FPB') || rowStr.includes('QTY') || rowStr.includes('SATUAN')))
    ) {
      headerIdx = i;
      break;
    }
  }

  if (headerIdx === -1) {
    // Fallback: gunakan baris 0 jika tidak ada keyword jelas
    headerIdx = 0;
  }

  const headers = rawData[headerIdx].map((c) => String(c).trim());

  const colIndex = (aliases: string[]) => {
    for (let i = 0; i < headers.length; i++) {
      const h = headers[i].toUpperCase();
      if (aliases.some((a) => a.toUpperCase() === h || h.includes(a.toUpperCase()))) return i;
    }
    return -1;
  };

  const cCode = colIndex(['KODE BARANG', 'NO. BARANG', 'NO BARANG', 'ITEM NO', 'KODE']);
  const cName = colIndex(['NAMA BARANG', 'KETERANGAN BARANG', 'DESKRIPSI', 'DESCRIPTION', 'ITEM NAME']);
  const cQty = colIndex(['JML FPB', 'QTY FPB', 'QTY', 'JUMLAH', 'KUANTITAS', 'KEBUTUHAN ARMADA', 'REKOMENDASI BELI']);
  const cUnit = colIndex(['SATUAN', 'UNIT', 'UOM']);
  const cCat = colIndex(['KATEGORI', 'CATEGORY', 'ITEM CATEGORY']);
  const cUnitDept = colIndex(['DEPARTEMEN / UNIT', 'DEPARTEMEN', 'ARMADA', 'UNIT', 'KAPAL', 'SITE']);
  const cFpb = colIndex(['NO. FPB', 'NO FPB', 'FPB', 'REFERENSI NO. FPB']);
  const cPrio = colIndex(['PRIORITAS', 'PRIORITY', 'TINGKAT URGENSI']);
  const cKet = colIndex(['KETERANGAN', 'CATATAN', 'NOTES']);
  const cBatch = colIndex(['BATCH ID', 'BATCH', 'BATCH NO', 'BATCH NUMBER', 'NO. BATCH', 'NO BATCH', 'ID BATCH']);
  const cPemohon = colIndex(['PEMOHON', 'REQUESTER']);
  const cStock = colIndex(['BARANG STOCK LOGISTIK', 'STOK GUDANG', 'CURRENT STOCK', 'STOK', 'STOK GUDANG SOMBER']);
  const cPrice = colIndex(['HARGA SATUAN', 'ESTIMASI HARGA', 'HARGA', 'PRICE', 'UNIT PRICE']);
  const cVendor = colIndex(['VENDOR', 'REKOMENDASI VENDOR', 'PEMASOK', 'SUGGESTED VENDOR']);

  const consolidatedMap = new Map<string, {
    itemCode: string;
    itemName: string;
    category: string;
    unit: string;
    currentStock: number;
    totalRequestedQty: number;
    requestingVessels: Set<string>;
    fpbRefs: Set<string>;
    priorities: Set<string>;
    keteranganList: Set<string>;
    batchId: string;
    pemohon: string;
    unitPriceFromExcel: number;
    vendorFromExcel: string;
  }>();

  const APPROVAL_KEYWORDS = [
    '##AKHIR DATA',
    'AKHIR DATA',
    'END OF DATA',
  ];

  const APPROVAL_BLACKLIST = new Set([
    'ACKNOWLEDGE',
    'REVIEWER',
    'REVIEWER I',
    'REVIEWER II',
    'HERMANSYAH',
    'MELINDA',
    'NOORHASANAH',
    'NOOR HASANAH',
    'MENGETAHUI',
    'DISETUJUI',
    'DIBUAT OLEH',
    'TANDA TANGAN',
    'APPROVER',
  ]);

  for (let r = headerIdx + 1; r < rawData.length; r++) {
    const row = rawData[r];
    if (!row || row.length === 0) continue;

    const rowStr = row.map((cell) => String(cell || '').trim()).join(' ').toUpperCase();

    // 1. Jika mencapai penanda akhir data tabel, hentikan iterasi (blok tanda tangan / footer ada di bawahnya)
    if (APPROVAL_KEYWORDS.some((kw) => rowStr.includes(kw))) {
      break;
    }

    // 2. Abaikan baris validasi tanda tangan / reviewer
    if (
      rowStr.includes('REVIEWER I') ||
      rowStr.includes('REVIEWER II') ||
      rowStr.includes('ACKNOWLEDGE') ||
      rowStr.includes('TANDA TANGAN')
    ) {
      continue;
    }

    const rawName = cName !== -1 ? String(row[cName] || '').trim() : '';
    const rawCode = cCode !== -1 ? String(row[cCode] || '').trim() : '';
    if (!rawName && !rawCode) continue;

    // 3. Abaikan baris heading atau nama reviewer / pejabat persetujuan
    const normName = rawName.toUpperCase().trim();
    const normCode = rawCode.toUpperCase().trim();
    if (normName.includes('NAMA BARANG') || normCode.includes('KODE BARANG')) continue;
    if (APPROVAL_BLACKLIST.has(normName) || APPROVAL_BLACKLIST.has(normCode)) continue;

    // 4. Validasi baris item fisik (harus ada kode barang, nomor FPB, atau satuan/qty yang jelas)
    if (!rawCode && !row[cFpb] && !row[cUnit]) continue;

    const key = rawCode || rawName;
    const qty = Math.max(0, Number(row[cQty]) || 0);
    const unit = cUnit !== -1 && row[cUnit] ? String(row[cUnit]).trim() : 'PCS';
    const category = cCat !== -1 && row[cCat] ? String(row[cCat]).trim() : 'General';
    const dept = cUnitDept !== -1 && row[cUnitDept] ? String(row[cUnitDept]).trim() : '';
    const fpb = cFpb !== -1 && row[cFpb] ? String(row[cFpb]).trim() : '';
    const prio = cPrio !== -1 && row[cPrio] ? String(row[cPrio]).trim().toUpperCase() : 'P3';
    const ket = cKet !== -1 && row[cKet] ? String(row[cKet]).trim() : '';
    const batchId = cBatch !== -1 && row[cBatch] ? String(row[cBatch]).trim() : 'CPL-PP-2026-001';
    const pemohon = cPemohon !== -1 && row[cPemohon] ? String(row[cPemohon]).trim() : '';
    const stock = cStock !== -1 && row[cStock] !== '' && !isNaN(Number(row[cStock])) ? Number(row[cStock]) : 0;
    const price = cPrice !== -1 && row[cPrice] !== '' && !isNaN(Number(row[cPrice])) ? Number(row[cPrice]) : 0;
    const vendor = cVendor !== -1 && row[cVendor] ? String(row[cVendor]).trim() : '';

    if (!consolidatedMap.has(key)) {
      consolidatedMap.set(key, {
        itemCode: rawCode || `ITEM-${key.replace(/[^a-zA-Z0-9]/g, '').slice(0, 10).toUpperCase()}`,
        itemName: rawName || rawCode,
        category: category || 'General',
        unit: unit || 'PCS',
        currentStock: stock,
        totalRequestedQty: 0,
        requestingVessels: new Set<string>(),
        fpbRefs: new Set<string>(),
        priorities: new Set<string>(),
        keteranganList: new Set<string>(),
        batchId: batchId || 'CPL-PP-2026-001',
        pemohon: pemohon || '',
        unitPriceFromExcel: price,
        vendorFromExcel: vendor,
      });
    }

    const itemRecord = consolidatedMap.get(key)!;
    itemRecord.totalRequestedQty += qty > 0 ? qty : 1;
    if (stock > itemRecord.currentStock) itemRecord.currentStock = stock;
    if (price > 0) itemRecord.unitPriceFromExcel = price;
    if (vendor) itemRecord.vendorFromExcel = vendor;
    if (dept) itemRecord.requestingVessels.add(dept);
    if (fpb) itemRecord.fpbRefs.add(fpb);
    if (prio) itemRecord.priorities.add(prio);
    if (ket) itemRecord.keteranganList.add(ket);
  }

  if (consolidatedMap.size === 0) {
    throw new Error('Tidak ditemukan baris barang yang valid pada berkas Excel.');
  }

  // 3. Transform ke PurchasePlanningItem
  const items: PurchasePlanningItem[] = Array.from(consolidatedMap.values()).map((c, idx) => {
    const vessels = Array.from(c.requestingVessels);
    const fpbs = Array.from(c.fpbRefs);
    const priorities = Array.from(c.priorities);
    const notes = Array.from(c.keteranganList).filter(Boolean).join(' | ');

    // Rekomendasi kuantitas beli (Net Demand)
    const netDemand = Math.max(0, c.totalRequestedQty - c.currentStock);
    const recommendedOrderQty = netDemand > 0 ? netDemand : c.totalRequestedQty;

    // Evaluasi Urgensi (P1 -> CRITICAL, P2 -> REORDER, P3 -> PLANNED)
    let urgency: 'CRITICAL' | 'REORDER' | 'PLANNED' = 'PLANNED';
    let urgencyReason = '';

    if (priorities.includes('P1') || (c.currentStock === 0 && c.totalRequestedQty >= 5)) {
      urgency = 'CRITICAL';
      urgencyReason = `Prioritas Darurat P1 dari ${vessels.length} unit. Stok gudang ${c.currentStock} ${c.unit}.`;
    } else if (priorities.includes('P2') || c.currentStock < c.totalRequestedQty) {
      urgency = 'REORDER';
      urgencyReason = `Kebutuhan operasional ${vessels.length} armada/unit. Stok gudang tidak mencukupi permintaan (${c.totalRequestedQty} ${c.unit}).`;
    } else {
      urgency = 'PLANNED';
      urgencyReason = `Rencana belanja rutin armada. Stok gudang saat ini: ${c.currentStock} ${c.unit}.`;
    }

    if (notes) {
      urgencyReason += ` (${notes.slice(0, 60)})`;
    }

    const avgUnitPrice = c.unitPriceFromExcel > 0 ? c.unitPriceFromExcel : estimateUnitPrice(c.itemName, c.category);
    const totalEstimatedCost = recommendedOrderQty * avgUnitPrice;
    const leadTimeDays = estimateLeadTime(c.category);
    const potentialBulkDiscount = estimateBulkDiscount(recommendedOrderQty);
    const potentialSavingsAmount = Math.round(totalEstimatedCost * (potentialBulkDiscount / 100));

    return {
      id: `plan-${String(idx + 1).padStart(3, '0')}`,
      itemCode: c.itemCode,
      itemName: c.itemName,
      category: c.category,
      unit: c.unit,
      currentStock: c.currentStock,
      openFpbCount: fpbs.length > 0 ? fpbs.length : 1,
      requestingVessels: vessels.length > 0 ? vessels : ['Armada / Unit CPG'],
      totalRequestedQty: c.totalRequestedQty,
      recommendedOrderQty,
      avgUnitPrice,
      totalEstimatedCost,
      urgency,
      urgencyReason,
      leadTimeDays,
      potentialBulkDiscount,
      potentialSavingsAmount,
      reorderPoint: Math.max(1, Math.ceil(c.totalRequestedQty * 0.3)),
      monthlyConsumption: Math.max(1, Math.ceil(c.totalRequestedQty * 0.5)),
      suggestedVendor: c.vendorFromExcel || (c.category.includes('Pelumas') ? 'PT. Pertamina Lubricants' : 'Distributor Resmi / Rekanan CPG'),
      fpbRefs: fpbs,
      batchNo: c.batchId || 'CPL-PP-2026-001',
    };
  });

  // 4. Hitung Summary
  const criticalCount = items.filter((i) => i.urgency === 'CRITICAL').length;
  const reorderCount = items.filter((i) => i.urgency === 'REORDER').length;
  const plannedCount = items.filter((i) => i.urgency === 'PLANNED').length;

  const totalEstimatedBudget = items.reduce((sum, i) => sum + i.totalEstimatedCost, 0);
  const totalPotentialSavings = items.reduce((sum, i) => sum + i.potentialSavingsAmount, 0);

  const vesselsSet = new Set<string>();
  items.forEach((i) => i.requestingVessels.forEach((v) => vesselsSet.add(v)));

  const categories = Array.from(new Set(items.map((i) => i.category))).sort();

  return {
    success: true,
    timestamp: new Date().toISOString(),
    summary: {
      totalItems: items.length,
      criticalCount,
      reorderCount,
      plannedCount,
      totalEstimatedBudget,
      totalPotentialSavings,
      activeVesselsCount: vesselsSet.size,
    },
    categories,
    items,
  };
}

