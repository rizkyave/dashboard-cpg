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

  const companyMap: Record<string, InventoryCompanySummary> = {};

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
  }

  // Top 15 items with highest quantity (prefer parent items, sort desc)
  const sortedItems = [...items]
    .filter((it) => it.quantity > 0)
    .sort((a, b) => b.quantity - a.quantity)
    .slice(0, 15)
    .map((it, idx) => ({
      rank: idx + 1,
      company: it.perusahaan,
      itemCode: it.itemCode,
      description: it.description,
      quantity: it.quantity,
      itemType: it.itemType,
      category: it.category || determineCategory(it.itemCode, it.description, it.itemType),
      level: it.level || 'Induk',
    }));

  return {
    totalItems: items.length,
    parentItems,
    subItems,
    totalQuantity,
    activeStock,
    zeroStock,
    negativeStock,
    byCompany: Object.values(companyMap),
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
        category: determineCategory(code, desc, itemType),
        level,
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
        const noIdx = headerRow.findIndex((h) => h.includes('no') || h.includes('kode'));
        const descIdx = headerRow.findIndex((h) => h.includes('deskripsi') || h.includes('nama'));
        const qtyIdx = headerRow.findIndex((h) => h.includes('kuantitas') || h.includes('stok') || h.includes('qty'));
        const priceIdx = headerRow.findIndex((h) => h.includes('harga'));
        const typeIdx = headerRow.findIndex((h) => h.includes('tipe barang'));
        const invTypeIdx = headerRow.findIndex((h) => h.includes('tipe persediaan'));
        const levelIdx = headerRow.findIndex((h) => h.includes('level'));

        for (let j = headerIdx + 1; j < rows.length; j++) {
          const row = rows[j];
          if (!row || row.length === 0) continue;

          const code = String(row[noIdx] ?? '').trim();
          const desc = String(row[descIdx] ?? '').trim();
          if (!code && !desc) continue;

          const qty = Number(row[qtyIdx] ?? 0);
          const price = Number(row[priceIdx] ?? 0);
          const itemType = String(row[typeIdx] ?? 'Persediaan').trim();
          const invType = String(row[invTypeIdx] ?? '-').trim();
          const level = String(row[levelIdx] ?? 'Induk').trim();

          items.push({
            id: `inv-${items.length + 1}`,
            perusahaan: detectedCompany,
            entity: mapCompanyToEntity(detectedCompany),
            itemCode: code,
            description: desc,
            quantity: isNaN(qty) ? 0 : qty,
            unitPrice: isNaN(price) ? 0 : price,
            itemType,
            inventoryType: invType,
            category: determineCategory(code, desc, itemType),
            level,
          });
        }
      }
    }
  }

  const summary = calculateInventorySummary(items);
  return { items, summary };
}
