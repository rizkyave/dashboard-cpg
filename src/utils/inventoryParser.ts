import * as XLSX from 'xlsx';
import { InventoryItem, InventorySummary, InventoryCompanySummary } from '@/types/procurement';
import { determineCategory } from './categoryClassifier';

export { determineCategory } from './categoryClassifier';

export const mapCompanyToEntity = (compName: string): string => {
  const upper = compName.toUpperCase();
  if (upper.includes('CINDARA') || upper.includes('CPL')) return 'CPL';
  if (upper.includes('HANA') || upper.includes('HL')) return 'HL';
  if (upper.includes('MANDAR') || upper.includes('MO')) return 'MO';
  if (upper.includes('PETRO') || upper.includes('PPI')) return 'PPI';
  if (upper.includes('GALANGAN') || upper.includes('GAJ')) return 'GAJ';
  if (upper.includes('MAPAN') || upper.includes('MIL')) return 'MIL';
  if (upper.includes('SINAR PASIFIK') || upper.includes('SP')) return 'SP';
  if (upper.includes('SINAR SURYA') || upper.includes('SSK')) return 'SSK';
  return 'CPG';
};

export function calculateInventorySummary(items: InventoryItem[]): InventorySummary {
  let totalQuantity = 0;
  let activeStock = 0;
  let zeroStock = 0;
  let negativeStock = 0;
  let parentItems = 0;
  let subItems = 0;
  let physicalItems = 0;
  let serviceItems = 0;
  let accountingItems = 0;

  const companyMap: Record<string, InventoryCompanySummary> = {};
  const categoryMap: Record<string, { totalItems: number; activeItems: number; totalQuantity: number }> = {};

  for (const item of items) {
    const qty = item.quantity;
    const isParent = (item.level || '').toLowerCase().includes('induk');

    if (isParent) {
      parentItems++;
      totalQuantity += qty;
    } else {
      subItems++;
    }

    if (qty > 0) activeStock++;
    else if (qty === 0) zeroStock++;
    else negativeStock++;

    const sifat = (item.sifatEntitas || '').toLowerCase();
    if (sifat.includes('jasa')) {
      serviceItems++;
    } else if (sifat.includes('akun') || sifat.includes('akuntansi')) {
      accountingItems++;
    } else {
      physicalItems++;
    }

    const compName = item.perusahaan || 'Lainnya';
    if (!companyMap[compName]) {
      companyMap[compName] = {
        name: compName,
        entity: item.entity || mapCompanyToEntity(compName),
        totalItems: 0,
        parentItems: 0,
        subItems: 0,
        totalQuantity: 0,
        activeStock: 0,
        zeroStock: 0,
        negativeStock: 0,
      };
    }

    const cEntry = companyMap[compName];
    cEntry.totalItems++;
    if (isParent) {
      cEntry.parentItems++;
      cEntry.totalQuantity += qty;
    } else {
      cEntry.subItems++;
    }

    if (qty > 0) cEntry.activeStock++;
    else if (qty === 0) cEntry.zeroStock++;
    else cEntry.negativeStock++;

    const catName = item.kategoriUtama || item.category || 'Lain-lain';
    if (!categoryMap[catName]) {
      categoryMap[catName] = { totalItems: 0, activeItems: 0, totalQuantity: 0 };
    }
    categoryMap[catName].totalItems++;
    if (qty > 0) categoryMap[catName].activeItems++;
    if (isParent) categoryMap[catName].totalQuantity += qty;
  }

  // Top 25 items with highest quantity (sort desc)
  const sortedItems = [...items]
    .filter((it) => it.quantity > 0)
    .sort((a, b) => b.quantity - a.quantity)
    .slice(0, 25)
    .map((it, idx) => ({
      rank: idx + 1,
      company: it.perusahaan,
      itemCode: it.itemCode,
      description: it.description,
      quantity: it.quantity,
      itemType: it.itemType,
      category: it.kategoriUtama || it.category || determineCategory(it.itemCode, it.description, it.itemType),
      level: it.level || 'Induk',
      uom: it.uom || 'Pcs',
      rekomendasi: it.rekomendasi || '-',
    }));

  const byCategory = Object.entries(categoryMap)
    .map(([category, stats]) => ({
      category,
      totalItems: stats.totalItems,
      activeItems: stats.activeItems,
      totalQuantity: stats.totalQuantity,
    }))
    .sort((a, b) => b.totalItems - a.totalItems);

  return {
    totalItems: items.length,
    parentItems,
    subItems,
    totalQuantity,
    activeStock,
    zeroStock,
    negativeStock,
    physicalItems,
    serviceItems,
    accountingItems,
    byCompany: Object.values(companyMap),
    byCategory,
    topItems: sortedItems,
  };
}

/**
 * Parses an Excel workbook containing inventory/persediaan data.
 * Supports:
 * 1. "Daftar_Barang_Gabungan_Semua_Perusahaan.xlsx" (with sheet 'Gabungan Semua Perusahaan' or company sheets)
 * 2. Individual company files e.g. "Daftar_Barang_PT_CINDARA_PRATAMA_LINES.xlsx"
 * 3. Any Accurate exported catalog sheet
 */
export function parseInventoryWorkbook(workbook: XLSX.WorkBook): {
  items: InventoryItem[];
  summary: InventorySummary;
} {
  const items: InventoryItem[] = [];

  // 1. Check for consolidated sheet first
  const gabunganSheetName = workbook.SheetNames.find((s) => {
    const up = s.toUpperCase();
    return up.includes('GABUNGAN') || up.includes('KONSOLIDASI') || up.includes('ALL ITEM');
  });

  if (gabunganSheetName) {
    const sheet = workbook.Sheets[gabunganSheetName];
    const rawRows = XLSX.utils.sheet_to_json<any>(sheet);

    rawRows.forEach((r, idx) => {
      const code = String(r['No. Barang'] || r['Kode Barang'] || r['Kode'] || '').trim();
      const desc = String(r['Deskripsi Barang'] || r['Nama Barang'] || r['Deskripsi'] || '').trim();
      if (!code && !desc) return;

      const comp = String(r['Perusahaan'] || r['Nama Perusahaan'] || 'CPG Holding').trim();
      const qty = Number(r['Kuantitas'] ?? r['Stok'] ?? r['Qty'] ?? 0);
      const price = Number(r['Harga Satuan'] ?? r['Harga'] ?? 0);
      const itemType = String(r['Tipe Barang'] || 'Persediaan').trim();
      const invType = String(r['Tipe Persediaan'] || '-').trim();
      const level = String(r['Level'] || 'Induk').trim();
      const katUtama = String(r['Kategori Utama'] || r['Kategori'] || '').trim();
      const subKat = String(r['Jenis / Sub-Kategori'] || r['Sub-Kategori'] || r['Sub Kategori'] || '').trim();
      const uom = String(r['Satuan (UoM)'] || r['Satuan'] || r['UoM'] || 'Pcs').trim();
      const sifat = String(r['Sifat Entitas'] || r['Sifat'] || 'Barang Fisik').trim();
      const statusStok = String(
        r['Status Stok Logistik'] ||
        r['Status Stok'] ||
        (qty > 0 ? 'Stok Aktif (>0)' : qty === 0 ? 'Stok Kosong (0)' : 'Stok Minus (<0)')
      ).trim();
      const rekomendasi = String(r['Rekomendasi Tindakan Logistik'] || r['Rekomendasi'] || '').trim();

      const resolvedCategory = katUtama || determineCategory(code, desc, itemType);

      items.push({
        id: `inv-${idx + 1}`,
        perusahaan: comp,
        entity: mapCompanyToEntity(comp),
        itemCode: code,
        description: desc,
        quantity: isNaN(qty) ? 0 : qty,
        unitPrice: isNaN(price) ? 0 : price,
        itemType,
        inventoryType: invType,
        category: resolvedCategory,
        level,
        kategoriUtama: resolvedCategory,
        subKategori: subKat,
        uom,
        sifatEntitas: sifat,
        statusStok,
        rekomendasi,
      });
    });
  } else {
    // 2. Parse individual company sheets or single sheets
    for (const sheetName of workbook.SheetNames) {
      if (sheetName.toLowerCase().includes('ringkasan') || sheetName.toLowerCase().includes('dashboard')) {
        continue;
      }

      const sheet = workbook.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1 });
      if (!rows || rows.length === 0) continue;

      let detectedCompany = sheetName;
      let headerIdx = -1;

      for (let i = 0; i < Math.min(10, rows.length); i++) {
        const row = rows[i] || [];
        const str = row.join(' ').toLowerCase();

        // Check if header row contains title with company name
        if (str.includes('daftar barang') && !str.includes('no. barang')) {
          const compMatch = String(row[0] || '').split('-')[0].trim();
          if (compMatch) detectedCompany = compMatch;
        }

        if (
          str.includes('no. barang') ||
          str.includes('deskripsi barang') ||
          str.includes('kuantitas') ||
          str.includes('kode barang')
        ) {
          headerIdx = i;
          break;
        }
      }

      if (headerIdx !== -1) {
        const headerRow = rows[headerIdx].map((c) => String(c || '').trim().toLowerCase());
        const compIdx = headerRow.findIndex(
          (h) => h.includes('perusahaan') || h.includes('company') || h.includes('pt ') || h === 'pt'
        );
        const noIdx = headerRow.findIndex(
          (h) => h.includes('no') || h.includes('kode') || h.includes('item code') || h === 'item'
        );
        const descIdx = headerRow.findIndex(
          (h) => h.includes('deskripsi') || h.includes('nama') || h.includes('description') || h.includes('item name')
        );
        const qtyIdx = headerRow.findIndex(
          (h) => h.includes('kuantitas') || h.includes('stok') || h.includes('qty') || h.includes('quantity')
        );
        const priceIdx = headerRow.findIndex((h) => h.includes('harga') || h.includes('price'));
        const typeIdx = headerRow.findIndex(
          (h) => h.includes('tipe barang') || h.includes('item type') || h.includes('tipe') || h === 'type'
        );
        const invTypeIdx = headerRow.findIndex(
          (h) => h.includes('tipe persediaan') || h.includes('inventory type')
        );
        const levelIdx = headerRow.findIndex((h) => h.includes('level'));
        const katIdx = headerRow.findIndex(
          (h) => h.includes('kategori utama') || h.includes('kategori') || h.includes('category')
        );
        const subKatIdx = headerRow.findIndex(
          (h) => h.includes('sub-kategori') || h.includes('sub kategori') || h.includes('jenis')
        );
        const uomIdx = headerRow.findIndex(
          (h) => h.includes('satuan') || h.includes('uom') || h.includes('unit')
        );
        const sifatIdx = headerRow.findIndex((h) => h.includes('sifat'));
        const statusStokIdx = headerRow.findIndex((h) => h.includes('status stok'));
        const rekIdx = headerRow.findIndex((h) => h.includes('rekomendasi'));

        for (let j = headerIdx + 1; j < rows.length; j++) {
          const row = rows[j];
          if (!row || row.length === 0) continue;

          const code = String(row[noIdx] ?? '').trim();
          const desc = String(row[descIdx] ?? '').trim();
          if (!code && !desc) continue;

          const rawComp = compIdx !== -1 ? String(row[compIdx] ?? '').trim() : '';
          const comp = rawComp || detectedCompany;

          const qty = Number(row[qtyIdx] ?? 0);
          const price = Number(row[priceIdx] ?? 0);
          const itemType = String(row[typeIdx] ?? 'Persediaan').trim();
          const invType = String(row[invTypeIdx] ?? '-').trim();
          const level = String(row[levelIdx] ?? 'Induk').trim();
          const katUtama = katIdx !== -1 ? String(row[katIdx] ?? '').trim() : '';
          const subKat = subKatIdx !== -1 ? String(row[subKatIdx] ?? '').trim() : '';
          const uom = uomIdx !== -1 ? String(row[uomIdx] ?? 'Pcs').trim() : 'Pcs';
          const sifat = sifatIdx !== -1 ? String(row[sifatIdx] ?? 'Barang Fisik').trim() : 'Barang Fisik';
          const statusStok = statusStokIdx !== -1
            ? String(row[statusStokIdx] ?? '').trim()
            : qty > 0 ? 'Stok Aktif (>0)' : qty === 0 ? 'Stok Kosong (0)' : 'Stok Minus (<0)';
          const rekomendasi = rekIdx !== -1 ? String(row[rekIdx] ?? '').trim() : '';

          const resolvedCategory = katUtama || determineCategory(code, desc, itemType);

          items.push({
            id: `inv-${items.length + 1}`,
            perusahaan: comp,
            entity: mapCompanyToEntity(comp),
            itemCode: code,
            description: desc,
            quantity: isNaN(qty) ? 0 : qty,
            unitPrice: isNaN(price) ? 0 : price,
            itemType,
            inventoryType: invType,
            category: resolvedCategory,
            level,
            kategoriUtama: resolvedCategory,
            subKategori: subKat,
            uom,
            sifatEntitas: sifat,
            statusStok,
            rekomendasi,
          });
        }
      }
    }
  }

  const summary = calculateInventorySummary(items);
  return { items, summary };
}

/**
 * Exports inventory items to a comprehensive Excel (.xlsx) file
 */
export function exportInventoryToExcel(items: InventoryItem[], filename: string = 'Data_Persediaan_Stok_Accurate_CPG_2026.xlsx') {
  const wb = XLSX.utils.book_new();

  // Sheet 1: Semua Barang
  const allRows = items.map((it, idx) => ({
    'No': idx + 1,
    'Perusahaan': it.perusahaan,
    'Entitas': it.entity,
    'No. Barang': it.itemCode,
    'Deskripsi Barang': it.description,
    'Kuantitas': it.quantity,
    'Satuan (UoM)': it.uom || 'Pcs',
    'Level': it.level || 'Induk',
    'Kategori Utama': it.kategoriUtama || it.category || '-',
    'Sub-Kategori': it.subKategori || '-',
    'Sifat Entitas': it.sifatEntitas || 'Barang Fisik',
    'Status Stok': it.statusStok || (it.quantity > 0 ? 'Stok Aktif (>0)' : 'Stok Kosong (0)'),
    'Rekomendasi': it.rekomendasi || '-',
    'Harga Satuan': it.unitPrice || 0,
    'Tipe Barang': it.itemType || '-',
  }));
  const ws1 = XLSX.utils.json_to_sheet(allRows);
  XLSX.utils.book_append_sheet(wb, ws1, 'Semua Persediaan');

  // Sheet 2: Stok Aktif (>0)
  const activeRows = items
    .filter((it) => it.quantity > 0)
    .map((it, idx) => ({
      'No': idx + 1,
      'Perusahaan': it.perusahaan,
      'No. Barang': it.itemCode,
      'Deskripsi Barang': it.description,
      'Kuantitas': it.quantity,
      'Satuan (UoM)': it.uom || 'Pcs',
      'Level': it.level || 'Induk',
      'Kategori Utama': it.kategoriUtama || it.category || '-',
      'Sub-Kategori': it.subKategori || '-',
      'Rekomendasi': it.rekomendasi || '-',
    }));
  const ws2 = XLSX.utils.json_to_sheet(activeRows);
  XLSX.utils.book_append_sheet(wb, ws2, 'Stok Aktif (>0)');

  // Sheet 3: Rekomendasi Cleansing / Jasa
  const cleansingRows = items
    .filter((it) => (it.rekomendasi || '').toLowerCase().includes('keluarkan') || (it.sifatEntitas || '').toLowerCase().includes('jasa'))
    .map((it, idx) => ({
      'No': idx + 1,
      'Perusahaan': it.perusahaan,
      'No. Barang': it.itemCode,
      'Deskripsi Barang': it.description,
      'Kuantitas': it.quantity,
      'Sifat Entitas': it.sifatEntitas || 'Jasa (Non-Fisik)',
      'Rekomendasi': it.rekomendasi || 'Keluarkan dari Master Persediaan',
    }));
  const ws3 = XLSX.utils.json_to_sheet(cleansingRows);
  XLSX.utils.book_append_sheet(wb, ws3, 'Rekomendasi Cleansing');

  XLSX.writeFile(wb, filename);
}
