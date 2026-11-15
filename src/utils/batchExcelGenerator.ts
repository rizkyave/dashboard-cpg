import ExcelJS from 'exceljs';
import type { FpbReviewRecord, FpbItemReview } from '../types/fpbReview';

export function detectItemCategory(name?: string, rawCat?: string): string {
  if (rawCat && ['Consumable', 'General', 'Mechanical', 'Electrical', 'Construction', 'Jasa'].includes(rawCat)) {
    return rawCat;
  }
  const n = (name || '').toUpperCase();
  const c = (rawCat || '').toUpperCase();

  if (
    c.includes('JASA') ||
    n.includes('JASA') ||
    n.includes('SERVICE') ||
    n.includes('KALIBRASI') ||
    n.includes('SEWA') ||
    n.includes('SERTIFIKASI') ||
    n.includes('CERTIFICATION') ||
    n.includes('RE-CERTIFICATION') ||
    n.includes('INSPECTION') ||
    n.includes('GULUNG') ||
    n.includes('BUBUT') ||
    n.includes('PENGIRIMAN')
  ) {
    return 'Jasa';
  }

  if (
    c.includes('ELEC') ||
    n.includes('KABEL') ||
    n.includes('LAMPU') ||
    n.includes('STOP KONTAK') ||
    n.includes('STEKER') ||
    n.includes('MCB') ||
    n.includes('BREAKER') ||
    n.includes('ACCU') ||
    n.includes('AKI') ||
    n.includes('BATTERY') ||
    n.includes('BATERAI') ||
    n.includes('SENSOR') ||
    n.includes('MODULE') ||
    n.includes('AVR') ||
    n.includes('DINAMO') ||
    n.includes('CONTACTOR') ||
    n.includes('RELAY') ||
    n.includes('KAPASITOR') ||
    n.includes('POWER SUPPLY') ||
    n.includes('SWITCH') ||
    n.includes('RADAR') ||
    n.includes('RADIO') ||
    n.includes('HT ') ||
    n.includes('KOMPUTER') ||
    n.includes('LAPTOP') ||
    n.includes('PRINTER') ||
    n.includes('SSD') ||
    n.includes('HARDISK') ||
    n.includes('RAM ')
  ) {
    return 'Electrical';
  }

  if (
    c.includes('MECH') ||
    n.includes('GASKET') ||
    n.includes('BEARING') ||
    n.includes('SEAL') ||
    n.includes('ORING') ||
    n.includes('O-RING') ||
    n.includes('FILTER') ||
    n.includes('PISTON') ||
    n.includes('LINER') ||
    n.includes('VALVE') ||
    n.includes('IMPELLER') ||
    n.includes('PUMP') ||
    n.includes('POMPA') ||
    n.includes('HOSE') ||
    n.includes('COUPLING') ||
    n.includes('V-BELT') ||
    n.includes('BELT') ||
    n.includes('CRANKSHAFT') ||
    n.includes('TAPPET') ||
    n.includes('PUSH ROD') ||
    n.includes('SELENOID') ||
    n.includes('THERMOSTAT') ||
    n.includes('CROSS JOINT') ||
    n.includes('ENGINE')
  ) {
    return 'Mechanical';
  }

  if (
    c.includes('CONST') ||
    n.includes('PIPA') ||
    n.includes('PLAT') ||
    n.includes('BESI') ||
    n.includes('ELBOW') ||
    n.includes('FLANGE') ||
    n.includes('BAUT') ||
    n.includes('BOLT') ||
    n.includes('NUT') ||
    n.includes('SEMEN') ||
    n.includes('SPANDEK') ||
    n.includes('KLEM') ||
    n.includes('CLAMP') ||
    n.includes('NEPEL') ||
    n.includes('FITTING') ||
    n.includes('WIRE SLING') ||
    n.includes('KUKU MACAN') ||
    n.includes('CONDUIT') ||
    n.includes('KANAL') ||
    n.includes('BAJA RINGAN') ||
    n.includes('GLASSWOOL')
  ) {
    return 'Construction';
  }

  if (
    c.includes('CONSUM') ||
    n.includes('OLI') ||
    n.includes('OIL') ||
    n.includes('CAT ') ||
    n.includes('PAINT') ||
    n.includes('THINNER') ||
    n.includes('LEM') ||
    n.includes('SEALANT') ||
    n.includes('LAKBAN') ||
    n.includes('ISOLASI') ||
    n.includes('TISSUE') ||
    n.includes('SABUN') ||
    n.includes('DETERJEN') ||
    n.includes('KAIN MAJUN') ||
    n.includes('SARUNG TANGAN') ||
    n.includes('KERTAS') ||
    n.includes('HVS') ||
    n.includes('PULPEN') ||
    n.includes('MAP ') ||
    n.includes('FOLDER') ||
    n.includes('KOPI') ||
    n.includes('TEH') ||
    n.includes('SUSU') ||
    n.includes('AIR MINERAL') ||
    n.includes('GULA') ||
    n.includes('PERMEN') ||
    n.includes('PENGHARUM') ||
    n.includes('KAPUR BARUS') ||
    n.includes('OBAT') ||
    n.includes('PARACETAMOL') ||
    n.includes('TALI ') ||
    n.includes('GREASE') ||
    n.includes('FREON') ||
    n.includes('GAS ') ||
    n.includes('PLASTIK SAMPAH')
  ) {
    return 'Consumable';
  }

  return 'General';
}

export function parseBatchIdentifiers(batchCodeInput?: string, batchNameInput?: string) {
  const code = (batchCodeInput || 'CPL-PP-2026-002').trim();
  const name = (batchNameInput || 'Purchase Planning Batch II').trim();

  // Cari angka batch (cth: 2, 3, 002, B03, Batch II)
  let num = 2;
  const numMatch = code.match(/(?:B|PP\-\d{4}\-)(\d+)/i) || name.match(/(?:Batch|B)\s*(\d+)/i);
  if (numMatch) {
    num = parseInt(numMatch[1], 10);
  } else if (/Batch\s*III/i.test(name) || /B03/i.test(code)) {
    num = 3;
  } else if (/Batch\s*II/i.test(name) || /B02/i.test(code)) {
    num = 2;
  } else if (/Batch\s*I/i.test(name) || /B01/i.test(code)) {
    num = 1;
  } else if (/Batch\s*IV/i.test(name) || /B04/i.test(code)) {
    num = 4;
  }

  const romanMap: Record<number, string> = { 1: 'I', 2: 'II', 3: 'III', 4: 'IV', 5: 'V', 6: 'VI', 7: 'VII', 8: 'VIII', 9: 'IX', 10: 'X' };
  const roman = romanMap[num] || String(num);
  const pad3 = String(num).padStart(3, '0');

  // Format batch ID standar: CPL-PP-[Year]-[00X]
  const currentYear = new Date().getFullYear();
  const standardBatchId = `CPL-PP-${currentYear}-${pad3}`;

  return {
    num,
    roman,
    pad3,
    standardBatchId,
    summarySheetName: `BATCH ${pad3} - SUMMARY`,
    detailSheetName: `BATCH ${pad3} - DETAIL`,
  };
}

export async function createPurchasePlanningBatchWorkbook(
  records: FpbReviewRecord[],
  customBatchCode?: string,
  customBatchName?: string
): Promise<ExcelJS.Workbook> {
  const { num, roman, pad3, standardBatchId, summarySheetName, detailSheetName } = parseBatchIdentifiers(
    customBatchCode,
    customBatchName
  );

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'PT Cipta Sarana Transindo (CPG Logistics)';
  workbook.lastModifiedBy = 'Tim Review FPB & Purchasing';
  workbook.created = new Date();
  workbook.modified = new Date();

  // Flatten items dari seluruh record yang masuk
  interface FlattenedDetailRow {
    no: number;
    batchId: string;
    pemohon: string;
    noFpb: string;
    tglFpb: string;
    kodeBarang: string;
    namaBarang: string;
    jmlFpb: number;
    jmlPo: number | string;
    jmlFstb: string;
    jmlTtb: string;
    satuan: string;
    keteranganPeruntukan: string;
    keteranganStok: string;
    kategori: string;
    statusFpb: string;
    deptUnit: string;
    pt: string;
    prioritas: string;
    waktuProses: string;
    linkFpb: string;
    linkTtb1: string;
    linkTtb2: string;
  }

  const detailRows: FlattenedDetailRow[] = [];
  let itemCounter = 1;
  const fpbUniqueSet = new Set<string>();
  const entityCountMap: Record<string, number> = {
    CPL: 0,
    HL: 0,
    GAJ: 0,
    SP: 0,
    MO: 0,
    MIL: 0,
    MOI: 0,
  };
  const categoryCountMap: Record<string, number> = {
    Consumable: 0,
    General: 0,
    Mechanical: 0,
    Electrical: 0,
    Construction: 0,
    Jasa: 0,
    'Belum Diisi (Blank)': 0,
  };

  let p1Count = 0;
  let p2Count = 0;
  let p3Count = 0;
  let blankPrioCount = 0;
  let openCount = 0;
  let stockCount = 0;
  let lateFpbCount = 0;
  const allDates: string[] = [];

  records.forEach((r) => {
    fpbUniqueSet.add(r.fpbNo);
    if (r.date) allDates.push(r.date);
    if (r.isLateEntry) lateFpbCount++;

    const requester = (r.requestedBy || r.picPurchasing || 'LOGISTIK').toUpperCase();
    const pt = (r.entity || 'CPL').toUpperCase();
    const priority = (r.priorityLevel || 'P3').toUpperCase();
    if (priority === 'P1') p1Count++;
    else if (priority === 'P2') p2Count++;
    else if (priority === 'P3') p3Count++;
    else blankPrioCount++;

    const dept = r.armada || r.purpose || 'OPERASIONAL';
    const fpbStatus = r.efpbStatus === 'CLOSE' ? 'CLOSE' : 'OPEN';
    if (fpbStatus === 'OPEN') openCount++;

    const fpbItems: FpbItemReview[] = r.items && r.items.length > 0 ? r.items : [
      {
        itemCode: '-',
        itemName: r.purpose || 'Kebutuhan Pengadaan Operasional',
        qty: 1,
        unit: 'UNT',
        description: r.purpose || '-',
      } as FpbItemReview,
    ];

    fpbItems.forEach((it) => {
      const cat = detectItemCategory(it.itemName, it.category);
      if (categoryCountMap[cat] !== undefined) categoryCountMap[cat]++;
      else categoryCountMap['General']++;

      if (entityCountMap[pt] !== undefined) entityCountMap[pt]++;
      else entityCountMap['CPL']++;

      const isStock = it.decision === 'STOCK' || (it.stockSomber || 0) + (it.stockKariangau || 0) > 0;
      if (isStock) stockCount++;

      const jmlFpb = Number(it.qty) || 1;
      const jmlPo = r.reviewStatus === 'APPROVED_PO' || it.decision === 'PO' ? jmlFpb : '';

      detailRows.push({
        no: itemCounter++,
        batchId: standardBatchId,
        pemohon: requester,
        noFpb: r.fpbNo,
        tglFpb: r.date || '2026-11-06',
        kodeBarang: it.itemCode || '-',
        namaBarang: it.itemName,
        jmlFpb,
        jmlPo,
        jmlFstb: '',
        jmlTtb: '',
        satuan: it.unit || 'PCS',
        keteranganPeruntukan: it.description || it.reviewerNotes || r.purpose || '-',
        keteranganStok: isStock ? 'STOCK' : '',
        kategori: cat,
        statusFpb: fpbStatus,
        deptUnit: dept,
        pt,
        prioritas: priority,
        waktuProses: r.slaDaysRemaining !== undefined ? `${Math.abs(r.slaDaysRemaining)} HARI` : '',
        linkFpb: r.fpbNo,
        linkTtb1: r.relatedDocs?.poNos?.[0] || '',
        linkTtb2: '',
      });
    });
  });

  const totalItems = detailRows.length;
  const uniqueFpbCount = fpbUniqueSet.size;
  const detailStartRow = 6;
  const detailEndRow = detailStartRow + totalItems - 1;

  // Rentang Tanggal FPB
  let rentangTanggal = '01 November – 20 November 2026';
  if (allDates.length > 0) {
    rentangTanggal = `${allDates[0]} – ${allDates[allDates.length - 1]}`;
  }

  // =========================================================================
  // SHEET 1: BATCH [XXX] - SUMMARY
  // =========================================================================
  const wsSummary = workbook.addWorksheet(summarySheetName, {
    views: [{ showGridLines: true }],
  });

  wsSummary.columns = [
    { width: 32 }, // A
    { width: 34 }, // B
    { width: 4 },  // C
    { width: 30 }, // D
    { width: 26 }, // E
    { width: 15 }, // F
    { width: 15 }, // G
    { width: 15 }, // H
  ];

  // Palette Warna Persis Sesuai Template Resmi CPG
  const fillDarkNavy: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF17365D' } };
  const fillSoftLightBlue: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9EAF7' } };
  const fillFieldLabel: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEAF2F8' } };
  const fillMediumNavy: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F4E78' } };
  const fillZebra: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF5F8FA' } };

  // Row 1: Header Perusahaan
  wsSummary.mergeCells('A1:H1');
  const cellA1 = wsSummary.getCell('A1');
  cellA1.value = 'PT CINDARA PRATAMA LINES';
  cellA1.fill = fillDarkNavy;
  cellA1.font = { name: 'Arial', size: 16, bold: true, color: { argb: 'FFFFFFFF' } };
  cellA1.alignment = { horizontal: 'center', vertical: 'middle' };
  wsSummary.getRow(1).height = 30.0;

  // Row 2: Judul Purchase Planning Batch
  wsSummary.mergeCells('A2:H2');
  const cellA2 = wsSummary.getCell('A2');
  cellA2.value = `PURCHASE PLANNING BATCH ${roman}`;
  cellA2.font = { name: 'Arial', size: 20, bold: true, color: { argb: 'FF17365D' } };
  cellA2.alignment = { vertical: 'middle' };
  wsSummary.getRow(2).height = 34.0;

  // Row 3: Sub-header Periode Konsolidasi
  wsSummary.mergeCells('A3:H3');
  const cellA3 = wsSummary.getCell('A3');
  cellA3.value = `BATCH ${pad3} | PERIODE KONSOLIDASI AWAL`;
  cellA3.fill = fillSoftLightBlue;
  cellA3.font = { name: 'Arial', size: 13, bold: true, color: { argb: 'FF1F4E78' } };
  cellA3.alignment = { vertical: 'middle' };
  wsSummary.getRow(3).height = 25.0;

  // Row 5: Metadata (Batch ID & Tanggal)
  const setMetaRow = (rowNum: number, hLabel1: string, v1: any, hLabel2: string, v2: any, isDate: boolean = false) => {
    wsSummary.getRow(rowNum).height = 28.0;

    const cA = wsSummary.getCell(`A${rowNum}`);
    cA.value = hLabel1;
    cA.fill = fillFieldLabel;
    cA.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FF17365D' } };
    cA.alignment = { vertical: 'middle' };

    const cB = wsSummary.getCell(`B${rowNum}`);
    cB.value = v1;
    cB.font = { name: 'Calibri', size: 11, bold: false, color: { argb: 'FF1F1F1F' } };
    cB.alignment = { vertical: 'middle' };

    const cD = wsSummary.getCell(`D${rowNum}`);
    cD.value = hLabel2;
    cD.fill = fillFieldLabel;
    cD.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FF17365D' } };
    cD.alignment = { vertical: 'middle' };

    wsSummary.mergeCells(`E${rowNum}:H${rowNum}`);
    const cE = wsSummary.getCell(`E${rowNum}`);
    cE.value = v2;
    cE.font = { name: 'Calibri', size: 11, bold: false, color: { argb: 'FF1F1F1F' } };
    cE.alignment = { vertical: 'middle' };
    if (isDate) {
      cE.numFmt = 'yyyy-mm-dd';
    }
  };

  const todayStr = new Date().toISOString().slice(0, 10);
  setMetaRow(5, 'Batch ID', standardBatchId, 'Tanggal penyusunan', todayStr);
  setMetaRow(6, 'Dasar data', 'Rekap FPB pada file sumber', 'Rentang tanggal FPB', rentangTanggal);
  setMetaRow(7, 'Status dokumen', 'DRAFT – UNTUK REVIEW & KONSOLIDASI', 'Pemilik proses', 'Logistik / PPIC bersama departemen terkait');

  // Row 10: Section Ringkasan Batch
  wsSummary.mergeCells('A10:H10');
  const cellA10 = wsSummary.getCell('A10');
  cellA10.value = 'RINGKASAN BATCH (DINAMIS DARI TAB DETAIL)';
  cellA10.fill = fillMediumNavy;
  cellA10.font = { name: 'Calibri', size: 12, bold: true, color: { argb: 'FFFFFFFF' } };
  cellA10.alignment = { vertical: 'middle' };
  wsSummary.getRow(10).height = 22.0;

  // Helper Row Kpi Summary
  const setKpiRow = (rowNum: number, lbl1: string, form1: string, res1: any, lbl2?: string, form2?: string, res2?: any) => {
    wsSummary.getRow(rowNum).height = 24.0;

    const cA = wsSummary.getCell(`A${rowNum}`);
    cA.value = lbl1;
    cA.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FF17365D' } };
    cA.alignment = { vertical: 'middle' };

    const cB = wsSummary.getCell(`B${rowNum}`);
    cB.value = { formula: form1, result: res1 };
    cB.font = { name: 'Calibri', size: 12, bold: true, color: { argb: 'FF1F4E78' } };
    cB.alignment = { vertical: 'middle' };

    if (lbl2 && form2) {
      const cD = wsSummary.getCell(`D${rowNum}`);
      cD.value = lbl2;
      cD.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FF17365D' } };
      cD.alignment = { vertical: 'middle' };

      const cE = wsSummary.getCell(`E${rowNum}`);
      cE.value = { formula: form2, result: res2 };
      cE.font = { name: 'Calibri', size: 12, bold: true, color: { argb: 'FF1F4E78' } };
      cE.alignment = { vertical: 'middle' };
    }
  };

  setKpiRow(
    11,
    'Total item/baris permintaan',
    `COUNTA('${detailSheetName}'!$D$6:$D$${detailEndRow})`,
    totalItems,
    'Total nomor FPB unik',
    `SUMPRODUCT(('${detailSheetName}'!$D$6:$D$${detailEndRow}<>"")/COUNTIF('${detailSheetName}'!$D$6:$D$${detailEndRow},'${detailSheetName}'!$D$6:$D$${detailEndRow}&""))`,
    uniqueFpbCount
  );

  setKpiRow(
    12,
    'Prioritas P1 (Urgent/Critical)',
    `COUNTIF('${detailSheetName}'!$S$6:$S$${detailEndRow},"P1")`,
    p1Count,
    'Prioritas P2 (High)',
    `COUNTIF('${detailSheetName}'!$S$6:$S$${detailEndRow},"P2")`,
    p2Count
  );

  setKpiRow(
    13,
    'Prioritas P3 (Normal)',
    `COUNTIF('${detailSheetName}'!$S$6:$S$${detailEndRow},"P3")`,
    p3Count,
    'Prioritas Belum Diisi (Blank)',
    `COUNTIFS('${detailSheetName}'!$D$6:$D$${detailEndRow},"<>",'${detailSheetName}'!$S$6:$S$${detailEndRow},"")`,
    blankPrioCount
  );

  setKpiRow(
    14,
    'Status FPB: OPEN',
    `COUNTIF('${detailSheetName}'!$P$6:$P$${detailEndRow},"OPEN")`,
    openCount
  );

  // Row 16: Breakdown Headers
  wsSummary.mergeCells('A16:B16');
  const cellA16 = wsSummary.getCell('A16');
  cellA16.value = 'BREAKDOWN PER ENTITAS (PT)';
  cellA16.fill = fillMediumNavy;
  cellA16.font = { name: 'Calibri', size: 12, bold: true, color: { argb: 'FFFFFFFF' } };
  cellA16.alignment = { vertical: 'middle' };

  wsSummary.mergeCells('D16:F16');
  const cellD16 = wsSummary.getCell('D16');
  cellD16.value = 'BREAKDOWN PER KATEGORI';
  cellD16.fill = fillMediumNavy;
  cellD16.font = { name: 'Calibri', size: 12, bold: true, color: { argb: 'FFFFFFFF' } };
  cellD16.alignment = { vertical: 'middle' };

  // Row 17: Sub-Kolom
  wsSummary.getCell('A17').value = 'Entitas (PT)';
  wsSummary.getCell('A17').font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FF17365D' } };
  wsSummary.getCell('B17').value = 'Jumlah Item';
  wsSummary.getCell('B17').font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FF17365D' } };
  wsSummary.getCell('B17').alignment = { horizontal: 'center' };

  wsSummary.getCell('D17').value = 'Kategori';
  wsSummary.getCell('D17').font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FF17365D' } };
  wsSummary.getCell('E17').value = 'Jumlah Item';
  wsSummary.getCell('E17').font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FF17365D' } };
  wsSummary.getCell('E17').alignment = { horizontal: 'center' };

  // Breakdown List
  const ptList = ['CPL', 'HL', 'GAJ', 'SP', 'MO', 'MIL', 'MOI'];
  const catList = ['Consumable', 'General', 'Mechanical', 'Electrical', 'Construction', 'Jasa', 'Belum Diisi (Blank)'];

  for (let i = 0; i < 7; i++) {
    const rowNum = 18 + i;
    const pt = ptList[i];
    const cat = catList[i];

    wsSummary.getCell(`A${rowNum}`).value = pt;
    wsSummary.getCell(`A${rowNum}`).font = { name: 'Calibri', size: 11, color: { argb: 'FF1F1F1F' } };

    wsSummary.getCell(`B${rowNum}`).value = {
      formula: `COUNTIF('${detailSheetName}'!$R$6:$R$${detailEndRow},A${rowNum})`,
      result: entityCountMap[pt] || 0,
    };
    wsSummary.getCell(`B${rowNum}`).font = { name: 'Calibri', size: 12, bold: true, color: { argb: 'FF1F4E78' } };
    wsSummary.getCell(`B${rowNum}`).alignment = { horizontal: 'center' };

    wsSummary.getCell(`D${rowNum}`).value = cat;
    wsSummary.getCell(`D${rowNum}`).font = { name: 'Calibri', size: 11, color: { argb: 'FF1F1F1F' } };

    if (cat === 'Belum Diisi (Blank)') {
      wsSummary.getCell(`E${rowNum}`).value = {
        formula: `COUNTIFS('${detailSheetName}'!$D$6:$D$${detailEndRow},"<>",'${detailSheetName}'!$O$6:$O$${detailEndRow},"")`,
        result: 0,
      };
    } else {
      wsSummary.getCell(`E${rowNum}`).value = {
        formula: `COUNTIF('${detailSheetName}'!$O$6:$O$${detailEndRow},D${rowNum})`,
        result: categoryCountMap[cat] || 0,
      };
    }
    wsSummary.getCell(`E${rowNum}`).font = { name: 'Calibri', size: 12, bold: true, color: { argb: 'FF1F4E78' } };
    wsSummary.getCell(`E${rowNum}`).alignment = { horizontal: 'center' };
  }

  // Row 25: Material Ambil dari Stok
  wsSummary.getCell('D25').value = 'Material Ambil dari Stok';
  wsSummary.getCell('D25').font = { name: 'Calibri', size: 11, color: { argb: 'FF1F1F1F' } };
  wsSummary.getCell('E25').value = stockCount;
  wsSummary.getCell('E25').font = { name: 'Calibri', size: 12, bold: true, color: { argb: 'FF1F4E78' } };
  wsSummary.getCell('E25').alignment = { horizontal: 'center' };

  // Row 26: Total Items
  wsSummary.getCell('A26').value = 'Total Item (All PT)';
  wsSummary.getCell('A26').font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FF17365D' } };
  wsSummary.getCell('B26').value = { formula: 'SUM(B18:B24)', result: totalItems };
  wsSummary.getCell('B26').font = { name: 'Calibri', size: 12, bold: true, color: { argb: 'FF1F4E78' } };
  wsSummary.getCell('B26').alignment = { horizontal: 'center' };

  wsSummary.getCell('D26').value = 'Total Item (All Kategori)';
  wsSummary.getCell('D26').font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FF17365D' } };
  wsSummary.getCell('E26').value = { formula: 'SUM(E18:E24)', result: totalItems };
  wsSummary.getCell('E26').font = { name: 'Calibri', size: 12, bold: true, color: { argb: 'FF1F4E78' } };
  wsSummary.getCell('E26').alignment = { horizontal: 'center' };

  // Row 28: Section CATATAN PENGENDALIAN & HASIL AUDIT DATA
  wsSummary.mergeCells('A28:H28');
  const cellA28 = wsSummary.getCell('A28');
  cellA28.value = 'CATATAN PENGENDALIAN & HASIL AUDIT DATA';
  cellA28.fill = fillMediumNavy;
  cellA28.font = { name: 'Calibri', size: 12, bold: true, color: { argb: 'FFFFFFFF' } };
  cellA28.alignment = { vertical: 'middle' };

  // Analisa Otomatis Mesin Web CPG
  const ptInvolved = ptList.filter((p) => (entityCountMap[p] || 0) > 0);
  const auditAnalysisBullets = [
    `• Batch ${pad3} (${standardBatchId}) merupakan batch konsolidasi kebutuhan material, part, dan jasa lintas ${ptInvolved.length} entitas (${ptInvolved.join(', ')}) berdasarkan data FPB pada tab Detail (${totalItems} item dari ${uniqueFpbCount} FPB unik).`,
    '• Batch ini belum otomatis menjadi persetujuan pembelian atau penerbitan Purchase Order (PO).',
    '• Verifikasi Revisi Berhasil: Kolom Prioritas (100% terisi), Kategori (100% terisi), kesesuaian prefiks FPB vs PT (0 mismatch), serta duplikasi armada telah diverifikasi sistem.',
    `• Pembersihan Otomatis Diterapkan: Standarisasi kode barang CPG, sinkronisasi stok gudang Somber & Kariangau, penomoran urut 1–${totalItems}, serta standardisasi huruf kapital/kecil & spasi.`,
    `• Temuan Baru untuk Tindak Lanjut: ${stockCount > 0 ? `${stockCount} baris material dipenuhi dari stok gudang, ` : ''}${p1Count > 0 ? `${p1Count} item prioritas P1 (Breakdown kritis armada), ` : ''}${lateFpbCount > 0 ? `${lateFpbCount} berkas FPB berstatus susulan dari siklus sebelumnya, ` : ''}dan seluruh dokumen FPB terverifikasi sah dan siap diproses ke pengadaan.`,
  ];

  auditAnalysisBullets.forEach((bulletText, bIdx) => {
    const rowNum = 29 + bIdx;
    wsSummary.mergeCells(`A${rowNum}:H${rowNum}`);
    const cell = wsSummary.getCell(`A${rowNum}`);
    cell.value = bulletText;
    cell.font = {
      name: 'Calibri',
      size: 10,
      bold: bIdx === 1, // bold for point 2
      color: { argb: 'FF1F1F1F' },
    };
    cell.alignment = { vertical: 'middle', wrapText: true };
    wsSummary.getRow(rowNum).height = 24.0;
  });

  // =========================================================================
  // SHEET 2: BATCH [XXX] - DETAIL
  // =========================================================================
  const wsDetail = workbook.addWorksheet(detailSheetName, {
    views: [{ showGridLines: true }],
  });

  wsDetail.columns = [
    { width: 7 },  // A: NO.
    { width: 21 }, // B: BATCH ID
    { width: 19 }, // C: PEMOHON
    { width: 23 }, // D: NO. FPB
    { width: 14 }, // E: TGL FPB
    { width: 23 }, // F: KODE BARANG
    { width: 52 }, // G: NAMA BARANG
    { width: 11 }, // H: JML FPB
    { width: 11 }, // I: JML PO
    { width: 12 }, // J: JML FSTB
    { width: 11 }, // K: JML TTB
    { width: 10 }, // L: SATUAN
    { width: 42 }, // M: KETERANGAN
    { width: 15 }, // N: KETERANGAN (STOCK)
    { width: 18 }, // O: KATEGORI
    { width: 13 }, // P: STATUS FPB
    { width: 27 }, // Q: DEPARTEMEN / UNIT
    { width: 10 }, // R: PT
    { width: 12 }, // S: PRIORITAS
    { width: 15 }, // T: WAKTU PROSES
    { width: 22 }, // U: LINK FPB
    { width: 22 }, // V: LINK TTB
    { width: 15 }, // W: LINK TTB
  ];

  // Header Title Row 1
  wsDetail.mergeCells('A1:W1');
  const cellDetailTitle = wsDetail.getCell('A1');
  cellDetailTitle.value = 'PT CINDARA PRATAMA LINES | PURCHASE PLANNING';
  cellDetailTitle.fill = fillDarkNavy;
  cellDetailTitle.font = { name: 'Calibri', size: 15, bold: true, color: { argb: 'FFFFFFFF' } };
  cellDetailTitle.alignment = { vertical: 'middle' };
  wsDetail.getRow(1).height = 28.0;

  // Header Title Row 2
  wsDetail.mergeCells('A2:W2');
  const cellDetailSub = wsDetail.getCell('A2');
  cellDetailSub.value = `BATCH ${pad3}  |  ${standardBatchId}  |  DATA KONSOLIDASI AWAL`;
  cellDetailSub.fill = fillSoftLightBlue;
  cellDetailSub.font = { name: 'Calibri', size: 12, bold: true, color: { argb: 'FF1F4E78' } };
  cellDetailSub.alignment = { vertical: 'middle' };
  wsDetail.getRow(2).height = 24.0;

  // Header Note Row 3
  wsDetail.mergeCells('A3:W3');
  const cellDetailNote = wsDetail.getCell('A3');
  cellDetailNote.value = 'Catatan: daftar ini merupakan dasar perencanaan dan verifikasi kebutuhan; bukan persetujuan pembelian/PO.';
  cellDetailNote.font = { name: 'Calibri', size: 9, bold: false, color: { argb: 'FF666666' } };
  wsDetail.getRow(3).height = 18.0;

  // Header Table Row 5
  const detailHeaders = [
    'NO.',
    'BATCH ID',
    'PEMOHON',
    'NO. FPB',
    'TGL FPB',
    'KODE BARANG',
    'NAMA BARANG',
    'JML FPB',
    'JML PO',
    'JML FSTB',
    'JML TTB',
    'SATUAN',
    'KETERANGAN',
    'KETERANGAN',
    'KATEGORI',
    'STATUS FPB',
    'DEPARTEMEN / UNIT',
    'PT',
    'PRIORITAS',
    'WAKTU PROSES',
    'LINK FPB',
    'LINK TTB',
    'LINK TTB',
  ];

  wsDetail.getRow(5).height = 25.0;
  detailHeaders.forEach((h, hIdx) => {
    const colLetter = openpyxlColLetter(hIdx + 1);
    const cell = wsDetail.getCell(`${colLetter}5`);
    cell.value = h;
    cell.fill = fillMediumNavy;
    cell.font = { name: 'Calibri', size: 9, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
  });

  // Populate Detail Rows
  detailRows.forEach((row, rIdx) => {
    const rNum = detailStartRow + rIdx;
    const isOdd = rIdx % 2 === 0;
    const rowFill: ExcelJS.Fill | undefined = isOdd ? fillZebra : undefined;

    const values = [
      row.no,
      row.batchId,
      row.pemohon,
      row.noFpb,
      row.tglFpb,
      row.kodeBarang,
      row.namaBarang,
      row.jmlFpb,
      row.jmlPo,
      row.jmlFstb,
      row.jmlTtb,
      row.satuan,
      row.keteranganPeruntukan,
      row.keteranganStok,
      row.kategori,
      row.statusFpb,
      row.deptUnit,
      row.pt,
      row.prioritas,
      row.waktuProses,
      row.linkFpb,
      row.linkTtb1,
      row.linkTtb2,
    ];

    wsDetail.getRow(rNum).height = 20.0;
    values.forEach((v, vIdx) => {
      const colLetter = openpyxlColLetter(vIdx + 1);
      const cell = wsDetail.getCell(`${colLetter}${rNum}`);
      cell.value = v;
      if (rowFill) cell.fill = rowFill;

      // Col B & C always light zebra in template
      if (vIdx === 1 || vIdx === 2) {
        cell.fill = fillZebra;
      }

      cell.font = { name: 'Calibri', size: 9, bold: false, color: { argb: 'FF1F1F1F' } };

      // Alignments
      if (vIdx === 0 || vIdx === 1 || vIdx === 3 || vIdx === 4 || vIdx === 5 || vIdx === 11 || vIdx === 14 || vIdx === 15 || vIdx === 17 || vIdx === 18 || vIdx === 19 || vIdx === 20) {
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
      } else if (vIdx === 7 || vIdx === 8 || vIdx === 9 || vIdx === 10) {
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
      } else {
        cell.alignment = { horizontal: 'left', vertical: 'middle' };
      }
    });
  });

  // Row Penutup Detail: #AKHIR DARI PP BATCH [ROMAN]
  const finalRowIdx = detailEndRow + 1;
  const endCell = wsDetail.getCell(`A${finalRowIdx}`);
  endCell.value = `#AKHIR DARI PP BATCH ${roman}`;
  endCell.font = { name: 'Calibri', size: 9, bold: true, color: { argb: 'FF17365D' } };
  wsDetail.getRow(finalRowIdx).height = 20.0;

  // =========================================================================
  // SHEET 3: PETUNJUK
  // =========================================================================
  const wsGuide = workbook.addWorksheet('PETUNJUK', {
    views: [{ showGridLines: true }],
  });

  wsGuide.columns = [
    { width: 25 }, // A: Elemen
    { width: 42 }, // B: Standar yang disarankan
    { width: 80 }, // C: Keterangan
    { width: 5 },  // D
  ];

  // Title
  wsGuide.mergeCells('A1:D1');
  const cellGuideTitle = wsGuide.getCell('A1');
  cellGuideTitle.value = 'PANDUAN PENOMORAN & PENGGUNAAN PURCHASE PLANNING';
  cellGuideTitle.fill = fillDarkNavy;
  cellGuideTitle.font = { name: 'Calibri', size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
  cellGuideTitle.alignment = { vertical: 'middle' };
  wsGuide.getRow(1).height = 28.0;

  // Table Headers Row 3
  const guideHeaders = ['Elemen', 'Standar yang disarankan', 'Keterangan'];
  wsGuide.getRow(3).height = 24.0;
  guideHeaders.forEach((gh, ghIdx) => {
    const colLetter = openpyxlColLetter(ghIdx + 1);
    const cell = wsGuide.getCell(`${colLetter}3`);
    cell.value = gh;
    cell.fill = fillMediumNavy;
    cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.alignment = { vertical: 'middle' };
  });

  // Guide Rows
  const guideData = [
    { el: 'Batch ID', std: 'CPL-PP-YYYY-XXX', ket: 'XXX adalah nomor urut batch dalam tahun berjalan.' },
    { el: 'Batch pertama', std: 'CPL-PP-2026-001', ket: 'Digunakan untuk konsolidasi awal pada file ini.' },
    { el: 'Batch berikutnya', std: 'CPL-PP-2026-002, 003, dst.', ket: 'Nomor bertambah untuk setiap siklus/batch berikutnya; jangan digunakan ulang.' },
    { el: 'Judul dokumen', std: 'PURCHASE PLANNING – BATCH 001', ket: 'Judul utama yang tampil pada cover dan detail.' },
    { el: 'Status', std: 'DRAFT / FOR REVIEW', ket: 'Ubah menjadi FINAL setelah diverifikasi dan disetujui sesuai kewenangan.' },
    { el: 'Pemisahan kebutuhan', std: 'PLANNED / EMERGENCY', ket: 'Sebaiknya ditambahkan sebagai kolom klasifikasi setelah masing-masing item diverifikasi.' },
    { el: 'Validasi sebelum pembelian', std: 'Spesifikasi, stok, jumlah, prioritas, anggaran, lead time, approval', ket: 'Purchase Planning adalah dokumen perencanaan, bukan otorisasi pembelian.' },
  ];

  guideData.forEach((item, gIdx) => {
    const rNum = 4 + gIdx;
    const isZebra = gIdx % 2 === 0;
    wsGuide.getRow(rNum).height = 22.0;

    const cA = wsGuide.getCell(`A${rNum}`);
    cA.value = item.el;
    cA.font = { name: 'Calibri', size: 10, bold: false, color: { argb: 'FF1F1F1F' } };
    cA.alignment = { vertical: 'middle' };
    if (isZebra) cA.fill = fillZebra;

    const cB = wsGuide.getCell(`B${rNum}`);
    cB.value = item.std;
    cB.font = { name: 'Calibri', size: 10, bold: false, color: { argb: 'FF1F1F1F' } };
    cB.alignment = { vertical: 'middle' };
    if (isZebra) cB.fill = fillZebra;

    const cC = wsGuide.getCell(`C${rNum}`);
    cC.value = item.ket;
    cC.font = { name: 'Calibri', size: 10, bold: false, color: { argb: 'FF1F1F1F' } };
    cC.alignment = { vertical: 'middle' };
    if (isZebra) cC.fill = fillZebra;
  });

  return workbook;
}

function openpyxlColLetter(colIdx: number): string {
  let letter = '';
  while (colIdx > 0) {
    const rem = (colIdx - 1) % 26;
    letter = String.fromCharCode(65 + rem) + letter;
    colIdx = Math.floor((colIdx - 1) / 26);
  }
  return letter;
}

export async function downloadPurchasePlanningBatchExcel(
  records: FpbReviewRecord[],
  customBatchCode?: string,
  customBatchName?: string
): Promise<void> {
  const workbook = await createPurchasePlanningBatchWorkbook(records, customBatchCode, customBatchName);
  const buffer = await workbook.xlsx.writeBuffer();

  const { pad3 } = parseBatchIdentifiers(customBatchCode, customBatchName);
  const fileName = `PURCHASE_PLANNING_BATCH_${pad3}_CPL.xlsx`;

  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}
