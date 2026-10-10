import * as XLSX from 'xlsx';
import { ServiceMaintenanceItem, ServiceMaintenanceSummary } from '@/types/serviceMaintenance';

function formatExcelDate(val: any): string {
  if (!val) return '';
  if (val instanceof Date) {
    if (isNaN(val.getTime())) return '';
    const d = String(val.getDate()).padStart(2, '0');
    const m = String(val.getMonth() + 1).padStart(2, '0');
    const y = val.getFullYear();
    return `${d}/${m}/${y}`;
  }
  if (typeof val === 'number') {
    const date = new Date((val - 25569) * 86400 * 1000);
    if (!isNaN(date.getTime())) {
      const d = String(date.getDate()).padStart(2, '0');
      const m = String(date.getMonth() + 1).padStart(2, '0');
      const y = date.getFullYear();
      return `${d}/${m}/${y}`;
    }
  }
  const str = String(val).trim();
  if (str.includes('T') && str.length >= 10) {
    const parsed = new Date(str);
    if (!isNaN(parsed.getTime())) {
      const d = String(parsed.getDate()).padStart(2, '0');
      const m = String(parsed.getMonth() + 1).padStart(2, '0');
      const y = parsed.getFullYear();
      return `${d}/${m}/${y}`;
    }
  }
  return str;
}

function cleanString(val: any): string {
  if (val === null || val === undefined) return '';
  return String(val).trim();
}

export function parseServiceMaintenanceWorkbook(
  workbook: XLSX.WorkBook,
  defaultVendorName?: string
): { items: ServiceMaintenanceItem[]; summary: ServiceMaintenanceSummary } {
  const allItems: ServiceMaintenanceItem[] = [];

  for (const sheetName of workbook.SheetNames) {
    const worksheet = workbook.Sheets[sheetName];
    if (!worksheet) continue;

    const rawRows = XLSX.utils.sheet_to_json<any[]>(worksheet, { header: 1 });
    if (!rawRows || rawRows.length < 2) continue;

    // Detect vendor title from cell A1 or sheetName or param
    let detectedVendor = defaultVendorName || '';
    const firstCell = cleanString(rawRows[0]?.[0]);
    if (firstCell.toUpperCase().startsWith('SM -') || firstCell.toUpperCase().includes('SM')) {
      detectedVendor = firstCell;
    } else if (sheetName.toUpperCase().startsWith('SM -') || sheetName.toUpperCase().includes('SM')) {
      detectedVendor = sheetName;
    }

    if (!detectedVendor) {
      detectedVendor = 'SM - VENDOR';
    }

    // Find header row index
    let headerIdx = -1;
    let colMap: Record<string, number> = {};

    for (let r = 0; r < Math.min(10, rawRows.length); r++) {
      const row = rawRows[r];
      if (!Array.isArray(row)) continue;

      const upperRow = row.map((c) => cleanString(c).toUpperCase());
      const hasDept = upperRow.some((c) => c.includes('DEPT') || c.includes('ARMADA') || c.includes('KAPAL'));
      const hasItem = upperRow.some((c) => c.includes('ITEM') || c.includes('BARANG') || c.includes('PEKERJAAN'));
      const hasFpbOrPo = upperRow.some((c) => c.includes('FPB') || c.includes('PO'));

      if ((hasDept || hasItem) && hasFpbOrPo) {
        headerIdx = r;
        upperRow.forEach((name, colIdx) => {
          if (!name) return;
          if (name === 'NO' || name.startsWith('NO.')) colMap['no'] = colIdx;
          else if (name.includes('DEPT') || name.includes('KAPAL') || name.includes('ARMADA')) colMap['dept'] = colIdx;
          else if (name.includes('BARANG TURUN') || name.includes('TURUN')) colMap['tglBarangTurun'] = colIdx;
          else if (name.includes('BAPB') || name.includes('BAST')) colMap['bapb'] = colIdx;
          else if (name.includes('KE VENDOR') || name.includes('VENDOR')) colMap['tglKeVendor'] = colIdx;
          else if (name.includes('QUOT') || name.includes('ADMIN')) colMap['quotKeAdmin'] = colIdx;
          else if (name === 'NO FPB' || name.includes('NO. FPB') || (name.includes('FPB') && !name.includes('INPUT'))) colMap['noFpb'] = colIdx;
          else if (name.includes('INPUT FPB')) colMap['inputFpb'] = colIdx;
          else if (name === 'NO PO' || name.includes('NO. PO') || (name.includes('PO') && !name.includes('TANGGAL') && !name.includes('TGL'))) colMap['noPo'] = colIdx;
          else if (name.includes('TANGGAL PO') || name.includes('TGL PO') || name.includes('ANGGAL PO')) colMap['tglPo'] = colIdx;
          else if (name.includes('ITEM') || name.includes('PEKERJAAN')) colMap['item'] = colIdx;
          else if (name === 'KET' || name.includes('KETERANGAN')) colMap['ket'] = colIdx;
          else if (name === 'TYPE' || name.includes('TIPE')) colMap['type'] = colIdx;
          else if (name.includes('SELESAI') || name.includes('FINISH')) colMap['tglSelesai'] = colIdx;
          else if (name.includes('STATUS')) colMap['status'] = colIdx;
        });
        break;
      }
    }

    if (headerIdx === -1) {
      // Default fallback column layout matching screenshot:
      // NO | DEPT | TGL_TURUN | BAPB | TGL_VENDOR | QUOT | NO_FPB | INPUT_FPB | NO_PO | TGL_PO | ITEM | KET | TYPE | TGL_SELESAI | STATUS
      colMap = {
        no: 0,
        dept: 1,
        tglBarangTurun: 2,
        bapb: 3,
        tglKeVendor: 4,
        quotKeAdmin: 5,
        noFpb: 6,
        inputFpb: 7,
        noPo: 8,
        tglPo: 9,
        item: 10,
        ket: 11,
        type: 12,
        tglSelesai: 13,
        status: 14,
      };
      headerIdx = 3; // Row 4 in 1-based index is row 3 in 0-based index
    }

    // Process data rows
    for (let r = headerIdx + 1; r < rawRows.length; r++) {
      const row = rawRows[r];
      if (!Array.isArray(row)) continue;

      const dept = cleanString(colMap['dept'] !== undefined ? row[colMap['dept']] : row[1]);
      const item = cleanString(colMap['item'] !== undefined ? row[colMap['item']] : row[10]);
      const noFpb = cleanString(colMap['noFpb'] !== undefined ? row[colMap['noFpb']] : row[6]);
      const noPo = cleanString(colMap['noPo'] !== undefined ? row[colMap['noPo']] : row[8]);

      // Skip row if it has no meaningful content
      if (!dept && !item && !noFpb && !noPo) continue;

      const rawNo = colMap['no'] !== undefined ? row[colMap['no']] : row[0];
      const no = Number(rawNo) || allItems.length + 1;

      const tglBarangTurun = formatExcelDate(colMap['tglBarangTurun'] !== undefined ? row[colMap['tglBarangTurun']] : row[2]);
      const bapbLink = cleanString(colMap['bapb'] !== undefined ? row[colMap['bapb']] : row[3]);
      const tglKeVendor = formatExcelDate(colMap['tglKeVendor'] !== undefined ? row[colMap['tglKeVendor']] : row[4]);
      const quotKeAdmin = formatExcelDate(colMap['quotKeAdmin'] !== undefined ? row[colMap['quotKeAdmin']] : row[5]);
      const inputFpb = formatExcelDate(colMap['inputFpb'] !== undefined ? row[colMap['inputFpb']] : row[7]);
      const tglPo = formatExcelDate(colMap['tglPo'] !== undefined ? row[colMap['tglPo']] : row[9]);
      const ket = cleanString(colMap['ket'] !== undefined ? row[colMap['ket']] : row[11]);
      const type = cleanString(colMap['type'] !== undefined ? row[colMap['type']] : row[12]);
      const tglSelesai = formatExcelDate(colMap['tglSelesai'] !== undefined ? row[colMap['tglSelesai']] : row[13]);
      
      let status = cleanString(colMap['status'] !== undefined ? row[colMap['status']] : row[14]).toUpperCase();
      if (!status) {
        status = tglSelesai ? 'CLOSE' : 'OPEN';
      }

      allItems.push({
        id: `sm-${detectedVendor}-${no}-${r}`,
        no,
        vendor: detectedVendor,
        dept,
        tglBarangTurun,
        bapbLink,
        tglKeVendor,
        quotKeAdmin,
        noFpb,
        inputFpb,
        noPo,
        tglPo,
        item,
        ket,
        type,
        tglSelesai,
        status,
        sourceSheet: sheetName,
      });
    }
  }

  // Calculate summary
  const totalClose = allItems.filter((i) => i.status === 'CLOSE').length;
  const totalOpen = allItems.filter((i) => i.status === 'OPEN').length;
  const totalHold = allItems.filter((i) => i.status === 'HOLD').length;
  const uniqueVendors = Array.from(new Set(allItems.map((i) => i.vendor).filter(Boolean)));

  const now = new Date();
  const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now
    .getMinutes()
    .toString()
    .padStart(2, '0')}`;

  const summary: ServiceMaintenanceSummary = {
    totalRecords: allItems.length,
    totalClose,
    totalOpen,
    totalHold,
    totalVendors: uniqueVendors.length,
    lastUpdated: timeStr,
  };

  return { items: allItems, summary };
}

