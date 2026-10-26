import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import {
  FpbReviewRecord,
  FpbReviewStatus,
  FpbUrgency,
  FpbPriorityLevel,
  FpbItemReview,
  FpbDuplicateAlert,
  FpbReviewSummaryMetrics,
  ItemDecision,
  ItemStockStatus,
  FpbAttachment,
} from '@/types/fpbReview';
import { InventoryItem } from '@/types/procurement';
import { isR2Configured, getObjectFromR2, uploadToR2 } from '@/utils/r2Client';
import { findDocumentsByFpb } from '@/utils/docRelationResolver';
import { formatDateDdMmYy } from '@/utils/formatDate';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const maxDuration = 180;

const R2_FPB_REVIEWS_KEY = 'fpb-metadata/reviews.json';
const LOCAL_REVIEWS_PATH = path.join(process.cwd(), 'src', 'data', 'fpb-reviews.json');
const LOCAL_INVENTORY_PATH = path.join(process.cwd(), 'src', 'data', 'initialInventoryData.json');

// Memory cache for fast response
let cachedReviews: FpbReviewRecord[] | null = null;
let cachedInventory: InventoryItem[] | null = null;

/**
 * Load Inventory Data for stock checks
 */
function getInventory(): InventoryItem[] {
  if (cachedInventory && cachedInventory.length > 0) return cachedInventory;
  try {
    if (fs.existsSync(LOCAL_INVENTORY_PATH)) {
      const raw = fs.readFileSync(LOCAL_INVENTORY_PATH, 'utf-8');
      cachedInventory = JSON.parse(raw);
      return cachedInventory || [];
    }
  } catch (err) {
    console.warn('[review-fpb] Gagal membaca inventory lokal:', err);
  }
  return [];
}

/**
 * Find matching inventory stock for an item name or item code
 */
function findStockMatch(itemName: string, itemCode?: string, entity?: string): {
  stockAvailable: number;
  stockStatus: ItemStockStatus;
  matchedInventoryItem?: string;
  inventoryEntity?: string;
} {
  const inventory = getInventory();
  if (!inventory || inventory.length === 0) {
    return { stockAvailable: 0, stockStatus: 'NOT_CHECKED' };
  }

  const cleanName = (itemName || '').trim().toLowerCase();
  const cleanCode = (itemCode || '').trim().toLowerCase();
  const targetEntity = (entity || '').trim().toUpperCase();

  // 1. Exact item code match
  if (cleanCode && cleanCode.length > 2) {
    const match = inventory.find((inv) => {
      const invCode = (inv.itemCode || '').toLowerCase();
      if (invCode === cleanCode) {
        if (targetEntity && inv.entity) {
          return inv.entity.toUpperCase() === targetEntity;
        }
        return true;
      }
      return false;
    });

    if (match) {
      const qty = match.quantity || 0;
      return {
        stockAvailable: qty,
        stockStatus: qty > 0 ? 'IN_STOCK' : 'OUT_OF_STOCK',
        matchedInventoryItem: `[${match.itemCode}] ${match.description} (${match.entity || 'CPG'})`,
        inventoryEntity: match.entity,
      };
    }
  }

  // 2. Tokenized Description Match
  if (cleanName.length >= 3) {
    // Extract keywords (filter out short words like 'di', 'dan', 'ke', etc.)
    const words = cleanName
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length >= 3);

    if (words.length > 0) {
      let bestMatch: InventoryItem | null = null;
      let highestScore = 0;

      for (const inv of inventory) {
        if (!inv.description) continue;
        const invDesc = inv.description.toLowerCase();
        let score = 0;
        for (const w of words) {
          if (invDesc.includes(w)) score++;
        }
        if (score > highestScore && score >= Math.min(2, words.length)) {
          highestScore = score;
          bestMatch = inv;
          // If perfect match and entity matches, stop early
          if (score === words.length && targetEntity && inv.entity?.toUpperCase() === targetEntity) {
            break;
          }
        }
      }

      if (bestMatch) {
        const qty = bestMatch.quantity || 0;
        return {
          stockAvailable: qty,
          stockStatus: qty > 0 ? 'IN_STOCK' : 'OUT_OF_STOCK',
          matchedInventoryItem: `[${bestMatch.itemCode}] ${bestMatch.description} (${bestMatch.entity || 'CPG'})`,
          inventoryEntity: bestMatch.entity,
        };
      }
    }
  }

  return { stockAvailable: 0, stockStatus: 'OUT_OF_STOCK' };
}

/**
 * Load Reviews from Cloudflare R2 with fallback to local disk
 */
async function loadReviews(): Promise<FpbReviewRecord[]> {
  // 1. Try Cloudflare R2
  if (isR2Configured()) {
    try {
      const obj = await getObjectFromR2(R2_FPB_REVIEWS_KEY);
      if (obj && obj.body) {
        const text = Buffer.from(obj.body).toString('utf-8');
        const parsed = JSON.parse(text);
        if (Array.isArray(parsed) && parsed.length > 0) {
          cachedReviews = parsed;
          return parsed;
        }
      }
    } catch (err) {
      console.warn('[review-fpb] Gagal membaca dari Cloudflare R2:', err);
    }
  }

  // 2. Fallback to local file
  try {
    if (fs.existsSync(LOCAL_REVIEWS_PATH)) {
      const raw = fs.readFileSync(LOCAL_REVIEWS_PATH, 'utf-8');
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        cachedReviews = parsed;
        return parsed;
      }
    }
  } catch (err) {
    console.warn('[review-fpb] Gagal membaca file lokal:', err);
  }

  // 3. Fallback: Seed from existing procurement or sample data
  const seeded = seedInitialReviews();
  cachedReviews = seeded;
  await saveReviews(seeded);
  return seeded;
}

/**
 * Save Reviews to Cloudflare R2 and local disk
 */
async function saveReviews(records: FpbReviewRecord[]): Promise<boolean> {
  cachedReviews = records;

  // 1. Save locally
  try {
    const dir = path.dirname(LOCAL_REVIEWS_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(LOCAL_REVIEWS_PATH, JSON.stringify(records, null, 2), 'utf-8');
  } catch (err) {
    console.warn('[review-fpb] Gagal menyimpan file lokal:', err);
  }

  // 2. Save to Cloudflare R2
  if (isR2Configured()) {
    try {
      const payload = JSON.stringify(records, null, 2);
      await uploadToR2({
        key: R2_FPB_REVIEWS_KEY,
        body: Buffer.from(payload, 'utf-8'),
        contentType: 'application/json',
      });
      return true;
    } catch (err) {
      console.error('[review-fpb] Gagal menyimpan ke Cloudflare R2:', err);
      return false;
    }
  }

  return true;
}

/**
 * Helper: Parse date to timestamp for sorting and duplicate comparison
 */
function parseDateToTs(dStr?: string): number {
  if (!dStr) return 0;
  // Format dd/mm/yy or dd/mm/yyyy
  const parts = dStr.split(/[-/]/);
  if (parts.length === 3) {
    let day = parseInt(parts[0], 10);
    let month = parseInt(parts[1], 10) - 1;
    let year = parseInt(parts[2], 10);
    if (year < 100) year += 2000;
    return new Date(year, month, day).getTime();
  }
  const parsed = Date.parse(dStr);
  return isNaN(parsed) ? 0 : parsed;
}

/**
 * Compute Duplicate Alerts across all records
 */
function enrichDuplicateAlerts(records: FpbReviewRecord[]): FpbReviewRecord[] {
  // Group by normalized armada
  const byArmada = new Map<string, FpbReviewRecord[]>();

  for (const rec of records) {
    const armKey = (rec.armada || 'UNKNOWN').trim().toUpperCase();
    if (!byArmada.has(armKey)) {
      byArmada.set(armKey, []);
    }
    byArmada.get(armKey)!.push(rec);
  }

  const DAY_MS = 24 * 60 * 60 * 1000;
  const WINDOW_DAYS = 60; // 60 days duplicate detection window

  byArmada.forEach((armRecords) => {
    if (armRecords.length < 2) return;

    for (let i = 0; i < armRecords.length; i++) {
      const current = armRecords[i];
      const currentTs = parseDateToTs(current.date);
      const alerts: FpbDuplicateAlert[] = [];

      for (let j = 0; j < armRecords.length; j++) {
        if (i === j) continue;
        const other = armRecords[j];
        const otherTs = parseDateToTs(other.date);

        const diffDays = Math.abs(currentTs - otherTs) / DAY_MS;
        if (diffDays <= WINDOW_DAYS) {
          // Check for similar purpose or matching items
          const currentPurpose = (current.purpose || '').toLowerCase();
          const otherPurpose = (other.purpose || '').toLowerCase();

          let matchReason = '';

          // Compare items if available
          if (current.items && current.items.length > 0 && other.items && other.items.length > 0) {
            for (const itemA of current.items) {
              for (const itemB of other.items) {
                if (
                  (itemA.itemCode && itemB.itemCode && itemA.itemCode === itemB.itemCode) ||
                  (itemA.itemName && itemB.itemName && itemA.itemName.toLowerCase().includes(itemB.itemName.toLowerCase()))
                ) {
                  matchReason = `Item sama: "${itemA.itemName}" diajukan pada ${other.date}`;
                  break;
                }
              }
              if (matchReason) break;
            }
          }

          // Compare purpose keywords if no item match yet
          if (!matchReason && currentPurpose.length > 5 && otherPurpose.length > 5) {
            const wordsA = currentPurpose.split(/\s+/).filter((w) => w.length >= 4);
            const commonWords = wordsA.filter((w) => otherPurpose.includes(w));
            if (commonWords.length >= 2) {
              matchReason = `Keperluan mirip: "${commonWords.join(' ')}" pada ${other.date}`;
            }
          }

          // If general frequent submission within 14 days
          if (!matchReason && diffDays <= 14) {
            matchReason = `Pengajuan berdekatan (${Math.round(diffDays)} hari lalu: ${other.date})`;
          }

          if (matchReason) {
            alerts.push({
              fpbNo: other.fpbNo,
              date: other.date,
              armada: other.armada,
              matchedItem: matchReason,
              similarityNotes: `Pengajuan serupa dari armada ${other.armada} (${Math.round(diffDays)} hari selisih)`,
            });
          }
        }
      }

      current.duplicateAlerts = alerts;
    }
  });

  return records;
}

/**
 * Seed initial review records from real known FPBs and procurement records
 */
function seedInitialReviews(): FpbReviewRecord[] {
  const sampleFpbs: Array<{
    fpbNo: string;
    entity: string;
    armada: string;
    date: string;
    purpose: string;
    efpbStatus: string;
    isReceivedLogistik: boolean;
    urgency: FpbUrgency;
    reviewStatus: FpbReviewStatus;
    picPurchasing: string;
    reviewNotes: string;
    items: FpbItemReview[];
  }> = [
    {
      fpbNo: 'CPL-FPB-26-0004498',
      entity: 'CPL',
      armada: 'TB. CINDARA PRATAMA 01',
      date: '18/10/26',
      purpose: 'Pengadaan Spare Part Main Engine & Filter Oli Genset No. 1',
      efpbStatus: 'Approved',
      isReceivedLogistik: true,
      urgency: 'URGENT',
      reviewStatus: 'PENDING_REVIEW',
      picPurchasing: 'Wahyu Hidayat',
      reviewNotes: 'Prioritas tinggi: Armada beroperasi di Selat Makassar, butuh pasokan filter segera.',
      items: [
        {
          no: 1,
          itemCode: 'FLT-OIL-001',
          itemName: 'OIL FILTER CARTRIDGE CATERPILLAR 3406',
          qty: 4,
          unit: 'Pcs',
          description: 'Ganti filter berkala 500 jam genset',
          priority: 'Urgent',
          stockAvailable: 2,
          stockStatus: 'PARTIAL',
          matchedInventoryItem: '[FLT-OIL-001] FILTER OLI MESIN CPL',
          inventoryEntity: 'CPL',
          decision: 'STOCK',
          notes: 'Ambil 2 pcs dari gudang Samarinda, 2 pcs sisa dibuatkan PO',
        },
        {
          no: 2,
          itemCode: 'OIL-MED-040',
          itemName: 'MEDITRAN S SAE 40 (DRUM 209L)',
          qty: 2,
          unit: 'Drum',
          description: 'Oli pelumas mesin genset',
          priority: 'Urgent',
          stockAvailable: 5,
          stockStatus: 'IN_STOCK',
          matchedInventoryItem: '[OIL-MED-040] OLI PERTAMINA MEDITRAN S 40',
          inventoryEntity: 'CPL',
          decision: 'STOCK',
          notes: 'Stok mencukupi di gudang CPL Samarinda',
        },
      ],
    },
    {
      fpbNo: 'MO-FPB-26-0001751',
      entity: 'MO',
      armada: 'TB. MANDAR 08',
      date: '15/10/26',
      purpose: 'Pengadaan Kebutuhan Deck & Safety Tools Operasional Kapal',
      efpbStatus: 'Approved',
      isReceivedLogistik: true,
      urgency: 'NORMAL',
      reviewStatus: 'APPROVED_PO',
      picPurchasing: 'Rina Sugiarto',
      reviewNotes: 'Disetujui untuk penerbitan PO ke vendor PT Surya Perdana.',
      items: [
        {
          no: 1,
          itemCode: 'KAI01301001-UGO',
          itemName: 'KAIN ABSORBENT OIL PAD (UGO)',
          qty: 20,
          unit: 'Pcs',
          description: 'Penanganan ceceran minyak di kamar mesin',
          priority: 'Normal',
          stockAvailable: 350,
          stockStatus: 'IN_STOCK',
          matchedInventoryItem: '[KAI01301001-UGO] KAIN ABSORBENT OIL PAD (UGO) (MO)',
          inventoryEntity: 'MO',
          decision: 'STOCK',
          notes: 'Disediakan langsung dari gudang MO',
        },
        {
          no: 2,
          itemCode: 'GUR00602001-ZZZ',
          itemName: 'MATA GURINDA POTONG 4" (PCS)',
          qty: 50,
          unit: 'Pcs',
          description: 'Perbaikan konstruksi railing deck',
          priority: 'Normal',
          stockAvailable: 230,
          stockStatus: 'IN_STOCK',
          matchedInventoryItem: '[GUR00602001-ZZZ] MATA GURINDA POTONG 4" (PCS) (00) (MO)',
          inventoryEntity: 'MO',
          decision: 'STOCK',
          notes: 'Ambil dari inventori workshop Mandar Ocean',
        },
      ],
    },
    {
      fpbNo: 'GAJ-FPB-26-0000976',
      entity: 'GAJ',
      armada: 'DOCKING GAJ BALIKPAPAN',
      date: '12/10/26',
      purpose: 'Material Pelat Baja & Kawat Las Repair Lambung Kapal Tongkang',
      efpbStatus: 'Approved',
      isReceivedLogistik: true,
      urgency: 'EMERGENCY',
      reviewStatus: 'APPROVED_PO',
      picPurchasing: 'Budi Santoso',
      reviewNotes: 'Docking darurat: Tongkang mengalami kebocoran di kompartemen depan.',
      items: [
        {
          no: 1,
          itemCode: 'PLT-BJ-012',
          itemName: 'PELAT BAJA BKI GRADE A 12MM X 5FT X 20FT',
          qty: 6,
          unit: 'Lembar',
          description: 'Replating plat lambung bottom',
          priority: 'Emergency',
          stockAvailable: 0,
          stockStatus: 'OUT_OF_STOCK',
          matchedInventoryItem: 'Belum ada stok di gudang galangan',
          inventoryEntity: 'GAJ',
          decision: 'PO',
          notes: 'PO kilat ke PT Krakatau Steel / Distributor Balikpapan',
        },
        {
          no: 2,
          itemCode: 'KWT-LAS-LB52',
          itemName: 'KAWAT LAS KOBELCO LB-52 DIA 3.2MM (DOS 20KG)',
          qty: 15,
          unit: 'Dos',
          description: 'Pengelasan struktural BKI',
          priority: 'Emergency',
          stockAvailable: 0,
          stockStatus: 'OUT_OF_STOCK',
          matchedInventoryItem: 'Stok kosong di workshop',
          inventoryEntity: 'GAJ',
          decision: 'PO',
          notes: 'PO darurat',
        },
      ],
    },
    {
      fpbNo: 'HL-FPB-26-0000412',
      entity: 'HL',
      armada: 'TB. HANA 02',
      date: '08/10/26',
      purpose: 'Peralatan Navigasi GPS & Marine Radio VHF',
      efpbStatus: 'Approved',
      isReceivedLogistik: false,
      urgency: 'NORMAL',
      reviewStatus: 'NEED_CLARIFICATION',
      picPurchasing: 'Wahyu Hidayat',
      reviewNotes: 'Perlu klarifikasi spesifikasi antena radio VHF yang sesuai dengan bracket yang ada di kapal.',
      items: [
        {
          no: 1,
          itemCode: 'RAD-VHF-ICOM',
          itemName: 'RADIO MARINE VHF ICOM IC-M330',
          qty: 1,
          unit: 'Unit',
          description: 'Ganti radio VHF kamar kemudi yang rusak',
          priority: 'Normal',
          stockAvailable: 0,
          stockStatus: 'OUT_OF_STOCK',
          matchedInventoryItem: 'Non-stock item',
          inventoryEntity: 'HL',
          decision: 'HOLD',
          notes: 'Menunggu konfirmasi panjang kabel & tipe antena dari nahkoda',
        },
      ],
    },
    {
      fpbNo: 'CPL-FPB-26-0004497',
      entity: 'CPL',
      armada: 'TB. CINDARA PRATAMA 01',
      date: '28/09/26',
      purpose: 'Perlengkapan Cat & Thinner Maintenance Lambung Kapal',
      efpbStatus: 'Approved',
      isReceivedLogistik: true,
      urgency: 'NORMAL',
      reviewStatus: 'FULFILL_STOCK',
      picPurchasing: 'Rina Sugiarto',
      reviewNotes: 'Seluruh material disuplai langsung dari stok persediaan CPL Samarinda.',
      items: [
        {
          no: 1,
          itemCode: 'CAT-EPX-001',
          itemName: 'CAT PRIMER EPOXY JOTUN BARRIER 80 (PAIL)',
          qty: 4,
          unit: 'Pail',
          description: 'Pengecatan deck & lambung',
          priority: 'Normal',
          stockAvailable: 12,
          stockStatus: 'IN_STOCK',
          matchedInventoryItem: '[CAT-EPX-001] CAT JOTUN BARRIER 80 (CPL)',
          inventoryEntity: 'CPL',
          decision: 'STOCK',
          notes: 'Tersedia di gudang cat CPL',
        },
      ],
    },
  ];

  const nowIso = new Date().toISOString();

  return sampleFpbs.map((s) => {
    const rel = findDocumentsByFpb(s.fpbNo);
    return {
      id: `fpb-rev-${s.fpbNo}`,
      fpbNo: s.fpbNo,
      originalFpb: s.fpbNo.replace(/-FPB-/i, '/LOG/FPB/'),
      entity: s.entity,
      armada: s.armada,
      date: s.date,
      purpose: s.purpose,
      efpbStatus: s.efpbStatus,
      isReceivedLogistik: s.isReceivedLogistik,
      pdfUrl: `https://e-fpb.cindaragroup.com/files/Approved_rev_sign_${encodeURIComponent(s.fpbNo)}.pdf`,
      reviewStatus: s.reviewStatus,
      urgency: s.urgency,
      picPurchasing: s.picPurchasing,
      reviewNotes: s.reviewNotes,
      items: s.items,
      duplicateAlerts: [],
      relatedDocs: {
        poNos: rel?.pos || [],
        fstbNos: rel?.fstbs || [],
        ttbNos: rel?.ttbs || [],
      },
      reviewedBy: 'Wahyu Hidayat',
      reviewedAt: nowIso,
      updatedAt: nowIso,
      createdAt: nowIso,
    };
  });
}

/**
 * Helper: Menghitung target SLA dan status prioritas (P1: 1-2 hari, P2: 3-14 hari, P3: 14-30 hari)
 */
function enrichSlaAndPriority(rec: FpbReviewRecord): FpbReviewRecord {
  // 1. Tentukan level prioritas dari item barang jika ada
  let level: FpbPriorityLevel = rec.priorityLevel || 'P3';

  if (rec.items && rec.items.length > 0) {
    let hasP1 = false;
    let hasP2 = false;
    for (const it of rec.items) {
      const p = (it.priority || '').toUpperCase().trim();
      if (p === 'P1' || p.includes('P1') || p.includes('EMERGENCY') || p.includes('DARURAT')) {
        hasP1 = true;
        break;
      } else if (p === 'P2' || p.includes('P2') || p.includes('URGENT') || p.includes('MENENGAH')) {
        hasP2 = true;
      }
    }
    if (hasP1) level = 'P1';
    else if (hasP2) level = 'P2';
    else level = 'P3';
  } else if (!rec.priorityLevel) {
    if (rec.urgency === 'EMERGENCY') level = 'P1';
    else if (rec.urgency === 'URGENT') level = 'P2';
    else level = 'P3';
  }

  // 2. SLA target pengadaan: P1 (2 hari), P2 (14 hari), P3 (30 hari)
  const slaMaxDays = level === 'P1' ? 2 : level === 'P2' ? 14 : 30;
  const createdTs = parseDateToTs(rec.date);

  let slaTargetDate = '';
  let slaDaysRemaining = 0;
  let slaStatus: 'ON_TRACK' | 'DUE_SOON' | 'OVERDUE' = 'ON_TRACK';

  if (createdTs > 0) {
    const targetTs = createdTs + slaMaxDays * 24 * 60 * 60 * 1000;
    const targetObj = new Date(targetTs);
    const day = String(targetObj.getDate()).padStart(2, '0');
    const month = String(targetObj.getMonth() + 1).padStart(2, '0');
    const year = String(targetObj.getFullYear()).slice(-2);
    slaTargetDate = `${day}/${month}/${year}`;

    const nowTs = Date.now();
    slaDaysRemaining = Math.ceil((targetTs - nowTs) / (24 * 60 * 60 * 1000));

    if (slaDaysRemaining < 0) {
      slaStatus = 'OVERDUE';
    } else if (slaDaysRemaining <= (level === 'P1' ? 1 : 3)) {
      slaStatus = 'DUE_SOON';
    } else {
      slaStatus = 'ON_TRACK';
    }
  }

  return {
    ...rec,
    priorityLevel: level,
    slaTargetDate,
    slaDaysRemaining,
    slaStatus,
  };
}

/**
 * Calculate Summary Metrics
 */
function calculateMetrics(records: FpbReviewRecord[]): FpbReviewSummaryMetrics {
  let pending = 0;
  let approvedPo = 0;
  let fulfillStock = 0;
  let needClarification = 0;
  let rejected = 0;
  let urgent = 0;
  let emergency = 0;
  let p1Count = 0;
  let p2Count = 0;
  let p3Count = 0;
  let overdueCount = 0;

  for (const r of records) {
    switch (r.reviewStatus) {
      case 'PENDING_REVIEW':
        pending++;
        break;
      case 'APPROVED_PO':
        approvedPo++;
        break;
      case 'FULFILL_STOCK':
        fulfillStock++;
        break;
      case 'NEED_CLARIFICATION':
        needClarification++;
        break;
      case 'REJECTED':
        rejected++;
        break;
      default:
        pending++;
        break;
    }

    if (r.urgency === 'URGENT') urgent++;
    else if (r.urgency === 'EMERGENCY') emergency++;

    if (r.priorityLevel === 'P1') p1Count++;
    else if (r.priorityLevel === 'P2') p2Count++;
    else p3Count++;

    if (r.slaStatus === 'OVERDUE') overdueCount++;
  }

  return {
    total: records.length,
    pending,
    approvedPo,
    fulfillStock,
    needClarification,
    rejected,
    urgent,
    emergency,
    p1Count,
    p2Count,
    p3Count,
    overdueCount,
  };
}

// ==========================================
// API HANDLERS
// ==========================================

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const fpbQuery = searchParams.get('fpb');
    const entity = searchParams.get('entity');
    const status = searchParams.get('status');

    let records = await loadReviews();

    // Cross-link latest document relations
    records = records.map((rec) => {
      const rel = findDocumentsByFpb(rec.fpbNo);
      return {
        ...rec,
        relatedDocs: {
          poNos: Array.from(new Set([...(rec.relatedDocs?.poNos || []), ...(rel?.pos || [])])),
          fstbNos: Array.from(new Set([...(rec.relatedDocs?.fstbNos || []), ...(rel?.fstbs || [])])),
          ttbNos: Array.from(new Set([...(rec.relatedDocs?.ttbNos || []), ...(rel?.ttbs || [])])),
        },
      };
    });

    // Detect duplicate requests
    records = enrichDuplicateAlerts(records);

    // Enrich SLA & Priority scale (P1: 1-2 days, P2: 3-14 days, P3: 14-30 days)
    records = records.map(enrichSlaAndPriority);

    // Apply query filters if provided
    let filtered = records;
    if (fpbQuery) {
      const q = fpbQuery.trim().toLowerCase();
      filtered = filtered.filter(
        (r) =>
          r.fpbNo.toLowerCase().includes(q) ||
          r.armada.toLowerCase().includes(q) ||
          r.purpose.toLowerCase().includes(q)
      );
    }
    if (entity && entity !== 'ALL') {
      filtered = filtered.filter((r) => r.entity.toUpperCase() === entity.toUpperCase());
    }
    if (status && status !== 'ALL') {
      filtered = filtered.filter((r) => r.reviewStatus === status);
    }
    const priority = searchParams.get('priority');
    if (priority && priority !== 'ALL') {
      filtered = filtered.filter((r) => r.priorityLevel === priority);
    }

    // Sort: newest date first
    filtered.sort((a, b) => {
      const tsA = parseDateToTs(a.date);
      const tsB = parseDateToTs(b.date);
      return tsB - tsA;
    });

    const metrics = calculateMetrics(records);

    return NextResponse.json({
      success: true,
      data: filtered,
      total: records.length,
      metrics,
    });
  } catch (error: any) {
    console.error('Error in GET /api/review-fpb:', error);
    return NextResponse.json(
      {
        success: false,
        message: error.message || 'Gagal memuat data review FPB.',
      },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get('content-type') || '';
    let body: any = {};
    let uploadFile: File | null = null;

    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData();
      body.action = (formData.get('action') as string) || 'upload_attachment';
      body.fpbNo = formData.get('fpbNo') as string;
      body.caption = (formData.get('caption') as string) || '';
      body.uploadedBy = (formData.get('uploadedBy') as string) || 'Reviewer';
      body.source = (formData.get('source') as string) || 'REVIEWER_UPLOAD';
      uploadFile = formData.get('file') as File | null;
    } else {
      body = await req.json().catch(() => ({}));
    }

    const action = body.action || 'save_review';
    let records = await loadReviews();

    // ----------------------------------------------------
    // Action 1: Save or Update Review Decision
    // ----------------------------------------------------
    if (action === 'save_review') {
      const {
        fpbNo,
        reviewStatus,
        urgency,
        priorityLevel,
        picPurchasing,
        reviewNotes,
        items,
        attachments,
        reviewedBy,
      } = body;

      if (!fpbNo) {
        return NextResponse.json(
          { success: false, message: 'Nomor FPB wajib disertakan.' },
          { status: 400 }
        );
      }

      const existingIndex = records.findIndex(
        (r) => r.fpbNo.toLowerCase() === fpbNo.toLowerCase()
      );

      const nowIso = new Date().toISOString();

      if (existingIndex >= 0) {
        // Update existing record
        const current = records[existingIndex];
        records[existingIndex] = {
          ...current,
          reviewStatus: reviewStatus || current.reviewStatus,
          urgency: urgency || current.urgency,
          priorityLevel: priorityLevel || current.priorityLevel,
          picPurchasing: picPurchasing !== undefined ? picPurchasing : current.picPurchasing,
          reviewNotes: reviewNotes !== undefined ? reviewNotes : current.reviewNotes,
          items: Array.isArray(items) ? items : current.items,
          attachments: Array.isArray(attachments) ? attachments : current.attachments,
          isRevised: body.isRevised !== undefined ? body.isRevised : current.isRevised,
          revisionCount: body.revisionCount !== undefined ? body.revisionCount : current.revisionCount,
          revisionNote: body.revisionNote !== undefined ? body.revisionNote : current.revisionNote,
          reviewedBy: reviewedBy || current.reviewedBy,
          reviewedAt: nowIso,
          updatedAt: nowIso,
        };
      } else {
        // Create new record
        const rel = findDocumentsByFpb(fpbNo);
        const newRecord: FpbReviewRecord = {
          id: `fpb-rev-${fpbNo}`,
          fpbNo,
          originalFpb: body.originalFpb || fpbNo,
          entity: body.entity || 'CPL',
          armada: body.armada || 'Armada Kapal',
          date: body.date || formatDateDdMmYy(new Date().toISOString()),
          purpose: body.purpose || '',
          efpbStatus: body.efpbStatus || 'Approved',
          isReceivedLogistik: body.isReceivedLogistik ?? true,
          pdfUrl: body.pdfUrl || `https://e-fpb.cindaragroup.com/files/Approved_rev_sign_${encodeURIComponent(fpbNo)}.pdf`,
          reviewStatus: reviewStatus || 'PENDING_REVIEW',
          urgency: urgency || 'NORMAL',
          picPurchasing: picPurchasing || '-',
          reviewNotes: reviewNotes || '',
          items: Array.isArray(items) ? items : [],
          attachments: Array.isArray(attachments) ? attachments : [],
          duplicateAlerts: [],
          relatedDocs: {
            poNos: rel?.pos || [],
            fstbNos: rel?.fstbs || [],
            ttbNos: rel?.ttbs || [],
          },
          isRevised: body.isRevised,
          revisionCount: body.revisionCount,
          revisionNote: body.revisionNote,
          reviewedBy,
          reviewedAt: nowIso,
          updatedAt: nowIso,
          createdAt: nowIso,
        };
        records.unshift(newRecord);
      }

      records = enrichDuplicateAlerts(records);
      records = records.map(enrichSlaAndPriority);
      await saveReviews(records);

      return NextResponse.json({
        success: true,
        message: `Keputusan review untuk FPB ${fpbNo} berhasil disimpan & disinkronkan ke Cloudflare R2!`,
        metrics: calculateMetrics(records),
      });
    }

    // ----------------------------------------------------
    // Action 1b: Upload New Attachment
    // ----------------------------------------------------
    if (action === 'upload_attachment') {
      const { fpbNo, caption, uploadedBy, source } = body;
      if (!fpbNo || !uploadFile) {
        return NextResponse.json(
          { success: false, message: 'Nomor FPB dan berkas file wajib disertakan.' },
          { status: 400 }
        );
      }

      const fileBuffer = Buffer.from(await uploadFile.arrayBuffer());
      const fileName = uploadFile.name;
      const fileExt = path.extname(fileName).toLowerCase();
      const isImg = /\.(jpe?g|png|webp|gif|bmp|svg)$/i.test(fileExt);
      const isPdf = fileExt === '.pdf';
      const fileType = isImg ? 'image' : isPdf ? 'pdf' : 'document';
      const uniqueId = `att-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      const safeFileName = `${Date.now()}_${fileName.replace(/[^a-zA-Z0-9._-]/g, '_')}`;

      let fileUrl = '';
      const r2Key = `fpb-attachments/${encodeURIComponent(fpbNo)}/${safeFileName}`;

      if (isR2Configured()) {
        try {
          const contentType = uploadFile.type || (isImg ? 'image/jpeg' : isPdf ? 'application/pdf' : 'application/octet-stream');
          await uploadToR2({
            key: r2Key,
            body: fileBuffer,
            contentType,
          });
          fileUrl = `/api/r2-file?key=${encodeURIComponent(r2Key)}`;
        } catch (r2Err) {
          console.warn('[review-fpb] Gagal upload attachment ke R2:', r2Err);
        }
      }

      if (!fileUrl) {
        const localDir = path.join(process.cwd(), 'src', 'app', 'public', 'fpb_attachments', fpbNo);
        if (!fs.existsSync(localDir)) {
          fs.mkdirSync(localDir, { recursive: true });
        }
        const localFilePath = path.join(localDir, safeFileName);
        fs.writeFileSync(localFilePath, fileBuffer);
        fileUrl = `/public/fpb_attachments/${encodeURIComponent(fpbNo)}/${encodeURIComponent(safeFileName)}`;
      }

      const newAttachment: FpbAttachment = {
        id: uniqueId,
        name: fileName,
        url: fileUrl,
        type: fileType,
        size: fileBuffer.length,
        uploadedBy: uploadedBy || 'Tim Review FPB',
        uploadedAt: new Date().toISOString(),
        source: (source as any) || 'REVIEWER_UPLOAD',
        caption: caption || undefined,
      };

      const targetIdx = records.findIndex((r) => r.fpbNo.toLowerCase() === fpbNo.toLowerCase());
      if (targetIdx >= 0) {
        records[targetIdx].attachments = records[targetIdx].attachments || [];
        records[targetIdx].attachments.push(newAttachment);
        records[targetIdx].updatedAt = new Date().toISOString();
        await saveReviews(records);
        return NextResponse.json({
          success: true,
          message: `Lampiran "${fileName}" berhasil disimpan!`,
          attachment: newAttachment,
          attachments: records[targetIdx].attachments,
        });
      }

      return NextResponse.json({
        success: false,
        message: `FPB ${fpbNo} tidak ditemukan dalam database review.`,
      }, { status: 404 });
    }

    // ----------------------------------------------------
    // Action 1c: Delete Attachment
    // ----------------------------------------------------
    if (action === 'delete_attachment') {
      const { fpbNo, attachmentId } = body;
      const targetIdx = records.findIndex((r) => r.fpbNo.toLowerCase() === fpbNo.toLowerCase());
      if (targetIdx >= 0) {
        records[targetIdx].attachments = (records[targetIdx].attachments || []).filter(
          (a) => a.id !== attachmentId
        );
        records[targetIdx].updatedAt = new Date().toISOString();
        await saveReviews(records);
        return NextResponse.json({
          success: true,
          message: 'Lampiran berhasil dihapus.',
          attachments: records[targetIdx].attachments,
        });
      }
      return NextResponse.json({ success: false, message: 'FPB tidak ditemukan.' }, { status: 404 });
    }

    // ----------------------------------------------------
    // Action 2: Sync from E-FPB FilesList
    // ----------------------------------------------------
    if (action === 'sync_efpb') {
      const mode = body.mode || 'quick'; // 'quick' (20) or 'full' (all pages)
      const username = body.username || 'Hermansyah';
      const password = body.password || 'Biocpl24!@#';
      const sessionId = body.sessionId || '';

      // Call internal sync-efpb-files API
      const syncUrl = new URL(
        `/api/sync-efpb-files?mode=${encodeURIComponent(mode)}&username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}&sessionId=${encodeURIComponent(sessionId)}`,
        req.url
      );

      const syncRes = await fetch(syncUrl.toString(), { cache: 'no-store' });
      const syncData = await syncRes.json().catch(() => ({}));

      if (!syncRes.ok || !syncData.success) {
        return NextResponse.json(
          {
            success: false,
            requiresAuth: syncRes.status === 401 || syncData.requiresAuth,
            message: syncData.message || `Gagal mengambil berkas e-FPB (HTTP ${syncRes.status}).`,
          },
          { status: syncRes.status || 502 }
        );
      }

      if (!Array.isArray(syncData.procurement)) {
        return NextResponse.json(
          { success: false, message: syncData.message || 'Data e-FPB tidak valid.' },
          { status: 400 }
        );
      }

      let addedCount = 0;
      let updatedCount = 0;
      const nowIso = new Date().toISOString();

      // Merge new FPB entries without overwriting existing review decisions
      for (const efpb of syncData.procurement) {
        if (!efpb.fpb || efpb.fpb === '-') continue;

        const cleanNo = efpb.fpb.trim();
        const existingIdx = records.findIndex(
          (r) => r.fpbNo.toLowerCase() === cleanNo.toLowerCase()
        );

        if (existingIdx >= 0) {
          // Preserve existing review status, pic, notes, items
          const existing = records[existingIdx];
          records[existingIdx] = {
            ...existing,
            armada: efpb.deptArmada || existing.armada,
            purpose: efpb.peruntukan || existing.purpose,
            isReceivedLogistik: efpb.statusBadge?.includes('TERDAFTAR') || existing.isReceivedLogistik,
            isRevised: efpb.isRevised !== undefined ? efpb.isRevised : existing.isRevised,
            revisionCount: efpb.revisionCount !== undefined ? efpb.revisionCount : existing.revisionCount,
            revisionNote: efpb.revisionNote !== undefined ? efpb.revisionNote : existing.revisionNote,
            updatedAt: nowIso,
          };
          updatedCount++;
        } else {
          // Add newly discovered FPB
          const rel = findDocumentsByFpb(cleanNo);
          records.unshift({
            id: `fpb-rev-${cleanNo}`,
            fpbNo: cleanNo,
            originalFpb: cleanNo.replace(/-FPB-/i, '/LOG/FPB/'),
            entity: efpb.entity || 'CPL',
            armada: efpb.deptArmada || 'Armada Kapal',
            date: efpb.date || formatDateDdMmYy(nowIso),
            purpose: efpb.peruntukan || 'Pengadaan Kebutuhan Operasional Kapal',
            efpbStatus: 'Approved',
            isReceivedLogistik: Boolean(efpb.statusBadge?.includes('TERDAFTAR')),
            pdfUrl: `https://e-fpb.cindaragroup.com/files/Approved_rev_sign_${encodeURIComponent(cleanNo)}.pdf`,
            reviewStatus: 'PENDING_REVIEW',
            urgency: 'NORMAL',
            picPurchasing: '-',
            reviewNotes: '',
            isRevised: efpb.isRevised,
            revisionCount: efpb.revisionCount,
            revisionNote: efpb.revisionNote,
            items: [],
            duplicateAlerts: [],
            relatedDocs: {
              poNos: rel?.pos || [],
              fstbNos: rel?.fstbs || [],
              ttbNos: rel?.ttbs || [],
            },
            updatedAt: nowIso,
            createdAt: nowIso,
          });
          addedCount++;
        }
      }

      records = enrichDuplicateAlerts(records);
      records = records.map(enrichSlaAndPriority);
      await saveReviews(records);

      return NextResponse.json({
        success: true,
        message: `Sinkronisasi e-FPB berhasil! Ditambahkan: ${addedCount} FPB baru, Diperbarui: ${updatedCount} FPB.`,
        addedCount,
        updatedCount,
        total: records.length,
        metrics: calculateMetrics(records),
        data: records,
      });
    }

    // ----------------------------------------------------
    // Action 3: Parse PDF & Check Warehouse Stock
    // ----------------------------------------------------
    if (action === 'parse_items') {
      const { fpbNo } = body;
      if (!fpbNo) {
        return NextResponse.json(
          { success: false, message: 'Nomor FPB diperlukan untuk parsing PDF.' },
          { status: 400 }
        );
      }

      // Call internal /api/parse-fpb-pdf
      const parseUrl = new URL(
        `/api/parse-fpb-pdf?fpb=${encodeURIComponent(fpbNo)}`,
        req.url
      );
      const parseRes = await fetch(parseUrl.toString(), { cache: 'no-store' });
      const parseData = await parseRes.json();

      let extractedItems: FpbItemReview[] = [];

      if (parseData.success && parseData.data && Array.isArray(parseData.data.items)) {
        const targetRec = records.find(
          (r) => r.fpbNo.toLowerCase() === fpbNo.toLowerCase()
        );
        const entity = targetRec?.entity || 'CPL';

        extractedItems = parseData.data.items.map((it: any, idx: number): FpbItemReview => {
          const itemName = it.itemName || it.itemCode || 'Item Tanpa Nama';
          const stock = findStockMatch(itemName, it.itemCode, entity);
          const reqQty = Number(it.qty) || 1;

          // Default smart decision based on stock
          let decision: ItemDecision = 'PO';
          if (stock.stockAvailable >= reqQty) {
            decision = 'STOCK';
          } else if (stock.stockAvailable > 0) {
            decision = 'PO';
          }

          let defaultNotes = '';
          if (stock.stockAvailable >= reqQty) {
            defaultNotes = `Stok gudang mencukupi (${stock.stockAvailable} ${it.unit || 'pcs'}). Disarankan penuhi dari stok gudang.`;
          } else if (stock.stockAvailable > 0) {
            defaultNotes = `Stok gudang parsial (${stock.stockAvailable} ${it.unit || 'pcs'}). Sisa dibuatkan PO.`;
          } else {
            defaultNotes = 'Stok gudang kosong. Diproses pembelian baru (PO).';
          }

          return {
            no: it.no || idx + 1,
            itemCode: it.itemCode || `ITEM-${idx + 1}`,
            itemName,
            qty: reqQty,
            unit: it.unit || 'Pcs',
            description: it.description || '',
            priority: it.priority || 'Normal',
            stockAvailable: stock.stockAvailable,
            stockStatus: stock.stockStatus,
            matchedInventoryItem: stock.matchedInventoryItem,
            inventoryEntity: stock.inventoryEntity,
            decision,
            notes: defaultNotes,
          };
        });

        // Update record with parsed items
        const targetIdx = records.findIndex(
          (r) => r.fpbNo.toLowerCase() === fpbNo.toLowerCase()
        );
        if (targetIdx >= 0) {
          records[targetIdx].items = extractedItems;
          if (parseData.data.tujuanPeruntukan && !records[targetIdx].purpose) {
            records[targetIdx].purpose = parseData.data.tujuanPeruntukan;
          }

          // Otomatis deteksi prioritas tertinggi dari item (P1: Utama, P2: Menengah, P3: Rutin)
          let autoPriority: FpbPriorityLevel = 'P3';
          for (const it of extractedItems) {
            const p = (it.priority || '').toUpperCase().trim();
            if (p === 'P1' || p.includes('P1') || p.includes('EMERGENCY') || p.includes('DARURAT')) {
              autoPriority = 'P1';
              break;
            } else if (p === 'P2' || p.includes('P2') || p.includes('URGENT') || p.includes('MENENGAH')) {
              autoPriority = 'P2';
            }
          }
          records[targetIdx].priorityLevel = autoPriority;
          if (autoPriority === 'P1') records[targetIdx].urgency = 'EMERGENCY';
          else if (autoPriority === 'P2') records[targetIdx].urgency = 'URGENT';
          else records[targetIdx].urgency = 'NORMAL';

          records[targetIdx].updatedAt = new Date().toISOString();
          records = records.map(enrichSlaAndPriority);
          await saveReviews(records);
        }
      }

      return NextResponse.json({
        success: true,
        message: `Berhasil mengekstrak ${extractedItems.length} item dari PDF resmi e-FPB.`,
        items: extractedItems,
      });
    }

    // ----------------------------------------------------
    // Action 4: Live Inventory Search Helper
    // ----------------------------------------------------
    if (action === 'check_stock') {
      const { keyword, itemCode, entity } = body;
      const match = findStockMatch(keyword || '', itemCode, entity);
      return NextResponse.json({
        success: true,
        match,
      });
    }

    return NextResponse.json(
      { success: false, message: `Action "${action}" tidak dikenali.` },
      { status: 400 }
    );
  } catch (error: any) {
    console.error('Error in POST /api/review-fpb:', error);
    return NextResponse.json(
      {
        success: false,
        message: error.message || 'Gagal memproses aksi review FPB.',
      },
      { status: 500 }
    );
  }
}

