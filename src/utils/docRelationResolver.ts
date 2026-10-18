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
 * Normalisasi nomor dokumen untuk pencarian index
 */
function cleanDocKey(docNum: string): { full: string; digits: string } {
  const full = (docNum || '').toUpperCase().trim().replace(/\s+/g, '');
  const digits = full.replace(/\D/g, '');
  return { full, digits };
}

/**
 * Mencari relasi lengkap dokumen berdasarkan nomor dokumen atau No. FPB
 */
export function resolveDocRelation(
  docType: 'FSTB' | 'TTB',
  docNumber: string,
  existingFpb?: string,
  existingPo?: string
): DocRelationInfo {
  const { full, digits } = cleanDocKey(docNumber);
  const byMap = docType === 'FSTB' ? db.byFstb : db.byTtb;

  const foundEntry: RawRelationEntry | undefined =
    byMap[full] || (digits && digits.length >= 4 ? byMap[digits] : undefined);

  let fpbNumber = existingFpb || foundEntry?.fpb || '';
  let poNumber = existingPo || foundEntry?.po || '';
  let armada = foundEntry?.armada || '';

  // Jika FPB ditemukan, cari rantai seluruh dokumen terkait pada byFpb
  const relatedFstbs: string[] = [];
  const relatedTtbs: string[] = [];
  const relatedPos: string[] = [];

  if (fpbNumber) {
    const fpbKey = fpbNumber.toUpperCase().trim();
    const fpbDigits = fpbKey.replace(/\D/g, '');

    const fpbEntry =
      db.byFpb[fpbKey] ||
      (fpbDigits && fpbDigits.length >= 4
        ? Object.entries(db.byFpb).find(([k]) => k.replace(/\D/g, '') === fpbDigits)?.[1]
        : undefined);

    if (fpbEntry) {
      if (fpbEntry.fstbs) relatedFstbs.push(...fpbEntry.fstbs);
      if (fpbEntry.ttbs) relatedTtbs.push(...fpbEntry.ttbs);
      if (fpbEntry.pos) relatedPos.push(...fpbEntry.pos);
      if (!armada && fpbEntry.armada) armada = fpbEntry.armada;
    }
  }

  // Tambahkan referensi langsung dari entry jika belum ada
  if (foundEntry?.fstb && !relatedFstbs.includes(foundEntry.fstb)) {
    relatedFstbs.push(foundEntry.fstb);
  }
  if (foundEntry?.ttb && !relatedTtbs.includes(foundEntry.ttb)) {
    relatedTtbs.push(foundEntry.ttb);
  }
  if (foundEntry?.po && !relatedPos.includes(foundEntry.po)) {
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

  let matchedFpbKey = Object.keys(db.byFpb).find((k) => k === q || k.includes(q));

  if (!matchedFpbKey && digits && digits.length >= 4) {
    matchedFpbKey = Object.keys(db.byFpb).find((k) => k.replace(/\D/g, '').includes(digits));
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

