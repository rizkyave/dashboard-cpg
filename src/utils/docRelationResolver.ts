import docRelationRef from '@/data/doc-relation-reference.json';

export interface DocRelationInfo {
  fpbNumber?: string;
  poNumber?: string;
  armada?: string;
  relatedFstbs: string[];
  relatedTtbs: string[];
  relatedPos: string[];
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

interface DocRelationDatabase {
  byTtb: Record<string, RawRelationEntry>;
  byFstb: Record<string, RawRelationEntry>;
  byFpb: Record<string, RawFpbEntry>;
}

const db = docRelationRef as unknown as DocRelationDatabase;

/**
 * Ekstraksi prefix entitas perusahaan dari nomor dokumen (misal: "GAJ", "HL", "CPL", "MO", "SP", "MIL", "SSK")
 */
export function extractDocPrefix(docNum?: string): string | null {
  if (!docNum) return null;
  const match = docNum.trim().toUpperCase().match(/^([A-Z]{2,6})[-_\s]/);
  return match ? match[1] : null;
}

/**
 * Pengecekan kompatibilitas prefix dua entitas perusahaan.
 * Jika salah satu tidak memiliki prefix (misal nomor polos tanpa prefix "26-01245"), dianggap kompatibel.
 * Jika KEDUA pihak memiliki prefix perusahaan dan nilainya berbeda (misal GAJ vs HL), MUTLAK TIDAK KOMPATIBEL!
 */
export function arePrefixesCompatible(prefixA?: string | null, prefixB?: string | null): boolean {
  if (!prefixA || !prefixB) return true;
  return prefixA.toUpperCase() === prefixB.toUpperCase();
}

/**
 * Normalisasi nomor dokumen untuk pencarian index
 */
function cleanDocKey(docNum: string): { full: string; digits: string } {
  const full = (docNum || '').toUpperCase().trim().replace(/\s+/g, '');
  const digits = full.replace(/\D/g, '');
  return { full, digits };
}

/**
 * Mencari relasi lengkap dokumen berdasarkan nomor dokumen atau No. FPB dengan validasi ketat prefix entitas perusahaan.
 */
export function resolveDocRelation(
  docType: 'FSTB' | 'TTB',
  docNumber: string,
  existingFpb?: string,
  existingPo?: string
): DocRelationInfo {
  const { full, digits } = cleanDocKey(docNumber);
  const byMap = docType === 'FSTB' ? db.byFstb : db.byTtb;

  const docPrefix = extractDocPrefix(docNumber);
  const fpbPrefix = extractDocPrefix(existingFpb);
  const poPrefix = extractDocPrefix(existingPo);
  const targetPrefix = docPrefix || fpbPrefix || poPrefix || null;

  // Helper filter prefix agar dokumen antar entitas (misal GAJ vs HL) tidak pernah tercampur
  const isPrefixAllowed = (doc?: string) => {
    if (!doc || !targetPrefix) return true;
    const p = extractDocPrefix(doc);
    return !p || p === targetPrefix;
  };

  let foundEntry: RawRelationEntry | undefined;

  // 1. Coba pencarian exact key
  if (byMap[full]) {
    const candidate = byMap[full];
    const candidatePrefix =
      extractDocPrefix(candidate.ttb) ||
      extractDocPrefix(candidate.fstb) ||
      extractDocPrefix(candidate.fpb) ||
      extractDocPrefix(candidate.po);
    if (arePrefixesCompatible(targetPrefix, candidatePrefix)) {
      foundEntry = candidate;
    }
  }

  // 2. Jika belum ditemukan dan memiliki targetPrefix & digits >= 4,
  // cari entitas dalam byMap yang ber-prefix SAMA dan memiliki digit yang cocok
  if (!foundEntry && targetPrefix && digits && digits.length >= 4) {
    const matchingKey = Object.keys(byMap).find((k) => {
      const kPrefix = extractDocPrefix(k);
      if (kPrefix !== targetPrefix) return false;
      const kDigits = k.replace(/\D/g, '');
      return kDigits === digits || kDigits.endsWith(digits);
    });
    if (matchingKey) {
      foundEntry = byMap[matchingKey];
    }
  }

  // 3. Fallback pencarian digit HANYA jika targetPrefix TIDAK ADA (dokumen tidak ber-prefix perusahaan)
  if (!foundEntry && !targetPrefix && digits && digits.length >= 4) {
    foundEntry = byMap[digits];
  }

  // Tentukan FPB, PO, dan Armada
  let fpbNumber = existingFpb || '';
  if (!fpbNumber && foundEntry?.fpb && isPrefixAllowed(foundEntry.fpb)) {
    fpbNumber = foundEntry.fpb;
  }

  let poNumber = existingPo || '';
  if (!poNumber && foundEntry?.po && isPrefixAllowed(foundEntry.po)) {
    poNumber = foundEntry.po;
  }

  let armada = foundEntry?.armada || '';

  const relatedFstbs: string[] = [];
  const relatedTtbs: string[] = [];
  const relatedPos: string[] = [];

  // Jika FPB ditemukan, cari rantai seluruh dokumen terkait pada byFpb
  if (fpbNumber) {
    const fpbKey = fpbNumber.toUpperCase().trim();
    const fpbDigits = fpbKey.replace(/\D/g, '');
    const currentFpbPrefix = extractDocPrefix(fpbKey) || targetPrefix;

    let fpbEntry = db.byFpb[fpbKey];
    if (!fpbEntry && fpbDigits && fpbDigits.length >= 4) {
      const matchedFpbKey = Object.keys(db.byFpb).find((k) => {
        const kPrefix = extractDocPrefix(k);
        if (!arePrefixesCompatible(currentFpbPrefix, kPrefix)) return false;
        return k.replace(/\D/g, '') === fpbDigits;
      });
      if (matchedFpbKey) {
        fpbEntry = db.byFpb[matchedFpbKey];
      }
    }

    if (fpbEntry) {
      if (fpbEntry.fstbs) relatedFstbs.push(...fpbEntry.fstbs.filter(isPrefixAllowed));
      if (fpbEntry.ttbs) relatedTtbs.push(...fpbEntry.ttbs.filter(isPrefixAllowed));
      if (fpbEntry.pos) relatedPos.push(...fpbEntry.pos.filter(isPrefixAllowed));
      if (!armada && fpbEntry.armada) armada = fpbEntry.armada;
      // Jika PO masih kosong, ambil dari PO relasi FPB yang sah ber-prefix sama
      if (!poNumber && fpbEntry.pos && fpbEntry.pos.length > 0) {
        const validFpbPo = fpbEntry.pos.find(isPrefixAllowed);
        if (validFpbPo) poNumber = validFpbPo;
      }
    }
  }

  // Tambahkan referensi langsung dari foundEntry jika prefix sesuai
  if (foundEntry?.fstb && isPrefixAllowed(foundEntry.fstb) && !relatedFstbs.includes(foundEntry.fstb)) {
    relatedFstbs.push(foundEntry.fstb);
  }
  if (foundEntry?.ttb && isPrefixAllowed(foundEntry.ttb) && !relatedTtbs.includes(foundEntry.ttb)) {
    relatedTtbs.push(foundEntry.ttb);
  }
  if (foundEntry?.po && isPrefixAllowed(foundEntry.po) && !relatedPos.includes(foundEntry.po)) {
    relatedPos.push(foundEntry.po);
  }

  return {
    fpbNumber: fpbNumber || undefined,
    poNumber: poNumber || undefined,
    armada: armada || undefined,
    relatedFstbs: Array.from(new Set(relatedFstbs.filter(Boolean))),
    relatedTtbs: Array.from(new Set(relatedTtbs.filter(Boolean))),
    relatedPos: Array.from(new Set(relatedPos.filter(Boolean))),
  };
}

/**
 * Mencari seluruh dokumen yang berelasi dengan No. FPB tertentu
 */
export function findDocumentsByFpb(fpbQuery: string): {
  fpbNumber: string;
  fstbs: string[];
  ttbs: string[];
  pos: string[];
  armada?: string;
} | null {
  if (!fpbQuery) return null;
  const q = fpbQuery.toUpperCase().trim();
  const digits = q.replace(/\D/g, '');
  const queryPrefix = extractDocPrefix(q);

  let matchedFpbKey = Object.keys(db.byFpb).find((k) => {
    if (k === q) return true;
    if (queryPrefix) {
      const kPrefix = extractDocPrefix(k);
      if (kPrefix !== queryPrefix) return false;
    }
    return k.includes(q);
  });

  if (!matchedFpbKey && digits && digits.length >= 4) {
    matchedFpbKey = Object.keys(db.byFpb).find((k) => {
      if (queryPrefix) {
        const kPrefix = extractDocPrefix(k);
        if (kPrefix !== queryPrefix) return false;
      }
      return k.replace(/\D/g, '').includes(digits);
    });
  }

  if (!matchedFpbKey) return null;
  const entry = db.byFpb[matchedFpbKey];
  return {
    fpbNumber: matchedFpbKey,
    fstbs: entry?.fstbs || [],
    ttbs: entry?.ttbs || [],
    pos: entry?.pos || [],
    armada: entry?.armada,
  };
}

