/**
 * Utilitas pencocokan Nomor TTB dengan nama file foto lapangan.
 *
 * Contoh nama file yang didukung:
 * - "TB CINDARA 2107 CPL-TTB 04975 2026-08-20 at 12.05.33.jpeg"  -> CPL / 04975
 * - "AHTS ROYAL REY REY 07 CPL-TB 04592 BY PASS KE KAPAL ...jpeg" -> CPL / 04592
 * - "AHTS TEMASEK ATTAKA CPL-TTB 03826, 03827 2026-06-05 ...jpeg"  -> CPL / 03826 + 03827
 */

export interface TtbRef {
  prefix: string | null; // contoh: "CPL", "MO" (null jika tidak terdeteksi)
  numbers: string[]; // nomor urut 5 digit, contoh: ["04975"]
}

const TTB_IN_FILENAME = /(?:([A-Z]{2,4})\s*-\s*)?(?<![A-Z])T?TB[\s\-_.]*((?:\d{2,6}[\s,&\-]*)+)/gi;

/** Ambil semua nomor TTB (5 digit) dari nama file foto. */
export const extractTtbFromFilename = (filename: string): TtbRef => {
  const base = filename.replace(/\.[a-z0-9]+$/i, '');
  const numbers = new Set<string>();
  let prefix: string | null = null;

  for (const m of Array.from(base.matchAll(TTB_IN_FILENAME))) {
    if (m[1] && !prefix) prefix = m[1].toUpperCase();
    for (const n of m[2].match(/\b\d{5}\b/g) || []) numbers.add(n);
  }
  return { prefix, numbers: Array.from(numbers) };
};

/** Ambil prefix & 5 digit belakang dari Nomor TTB sistem, contoh "CPL-TTB-26-04975". */
export const parseNoTtb = (noTtb?: string | null): TtbRef => {
  const clean = (noTtb || '').trim().toUpperCase();
  if (!clean || clean === '-') return { prefix: null, numbers: [] };
  const prefixMatch = clean.match(/^([A-Z]{2,4})-/);
  const numMatch = clean.match(/(\d{5})\s*$/) || clean.match(/\b(\d{5})\b/);
  return {
    prefix: prefixMatch ? prefixMatch[1] : null,
    numbers: numMatch ? [numMatch[1]] : [],
  };
};

/** Cocokkan nomor TTB sistem dengan nama file (prefix perusahaan dicek jika keduanya ada). */
export const filenameMatchesTtb = (filename: string, target: TtbRef): boolean => {
  if (target.numbers.length === 0) return false;
  const ref = extractTtbFromFilename(filename);
  if (!ref.numbers.some((n) => target.numbers.includes(n))) return false;
  if (target.prefix && ref.prefix && target.prefix !== ref.prefix) return false;
  return true;
};

/** Ambil tanggal & jam dari pola WhatsApp/TimeMark "2026-08-20 at 12.05.33". */
export const extractTakenAt = (filename: string): string | null => {
  const m = filename.match(/(\d{4})-(\d{2})-(\d{2}) at (\d{2})\.(\d{2})\.(\d{2})/);
  if (!m) return null;
  return `${m[3]}/${m[2]}/${m[1]} ${m[4]}:${m[5]}:${m[6]}`;
};

