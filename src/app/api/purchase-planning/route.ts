import { NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

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
}

export interface PurchasePlanningResponse {
  success: boolean;
  timestamp: string;
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
}

// Master baseline data item maritim & industri perkapalan CPG
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
    fpbRefs: ['CPL-FPB-26-0004837', 'HL-FPB-26-0001434', 'CPL-FPB-26-0004960', 'SP-FPB-26-0000547'],
  },
  {
    id: 'plan-002',
    itemCode: 'OIL-MEDITRAN-SX-40',
    itemName: 'PELUMAS MEDITRAN SX SAE 15W-40 (DRUM 209 LTR)',
    category: 'Pelumas & Marine Oils',
    unit: 'DRM',
    currentStock: 3,
    openFpbCount: 5,
    requestingVessels: ['SV TWINSISTER 307', 'MT DEWA YANI', 'TB KING STAR', 'SPOB ROYAL REY 3001', 'UB CMPL 01'],
    totalRequestedQty: 12,
    recommendedOrderQty: 16,
    avgUnitPrice: 8750000,
    totalEstimatedCost: 140000000,
    urgency: 'CRITICAL',
    urgencyReason: 'Stok menipis drastis, 3 armada mendekati jadwal overhoul/penggantian oli mesin utama.',
    leadTimeDays: 5,
    potentialBulkDiscount: 10.0,
    potentialSavingsAmount: 14000000,
    reorderPoint: 6,
    monthlyConsumption: 5,
    suggestedVendor: 'PT. Pertamina Lubricants / Agen Resmi Somber',
    fpbRefs: ['CPL-FPB-26-0004990', 'CPL-FPB-26-0004202', 'CPL-FPB-26-0004837', 'CPL-FPB-26-0003433'],
  },
  {
    id: 'plan-003',
    itemCode: 'FLT-YANMAR-6EY17W',
    itemName: 'FILTER ELEMENT OLI & SOLAR YANMAR 6EY17W (GENUINE)',
    category: 'Suku Cadang Mesin',
    unit: 'SET',
    currentStock: 4,
    openFpbCount: 3,
    requestingVessels: ['TB KING STAR', 'TB PMI ABADI', 'MT KING OCEAN'],
    totalRequestedQty: 6,
    recommendedOrderQty: 10,
    avgUnitPrice: 3200000,
    totalEstimatedCost: 32000000,
    urgency: 'REORDER',
    urgencyReason: 'Stok mendekati batas aman, perputaran cepat setiap running 500 jam mesin.',
    leadTimeDays: 7,
    potentialBulkDiscount: 6.0,
    potentialSavingsAmount: 1920000,
    reorderPoint: 6,
    monthlyConsumption: 3,
    suggestedVendor: 'PT. Yanmar Marine Diesel Indonesia / PT. Triguna',
    fpbRefs: ['CPL-FPB-26-0004837', 'CPL-FPB-26-0004960', 'CPL-FPB-26-0004301'],
  },
  {
    id: 'plan-004',
    itemCode: 'SAFE-APAR-DCP-9KG',
    itemName: 'APAR DRY CHEMICAL POWDER 9 KG (TABUNG BARU + SERTIFIKAT K3)',
    category: 'Safety & K3 Maritim',
    unit: 'TBG',
    currentStock: 2,
    openFpbCount: 3,
    requestingVessels: ['TK CPL 250', 'SV TWINSISTER 305', 'SITE MMP PULAU BALANG'],
    totalRequestedQty: 8,
    recommendedOrderQty: 12,
    avgUnitPrice: 685000,
    totalEstimatedCost: 8220000,
    urgency: 'REORDER',
    urgencyReason: 'Masa kadaluarsa apar 2 kapal mendekati batas inspeksi syahbandar.',
    leadTimeDays: 4,
    potentialBulkDiscount: 12.0,
    potentialSavingsAmount: 986400,
    reorderPoint: 5,
    monthlyConsumption: 4,
    suggestedVendor: 'PT. Pelayaran Global Nusantara Supply / CV. Cipta Marine',
    fpbRefs: ['HL-FPB-26-0001434', 'CPL-FPB-26-0003595', 'CPL-FPB-26-0005182'],
  },
  {
    id: 'plan-005',
    itemCode: 'PAINT-EPIKOTE-MAST',
    itemName: 'CAT MARINE HIGH SOLID EPOXY MASTIC (PAIL 20 LTR) + HARDENER',
    category: 'Cat Marine & Deck Protection',
    unit: 'PIL',
    currentStock: 5,
    openFpbCount: 2,
    requestingVessels: ['TK CPL 250', 'TK COASWAY 1803'],
    totalRequestedQty: 10,
    recommendedOrderQty: 15,
    avgUnitPrice: 2450000,
    totalEstimatedCost: 36750000,
    urgency: 'PLANNED',
    urgencyReason: 'Persiapan pemeliharaan rutin lambung dan dek tongkang saat sandar di galangan.',
    leadTimeDays: 6,
    potentialBulkDiscount: 7.5,
    potentialSavingsAmount: 2756250,
    reorderPoint: 8,
    monthlyConsumption: 3,
    suggestedVendor: 'PT. International Paint / Jotun Marine Balikpapan',
    fpbRefs: ['HL-FPB-26-0001434', 'SP-FPB-26-0000634'],
  },
  {
    id: 'plan-006',
    itemCode: 'ELEC-BAT-N200-24V',
    itemName: 'BATTERY / AKI GS PREMIUM N200 12V 200AH (HEAVY DUTY STARTING)',
    category: 'Elektrikal & Navigasi',
    unit: 'UNT',
    currentStock: 0,
    openFpbCount: 3,
    requestingVessels: ['SV TWINSISTER 307', 'TB KING STAR', 'UB CMPL 01'],
    totalRequestedQty: 6,
    recommendedOrderQty: 8,
    avgUnitPrice: 3850000,
    totalEstimatedCost: 30800000,
    urgency: 'CRITICAL',
    urgencyReason: 'Stok gudang KOSONG (0 unit), aki darurat generator bantu kapal melemah.',
    leadTimeDays: 3,
    potentialBulkDiscount: 5.0,
    potentialSavingsAmount: 1540000,
    reorderPoint: 4,
    monthlyConsumption: 2,
    suggestedVendor: 'Toko Aki Laut Mandiri / Distributor GS Astra Balikpapan',
    fpbRefs: ['CPL-FPB-26-0004990', 'CPL-FPB-26-0004837', 'CPL-FPB-26-0004312'],
  },
  {
    id: 'plan-007',
    itemCode: 'ZINC-ANODE-S-5KG',
    itemName: 'ZINC ANODE SLAB TYPE 5 KG (PROTEKSI KOROSI LAMBUNG KAPAL)',
    category: 'Cat Marine & Deck Protection',
    unit: 'BH',
    currentStock: 14,
    openFpbCount: 2,
    requestingVessels: ['SPOB ROYAL REY 5001', 'MT BARONGKO'],
    totalRequestedQty: 40,
    recommendedOrderQty: 50,
    avgUnitPrice: 395000,
    totalEstimatedCost: 19750000,
    urgency: 'PLANNED',
    urgencyReason: 'Jadwal penggantian anoda lambung kuartal depan saat sandar dermaga.',
    leadTimeDays: 14,
    potentialBulkDiscount: 12.5,
    potentialSavingsAmount: 2468750,
    reorderPoint: 20,
    monthlyConsumption: 10,
    suggestedVendor: 'CV. Karya Logam Mandiri Surabaya',
    fpbRefs: ['CPL-FPB-26-0003587', 'CPL-FPB-26-0003453'],
  },
  {
    id: 'plan-008',
    itemCode: 'NAV-GPS-ANT-FURUNO',
    itemName: 'ANTENA GPS GP-39 FURUNO + COAXIAL CABLE 15 MTR',
    category: 'Elektrikal & Navigasi',
    unit: 'SET',
    currentStock: 1,
    openFpbCount: 1,
    requestingVessels: ['TB KING STAR'],
    totalRequestedQty: 1,
    recommendedOrderQty: 2,
    avgUnitPrice: 4200000,
    totalEstimatedCost: 8400000,
    urgency: 'REORDER',
    urgencyReason: 'Unit cadangan navigasi vital armada pelayaran jarak jauh.',
    leadTimeDays: 8,
    potentialBulkDiscount: 5.0,
    potentialSavingsAmount: 420000,
    reorderPoint: 2,
    monthlyConsumption: 1,
    suggestedVendor: 'PT. Furuno Maritim Indonesia / CV. Radar Bahari',
    fpbRefs: ['CPL-FPB-26-0004837'],
  },
  {
    id: 'plan-009',
    itemCode: 'PUMP-IMPEL-JABSCO',
    itemName: 'IMPELLER NEOPRENE COOLING PUMP JABSCO (DIAMETER 95 MM)',
    category: 'Suku Cadang Mesin',
    unit: 'PCS',
    currentStock: 2,
    openFpbCount: 3,
    requestingVessels: ['SV TWINSISTER 305', 'SV TWINSISTER 307', 'SPEED BOAT 04'],
    totalRequestedQty: 6,
    recommendedOrderQty: 10,
    avgUnitPrice: 1850000,
    totalEstimatedCost: 18500000,
    urgency: 'REORDER',
    urgencyReason: 'Komponen pompa pendingin air laut yang aus berkala tiap 6 bulan.',
    leadTimeDays: 5,
    potentialBulkDiscount: 8.0,
    potentialSavingsAmount: 1480000,
    reorderPoint: 4,
    monthlyConsumption: 2,
    suggestedVendor: 'PT. Samudra Marine Teknik Balikpapan',
    fpbRefs: ['CPL-FPB-26-0003595', 'CPL-FPB-26-0004990', 'SP-FPB-26-0000599'],
  },
  {
    id: 'plan-010',
    itemCode: 'RIG-SHACKLE-G209-25T',
    itemName: 'SHACKLE BOW SCREW PIN CROSBY G-209 KAPASITAS 25 TON',
    category: 'Mooring & Deck Equipment',
    unit: 'PCS',
    currentStock: 3,
    openFpbCount: 2,
    requestingVessels: ['TK CPL 250', 'TK COASWAY 1803'],
    totalRequestedQty: 8,
    recommendedOrderQty: 12,
    avgUnitPrice: 1950000,
    totalEstimatedCost: 23400000,
    urgency: 'PLANNED',
    urgencyReason: 'Perlengkapan rigging penarikan tongkang batubara.',
    leadTimeDays: 7,
    potentialBulkDiscount: 10.0,
    potentialSavingsAmount: 2340000,
    reorderPoint: 5,
    monthlyConsumption: 3,
    suggestedVendor: 'PT. Crosby Rigging Supply / PT. Sinar Baru',
    fpbRefs: ['HL-FPB-26-0001434', 'SP-FPB-26-0000641'],
  },
];

export async function GET() {
  try {
    const items = [...MASTER_PLANNING_ITEMS];

    const criticalCount = items.filter((i) => i.urgency === 'CRITICAL').length;
    const reorderCount = items.filter((i) => i.urgency === 'REORDER').length;
    const plannedCount = items.filter((i) => i.urgency === 'PLANNED').length;

    const totalEstimatedBudget = items.reduce((sum, i) => sum + i.totalEstimatedCost, 0);
    const totalPotentialSavings = items.reduce((sum, i) => sum + i.potentialSavingsAmount, 0);

    const vesselsSet = new Set<string>();
    items.forEach((i) => i.requestingVessels.forEach((v) => vesselsSet.add(v)));

    const categories = Array.from(new Set(items.map((i) => i.category))).sort();

    const responseData: PurchasePlanningResponse = {
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

    return NextResponse.json(responseData, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error?.message || 'Gagal memproses data perencanaan pengadaan' },
      { status: 500 }
    );
  }
}
