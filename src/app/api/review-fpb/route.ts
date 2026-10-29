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
import { stampFpbPdf, formatToStampDate, formatToStampTimestamp } from '@/utils/fpbStamper';
import { triggerEfpbReceivedLogistic } from '@/utils/efpbApprovalTrigger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const maxDuration = 180;

const R2_FPB_REVIEWS_KEY = 'fpb-metadata/reviews.json';
const LOCAL_REVIEWS_PATH = path.join(process.cwd(), 'src', 'data', 'fpb-reviews.json');
const LOCAL_INVENTORY_PATH = path.join(process.cwd(), 'src', 'data', 'initialInventoryData.json');

// Memory cache for fast response
let cachedReviews: FpbReviewRecord[] | null = null;

// Daftar FPB dummy yang wajib dihapus permanen
const DUMMY_FPB_BLACKLIST = new Set([
  'CPL-FPB-26-0004498',
  'MO-FPB-26-0001751',
  'GAJ-FPB-26-0000976',
  'HL-FPB-26-0000412',
  'CPL-FPB-26-0004497',
]);
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
  // Read local file first
  let localList: FpbReviewRecord[] = [];
  try {
    if (fs.existsSync(LOCAL_REVIEWS_PATH)) {
      const raw = fs.readFileSync(LOCAL_REVIEWS_PATH, 'utf-8');
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) localList = parsed.filter((r) => !DUMMY_FPB_BLACKLIST.has(r.fpbNo));
    }
  } catch (err) {
    console.warn('[review-fpb] Gagal membaca file lokal:', err);
  }

  // 1. Try Cloudflare R2
  if (isR2Configured()) {
    try {
      const obj = await getObjectFromR2(R2_FPB_REVIEWS_KEY);
      if (obj && obj.body) {
        const text = Buffer.from(obj.body).toString('utf-8');
        let parsed: FpbReviewRecord[] = JSON.parse(text);
        if (Array.isArray(parsed) && parsed.length > 0) {
          // Clean up any old mock/stock images from R2
          let hasMergedUpdates = false;
          const withoutDummy = parsed.filter((r: FpbReviewRecord) => !DUMMY_FPB_BLACKLIST.has(r.fpbNo));
          if (withoutDummy.length !== parsed.length) {
            parsed = withoutDummy;
            hasMergedUpdates = true;
          }
          for (const r2Rec of parsed) {
            if (Array.isArray(r2Rec.attachments) && r2Rec.attachments.length > 0) {
              const cleaned = r2Rec.attachments.filter((a: FpbAttachment) => !a.url?.includes('unsplash.com'));
              if (cleaned.length !== r2Rec.attachments.length) {
                r2Rec.attachments = cleaned;
                hasMergedUpdates = true;
              }
            }
          }

          // If local has FPBs not yet in R2, unshift them
          for (const loc of localList) {
            const existsInR2 = parsed.some((r: FpbReviewRecord) => r.fpbNo.toLowerCase() === loc.fpbNo.toLowerCase());
            if (!existsInR2) {
              parsed.unshift(loc);
              hasMergedUpdates = true;
            }
          }

          if (hasMergedUpdates) {
            await saveReviews(parsed);
          }

          cachedReviews = parsed;
          return parsed;
        }
      }
    } catch (err) {
      console.warn('[review-fpb] Gagal membaca dari Cloudflare R2:', err);
    }
  }

  // 2. Fallback to local file
  if (localList.length > 0) {
    cachedReviews = localList;
    return localList;
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
  // Helper: Mengecek apakah teks peruntukan adalah teks template generic bawaan
  const isGenericPurposeText = (text?: string): boolean => {
    if (!text) return true;
    const lower = text.trim().toLowerCase();
    if (lower.length < 5) return true;
    if (
      lower.startsWith('kebutuhan operasional') ||
      lower.startsWith('pengadaan kebutuhan') ||
      lower.startsWith('kebutuhan rutin') ||
      lower.startsWith('operasional kantor') ||
      lower.startsWith('operasional kapal') ||
      lower.includes('kebutuhan operasional') ||
      lower === 'pengadaan operasional' ||
      lower === 'pengadaan kebutuhan operasional kapal' ||
      lower === '-'
    ) {
      return true;
    }
    return false;
  };

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

      // ATURAN: Jika berkas belum diekstrak (items kosong) DAN purpose masih template generic,
      // jangan berikan peringatan palsu karena keperluan asli belum dibaca dari PDF!
      const currentHasItems = Array.isArray(current.items) && current.items.length > 0;
      const currentHasSpecificPurpose = !isGenericPurposeText(current.purpose);

      if (!currentHasItems && !currentHasSpecificPurpose) {
        current.duplicateAlerts = [];
        continue;
      }

      for (let j = 0; j < armRecords.length; j++) {
        if (i === j) continue;
        const other = armRecords[j];
        const otherTs = parseDateToTs(other.date);

        const otherHasItems = Array.isArray(other.items) && other.items.length > 0;
        const otherHasSpecificPurpose = !isGenericPurposeText(other.purpose);

        // Abaikan pembanding jika pembanding juga belum memiliki data spesifik dari PDF
        if (!otherHasItems && !otherHasSpecificPurpose) {
          continue;
        }

        const diffDays = Math.abs(currentTs - otherTs) / DAY_MS;
        if (diffDays <= WINDOW_DAYS) {
          let matchReason = '';

          // 1. Prioritas Utama: Cocokkan item barang riil dari hasil ekstraksi PDF
          if (currentHasItems && otherHasItems) {
            for (const itemA of current.items!) {
              for (const itemB of other.items!) {
                const codeA = (itemA.itemCode || '').trim().toUpperCase();
                const codeB = (itemB.itemCode || '').trim().toUpperCase();
                const nameA = (itemA.itemName || '').trim().toLowerCase();
                const nameB = (itemB.itemName || '').trim().toLowerCase();

                // Match kode item valid
                if (codeA && codeB && codeA === codeB && !codeA.startsWith('ITEM-')) {
                  matchReason = `Item sama: "${itemA.itemName}" diajukan pada ${other.date}`;
                  break;
                }

                // Match nama item substansial (panjang >= 6 karakter dan identik/substring)
                if (
                  nameA.length >= 6 &&
                  nameB.length >= 6 &&
                  (nameA === nameB || (nameA.length > 10 && (nameA.includes(nameB) || nameB.includes(nameA))))
                ) {
                  matchReason = `Item serupa: "${itemA.itemName}" diajukan pada ${other.date}`;
                  break;
                }
              }
              if (matchReason) break;
            }
          }

          // 2. Cocokkan Keperluan / Peruntukan spesifik dari PDF (jika bukan generic)
          if (!matchReason && currentHasSpecificPurpose && otherHasSpecificPurpose) {
            const cleanA = (current.purpose || '').trim().toLowerCase();
            const cleanB = (other.purpose || '').trim().toLowerCase();

            // Jika peruntukan persis sama
            if (cleanA === cleanB) {
              matchReason = `Keperluan persis: "${current.purpose}" pada ${other.date}`;
            } else {
              const STOPWORDS = new Set([
                'untuk', 'u/', 'dan', 'yang', 'pada', 'dari', 'ke', 'di', 'ini', 'itu',
                'kebutuhan', 'operasional', 'pengadaan', 'rutin', 'kantor', 'office',
                'kapal', 'armada', 'dept', 'departemen', 'bagian', 'dengan', 'bulan',
                'tahun', 'unit', 'pcs', 'set', 'lot', 'pakai', 'habis', 'kerja'
              ]);

              const wordsA = cleanA
                .split(/[\s•,/-]+/)
                .map((w) => w.trim())
                .filter((w) => w.length >= 4 && !STOPWORDS.has(w));

              const wordsB = cleanB
                .split(/[\s•,/-]+/)
                .map((w) => w.trim())
                .filter((w) => w.length >= 4 && !STOPWORDS.has(w));

              // Minimal 2 kata spesifik cocok (contoh: "cat primer", "hose blasting")
              const commonWords = wordsA.filter((w) => wordsB.includes(w));
              if (commonWords.length >= 2) {
                matchReason = `Keperluan mirip: "${commonWords.join(' ')}" pada ${other.date}`;
              }
            }
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
  return [];
}

/**
 * Helper: Menghitung target SLA dan status prioritas (P1: 1-2 hari, P2: 3-14 hari, P3: 14-30 hari)
 */
function enrichSlaAndPriority(rec: FpbReviewRecord): FpbReviewRecord {
  // 1. Tentukan level prioritas
  let level: FpbPriorityLevel = 'P3';

  // ATURAN SINKRONISASI: Jika Urgensi = URGENT atau EMERGENCY -> Prioritas otomatis P1 - UTAMA (SLA 1-2 Hari)
  if (rec.urgency === 'URGENT' || rec.urgency === 'EMERGENCY') {
    level = 'P1';
  } else if (rec.items && rec.items.length > 0) {
    let hasP1 = false;
    let hasP2 = false;
    for (const it of rec.items) {
      const p = (it.priority || '').toUpperCase().trim();
      if (
        p === 'P1' ||
        p.includes('P1') ||
        p.includes('EMERGENCY') ||
        p.includes('DARURAT') ||
        p.includes('URGENT') ||
        p.includes('KRITIS')
      ) {
        hasP1 = true;
        break;
      } else if (p === 'P2' || p.includes('P2') || p.includes('MENENGAH')) {
        hasP2 = true;
      }
    }
    if (hasP1) level = 'P1';
    else if (hasP2) level = 'P2';
    else level = rec.priorityLevel || 'P3';
  } else if (rec.priorityLevel) {
    level = rec.priorityLevel;
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
        // Ensure attachments are not overwritten with empty array if existing had attachments
        const incomingAttachments =
          Array.isArray(attachments) && attachments.length > 0
            ? attachments
            : current.attachments && current.attachments.length > 0
            ? current.attachments
            : Array.isArray(attachments)
            ? attachments
            : [];

        records[existingIndex] = {
          ...current,
          reviewStatus: reviewStatus || current.reviewStatus,
          urgency: urgency || current.urgency,
          priorityLevel: priorityLevel || current.priorityLevel,
          picPurchasing: picPurchasing !== undefined ? picPurchasing : current.picPurchasing,
          reviewNotes: reviewNotes !== undefined ? reviewNotes : current.reviewNotes,
          items: Array.isArray(items) ? items : current.items,
          attachments: incomingAttachments,
          isReceivedLogistik: body.isReceivedLogistik !== undefined ? Boolean(body.isReceivedLogistik) : current.isReceivedLogistik,
          pchLogistik: body.pchLogistik !== undefined
            ? body.pchLogistik
            : (body.isReceivedLogistik ? 'Received_Logistic' : current.pchLogistik),
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
            attachments: ((efpb as any).attachments && (efpb as any).attachments.length > 0)
              ? (efpb as any).attachments
              : existing.attachments,
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
            attachments: (efpb as any).attachments || [],
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
          // Selalu update purpose dengan hasil ekstraksi PDF riil
          const extractedPurpose = (parseData.data.tujuanPeruntukan || '').trim();
          if (extractedPurpose && extractedPurpose !== '-') {
            records[targetIdx].purpose = extractedPurpose;
          } else if (extractedItems.length > 0) {
            const itemDescs = extractedItems
              .map((i: any) => (i.description || '').trim())
              .filter((d: string) => d && d !== '-' && d.length > 1);
            if (itemDescs.length > 0) {
              records[targetIdx].purpose = Array.from(new Set(itemDescs)).join(' • ');
            } else {
              records[targetIdx].purpose = extractedItems
                .map((i: any) => i.itemName)
                .slice(0, 3)
                .join(', ');
            }
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

      // Re-apply duplicate alerts with new real items & purpose
      records = enrichDuplicateAlerts(records);
      await saveReviews(records);

      const updatedRec = records.find((r) => r.fpbNo.toLowerCase() === fpbNo.toLowerCase());

      return NextResponse.json({
        success: true,
        message: `Berhasil mengekstrak ${extractedItems.length} item & peruntukan dari PDF: "${updatedRec?.purpose || ''}"`,
        items: extractedItems,
        purpose: updatedRec?.purpose || '',
        duplicateAlerts: updatedRec?.duplicateAlerts || [],
        priorityLevel: updatedRec?.priorityLevel,
        urgency: updatedRec?.urgency,
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

    // ----------------------------------------------------
    // Action 5: Fetch / Verify Attachments from e-FPB
    // ----------------------------------------------------
    if (action === 'sync_single_efpb_attachments') {
      const { fpbNo } = body;
      const targetIdx = records.findIndex((r) => r.fpbNo.toLowerCase() === (fpbNo || '').toLowerCase());
      if (targetIdx === -1) {
        return NextResponse.json({ success: false, message: 'FPB tidak ditemukan.' }, { status: 404 });
      }

      let currentAttachments: FpbAttachment[] = records[targetIdx].attachments || [];
      const normKey = (fpbNo || '').toLowerCase();

      if (currentAttachments.length === 0) {
        // Check local reviews file
        try {
          if (fs.existsSync(LOCAL_REVIEWS_PATH)) {
            const raw = fs.readFileSync(LOCAL_REVIEWS_PATH, 'utf-8');
            const parsed = JSON.parse(raw);
            const loc = parsed.find((x: any) => x.fpbNo.toLowerCase() === normKey);
            if (loc?.attachments && loc.attachments.length > 0) {
              const cleaned = loc.attachments.filter((a: FpbAttachment) => !a.url?.includes('unsplash.com'));
              if (cleaned.length > 0) {
                currentAttachments = cleaned;
                records[targetIdx].attachments = cleaned;
                await saveReviews(records);
              }
            }
          }
        } catch {}
      }

      return NextResponse.json({
        success: true,
        message: currentAttachments.length > 0
          ? `Berhasil memuat ${currentAttachments.length} berkas lampiran & foto fisik dari e-FPB!`
          : 'Belum ada lampiran terpisah yang terunggah di e-FPB untuk dokumen ini.',
        attachments: currentAttachments,
      });
    }

    // ----------------------------------------------------
    // Action 5b: Verifikasi Pengesahan Dokumen di Real Server e-FPB
    // ----------------------------------------------------
    if (action === 'verify_efpb' || action === 'check_efpb_status') {
      const { fpbNo } = body;
      const targetIdx = records.findIndex((r) => r.fpbNo.toLowerCase() === (fpbNo || '').toLowerCase());
      if (targetIdx === -1) {
        return NextResponse.json({ success: false, message: 'FPB tidak ditemukan.' }, { status: 404 });
      }

      const cleanFpb = records[targetIdx].fpbNo;
      const signedUrl = `https://e-fpb.cindaragroup.com/files/logistik_Approved_rev_sign_${encodeURIComponent(cleanFpb)}.pdf`;

      try {
        const headRes = await fetch(signedUrl, { method: 'HEAD', cache: 'no-store' });
        if (headRes.ok) {
          records[targetIdx] = {
            ...records[targetIdx],
            isReceivedLogistik: true,
            pchLogistik: 'Received_Logistic',
            pdfUrl: signedUrl,
            updatedAt: new Date().toISOString(),
          };
          await saveReviews(records);

          return NextResponse.json({
            success: true,
            isSignedOnEfpb: true,
            message: `Dokumen ${cleanFpb} telah sah ditandatangani di e-FPB dan siap untuk pengadaan!`,
            record: records[targetIdx],
          });
        } else {
          // Dokumen belum ditekan Received_Logistic di e-FPB
          return NextResponse.json({
            success: false,
            isSignedOnEfpb: false,
            message: `Tombol Received_Logistic untuk ${cleanFpb} belum ditekan di e-FPB. Silakan klik tombol 'Sahkan di e-FPB' terlebih dahulu.`,
            record: records[targetIdx],
          });
        }
      } catch (err: any) {
        return NextResponse.json({
          success: false,
          isSignedOnEfpb: false,
          message: `Gagal memeriksa status e-FPB: ${err.message}`,
          record: records[targetIdx],
        });
      }
    }

    // ----------------------------------------------------
    // Action 6: Direct Logistics Approval (Received_Logistic)
    // ----------------------------------------------------
    if (action === 'approve_logistic' || action === 'toggle_logistic') {
      const { fpbNo, isReceived, approvedBy, sessionId } = body;
      const targetIdx = records.findIndex((r) => r.fpbNo.toLowerCase() === (fpbNo || '').toLowerCase());
      if (targetIdx === -1) {
        return NextResponse.json({ success: false, message: 'FPB tidak ditemukan.' }, { status: 404 });
      }

      const currentRec = records[targetIdx];
      const newStatus = isReceived !== undefined ? Boolean(isReceived) : !currentRec.isReceivedLogistik;
      const nowIso = new Date().toISOString();
      const cleanFpb = currentRec.fpbNo;
      const effectiveSigner = approvedBy || currentRec.reviewedBy || 'NOOR HASANAH';

      let activePdfUrl = `/api/review-fpb/pdf?fpbNo=${encodeURIComponent(cleanFpb)}&type=raw`;
      let efpbTriggerResult: any = null;

      if (newStatus) {
        activePdfUrl = `/api/review-fpb/pdf?fpbNo=${encodeURIComponent(cleanFpb)}&type=signed`;

        // 1. Trigger aksi tombol Received_Logistic otomatis ke server e-FPB
        try {
          efpbTriggerResult = await triggerEfpbReceivedLogistic({
            fpbNo: cleanFpb,
            sessionId,
            signerName: effectiveSigner,
          });
        } catch (efpbErr) {
          console.warn(`[review-fpb] Gagal trigger aksi Received_Logistic ke e-FPB untuk ${cleanFpb}:`, efpbErr);
        }

        // 2. Generate stamped PDF dan simpan ke Cloudflare R2
        try {
          const rawUrl = `https://e-fpb.cindaragroup.com/files/Approved_rev_sign_${encodeURIComponent(cleanFpb)}.pdf`;
          const baseRes = await fetch(rawUrl, { cache: 'no-store' });
          if (baseRes.ok) {
            const baseBuf = Buffer.from(await baseRes.arrayBuffer());
            const stampedBuf = await stampFpbPdf({
              pdfBuffer: baseBuf,
              signerName: effectiveSigner,
              signDate: formatToStampDate(nowIso),
              receivedAt: formatToStampTimestamp(nowIso),
            });
            if (isR2Configured()) {
              await uploadToR2({ key: `fpb-signed/${cleanFpb}.pdf`, body: stampedBuf, contentType: 'application/pdf' });
            }
          }
        } catch (stampErr) {
          console.warn(`[review-fpb] Gagal pre-stamping PDF untuk ${cleanFpb}:`, stampErr);
        }
      }

      records[targetIdx] = {
        ...currentRec,
        isReceivedLogistik: newStatus,
        pchLogistik: newStatus ? 'Received_Logistic' : '-',
        pdfUrl: activePdfUrl,
        reviewedBy: effectiveSigner,
        reviewedAt: nowIso,
        updatedAt: nowIso,
      };

      await saveReviews(records);

      const triggerMsg = efpbTriggerResult?.triggeredOnEfpb
        ? ' Aksi tombol Received_Logistic di e-FPB berhasil ditekan otomatis.'
        : '';

      return NextResponse.json({
        success: true,
        message: newStatus
          ? `Dokumen ${currentRec.fpbNo} berhasil disetujui & ditandatangani oleh ${effectiveSigner}.${triggerMsg} Status sah Siap Pengadaan!`
          : `Persetujuan pengadaan untuk ${currentRec.fpbNo} dibatalkan.`,
        record: records[targetIdx],
        efpbTriggerResult,
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

