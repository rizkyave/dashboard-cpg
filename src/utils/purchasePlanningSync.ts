import fs from 'fs';
import path from 'path';
import * as XLSX from 'xlsx';
import {
  PurchasePlanningItem,
  PurchasePlanningResponse,
  PurchasePlanningSyncStats,
} from '@/app/api/purchase-planning/route';
import {
  parsePurchasePlanningWorkbook,
  estimateUnitPrice,
  estimateLeadTime,
  estimateBulkDiscount,
} from '@/utils/purchasePlanningParser';
import { FpbReviewRecord } from '@/types/fpbReview';

const STORAGE_FILE_PATH = path.join(process.cwd(), 'src', 'data', 'purchase-planning-data.json');
const DESKTOP_CANDIDATE_PATH = 'C:\\Users\\Hermansyah\\OneDrive\\Desktop\\PURCHASE_PLANNING_BATCH_001_CPG.xlsx';
const REVIEWS_FILE_PATH = path.join(process.cwd(), 'src', 'data', 'fpb-reviews.json');
const INVENTORY_FILE_PATH = path.join(process.cwd(), 'src', 'data', 'initialInventoryData.json');

/**
 * Estimasi kategori barang berdasarkan nama jika tidak tersedia di e-FPB
 */
function estimateCategoryFromName(name: string): string {
  const n = name.toUpperCase();
  if (n.includes('TALI') || n.includes('MOORING') || n.includes('ROPE') || n.includes('WIRE')) {
    return 'Mooring & Deck Equipment';
  }
  if (n.includes('OLI') || n.includes('OIL') || n.includes('MEDITRAN') || n.includes('TURALIK') || n.includes('LUBRICANT') || n.includes('GREASE')) {
    return 'Consumable';
  }
  if (n.includes('SEPATU') || n.includes('HELM') || n.includes('HARNEST') || n.includes('SAFETY') || n.includes('APAR') || n.includes('GLOVES')) {
    return 'General';
  }
  if (n.includes('FILTER') || n.includes('PACKING') || n.includes('GASKET') || n.includes('IMPELLER') || n.includes('BEARING') || n.includes('NOZZLE')) {
    return 'Mechanical';
  }
  if (n.includes('LAMPU') || n.includes('KABEL') || n.includes('RELAY') || n.includes('SWITCH') || n.includes('MCB') || n.includes('BATTERY') || n.includes('ACCU')) {
    return 'Electrical';
  }
  if (n.includes('CAT') || n.includes('THINNER') || n.includes('KUAS') || n.includes('DETERJEN') || n.includes('MAJUN') || n.includes('SABUN')) {
    return 'Consumable';
  }
  return 'General';
}

/**
 * Ambil status ketersediaan file desktop
 */
export function getDesktopFileInfo(): {
  available: boolean;
  fileName: string;
  filePath: string;
  lastModified?: string;
  sizeBytes?: number;
} {
  try {
    if (fs.existsSync(DESKTOP_CANDIDATE_PATH)) {
      const stat = fs.statSync(DESKTOP_CANDIDATE_PATH);
      return {
        available: true,
        fileName: path.basename(DESKTOP_CANDIDATE_PATH),
        filePath: DESKTOP_CANDIDATE_PATH,
        lastModified: stat.mtime.toISOString(),
        sizeBytes: stat.size,
      };
    }
  } catch (err) {
    console.warn('Gagal membaca info file Desktop:', err);
  }
  return {
    available: false,
    fileName: 'PURCHASE_PLANNING_BATCH_001_CPG.xlsx',
    filePath: DESKTOP_CANDIDATE_PATH,
  };
}

/**
 * Dapatkan statistik sinkronisasi terkini
 */
export function getSyncStats(currentResponse?: PurchasePlanningResponse): PurchasePlanningSyncStats {
  const desktopInfo = getDesktopFileInfo();
  let currentItems: PurchasePlanningItem[] = [];

  if (currentResponse && currentResponse.items) {
    currentItems = currentResponse.items;
  } else if (fs.existsSync(STORAGE_FILE_PATH)) {
    try {
      const parsed: PurchasePlanningResponse = JSON.parse(fs.readFileSync(STORAGE_FILE_PATH, 'utf-8'));
      currentItems = parsed.items || [];
    } catch {}
  }

  // Hitung jumlah item per kategori sumber
  let desktopCount = 0;
  let efpbCount = 0;
  let hybridCount = 0;

  const incorporatedFpbRefs = new Set<string>();

  currentItems.forEach((item) => {
    if (item.dataSource === 'HYBRID_CONSOLIDATED') {
      hybridCount++;
    } else if (item.dataSource === 'EFPB_LIVE') {
      efpbCount++;
    } else {
      desktopCount++;
    }

    (item.fpbRefs || []).forEach((ref) => incorporatedFpbRefs.add(ref));
  });

  // Hitung pending e-FPBs
  let pendingApprovedFpbsCount = 0;
  let pendingPoItemsCount = 0;

  if (fs.existsSync(REVIEWS_FILE_PATH)) {
    try {
      const reviews: FpbReviewRecord[] = JSON.parse(fs.readFileSync(REVIEWS_FILE_PATH, 'utf-8'));
      const approvedReviews = reviews.filter(
        (r) => r.isReceivedLogistik || r.reviewStatus === 'APPROVED_PO' || (r.items && r.items.some((i) => i.decision === 'PO'))
      );

      for (const r of approvedReviews) {
        if (!r.fpbNo) continue;
        const poItems = (r.items || []).filter(
          (i) => i.decision === 'PO' || (r.reviewStatus === 'APPROVED_PO' && i.decision !== 'STOCK' && i.decision !== 'REJECT')
        );

        if (poItems.length > 0 && !incorporatedFpbRefs.has(r.fpbNo)) {
          pendingApprovedFpbsCount++;
          pendingPoItemsCount += poItems.length;
        }
      }
    } catch (err) {
      console.warn('Gagal menghitung pending e-FPB:', err);
    }
  }

  return {
    desktopCount,
    efpbCount,
    hybridCount,
    pendingApprovedFpbsCount,
    pendingPoItemsCount,
    lastSyncedAt: new Date().toISOString(),
    desktopFileAvailable: desktopInfo.available,
    desktopFileName: desktopInfo.fileName,
    desktopLastModified: desktopInfo.lastModified,
  };
}

/**
 * Eksekusi Sinkronisasi Hybrid:
 * Menggabungkan basis Excel Desktop (atau data perencanaan berjalan) dengan e-FPB yang telah disetujui Logistik.
 */
export function performHybridSync(options?: {
  reloadDesktop?: boolean;
  defaultBatchNo?: string;
}): {
  response: PurchasePlanningResponse;
  mergedCount: number;
  newCount: number;
  totalSyncedPoItems: number;
} {
  const { reloadDesktop = false, defaultBatchNo = 'CPL-PP-2026-001' } = options || {};

  let baseResponse: PurchasePlanningResponse;

  // 1. Ambil data dasar
  if (reloadDesktop && fs.existsSync(DESKTOP_CANDIDATE_PATH)) {
    const buffer = fs.readFileSync(DESKTOP_CANDIDATE_PATH);
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    baseResponse = parsePurchasePlanningWorkbook(workbook);
    baseResponse.sourceFile = `${path.basename(DESKTOP_CANDIDATE_PATH)} + Live e-FPB (Hybrid)`;
    baseResponse.items.forEach((it) => {
      it.dataSource = 'DESKTOP_EXCEL';
      it.batchNo = it.batchNo || defaultBatchNo;
    });
  } else if (fs.existsSync(STORAGE_FILE_PATH)) {
    try {
      baseResponse = JSON.parse(fs.readFileSync(STORAGE_FILE_PATH, 'utf-8'));
      baseResponse.items.forEach((it) => {
        if (!it.dataSource) it.dataSource = 'DESKTOP_EXCEL';
        if (!it.batchNo) it.batchNo = defaultBatchNo;
      });
    } catch {
      throw new Error('Gagal membaca data perencanaan dari sistem.');
    }
  } else {
    throw new Error('Tidak ditemukan sumber data perencanaan dasar (file Desktop maupun penyimpanan lokal).');
  }

  // 2. Baca data inventaris untuk cek stok barang baru
  const inventoryStockMap = new Map<string, number>();
  if (fs.existsSync(INVENTORY_FILE_PATH)) {
    try {
      const invData = JSON.parse(fs.readFileSync(INVENTORY_FILE_PATH, 'utf-8'));
      if (Array.isArray(invData)) {
        for (const it of invData) {
          if (it.itemCode) {
            inventoryStockMap.set(String(it.itemCode).trim().toUpperCase(), Number(it.quantity) || 0);
          }
          if (it.description) {
            inventoryStockMap.set(String(it.description).trim().toUpperCase(), Number(it.quantity) || 0);
          }
        }
      }
    } catch (err) {
      console.warn('Gagal membaca master inventory untuk cek stok e-FPB:', err);
    }
  }

  // 3. Baca e-FPB yang telah disetujui dari fpb-reviews.json
  if (!fs.existsSync(REVIEWS_FILE_PATH)) {
    const syncStats = getSyncStats(baseResponse);
    baseResponse.syncStats = syncStats;
    return { response: baseResponse, mergedCount: 0, newCount: 0, totalSyncedPoItems: 0 };
  }

  const reviews: FpbReviewRecord[] = JSON.parse(fs.readFileSync(REVIEWS_FILE_PATH, 'utf-8'));
  const approvedReviews = reviews.filter(
    (r) => r.isReceivedLogistik || r.reviewStatus === 'APPROVED_PO' || (r.items && r.items.some((i) => i.decision === 'PO'))
  );

  // Buat indeks item yang sudah ada di perencanaan
  const existingByCode = new Map<string, PurchasePlanningItem>();
  const existingByName = new Map<string, PurchasePlanningItem>();

  for (const item of baseResponse.items) {
    if (item.itemCode) {
      existingByCode.set(item.itemCode.trim().toUpperCase(), item);
    }
    if (item.itemName) {
      existingByName.set(item.itemName.trim().toUpperCase(), item);
    }
  }

  let mergedCount = 0;
  let newCount = 0;
  let totalSyncedPoItems = 0;
  let counter = 1;

  for (const r of approvedReviews) {
    if (!r.fpbNo) continue;

    const poItems = (r.items || []).filter(
      (i) => i.decision === 'PO' || (r.reviewStatus === 'APPROVED_PO' && i.decision !== 'STOCK' && i.decision !== 'REJECT')
    );

    for (const poItem of poItems) {
      if (!poItem.itemName && !poItem.itemCode) continue;

      const codeKey = poItem.itemCode ? poItem.itemCode.trim().toUpperCase() : '';
      const nameKey = poItem.itemName ? poItem.itemName.trim().toUpperCase() : '';

      // Abaikan jika item berupa nama pejabat persetujuan / kata kunci approval
      if (
        nameKey.includes('ACKNOWLEDGE') ||
        nameKey.includes('REVIEWER') ||
        nameKey === 'HERMANSYAH' ||
        nameKey === 'MELINDA' ||
        nameKey === 'NOORHASANAH' ||
        nameKey === 'NOOR HASANAH'
      ) {
        continue;
      }

      const matchedExisting = (codeKey ? existingByCode.get(codeKey) : null) || (nameKey ? existingByName.get(nameKey) : null);
      const reqQty = Math.max(1, Number(poItem.qty) || 1);

      if (matchedExisting) {
        // Cek apakah nomor FPB ini sudah tercatat sebelumnya (Anti-Duplikasi)
        if (!matchedExisting.fpbRefs.includes(r.fpbNo)) {
          matchedExisting.fpbRefs.push(r.fpbNo);
          matchedExisting.openFpbCount = matchedExisting.fpbRefs.length;

          if (r.armada && !matchedExisting.requestingVessels.includes(r.armada)) {
            matchedExisting.requestingVessels.push(r.armada);
          }

          // Tambah kuantitas kebutuhan
          matchedExisting.totalRequestedQty += reqQty;
          matchedExisting.recommendedOrderQty = Math.max(0, matchedExisting.totalRequestedQty - matchedExisting.currentStock) || matchedExisting.totalRequestedQty;
          matchedExisting.totalEstimatedCost = matchedExisting.recommendedOrderQty * matchedExisting.avgUnitPrice;
          matchedExisting.potentialBulkDiscount = estimateBulkDiscount(matchedExisting.recommendedOrderQty);
          matchedExisting.potentialSavingsAmount = Math.round(matchedExisting.totalEstimatedCost * (matchedExisting.potentialBulkDiscount / 100));

          // Tandai sebagai hasil konsolidasi hybrid
          matchedExisting.dataSource = 'HYBRID_CONSOLIDATED';
          matchedExisting.syncedAt = new Date().toISOString();

          mergedCount++;
          totalSyncedPoItems++;
        }
      } else {
        // Item baru dari e-FPB yang belum ada di perencanaan
        const cat = poItem.description && estimateCategoryFromName(poItem.description) !== 'General'
          ? estimateCategoryFromName(poItem.description)
          : estimateCategoryFromName(poItem.itemName);

        const currentStock = (codeKey && inventoryStockMap.get(codeKey)) || (nameKey && inventoryStockMap.get(nameKey)) || 0;
        const netOrderQty = Math.max(0, reqQty - currentStock) || reqQty;
        const unitPrice = estimateUnitPrice(poItem.itemName, cat);
        const totalEstimatedCost = netOrderQty * unitPrice;
        const bulkDiscount = estimateBulkDiscount(netOrderQty);
        const potentialSavingsAmount = Math.round(totalEstimatedCost * (bulkDiscount / 100));
        const leadTime = estimateLeadTime(cat);

        // Urgensi
        let urgency: 'CRITICAL' | 'REORDER' | 'PLANNED' = 'PLANNED';
        if (r.urgency === 'EMERGENCY' || r.priorityLevel === 'P1') {
          urgency = 'CRITICAL';
        } else if (r.urgency === 'URGENT' || r.priorityLevel === 'P2' || currentStock === 0) {
          urgency = 'REORDER';
        }

        const urgencyReason = `Disetujui Logistik (e-FPB ${r.fpbNo}) untuk ${r.armada || 'Armada CPG'}. ${poItem.description ? `(${poItem.description.slice(0, 50)})` : ''}`;

        const newItem: PurchasePlanningItem = {
          id: `plan-efpb-${Date.now()}-${counter++}`,
          itemCode: poItem.itemCode || `ITEM-EFPB-${String(counter).padStart(4, '0')}`,
          itemName: poItem.itemName,
          category: cat,
          unit: poItem.unit || 'PCS',
          currentStock,
          openFpbCount: 1,
          requestingVessels: r.armada ? [r.armada] : ['Armada CPG'],
          totalRequestedQty: reqQty,
          recommendedOrderQty: netOrderQty,
          avgUnitPrice: unitPrice,
          totalEstimatedCost,
          urgency,
          urgencyReason,
          leadTimeDays: leadTime,
          potentialBulkDiscount: bulkDiscount,
          potentialSavingsAmount,
          reorderPoint: Math.max(1, Math.ceil(reqQty * 0.3)),
          monthlyConsumption: Math.max(1, Math.ceil(reqQty * 0.5)),
          suggestedVendor: 'Distributor Resmi / Rekanan CPG',
          fpbRefs: [r.fpbNo],
          batchNo: defaultBatchNo,
          dataSource: 'EFPB_LIVE',
          syncedAt: new Date().toISOString(),
        };

        baseResponse.items.push(newItem);

        // Catat ke map agar baris FPB berikutnya dengan item sama bisa dimerge
        if (newItem.itemCode) existingByCode.set(newItem.itemCode.trim().toUpperCase(), newItem);
        if (newItem.itemName) existingByName.set(newItem.itemName.trim().toUpperCase(), newItem);

        newCount++;
        totalSyncedPoItems++;
      }
    }
  }

  // 4. Hitung ulang kategori unik & summary
  const categories = Array.from(new Set(baseResponse.items.map((i) => i.category))).sort();
  const criticalCount = baseResponse.items.filter((i) => i.urgency === 'CRITICAL').length;
  const reorderCount = baseResponse.items.filter((i) => i.urgency === 'REORDER').length;
  const plannedCount = baseResponse.items.filter((i) => i.urgency === 'PLANNED').length;
  const totalEstimatedBudget = baseResponse.items.reduce((sum, i) => sum + i.totalEstimatedCost, 0);
  const totalPotentialSavings = baseResponse.items.reduce((sum, i) => sum + i.potentialSavingsAmount, 0);

  const vesselsSet = new Set<string>();
  baseResponse.items.forEach((i) => (i.requestingVessels || []).forEach((v) => vesselsSet.add(v)));

  baseResponse.categories = categories;
  baseResponse.summary = {
    totalItems: baseResponse.items.length,
    criticalCount,
    reorderCount,
    plannedCount,
    totalEstimatedBudget,
    totalPotentialSavings,
    activeVesselsCount: vesselsSet.size,
  };

  // 5. Hitung Sync Stats
  baseResponse.syncStats = getSyncStats(baseResponse);
  baseResponse.timestamp = new Date().toISOString();

  // 6. Simpan secara permanen ke purchase-planning-data.json
  fs.writeFileSync(STORAGE_FILE_PATH, JSON.stringify(baseResponse, null, 2), 'utf-8');

  return {
    response: baseResponse,
    mergedCount,
    newCount,
    totalSyncedPoItems,
  };
}
