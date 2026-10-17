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

/** Ambil semua nomor TTB (4-6 digit, standar 5 digit) dari nama file foto. */
export const extractTtbFromFilename = (filename: string): TtbRef => {
  const base = filename.replace(/\.[a-z0-9]+$/i, '');
  const numbers = new Set<string>();
  let prefix: string | null = null;

  for (const m of Array.from(base.matchAll(TTB_IN_FILENAME))) {
    if (m[1] && !prefix) prefix = m[1].toUpperCase();
    for (const n of m[2].match(/\b\d{4,6}\b/g) || []) {
      const padded = n.length <= 5 ? n.padStart(5, '0') : n;
      numbers.add(padded);
      numbers.add(n);
    }
  }
  return { prefix, numbers: Array.from(numbers) };
};

/** Ambil prefix & digit nomor dari Nomor TTB sistem, contoh "CPL-TTB-26-04975" atau "05529". */
export const parseNoTtb = (noTtb?: string | null): TtbRef => {
  const clean = (noTtb || '').trim().toUpperCase();
  if (!clean || clean === '-' || clean === 'NULL' || clean === 'UNDEFINED') {
    return { prefix: null, numbers: [] };
  }
  const prefixMatch = clean.match(/^([A-Z]{2,4})[-_ ]/);
  const prefix = prefixMatch ? prefixMatch[1] : null;

  const numbersSet = new Set<string>();
  const matches = clean.match(/\b\d{4,6}\b/g) || [];
  for (const m of matches) {
    const padded = m.length <= 5 ? m.padStart(5, '0') : m;
    numbersSet.add(padded);
    numbersSet.add(m);
  }

  // Fallback: jika tidak ada \b\d{4,6}\b tapi ada angka murni
  if (numbersSet.size === 0) {
    const digitsOnly = clean.replace(/\D/g, '');
    if (digitsOnly.length >= 3 && digitsOnly.length <= 6) {
      const padded = digitsOnly.length <= 5 ? digitsOnly.padStart(5, '0') : digitsOnly;
      numbersSet.add(padded);
      numbersSet.add(digitsOnly);
    }
  }

  return {
    prefix,
    numbers: Array.from(numbersSet),
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

