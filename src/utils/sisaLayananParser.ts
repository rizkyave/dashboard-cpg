import * as XLSX from 'xlsx';
import { SisaLayananItem, SisaLayananSummary, SisaGoodsSummary } from '@/types/sisaLayanan';
import { normalizeFpbKey } from '@/utils/dataMerger';

export function calculateSisaLayananSummary(items: SisaLayananItem[]): SisaLayananSummary {
  const byPt: Record<string, { total: number; close: number; open: number; kurang: number; belumTtb: number }> = {};
  const byStatus: Record<string, number> = {
    CLOSE: 0,
    OPEN: 0,
    KURANG: 0,
    'BELUM TTB': 0,
  };
  const unitSet = new Set<string>();
  const ptSet = new Set<string>();

  let totalClose = 0;
  let totalOpen = 0;
  let totalKurang = 0;
  let totalBelumTtb = 0;

  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    const pt = it.pt || 'OTHER';
    const st = it.status.toUpperCase();

    if (it.departement) unitSet.add(it.departement);
    if (it.pt) ptSet.add(it.pt);

    if (!byPt[pt]) {
      byPt[pt] = { total: 0, close: 0, open: 0, kurang: 0, belumTtb: 0 };
    }
    byPt[pt].total++;

    if (st === 'CLOSE') {
      totalClose++;
      byPt[pt].close++;
      byStatus['CLOSE'] = (byStatus['CLOSE'] || 0) + 1;
    } else if (st === 'OPEN') {
      totalOpen++;
      byPt[pt].open++;
      byStatus['OPEN'] = (byStatus['OPEN'] || 0) + 1;
    } else if (st === 'KURANG') {
      totalKurang++;
      byPt[pt].kurang++;
      byStatus['KURANG'] = (byStatus['KURANG'] || 0) + 1;
    } else if (st === 'BELUM TTB') {
      totalBelumTtb++;
      byPt[pt].belumTtb++;
      byStatus['BELUM TTB'] = (byStatus['BELUM TTB'] || 0) + 1;
    } else {
      byStatus[st] = (byStatus[st] || 0) + 1;
    }
  }

  const totalItems = items.length;
  const fulfillmentRate = totalItems > 0 ? Number(((totalClose / totalItems) * 100).toFixed(1)) : 0;

  return {
    totalItems,
    totalClose,
    totalOpen,
    totalKurang,
    totalBelumTtb,
    totalUnits: unitSet.size,
    totalPts: ptSet.size,
    fulfillmentRate,
    byPt,
    byStatus,
    lastUpdated: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
  };
}

export function parseSisaLayananWorkbook(workbook: XLSX.WorkBook): {
  items: SisaLayananItem[];
  summary: SisaLayananSummary;
} {
  // 1. Temukan sheet yang tepat
  let targetSheetName = workbook.SheetNames.find(
    (s) =>
      s.toUpperCase().includes('SISA LAYANAN') ||
      s.toUpperCase().includes('GABUNGAN') ||
      s.toUpperCase().includes('LAYANAN')
  );

  if (!targetSheetName) {
    targetSheetName = workbook.SheetNames[0];
  }

  const sheet = workbook.Sheets[targetSheetName];
  if (!sheet) {
    return { items: [], summary: calculateSisaLayananSummary([]) };
  }

  // 2. Baca seluruh row dalam bentuk array 2D untuk mendeteksi header secara dinamis
  const rawRows = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1 });
  if (!rawRows || rawRows.length === 0) {
    return { items: [], summary: calculateSisaLayananSummary([]) };
  }

  // Cari index header (baris yang mengandung 'NO. FPB' atau 'FPB+NO BARANG')
  let headerIndex = -1;
  for (let r = 0; r < Math.min(15, rawRows.length); r++) {
    const row = rawRows[r];
    if (Array.isArray(row)) {
      const rowStr = row.map((c) => String(c || '').trim().toUpperCase()).join(' | ');
      if (
        rowStr.includes('NO. FPB') ||
        rowStr.includes('FPB+NO BARANG') ||
        (rowStr.includes('NO. PO') && rowStr.includes('KODE BARANG'))
      ) {
        headerIndex = r;
        break;
      }
    }
  }

  if (headerIndex === -1) {
    headerIndex = 0; // fallback jika header langsung di row 0
  }

  // 3. Parse data sebagai objek menggunakan header dari baris yang ditemukan
  const rawData = XLSX.utils.sheet_to_json<Record<string, any>>(sheet, {
    range: headerIndex,
    defval: '',
  });

  const items: SisaLayananItem[] = [];

  for (let i = 0; i < rawData.length; i++) {
    const r = rawData[i];

    // Ambil kolom dengan toleransi variasi penamaan header
    const noFpb = String(r['NO. FPB'] || r['NO FPB'] || r['FPB'] || '').trim();
    const kodeBarang = String(r['KODE BARANG'] || r['KODE_BARANG'] || '').trim();
    const namaBarang = String(r['NAMA BARANG'] || r['NAMA_BARANG'] || r['DESKRIPSI'] || '').trim();

    // Lewati baris kosong tanpa FPB dan nama barang
    if (!noFpb && !namaBarang) continue;

    const fpbNoBarang = String(r['FPB+NO BARANG'] || '').trim();
    const poNoBarang = String(r['PO+NO BARANG'] || '').trim();
    const tglFpb = String(r['TGL FPB'] || r['TANGGAL FPB'] || '').trim();
    const noPo = String(r['NO. PO'] || r['NO PO'] || r['PO'] || '').trim();
    const tglPo = String(r['TGL PO'] || r['TANGGAL PO'] || '').trim();
    const noFstb = String(r['NO. FSTB'] || r['NO FSTB'] || r['FSTB'] || '').trim();
    const tglFstb = String(r['TGL FSTB'] || r['TANGGAL FSTB'] || '').trim();
    const noTtb = String(r['NO. TTB'] || r['NO TTB'] || r['TTB'] || '').trim();
    const tglTtb = String(r['TGL TTB'] || r['TANGGAL TTB'] || '').trim();

    const jmlFpb = Math.max(0, Number(r['JML FPB'] || r['QTY FPB']) || 0);
    const jmlPo = Math.max(0, Number(r['JML PO'] || r['QTY PO']) || 0);
    const jmlFstb = Math.max(0, Number(r['JML FSTB'] || r['QTY FSTB']) || 0);
    const jmlTtb = Math.max(0, Number(r['JML TTB'] || r['QTY TTB']) || 0);

    const satuan = String(r['SATUAN'] || '').trim();
    const keterangan = String(r['KETERANGAN'] || '').trim();
    const rawKategori = String(r['KATEGORI'] || '').trim();
    const kategori = rawKategori
      ? rawKategori.charAt(0).toUpperCase() + rawKategori.slice(1).toLowerCase()
      : 'General';

    let rawStatus = String(r['STATUS'] || '').trim().toUpperCase();
    if (!rawStatus) {
      if (noTtb || jmlTtb >= jmlFpb) rawStatus = 'CLOSE';
      else if (!noPo) rawStatus = 'OPEN';
      else if (noPo && !noTtb) rawStatus = 'BELUM TTB';
      else rawStatus = 'KURANG';
    }

    const departement = String(r['DEPARTEMENT'] || r['DEPARTEMEN'] || r['UNIT'] || r['ARMADA'] || '').trim();
    const pt = String(r['PT'] || r['ENTITAS'] || '').trim().toUpperCase();

    let rawPriority = String(r['PRIORITY'] || r['PRIORITAS'] || '').trim().toUpperCase();
    if (rawPriority.includes('P1')) rawPriority = 'P1';
    else if (rawPriority.includes('P2')) rawPriority = 'P2';
    else if (rawPriority.includes('P3')) rawPriority = 'P3';
    else if (!rawPriority) rawPriority = 'P3';

    const waktuProses = String(r['WAKTU PROSES'] || r['WAKTU_PROSES'] || '').trim();
    const linkFpb = String(r['LINK FPB'] || r['LINK_FPB'] || '').trim();

    // Selisih riil: kekurangan barang yang belum selesai diterima (FPB - TTB)
    const selisih = Math.max(0, jmlFpb - jmlTtb);

    items.push({
      id: `SL-${i + 1}`,
      fpbNoBarang,
      poNoBarang,
      noFpb,
      tglFpb,
      noPo,
      tglPo,
      noFstb,
      tglFstb,
      noTtb,
      tglTtb,
      kodeBarang,
      namaBarang,
      jmlFpb,
      jmlPo,
      jmlFstb,
      jmlTtb,
      selisih,
      satuan,
      keterangan,
      kategori,
      status: rawStatus,
      departement,
      pt,
      priority: rawPriority,
      waktuProses,
      linkFpb,
    });
  }

  const summary = calculateSisaLayananSummary(items);
  return { items, summary };
}

/**
 * Ekstraksi variasi kunci nomor FPB guna pencocokan data yang presisi
 */
export function extractFpbKeys(raw?: string | null): string[] {
  if (!raw) return [];
  const s = raw.trim();
  if (!s) return [];

  const keys = new Set<string>();
  keys.add(s.toLowerCase());

  const norm = normalizeFpbKey(s);
  if (norm) keys.add(norm);

  const matchCore = s.match(/\d{2}-\d{4,8}/);
  if (matchCore) keys.add(matchCore[0]);

  const matchNum = s.match(/\d{5,8}/);
  if (matchNum) keys.add(matchNum[0]);

  const alnum = s.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (alnum) keys.add(alnum);

  return Array.from(keys);
}

/**
 * Membangun indeks cepat Map (FPB -> SisaGoodsSummary) dari data Sisa Layanan Gabungan
 */
export function buildSisaLayananFpbMap(items: SisaLayananItem[]): Map<string, SisaGoodsSummary> {
  const map = new Map<string, SisaGoodsSummary>();
  if (!items || items.length === 0) return map;

  const fpbGroups = new Map<string, SisaLayananItem[]>();

  for (const it of items) {
    if (!it.noFpb && !it.fpbNoBarang) continue;
    const fpbIdentifier = (it.noFpb || '').trim();
    if (!fpbIdentifier) continue;

    const normPrimary = normalizeFpbKey(fpbIdentifier);
    if (!fpbGroups.has(normPrimary)) {
      fpbGroups.set(normPrimary, []);
    }
    fpbGroups.get(normPrimary)!.push(it);
  }

  fpbGroups.forEach((itemsInFpb, normPrimary) => {
    const allItems = itemsInFpb.map((r) => ({
      nama: (r.namaBarang || '').trim() || 'Item Tanpa Nama',
      qty: r.jmlFpb || r.jmlPo || 0,
      satuan: (r.satuan || '').trim(),
      kodeBarang: (r.kodeBarang || '').trim(),
      status: (r.status || '').trim(),
    }));

    const primaryName = allItems[0]?.nama || '-';
    const totalItemsCount = allItems.length;
    const firstQty = allItems[0]?.qty || 0;
    const firstSatuan = allItems[0]?.satuan || '';
    const qtyText = firstQty > 0 ? `${firstQty} ${firstSatuan}`.trim() : '';

    const totalQtyFpb = itemsInFpb.reduce((sum, r) => sum + (r.jmlFpb || 0), 0);
    const totalQtyPo = itemsInFpb.reduce((sum, r) => sum + (r.jmlPo || 0), 0);
    const totalQtyFstb = itemsInFpb.reduce((sum, r) => sum + (r.jmlFstb || 0), 0);
    const totalQtyTtb = itemsInFpb.reduce((sum, r) => sum + (r.jmlTtb || 0), 0);

    const tooltipLines = [
      `Data Barang Sisa Layanan (${totalItemsCount} Item):`,
      ...allItems.map(
        (it, idx) =>
          `${idx + 1}. ${it.nama}${it.qty > 0 ? ` (${it.qty} ${it.satuan})` : ''}${
            it.kodeBarang ? ` [${it.kodeBarang}]` : ''
          }${it.status ? ` - Status: ${it.status}` : ''}`
      ),
    ];
    const tooltipText = tooltipLines.join('\n');
    const allItemNames = allItems.map((i) => i.nama).join(' ');

    const summary: SisaGoodsSummary = {
      primaryName,
      totalItemsCount,
      qtyText,
      allItems,
      tooltipText,
      allItemNames,
      totalQtyFpb: totalQtyFpb > 0 ? totalQtyFpb : firstQty,
      totalQtyPo,
      totalQtyFstb,
      totalQtyTtb,
      primarySatuan: firstSatuan,
    };

    const rawSample = itemsInFpb[0].noFpb || normPrimary;
    const keys = extractFpbKeys(rawSample);
    for (const k of keys) {
      if (!map.has(k)) {
        map.set(k, summary);
      }
    }
    map.set(normPrimary, summary);
  });

  return map;
}

/**
 * Helper mencari kecocokan data barang Sisa Layanan berbasis nomor FPB
 */
export function findSisaMatch(
  fpb: string | undefined | null,
  map: Map<string, SisaGoodsSummary>
): SisaGoodsSummary | undefined {
  if (!fpb || !map || map.size === 0) return undefined;
  const keys = extractFpbKeys(fpb);
  for (const k of keys) {
    if (map.has(k)) {
      return map.get(k);
    }
  }
  return undefined;
}


