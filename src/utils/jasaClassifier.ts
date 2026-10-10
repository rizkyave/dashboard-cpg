/**
 * Utility untuk mendeteksi dan mengklasifikasikan kategori pengadaan:
 * - JASA (Services / Pekerjaan / Subkon / Sewa / Overhaul / Perbaikan / MTC)
 * - BARANG (Goods / Sparepart / Material Fisik / Consumable)
 * - CAMPURAN (Hybrid: Gabungan Barang & Jasa dalam 1 FPB/PO)
 */

export interface ItemClassifiable {
  code?: string;
  name?: string;
  unit?: string;
  description?: string;
  category?: string;
}

export type ProcurementCategory = 'BARANG' | 'JASA' | 'CAMPURAN';

/**
 * Normalisasi satuan untuk item JASA agar sesuai dengan kaidah operasional maritim & audit procurement.
 * Mengoreksi satuan fisik yang keliru (seperti PCS, PC, BUAH, BH) menjadi unit, alat, job, atau kegiatan.
 */
export function normalizeJasaUnit(rawUnit: string = '', itemName: string = ''): string {
  const u = (rawUnit || '').trim().toUpperCase();
  const n = (itemName || '').toUpperCase();

  // Jika satuan sudah berupa satuan jasa / operasional yang lazim, pertahankan
  if (['UNIT', 'ALAT', 'JOB', 'KEGIATAN', 'HARI', 'BULAN', 'TRIP', 'LS', 'LUMPSUM', 'SET', 'JAM'].includes(u)) {
    return u.toLowerCase();
  }

  // Jika satuan keliru menggunakan satuan barang fisik (seperti PCS, PC, BUAH, BH) atau kosong:
  if (n.includes('KALIBRASI')) {
    // Kalibrasi instrumen/alat ukur (contoh: Gas Detector) lazim menggunakan satuan 'unit' atau 'alat'
    return 'unit';
  }
  if (/\b(OVERHAUL|BUBUT|PENGELASAN|FABRIKASI|REPAIR|PERBAIKAN|SERVICE|SERVIS)\b/.test(n)) {
    return 'job';
  }
  if (/\b(SEWA|RENTAL)\b/.test(n)) {
    return 'hari';
  }
  if (/\b(SERTIFIKASI|INSPEKSI|SURVEY|TESTING)\b/.test(n)) {
    return 'kegiatan';
  }
  return 'unit';
}

/**
 * Deteksi apakah sebuah item merupakan item JASA
 */
export function isItemJasa(item: ItemClassifiable): boolean {
  if (item.category && item.category.toUpperCase() === 'JASA') {
    return true;
  }

  const code = (item.code || '').toUpperCase().trim();
  const name = (item.name || item.description || '').toUpperCase().trim();
  const unit = (item.unit || '').toUpperCase().trim();

  // 1. Kode barang berawalan JAS atau SRV (contoh: JAS05027001-JSA, JAS02265004-JSA)
  if (code.startsWith('JAS') || code.startsWith('SRV')) {
    return true;
  }

  // 2. Eksplisit tertulis (JASA) di nama barang (contoh: "... D5AT (JASA)")
  if (
    name.includes('(JASA)') ||
    name.includes('( JASA )') ||
    name.startsWith('JASA ') ||
    name.includes(' JASA ')
  ) {
    return true;
  }

  // 3. Satuan pekerjaan non-fisik
  if (['JASA', 'LS', 'LUMPSUM', 'TRIP', 'JOB', 'KEGIATAN'].includes(unit)) {
    return true;
  }

  // 4. Kata kerja pekerjaan jasa (selama bukan nama material fisik)
  const isMaterialPhysical = /\b(FILTER|OLI|OIL|PIPA|PIPE|PLAT|PLATE|BAUT|BOLT|NUT|MUR|SEAL|GASKET|BEARING|KABEL|CABLE|LAMPU|CAT|THINNER|HOSE|BATTERY|ACCU|AKI|GREASE|GEMUK)\b/.test(
    name
  );

  if (!isMaterialPhysical) {
    if (
      /\b(JASA|SEWA|RENTAL|OVERHAUL|BUBUT|PENGELASAN|FABRIKASI|KALIBRASI|INSPEKSI|SERTIFIKASI|EKSPEDISI|CARGO|REPAIR|PERBAIKAN|SERVICE)\b/.test(
        name
      )
    ) {
      return true;
    }
  }

  return false;
}

/**
 * Menentukan kategori keseluruhan dari sebuah transaksi pengadaan (FPB / PO)
 */
export function determineTransactionCategory(items: ItemClassifiable[]): ProcurementCategory {
  if (!items || items.length === 0) {
    return 'BARANG';
  }

  let jasaCount = 0;
  let barangCount = 0;

  for (const it of items) {
    if (isItemJasa(it)) {
      jasaCount++;
    } else {
      barangCount++;
    }
  }

  if (jasaCount > 0 && barangCount === 0) {
    return 'JASA';
  }
  if (jasaCount > 0 && barangCount > 0) {
    return 'CAMPURAN';
  }
  return 'BARANG';
}


