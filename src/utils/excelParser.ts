import * as XLSX from 'xlsx';
import { ProcurementItem, ArmadaItem, StatusTone } from '@/types/procurement';
import { formatDateDdMmYyDash } from '@/utils/formatDate';
import { evaluateTransactionStatus, evaluateArmadaFulfillment, hasValue } from '@/utils/statusWorkflow';
import { enrichProcurementAndArmada } from '@/utils/dataMerger';
import { isInvalidOrGenericItem } from '@/utils/itemResolver';

// Helper: Convert Excel date / serial date number to YYYY-MM-DD string
export const excelDateToString = (val: any): string => {
  if (!val && val !== 0) return '';
  if (typeof val === 'string') {
    const trimmed = val.trim();
    if (!trimmed) return '';
    // Format DD/MM/YYYY or MM/DD/YYYY
    if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(trimmed)) {
      const parts = trimmed.split('/');
      const p1 = parseInt(parts[0], 10);
      const p2 = parseInt(parts[1], 10);
      let d = parts[0].padStart(2, '0');
      let m = parts[1].padStart(2, '0');
      if (p2 > 12) {
        // MM/DD/YYYY
        d = parts[1].padStart(2, '0');
        m = parts[0].padStart(2, '0');
      }
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

// Helper: Convert Excel time fraction (0 <= val < 1) or time string to hh:mm:ss AM/PM
export const excelTimeToString = (val: any): string => {
  if (!val && val !== 0) return '';
  if (typeof val === 'string') {
    const trimmed = val.trim();
    if (!trimmed || trimmed === '-') return '';
    return trimmed;
  }
  if (typeof val === 'number') {
    if (val >= 0 && val < 1) {
      const totalSeconds = Math.round(val * 86400);
      const hours24 = Math.floor(totalSeconds / 3600) % 24;
      const minutes = Math.floor((totalSeconds % 3600) / 60);
      const seconds = totalSeconds % 60;
      const ampm = hours24 >= 12 ? 'PM' : 'AM';
      const hours12 = hours24 % 12 || 12;
      return `${hours12}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')} ${ampm}`;
    }
  }
  return String(val);
};

// Helper: Build column index map from header row
export const buildColumnMap = (headerRow: any[]): Record<string, number> => {
  const map: Record<string, number> = {};
  if (!headerRow) return map;
  headerRow.forEach((cell, idx) => {
    const raw = String(cell || '').trim().toUpperCase();
    if (raw) {
      map[raw] = idx;
      const clean = raw.replace(/\s+/g, ' ');
      map[clean] = idx;
      const alphaNum = raw.replace(/[^A-Z0-9]/g, '');
      if (alphaNum && map[alphaNum] === undefined) {
        map[alphaNum] = idx;
      }
    }
  });
  return map;
};

// Helper: Find column index by exact or partial header match
export const findCol = (colMap: Record<string, number>, ...patterns: string[]): number => {
  for (const pattern of patterns) {
    const pUpper = pattern.toUpperCase().trim();
    if (colMap[pUpper] !== undefined) return colMap[pUpper];
    const pClean = pUpper.replace(/\s+/g, ' ');
    if (colMap[pClean] !== undefined) return colMap[pClean];
    const pAlpha = pUpper.replace(/[^A-Z0-9]/g, '');
    if (pAlpha && colMap[pAlpha] !== undefined) return colMap[pAlpha];
    for (const [key, idx] of Object.entries(colMap)) {
      if (key.includes(pUpper) || key.includes(pClean)) return idx;
      const kAlpha = key.replace(/[^A-Z0-9]/g, '');
      if (pAlpha && kAlpha.includes(pAlpha)) return idx;
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

  const checkFpbSheetNames = workbook.SheetNames.filter((n) => {
    const up = n.toUpperCase();
    return (
      up.includes('CHECK FPB') ||
      up.includes('FPB CHECK') ||
      up.includes('FBP CHECK') ||
      up.includes('CHECK FBP') ||
      up.includes('BU NOOR') ||
      up.includes('NOOR') ||
      up.includes('MELINDA') ||
      up.includes('VERIFIKASI FPB') ||
      (up.includes('CHECK') && (up.includes('FPB') || up.includes('FBP')))
    );
  });
  const checkFpbSheetName = checkFpbSheetNames[0] || undefined;
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
    picFstb?: string;
    tglKePicTtb: string;
    waktuKePicTtb: string;
    ket1: string;
    lapseProc?: number;
    lapseText?: string;
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
    ketLap?: string;
    lapsePchToTtb?: string;
    lapseTtbToLap?: string;
    lapseLapToTtb?: string;
    lapseTtbToPch?: string;
    lapseAdmPch?: string;
    lapseKeu?: string;
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
    const cPicPch    = findCol(colMap, 'PIC PCH', 'PIC PURCHASING', 'PURCHASING');
    const cPT        = findCol(colMap, 'PT');
    const cDeptArm   = findCol(colMap, 'DEPT/ ARMADA', 'DEPT/ARMADA', 'ARMADA');
    const cFPB       = findCol(colMap, 'NO. FPB', 'NO FPB', 'NOMOR FPB', 'FPB');
    const cPO        = findCol(colMap, 'NO. PO', 'NO PO', 'NOMOR PO', 'PO');
    const cTglPO     = findCol(colMap, 'TANGGAL  INPUT PO', 'TANGGAL INPUT PO', 'TGL INPUT PO', 'TANGGAL PO', 'TGL PO');
    const cDelivery  = findCol(colMap, 'DELIVERY TIME', 'DELIVERY', 'WAKTU DELIVERY', 'WAKTU PROSES');
    const cFSTB      = findCol(colMap, 'NO. FSTB', 'NO FSTB', 'NOMOR FSTB', 'FSTB');
    const cTglFSTB   = findCol(colMap, 'TANGGAL INPUT FSTB', 'TGL INPUT FSTB', 'TANGGAL FSTB', 'TGL FSTB');
    const cPicFstb   = findCol(colMap, 'PIC FSTB', 'PIC PENERIMA', 'PENERIMA FSTB', 'PENERIMA BARANG', 'PIC SERAH TERIMA');
    const cTglPicTtb = findCol(colMap, 'TANGGAL KE PIC TTB', 'TGL KE PIC TTB', 'KE PIC TTB');
    const cWaktuPicTtb = findCol(colMap, 'WAKTU KE PIC TTB', 'JAM KE PIC TTB', 'WAKTU PIC TTB');
    const cPicTtb    = findCol(colMap, 'PIC TTB', 'LOGISTIK TTB', 'PIC_TTB');
    const cTTB       = findCol(colMap, 'NO. TTB', 'NO TTB', 'NOMOR TTB', 'TTB');
    const cTglTTB    = findCol(colMap, 'TANGGAL  INPUT TTB', 'TANGGAL INPUT TTB', 'TGL INPUT TTB', 'TANGGAL TTB', 'TGL TTB');
    const cTglTimLap = findCol(colMap, 'TANGGAL KE TIM LAPANGAN', 'TGL KE TIM LAPANGAN', 'TANGGAL KE LAPANGAN', 'TGL KE LAPANGAN', 'KE TIM LAPANGAN');
    const cPicLap    = findCol(colMap, 'PIC LAPANGAN', 'PIC TIM LAPANGAN', 'TIM LAPANGAN', 'PIC TL');
    const cTglDiantar = findCol(colMap, 'TANGGAL BARANG DI DIANTAR', 'TANGGAL BARANG DIANTAR', 'TGL BARANG DIANTAR', 'TANGGAL DIANTAR', 'TGL DIANTAR');
    const cTglTimLapKePicTtb = findCol(colMap, 'TANGGAL TIM LAP KE PIC TTB', 'TGL TIM LAP KE PIC TTB', 'TL KE TTB');
    const cTglTtbPch = findCol(colMap, 'TANGGAL TTB KE PIC PCH', 'TGL TTB KE PIC PCH', 'TTB KE PCH');
    const cTglAdmPch = findCol(colMap, 'TANGGAL KE ADM PCH', 'TGL KE ADM PCH', 'KE ADM PCH');
    const cPicAdm    = findCol(colMap, 'PIC ADM PCH', 'PIC ADM', 'ADM PCH');
    const cSPP       = findCol(colMap, 'NO. SPP', 'NO SPP', 'NOMOR SPP', 'SPP');
    const cTglSPP    = findCol(colMap, 'TANGGAL INPUT SPP', 'TGL INPUT SPP', 'TANGGAL SPP', 'TGL SPP');
    const cTglKeu    = findCol(colMap, 'TANGGAL KE KEUANGAN', 'TGL KE KEUANGAN', 'KE KEUANGAN', 'TGL KEU');

    const headers = json[headerRowIdx] || [];
    let cKetPch = -1;
    let cKetLap = -1;
    headers.forEach((h: any, idx: number) => {
      const up = String(h || '').trim().toUpperCase();
      if (up.includes('KETERANGAN')) {
        if (cKetPch < 0 && idx <= 15) cKetPch = idx;
        else if (cKetLap < 0 && idx >= 18 && idx <= 23) cKetLap = idx;
      }
    });
    if (cKetPch < 0) cKetPch = 12;
    if (cKetLap < 0) cKetLap = 21;

    const lapseCols: number[] = [];
    headers.forEach((cell: any, idx: number) => {
      const headerStr = String(cell || '').trim().toUpperCase();
      if (
        headerStr === 'LAPSE DAY' ||
        headerStr.replace(/\s+/g, '') === 'LAPSEDAY' ||
        headerStr.replace(/\s+/g, ' ') === 'LAP SE DAY'
      ) {
        lapseCols.push(idx);
      }
    });

    const cLapsePchToTtb = lapseCols[0] !== undefined ? lapseCols[0] : 13;
    const cLapseTtbToLap = lapseCols[1] !== undefined ? lapseCols[1] : 18;
    const cLapseLapToTtb = lapseCols[2] !== undefined ? lapseCols[2] : 23;
    const cLapseTtbToPch = lapseCols[3] !== undefined ? lapseCols[3] : 26;
    const cLapseAdmPch   = lapseCols[4] !== undefined ? lapseCols[4] : 29;
    const cLapseKeu      = lapseCols[5] !== undefined ? lapseCols[5] : 39;

    // Cari kolom LAPSE DAY di Kolom AA (Column AA = index 26, atau LAPSE DAY tepat sebelum TANGGAL KE ADM PCH)
    let cLapse = -1;
    for (const colIdx of lapseCols) {
      const nextHeader = String(headers[colIdx + 1] || '').trim().toUpperCase();
      if (colIdx === 26 || nextHeader.includes('ADM PCH')) {
        cLapse = colIdx;
        break;
      }
    }
    // Fallback jika tidak terdeteksi via nama nextHeader:
    if (cLapse < 0) {
      if (lapseCols.length >= 4) {
        cLapse = lapseCols[3]; // Kolom ke-4 (AA) di sheet PROCUREMENT
      } else if (lapseCols.length > 0) {
        cLapse = lapseCols[lapseCols.length - 1];
      }
    }

    for (let i = headerRowIdx + 1; i < json.length; i++) {
      const r = json[i];
      if (!r || r.length === 0) continue;

      const fpb = String(cFPB >= 0 ? r[cFPB] : r[4] || '').trim();
      const po = String(cPO >= 0 ? r[cPO] : r[5] || '').trim();
      if (!fpb && !po) continue;

      const tglTtbKePicPch = excelDateToString(cTglTtbPch >= 0 ? r[cTglTtbPch] : '');
      const rawLapse = cLapse >= 0 ? r[cLapse] : '';

      let lapseProc: number = 0;
      let lapseText: string | undefined = undefined;

      const isNegativeLapse =
        typeof rawLapse === 'number'
          ? rawLapse < 0
          : typeof rawLapse === 'string' && rawLapse.trim().startsWith('-');
      const isTtbPchEmpty =
        !tglTtbKePicPch || tglTtbKePicPch === '-' || tglTtbKePicPch.trim() === '';

      // Logic: jika TANGGAL TTB KE PIC PCH belum diinput atau formula menghasilkan negatif (-46... sekian), set TBC
      if (isNegativeLapse || isTtbPchEmpty) {
        lapseProc = 0;
        lapseText = 'TBC';
      } else if (typeof rawLapse === 'number' && !isNaN(rawLapse)) {
        lapseProc = Math.round(rawLapse);
        lapseText = undefined;
      } else if (rawLapse !== '' && !isNaN(Number(rawLapse))) {
        const parsed = parseInt(String(rawLapse), 10);
        if (parsed < 0) {
          lapseProc = 0;
          lapseText = 'TBC';
        } else {
          lapseProc = parsed;
          lapseText = undefined;
        }
      } else {
        lapseProc = 0;
        lapseText = 'TBC';
      }

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
        picFstb: String(cPicFstb >= 0 ? r[cPicFstb] : '').trim(),
        tglKePicTtb: excelDateToString(cTglPicTtb >= 0 ? r[cTglPicTtb] : ''),
        waktuKePicTtb: excelTimeToString(cWaktuPicTtb >= 0 ? r[cWaktuPicTtb] : ''),
        ket1: String(cKetPch >= 0 ? r[cKetPch] : '').trim(),
        ketLap: String(cKetLap >= 0 ? r[cKetLap] : '').trim(),
        lapsePchToTtb: String(cLapsePchToTtb >= 0 ? r[cLapsePchToTtb] : '').trim(),
        lapseTtbToLap: String(cLapseTtbToLap >= 0 ? r[cLapseTtbToLap] : '').trim(),
        lapseLapToTtb: String(cLapseLapToTtb >= 0 ? r[cLapseLapToTtb] : '').trim(),
        lapseTtbToPch: String(cLapseTtbToPch >= 0 ? r[cLapseTtbToPch] : '').trim(),
        lapseAdmPch: String(cLapseAdmPch >= 0 ? r[cLapseAdmPch] : '').trim(),
        lapseKeu: String(cLapseKeu >= 0 ? r[cLapseKeu] : '').trim(),
        lapseProc,
        lapseText,
        picTtb: String(cPicTtb >= 0 ? r[cPicTtb] : '').trim().toLowerCase() === 'logistik' ? '' : String(cPicTtb >= 0 ? r[cPicTtb] : '').trim(),
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
        const normPo = normalizeKey(po);
        if (procByPo.has(normPo)) {
          const target = procByPo.get(normPo)!;
          if (!hasValue(target.fpb) && hasValue(record.fpb)) target.fpb = record.fpb;
          if (!hasValue(target.tglPo) && hasValue(record.tglPo)) target.tglPo = record.tglPo;
          if (!hasValue(target.picPch) && hasValue(record.picPch)) target.picPch = record.picPch;
          if (!hasValue(target.deliveryTime) && hasValue(record.deliveryTime)) target.deliveryTime = record.deliveryTime;
          if (!hasValue(target.fstb) && hasValue(record.fstb)) target.fstb = record.fstb;
          if (!hasValue(target.tglFstb) && hasValue(record.tglFstb)) target.tglFstb = record.tglFstb;
          if (!hasValue(target.picFstb) && hasValue(record.picFstb)) target.picFstb = record.picFstb;
          if (!hasValue(target.picTtb) && hasValue(record.picTtb)) target.picTtb = record.picTtb;
          if (!hasValue(target.ttb) && hasValue(record.ttb)) target.ttb = record.ttb;
          if (!hasValue(target.tglTtb) && hasValue(record.tglTtb)) target.tglTtb = record.tglTtb;
          if (!hasValue(target.tglKePicTtb) && hasValue(record.tglKePicTtb)) target.tglKePicTtb = record.tglKePicTtb;
          if (!hasValue(target.tglKeTimLap) && hasValue(record.tglKeTimLap)) target.tglKeTimLap = record.tglKeTimLap;
          if (!hasValue(target.picLap) && hasValue(record.picLap)) target.picLap = record.picLap;
          if (!hasValue(target.tglDiantar) && hasValue(record.tglDiantar)) target.tglDiantar = record.tglDiantar;
          if (!hasValue(target.tglTimLapKePicTtb) && hasValue(record.tglTimLapKePicTtb)) target.tglTimLapKePicTtb = record.tglTimLapKePicTtb;
          if (!hasValue(target.tglTtbKePicPch) && hasValue(record.tglTtbKePicPch)) target.tglTtbKePicPch = record.tglTtbKePicPch;
          if (!hasValue(target.tglKeAdmPch) && hasValue(record.tglKeAdmPch)) target.tglKeAdmPch = record.tglKeAdmPch;
          if (!hasValue(target.picAdm) && hasValue(record.picAdm)) target.picAdm = record.picAdm;
          if (!hasValue(target.spp) && hasValue(record.spp)) target.spp = record.spp;
          if (!hasValue(target.tglSpp) && hasValue(record.tglSpp)) target.tglSpp = record.tglSpp;
          if (!hasValue(target.tglKeu) && hasValue(record.tglKeu)) target.tglKeu = record.tglKeu;
          if (!hasValue(target.pt) && hasValue(record.pt)) target.pt = record.pt;
          if (!hasValue(target.armada) && hasValue(record.armada)) target.armada = record.armada;
          if (!hasValue(target.ket1) && hasValue(record.ket1)) target.ket1 = record.ket1;
        } else {
          procByPo.set(normPo, { ...record });
        }
      }
      if (fpb && fpb !== '-') {
        const normFpb = normalizeKey(fpb);
        if (procByFpb.has(normFpb)) {
          const target = procByFpb.get(normFpb)!;
          if (!hasValue(target.po) && hasValue(record.po)) target.po = record.po;
          if (!hasValue(target.tglPo) && hasValue(record.tglPo)) target.tglPo = record.tglPo;
          if (!hasValue(target.picPch) && hasValue(record.picPch)) target.picPch = record.picPch;
          if (!hasValue(target.deliveryTime) && hasValue(record.deliveryTime)) target.deliveryTime = record.deliveryTime;
          if (!hasValue(target.fstb) && hasValue(record.fstb)) target.fstb = record.fstb;
          if (!hasValue(target.tglFstb) && hasValue(record.tglFstb)) target.tglFstb = record.tglFstb;
          if (!hasValue(target.picFstb) && hasValue(record.picFstb)) target.picFstb = record.picFstb;
          if (!hasValue(target.picTtb) && hasValue(record.picTtb)) target.picTtb = record.picTtb;
          if (!hasValue(target.ttb) && hasValue(record.ttb)) target.ttb = record.ttb;
          if (!hasValue(target.tglTtb) && hasValue(record.tglTtb)) target.tglTtb = record.tglTtb;
          if (!hasValue(target.tglKePicTtb) && hasValue(record.tglKePicTtb)) target.tglKePicTtb = record.tglKePicTtb;
          if (!hasValue(target.tglKeTimLap) && hasValue(record.tglKeTimLap)) target.tglKeTimLap = record.tglKeTimLap;
          if (!hasValue(target.picLap) && hasValue(record.picLap)) target.picLap = record.picLap;
          if (!hasValue(target.tglDiantar) && hasValue(record.tglDiantar)) target.tglDiantar = record.tglDiantar;
          if (!hasValue(target.tglTimLapKePicTtb) && hasValue(record.tglTimLapKePicTtb)) target.tglTimLapKePicTtb = record.tglTimLapKePicTtb;
          if (!hasValue(target.tglTtbKePicPch) && hasValue(record.tglTtbKePicPch)) target.tglTtbKePicPch = record.tglTtbKePicPch;
          if (!hasValue(target.tglKeAdmPch) && hasValue(record.tglKeAdmPch)) target.tglKeAdmPch = record.tglKeAdmPch;
          if (!hasValue(target.picAdm) && hasValue(record.picAdm)) target.picAdm = record.picAdm;
          if (!hasValue(target.spp) && hasValue(record.spp)) target.spp = record.spp;
          if (!hasValue(target.tglSpp) && hasValue(record.tglSpp)) target.tglSpp = record.tglSpp;
          if (!hasValue(target.tglKeu) && hasValue(record.tglKeu)) target.tglKeu = record.tglKeu;
          if (!hasValue(target.pt) && hasValue(record.pt)) target.pt = record.pt;
          if (!hasValue(target.armada) && hasValue(record.armada)) target.armada = record.armada;
          if (!hasValue(target.ket1) && hasValue(record.ket1)) target.ket1 = record.ket1;
        } else {
          procByFpb.set(normFpb, { ...record });
        }
      }
    }
  }

  // 3. Index "Check FPB / Master Data Bu Noor & Bu Melinda" (Divisi 1: Pembuatan & Verifikasi FPB)
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
    sourceSheet?: string;
    verifiedBy?: string;
  }
  const checkFpbMap = new Map<string, CheckFpbRecord>();

  for (const sName of checkFpbSheetNames) {
    if (!workbook.Sheets[sName]) continue;
    const ws = workbook.Sheets[sName];
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

    const isMelinda = sName.toUpperCase().includes('MELINDA');
    const defaultPicName = isMelinda ? 'Melinda' : 'Bu Noor';
    const verifiedBy = isMelinda ? 'Bu Melinda' : 'Bu Noor';
    const sourceCheckFpb = sName;

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
        pic = defaultPicName;
      }

      const key = normalizeKey(fpb);
      if (!checkFpbMap.has(key)) {
        checkFpbMap.set(key, {
          fpb,
          pic,
          armada: String(cArmada >= 0 ? r[cArmada] : '').trim(),
          tglFpb: excelDateToString(cTglFPB >= 0 ? r[cTglFPB] : ''),
          tglCek: excelDateToString(cTglCek >= 0 ? r[cTglCek] : ''),
          statusCek: String(cStatusCek >= 0 ? r[cStatusCek] : '').trim(),
          tglApprove: excelDateToString(cTglAppr >= 0 ? r[cTglAppr] : ''),
          done: String(cDone >= 0 ? r[cDone] : '').trim(),
          note: rawNote,
          sourceSheet: sourceCheckFpb,
          verifiedBy,
        });
      }
    }
  }

  const buNoorMap = checkFpbMap;

  // 4. MAIN PROCESS: Parse "Monitoring Layanan Armada" as PRIMARY REFERENCE
  const importedProcurement: ProcurementItem[] = [];
  const importedArmada: ArmadaItem[] = [];
  const mlaItemsByFpb = new Map<string, string[]>();
  const mlaItemsByPo = new Map<string, string[]>();

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

    const aFPB       = findCol(colMap, 'NO. FPB', 'NO FPB', 'NOMOR FPB', 'FPB');
    const aTglFPB    = findCol(colMap, 'TGL FPB', 'TANGGAL FPB', 'TGL INPUT FPB', 'TANGGAL INPUT FPB');
    const aPO        = findCol(colMap, 'NO. PO', 'NO PO', 'NOMOR PO', 'PO');
    const aTglPO     = findCol(colMap, 'TGL PO', 'TANGGAL PO', 'TGL INPUT PO', 'TANGGAL INPUT PO');
    const aFSTB      = findCol(colMap, 'NO. FSTB', 'NO FSTB', 'NOMOR FSTB', 'FSTB');
    const aTglFSTB   = findCol(colMap, 'TGL FSTB', 'TANGGAL FSTB', 'TGL INPUT FSTB', 'TANGGAL INPUT FSTB');
    const aTTB       = findCol(colMap, 'NO. TTB', 'NO TTB', 'NOMOR TTB', 'TTB');
    const aTglTTB    = findCol(colMap, 'TGL TTB', 'TANGGAL TTB', 'TGL INPUT TTB', 'TANGGAL INPUT TTB');
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
      const rawNamaBarang = String(aNama >= 0 ? r[aNama] : '').trim();
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

      const picCheckFpb = cfMatch?.pic || (cfMatch ? (cfMatch.verifiedBy || 'Bu Noor') : '-');
      const tglCheckFpb = cfMatch?.tglCek || '';
      const statusCheckFpb = cfMatch?.statusCek || (cfMatch?.done ? 'DONE' : '');
      const tglApproveWeb = cfMatch?.tglApprove || '';
      const noteCheckFpb = cfMatch?.note || '';
      const doneCheckFpb = cfMatch?.done || '';
      const sourceCheckFpb = cfMatch?.sourceSheet || (cfMatch ? (cfMatch.verifiedBy === 'Bu Melinda' ? 'FBP CHECK MELINDA' : 'FBP CHECK BU NOOR') : '');
      const verifiedByFpb = cfMatch?.verifiedBy || (cfMatch ? 'Bu Noor' : '');

      if (!tglFpb && cfMatch?.tglFpb) {
        tglFpb = cfMatch.tglFpb;
      }

      const picPch = hasValue(pMatch?.picPch) ? pMatch!.picPch : '-';
      const picTtb = hasValue(pMatch?.picTtb) && pMatch!.picTtb.trim().toLowerCase() !== 'logistik' ? pMatch!.picTtb : '-';
      const picLap = hasValue(pMatch?.picLap) ? pMatch!.picLap : '-';
      const picAdm = hasValue(pMatch?.picAdm) ? pMatch!.picAdm : '-';
      const deliveryTime = hasValue(pMatch?.deliveryTime) ? pMatch!.deliveryTime : (hasValue(waktuProses) ? waktuProses : '');
      const noFstb = hasValue(pMatch?.fstb) ? pMatch!.fstb : (hasValue(fstbMla) ? fstbMla : '');
      const tglInputFstb = hasValue(pMatch?.tglFstb) ? pMatch!.tglFstb : (hasValue(tglFstbMla) ? tglFstbMla : '');
      const noTtb = hasValue(pMatch?.ttb) ? pMatch!.ttb : (hasValue(ttbMla) ? ttbMla : '');
      const tglInputTtb = hasValue(pMatch?.tglTtb) ? pMatch!.tglTtb : (hasValue(tglTtbMla) ? tglTtbMla : '');
      const tglKePicTtb = pMatch?.tglKePicTtb || '';
      const tglKeTimLapangan = pMatch?.tglKeTimLap || '';
      const tglBarangDiantar = pMatch?.tglDiantar || '';
      const tglTimLapKePicTtb = pMatch?.tglTimLapKePicTtb || '';
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

      // Sanitasi nama barang: hindari teks generik, nama armada, atau 'Item Operasional'
      const cleanNamaBarang =
        rawNamaBarang && !isInvalidOrGenericItem(rawNamaBarang, deptArmada)
          ? rawNamaBarang
          : (keterangan && !isInvalidOrGenericItem(keterangan, deptArmada) ? keterangan : '');
      const namaBarang = cleanNamaBarang;

      if (cleanNamaBarang) {
        if (normFpb) {
          const curList = mlaItemsByFpb.get(normFpb) || [];
          if (!curList.includes(cleanNamaBarang)) curList.push(cleanNamaBarang);
          mlaItemsByFpb.set(normFpb, curList);
        }
        if (normPo && normPo !== '-') {
          const curList = mlaItemsByPo.get(normPo) || [];
          if (!curList.includes(cleanNamaBarang)) curList.push(cleanNamaBarang);
          mlaItemsByPo.set(normPo, curList);
        }
      }

      let lapse = 0;
      let lapseText: string | undefined = undefined;

      if (pMatch?.lapseText === 'TBC') {
        lapse = 0;
        lapseText = 'TBC';
      } else if (pMatch?.lapseProc !== undefined && pMatch.lapseProc !== null) {
        lapse = pMatch.lapseProc;
        lapseText = pMatch.lapseText;
      } else if (waktuProses) {
        const match = waktuProses.match(/\d+/);
        if (match) lapse = parseInt(match[0]);
      } else if (tglPo || tglFpb) {
        const refDate = new Date(tglPo || tglFpb).getTime();
        if (!isNaN(refDate)) {
          const diffDays = Math.floor((Date.now() - refDate) / (1000 * 60 * 60 * 24));
          if (diffDays > 0) lapse = Math.min(diffDays, 365);
        }
      }

      const evalRes = evaluateTransactionStatus({
        fpb,
        po,
        tglPo,
        tglFpb,
        noFstb,
        tglInputFstb,
        noTtb,
        tglInputTtb,
        tglKePicTtb,
        tglKeTimLapangan,
        tglBarangDiantar,
        tglTimLapKePicTtb,
        tglTtbKePicPch,
        tglKeAdmPch,
        picAdm,
        picPch,
        picTtb,
        picLap,
        noSpp,
        tglInputSpp,
        tglKeKeuangan,
        rawStatus,
        lapse,
        lapseText,
      });

      const statusBadge = evalRes.statusBadge;
      const statusTone = evalRes.statusTone;
      const statusPenjelasan = evalRes.statusPenjelasan;
      const picAktif = evalRes.picAktif;

      const peruntukan = keterangan || (bnMatch?.note ? `Note: ${bnMatch.note}` : '');

      const recordId = `${fpb}-${po || 'NOPO'}-${kodeBarang || 'ITEM'}-${i}`;

      importedProcurement.push({
        id: recordId,
        fpb,
        entity,
        po: po || '-',
        date: tglPo || tglFpb || new Date().toISOString().slice(0, 10),
        item: cleanNamaBarang || '-',
        peruntukan,
        lapse,
        lapseText,
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
        picFstb: pMatch?.picFstb || '',
        tglInputFstb,
        tglKePicTtb,
        waktuKePicTtb: pMatch?.waktuKePicTtb || '',
        keterangan: pMatch?.ket1 || keterangan || '',
        ketPch: pMatch?.ket1 || '',
        ketLap: pMatch?.ketLap || '',
        lapsePchToTtb: pMatch?.lapsePchToTtb || '',
        lapseTtbToLap: pMatch?.lapseTtbToLap || '',
        lapseLapToTtb: pMatch?.lapseLapToTtb || '',
        lapseTtbToPch: pMatch?.lapseTtbToPch || '',
        lapseAdmPch: pMatch?.lapseAdmPch || '',
        lapseKeu: pMatch?.lapseKeu || '',
        noTtb,
        tglInputTtb,
        tglKeTimLapangan,
        tglBarangDiantar,
        tglTimLapKePicTtb,
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
        sourceCheckFpb,
        verifiedByFpb,
      });

      const fulfillmentResult = evaluateArmadaFulfillment({
        fpb,
        po,
        noPo: po,
        tglPo,
        tglFpb,
        noFstb,
        tglFstb: tglInputFstb,
        noTtb,
        tglTtb: tglInputTtb,
        tglKePicTtb,
        tglKeTimLapangan,
        tglBarangDiantar,
        tglTimLapKePicTtb,
        tglTtbKePicPch,
        tglKeAdmPch,
        picAdm,
        picPch,
        picTtb,
        picLap,
        noSpp,
        tglInputSpp,
        tglKeKeuangan,
        qtyFPB,
        qtyPO,
        qtyFSTB,
        qtyTTB,
        selisih,
        rawStatus,
        statusArmada: rawStatus,
        deliveryTime,
        statusCheckFpb,
        doneCheckFpb,
        picCheckFpb,
      });

      const armadaFulfillmentStatus = fulfillmentResult.status;

      const finalArmadaItem =
        cleanNamaBarang ||
        (keterangan && !isInvalidOrGenericItem(keterangan, deptArmada) ? keterangan : '-');

      importedArmada.push({
        id: recordId,
        fpb,
        armada: deptArmada,
        item: finalArmadaItem,
        qtyFPB,
        qtyFSTB,
        selisih,
        status: armadaFulfillmentStatus,
        tglFpb,
        noPo: po || '-',
        tglPo,
        noFstb,
        picFstb: pMatch?.picFstb || '',
        tglFstb: tglInputFstb,
        noTtb,
        tglTtb: tglInputTtb,
        kodeBarang,
        satuan,
        keterangan: pMatch?.ket1 || keterangan || '',
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
        tglKePicTtb,
        waktuKePicTtb: pMatch?.waktuKePicTtb || '',
        tglKeTimLapangan,
        tglBarangDiantar,
        tglTimLapKePicTtb,
        tglTtbKePicPch,
        tglKeAdmPch,
        tglKeKeuangan,
        noSpp,
        tglInputSpp,
        statusBadge,
        statusTone,
        lapse,
        lapseText,
        picAktif,
        // Divisi 1: Check & Verifikasi FPB
        picCheckFpb,
        tglCheckFpb,
        statusCheckFpb,
        tglApproveWeb,
        noteCheckFpb,
        doneCheckFpb,
        sourceCheckFpb,
        verifiedByFpb,
      });
    }
  }

  // 5. UNION SAFETY: Append unmatched rows from "PROCUREMENT"
  let unmatchedProcAppended = 0;
  for (const proc of allProcRecords) {
    if (!matchedProcRowIndexes.has(proc.rowIdx)) {
      unmatchedProcAppended++;

      let lapse = proc.lapseProc !== undefined ? proc.lapseProc : 0;
      let lapseText: string | undefined = proc.lapseText;
      if (lapseText === 'TBC') {
        lapse = 0;
      }

      const evalRes = evaluateTransactionStatus({
        fpb: proc.fpb,
        po: proc.po,
        tglPo: proc.tglPo,
        noFstb: proc.fstb,
        tglInputFstb: proc.tglFstb,
        noTtb: proc.ttb,
        tglInputTtb: proc.tglTtb,
        tglKePicTtb: proc.tglKePicTtb,
        tglKeTimLapangan: proc.tglKeTimLap,
        tglBarangDiantar: proc.tglDiantar,
        tglTimLapKePicTtb: proc.tglTimLapKePicTtb,
        tglTtbKePicPch: proc.tglTtbKePicPch,
        tglKeAdmPch: proc.tglKeAdmPch,
        picAdm: proc.picAdm,
        picPch: proc.picPch,
        picTtb: proc.picTtb,
        picLap: proc.picLap,
        noSpp: proc.spp,
        tglInputSpp: proc.tglSpp,
        tglKeKeuangan: proc.tglKeu,
        lapse,
        lapseText,
      });

      const statusBadge = evalRes.statusBadge;
      const statusTone = evalRes.statusTone;
      const statusPenjelasan = evalRes.statusPenjelasan;
      const picAktif = evalRes.picAktif;

      const cfMatch = proc.fpb ? checkFpbMap.get(normalizeKey(proc.fpb)) : undefined;
      const picCheckFpb = cfMatch?.pic || (cfMatch ? (cfMatch.verifiedBy || 'Bu Noor') : '-');
      const tglCheckFpb = cfMatch?.tglCek || '';
      const statusCheckFpb = cfMatch?.statusCek || (cfMatch?.done ? 'DONE' : '');
      const tglApproveWeb = cfMatch?.tglApprove || '';
      const noteCheckFpb = cfMatch?.note || '';
      const doneCheckFpb = cfMatch?.done || '';
      const sourceCheckFpb = cfMatch?.sourceSheet || (cfMatch ? (cfMatch.verifiedBy === 'Bu Melinda' ? 'FBP CHECK MELINDA' : 'FBP CHECK BU NOOR') : '');
      const verifiedByFpb = cfMatch?.verifiedBy || (cfMatch ? 'Bu Noor' : '');

      const recordId = `PROC-${proc.fpb}-${proc.po || 'NOPO'}-${proc.rowIdx}`;
      const normFpb = normalizeKey(proc.fpb);
      const normPo = normalizeKey(proc.po);
      const mlaItems = (normFpb ? mlaItemsByFpb.get(normFpb) : undefined) || (normPo ? mlaItemsByPo.get(normPo) : undefined) || [];
      const cleanKet = proc.ket1?.trim();
      const validKet = cleanKet && cleanKet !== '-' && !isInvalidOrGenericItem(cleanKet, proc.armada) ? cleanKet : '';
      const itemDesc = mlaItems.length > 0 ? mlaItems.join(', ') : (validKet || '-');

      importedProcurement.push({
        id: recordId,
        fpb: proc.fpb,
        entity: proc.pt || 'CPL',
        po: proc.po || '-',
        date: proc.tglPo || new Date().toISOString().slice(0, 10),
        item: itemDesc,
        peruntukan: proc.ket1 || '',
        lapse,
        lapseText,
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
        picFstb: proc.picFstb || '',
        tglInputFstb: proc.tglFstb,
        tglKePicTtb: proc.tglKePicTtb,
        waktuKePicTtb: proc.waktuKePicTtb || '',
        keterangan: proc.ket1 || '',
        ketPch: proc.ket1 || '',
        ketLap: proc.ketLap || '',
        lapsePchToTtb: proc.lapsePchToTtb || '',
        lapseTtbToLap: proc.lapseTtbToLap || '',
        lapseLapToTtb: proc.lapseLapToTtb || '',
        lapseTtbToPch: proc.lapseTtbToPch || '',
        lapseAdmPch: proc.lapseAdmPch || '',
        lapseKeu: proc.lapseKeu || '',
        noTtb: proc.ttb,
        tglInputTtb: proc.tglTtb,
        tglKeTimLapangan: proc.tglKeTimLap,
        tglBarangDiantar: proc.tglDiantar,
        tglTimLapKePicTtb: proc.tglTimLapKePicTtb,
        tglTtbKePicPch: proc.tglTtbKePicPch,
        tglKeAdmPch: proc.tglKeAdmPch,
        noSpp: proc.spp,
        tglInputSpp: proc.tglSpp,
        tglKeKeuangan: proc.tglKeu,
        tglPo: proc.tglPo,
        tglFstb: proc.tglFstb,
        tglTtb: proc.tglTtb,
        sourceSheet: mlaSheetName ? 'PROCUREMENT (Unmatched)' : 'PROCUREMENT',
        // Divisi 1: Check & Verifikasi FPB
        picCheckFpb,
        tglCheckFpb,
        statusCheckFpb,
        tglApproveWeb,
        noteCheckFpb,
        doneCheckFpb,
        sourceCheckFpb,
        verifiedByFpb,
      });

      // Jika file Excel murni Procurement tanpa sheet Monitoring Layanan Armada terpisah,
      // buatkan entri ArmadaItem agar Tab Armada tetap berfungsi optimal
      if (!mlaSheetName) {
        const fallbackFulfillment = evaluateArmadaFulfillment({
          fpb: proc.fpb,
          po: proc.po,
          noPo: proc.po,
          tglPo: proc.tglPo,
          tglFpb: proc.tglPo,
          noFstb: proc.fstb,
          tglFstb: proc.tglFstb,
          noTtb: proc.ttb,
          tglTtb: proc.tglTtb,
          tglKePicTtb: proc.tglKePicTtb,
          tglKeTimLapangan: proc.tglKeTimLap,
          tglBarangDiantar: proc.tglDiantar,
          tglTimLapKePicTtb: proc.tglTimLapKePicTtb,
          tglTtbKePicPch: proc.tglTtbKePicPch,
          tglKeAdmPch: proc.tglKeAdmPch,
          picAdm: proc.picAdm,
          picPch: proc.picPch,
          picTtb: proc.picTtb,
          picLap: proc.picLap,
          noSpp: proc.spp,
          tglInputSpp: proc.tglSpp,
          tglKeKeuangan: proc.tglKeu,
          qtyFPB: 1,
          qtyPO: proc.po ? 1 : 0,
          qtyFSTB: proc.fstb ? 1 : 0,
          qtyTTB: proc.ttb ? 1 : 0,
          selisih: proc.fstb ? 0 : 1,
          rawStatus: '',
          deliveryTime: proc.deliveryTime,
          statusCheckFpb,
          doneCheckFpb,
          picCheckFpb,
        });

        importedArmada.push({
          id: recordId,
          fpb: proc.fpb,
          armada: proc.armada || (proc.pt ? `Unit Armada ${proc.pt}` : 'Armada Operasional'),
          item: itemDesc,
          qtyFPB: 1,
          qtyFSTB: proc.fstb ? 1 : 0,
          selisih: proc.fstb ? 0 : 1,
          status: fallbackFulfillment.status,
          tglFpb: proc.tglPo,
          noPo: proc.po || '-',
          tglPo: proc.tglPo,
          noFstb: proc.fstb,
          tglFstb: proc.tglFstb,
          noTtb: proc.ttb,
          tglTtb: proc.tglTtb,
          kodeBarang: '-',
          satuan: '',
          keterangan: proc.ket1 || '-',
          kategori: 'Pengadaan',
          entity: proc.pt || 'CPL',
          priority: 'Normal',
          waktuProses: proc.deliveryTime || '-',
          qtyPO: proc.po ? 1 : 0,
          qtyTTB: proc.ttb ? 1 : 0,
          picPch: proc.picPch || '-',
          picTtb: proc.picTtb || '-',
          picLap: proc.picLap || '-',
          picAdm: proc.picAdm || '-',
          deliveryTime: proc.deliveryTime,
          tglTimLapKePicTtb: proc.tglTimLapKePicTtb,
          tglKeKeuangan: proc.tglKeu,
          noSpp: proc.spp,
          statusBadge,
          statusTone,
          lapse,
          lapseText,
          picAktif,
          picCheckFpb,
          tglCheckFpb,
          statusCheckFpb,
          tglApproveWeb,
          noteCheckFpb,
          doneCheckFpb,
          sourceCheckFpb,
          verifiedByFpb,
        });
      }
    }
  }

  const enriched = enrichProcurementAndArmada(importedProcurement, importedArmada);

  return {
    procurement: enriched.procurement,
    armada: enriched.armada,
    stats: {
      totalMlaRows,
      totalProcRows: allProcRecords.length,
      totalBuNoorRows: checkFpbMap.size,
      totalCheckFpbRows: checkFpbMap.size,
      matchedMlaCount,
      unmatchedProcAppended,
      totalMergedProcurement: enriched.procurement.length,
      totalArmadaItems: enriched.armada.length,
    },
  };
}
