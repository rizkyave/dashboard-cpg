import { ProcurementItem, ArmadaItem } from '@/types/procurement';

/**
 * Normalisasi format nomor FPB untuk pencocokan kunci unik
 * Contoh:
 *   "MO/LOG/FPB/26-0001751" -> "mo-fpb-26-0001751"
 *   "CPL-FPB-26-0004500"    -> "cpl-fpb-26-0004500"
 */
export function normalizeFpbKey(fpb?: string): string {
  if (!fpb) return '';
  return fpb
    .trim()
    .toLowerCase()
    .replace(/\/log\/fpb\//i, '-fpb-')
    .replace(/^([a-z0-9]+)-fpb-\1-fpb-/i, '$1-fpb-');
}

/**
 * Helper untuk menentukan apakah suatu nilai string memiliki isi yang bermakna
 * (bukan kosong, bukan '-', bukan '(kosong)', dll).
 */
function hasValue(val?: string | number | null): boolean {
  if (val === undefined || val === null) return false;
  const s = String(val).trim();
  return s !== '' && s !== '-' && s !== '(kosong)' && s.toLowerCase() !== 'null';
}

/**
 * Penggabungan cerdas (Smart Merge) dataset Procurement:
 * - Menjaga data yang sudah ada (tidak menghapus)
 * - Jika nomor FPB sama: memperkaya kolom yang kosong dari data yang baru masuk (Excel / e-FPB / Sheets)
 * - Jika nomor FPB baru: ditambahkan ke dalam antrean
 * - Aman dari duplicate FPB di incoming list (tidak menimbulkan out-of-bounds index error)
 */
export function mergeProcurementDatasets(
  existingList: ProcurementItem[],
  incomingList: ProcurementItem[]
): {
  merged: ProcurementItem[];
  stats: { total: number; updated: number; added: number };
} {
  const safeExisting = (existingList || []).filter(Boolean);
  const safeIncoming = (incomingList || []).filter(Boolean);

  if (safeExisting.length === 0) {
    // Deduplikasi incomingList berdasarkan nomor FPB agar bersih
    const dedupedMap = new Map<string, ProcurementItem>();
    const dedupedList: ProcurementItem[] = [];

    for (const item of safeIncoming) {
      const key = normalizeFpbKey(item.fpb);
      if (!key) {
        dedupedList.push({ ...item });
        continue;
      }
      if (dedupedMap.has(key)) {
        const target = dedupedMap.get(key)!;
        // Perkaya field target dari baris duplikat berikutnya
        if (!hasValue(target.po) && hasValue(item.po)) target.po = item.po;
        if (!hasValue(target.tglPo) && hasValue(item.tglPo)) target.tglPo = item.tglPo;
        if (!hasValue(target.noFstb) && hasValue(item.noFstb)) target.noFstb = item.noFstb;
        if (!hasValue(target.noTtb) && hasValue(item.noTtb)) target.noTtb = item.noTtb;
        if (!hasValue(target.tglTimLapKePicTtb) && hasValue(item.tglTimLapKePicTtb)) target.tglTimLapKePicTtb = item.tglTimLapKePicTtb;
        if (!hasValue(target.noSpp) && hasValue(item.noSpp)) target.noSpp = item.noSpp;
      } else {
        const copy = { ...item };
        dedupedMap.set(key, copy);
        dedupedList.push(copy);
      }
    }

    return {
      merged: dedupedList,
      stats: { total: dedupedList.length, updated: 0, added: dedupedList.length },
    };
  }

  if (safeIncoming.length === 0) {
    return {
      merged: safeExisting.map((item) => ({ ...item })),
      stats: { total: safeExisting.length, updated: 0, added: 0 },
    };
  }

  // Gunakan satu unified list untuk menghindari out-of-bounds indexing
  const existingMap = new Map<string, number>();
  const mergedList: ProcurementItem[] = [];

  for (const item of safeExisting) {
    const key = normalizeFpbKey(item.fpb);
    const idx = mergedList.length;
    mergedList.push({ ...item });
    if (key && !existingMap.has(key)) {
      existingMap.set(key, idx);
    }
  }

  let updatedCount = 0;
  let addedCount = 0;

  for (const incoming of safeIncoming) {
    if (!incoming) continue;
    const key = normalizeFpbKey(incoming.fpb);
    if (!key) {
      mergedList.push({ ...incoming });
      addedCount++;
      continue;
    }

    if (existingMap.has(key)) {
      const idx = existingMap.get(key)!;
      const target = mergedList[idx];
      if (!target) continue;

      // 1. Lengkapi PO jika data lama belum ada nomor PO
      if (!hasValue(target.po) && hasValue(incoming.po)) {
        target.po = incoming.po;
      }
      if (!hasValue(target.tglPo) && hasValue(incoming.tglPo)) {
        target.tglPo = incoming.tglPo;
      }

      // 2. Lengkapi Tanggal & Deskripsi Barang (gunakan yang lebih spesifik)
      if (!hasValue(target.date) && hasValue(incoming.date)) {
        target.date = incoming.date;
      }
      if (
        (!hasValue(target.item) || target.item.startsWith('Pengadaan Kebutuhan')) &&
        hasValue(incoming.item) &&
        !incoming.item.startsWith('Pengadaan Kebutuhan')
      ) {
        target.item = incoming.item;
      }
      if (!hasValue(target.peruntukan) && hasValue(incoming.peruntukan)) {
        target.peruntukan = incoming.peruntukan;
      }

      // 3. Lengkapi Armada & Entitas
      if (!hasValue(target.deptArmada) && hasValue(incoming.deptArmada)) {
        target.deptArmada = incoming.deptArmada;
      }
      if ((!hasValue(target.entity) || target.entity === 'CPL') && hasValue(incoming.entity)) {
        target.entity = incoming.entity;
      }

      // 4. Lengkapi FSTB, TTB, SPP dari Excel / Sheets
      if (!hasValue(target.noFstb) && hasValue(incoming.noFstb)) {
        target.noFstb = incoming.noFstb;
      }
      if (!hasValue(target.tglInputFstb) && hasValue(incoming.tglInputFstb)) {
        target.tglInputFstb = incoming.tglInputFstb;
      }
      if (!hasValue(target.tglKePicTtb) && hasValue(incoming.tglKePicTtb)) {
        target.tglKePicTtb = incoming.tglKePicTtb;
      }
      if (!hasValue(target.noTtb) && hasValue(incoming.noTtb)) {
        target.noTtb = incoming.noTtb;
      }
      if (!hasValue(target.tglInputTtb) && hasValue(incoming.tglInputTtb)) {
        target.tglInputTtb = incoming.tglInputTtb;
      }
      if (!hasValue(target.tglKeTimLapangan) && hasValue(incoming.tglKeTimLapangan)) {
        target.tglKeTimLapangan = incoming.tglKeTimLapangan;
      }
      if (!hasValue(target.tglBarangDiantar) && hasValue(incoming.tglBarangDiantar)) {
        target.tglBarangDiantar = incoming.tglBarangDiantar;
      }
      if (!hasValue(target.tglTimLapKePicTtb) && hasValue(incoming.tglTimLapKePicTtb)) {
        target.tglTimLapKePicTtb = incoming.tglTimLapKePicTtb;
      }
      if (!hasValue(target.tglTtbKePicPch) && hasValue(incoming.tglTtbKePicPch)) {
        target.tglTtbKePicPch = incoming.tglTtbKePicPch;
      }
      if (!hasValue(target.tglKeAdmPch) && hasValue(incoming.tglKeAdmPch)) {
        target.tglKeAdmPch = incoming.tglKeAdmPch;
      }
      if (!hasValue(target.noSpp) && hasValue(incoming.noSpp)) {
        target.noSpp = incoming.noSpp;
      }
      if (!hasValue(target.tglInputSpp) && hasValue(incoming.tglInputSpp)) {
        target.tglInputSpp = incoming.tglInputSpp;
      }
      if (!hasValue(target.tglKeKeuangan) && hasValue(incoming.tglKeKeuangan)) {
        target.tglKeKeuangan = incoming.tglKeKeuangan;
      }

      // 5. PIC Penanggung Jawab
      if (!hasValue(target.picPch) && hasValue(incoming.picPch)) {
        target.picPch = incoming.picPch;
      }
      if (!hasValue(target.picTtb) && hasValue(incoming.picTtb)) {
        target.picTtb = incoming.picTtb;
      }
      if (!hasValue(target.picLap) && hasValue(incoming.picLap)) {
        target.picLap = incoming.picLap;
      }
      if (!hasValue(target.picAdm) && hasValue(incoming.picAdm)) {
        target.picAdm = incoming.picAdm;
      }
      if (!hasValue(target.picAktif) && hasValue(incoming.picAktif)) {
        target.picAktif = incoming.picAktif;
      }

      // 6. Kuantitas dan Selisih
      if (!target.qtyFPB && incoming.qtyFPB) target.qtyFPB = incoming.qtyFPB;
      if (!target.qtyPO && incoming.qtyPO) target.qtyPO = incoming.qtyPO;
      if (!target.qtyFSTB && incoming.qtyFSTB) target.qtyFSTB = incoming.qtyFSTB;
      if (!target.qtyTTB && incoming.qtyTTB) target.qtyTTB = incoming.qtyTTB;
      if (incoming.selisih !== undefined && target.selisih === undefined) {
        target.selisih = incoming.selisih;
      }

      // 7. Status Verifikasi FPB (Pertahankan DONE jika salah satu sudah DONE)
      if (incoming.statusCheckFpb === 'DONE' || target.statusCheckFpb === 'DONE') {
        target.statusCheckFpb = 'DONE';
        if (!hasValue(target.picCheckFpb) || target.picCheckFpb === 'e-FPB Server') {
          target.picCheckFpb = incoming.picCheckFpb || target.picCheckFpb || 'Logistik';
        }
      }

      // 8. Status Badge & Workflow Tone
      if (hasValue(incoming.statusBadge) && incoming.statusBadge !== 'PROSES PENGADAAN') {
        target.statusBadge = incoming.statusBadge;
        target.statusTone = incoming.statusTone || target.statusTone;
        if (hasValue(incoming.statusPenjelasan)) {
          target.statusPenjelasan = incoming.statusPenjelasan;
        }
      }

      if (incoming.lapseText === 'TBC') {
        target.lapseText = 'TBC';
        target.lapse = 0;
      } else if (incoming.lapse !== undefined && incoming.lapse !== null) {
        target.lapse = incoming.lapse;
        target.lapseText = incoming.lapseText;
      }

      updatedCount++;
    } else {
      // Item baru: tambahkan langsung ke mergedList dan daftarkan ke existingMap
      const newIdx = mergedList.length;
      mergedList.push({ ...incoming });
      existingMap.set(key, newIdx);
      addedCount++;
    }
  }

  return {
    merged: mergedList,
    stats: {
      total: mergedList.length,
      updated: updatedCount,
      added: addedCount,
    },
  };
}

/**
 * Penggabungan cerdas dataset Armada:
 */
export function mergeArmadaDatasets(
  existingList: ArmadaItem[],
  incomingList: ArmadaItem[]
): {
  merged: ArmadaItem[];
  stats: { total: number; updated: number; added: number };
} {
  const safeExisting = (existingList || []).filter(Boolean);
  const safeIncoming = (incomingList || []).filter(Boolean);

  if (safeExisting.length === 0) {
    return {
      merged: safeIncoming.map((a) => ({ ...a })),
      stats: { total: safeIncoming.length, updated: 0, added: safeIncoming.length },
    };
  }
  if (safeIncoming.length === 0) {
    return {
      merged: safeExisting.map((a) => ({ ...a })),
      stats: { total: safeExisting.length, updated: 0, added: 0 },
    };
  }

  const existingMap = new Map<string, number>();
  const mergedList: ArmadaItem[] = [];

  for (const item of safeExisting) {
    const key = `${normalizeFpbKey(item.fpb)}::${item.item?.trim().toLowerCase() || ''}`;
    const idx = mergedList.length;
    mergedList.push({ ...item });
    if (!existingMap.has(key)) {
      existingMap.set(key, idx);
    }
  }

  let updatedCount = 0;
  let addedCount = 0;

  for (const incoming of safeIncoming) {
    if (!incoming) continue;
    const key = `${normalizeFpbKey(incoming.fpb)}::${incoming.item?.trim().toLowerCase() || ''}`;

    if (existingMap.has(key)) {
      const idx = existingMap.get(key)!;
      const target = mergedList[idx];
      if (!target) continue;

      if (!target.qtyFPB && incoming.qtyFPB) target.qtyFPB = incoming.qtyFPB;
      if (!target.qtyFSTB && incoming.qtyFSTB) target.qtyFSTB = incoming.qtyFSTB;
      if (incoming.selisih !== undefined) target.selisih = incoming.selisih;
      if (!hasValue(target.keterangan) && hasValue(incoming.keterangan)) {
        target.keterangan = incoming.keterangan;
      }
      if (!hasValue(target.tglTimLapKePicTtb) && hasValue(incoming.tglTimLapKePicTtb)) {
        target.tglTimLapKePicTtb = incoming.tglTimLapKePicTtb;
      }
      if (incoming.statusCheckFpb === 'DONE') {
        target.statusCheckFpb = 'DONE';
        target.picCheckFpb = incoming.picCheckFpb || 'Logistik';
      }
      if (incoming.lapseText === 'TBC') {
        target.lapseText = 'TBC';
        target.lapse = 0;
      } else if (incoming.lapse !== undefined && incoming.lapse !== null) {
        target.lapse = incoming.lapse;
        target.lapseText = incoming.lapseText;
      }
      updatedCount++;
    } else {
      const newIdx = mergedList.length;
      mergedList.push({ ...incoming });
      existingMap.set(key, newIdx);
      addedCount++;
    }
  }

  return {
    merged: mergedList,
    stats: {
      total: mergedList.length,
      updated: updatedCount,
      added: addedCount,
    },
  };
}
