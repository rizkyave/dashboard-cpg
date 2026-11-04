import fs from 'fs';
import path from 'path';
import * as XLSX from 'xlsx';
import docRelationRef from '@/data/doc-relation-reference.json';
import { SisaLayananItem } from '@/types/sisaLayanan';
import { parseSisaLayananWorkbook } from '@/utils/sisaLayananParser';
import { isR2Configured, getObjectFromR2 } from '@/utils/r2Client';

export interface StockTaliLookupResult {
  found: boolean;
  source: 'sisa_layanan' | 'doc_relation' | 'none';
  data?: {
    ttb: string;
    cleanTtb: string;
    fullTtb: string;
    noFpb: string;
    fullFpb: string;
    pt: string;
    deptArmada: string;
    namaBarang?: string;
    keterangan?: string;
    satuan?: string;
    status?: string;
    po?: string;
    fstb?: string;
  };
  candidates?: Array<{
    ttb: string;
    cleanTtb: string;
    noFpb: string;
    fullFpb: string;
    pt: string;
    deptArmada: string;
    namaBarang?: string;
    keterangan?: string;
    status?: string;
  }>;
}

interface RawRelationEntry {
  fpb?: string;
  po?: string;
  fstb?: string;
  ttb?: string;
  armada?: string;
}

interface RawFpbEntry {
  fstbs?: string[];
  ttbs?: string[];
  pos?: string[];
  armada?: string;
}

interface DocRelationDb {
  byTtb: Record<string, RawRelationEntry>;
  byFstb: Record<string, RawRelationEntry>;
  byFpb: Record<string, RawFpbEntry>;
}

const db = docRelationRef as unknown as DocRelationDb;

const R2_SISA_LAYANAN_KEY = 'dashboard-metadata/sisa-layanan.json';
let cachedSisaItems: SisaLayananItem[] | null = null;

// Ekstraksi 6 digit nomor FPB standar sheet (contoh: CPL-FPB-26-0003374 -> 003374)
export function cleanFpbDigits(fpb?: string): string {
  if (!fpb) return '';
  const digits = fpb.replace(/\D/g, '');
  if (digits.length >= 6) {
    return digits.slice(-6);
  }
  return digits.padStart(6, '0');
}

// Ekstraksi nomor TTB bersih (5 digit suffix atau nomor utuh)
export function cleanTtbDigits(ttb?: string): string {
  if (!ttb) return '';
  const trimmed = ttb.trim().toUpperCase();
  const digits = trimmed.replace(/\D/g, '');
  if (digits.length >= 5) {
    return digits.slice(-5);
  }
  return digits || trimmed;
}

// Ekstraksi entitas PT dari nomor dokumen atau departemen
export function extractPtEntity(docNum?: string, defaultPt = 'CPL'): string {
  if (!docNum) return defaultPt;
  const match = docNum.trim().toUpperCase().match(/^([A-Z]{2,6})[-_\s]/);
  if (match) {
    const p = match[1];
    if (['CPL', 'HL', 'MIL', 'GAJ', 'MO'].includes(p)) return p;
    if (p === 'SP') return 'CPL';
  }
  return defaultPt;
}

// Load Sisa Layanan items dari memori, R2, atau file Excel lokal
export async function getSisaLayananItems(): Promise<SisaLayananItem[]> {
  if (cachedSisaItems && cachedSisaItems.length > 0) {
    return cachedSisaItems;
  }

  // 1. Coba baca dari R2
  if (isR2Configured()) {
    try {
      const obj = await getObjectFromR2(R2_SISA_LAYANAN_KEY);
      if (obj && obj.body) {
        const text = Buffer.from(obj.body).toString('utf8');
        const parsed = JSON.parse(text);
        if (Array.isArray(parsed?.items) && parsed.items.length > 0) {
          cachedSisaItems = parsed.items;
          return parsed.items;
        }
      }
    } catch (err) {
      console.warn('Gagal memuat sisa layanan dari R2 di stockTaliLookup:', err);
    }
  }

  // 2. Coba baca dari file Excel lokal
  const candidatePaths = [
    path.join(process.cwd(), 'Laporan_Sisa_Layanan_Gabungan.xlsx'),
    path.join(process.cwd(), '..', 'Laporan_Sisa_Layanan_Gabungan.xlsx'),
  ];

  for (const filePath of candidatePaths) {
    if (fs.existsSync(filePath)) {
      try {
        const buffer = fs.readFileSync(filePath);
        const workbook = XLSX.read(buffer, { type: 'buffer' });
        const result = parseSisaLayananWorkbook(workbook);
        if (result.items.length > 0) {
          cachedSisaItems = result.items;
          return result.items;
        }
      } catch (err) {
        console.warn('Gagal membaca file Excel lokal di stockTaliLookup:', err);
      }
    }
  }

  return [];
}

/**
 * Mencari referensi data mutasi stok tali berdasarkan No. TTB atau No. FPB
 */
export async function lookupStockTaliReference(
  query: string,
  ptFilter?: string
): Promise<StockTaliLookupResult> {
  const rawQ = (query || '').trim();
  if (!rawQ || rawQ.length < 3) {
    return { found: false, source: 'none' };
  }

  const qUpper = rawQ.toUpperCase().replace(/\s+/g, '');
  const qDigits = qUpper.replace(/\D/g, '');
  const targetPt = ptFilter && ptFilter !== 'ALL' ? ptFilter.toUpperCase() : extractPtEntity(rawQ, '');

  const sisaItems = await getSisaLayananItems();

  // =========================================================================
  // 1. PENCARIAN DI SISA LAYANAN (Sumber Utama yang paling lengkap dengan nama barang)
  // =========================================================================
  const sisaMatches: SisaLayananItem[] = [];

  for (const item of sisaItems) {
    if (targetPt && item.pt && item.pt.toUpperCase() !== targetPt) {
      continue;
    }

    const ttb = (item.noTtb || '').toUpperCase().trim();
    const ttbDigits = ttb.replace(/\D/g, '');
    const fpb = (item.noFpb || '').toUpperCase().trim();
    const fpbDigits = fpb.replace(/\D/g, '');

    // Cek kecocokan TTB
    const ttbMatch =
      ttb === qUpper ||
      (qDigits.length >= 4 && (ttbDigits === qDigits || ttbDigits.endsWith(qDigits)));

    // Cek kecocokan FPB
    const fpbMatch =
      fpb === qUpper ||
      (qDigits.length >= 4 && (fpbDigits === qDigits || fpbDigits.endsWith(qDigits)));

    if (ttbMatch || fpbMatch) {
      sisaMatches.push(item);
      if (sisaMatches.length >= 10) break;
    }
  }

  if (sisaMatches.length > 0) {
    const best = sisaMatches[0];
    const fullFpb = best.noFpb || '';
    const cleanFpb = cleanFpbDigits(fullFpb);
    const fullTtb = best.noTtb || '';
    const cleanTtb = cleanTtbDigits(fullTtb);
    const pt = best.pt || (targetPt || 'CPL');
    const deptArmada = best.departement || '';
    const namaBarang = best.namaBarang || '';
    const keterangan = best.keterangan || (namaBarang ? `STOCK GAJ TALI / ${namaBarang}` : 'STOCK GAJ TALI');

    const candidates = sisaMatches.slice(0, 8).map((m) => ({
      ttb: m.noTtb || '',
      cleanTtb: cleanTtbDigits(m.noTtb),
      noFpb: cleanFpbDigits(m.noFpb),
      fullFpb: m.noFpb || '',
      pt: m.pt || pt,
      deptArmada: m.departement || '',
      namaBarang: m.namaBarang || '',
      keterangan: m.keterangan || '',
      status: m.status || '',
    }));

    return {
      found: true,
      source: 'sisa_layanan',
      data: {
        ttb: cleanTtb || fullTtb,
        cleanTtb,
        fullTtb,
        noFpb: cleanFpb,
        fullFpb,
        pt,
        deptArmada,
        namaBarang,
        keterangan,
        satuan: best.satuan || '',
        status: best.status || '',
        po: best.noPo || '',
        fstb: best.noFstb || '',
      },
      candidates: candidates.length > 1 ? candidates : undefined,
    };
  }

  // =========================================================================
  // 2. PENCARIAN DI DOC-RELATION-REFERENCE (9,500+ relasi dokumen CPG)
  // =========================================================================
  // Coba exact match di byTtb
  let relEntry: RawRelationEntry | undefined = db.byTtb[qUpper];

  if (!relEntry && qDigits.length >= 4) {
    // Coba match dengan prefix 26
    if (db.byTtb[`26${qDigits}`]) {
      relEntry = db.byTtb[`26${qDigits}`];
    } else {
      // Loop cari key yang berakhiran digit yang sama dan ber-prefix cocok
      for (const k of Object.keys(db.byTtb)) {
        if (targetPt && !k.startsWith(targetPt) && !k.startsWith('26')) continue;
        const kDigits = k.replace(/\D/g, '');
        if (kDigits === qDigits || (qDigits.length >= 5 && kDigits.endsWith(qDigits))) {
          relEntry = db.byTtb[k];
          break;
        }
      }
    }
  }

  // Jika tidak ditemukan di byTtb, coba cari di byFpb (apabila user memasukkan No FPB)
  if (!relEntry) {
    let fpbEntry: RawFpbEntry | undefined = db.byFpb[qUpper];
    if (!fpbEntry && qDigits.length >= 4) {
      for (const k of Object.keys(db.byFpb)) {
        if (targetPt && !k.startsWith(targetPt)) continue;
        const kDigits = k.replace(/\D/g, '');
        if (kDigits === qDigits || (qDigits.length >= 5 && kDigits.endsWith(qDigits))) {
          fpbEntry = db.byFpb[k];
          break;
        }
      }
    }

    if (fpbEntry) {
      const primaryTtb = fpbEntry.ttbs && fpbEntry.ttbs.length > 0 ? fpbEntry.ttbs[0] : '';
      const primaryFstb = fpbEntry.fstbs && fpbEntry.fstbs.length > 0 ? fpbEntry.fstbs[0] : '';
      const primaryPo = fpbEntry.pos && fpbEntry.pos.length > 0 ? fpbEntry.pos[0] : '';
      const fullFpb = qUpper.includes('FPB') ? qUpper : (fpbEntry ? Object.keys(db.byFpb).find(k => db.byFpb[k] === fpbEntry) || '' : '');
      const cleanFpb = cleanFpbDigits(fullFpb || qDigits);
      const pt = extractPtEntity(fullFpb || primaryTtb, targetPt || 'CPL');

      return {
        found: true,
        source: 'doc_relation',
        data: {
          ttb: cleanTtbDigits(primaryTtb) || primaryTtb,
          cleanTtb: cleanTtbDigits(primaryTtb),
          fullTtb: primaryTtb,
          noFpb: cleanFpb,
          fullFpb,
          pt,
          deptArmada: fpbEntry.armada || '',
          keterangan: 'STOCK GAJ TALI',
          po: primaryPo,
          fstb: primaryFstb,
        },
      };
    }
  }

  if (relEntry) {
    const fullFpb = relEntry.fpb || '';
    const cleanFpb = cleanFpbDigits(fullFpb);
    const fullTtb = relEntry.ttb || qUpper;
    const cleanTtb = cleanTtbDigits(fullTtb || qDigits);
    const pt = extractPtEntity(fullTtb || fullFpb, targetPt || 'CPL');
    const deptArmada = relEntry.armada || '';

    return {
      found: true,
      source: 'doc_relation',
      data: {
        ttb: cleanTtb || fullTtb,
        cleanTtb,
        fullTtb,
        noFpb: cleanFpb,
        fullFpb,
        pt,
        deptArmada,
        keterangan: 'STOCK GAJ TALI',
        po: relEntry.po || '',
        fstb: relEntry.fstb || '',
      },
    };
  }

  return { found: false, source: 'none' };
}

/**
 * Pencarian interaktif untuk modal 'Ambil dari Sisa Layanan'
 */
export async function searchSisaLayananForPicker(
  query: string,
  ptFilter?: string,
  limit = 25
): Promise<{
  totalMatches: number;
  items: Array<{
    id: string;
    noFpb: string;
    cleanFpb: string;
    noTtb: string;
    cleanTtb: string;
    pt: string;
    departement: string;
    namaBarang: string;
    keterangan: string;
    satuan: string;
    status: string;
    jmlTtb: number;
    kategori: string;
    tglTtb?: string;
  }>;
}> {
  const allItems = await getSisaLayananItems();
  const q = (query || '').trim().toLowerCase();
  const targetPt = ptFilter && ptFilter !== 'ALL' ? ptFilter.toUpperCase() : '';

  const matched: SisaLayananItem[] = [];

  for (const it of allItems) {
    if (targetPt && it.pt && it.pt.toUpperCase() !== targetPt) {
      continue;
    }

    if (!q) {
      // Jika query kosong, ambil item terbaru / yang memiliki TTB
      if (it.noTtb) {
        matched.push(it);
        if (matched.length >= limit) break;
      }
      continue;
    }

    const matchText = `${it.noFpb || ''} ${it.noTtb || ''} ${it.noPo || ''} ${it.namaBarang || ''} ${it.departement || ''} ${it.keterangan || ''} ${it.kodeBarang || ''}`.toLowerCase();

    if (matchText.includes(q)) {
      matched.push(it);
      if (matched.length >= limit) break;
    }
  }

  const items = matched.map((it) => ({
    id: it.id,
    noFpb: it.noFpb || '',
    cleanFpb: cleanFpbDigits(it.noFpb),
    noTtb: it.noTtb || '',
    cleanTtb: cleanTtbDigits(it.noTtb),
    pt: it.pt || 'CPL',
    departement: it.departement || '',
    namaBarang: it.namaBarang || '',
    keterangan: it.keterangan || '',
    satuan: it.satuan || '',
    status: it.status || 'CLOSE',
    jmlTtb: it.jmlTtb || 0,
    kategori: it.kategori || 'General',
    tglTtb: it.tglTtb || '',
  }));

  return {
    totalMatches: items.length,
    items,
  };
}
