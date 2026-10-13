/**
 * itemResolver.ts
 * Utilitas terpusat untuk sanitasi nama barang, deteksi string generik/invalid,
 * dan resolusi nama barang aktual dari berbagai sumber (e-FPB PDF, Sisa Layanan 2026, Sheet 2 MLA).
 *
 * Mencegah munculnya teks generik seperti "Item Operasional" di tooltip dan tampilan antarmuka.
 */

// Daftar kata kunci dan frasa generik / non-barang yang TIDAK boleh dianggap sebagai nama barang
const GENERIC_ITEM_KEYWORDS = [
  'item operasional',
  'operasional',
  'pengadaan operasional',
  'barang operasional',
  'material operasional',
  'material & suku cadang',
  'kebutuhan unit',
  'unit armada',
  'permintaan barang',
  'pengadaan kebutuhan',
  'kebutuhan operasional',
  'operasional rutin',
  'u/ operasional rutin',
  'u/ kebutuhan operasional armada',
  'biaya pengiriman',
  'biaya kirim',
  'ongkir',
  'ekspedisi',
  'jasa pengiriman',
  'office gaj',
  'cb mahlia',
  'ahts temasek',
  'kantor pusat',
  'head office',
  'workshop',
  'docking',
  'logistik',
  'purchasing',
  'finance',
  'hrd',
  'keuangan',
];

/**
 * Memeriksa apakah suatu string bukan nama barang fisik/jasa yang valid
 * (misal: kosong, null, '-' atau teks generik seperti "Item Operasional" / nama departemen/kapal).
 */
export function isInvalidOrGenericItem(name: string | undefined | null, deptArmada?: string): boolean {
  if (!name) return true;
  const trimmed = name.trim();
  if (
    !trimmed ||
    trimmed === '-' ||
    trimmed === '--' ||
    trimmed.toLowerCase() === 'null' ||
    trimmed.toLowerCase() === 'undefined' ||
    trimmed.toLowerCase() === 'barang' ||
    trimmed.toLowerCase() === 'item' ||
    trimmed.toLowerCase() === 'items'
  ) {
    return true;
  }

  const lower = trimmed.toLowerCase();
  const armLower = (deptArmada || '').trim().toLowerCase();

  // Tolak jika sama persis atau diawali nama armada/departemen murni
  if (
    armLower &&
    (lower === armLower ||
      lower === `unit ${armLower}` ||
      lower === `armada ${armLower}` ||
      lower === `unit armada ${armLower}` ||
      lower === `operasional ${armLower}` ||
      lower === `material & suku cadang ${armLower}`)
  ) {
    return true;
  }

  // Tolak jika diawali dengan pola generik seperti "Pengadaan Kebutuhan..."
  if (
    lower.startsWith('pengadaan kebutuhan') ||
    lower.startsWith('kebutuhan operasional') ||
    lower.startsWith('item operasional') ||
    lower.startsWith('material & suku cadang') ||
    lower.startsWith('operasional ')
  ) {
    return true;
  }

  // Tolak frasa generik
  if (
    GENERIC_ITEM_KEYWORDS.some(
      (kw) => lower === kw || (lower.startsWith(kw) && lower.length < kw.length + 5)
    )
  ) {
    return true;
  }

  return false;
}

/**
 * Mengembalikan nama barang bersih jika valid, atau string kosong jika generik/invalid.
 */
export function cleanItemName(name: string | undefined | null, deptArmada?: string): string {
  if (isInvalidOrGenericItem(name, deptArmada)) return '';
  return (name || '').trim();
}

/**
 * Parameter untuk resolusi nama barang aktual
 */
export interface ResolveDisplayItemOptions {
  currentItem?: string;
  deptArmada?: string;
  pdfItems?: string[];
  sisaItems?: string[];
  armadaItems?: string[];
  maxItemsToShow?: number;
}

/**
 * Menyelesaikan nama barang aktual dengan urutan prioritas:
 * 1. Item e-FPB dari PDF (pdfItems)
 * 2. Item database Sisa Layanan 2026 (sisaItems)
 * 3. Item dari Sheet 2 Monitoring Layanan Armada (armadaItems)
 * 4. currentItem jika bukan teks generik/invalid
 *
 * Mengembalikan ringkasan string yang diformat (misal: "FILTER OLI, RING PISTON" atau "-").
 * TIDAK AKAN PERNAH mengembalikan "Item Operasional".
 */
export function resolveDisplayItemName(options: ResolveDisplayItemOptions): string {
  const {
    currentItem,
    deptArmada,
    pdfItems = [],
    sisaItems = [],
    armadaItems = [],
    maxItemsToShow = 5,
  } = options;

  const validItems: string[] = [];

  const addItems = (list: (string | undefined | null)[]) => {
    for (const raw of list) {
      if (!raw) continue;
      const clean = raw.trim();
      if (!isInvalidOrGenericItem(clean, deptArmada) && !validItems.includes(clean)) {
        validItems.push(clean);
      }
    }
  };

  // Prioritas 1: PDF e-FPB
  if (pdfItems.length > 0) {
    addItems(pdfItems);
  }

  // Prioritas 2: Database Sisa Layanan 2026 (29k item)
  if (validItems.length === 0 && sisaItems.length > 0) {
    addItems(sisaItems);
  }

  // Prioritas 3: Sheet 2 MLA (Monitoring Layanan Armada)
  if (validItems.length === 0 && armadaItems.length > 0) {
    addItems(armadaItems);
  }

  // Prioritas 4: currentItem
  if (validItems.length === 0 && currentItem) {
    const clean = currentItem.trim();
    if (!isInvalidOrGenericItem(clean, deptArmada)) {
      validItems.push(clean);
    }
  }

  if (validItems.length === 0) {
    return '-';
  }

  if (validItems.length <= maxItemsToShow) {
    return validItems.join(', ');
  }

  const shown = validItems.slice(0, maxItemsToShow).join(', ');
  const remaining = validItems.length - maxItemsToShow;
  return `${shown} (+${remaining} item lainnya)`;
}

/**
 * Parameter untuk membangun tooltip lengkap pada nomor FPB
 */
export interface FormatFpbTooltipOptions extends ResolveDisplayItemOptions {
  fpb: string;
  currentKeterangan?: string;
  pdfKeterangan?: string;
  sisaKeterangan?: string;
  armadaKeterangan?: string;
}

/**
 * Membangun teks tooltip lengkap untuk nomor FPB saat mouse di-hover
 */
export function formatFpbTooltip(options: FormatFpbTooltipOptions): string {
  const {
    fpb,
    currentKeterangan,
    pdfKeterangan,
    sisaKeterangan,
    armadaKeterangan,
    ...itemOptions
  } = options;

  const itemSummary = resolveDisplayItemName(itemOptions);

  // Cari keterangan yang paling informatif & bukan generik
  const candidateKets = [
    pdfKeterangan,
    currentKeterangan,
    armadaKeterangan,
    sisaKeterangan,
  ].filter(Boolean) as string[];

  let cleanKet = '-';
  for (const raw of candidateKets) {
    const t = raw.trim();
    if (
      t &&
      t !== '-' &&
      !t.toLowerCase().startsWith('u/ operasional rutin') &&
      !t.toLowerCase().startsWith('pengadaan operasional')
    ) {
      cleanKet = t;
      break;
    }
  }

  return `No. FPB: ${fpb}\n• Nama Barang: ${itemSummary}\n• Keterangan: ${cleanKet}`;
}

