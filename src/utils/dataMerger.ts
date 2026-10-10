import { ProcurementItem, ArmadaItem } from '@/types/procurement';
import { WorkOrderItem } from '@/types/workOrder';
import { evaluateTransactionStatus, hasValue } from '@/utils/statusWorkflow';

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
 * Validasi konsistensi status berkas secara menyeluruh:
 * Menggunakan evaluasi alur 4 modul supply chain sehingga statusBadge dan statusPenjelasan
 * selalu akurat 100% dan tidak pernah bertentangan dengan data aktual.
 */
export function sanitizeItemStatus(item: ProcurementItem): void {
  const result = evaluateTransactionStatus(item);
  item.statusBadge = result.statusBadge;
  item.statusTone = result.statusTone;
  item.statusPenjelasan = result.statusPenjelasan;
  if (!item.picAktif || item.picAktif === '-' || item.picAktif.includes('Input PO')) {
    item.picAktif = result.picAktif;
  }
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
        if (!hasValue(target.tglInputFstb) && hasValue(item.tglInputFstb)) target.tglInputFstb = item.tglInputFstb;
        if (!hasValue(target.noTtb) && hasValue(item.noTtb)) target.noTtb = item.noTtb;
        if (!hasValue(target.tglInputTtb) && hasValue(item.tglInputTtb)) target.tglInputTtb = item.tglInputTtb;
        if (!hasValue(target.tglTimLapKePicTtb) && hasValue(item.tglTimLapKePicTtb)) target.tglTimLapKePicTtb = item.tglTimLapKePicTtb;
        if (!hasValue(target.tglTtbKePicPch) && hasValue(item.tglTtbKePicPch)) target.tglTtbKePicPch = item.tglTtbKePicPch;
        if (!hasValue(target.tglKeAdmPch) && hasValue(item.tglKeAdmPch)) target.tglKeAdmPch = item.tglKeAdmPch;
        if (!hasValue(target.noSpp) && hasValue(item.noSpp)) target.noSpp = item.noSpp;
        if (!hasValue(target.tglInputSpp) && hasValue(item.tglInputSpp)) target.tglInputSpp = item.tglInputSpp;
        if (!hasValue(target.tglKeKeuangan) && hasValue(item.tglKeKeuangan)) target.tglKeKeuangan = item.tglKeKeuangan;
        if (!hasValue(target.picPch) && hasValue(item.picPch)) target.picPch = item.picPch;
        if (!hasValue(target.picTtb) && hasValue(item.picTtb)) target.picTtb = item.picTtb;
        if (!hasValue(target.picLap) && hasValue(item.picLap)) target.picLap = item.picLap;
        if (!hasValue(target.picAdm) && hasValue(item.picAdm)) target.picAdm = item.picAdm;
        if (!hasValue(target.workOrderNo) && hasValue(item.workOrderNo)) target.workOrderNo = item.workOrderNo;
        sanitizeItemStatus(target);
      } else {
        const copy = { ...item };
        sanitizeItemStatus(copy);
        dedupedMap.set(key, copy);
        dedupedList.push(copy);
      }
    }

    dedupedList.forEach(sanitizeItemStatus);
    return {
      merged: dedupedList,
      stats: { total: dedupedList.length, updated: 0, added: dedupedList.length },
    };
  }

  if (safeIncoming.length === 0) {
    const list = safeExisting.map((item) => {
      const copy = { ...item };
      sanitizeItemStatus(copy);
      return copy;
    });
    return {
      merged: list,
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
      if (!hasValue(target.workOrderNo) && hasValue(incoming.workOrderNo)) {
        target.workOrderNo = incoming.workOrderNo;
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
      if (!hasValue(target.sourceCheckFpb) && hasValue(incoming.sourceCheckFpb)) {
        target.sourceCheckFpb = incoming.sourceCheckFpb;
      }
      if (!hasValue(target.verifiedByFpb) && hasValue(incoming.verifiedByFpb)) {
        target.verifiedByFpb = incoming.verifiedByFpb;
      }

      // 8. Evaluasi Ulang Status Badge & Workflow Tone Berdasarkan Tahapan Terakhir
      if (incoming.lapseText === 'TBC') {
        target.lapseText = 'TBC';
        target.lapse = 0;
      } else if (incoming.lapse !== undefined && incoming.lapse !== null) {
        target.lapse = incoming.lapse;
        target.lapseText = incoming.lapseText;
      }

      sanitizeItemStatus(target);

      updatedCount++;
    } else {
      // Item baru: tambahkan langsung ke mergedList dan daftarkan ke existingMap
      const newIdx = mergedList.length;
      mergedList.push({ ...incoming });
      existingMap.set(key, newIdx);
      addedCount++;
    }
  }

  mergedList.forEach(sanitizeItemStatus);

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
      if (!hasValue(target.workOrderNo) && hasValue(incoming.workOrderNo)) {
        target.workOrderNo = incoming.workOrderNo;
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

/**
 * Buat map pencarian nomor Work Order dari WorkOrderItem[] berdasarkan nomor FPB
 */
export function buildWorkOrderMap(workOrderList: WorkOrderItem[] = []): {
  exactMap: Map<string, string>;
  numericMap: Map<string, string>;
} {
  const exactMap = new Map<string, string>();
  const numericMap = new Map<string, string>();

  for (const wo of workOrderList || []) {
    if (!hasValue(wo.nomerDokumen) || !hasValue(wo.noFpbMrp)) continue;
    const woNum = String(wo.nomerDokumen).trim();
    if (!woNum || woNum === '-' || woNum.toLowerCase() === 'null') continue;

    // Pisahkan FPB jika terdapat beberapa nomor dipisahkan koma, slash, titik koma, spasi, atau baris baru
    const tokens = String(wo.noFpbMrp)
      .split(/[\r\n,;|]+/)
      .map((s) => s.trim())
      .filter(Boolean);

    for (const token of tokens) {
      const key = normalizeFpbKey(token);
      if (key && !exactMap.has(key)) {
        exactMap.set(key, woNum);
      }

      // Regex mencari pola format FPB 2 digit tahun + tanda minus + 4-8 digit nomor (contoh: 26-0001751)
      const numMatches = token.match(/\b\d{2}-\d{4,8}\b/g);
      if (numMatches) {
        for (const nm of numMatches) {
          const lowerNm = nm.toLowerCase();
          if (!numericMap.has(lowerNm)) {
            numericMap.set(lowerNm, woNum);
          }
        }
      }
    }
  }

  return { exactMap, numericMap };
}

export function matchWorkOrderNo(
  fpbStr?: string,
  woMaps?: { exactMap: Map<string, string>; numericMap: Map<string, string> }
): string | undefined {
  if (!fpbStr || !woMaps) return undefined;
  const key = normalizeFpbKey(fpbStr);
  if (key && woMaps.exactMap.has(key)) {
    return woMaps.exactMap.get(key);
  }
  const numMatches = fpbStr.match(/\b\d{2}-\d{4,8}\b/g);
  if (numMatches) {
    for (const nm of numMatches) {
      const lowerNm = nm.toLowerCase();
      if (woMaps.numericMap.has(lowerNm)) {
        return woMaps.numericMap.get(lowerNm);
      }
    }
  }
  return undefined;
}

/**
 * Cross-Enrichment antara dataset Procurement dan dataset Armada, serta sinkronisasi Work Order:
 * Memastikan data saling melengkapi (nomor PO, tanggal PO, TTB, FSTB, pengantaran fisik, SPP, PIC, nomor WO)
 * dan seluruh status berkas terevaluasi konsisten 100% di semua tab tampilan.
 */
export function enrichProcurementAndArmada(
  procurementList: ProcurementItem[],
  armadaList: ArmadaItem[],
  workOrderList?: WorkOrderItem[]
): {
  procurement: ProcurementItem[];
  armada: ArmadaItem[];
} {
  const safeProc = (procurementList || []).map((p) => ({ ...p }));
  const safeArm = (armadaList || []).map((a) => ({ ...a }));
  const woMaps = workOrderList && workOrderList.length > 0 ? buildWorkOrderMap(workOrderList) : undefined;

  // Buat map pencarian armada berdasarkan FPB & PO
  const armMapByFpb = new Map<string, ArmadaItem[]>();
  const armMapByPo = new Map<string, ArmadaItem[]>();

  for (const arm of safeArm) {
    const fpbKey = normalizeFpbKey(arm.fpb);
    if (fpbKey) {
      if (!armMapByFpb.has(fpbKey)) armMapByFpb.set(fpbKey, []);
      armMapByFpb.get(fpbKey)!.push(arm);
    }
    const poKey = hasValue(arm.noPo) ? String(arm.noPo).trim().toLowerCase() : '';
    if (poKey) {
      if (!armMapByPo.has(poKey)) armMapByPo.set(poKey, []);
      armMapByPo.get(poKey)!.push(arm);
    }
  }

  // Buat map pencarian procurement berdasarkan FPB & PO
  const procMapByFpb = new Map<string, ProcurementItem>();
  const procMapByPo = new Map<string, ProcurementItem>();

  for (const proc of safeProc) {
    const fpbKey = normalizeFpbKey(proc.fpb);
    if (fpbKey && !procMapByFpb.has(fpbKey)) {
      procMapByFpb.set(fpbKey, proc);
    }
    const poKey = hasValue(proc.po) ? String(proc.po).trim().toLowerCase() : '';
    if (poKey && !procMapByPo.has(poKey)) {
      procMapByPo.set(poKey, proc);
    }
  }

  // 1. Lengkapi Procurement dari Armada
  for (const proc of safeProc) {
    const fpbKey = normalizeFpbKey(proc.fpb);
    const poKey = hasValue(proc.po) ? String(proc.po).trim().toLowerCase() : '';

    const matchedArmList =
      (fpbKey ? armMapByFpb.get(fpbKey) : undefined) ||
      (poKey ? armMapByPo.get(poKey) : undefined) ||
      [];

    for (const arm of matchedArmList) {
      if (!hasValue(proc.po) && hasValue(arm.noPo)) proc.po = String(arm.noPo);
      if (!hasValue(proc.tglPo) && hasValue(arm.tglPo)) proc.tglPo = String(arm.tglPo);
      if (!hasValue(proc.date) && hasValue(arm.tglPo)) proc.date = String(arm.tglPo);
      if (!hasValue(proc.noFstb) && hasValue(arm.noFstb)) proc.noFstb = String(arm.noFstb);
      if (!hasValue(proc.tglInputFstb) && hasValue(arm.tglFstb)) proc.tglInputFstb = String(arm.tglFstb);
      if (!hasValue(proc.noTtb) && hasValue(arm.noTtb)) proc.noTtb = String(arm.noTtb);
      if (!hasValue(proc.tglInputTtb) && hasValue(arm.tglTtb)) proc.tglInputTtb = String(arm.tglTtb);
      if (!hasValue(proc.tglTimLapKePicTtb) && hasValue(arm.tglTimLapKePicTtb)) proc.tglTimLapKePicTtb = String(arm.tglTimLapKePicTtb);
      if (!hasValue(proc.noSpp) && hasValue(arm.noSpp)) proc.noSpp = String(arm.noSpp);
      if (!hasValue(proc.tglKeKeuangan) && hasValue(arm.tglKeKeuangan)) proc.tglKeKeuangan = String(arm.tglKeKeuangan);
      if (!hasValue(proc.deptArmada) && hasValue(arm.armada)) proc.deptArmada = String(arm.armada);
      if (!hasValue(proc.picPch) && hasValue(arm.picPch)) proc.picPch = String(arm.picPch);
      if (!hasValue(proc.picTtb) && hasValue(arm.picTtb)) proc.picTtb = String(arm.picTtb);
      if (!hasValue(proc.picLap) && hasValue(arm.picLap)) proc.picLap = String(arm.picLap);
      if (!hasValue(proc.picAdm) && hasValue(arm.picAdm)) proc.picAdm = String(arm.picAdm);
      if (!hasValue(proc.workOrderNo) && hasValue(arm.workOrderNo)) proc.workOrderNo = String(arm.workOrderNo);
      if (arm.statusCheckFpb === 'DONE' && proc.statusCheckFpb !== 'DONE') {
        proc.statusCheckFpb = 'DONE';
        proc.picCheckFpb = arm.picCheckFpb || proc.picCheckFpb || 'Logistik';
      }
    }

    // Sinkronkan nomor WO dari Google Sheets jika belum terisi dari e-FPB / Armada
    if (!hasValue(proc.workOrderNo) && woMaps) {
      const matchedWo = matchWorkOrderNo(proc.fpb, woMaps);
      if (matchedWo) {
        proc.workOrderNo = matchedWo;
      }
    }

    sanitizeItemStatus(proc);
  }

  // 2. Lengkapi Armada dari Procurement
  for (const arm of safeArm) {
    const fpbKey = normalizeFpbKey(arm.fpb);
    const poKey = hasValue(arm.noPo) ? String(arm.noPo).trim().toLowerCase() : '';

    const matchedProc =
      (fpbKey ? procMapByFpb.get(fpbKey) : undefined) ||
      (poKey ? procMapByPo.get(poKey) : undefined);

    if (matchedProc) {
      if (!hasValue(arm.noPo) && hasValue(matchedProc.po)) arm.noPo = String(matchedProc.po);
      if (!hasValue(arm.tglPo) && hasValue(matchedProc.tglPo)) arm.tglPo = String(matchedProc.tglPo);
      if (!hasValue(arm.noFstb) && hasValue(matchedProc.noFstb)) arm.noFstb = String(matchedProc.noFstb);
      if (!hasValue(arm.tglFstb) && hasValue(matchedProc.tglInputFstb)) arm.tglFstb = String(matchedProc.tglInputFstb);
      if (!hasValue(arm.noTtb) && hasValue(matchedProc.noTtb)) arm.noTtb = String(matchedProc.noTtb);
      if (!hasValue(arm.tglTtb) && hasValue(matchedProc.tglInputTtb)) arm.tglTtb = String(matchedProc.tglInputTtb);
      if (!hasValue(arm.tglTimLapKePicTtb) && hasValue(matchedProc.tglTimLapKePicTtb)) arm.tglTimLapKePicTtb = String(matchedProc.tglTimLapKePicTtb);
      if (!hasValue(arm.noSpp) && hasValue(matchedProc.noSpp)) arm.noSpp = String(matchedProc.noSpp);
      if (!hasValue(arm.tglKeKeuangan) && hasValue(matchedProc.tglKeKeuangan)) arm.tglKeKeuangan = String(matchedProc.tglKeKeuangan);
      if (!hasValue(arm.picPch) && hasValue(matchedProc.picPch)) arm.picPch = String(matchedProc.picPch);
      if (!hasValue(arm.picTtb) && hasValue(matchedProc.picTtb)) arm.picTtb = String(matchedProc.picTtb);
      if (!hasValue(arm.picLap) && hasValue(matchedProc.picLap)) arm.picLap = String(matchedProc.picLap);
      if (!hasValue(arm.picAdm) && hasValue(matchedProc.picAdm)) arm.picAdm = String(matchedProc.picAdm);
      if (!hasValue(arm.workOrderNo) && hasValue(matchedProc.workOrderNo)) arm.workOrderNo = String(matchedProc.workOrderNo);
      if (matchedProc.statusCheckFpb === 'DONE' && arm.statusCheckFpb !== 'DONE') {
        arm.statusCheckFpb = 'DONE';
        arm.picCheckFpb = matchedProc.picCheckFpb || arm.picCheckFpb || 'Logistik';
      }

      // Selaraskan status badge & tone
      const evaluated = evaluateTransactionStatus({
        fpb: arm.fpb,
        po: arm.noPo,
        tglPo: arm.tglPo,
        noFstb: arm.noFstb,
        tglFstb: arm.tglFstb,
        noTtb: arm.noTtb,
        tglTtb: arm.tglTtb,
        tglTimLapKePicTtb: arm.tglTimLapKePicTtb,
        noSpp: arm.noSpp,
        tglKeKeuangan: arm.tglKeKeuangan,
        picPch: arm.picPch,
        picTtb: arm.picTtb,
        picLap: arm.picLap,
        picAdm: arm.picAdm,
        lapse: arm.lapse,
        lapseText: arm.lapseText,
        statusArmada: arm.status,
      });

      arm.statusBadge = evaluated.statusBadge;
      arm.statusTone = evaluated.statusTone;
      if (!arm.picAktif || arm.picAktif === '-') arm.picAktif = evaluated.picAktif;
    }

    // Sinkronkan nomor WO dari Google Sheets jika armada belum memiliki workOrderNo
    if (!hasValue(arm.workOrderNo) && woMaps) {
      const matchedWo = matchWorkOrderNo(arm.fpb, woMaps);
      if (matchedWo) {
        arm.workOrderNo = matchedWo;
      }
    }
  }

  return {
    procurement: safeProc,
    armada: safeArm,
  };
}
