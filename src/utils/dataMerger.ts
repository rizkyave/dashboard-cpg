import { ProcurementItem, ArmadaItem, StatusTone } from '@/types/procurement';

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
 */
export function mergeProcurementDatasets(
  existingList: ProcurementItem[],
  incomingList: ProcurementItem[]
): {
  merged: ProcurementItem[];
  stats: { total: number; updated: number; added: number };
} {
  if (!existingList || existingList.length === 0) {
    return {
      merged: [...incomingList],
      stats: { total: incomingList.length, updated: 0, added: incomingList.length },
    };
  }
  if (!incomingList || incomingList.length === 0) {
    return {
      merged: [...existingList],
      stats: { total: existingList.length, updated: 0, added: 0 },
    };
  }

  const existingMap = new Map<string, number>();
  const mergedList: ProcurementItem[] = existingList.map((item, idx) => {
    const key = normalizeFpbKey(item.fpb);
    if (key) existingMap.set(key, idx);
    return { ...item };
  });

  let updatedCount = 0;
  const newItems: ProcurementItem[] = [];

  for (const incoming of incomingList) {
    const key = normalizeFpbKey(incoming.fpb);
    if (!key) {
      newItems.push(incoming);
      continue;
    }

    if (existingMap.has(key)) {
      const idx = existingMap.get(key)!;
      const target = mergedList[idx];

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

      // 4. Lengkapi FSTB, TTB, SPP dari Excel
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

      if (incoming.lapse && incoming.lapse > 0) {
        target.lapse = incoming.lapse;
      }

      updatedCount++;
    } else {
      // Item baru: tambahkan
      newItems.push(incoming);
      existingMap.set(key, mergedList.length + newItems.length - 1);
    }
  }

  // Gabungkan item baru di paling atas agar mudah terlihat
  const finalMerged = [...newItems, ...mergedList];

  return {
    merged: finalMerged,
    stats: {
      total: finalMerged.length,
      updated: updatedCount,
      added: newItems.length,
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
  if (!existingList || existingList.length === 0) {
    return {
      merged: [...incomingList],
      stats: { total: incomingList.length, updated: 0, added: incomingList.length },
    };
  }
  if (!incomingList || incomingList.length === 0) {
    return {
      merged: [...existingList],
      stats: { total: existingList.length, updated: 0, added: 0 },
    };
  }

  const existingMap = new Map<string, number>();
  const mergedList: ArmadaItem[] = existingList.map((item, idx) => {
    const key = `${normalizeFpbKey(item.fpb)}::${item.item?.trim().toLowerCase() || ''}`;
    existingMap.set(key, idx);
    return { ...item };
  });

  let updatedCount = 0;
  const newItems: ArmadaItem[] = [];

  for (const incoming of incomingList) {
    const key = `${normalizeFpbKey(incoming.fpb)}::${incoming.item?.trim().toLowerCase() || ''}`;
    const fpbOnlyKey = normalizeFpbKey(incoming.fpb);

    if (existingMap.has(key)) {
      const idx = existingMap.get(key)!;
      const target = mergedList[idx];

      if (!target.qtyFPB && incoming.qtyFPB) target.qtyFPB = incoming.qtyFPB;
      if (!target.qtyFSTB && incoming.qtyFSTB) target.qtyFSTB = incoming.qtyFSTB;
      if (incoming.selisih !== undefined) target.selisih = incoming.selisih;
      if (!hasValue(target.keterangan) && hasValue(incoming.keterangan)) {
        target.keterangan = incoming.keterangan;
      }
      if (incoming.statusCheckFpb === 'DONE') {
        target.statusCheckFpb = 'DONE';
        target.picCheckFpb = incoming.picCheckFpb || 'Logistik';
      }
      updatedCount++;
    } else {
      newItems.push(incoming);
      existingMap.set(key, mergedList.length + newItems.length - 1);
    }
  }

  const finalMerged = [...newItems, ...mergedList];

  return {
    merged: finalMerged,
    stats: {
      total: finalMerged.length,
      updated: updatedCount,
      added: newItems.length,
    },
  };
}
