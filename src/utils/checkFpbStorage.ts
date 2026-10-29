import { CheckFpbRecord, BU_NOOR_SHEET_URL, MELINDA_SHEET_URL } from '@/types/checkFpbSync';

export function normalizeFpbKeyForCheck(raw?: string | null): string {
  if (!raw) return '';
  return String(raw).toUpperCase().replace(/[^A-Z0-9]/g, '');
}

export function extractCheckFpbCandidates(raw?: string | null, entity?: string | null): string[] {
  if (!raw) return [];
  const s = String(raw).trim();
  if (!s) return [];

  const candidates = new Set<string>();
  const norm = normalizeFpbKeyForCheck(s);
  if (norm) candidates.add(norm);

  const prefixMatch = s.match(/^([A-Z]{2,6})/i);
  const pt = (prefixMatch ? prefixMatch[1] : entity || '').toUpperCase();

  const digitsMatch = s.match(/(\d+)$/);
  if (digitsMatch) {
    const digits = digitsMatch[1];
    const trimmed = digits.replace(/^0+/, '');
    if (pt) {
      candidates.add(`${pt}_${digits}`);
      if (trimmed) candidates.add(`${pt}_${trimmed}`);
    }
    candidates.add(digits);
    if (trimmed) candidates.add(trimmed);
  }

  return Array.from(candidates);
}

/**
 * Mendapatkan fallback URL Google Sheet berdasarkan prefix dokumen FPB / nama penerima.
 * Bu Noor (gid: 76614569): GAJ, MO, SP, MIL, SS
 * Bu Melinda (gid: 1411569542): CPL, HL
 */
export function getDefaultCheckFpbUrl(docOrName?: string | null): {
  url: string;
  gid: '76614569' | '1411569542';
  checker: 'NOOR HASANAH' | 'MELINDA DWI PUTRI';
  label: 'Bu Noor' | 'Bu Melinda';
  sourceSheet: 'FBP CHECK BU NOOR' | 'FBP CHECK MELINDA';
} {
  const upper = (docOrName || '').toUpperCase();
  if (
    upper.includes('MELINDA') ||
    upper.startsWith('HL-') ||
    upper.startsWith('HL/') ||
    upper.startsWith('CPL-') ||
    upper.startsWith('CPL/')
  ) {
    return {
      url: MELINDA_SHEET_URL,
      gid: '1411569542',
      checker: 'MELINDA DWI PUTRI',
      label: 'Bu Melinda',
      sourceSheet: 'FBP CHECK MELINDA',
    };
  }

  return {
    url: BU_NOOR_SHEET_URL,
    gid: '76614569',
    checker: 'NOOR HASANAH',
    label: 'Bu Noor',
    sourceSheet: 'FBP CHECK BU NOOR',
  };
}

