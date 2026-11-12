import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import * as XLSX from 'xlsx';
import { parsePurchasePlanningWorkbook } from '@/utils/purchasePlanningParser';
import { getSyncStats, performHybridSync } from '@/utils/purchasePlanningSync';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export interface PurchasePlanningItem {
  id: string;
  itemCode: string;
  itemName: string;
  category: string;
  unit: string;
  currentStock: number;
  openFpbCount: number;
  requestingVessels: string[];
  totalRequestedQty: number;
  recommendedOrderQty: number;
  avgUnitPrice: number;
  totalEstimatedCost: number;
  urgency: 'CRITICAL' | 'REORDER' | 'PLANNED';
  urgencyReason: string;
  leadTimeDays: number;
  potentialBulkDiscount: number; // Persentase estimasi penghematan
  potentialSavingsAmount: number;
  reorderPoint: number;
  monthlyConsumption: number;
  suggestedVendor?: string;
  fpbRefs: string[];
  batchNo?: string;
  dataSource?: 'DESKTOP_EXCEL' | 'EFPB_LIVE' | 'HYBRID_CONSOLIDATED';
  syncedAt?: string;
}

export interface PurchasePlanningSyncStats {
  desktopCount: number;
  efpbCount: number;
  hybridCount: number;
  pendingApprovedFpbsCount: number;
  pendingPoItemsCount: number;
  lastSyncedAt?: string;
  desktopFileAvailable: boolean;
  desktopFileName?: string;
  desktopLastModified?: string;
}

export interface PurchasePlanningResponse {
  success: boolean;
  message?: string;
  timestamp: string;
  sourceFile?: string;
  summary: {
    totalItems: number;
    criticalCount: number;
    reorderCount: number;
    plannedCount: number;
    totalEstimatedBudget: number;
    totalPotentialSavings: number;
    activeVesselsCount: number;
  };
  categories: string[];
  items: PurchasePlanningItem[];
  syncStats?: PurchasePlanningSyncStats;
}

const STORAGE_FILE_PATH = path.join(process.cwd(), 'src', 'data', 'purchase-planning-data.json');
const DESKTOP_CANDIDATE_PATH = 'C:\\Users\\Hermansyah\\OneDrive\\Desktop\\PURCHASE_PLANNING_BATCH_001_CPG.xlsx';

// Master baseline data item maritim & industri perkapalan CPG (Fallback jika data belum diimpor)
const MASTER_PLANNING_ITEMS: PurchasePlanningItem[] = [
  {
    id: 'plan-001',
    itemCode: 'ROPE-PP-8S-50',
    itemName: 'TALI TROWSER / MOORING PP 8 STRAND 50 MM (220 MTR)',
    category: 'Mooring & Deck Equipment',
    unit: 'ROL',
    currentStock: 1,
    openFpbCount: 4,
    requestingVessels: ['TB KING STAR', 'TK CPL 250', 'SPOB CINTIANA PRATAMA', 'TB PMI ABADI'],
    totalRequestedQty: 6,
    recommendedOrderQty: 8,
    avgUnitPrice: 14500000,
    totalEstimatedCost: 116000000,
    urgency: 'CRITICAL',
    urgencyReason: 'Sisa stok gudang hanya 1 rol, 4 armada membutuhkan pergantian tali tambang mendesak.',
    leadTimeDays: 10,
    potentialBulkDiscount: 8.5,
    potentialSavingsAmount: 9860000,
    reorderPoint: 3,
    monthlyConsumption: 2,
    suggestedVendor: 'PT. Samudra Tali Indo / CV. Bahari Mandiri',
    fpbRefs: ['CPL-FPB-26-0003374', 'HL-FPB-26-0001123', 'MIL-FPB-26-0000032', 'GAJ-FPB-26-0000873'],
  },
  {
    id: 'plan-002',
    itemCode: 'OIL-MEDITRAN-SX-40',
    itemName: 'PELUMAS MEDITRAN SX SAE 15W-40 (DRUM 209 LTR)',
    category: 'Pelumas & Marine Oils',
    unit: 'DRM',
    currentStock: 3,
    openFpbCount: 6,
    requestingVessels: ['MT BLUE PETROL', 'MT DOMINO', 'MT BARONGKO', 'MT HL 5001', 'TB CMPL 01'],
    totalRequestedQty: 12,
    recommendedOrderQty: 16,
    avgUnitPrice: 8750000,
    totalEstimatedCost: 140000000,
    urgency: 'CRITICAL',
    urgencyReason: 'Konsumsi rutin mesin induk 5 armada kapal. Stok gudang Somber kritis di bawah batas aman.',
    leadTimeDays: 5,
    potentialBulkDiscount: 10.0,
    potentialSavingsAmount: 14000000,
    reorderPoint: 8,
    monthlyConsumption: 6,
    suggestedVendor: 'PT. Pertamina Lubricants / Agen Resmi',
    fpbRefs: ['CPL-FPB-26-0004102', 'CPL-FPB-26-0004215', 'HL-FPB-26-0001890'],
  },
  {
    id: 'plan-003',
    itemCode: 'FLT-YANMAR-6EY17W',
    itemName: 'FILTER ELEMENT OLI & SOLAR YANMAR 6EY17W (GENUINE)',
    category: 'Suku Cadang Mesin',
    unit: 'SET',
    currentStock: 4,
    openFpbCount: 3,
    requestingVessels: ['TB CINDARA 2107', 'TB EQUATOR 02', 'TB MUARA MEGA'],
    totalRequestedQty: 6,
    recommendedOrderQty: 10,
    avgUnitPrice: 3200000,
    totalEstimatedCost: 32000000,
    urgency: 'REORDER',
    urgencyReason: 'Jadwal running hours 2.000 jam armada tiba bulan ini. Reorder point telah terlampaui.',
    leadTimeDays: 14,
    potentialBulkDiscount: 7.0,
    potentialSavingsAmount: 2240000,
    reorderPoint: 6,
    monthlyConsumption: 4,
    suggestedVendor: 'PT. Yanmar Marine Engines Indonesia',
    fpbRefs: ['CPL-FPB-26-0002988', 'MO-FPB-26-0001552'],
  },
  {
    id: 'plan-004',
    itemCode: 'SAFE-APAR-DCP-9KG',
    itemName: 'APAR DRY CHEMICAL POWDER 9 KG (TABUNG BARU + SERTIFIKAT K3)',
    category: 'Safety & K3 Maritim',
    unit: 'TBG',
    currentStock: 2,
    openFpbCount: 5,
    requestingVessels: ['SPOB ROYAL REY 350', 'SV TWINSISTER 305', 'OB CINDARA 1100'],
    totalRequestedQty: 8,
    recommendedOrderQty: 12,
    avgUnitPrice: 685000,
    totalEstimatedCost: 8220000,
    urgency: 'REORDER',
    urgencyReason: 'Inspeksi tahunan Marine Surveyor Syahbandar. Kadaluarsa tabung APAR di 3 kapal.',
    leadTimeDays: 7,
    potentialBulkDiscount: 12.0,
    potentialSavingsAmount: 986400,
    reorderPoint: 5,
    monthlyConsumption: 3,
    suggestedVendor: 'CV. Proteksi Bahari Balikpapan',
    fpbRefs: ['CPL-FPB-26-0004501', 'HL-FPB-26-0002011'],
  },
  {
    id: 'plan-005',
    itemCode: 'PAINT-EPIKOTE-MAST',
    itemName: 'CAT MARINE HIGH SOLID EPOXY MASTIC (PAIL 20 LTR) + HARDENER',
    category: 'Cat Marine & Deck Protection',
    unit: 'PIL',
    currentStock: 5,
    openFpbCount: 2,
    requestingVessels: ['TK WINBUILD 141', 'TB MAPAN 1405'],
    totalRequestedQty: 10,
    recommendedOrderQty: 15,
    avgUnitPrice: 2450000,
    totalEstimatedCost: 36750000,
    urgency: 'PLANNED',
    urgencyReason: 'Persiapan pemeliharaan rutin geladak & lambung kapal saat jeda operasi.',
    leadTimeDays: 5,
    potentialBulkDiscount: 6.5,
    potentialSavingsAmount: 2388750,
    reorderPoint: 8,
    monthlyConsumption: 5,
    suggestedVendor: 'PT. Chugoku Paints Indonesia / Jotun',
    fpbRefs: ['CPL-FPB-26-0003889'],
  },
];

function buildResponseFromItems(items: PurchasePlanningItem[], sourceFile?: string): PurchasePlanningResponse {
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
    sourceFile,
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

export async function GET() {
  try {
    // 1. Cek apakah ada file data JSON tersimpan di src/data/purchase-planning-data.json
    if (fs.existsSync(STORAGE_FILE_PATH)) {
      try {
        const fileContent = fs.readFileSync(STORAGE_FILE_PATH, 'utf-8');
        const parsed: PurchasePlanningResponse = JSON.parse(fileContent);
        if (parsed && parsed.items && parsed.items.length > 0) {
          parsed.syncStats = getSyncStats(parsed);
          return NextResponse.json(parsed, {
            headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' },
          });
        }
      } catch (err) {
        console.warn('Gagal membaca purchase-planning-data.json, mencoba kandidat lain:', err);
      }
    }

    // 2. Jika belum ada di src/data, cek apakah ada file Desktop PURCHASE_PLANNING_BATCH_001_CPG.xlsx
    if (fs.existsSync(DESKTOP_CANDIDATE_PATH)) {
      try {
        const buffer = fs.readFileSync(DESKTOP_CANDIDATE_PATH);
        const workbook = XLSX.read(buffer, { type: 'buffer' });
        const parsedResponse = parsePurchasePlanningWorkbook(workbook);
        parsedResponse.sourceFile = 'PURCHASE_PLANNING_BATCH_001_CPG.xlsx (Desktop)';

        // Simpan ke disk agar persisten
        fs.writeFileSync(STORAGE_FILE_PATH, JSON.stringify(parsedResponse, null, 2), 'utf-8');

        return NextResponse.json(parsedResponse, {
          headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' },
        });
      } catch (err) {
        console.warn('Gagal membaca file desktop otomatis:', err);
      }
    }

    // 3. Fallback ke baseline master data
    const responseData = buildResponseFromItems(MASTER_PLANNING_ITEMS, 'Master Baseline CPG');
    return NextResponse.json(responseData, {
      headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' },
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error?.message || 'Gagal memproses data perencanaan pengadaan' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const action = searchParams.get('action');

    // 0. Aksi: Cek status sinkronisasi e-FPB & Desktop
    if (action === 'sync-status') {
      const stats = getSyncStats();
      return NextResponse.json({ success: true, stats });
    }

    // 0b. Aksi: Sinkronisasi Hybrid (e-FPB Disetujui + Auto-Merge Desktop)
    if (action === 'sync-hybrid') {
      const reloadDesktop = searchParams.get('reloadDesktop') === 'true';
      const batchNo = searchParams.get('batchNo') || 'CPL-PP-2026-001';

      const result = performHybridSync({ reloadDesktop, defaultBatchNo: batchNo });
      return NextResponse.json({
        success: true,
        message: `Sinkronisasi berhasil! ${result.mergedCount} item digabungkan, ${result.newCount} item baru ditambahkan dari e-FPB disetujui.`,
        data: result.response,
        mergedCount: result.mergedCount,
        newCount: result.newCount,
        totalSyncedPoItems: result.totalSyncedPoItems,
      });
    }

    // 1. Aksi: Reset data ke master baseline
    if (action === 'reset') {
      if (fs.existsSync(STORAGE_FILE_PATH)) {
        try {
          fs.unlinkSync(STORAGE_FILE_PATH);
        } catch {}
      }
      const responseData = buildResponseFromItems(MASTER_PLANNING_ITEMS, 'Master Baseline CPG');
      return NextResponse.json(responseData);
    }

    // 2. Aksi: Muat langsung dari Desktop pengguna (PURCHASE_PLANNING_BATCH_001_CPG.xlsx)
    if (action === 'load-desktop') {
      if (!fs.existsSync(DESKTOP_CANDIDATE_PATH)) {
        return NextResponse.json(
          { success: false, message: `File tidak ditemukan di ${DESKTOP_CANDIDATE_PATH}` },
          { status: 404 }
        );
      }

      const buffer = fs.readFileSync(DESKTOP_CANDIDATE_PATH);
      const workbook = XLSX.read(buffer, { type: 'buffer' });
      const parsedResponse = parsePurchasePlanningWorkbook(workbook);
      parsedResponse.sourceFile = 'PURCHASE_PLANNING_BATCH_001_CPG.xlsx (Desktop)';

      fs.writeFileSync(STORAGE_FILE_PATH, JSON.stringify(parsedResponse, null, 2), 'utf-8');
      return NextResponse.json(parsedResponse);
    }

    // 2b. Aksi: Hapus Batch Tertentu (tanpa menghapus batch lain)
    if (action === 'delete-batch') {
      const targetBatch = searchParams.get('batchNo');
      if (!targetBatch) {
        return NextResponse.json({ success: false, message: 'Parameter batchNo wajib diisi.' }, { status: 400 });
      }
      let existingItems: PurchasePlanningItem[] = [];
      if (fs.existsSync(STORAGE_FILE_PATH)) {
        try {
          const parsed: PurchasePlanningResponse = JSON.parse(fs.readFileSync(STORAGE_FILE_PATH, 'utf-8'));
          existingItems = parsed.items || [];
        } catch {}
      }
      const remaining = existingItems.filter((it) => {
        const b = it.batchNo || 'CPL-PP-2026-001';
        return b !== targetBatch;
      });
      const responseData = buildResponseFromItems(remaining, `Batch ${targetBatch} dihapus`);
      responseData.syncStats = getSyncStats(responseData);
      responseData.message = `Batch ${targetBatch} berhasil dihapus. Tersisa ${remaining.length} item.`;
      fs.writeFileSync(STORAGE_FILE_PATH, JSON.stringify(responseData, null, 2), 'utf-8');
      return NextResponse.json(responseData);
    }

    // 3. Aksi: Upload file Excel multipart/form-data (Mendukung Multi-Batch: append | merge | replace)
    const contentType = req.headers.get('content-type') || '';
    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData();
      const file = formData.get('file') as File | null;
      if (!file) {
        return NextResponse.json({ success: false, message: 'File tidak ditemukan dalam permintaan.' }, { status: 400 });
      }

      const uploadMode = ((formData.get('uploadMode') as string) || 'append') as 'append' | 'merge' | 'replace';
      const customBatchNo = ((formData.get('batchNo') as string) || '').trim();

      // Baca data batch yang sudah tersimpan sebelumnya
      let existingItems: PurchasePlanningItem[] = [];
      if (fs.existsSync(STORAGE_FILE_PATH)) {
        try {
          const parsedExisting: PurchasePlanningResponse = JSON.parse(fs.readFileSync(STORAGE_FILE_PATH, 'utf-8'));
          existingItems = (parsedExisting.items || []).map((it) => ({
            ...it,
            batchNo: it.batchNo || 'CPL-PP-2026-001',
          }));
        } catch {}
      }

      // Tentukan nomor batch otomatis jika tidak diisi manual (CPL-PP-2026-002, dst.)
      let assignedBatchNo = customBatchNo;
      if (!assignedBatchNo) {
        let maxSeq = existingItems.length > 0 ? 1 : 0;
        existingItems.forEach((it) => {
          const matches = (it.batchNo || '').match(/CPL-PP-\d{4}-(\d+)/gi) || [];
          matches.forEach((m) => {
            const num = parseInt(m.split('-').pop() || '0', 10);
            if (num > maxSeq) maxSeq = num;
          });
        });
        const year = new Date().getFullYear();
        assignedBatchNo = `CPL-PP-${year}-${String(maxSeq + 1).padStart(3, '0')}`;
      }

      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const workbook = XLSX.read(buffer, { type: 'buffer' });
      const parsedResponse = parsePurchasePlanningWorkbook(workbook);

      const nowIso = new Date().toISOString();
      const taggedNewItems: PurchasePlanningItem[] = parsedResponse.items.map((it, idx) => ({
        ...it,
        id: `${assignedBatchNo}__${it.id || idx + 1}`,
        batchNo: assignedBatchNo,
        dataSource: 'DESKTOP_EXCEL',
        syncedAt: nowIso,
      }));

      let finalItems: PurchasePlanningItem[] = [];
      let mergedCount = 0;
      let appendedCount = 0;

      if (uploadMode === 'replace' || existingItems.length === 0) {
        finalItems = taggedNewItems;
        appendedCount = taggedNewItems.length;
      } else if (uploadMode === 'append') {
        const existingIds = new Set(existingItems.map((i) => i.id));
        const safeNew = taggedNewItems.map((it, idx) => ({
          ...it,
          id: existingIds.has(it.id) ? `${it.id}_${Date.now()}_${idx}` : it.id,
        }));
        finalItems = [...existingItems, ...safeNew];
        appendedCount = safeNew.length;
      } else {
        // Smart Merge: konsolidasikan item dengan kode/nama sama, tambahkan sisanya
        const urgencyWeight: Record<string, number> = { CRITICAL: 3, REORDER: 2, PLANNED: 1 };
        const byWeightUrgency = (u1: PurchasePlanningItem['urgency'], u2: PurchasePlanningItem['urgency']) =>
          (urgencyWeight[u1] || 0) >= (urgencyWeight[u2] || 0) ? u1 : u2;

        const working = existingItems.map((it) => ({ ...it }));
        const findMatchIndex = (target: PurchasePlanningItem) => {
          const code = (target.itemCode || '').trim().toUpperCase();
          const name = (target.itemName || '').trim().toUpperCase();
          return working.findIndex((ex) => {
            const exCode = (ex.itemCode || '').trim().toUpperCase();
            const exName = (ex.itemName || '').trim().toUpperCase();
            if (code && exCode && code === exCode && code !== '-' && code !== 'N/A') return true;
            return name && exName && name === exName;
          });
        };

        taggedNewItems.forEach((newIt, idx) => {
          const matchIdx = findMatchIndex(newIt);
          if (matchIdx >= 0) {
            const ex = working[matchIdx];
            const combinedRequested = (ex.totalRequestedQty || 0) + (newIt.totalRequestedQty || 0);
            const combinedOrder = (ex.recommendedOrderQty || 0) + (newIt.recommendedOrderQty || 0);
            const unitPrice = ex.avgUnitPrice > 0 ? ex.avgUnitPrice : newIt.avgUnitPrice;
            const combinedCost = combinedOrder * unitPrice;
            const discountPct = Math.max(ex.potentialBulkDiscount || 0, newIt.potentialBulkDiscount || 0);
            const batchSet = new Set(
              `${ex.batchNo || 'CPL-PP-2026-001'},${assignedBatchNo}`
                .split(',')
                .map((s) => s.trim())
                .filter(Boolean)
            );
            working[matchIdx] = {
              ...ex,
              openFpbCount: (ex.openFpbCount || 0) + (newIt.openFpbCount || 0),
              requestingVessels: Array.from(new Set([...(ex.requestingVessels || []), ...(newIt.requestingVessels || [])])),
              fpbRefs: Array.from(new Set([...(ex.fpbRefs || []), ...(newIt.fpbRefs || [])])),
              totalRequestedQty: combinedRequested,
              recommendedOrderQty: combinedOrder,
              avgUnitPrice: unitPrice,
              totalEstimatedCost: combinedCost,
              potentialBulkDiscount: discountPct,
              potentialSavingsAmount: Math.round((combinedCost * discountPct) / 100),
              urgency: byWeightUrgency(ex.urgency, newIt.urgency),
              batchNo: Array.from(batchSet).join(', '),
              dataSource: 'HYBRID_CONSOLIDATED',
              syncedAt: nowIso,
            };
            mergedCount++;
          } else {
            working.push({
              ...newIt,
              id: `${newIt.id}_${Date.now()}_${idx}`,
            });
            appendedCount++;
          }
        });
        finalItems = working;
      }

      const sourceLabel =
        uploadMode === 'replace'
          ? file.name
          : `${file.name} (${assignedBatchNo})`;
      const responseData = buildResponseFromItems(finalItems, sourceLabel);
      responseData.syncStats = getSyncStats(responseData);
      responseData.message =
        uploadMode === 'replace'
          ? `Data diganti total dengan ${file.name} (${assignedBatchNo}: ${taggedNewItems.length} item).`
          : uploadMode === 'merge'
          ? `Batch ${assignedBatchNo} dikonsolidasikan: ${mergedCount} item digabung, ${appendedCount} item baru ditambahkan (Total ${finalItems.length} item).`
          : `Batch ${assignedBatchNo} berhasil ditambahkan (+${appendedCount} item baru, Total ${finalItems.length} item).`;

      fs.writeFileSync(STORAGE_FILE_PATH, JSON.stringify(responseData, null, 2), 'utf-8');
      return NextResponse.json(responseData);
    }

    // 4. Aksi: Simpan JSON langsung
    const body = await req.json();
    if (body && Array.isArray(body.items)) {
      const responseData = buildResponseFromItems(body.items, body.sourceFile || 'Custom Data');
      fs.writeFileSync(STORAGE_FILE_PATH, JSON.stringify(responseData, null, 2), 'utf-8');
      return NextResponse.json(responseData);
    }

    return NextResponse.json({ success: false, message: 'Format data tidak didukung.' }, { status: 400 });
  } catch (error: any) {
    console.error('Error in /api/purchase-planning POST:', error);
    return NextResponse.json(
      { success: false, message: error?.message || 'Gagal menyimpan data perencanaan pengadaan' },
      { status: 500 }
    );
  }
}
