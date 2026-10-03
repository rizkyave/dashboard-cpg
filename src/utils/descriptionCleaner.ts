/**
 * Helper utilitas untuk membersihkan dan menduplikasi teks tujuan & peruntukan pengadaan.
 * Menghilangkan pengulangan kalimat, frasa ganda, atau sub-frasa yang berlebihan.
 */

/**
 * Membersihkan pengulangan internal dalam satu kalimat / frasa deskripsi.
 * Contoh: "DI SAMPING LOGISTIK U/ PEMBUATAN CANOPY CONTAINER DI SAMPING LOGISTIK"
 * -> "U/ PEMBUATAN CANOPY CONTAINER DI SAMPING LOGISTIK"
 */
export function cleanSingleDescription(str?: string): string {
  if (!str) return '';
  let s = str.replace(/\s+/g, ' ').trim();
  if (!s || s === '-') return '';

  // 1. Cek jika seluruh string berulang 2x (contoh: "ABC ABC" -> "ABC")
  const words = s.split(' ');
  const n = words.length;
  if (n >= 4 && n % 2 === 0) {
    const half = n / 2;
    const firstHalf = words.slice(0, half).join(' ');
    const secondHalf = words.slice(half).join(' ');
    if (firstHalf.toLowerCase() === secondHalf.toLowerCase()) {
      s = firstHalf;
    }
  }

  // 2. Cek pengulangan prefix jika frasa pembuka (minimal 2 kata) berulang di dalam sisa kalimat
  // Contoh: "DI SAMPING LOGISTIK U/ PEMBUATAN CANOPY CONTAINER DI SAMPING LOGISTIK"
  // Prefix "DI SAMPING LOGISTIK" muncul lagi di akhir, maka prefix awal adalah artefak duplikat.
  const currentWords = s.split(' ');
  for (let k = Math.floor(currentWords.length / 2); k >= 2; k--) {
    const prefix = currentWords.slice(0, k).join(' ');
    const remainder = currentWords.slice(k).join(' ');
    if (remainder.toLowerCase().includes(prefix.toLowerCase())) {
      s = remainder;
      break;
    }
  }

  // 3. Cek pengulangan suffix jika frasa penutup (minimal 2 kata) berulang di dalam awal kalimat
  const wordsAfterPrefix = s.split(' ');
  for (let k = Math.floor(wordsAfterPrefix.length / 2); k >= 2; k--) {
    const suffix = wordsAfterPrefix.slice(wordsAfterPrefix.length - k).join(' ');
    const remainder = wordsAfterPrefix.slice(0, wordsAfterPrefix.length - k).join(' ');
    if (remainder.toLowerCase().includes(suffix.toLowerCase())) {
      s = remainder;
      break;
    }
  }

  return s.trim();
}

/**
 * Menduplikasi kumpulan segmen deskripsi:
 * 1. Membersihkan setiap segmen dari pengulangan internal
 * 2. Menghapus segmen yang persis sama (case-insensitive)
 * 3. Menghapus segmen yang merupakan bagian / substring dari segmen lain yang lebih lengkap
 */
export function deduplicateDescriptions(segments: string[]): string[] {
  if (!segments || segments.length === 0) return [];

  // 1. Bersihkan masing-masing segmen
  const cleaned = segments
    .map((s) => cleanSingleDescription(s))
    .filter((s) => s.length > 0 && s !== '-');

  // 2. Hapus duplikat persis
  const unique: string[] = [];
  const seen = new Set<string>();
  for (const s of cleaned) {
    const key = s.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(s);
    }
  }

  // 3. Hapus segmen yang merupakan substring dari segmen lain yang lebih panjang
  // Contoh: "U/ PEMBUATAN CANOPY CONTAINER" dihilangkan jika ada
  // "U/ PEMBUATAN CANOPY CONTAINER DI SAMPING LOGISTIK"
  const result: string[] = [];
  for (let i = 0; i < unique.length; i++) {
    const cur = unique[i];
    const curLower = cur.toLowerCase();

    const isSubsetOfLonger = unique.some((other, j) => {
      if (i === j) return false;
      const otherLower = other.toLowerCase();
      return otherLower.length > curLower.length && otherLower.includes(curLower);
    });

    if (!isSubsetOfLonger) {
      result.push(cur);
    }
  }

  return result;
}

/**
 * Membersihkan string tujuan peruntukan lengkap (bisa mengandung pemisah ' • ' atau newline).
 * Mengembalikan string bersih tanpa pengulangan frasa/deskripsi.
 */
export function cleanTujuanPeruntukan(text?: string): string {
  if (!text) return '';
  const trimmed = text.trim();
  if (!trimmed || trimmed === '-') return '';

  // Pisahkan berdasarkan delimiter '•', '|', atau baris baru
  const rawSegments = trimmed.split(/[\n\r•|]+/).map((s) => s.trim());
  const deduped = deduplicateDescriptions(rawSegments);

  return deduped.join(' • ');
}
