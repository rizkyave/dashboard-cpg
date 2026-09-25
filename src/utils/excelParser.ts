import * as XLSX from 'xlsx';
import { ProcurementItem, ArmadaItem, StatusTone } from '@/types/procurement';

// Helper: Convert Excel date / serial date number to YYYY-MM-DD string
export const excelDateToString = (val: any): string => {
  if (!val && val !== 0) return '';
  if (typeof val === 'string') {
    const trimmed = val.trim();
    if (!trimmed) return '';
    // Format DD/MM/YYYY
    if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(trimmed)) {
      const parts = trimmed.split('/');
      const d = parts[0].padStart(2, '0');
      const m = parts[1].padStart(2, '0');
      const y = parts[2];
      return `${y}-${m}-${d}`;
    }
    // Format YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) return trimmed.slice(0, 10);
    // Format YYYY/MM/DD
    if (/^\d{4}\/\d{1,2}\/\d{1,2}/.test(trimmed)) {
      const parts = trimmed.split('/');
      const y = parts[0];
      const m = parts[1].padStart(2, '0');
      const d = parts[2].padStart(2, '0');
      return `${y}-${m}-${d}`;
    }
    return trimmed;
  }
  // Excel serial date number
  if (typeof val === 'number' && val > 10000 && val < 100000) {
    const utcDays = Math.floor(val) - 25569;
    const date = new Date(utcDays * 86400 * 1000);
    const y = date.getUTCFullYear();
    const m = String(date.getUTCMonth() + 1).padStart(2, '0');
    const d = String(date.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  return String(val);
};

// Helper: Build column index map from header row
export const buildColumnMap = (headerRow: any[]): Record<string, number> => {
  const map: Record<string, number> = {};
  if (!headerRow) return map;
  headerRow.forEach((cell, idx) => {
    const h = String(cell || '').trim().toUpperCase();
    if (h) map[h] = idx;
  });
  return map;
};

// Helper: Find column index by exact or partial header match
export const findCol = (colMap: Record<string, number>, ...patterns: string[]): number => {
  for (const pattern of patterns) {
    const pUpper = pattern.toUpperCase();
    if (colMap[pUpper] !== undefined) return colMap[pUpper];
    for (const [key, idx] of Object.entries(colMap)) {
      if (key.includes(pUpper)) return idx;
    }
  }
  return -1;
};

const normalizeKey = (val: any): string => {
  return String(val || '').trim().toUpperCase();
};

export interface MergedExcelResult {
  procurement: ProcurementItem[];
  armada: ArmadaItem[];
  stats: {
    totalMlaRows: number;
    totalProcRows: number;
    totalBuNoorRows: number;
    totalCheckFpbRows?: number;
    matchedMlaCount: number;
    unmatchedProcAppended: number;
    totalMergedProcurement: number;
    totalArmadaItems: number;
  };
}

/**
 * Parses an Excel workbook and merges data using
 * "Monitoring Layanan Armada" as the PRIMARY reference (acuan utama),
 * enriched with workflow tracking from "PROCUREMENT" and "CHECK FPB / Master Data Bu Noor".
 */
export function parseAndMergeWorkbook(workbook: XLSX.WorkBook): MergedExcelResult {
  // 1. Identify sheet names
  const mlaSheetName = workbook.SheetNames.find((n) => {
    const up = n.toUpperCase();
    return up.includes('MONITORING LAYANAN') || (up.includes('LAYANAN') && up.includes('ARMADA')) || up.includes('ARMADA');
  });

  const procSheetName = workbook.SheetNames.find((n) => {
    const up = n.toUpperCase();
    return up.includes('PROCUREMENT') || up.includes('PCH') || up.includes('PENGADAAN');
  });

  const checkFpbSheetName = workbook.SheetNames.find((n) => {
    const up = n.toUpperCase();
    return (
      up.includes('CHECK FPB') ||
      up.includes('FPB CHECK') ||
      up.includes('FBP CHECK') ||
      up.includes('CHECK FBP') ||
      up.includes('BU NOOR') ||
      up.includes('NOOR') ||
      up.includes('VERIFIKASI FPB') ||
      (up.includes('CHECK') && (up.includes('FPB') || up.includes('FBP')))
    );
  });
  const buNoorSheetName = checkFpbSheetName;

  // 2. Index "PROCUREMENT" sheet
  interface ProcRecord {
    rowIdx: number;
    picPch: string;
    pt: string;
    armada: string;
    fpb: string;
    po: string;
    tglPo: string;
    deliveryTime: string;
    fstb: string;
    tglFstb: string;
    tglKePicTtb: string;
    waktuKePicTtb: string;
    ket1: string;
    lapseProc?: number;
    picTtb: string;
    ttb: string;
    tglTtb: string;
    tglKeTimLap: string;
    picLap: string;
    tglDiantar: string;
    tglTimLapKePicTtb: string;
    tglTtbKePicPch: string;
    tglKeAdmPch: string;
    picAdm: string;
    spp: string;
    tglSpp: string;
    tglKeu: string;
    rawRow: any[];
  }

  const procByPo = new Map<string, ProcRecord>();
  const procByFpb = new Map<string, ProcRecord>();
  const allProcRecords: ProcRecord[] = [];
  const matchedProcRowIndexes = new Set<number>();

  if (procSheetName && workbook.Sheets[procSheetName]) {
    const ws = workbook.Sheets[procSheetName];
    const json: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

    let headerRowIdx = 1;
    for (let r = 0; r < Math.min(json.length, 6); r++) {
      const rowText = (json[r] || []).map(String).join('|').toUpperCase();
      if (rowText.includes('NO. FPB') || rowText.includes('PIC PCH') || rowText.includes('NO. PO')) {
        headerRowIdx = r;
        break;
      }
    }

    const colMap = buildColumnMap(json[headerRowIdx] || []);
    const cPicPch    = findCol(colMap, 'PIC PCH');
    const cPT        = findCol(colMap, 'PT');
    const cDeptArm   = findCol(colMap, 'DEPT/ ARMADA', 'DEPT/ARMADA', 'ARMADA');
    const cFPB       = findCol(colMap, 'NO. FPB');
    const cPO        = findCol(colMap, 'NO. PO');
    const cTglPO     = findCol(colMap, 'TANGGAL  INPUT PO', 'TANGGAL INPUT PO', 'TGL PO');
    const cDelivery  = findCol(colMap, 'DELIVERY TIME', 'DELIVERY');
    const cFSTB      = findCol(colMap, 'NO. FSTB');
    const cTglFSTB   = findCol(colMap, 'TANGGAL INPUT FSTB', 'TGL FSTB');
    const cTglPicTtb = findCol(colMap, 'TANGGAL KE PIC TTB');
    const cWaktuPicTtb = findCol(colMap, 'WAKTU KE PIC TTB');
    const cKet1      = findCol(colMap, 'KETERANGAN');
    const cPicTtb    = findCol(colMap, 'PIC TTB');
    const cTTB       = findCol(colMap, 'TTB');
    const cTglTTB    = findCol(colMap, 'TANGGAL  INPUT TTB', 'TANGGAL INPUT TTB');
    const cTglTimLap = findCol(colMap, 'TANGGAL KE TIM LAPANGAN');
    const cPicLap    = findCol(colMap, 'PIC LAPANGAN');
    const cTglDiantar = findCol(colMap, 'TANGGAL BARANG DI DIANTAR');
    const cTglTimLapKePicTtb = findCol(colMap, 'TANGGAL TIM LAP KE PIC TTB');
    const cTglTtbPch = findCol(colMap, 'TANGGAL TTB KE PIC PCH');
    const cTglAdmPch = findCol(colMap, 'TANGGAL KE ADM PCH');
    const cPicAdm    = findCol(colMap, 'PIC ADM PCH');
    const cSPP       = findCol(colMap, 'NO. SPP');
    const cTglSPP    = findCol(colMap, 'TANGGAL INPUT SPP');
    const cTglKeu    = findCol(colMap, 'TANGGAL KE KEUANGAN');

    const lapseCols: number[] = [];
    (json[headerRowIdx] || []).forEach((cell: any, idx: number) => {
      if (String(cell || '').trim().toUpperCase() === 'LAPSE DAY') {
        lapseCols.push(idx);
      }
    });
    const cLapse = lapseCols.length > 0 ? lapseCols[0] : -1;

    for (let i = headerRowIdx + 1; i < json.length; i++) {
      const r = json[i];
      if (!r || r.length === 0) continue;

      const fpb = String(cFPB >= 0 ? r[cFPB] : r[4] || '').trim();
      const po = String(cPO >= 0 ? r[cPO] : r[5] || '').trim();
      if (!fpb && !po) continue;

      const rawLapse = cLapse >= 0 ? r[cLapse] : '';
      const lapseProc =
        typeof rawLapse === 'number'
          ? Math.abs(Math.round(rawLapse))
          : rawLapse !== ''
          ? Math.abs(parseInt(String(rawLapse)) || 0)
          : undefined;

      const record: ProcRecord = {
        rowIdx: i,
        picPch: String(cPicPch >= 0 ? r[cPicPch] : '').trim(),
        pt: String(cPT >= 0 ? r[cPT] : '').trim().toUpperCase(),
        armada: String(cDeptArm >= 0 ? r[cDeptArm] : '').trim(),
        fpb,
        po,
        tglPo: excelDateToString(cTglPO >= 0 ? r[cTglPO] : ''),
        deliveryTime: String(cDelivery >= 0 ? r[cDelivery] : '').trim(),
        fstb: String(cFSTB >= 0 ? r[cFSTB] : '').trim(),
        tglFstb: excelDateToString(cTglFSTB >= 0 ? r[cTglFSTB] : ''),
        tglKePicTtb: excelDateToString(cTglPicTtb >= 0 ? r[cTglPicTtb] : ''),
        waktuKePicTtb: String(cWaktuPicTtb >= 0 ? r[cWaktuPicTtb] : '').trim(),
        ket1: String(cKet1 >= 0 ? r[cKet1] : '').trim(),
        lapseProc,
        picTtb: String(cPicTtb >= 0 ? r[cPicTtb] : '').trim(),
        ttb: String(cTTB >= 0 ? r[cTTB] : '').trim(),
        tglTtb: excelDateToString(cTglTTB >= 0 ? r[cTglTTB] : ''),
        tglKeTimLap: excelDateToString(cTglTimLap >= 0 ? r[cTglTimLap] : ''),
        picLap: String(cPicLap >= 0 ? r[cPicLap] : '').trim(),
        tglDiantar: excelDateToString(cTglDiantar >= 0 ? r[cTglDiantar] : ''),
        tglTimLapKePicTtb: excelDateToString(cTglTimLapKePicTtb >= 0 ? r[cTglTimLapKePicTtb] : ''),
        tglTtbKePicPch: excelDateToString(cTglTtbPch >= 0 ? r[cTglTtbPch] : ''),
        tglKeAdmPch: excelDateToString(cTglAdmPch >= 0 ? r[cTglAdmPch] : ''),
        picAdm: String(cPicAdm >= 0 ? r[cPicAdm] : '').trim(),
        spp: String(cSPP >= 0 ? r[cSPP] : '').trim(),
        tglSpp: excelDateToString(cTglSPP >= 0 ? r[cTglSPP] : ''),
        tglKeu: excelDateToString(cTglKeu >= 0 ? r[cTglKeu] : ''),
        rawRow: r,
      };

      allProcRecords.push(record);

      if (po && po !== '-') {
        procByPo.set(normalizeKey(po), record);
      }
      if (fpb && !procByFpb.has(normalizeKey(fpb))) {
        procByFpb.set(normalizeKey(fpb), record);
      }
    }
  }

  // 3. Index "Check FPB / Master Data Bu Noor" (Divisi 1: Verifikasi FPB)
  interface CheckFpbRecord {
    fpb: string;
    pic: string;
    armada: string;
    tglFpb: string;
    tglCek: string;
    statusCek: string;
    tglApprove: string;
    done: string;
    note: string;
  }
  const checkFpbMap = new Map<string, CheckFpbRecord>();

  if (checkFpbSheetName && workbook.Sheets[checkFpbSheetName]) {
    const ws = workbook.Sheets[checkFpbSheetName];
    const json: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

    let headerRowIdx = 0;
    for (let r = 0; r < Math.min(json.length, 10); r++) {
      const rowText = (json[r] || []).map(String).join('|').toUpperCase();
      if (
        rowText.includes('NO FPB') ||
        rowText.includes('NO. FPB') ||
        rowText.includes('TGL CEK') ||
        rowText.includes('STATUS CEK')
      ) {
        headerRowIdx = r;
        break;
      }
    }

    const colMap = buildColumnMap(json[headerRowIdx] || []);
    const cFPB       = findCol(colMap, 'NO. FPB', 'NO FPB', 'NOMOR FPB', 'FPB');
    const cTglFPB    = findCol(colMap, 'TGL FPB', 'TANGGAL FPB');
    const cPIC       = findCol(colMap, 'REQUESTED BY', 'REQUESTED', 'PEMOHON', 'USER', 'PIC', 'VERIFIKATOR', 'CHECKER');
    const cArmada    = findCol(colMap, 'ARMADA', 'KAPAL', 'DEPT');
    const cTglCek    = findCol(colMap, 'TGL CEK', 'TANGGAL CEK');
    const cStatusCek = findCol(colMap, 'STATUS CEK', 'STATUS');
    const cTglAppr   = findCol(colMap, 'TGL APPROVE WEB', 'TGL APPROVE', 'APPROVE WEB');
    const cDone      = findCol(colMap, 'DONE', 'STATUS DONE');
    const cNote      = findCol(colMap, 'NOTE', 'CATATAN', 'KETERANGAN');

    for (let i = headerRowIdx + 1; i < json.length; i++) {
      const r = json[i];
      if (!r || r.length === 0) continue;
      const fpb = String(cFPB >= 0 ? r[cFPB] : r[1] || '').trim();
      if (!fpb) continue;

      let pic = String(cPIC >= 0 ? r[cPIC] : '').trim();
      const rawNote = String(cNote >= 0 ? r[cNote] : '').trim();
      if (!pic && rawNote) {
        const match = rawNote.match(/^([A-Za-z]+)/);
        if (match && match[1] && match[1].length >= 3) {
          pic = match[1].toUpperCase();
        }
      }
      if (!pic) {
        pic = 'Bu Noor';
      }

      checkFpbMap.set(normalizeKey(fpb), {
        fpb,
        pic,
        armada: String(cArmada >= 0 ? r[cArmada] : '').trim(),
        tglFpb: excelDateToString(cTglFPB >= 0 ? r[cTglFPB] : ''),
        tglCek: excelDateToString(cTglCek >= 0 ? r[cTglCek] : ''),
        statusCek: String(cStatusCek >= 0 ? r[cStatusCek] : '').trim(),
        tglApprove: excelDateToString(cTglAppr >= 0 ? r[cTglAppr] : ''),
        done: String(cDone >= 0 ? r[cDone] : '').trim(),
        note: rawNote,
      });
    }
  }

  const buNoorMap = checkFpbMap;

  // 4. MAIN PROCESS: Parse "Monitoring Layanan Armada" as PRIMARY REFERENCE
  const importedProcurement: ProcurementItem[] = [];
  const importedArmada: ArmadaItem[] = [];

  let totalMlaRows = 0;
  let matchedMlaCount = 0;

  if (mlaSheetName && workbook.Sheets[mlaSheetName]) {
    const ws = workbook.Sheets[mlaSheetName];
    const json: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

    let headerRowIdx = 0;
    for (let r = 0; r < Math.min(json.length, 10); r++) {
      const rowText = (json[r] || []).map(String).join('|').toUpperCase();
      if (
        (rowText.includes('NO. FPB') || rowText.includes('NO FPB')) &&
        (rowText.includes('NAMA BARANG') || rowText.includes('KETERANGAN') || rowText.includes('BARANG'))
      ) {
        headerRowIdx = r;
        break;
      }
    }

    const colMap = buildColumnMap(json[headerRowIdx] || []);
    const dataStartRow = headerRowIdx + 1;

    const aFPB       = findCol(colMap, 'NO. FPB');
    const aTglFPB    = findCol(colMap, 'TGL FPB');
    const aPO        = findCol(colMap, 'NO. PO');
    const aTglPO     = findCol(colMap, 'TGL PO');
    const aFSTB      = findCol(colMap, 'NO. FSTB');
    const aTglFSTB   = findCol(colMap, 'TGL FSTB');
    const aTTB       = findCol(colMap, 'NO. TTB');
    const aTglTTB    = findCol(colMap, 'TGL TTB');
    const aKode      = findCol(colMap, 'KODE BARANG');
    const aNama      = findCol(colMap, 'NAMA BARANG');
    const aJmlFPB    = findCol(colMap, 'JML FPB', 'QTY FPB', 'JUMLAH FPB', 'JML. FPB', 'QTY. FPB');
    const aJmlPO     = findCol(colMap, 'JML PO', 'QTY PO', 'JUMLAH PO', 'JML. PO', 'QTY. PO');
    const aJmlFSTB   = findCol(colMap, 'JML FSTB', 'QTY FSTB', 'JUMLAH FSTB', 'JML. FSTB', 'QTY. FSTB');
    const aJmlTTB    = findCol(colMap, 'JML TTB', 'QTY TTB', 'JUMLAH TTB', 'JML. TTB', 'QTY. TTB');
    const aSatuan    = findCol(colMap, 'SATUAN', 'UOM', 'UNIT');
    const aKet       = findCol(colMap, 'KETERANGAN');
    const aKat       = findCol(colMap, 'KATEGORI');
    const aStatus    = findCol(colMap, 'STATUS');
    const aDept      = findCol(
      colMap,
      'ARMADA',
      'NAMA KAPAL',
      'KAPAL',
      'DEPT/ ARMADA',
      'DEPT/ARMADA',
      'DEPT / ARMADA',
      'DEPARTEMENT',
      'DEPARTEMEN',
      'DEPARTMENT',
      'UNIT ARMADA',
      'UNIT',
      'DEPT'
    );
    const aPT        = findCol(colMap, 'PT');
    const aPriority  = findCol(colMap, 'PRIORITY');
    const aWaktu     = findCol(colMap, 'WAKTU PROSES');

    for (let i = dataStartRow; i < json.length; i++) {
      const r = json[i];
      if (!r || r.length === 0) continue;

      const fpb = String(aFPB >= 0 ? r[aFPB] : r[0] || '').trim();
      if (!fpb || !fpb.toUpperCase().includes('FPB')) continue;

      totalMlaRows++;

      let tglFpb = excelDateToString(aTglFPB >= 0 ? r[aTglFPB] : '');
      const po = String(aPO >= 0 ? r[aPO] : '').trim();
      const tglPo = excelDateToString(aTglPO >= 0 ? r[aTglPO] : '');
      const fstbMla = String(aFSTB >= 0 ? r[aFSTB] : '').trim();
      const tglFstbMla = excelDateToString(aTglFSTB >= 0 ? r[aTglFSTB] : '');
      const ttbMla = String(aTTB >= 0 ? r[aTTB] : '').trim();
      const tglTtbMla = excelDateToString(aTglTTB >= 0 ? r[aTglTTB] : '');

      const kodeBarang = String(aKode >= 0 ? r[aKode] : '').trim();
      const namaBarang = String(aNama >= 0 ? r[aNama] : '').trim() || 'Item Operasional';
      const rawJmlFPB = aJmlFPB >= 0 ? r[aJmlFPB] : '';
      const rawJmlPO = aJmlPO >= 0 ? r[aJmlPO] : '';
      const rawJmlFSTB = aJmlFSTB >= 0 ? r[aJmlFSTB] : '';
      const rawJmlTTB = aJmlTTB >= 0 ? r[aJmlTTB] : '';

      const qtyFPB = Number(rawJmlFPB) || 0;
      const qtyPO =
        rawJmlPO !== '' && rawJmlPO !== null && rawJmlPO !== undefined
          ? Number(rawJmlPO) || 0
          : po && po !== '-'
          ? qtyFPB
          : 0;
      const qtyFSTB = Number(rawJmlFSTB) || 0;
      const qtyTTB =
        rawJmlTTB !== '' && rawJmlTTB !== null && rawJmlTTB !== undefined
          ? Number(rawJmlTTB) || 0
          : ttbMla
          ? qtyFSTB
          : 0;
      const selisih = Math.max(0, qtyFPB - qtyFSTB);
      const satuan = String(aSatuan >= 0 ? r[aSatuan] : '').trim();
      const keterangan = String(aKet >= 0 ? r[aKet] : '').trim();
      const kategori = String(aKat >= 0 ? r[aKat] : '').trim();
      const rawStatus = String(aStatus >= 0 ? r[aStatus] : '').trim().toUpperCase();
      const rawDept = String(aDept >= 0 ? r[aDept] : '').trim();
      const entity = String(aPT >= 0 ? r[aPT] : '').trim().toUpperCase() || 'CPL';
      const priority = String(aPriority >= 0 ? r[aPriority] : '').trim();
      const waktuProses = String(aWaktu >= 0 ? r[aWaktu] : '').trim();

      const normPo = normalizeKey(po);
      const normFpb = normalizeKey(fpb);

      let pMatch: ProcRecord | undefined = undefined;
      if (normPo && normPo !== '-') {
        pMatch = procByPo.get(normPo);
      }
      if (!pMatch && normFpb) {
        pMatch = procByFpb.get(normFpb);
      }

      if (pMatch) {
        matchedMlaCount++;
        matchedProcRowIndexes.add(pMatch.rowIdx);
      }

      const cfMatch = normFpb ? checkFpbMap.get(normFpb) : undefined;
      const bnMatch = cfMatch;

      const picCheckFpb = cfMatch?.pic || (cfMatch ? 'Bu Noor' : '-');
      const tglCheckFpb = cfMatch?.tglCek || '';
      const statusCheckFpb = cfMatch?.statusCek || (cfMatch?.done ? 'DONE' : '');
      const tglApproveWeb = cfMatch?.tglApprove || '';
      const noteCheckFpb = cfMatch?.note || '';
      const doneCheckFpb = cfMatch?.done || '';

      if (!tglFpb && cfMatch?.tglFpb) {
        tglFpb = cfMatch.tglFpb;
      }

      const picPch = pMatch?.picPch || '-';
      const picTtb = pMatch?.picTtb || '-';
      const picLap = pMatch?.picLap || '-';
      const picAdm = pMatch?.picAdm || '-';
      const deliveryTime = pMatch?.deliveryTime || '';
      const noFstb = fstbMla || pMatch?.fstb || '';
      const tglInputFstb = tglFstbMla || pMatch?.tglFstb || '';
      const noTtb = ttbMla || pMatch?.ttb || '';
      const tglInputTtb = tglTtbMla || pMatch?.tglTtb || '';
      const tglKePicTtb = pMatch?.tglKePicTtb || '';
      const tglKeTimLapangan = pMatch?.tglKeTimLap || '';
      const tglBarangDiantar = pMatch?.tglDiantar || '';
      const tglTtbKePicPch = pMatch?.tglTtbKePicPch || '';
      const tglKeAdmPch = pMatch?.tglKeAdmPch || '';
      const noSpp = pMatch?.spp || '';
      const tglInputSpp = pMatch?.tglSpp || '';
      const tglKeKeuangan = pMatch?.tglKeu || '';

      const deptArmada =
        rawDept ||
        pMatch?.armada ||
        bnMatch?.armada ||
        (entity ? `Unit Armada ${entity}` : 'Armada Operasional');

      let statusBadge = 'PROSES ADM PURCHASING';
      let statusTone: StatusTone = 'cyan';
      let statusPenjelasan = '';

      if (tglKeKeuangan) {
        statusBadge = 'SELESAI DI KEUANGAN';
        statusTone = 'emerald';
        statusPenjelasan = `Berkas sudah di Keuangan pada ${tglKeKeuangan}`;
      } else if (noSpp || tglInputSpp) {
        statusBadge = 'PROSES SPP';
        statusTone = 'emerald';
        statusPenjelasan = `SPP ${noSpp || ''} diterbitkan ${tglInputSpp || '-'}`;
      } else if (tglKeAdmPch) {
        statusBadge = 'PROSES ADM PURCHASING';
        statusTone = 'cyan';
        statusPenjelasan = `Berkas diteruskan ke ADM PCH pada ${tglKeAdmPch}`;
      } else if (tglTtbKePicPch) {
        statusBadge = 'TTB KE PIC PCH';
        statusTone = 'purple';
        statusPenjelasan = `TTB kembali ke PIC PCH pada ${tglTtbKePicPch}`;
      } else if (tglBarangDiantar) {
        statusBadge = 'DIANTAR KE LAPANGAN';
        statusTone = 'amber';
        statusPenjelasan = `Barang telah diantar ke lapangan pada ${tglBarangDiantar}`;
      } else if (tglKeTimLapangan) {
        statusBadge = 'MENUNGGU DISTRIBUSI LAPANGAN';
        statusTone = 'amber';
        statusPenjelasan = `Diteruskan ke tim lapangan pada ${tglKeTimLapangan}`;
      } else if (noTtb || tglInputTtb) {
        statusBadge = 'VALIDASI LOGISTIK TTB';
        statusTone = 'purple';
        statusPenjelasan = `TTB ${noTtb} divalidasi logistik (${tglInputTtb || '-'})`;
      } else if (tglKePicTtb) {
        statusBadge = 'MENUNGGU PIC TTB';
        statusTone = 'purple';
        statusPenjelasan = `Menunggu proses PIC TTB sejak ${tglKePicTtb}`;
      } else if (noFstb || tglInputFstb) {
        statusBadge = 'PROSES FSTB';
        statusTone = 'cyan';
        statusPenjelasan = `FSTB ${noFstb} diterbitkan (${tglInputFstb || '-'})`;
      } else if (rawStatus === 'CLOSE') {
        statusBadge = 'SELESAI (CLOSE)';
        statusTone = 'emerald';
        statusPenjelasan = 'Layanan armada dan pemenuhan barang selesai (CLOSE)';
      } else if (po && po !== '-') {
        statusBadge = 'MENUNGGU FSTB';
        statusTone = 'cyan';
        statusPenjelasan = `PO ${po} terbit (${tglPo || '-'}), menunggu FSTB`;
      } else {
        statusBadge = 'MENUNGGU PO';
        statusTone = 'rose';
        statusPenjelasan = `FPB ${fpb} diajukan (${tglFpb || '-'}), PO belum terbit`;
      }

      let lapse = 0;
      if (pMatch?.lapseProc !== undefined && pMatch.lapseProc !== null) {
        lapse = pMatch.lapseProc;
      } else if (waktuProses) {
        const match = waktuProses.match(/\d+/);
        if (match) lapse = parseInt(match[0]);
      } else if (statusTone !== 'emerald' && (tglPo || tglFpb)) {
        const refDate = new Date(tglPo || tglFpb).getTime();
        if (!isNaN(refDate)) {
          const diffDays = Math.floor((Date.now() - refDate) / (1000 * 60 * 60 * 24));
          if (diffDays > 0) lapse = Math.min(diffDays, 365);
        }
      }

      if (lapse > 5 && statusTone !== 'emerald') {
        statusTone = 'rose';
      }

      let picAktif = `${picPch} (Purchasing)`;
      if (statusBadge.includes('KEUANGAN') || statusBadge.includes('SPP')) {
        picAktif = `${picAdm && picAdm !== '-' ? picAdm : picPch} (ADM/Finance)`;
      } else if (statusBadge.includes('LAPANGAN') || statusBadge.includes('DISTRIBUSI')) {
        picAktif = `${picLap && picLap !== '-' ? picLap : 'Tim Lapangan'} (Lapangan)`;
      } else if (statusBadge.includes('TTB') || statusBadge.includes('LOGISTIK')) {
        picAktif = `${picTtb && picTtb !== '-' ? picTtb : 'Davila/Fifi'} (Logistik)`;
      } else if (statusBadge.includes('ADM')) {
        picAktif = `${picAdm && picAdm !== '-' ? picAdm : 'Eka'} (ADM PCH)`;
      } else if (statusBadge.includes('MENUNGGU PO')) {
        picAktif = `${picPch && picPch !== '-' ? picPch : 'Input PO'} (Purchasing)`;
      }

      const peruntukan = keterangan || (bnMatch?.note ? `Note: ${bnMatch.note}` : '');

      const recordId = `${fpb}-${po || 'NOPO'}-${kodeBarang || 'ITEM'}-${i}`;

      importedProcurement.push({
        id: recordId,
        fpb,
        entity,
        po: po || '-',
        date: tglPo || tglFpb || new Date().toISOString().slice(0, 10),
        item: namaBarang,
        peruntukan,
        lapse,
        statusBadge,
        statusTone,
        picPch,
        picTtb,
        picLap,
        picAdm,
        picAktif,
        statusPenjelasan,
        deptArmada,
        deliveryTime,
        noFstb,
        tglInputFstb,
        tglKePicTtb,
        noTtb,
        tglInputTtb,
        tglKeTimLapangan,
        tglBarangDiantar,
        tglTtbKePicPch,
        tglKeAdmPch,
        noSpp,
        tglInputSpp,
        tglKeKeuangan,
        kodeBarang,
        satuan,
        qtyFPB,
        qtyPO,
        qtyFSTB,
        qtyTTB,
        selisih,
        priority,
        kategori,
        statusArmada: rawStatus,
        waktuProses,
        tglFpb,
        tglPo,
        tglFstb: tglInputFstb,
        tglTtb: tglInputTtb,
        sourceSheet: 'Monitoring Layanan Armada',
        // Divisi 1: Check & Verifikasi FPB
        picCheckFpb,
        tglCheckFpb,
        statusCheckFpb,
        tglApproveWeb,
        noteCheckFpb,
        doneCheckFpb,
      });

      let armadaFulfillmentStatus = 'OPEN';
      if (rawStatus === 'CLOSE') armadaFulfillmentStatus = 'Lengkap';
      else if (selisih === 0 && qtyFSTB > 0) armadaFulfillmentStatus = 'Lengkap';
      else if (qtyFSTB > 0 && selisih > 0) armadaFulfillmentStatus = `Parsial (Belum Terpenuhi ${selisih})`;
      else armadaFulfillmentStatus = `Belum Terpenuhi (${qtyFPB})`;

      importedArmada.push({
        id: recordId,
        fpb,
        armada: deptArmada,
        item: namaBarang,
        qtyFPB,
        qtyFSTB,
        selisih,
        status: armadaFulfillmentStatus,
        tglFpb,
        noPo: po || '-',
        tglPo,
        noFstb,
        tglFstb: tglInputFstb,
        noTtb,
        tglTtb: tglInputTtb,
        kodeBarang,
        satuan,
        keterangan,
        kategori,
        entity,
        priority,
        waktuProses,
        qtyPO,
        qtyTTB,
        picPch,
        picTtb,
        picLap,
        picAdm,
        deliveryTime,
        tglKeKeuangan,
        noSpp,
        statusBadge,
        statusTone,
        lapse,
        picAktif,
        // Divisi 1: Check & Verifikasi FPB
        picCheckFpb,
        tglCheckFpb,
        statusCheckFpb,
        tglApproveWeb,
        noteCheckFpb,
        doneCheckFpb,
      });
    }
  }

  // 5. UNION SAFETY: Append unmatched rows from "PROCUREMENT"
  let unmatchedProcAppended = 0;
  for (const proc of allProcRecords) {
    if (!matchedProcRowIndexes.has(proc.rowIdx)) {
      unmatchedProcAppended++;

      let statusBadge = 'PROSES ADM PURCHASING';
      let statusTone: StatusTone = 'cyan';
      let statusPenjelasan = `Diimpor dari sheet ${procSheetName || 'PROCUREMENT'}`;

      if (proc.tglKeu) {
        statusBadge = 'SELESAI DI KEUANGAN';
        statusTone = 'emerald';
        statusPenjelasan = `Berkas sudah di Keuangan pada ${proc.tglKeu}`;
      } else if (proc.spp || proc.tglSpp) {
        statusBadge = 'PROSES SPP';
        statusTone = 'emerald';
        statusPenjelasan = `SPP ${proc.spp} dibuat ${proc.tglSpp}`;
      } else if (proc.tglKeAdmPch) {
        statusBadge = 'PROSES ADM PURCHASING';
        statusTone = 'cyan';
        statusPenjelasan = `Berkas ke ADM PCH pada ${proc.tglKeAdmPch}`;
      } else if (proc.tglTtbKePicPch) {
        statusBadge = 'TTB KE PIC PCH';
        statusTone = 'purple';
        statusPenjelasan = `TTB kembali ke PIC PCH pada ${proc.tglTtbKePicPch}`;
      } else if (proc.tglDiantar) {
        statusBadge = 'DIANTAR KE LAPANGAN';
        statusTone = 'amber';
        statusPenjelasan = `Barang diantar pada ${proc.tglDiantar}`;
      } else if (proc.tglKeTimLap) {
        statusBadge = 'MENUNGGU DISTRIBUSI LAPANGAN';
        statusTone = 'amber';
        statusPenjelasan = `Ke tim lapangan pada ${proc.tglKeTimLap}`;
      } else if (proc.ttb || proc.tglTtb) {
        statusBadge = 'VALIDASI LOGISTIK TTB';
        statusTone = 'purple';
        statusPenjelasan = `TTB ${proc.ttb} divalidasi logistik`;
      } else if (proc.tglKePicTtb) {
        statusBadge = 'MENUNGGU PIC TTB';
        statusTone = 'purple';
        statusPenjelasan = `Ke PIC TTB pada ${proc.tglKePicTtb}`;
      } else if (proc.fstb || proc.tglFstb) {
        statusBadge = 'PROSES FSTB';
        statusTone = 'cyan';
        statusPenjelasan = `FSTB ${proc.fstb} diterbitkan`;
      } else if (proc.po && proc.po !== '-') {
        statusBadge = 'MENUNGGU FSTB';
        statusTone = 'cyan';
        statusPenjelasan = `PO ${proc.po} tercatat, menunggu FSTB`;
      } else {
        statusBadge = 'MENUNGGU PO';
        statusTone = 'rose';
        statusPenjelasan = `FPB ${proc.fpb} belum memiliki PO`;
      }

      const lapse = proc.lapseProc !== undefined ? proc.lapseProc : 0;
      if (lapse > 5 && statusTone !== 'emerald') {
        statusTone = 'rose';
      }

      let picAktif = `${proc.picPch || '-'} (Purchasing)`;
      if (statusBadge.includes('KEUANGAN') || statusBadge.includes('SPP')) {
        picAktif = `${proc.picAdm || proc.picPch || '-'} (ADM/Finance)`;
      } else if (statusBadge.includes('LAPANGAN') || statusBadge.includes('DISTRIBUSI')) {
        picAktif = `${proc.picLap || '-'} (Lapangan)`;
      } else if (statusBadge.includes('TTB') || statusBadge.includes('LOGISTIK')) {
        picAktif = `${proc.picTtb || '-'} (Logistik)`;
      } else if (statusBadge.includes('ADM')) {
        picAktif = `${proc.picAdm || '-'} (ADM PCH)`;
      }

      const cfMatch = proc.fpb ? checkFpbMap.get(normalizeKey(proc.fpb)) : undefined;
      const picCheckFpb = cfMatch?.pic || (cfMatch ? 'Bu Noor' : '-');
      const tglCheckFpb = cfMatch?.tglCek || '';
      const statusCheckFpb = cfMatch?.statusCek || (cfMatch?.done ? 'DONE' : '');
      const tglApproveWeb = cfMatch?.tglApprove || '';
      const noteCheckFpb = cfMatch?.note || '';
      const doneCheckFpb = cfMatch?.done || '';

      const recordId = `PROC-${proc.fpb}-${proc.po || 'NOPO'}-${proc.rowIdx}`;

      importedProcurement.push({
        id: recordId,
        fpb: proc.fpb,
        entity: proc.pt || 'CPL',
        po: proc.po || '-',
        date: proc.tglPo || new Date().toISOString().slice(0, 10),
        item: proc.armada ? `${proc.armada} • Berkas Tambahan Procurement` : 'Berkas Tambahan Procurement',
        peruntukan: proc.ket1 || '',
        lapse,
        statusBadge,
        statusTone,
        picPch: proc.picPch || '-',
        picTtb: proc.picTtb || '-',
        picLap: proc.picLap || '-',
        picAdm: proc.picAdm || '-',
        picAktif,
        statusPenjelasan,
        deptArmada: proc.armada,
        deliveryTime: proc.deliveryTime,
        noFstb: proc.fstb,
        tglInputFstb: proc.tglFstb,
        tglKePicTtb: proc.tglKePicTtb,
        noTtb: proc.ttb,
        tglInputTtb: proc.tglTtb,
        tglKeTimLapangan: proc.tglKeTimLap,
        tglBarangDiantar: proc.tglDiantar,
        tglTtbKePicPch: proc.tglTtbKePicPch,
        tglKeAdmPch: proc.tglKeAdmPch,
        noSpp: proc.spp,
        tglInputSpp: proc.tglSpp,
        tglKeKeuangan: proc.tglKeu,
        tglPo: proc.tglPo,
        tglFstb: proc.tglFstb,
        tglTtb: proc.tglTtb,
        sourceSheet: 'PROCUREMENT (Unmatched)',
        // Divisi 1: Check & Verifikasi FPB
        picCheckFpb,
        tglCheckFpb,
        statusCheckFpb,
        tglApproveWeb,
        noteCheckFpb,
        doneCheckFpb,
      });
    }
  }

  return {
    procurement: importedProcurement,
    armada: importedArmada,
    stats: {
      totalMlaRows,
      totalProcRows: allProcRecords.length,
      totalBuNoorRows: checkFpbMap.size,
      totalCheckFpbRows: checkFpbMap.size,
      matchedMlaCount,
      unmatchedProcAppended,
      totalMergedProcurement: importedProcurement.length,
      totalArmadaItems: importedArmada.length,
    },
  };
}
