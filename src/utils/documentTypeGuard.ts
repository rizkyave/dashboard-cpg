/**
 * Guardrail & Mesin Validasi Anti-Tertukar Dokumen FSTB vs TTB
 * 
 * Mencegah kesalahan manusia (human error) saat staf logistik/lapangan keliru mengunggah:
 * - Berkas TTB (Tanda Terima Barang) ke halaman Upload FSTB
 * - Berkas FSTB (Form Serah Terima Barang) ke halaman Upload TTB
 */

export type DocumentType = 'FSTB' | 'TTB' | 'UNKNOWN';

export interface DocumentValidationResult {
  isAllowed: boolean;
  detectedType: DocumentType;
  expectedType: 'FSTB' | 'TTB';
  reason?: string;
  identifiedDocNo?: string;
}

/**
 * Pola regex pendeteksi nomor dokumen FSTB dan TTB resmi CPG
 */
const FSTB_NAME_REGEX = /(?:^|[\s_./\-])([A-Za-z]{2,6}[\s\-_./]+)?FSTB[\s\-_./]*(?:(20\d{2}|\d{2})[\s\-_./]+)?(\d{3,6})/i;
const TTB_NAME_REGEX = /(?:^|[\s_./\-])([A-Za-z]{2,6}[\s\-_./]+)?T?TB[\s\-_./]*(?:(20\d{2}|\d{2})[\s\-_./]+)?(\d{3,6})/i;

/**
 * Deteksi jenis dokumen dari nama berkas dan isi teks singkat (PDF stream token / content)
 */
export function detectDocumentType(fileName: string, textSnippet?: string): {
  type: DocumentType;
  docNo?: string;
  evidence: string;
} {
  const name = (fileName || '').trim();
  const text = (textSnippet || '').toUpperCase();

  // 1. Periksa Isi Teks Dokumen (Tingkat keyakinan tertinggi jika PDF)
  if (text) {
    const hasFstbTitle = text.includes('FORM SERAH TERIMA BARANG') || text.includes('FSTB NO') || text.includes('FSTB DATE');
    const hasTtbTitle = text.includes('TANDA TERIMA BARANG') || text.includes('TTB NO') || text.includes('TTB DATE');

    if (hasFstbTitle && !hasTtbTitle) {
      const fstbMatch = text.match(/([A-Z]{2,6}[-_]FSTB[-_]\d{2}[-_]\d+)/i) || text.match(/(FSTB[-_]\d+)/i);
      return {
        type: 'FSTB',
        docNo: fstbMatch ? fstbMatch[1].toUpperCase() : undefined,
        evidence: 'Isi dokumen memuat judul resmi "FORM SERAH TERIMA BARANG (FSTB)"',
      };
    }

    if (hasTtbTitle && !hasFstbTitle) {
      const ttbMatch = text.match(/([A-Z]{2,6}[-_]T?TB[-_]\d{2}[-_]\d+)/i) || text.match(/(T?TB[-_]\d+)/i);
      return {
        type: 'TTB',
        docNo: ttbMatch ? ttbMatch[1].toUpperCase() : undefined,
        evidence: 'Isi dokumen memuat judul resmi "TANDA TERIMA BARANG (TTB)"',
      };
    }
  }

  // 2. Periksa Pola Nama Berkas
  const fstbMatch = name.match(FSTB_NAME_REGEX);
  const ttbMatch = name.match(TTB_NAME_REGEX);

  // Jika nama mengandung FSTB secara eksplisit
  if (fstbMatch && !name.toUpperCase().includes('TTB')) {
    return {
      type: 'FSTB',
      docNo: fstbMatch[0].trim().toUpperCase(),
      evidence: `Nama berkas "${name}" memuat format penomoran FSTB`,
    };
  }

  // Jika nama mengandung TTB secara eksplisit
  if (ttbMatch && !name.toUpperCase().includes('FSTB')) {
    return {
      type: 'TTB',
      docNo: ttbMatch[0].trim().toUpperCase(),
      evidence: `Nama berkas "${name}" memuat format penomoran TTB`,
    };
  }

  // Kata kunci umum pada nama berkas
  const upperName = name.toUpperCase();
  if (upperName.includes('FORM SERAH TERIMA') || upperName.includes('SERAH TERIMA BARANG')) {
    return {
      type: 'FSTB',
      evidence: `Nama berkas mengandung kata kunci "SERAH TERIMA BARANG"`,
    };
  }

  if (upperName.includes('TANDA TERIMA BARANG') || upperName.includes('BUKTI PENERIMAAN BARANG')) {
    return {
      type: 'TTB',
      evidence: `Nama berkas mengandung kata kunci "TANDA TERIMA BARANG"`,
    };
  }

  return { type: 'UNKNOWN', evidence: 'Dokumen umum / foto lampiran pendukung' };
}

/**
 * Validasi apakah berkas diizinkan diunggah pada target menu tertentu (FSTB atau TTB)
 */
export function validateUploadDocumentType(
  targetMenu: 'FSTB' | 'TTB',
  fileName: string,
  textSnippet?: string
): DocumentValidationResult {
  const { type, docNo, evidence } = detectDocumentType(fileName, textSnippet);

  // Jika dokumen adalah FSTB tapi diunggah di menu TTB -> TOLAK
  if (targetMenu === 'TTB' && type === 'FSTB') {
    return {
      isAllowed: false,
      detectedType: 'FSTB',
      expectedType: 'TTB',
      identifiedDocNo: docNo,
      reason: `Berkas "${fileName}" terdeteksi sebagai Dokumen FSTB (${evidence}). Mohon unggah pada menu 'Upload FSTB', bukan di 'Upload TTB'.`,
    };
  }

  // Jika dokumen adalah TTB tapi diunggah di menu FSTB -> TOLAK
  if (targetMenu === 'FSTB' && type === 'TTB') {
    return {
      isAllowed: false,
      detectedType: 'TTB',
      expectedType: 'FSTB',
      identifiedDocNo: docNo,
      reason: `Berkas "${fileName}" terdeteksi sebagai Dokumen TTB (${evidence}). Mohon unggah pada menu 'Upload TTB', bukan di 'Upload FSTB'.`,
    };
  }

  // Diizinkan (tipe sesuai atau merupakan foto lampiran fisik umum)
  return {
    isAllowed: true,
    detectedType: type,
    expectedType: targetMenu,
    identifiedDocNo: docNo,
  };
}
