/**
 * Mesin Deteksi Cerdas Armada & Metadata FPB (Form Permintaan Barang)
 * 
 * Menggabungkan 4 Lapisan Deteksi Otomatis:
 * Layer 1: PDF Stream Token & Block Matcher (mencari label 'USER :', 'Armada :', 'Unit :', dll)
 * Layer 2: Verified Sheet Check Database (19.346 rekor FPB terverifikasi dari check-fpb-data.json)
 * Layer 3: Relational Reference Database (4.002 rekor FPB dari doc-relation-reference.json)
 * Layer 4: Master Armada Fleet Matcher (526 armada resmi CPG dari MASTER_ARMADA_LIST)
 */

import fs from 'fs';
import path from 'path';
import docRelationRef from '@/data/doc-relation-reference.json';
import { MASTER_ARMADA_LIST } from './fstbDetector';

export { MASTER_ARMADA_LIST };

interface CheckFpbRecord {
  fpb?: string;
  tglFpb?: string;
  armada?: string;
  tglCek?: string;
  statusCek?: string;
  done?: string;
  note?: string;
  checker?: string;
}

let checkFpbRecordsCache: Record<string, CheckFpbRecord> | null = null;

function getCheckFpbRecords(): Record<string, CheckFpbRecord> | null {
  if (checkFpbRecordsCache) return checkFpbRecordsCache;
  try {
    const filePath = path.join(process.cwd(), 'src', 'data', 'check-fpb-data.json');
    if (fs.existsSync(filePath)) {
      const raw = fs.readFileSync(filePath, 'utf-8');
      const parsed = JSON.parse(raw);
      checkFpbRecordsCache = parsed.records || null;
    }
  } catch {
    // Fallback gracefully jika file tidak terbaca
    checkFpbRecordsCache = null;
  }
  return checkFpbRecordsCache;
}

const rawDocRef = docRelationRef as unknown as {
  byFpb?: Record<string, { armada?: string; fstbs?: string[]; ttbs?: string[]; pos?: string[] }>;
};

/**
 * Normalisasi No. FPB menjadi variasi slug untuk lookup cepat O(1)
 */
function generateFpbLookupKeys(fpbNo: string): string[] {
  if (!fpbNo) return [];
  const raw = fpbNo.trim();
  const clean = raw.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
  const keys = new Set<string>();

  if (raw) keys.add(raw);
  if (clean) keys.add(clean);

  // Pattern misal CPL-FPB-26-0002034 atau CPL/FPB/26/0002034 atau CPL-0002034
  const match = raw.match(/^([A-Za-z]{2,6})[-_/\s]?(?:FPB[-_/\s]?)?(?:\d{2}[-_/\s]?)?(\d+)$/i);
  if (match) {
    const prefix = match[1].toUpperCase();
    const num = match[2];
    keys.add(`${prefix}_${num.padStart(7, '0')}`);
    keys.add(`${prefix}_${num.padStart(6, '0')}`);
    keys.add(`${prefix}_${parseInt(num, 10)}`);
    keys.add(`${prefix}FPB${num.padStart(7, '0')}`);
  }

  return Array.from(keys);
}

/**
 * Mencari nama armada kapal resmi berdasarkan nomor FPB dari database verifikasi (19.346 rekor)
 * dan database relasi (4.002 rekor).
 */
export function lookupFpbArmada(fpbNo: string): string | null {
  if (!fpbNo) return null;
  const keys = generateFpbLookupKeys(fpbNo);

  // 1. Prioritas Utama: check-fpb-data.json (19.346 rekor tervalidasi)
  const checkRecords = getCheckFpbRecords();
  if (checkRecords) {
    for (const k of keys) {
      const rec = checkRecords[k];
      if (rec?.armada && rec.armada.trim() && rec.armada.trim().toUpperCase() !== 'ARMADA KAPAL') {
        return rec.armada.trim().toUpperCase();
      }
    }
  }

  // 2. Prioritas Kedua: doc-relation-reference.json (byFpb)
  if (rawDocRef?.byFpb) {
    for (const k of keys) {
      const rec = rawDocRef.byFpb[k];
      if (rec?.armada && rec.armada.trim() && rec.armada.trim().toUpperCase() !== 'ARMADA KAPAL') {
        return rec.armada.trim().toUpperCase();
      }
    }

    // Cek kecocokan digit angka jika format berbeda
    const digits = fpbNo.replace(/\D/g, '');
    if (digits.length >= 4) {
      for (const [refKey, refVal] of Object.entries(rawDocRef.byFpb)) {
        if (refVal?.armada && refKey.replace(/\D/g, '').includes(digits)) {
          if (refVal.armada.trim().toUpperCase() !== 'ARMADA KAPAL') {
            return refVal.armada.trim().toUpperCase();
          }
        }
      }
    }
  }

  return null;
}

/**
 * Mencocokkan teks atau blok PDF dengan 526 armada resmi CPG
 */
export function matchArmadaFromText(text: string): string | null {
  if (!text) return null;
  const upper = text.toUpperCase();

  // Cek prefix maritim khas CPG
  for (const armada of MASTER_ARMADA_LIST) {
    if (armada.length < 3) continue;
    // Hindari false-positive pada kata umum pendek
    if (['CPL', 'SP', 'GAJ', 'HL', 'MIL', 'MO'].includes(armada)) continue;

    // Boundary check agar tidak parsial (misal 'CPL 250' tidak tertukar)
    const regex = new RegExp(`(^|[^A-Z0-9])${armada.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^A-Z0-9]|$)`, 'i');
    if (regex.test(upper)) {
      return armada;
    }
  }

  return null;
}

/**
 * Deteksi armada lengkap dari kumpulan blok teks PDF FPB
 */
export function detectArmadaFromPdfBlocks(blocks: { text: string }[]): string | null {
  if (!blocks || blocks.length === 0) return null;

  // 1. Ekstraksi langsung dari label USER / ARMADA / UNIT
  for (let i = 0; i < blocks.length; i++) {
    const t = blocks[i].text.trim();

    // Pola USER : [ARMADA]
    const userMatch = t.match(/^(?:USER|ARMADA|UNIT|KEPADA)\s*[:=]\s*(.+)$/i);
    if (userMatch && userMatch[1]) {
      const val = userMatch[1].trim().toUpperCase();
      if (val && val !== 'ARMADA KAPAL' && val !== 'END USER' && val.length > 2) {
        return val;
      }
    }

    // Label terpisah satu blok dengan value-nya
    if (/^(?:USER|ARMADA|UNIT|KEPADA)\s*[:=]?$/i.test(t)) {
      if (i + 1 < blocks.length) {
        const nextVal = blocks[i + 1].text.trim().toUpperCase();
        if (nextVal && nextVal !== 'ARMADA KAPAL' && nextVal !== 'END USER' && nextVal.length > 2) {
          return nextVal;
        }
      }
    }
  }

  // 2. Pencocokan langsung dengan MASTER_ARMADA_LIST pada blok-blok header (50 blok pertama)
  const headerSlice = blocks.slice(0, 50);
  for (const b of headerSlice) {
    const matched = matchArmadaFromText(b.text);
    if (matched) return matched;
  }

  return null;
}
