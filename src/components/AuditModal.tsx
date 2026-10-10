'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  ShieldCheck,
  Sparkles,
  X,
  MessageSquare,
  Check,
  ShoppingBag,
  PackageCheck,
  HardHat,
  Landmark,
  FileCheck,
  FileText,
  ExternalLink,
  Download,
  RefreshCw,
  CheckCircle2,
  Boxes,
  Camera,
  Clock,
  Calendar,
  Wrench,
  ClipboardCheck,
  AlertTriangle,
  Printer,
} from 'lucide-react';
import { ProcurementItem, ArmadaItem, InventoryItem } from '@/types/procurement';
import StockAuditModal from './StockAuditModal';
import TimemarkModal from './TimemarkModal';
import { extractFstbLast5, openTimemarkWithFstb, parseTtbList } from '@/utils/timemark';
import { updatePdfItemsCacheForFpb } from '@/utils/appStorage';
import { formatDateDdMmYy } from '@/utils/formatDate';
import { cleanSingleDescription, deduplicateDescriptions, cleanTujuanPeruntukan } from '@/utils/descriptionCleaner';
import { isItemJasa, determineTransactionCategory, ProcurementCategory, normalizeJasaUnit } from '@/utils/jasaClassifier';
import { useAuth } from '@/context/AuthContext';
import WorkflowTrafficLight from './WorkflowTrafficLight';

interface AuditModalProps {
  fpbNumber: string | null;
  targetPo?: string | null;
  procurementList: ProcurementItem[];
  armadaList: ArmadaItem[];
  inventoryItems?: InventoryItem[];
  onClose: () => void;
  showToast: (msg: string, type?: 'info' | 'success' | 'warning' | 'error') => void;
  onUpdateWorkOrderNo?: (fpb: string, woNo: string) => void;
}

export default function AuditModal({
  fpbNumber,
  targetPo,
  procurementList,
  armadaList,
  inventoryItems = [],
  onClose,
  showToast,
  onUpdateWorkOrderNo,
}: AuditModalProps) {
  const { isVisitor } = useAuth();
  const [showAiRisk, setShowAiRisk] = useState<boolean>(false);
  const [pdfData, setPdfData] = useState<{
    fpbNo: string;
    fpbDate?: string;
    userArmada?: string;
    workOrderNo?: string;
    requestedBy?: string;
    requestedDate?: string;
    requestedTimestamp?: string;
    reviewedBy?: string;
    reviewedDate?: string;
    approvedBy?: string;
    approvedDate?: string;
    receivedBy?: string;
    receivedDate?: string;
    isLogistikApproved?: boolean;
    items: Array<{
      no: number;
      itemCode: string;
      itemName: string;
      qty: number;
      unit: string;
      description: string;
      lastDate: string;
      priority: string;
    }>;
    tujuanPeruntukan?: string;
    tanggalPenerimaanTerakhir?: string;
    pdfUrl?: string;
  } | null>(null);
  const [isLoadingPdf, setIsLoadingPdf] = useState<boolean>(false);
  const [showStockModal, setShowStockModal] = useState<boolean>(false);
  const [showTimemarkModal, setShowTimemarkModal] = useState<boolean>(false);
  const [selectedTtbForPhoto, setSelectedTtbForPhoto] = useState<string | null>(null);
  const [internalInventory, setInternalInventory] = useState<InventoryItem[]>([]);

  // Fallback auto-fetch inventory if not yet passed from parent
  useEffect(() => {
    if (inventoryItems && inventoryItems.length > 0) {
      setInternalInventory(inventoryItems);
    } else {
      fetch('/api/inventory')
        .then((res) => res.json())
        .then((data) => {
          if (data.success && data.items) {
            setInternalInventory(data.items);
          }
        })
        .catch(() => {});
    }
  }, [inventoryItems]);

  const activeInventory = inventoryItems.length > 0 ? inventoryItems : internalInventory;

  // Check if target PO is empty / '-' / '(kosong)'
  const isNoPo = !targetPo || targetPo.trim() === '' || targetPo === '-' || targetPo === '(kosong)' || targetPo === 'NOPO';

  // Find exact procurement item:
  // If targetPo is specified and not empty, find by that PO first
  // If PO is empty, strictly find a record for this FPB that has no PO (po === '-' or empty)
  const itemS1 = !isNoPo
    ? procurementList.find((i) => i.po === targetPo) || procurementList.find((i) => i.fpb === fpbNumber)
    : procurementList.find((i) => i.fpb === fpbNumber && (!i.po || i.po === '-' || i.po === '(kosong)')) ||
      procurementList.find((i) => i.fpb === fpbNumber);

  // Active PO: strictly null if isNoPo!
  const activePo = !isNoPo ? (targetPo || (itemS1?.po && itemS1.po !== '-' ? itemS1.po : null)) : null;

  // Filter armada list:
  // 1. If activePo is available, match strictly by that PO
  // 2. If isNoPo, filter strictly by items under that FPB that DO NOT have a PO
  // 3. Fallback to all items with that FPB
  const poMatchingItems = activePo
    ? armadaList.filter((i) => i.noPo === activePo)
    : isNoPo
    ? armadaList.filter((i) => i.fpb === fpbNumber && (!i.noPo || i.noPo === '-' || i.noPo === ''))
    : [];

  const itemsS2 = poMatchingItems.length > 0
    ? poMatchingItems
    : armadaList.filter((i) => i.fpb === fpbNumber);

  // Nomor Work Order (terpadu dari header e-FPB maupun Form Responses 1 Google Sheets)
  const effectiveWorkOrderNo = pdfData?.workOrderNo || itemS1?.workOrderNo || itemsS2[0]?.workOrderNo || '';

  // Compile all requested items from e-FPB / Armada / Procurement for warehouse stock matching
  const requestedFpbItems = useMemo(() => {
    const list: Array<{
      id: string;
      name: string;
      code?: string;
      qty: number;
      unit: string;
      rawUnit?: string;
    }> = [];

    // Priority 1: From parsed PDF e-FPB items
    if (pdfData?.items && pdfData.items.length > 0) {
      pdfData.items.forEach((it, idx) => {
        const itIsJasa = isItemJasa({
          code: it.itemCode,
          name: it.itemName,
          unit: it.unit,
          description: it.description,
        });
        const cleanUnit = itIsJasa ? normalizeJasaUnit(it.unit, it.itemName) : it.unit || 'unit';
        list.push({
          id: `pdf-${idx}`,
          name: it.itemName || it.description || 'Item Barang',
          code: it.itemCode || '',
          qty: it.qty || 1,
          unit: cleanUnit,
          rawUnit: it.unit,
        });
      });
      return list;
    }

    // Priority 2: From armada items matching this FPB
    if (itemsS2 && itemsS2.length > 0) {
      itemsS2.forEach((it, idx) => {
        if (it.item) {
          const itIsJasa = isItemJasa({
            code: it.kodeBarang,
            name: it.item,
            unit: it.satuan,
            description: it.keterangan,
          });
          const cleanUnit = itIsJasa ? normalizeJasaUnit(it.satuan, it.item) : it.satuan || 'unit';
          list.push({
            id: `arm-${idx}`,
            name: it.item,
            code: it.kodeBarang || '',
            qty: it.qtyFPB || 1,
            unit: cleanUnit,
            rawUnit: it.satuan,
          });
        }
      });
      if (list.length > 0) return list;
    }

    // Priority 3: Fallback from procurement item
    if (itemS1 && itemS1.item) {
      const itIsJasa = isItemJasa({
        code: itemS1.kodeBarang,
        name: itemS1.item,
        unit: itemS1.satuan,
        description: itemS1.peruntukan,
      });
      const cleanUnit = itIsJasa ? normalizeJasaUnit(itemS1.satuan, itemS1.item) : itemS1.satuan || 'unit';
      list.push({
        id: 'proc-0',
        name: itemS1.item,
        code: itemS1.kodeBarang || '',
        qty: itemS1.qtyFPB || 1,
        unit: cleanUnit,
        rawUnit: itemS1.satuan,
      });
    }

    return list;
  }, [pdfData, itemsS2, itemS1]);

  // Ambil Keterangan Tujuan & Peruntukan Pengadaan:
  // HANYA ambil jika ada data keterangan asli yang valid (bukan dummy/fallback)
  const dummyTexts = ['-', 'U/ Operasional Rutin', 'U/ Kebutuhan Operasional Armada', 'Pengadaan Operasional'];

  const armadaKeterangans = deduplicateDescriptions(
    itemsS2
      .map((i) => i.keterangan?.trim())
      .filter((k): k is string => typeof k === 'string' && k.length > 0 && !dummyTexts.includes(k))
  );

  let rawPeruntukan = cleanSingleDescription(itemS1?.peruntukan?.trim() || '');
  if (dummyTexts.includes(rawPeruntukan)) {
    rawPeruntukan = '';
  }

  // Jika tidak ada keterangan, dikosongkan saja (tidak dipaksa masukkan data dummy)
  // Bisa diperkaya otomatis jika data ditarik dari PDF e-FPB resmi
  const basePeruntukan =
    armadaKeterangans.length > 0
      ? armadaKeterangans.join(' • ')
      : rawPeruntukan;

  // Cek apakah ada tanggal penerimaan terakhir (contoh: "12/05/2026") yang ikut menempel di akhir deskripsi
  const rawTujuan = pdfData?.tujuanPeruntukan || basePeruntukan || '';
  const extractedDatesFromDesc: string[] = [];

  // Cari format tanggal DD/MM/YYYY di dalam teks yang menempel di ujung/setelah keterangan
  const dateRegex = /(?:^|\s|\()(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4})\)?/g;
  let dMatch: RegExpExecArray | null;
  while ((dMatch = dateRegex.exec(rawTujuan)) !== null) {
    const foundDate = dMatch[1];
    if (foundDate.includes('/') || foundDate.includes('-')) {
      extractedDatesFromDesc.push(foundDate);
    }
  }

  // Bersihkan tanggal penerimaan yang menempel di ujung deskripsi
  let cleanTujuan = rawTujuan.replace(/\s+(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4})(?=\s*•|\s*$)/g, '').trim();
  cleanTujuan = cleanTujuanPeruntukan(cleanTujuan);
  const tujuanPengadaan = cleanTujuan;

  // Ambil Tanggal Penerimaan Barang Terakhir:
  const pdfLastDates = Array.from(
    new Set(
      (pdfData?.items || [])
        .map((i) => i.lastDate?.trim())
        .filter((d): d is string => Boolean(d && d !== '-' && d.length > 1))
    )
  );

  const tglPenerimaanTerakhir =
    pdfData?.tanggalPenerimaanTerakhir ||
    (pdfLastDates.length > 0 ? pdfLastDates.join(' • ') : '') ||
    (extractedDatesFromDesc.length > 0 ? Array.from(new Set(extractedDatesFromDesc)).join(' • ') : '') ||
    '-';

  // Trigger Link Dokumen PDF e-FPB Terverifikasi:
  // Format Utama: https://e-fpb.cindaragroup.com/files/logistik_Approved_rev_sign_{FPB}.pdf
  // Fallback Otomatis (jika logistik_ 404): https://e-fpb.cindaragroup.com/files/Approved_rev_sign_{FPB}.pdf
  const docFpb = fpbNumber?.trim() || itemS1?.fpb?.trim() || itemsS2[0]?.fpb?.trim() || '';
  const docPo = activePo?.trim() || itemS1?.po?.trim() || itemsS2[0]?.noPo?.trim() || '';
  const cleanFpb = docFpb.replace(/^["']|["']$/g, '');
  const cleanPo = docPo.replace(/^["']|["']$/g, '');
  const primaryDocNum = cleanFpb || cleanPo;
  const directApprovedPdfUrl = primaryDocNum
    ? `https://e-fpb.cindaragroup.com/files/Approved_rev_sign_${encodeURIComponent(cleanFpb || primaryDocNum)}.pdf`
    : null;
  const defaultLogistikPdfUrl = primaryDocNum
    ? `https://e-fpb.cindaragroup.com/files/logistik_Approved_rev_sign_${encodeURIComponent(cleanFpb || primaryDocNum)}.pdf`
    : null;
  const fpbPdfUrl =
    pdfData?.pdfUrl ||
    (pdfData && pdfData.isLogistikApproved === false ? directApprovedPdfUrl : defaultLogistikPdfUrl) ||
    directApprovedPdfUrl;

  // Metadata FSTB & 5 Digit Belakang untuk TimeMark (Pencarian menyeluruh di semua relasi item)
  const activeFstb =
    itemsS2.find((i) => i.noFstb && i.noFstb.trim() !== '' && i.noFstb.trim() !== '-')?.noFstb?.trim() ||
    itemS1?.noFstb?.trim() ||
    armadaList.find((i) => (i.fpb === fpbNumber || (activePo && i.noPo === activePo)) && i.noFstb && i.noFstb.trim() !== '' && i.noFstb.trim() !== '-')?.noFstb?.trim() ||
    procurementList.find((i) => (i.fpb === fpbNumber || (activePo && i.po === activePo)) && i.noFstb && i.noFstb.trim() !== '' && i.noFstb.trim() !== '-')?.noFstb?.trim() ||
    '';
  const fstbLast5 = extractFstbLast5(activeFstb);

  // Metadata Nomor TTB untuk integrasi foto lapangan langsung di aplikasi
  const activeTtb =
    itemsS2.find((i) => i.noTtb && i.noTtb.trim() !== '' && i.noTtb.trim() !== '-')?.noTtb?.trim() ||
    itemS1?.noTtb?.trim() ||
    armadaList.find((i) => (i.fpb === fpbNumber || (activePo && i.noPo === activePo)) && i.noTtb && i.noTtb.trim() !== '' && i.noTtb.trim() !== '-')?.noTtb?.trim() ||
    procurementList.find((i) => (i.fpb === fpbNumber || (activePo && i.po === activePo)) && i.noTtb && i.noTtb.trim() !== '' && i.noTtb.trim() !== '-')?.noTtb?.trim() ||
    '';

  // Daftar nomor TTB yang telah di-parse & dirapikan (memisahkan entri koma/garis miring seperti CPL-TTB-26-06713,06714)
  const parsedTtbList = useMemo(() => {
    const rawSources = [
      activeTtb,
      itemS1?.noTtb,
      ...itemsS2.map((i) => i.noTtb),
    ].filter(Boolean) as string[];

    const result = new Set<string>();
    for (const raw of rawSources) {
      for (const ttb of parseTtbList(raw)) {
        result.add(ttb);
      }
    }
    return Array.from(result);
  }, [activeTtb, itemS1?.noTtb, itemsS2]);

  // Validasi keterisian Logistik TTB dan Tim Lapangan untuk penentuan status PENGANTARAN LOGISTIK
  const activeTglTtb =
    itemsS2.find((i) => i.tglTtb && i.tglTtb.trim() !== '' && i.tglTtb !== '-')?.tglTtb ||
    (itemS1?.tglInputTtb && itemS1.tglInputTtb.trim() !== '' && itemS1.tglInputTtb !== '-' ? itemS1.tglInputTtb : '') ||
    '';

  const isRealPicTtb = (pic?: string): boolean => {
    if (!pic) return false;
    const clean = pic.trim().toLowerCase();
    return (
      clean !== '' &&
      clean !== '-' &&
      clean !== '(kosong)' &&
      clean !== 'null' &&
      clean !== 'logistik' &&
      !clean.startsWith('logistik')
    );
  };

  const cleanPicTtb = isRealPicTtb(itemS1?.picTtb)
    ? itemS1!.picTtb.trim()
    : itemsS2.find((i) => isRealPicTtb(i.picTtb))?.picTtb?.trim() || '';

  const isPicTtbFilled = Boolean(cleanPicTtb);

  // Status TTB Tercatat: harus ada dokumen nomor TTB atau tanggal terbit TTB resmi
  const hasValidTtbDoc = Boolean(
    (activeTtb && activeTtb !== '-' && activeTtb.trim() !== '' && activeTtb !== '(kosong)') ||
    parsedTtbList.length > 0
  );
  const hasValidTglTtb = Boolean(activeTglTtb && activeTglTtb !== '-' && activeTglTtb.trim() !== '');
  const isLogistikTtbFilled = hasValidTtbDoc || hasValidTglTtb;

  // Logika Kotak 2 (Purchasing): jika PIC dan No. PO belum terisi, Tgl PO otomatis kosong (-)
  const hasPicPch = Boolean(
    itemS1?.picPch &&
    itemS1.picPch.trim() !== '' &&
    itemS1.picPch !== '-' &&
    itemS1.picPch.toLowerCase() !== '(kosong)' &&
    itemS1.picPch.toLowerCase() !== 'null' &&
    itemS1.picPch.toLowerCase() !== 'purchasing'
  );

  const hasValidPo = Boolean(
    activePo &&
    activePo.trim() !== '' &&
    activePo !== '-' &&
    activePo !== 'NOPO' &&
    activePo.toLowerCase() !== '(kosong)' &&
    activePo.toLowerCase() !== 'null'
  );

  const rawTglPo = (hasValidPo || hasPicPch)
    ? (itemsS2[0]?.tglPo || itemS1?.tglPo || '')
    : '';
  const displayTglPo = rawTglPo && rawTglPo !== '-' ? formatDateDdMmYy(rawTglPo) : '-';

  const isPicLapFilled = Boolean(
    itemS1?.picLap &&
    itemS1.picLap !== '-' &&
    itemS1.picLap.trim() !== '' &&
    itemS1.picLap.toLowerCase() !== '(kosong)'
  );
  const hasTglDiantar = Boolean(
    itemS1?.tglBarangDiantar && itemS1.tglBarangDiantar !== '-' && itemS1.tglBarangDiantar.trim() !== ''
  );
  const hasTglKeLap = Boolean(
    itemS1?.tglKeTimLapangan && itemS1.tglKeTimLapangan !== '-' && itemS1.tglKeTimLapangan.trim() !== ''
  );
  const hasTglTimLapKePicTtb = Boolean(
    (itemS1?.tglTimLapKePicTtb || itemsS2[0]?.tglTimLapKePicTtb) &&
    (itemS1?.tglTimLapKePicTtb || itemsS2[0]?.tglTimLapKePicTtb) !== '-' &&
    (itemS1?.tglTimLapKePicTtb || itemsS2[0]?.tglTimLapKePicTtb)?.trim() !== ''
  );
  const hasTglTtbKePch = Boolean(
    itemS1?.tglTtbKePicPch && itemS1.tglTtbKePicPch !== '-' && itemS1.tglTtbKePicPch.trim() !== ''
  );
  const isTimLapFilled = Boolean(
    isPicLapFilled ||
    hasTglDiantar ||
    hasTglKeLap ||
    hasTglTimLapKePicTtb ||
    hasTglTtbKePch
  );

  // Status Serah Terima Fisik Barang:
  // Untuk barang fisik, penyelesaian logistik mensyaratkan bukti aktual penyerahan fisik (tanggal barang diantar ATAU PIC Lapangan tercatat)
  const isBarangPhysicalDone = Boolean(
    (hasTglDiantar || isPicLapFilled || (itemsS2.length > 0 && itemsS2.every((it) => (it.qtyFSTB || 0) > 0 && it.selisih === 0 && (it.qtyTTB || 0) > 0))) &&
    (activeTtb || activeFstb)
  );

  const isPengantaranLogistikDone = isBarangPhysicalDone;

  // Deteksi dan Klasifikasi Kategori Pengadaan (BARANG, JASA, CAMPURAN)
  const currentItemsForCategory = useMemo(() => {
    if (pdfData?.items && pdfData.items.length > 0) {
      return pdfData.items.map((pi) => ({
        code: pi.itemCode,
        name: pi.itemName,
        unit: pi.unit,
        description: pi.description,
      }));
    }
    if (itemsS2.length > 0) {
      return itemsS2.map((it) => ({
        code: it.kodeBarang,
        name: it.item,
        unit: it.satuan,
        description: it.keterangan,
      }));
    }
    if (itemS1) {
      return [
        {
          code: itemS1.kodeBarang,
          name: itemS1.item,
          unit: itemS1.satuan,
          description: itemS1.peruntukan,
        },
      ];
    }
    return [];
  }, [pdfData, itemsS2, itemS1]);

  const transactionCategory: ProcurementCategory = useMemo(() => {
    return determineTransactionCategory(currentItemsForCategory);
  }, [currentItemsForCategory]);

  const isJasaOnly = transactionCategory === 'JASA';
  const isCampuran = transactionCategory === 'CAMPURAN';
  const hasJasaComponent = isJasaOnly || isCampuran;

  // Deteksi nomor Service Report MTC jika tercantum di teks/keterangan/WO
  const detectedServiceReportNo = useMemo(() => {
    const allTexts = [
      pdfData?.workOrderNo,
      itemS1?.noteCheckFpb,
      itemS1?.peruntukan,
      itemsS2[0]?.keterangan,
      itemsS2[0]?.workOrderNo,
    ]
      .filter(Boolean)
      .join(' ');

    const match = allTexts.match(/\b(CPG-SR[DM]-\d+)\b/i);
    return match ? match[1].toUpperCase() : null;
  }, [pdfData, itemS1, itemsS2]);

  // Status Validasi Modul ke-4 (Pengantaran Logistik vs Pelaksanaan/BAST Jasa)
  const isJasaPhysicalDone = Boolean(
    detectedServiceReportNo ||
    hasTglDiantar ||
    (isPicLapFilled && (hasTglKeLap || activeTtb))
  );

  const isCard4Done = isJasaOnly ? isJasaPhysicalDone : isBarangPhysicalDone;

  // PIC & Tanggal Verifikasi FPB:
  // Prioritas utama diambil langsung dari 'Requested By' & tanggal tanda tangan digital PDF jika tersedia
  const isValidPicName = (name?: string) => {
    if (!name) return false;
    const n = name.trim().toLowerCase();
    return n !== '' && n !== '-' && n !== 'end user' && n !== '(end user)' && n !== 'e-fpb server';
  };

  const displayPicFpb =
    (isValidPicName(pdfData?.requestedBy) ? pdfData?.requestedBy : '') ||
    (isValidPicName(itemS1?.picCheckFpb) ? itemS1?.picCheckFpb : '') ||
    (isValidPicName(itemsS2[0]?.picCheckFpb) ? itemsS2[0]?.picCheckFpb : '') ||
    (pdfData?.requestedBy && !/end user/i.test(pdfData.requestedBy) ? pdfData.requestedBy : '') ||
    (itemS1?.picCheckFpb && itemS1.picCheckFpb !== 'e-FPB Server' ? itemS1.picCheckFpb : '') ||
    '-';
  const displayTglFpb = pdfData?.requestedDate || itemS1?.tglCheckFpb || itemsS2[0]?.tglCheckFpb || itemS1?.tglFpb || '-';

  // Menentukan sumber verifikasi data FPB Check (Bu Noor atau Bu Melinda)
  const fpbCheckInfo = useMemo(() => {
    // 1. Cek dari field eksplisit hasil parsing workbook
    const explicitVerified = itemS1?.verifiedByFpb || itemsS2[0]?.verifiedByFpb;
    const explicitSource = itemS1?.sourceCheckFpb || itemsS2[0]?.sourceCheckFpb;

    let checker = '';
    if (explicitVerified) {
      checker = explicitVerified;
    } else if (explicitSource) {
      checker = explicitSource.toUpperCase().includes('MELINDA') ? 'Bu Melinda' : 'Bu Noor';
    } else {
      // 2. Cek dari picCheckFpb jika berisi nama checker
      const picCheck = (itemS1?.picCheckFpb || itemsS2[0]?.picCheckFpb || '').toLowerCase();
      if (picCheck.includes('melinda')) {
        checker = 'Bu Melinda';
      } else if (picCheck.includes('noor')) {
        checker = 'Bu Noor';
      } else {
        // 3. Fallback cerdas berdasarkan prefix nomor FPB & data PDF
        const cleanDoc = (primaryDocNum || itemS1?.fpb || itemsS2[0]?.fpb || '').toUpperCase();
        if (cleanDoc.startsWith('HL-') || cleanDoc.startsWith('HL/')) {
          checker = 'Bu Melinda';
        } else if (
          cleanDoc.startsWith('MO-') || cleanDoc.startsWith('MO/') ||
          cleanDoc.startsWith('GAJ-') || cleanDoc.startsWith('GAJ/') ||
          cleanDoc.startsWith('SP-') || cleanDoc.startsWith('SP/') ||
          cleanDoc.startsWith('MIL-') || cleanDoc.startsWith('MIL/') ||
          cleanDoc.startsWith('SS-') || cleanDoc.startsWith('SS/')
        ) {
          checker = 'Bu Noor';
        } else if (pdfData?.receivedBy && /noor|hasanah/i.test(pdfData.receivedBy)) {
          checker = 'Bu Noor';
        } else if (itemS1?.statusCheckFpb || itemS1?.doneCheckFpb || itemS1?.tglCheckFpb) {
          checker = 'Bu Noor';
        }
      }
    }

    const activeChecker = checker || 'Bu Noor';
    const label = `Terverifikasi oleh data FPB Check ${activeChecker}`;

    return {
      checkerName: activeChecker,
      label,
    };
  }, [itemS1, itemsS2, primaryDocNum, pdfData?.receivedBy]);

  // Penentuan Status Validasi Modul 1-4 untuk Audit Header:
  const isModul1Done = true; // Input data master FPB terdaftar di sheet Melinda
  const isModul2Done = Boolean(
    itemS1?.statusCheckFpb ||
    itemS1?.doneCheckFpb ||
    (displayPicFpb && displayPicFpb !== '-') ||
    pdfData?.approvedBy
  );
  const isModul3Done = Boolean(activePo && activePo !== '-' && activePo !== 'NOPO');

  const verifiedModulesCount =
    (isModul1Done ? 1 : 0) +
    (isModul2Done ? 1 : 0) +
    (isModul3Done ? 1 : 0) +
    (isCard4Done ? 1 : 0);

  // Validasi nomor SPP:
  const hasValidSpp = Boolean(
    itemS1?.noSpp &&
    itemS1.noSpp.trim() !== '' &&
    itemS1.noSpp.trim() !== '-' &&
    itemS1.noSpp.toLowerCase() !== '(kosong)' &&
    itemS1.noSpp.toLowerCase() !== 'null'
  );

  // Status Saat Ini (Header Box):
  // Menghitung status dinamis berdasarkan tahapan transaksi aktual (Lifecycle Stage)
  // Menghilangkan konflik status (seperti menampilkan "MENUNGGU PO" ketika PO sudah diterbitkan)
  const rawStatusUpper = (itemS1?.statusBadge || itemsS2[0]?.status || '').toUpperCase().trim();
  const isExplicitCancel =
    rawStatusUpper.includes('BATAL') ||
    rawStatusUpper.includes('CANCEL') ||
    rawStatusUpper.includes('VOID') ||
    rawStatusUpper.includes('REJECT');

  const statusSaatIni = useMemo(() => {
    if (isExplicitCancel) {
      return 'BATAL / REJECT';
    }

    if (itemS1?.statusBadge && itemS1.statusBadge !== 'PROSES PENGADAAN' && itemS1.statusBadge !== 'TERDATA') {
      return itemS1.statusBadge;
    }

    // 1. Selesai di Keuangan (SPP sah dan sudah ada bukti penyerahan ke Keuangan)
    if (hasValidSpp && itemS1?.tglKeKeuangan && itemS1.tglKeKeuangan !== '-') {
      return 'SELESAI DI KEUANGAN';
    }

    // 2. SPP sudah terbit, menunggu proses pencairan kas
    if (hasValidSpp) {
      return 'PROSES SPP';
    }

    // 3. Serah terima fisik / BAST sudah selesai, berkas masuk proses ADM Purchasing
    if (
      isCard4Done ||
      Boolean(itemS1?.tglKeAdmPch && itemS1.tglKeAdmPch !== '-') ||
      Boolean(itemS1?.tglTtbKePicPch && itemS1.tglTtbKePicPch !== '-') ||
      Boolean(itemS1?.picAdm && itemS1.picAdm !== '-')
    ) {
      return 'PROSES ADM PURCHASING';
    }

    // 4. Dokumen TTB / BAST sudah ada, menunggu konfirmasi serah terima fisik ke lapangan / kapal
    if (activeTtb || activeFstb) {
      return isJasaOnly
        ? 'MENUNGGU BAST / MTC JASA'
        : 'VALIDASI LOGISTIK TTB';
    }

    // 5. PO sudah sah diterbitkan, menunggu pengiriman barang vendor / terbit TTB
    if (activePo && activePo !== '-' && activePo !== 'NOPO') {
      return isJasaOnly
        ? 'PO TERBIT - PROSES PEKERJAAN'
        : 'MENUNGGU FSTB';
    }

    // 6. Belum ada PO resmi
    return 'MENUNGGU PO';
  }, [
    isExplicitCancel,
    itemS1?.statusBadge,
    hasValidSpp,
    itemS1?.tglKeKeuangan,
    itemS1?.tglKeAdmPch,
    itemS1?.tglTtbKePicPch,
    itemS1?.picAdm,
    isCard4Done,
    activeTtb,
    activeFstb,
    isJasaOnly,
    activePo,
  ]);

  const statusSaatIniColor = useMemo(() => {
    if (statusSaatIni === 'SELESAI DI KEUANGAN' || statusSaatIni.includes('SELESAI')) {
      return 'text-emerald-600 dark:text-emerald-400';
    }
    if (statusSaatIni.includes('SPP')) {
      return 'text-emerald-600 dark:text-emerald-400';
    }
    if (statusSaatIni.includes('ADM')) {
      return 'text-cyan-600 dark:text-cyan-400';
    }
    if (statusSaatIni.includes('TTB') || statusSaatIni.includes('LOGISTIK')) {
      return 'text-purple-600 dark:text-purple-400';
    }
    if (
      statusSaatIni.includes('LAPANGAN') ||
      statusSaatIni.includes('DISTRIBUSI') ||
      statusSaatIni.includes('VERIFIKASI FISIK') ||
      statusSaatIni.includes('PENGIRIMAN') ||
      statusSaatIni.includes('BAST') ||
      statusSaatIni.includes('PEKERJAAN')
    ) {
      return 'text-amber-600 dark:text-amber-400';
    }
    if (statusSaatIni.includes('FSTB')) {
      return 'text-cyan-600 dark:text-cyan-400';
    }
    if (statusSaatIni === 'MENUNGGU PO') {
      return 'text-rose-600 dark:text-rose-400';
    }
    return 'text-foreground';
  }, [statusSaatIni]);

  // Otomatis sinkronkan metadata PDF (Requested By, Tanggal, Item) saat modal dibuka
  useEffect(() => {
    let isMounted = true;
    if (primaryDocNum) {
      setPdfData(null);
      setIsLoadingPdf(true);
      fetch(`/api/parse-fpb-pdf?fpb=${encodeURIComponent(primaryDocNum)}`)
        .then((res) => res.json())
        .then((json) => {
          if (isMounted && json.success && json.data) {
            setPdfData(json.data);
            if (json.data.workOrderNo) {
              onUpdateWorkOrderNo?.(json.data.fpbNo || primaryDocNum, json.data.workOrderNo);
            }
            // Simpan nama barang ke cache IndexedDB untuk Advanced Search
            if (json.data.items && json.data.items.length > 0) {
              const itemNames = json.data.items.map((it: { itemName: string; description?: string; itemCode?: string }) =>
                [it.itemName, it.description, it.itemCode].filter(Boolean).join(' | ')
              );
              updatePdfItemsCacheForFpb(json.data.fpbNo || primaryDocNum, itemNames).catch(() => {});
            }
          }
        })
        .catch(() => {})
        .finally(() => {
          if (isMounted) {
            setIsLoadingPdf(false);
          }
        });
    } else {
      setPdfData(null);
      setIsLoadingPdf(false);
    }
    return () => {
      isMounted = false;
    };
  }, [primaryDocNum]);

  // Support closing modal via ESC key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  const isCritical = itemS1 ? (itemS1.lapseText !== 'TBC' && itemS1.lapse > 5) : false;

  // Analisis Risiko Otomatis untuk Manajemen & Supervisor Logistik (Audit Trail)
  const auditRisk = useMemo(() => {
    if (isCritical) {
      return {
        level: 'TINGGI' as const,
        tag: `BOTTLENECK SLA (${itemS1?.lapse} HARI)`,
        color: 'bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-500/30',
        description: `Berkas tertahan selama ${itemS1?.lapse} hari pada status ${statusSaatIni}. Perlu eskalasi segera.`,
      };
    }
    if (activeTtb && !isPicLapFilled && !isPicTtbFilled && !hasTglDiantar) {
      return {
        level: 'PERHATIAN' as const,
        tag: 'PERLU PIC SERAH TERIMA',
        color: 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30',
        description: 'Nomor TTB tercatat namun PIC fisik dan bukti serah terima lapangan belum lengkap diinput.',
      };
    }
    if (!activePo) {
      return {
        level: 'INFO' as const,
        tag: 'MENUNGGU PO PURCHASING',
        color: 'bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30',
        description: 'Menunggu penerbitan nomor PO resmi oleh tim Purchasing.',
      };
    }
    return {
      level: 'RENDAH' as const,
      tag: 'SESUAI SOP (NORMAL)',
      color: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30',
      description: 'Seluruh tahapan proses dan dokumen akuntabilitas berada dalam koridor SLA normal.',
    };
  }, [isCritical, itemS1?.lapse, statusSaatIni, activeTtb, isPicLapFilled, isPicTtbFilled, hasTglDiantar, activePo]);

  const handleFetchPdfData = async (silent: boolean | unknown = false) => {
    const isSilent = typeof silent === 'boolean' ? silent : false;
    if (!primaryDocNum) {
      if (!isSilent) showToast('Nomor FPB/PO tidak valid untuk penarikan dokumen PDF.', 'warning');
      return;
    }
    setIsLoadingPdf(true);
    if (!isSilent) {
      showToast(`Menghubungkan ke server e-FPB untuk mengambil data ${primaryDocNum}...`, 'info');
    }

    try {
      const res = await fetch(`/api/parse-fpb-pdf?fpb=${encodeURIComponent(primaryDocNum)}`);
      const json = await res.json();
      if (json.success && json.data) {
        setPdfData(json.data);
        if (json.data.workOrderNo) {
          onUpdateWorkOrderNo?.(json.data.fpbNo || primaryDocNum, json.data.workOrderNo);
        }
        // Simpan nama barang ke cache IndexedDB untuk Advanced Search
        if (json.data.items && json.data.items.length > 0) {
          const itemNames = json.data.items.map((it: { itemName: string; description?: string; itemCode?: string }) =>
            [it.itemName, it.description, it.itemCode].filter(Boolean).join(' | ')
          );
          updatePdfItemsCacheForFpb(json.data.fpbNo || primaryDocNum, itemNames).catch(() => {});
        }
        if (!isSilent) {
          showToast(
            `Berhasil menarik ${json.data.items?.length || 0} rincian item & peruntukan dari PDF e-FPB!`,
            'success'
          );
        }
      } else {
        if (!isSilent) {
          showToast(
            json.message || 'Dokumen PDF tidak ditemukan di server e-FPB.',
            'warning'
          );
        }
      }
    } catch (err: any) {
      console.error('Failed to fetch PDF data:', err);
      if (!isSilent) {
        showToast('Gagal menarik data dari server PDF. Periksa koneksi jaringan.', 'error');
      }
    } finally {
      setIsLoadingPdf(false);
    }
  };

  // Auto-fetch data PDF saat modal dibuka jika belum pernah ditarik
  useEffect(() => {
    if (primaryDocNum && !pdfData) {
      handleFetchPdfData(true);
    }
  }, [primaryDocNum]);

  const handleRunAiAudit = () => {
    setShowAiRisk(true);
    showToast('Hasil Analisis Risiko selesai diproses.', 'success');
  };

  const handleWhatsappNudge = () => {
    const pic = itemS1 ? itemS1.picAktif : 'PIC Terkait';
    const text = encodeURIComponent(
      `Halo ${pic}, mohon update percepatan berkas pengadaan fisik ${fpbNumber} (${
        itemS1 ? itemS1.item : 'Armada'
      }) untuk diteruskan ke Keuangan CPG. Terima kasih.`
    );
    window.open(`https://wa.me/?text=${text}`, '_blank');
    showToast(`Membuka pesan eskalasi WhatsApp untuk ${pic}`, 'info');
  };

  const renderPriorityBadge = (p?: string) => {
    if (!p || p === '-' || p.trim() === '') {
      return <span className="text-muted-foreground/60 text-[11px] font-mono">-</span>;
    }
    const clean = p.trim().toUpperCase();
    const isP1 = clean.includes('1') || clean === 'PI';
    const isP2 = clean.includes('2');
    const isP3 = clean.includes('3');

    if (isP1) {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold font-mono bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-500/20">
          {clean}
        </span>
      );
    }
    if (isP2) {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold font-mono bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20">
          {clean}
        </span>
      );
    }
    if (isP3) {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium font-mono bg-blue-500/10 text-blue-700 dark:text-blue-400 border border-blue-500/20">
          {clean}
        </span>
      );
    }
    return (
      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono bg-muted text-muted-foreground border border-border">
        {clean}
      </span>
    );
  };

  if (!fpbNumber) return null;

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 cursor-pointer animate-in fade-in duration-200 printable-modal-overlay"
      title="Klik di area luar/kosong untuk menutup"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-card border border-border rounded-t-2xl sm:rounded-xl w-full max-w-5xl xl:max-w-6xl 2xl:max-w-7xl max-h-[92vh] sm:max-h-[90vh] overflow-y-auto shadow-2xl p-4 sm:p-5 md:p-6 space-y-4 text-card-foreground cursor-default pb-12 sm:pb-6 printable-modal-content"
      >
        {/* Modal Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3.5 border-b border-border">
          <div className="flex items-start sm:items-center gap-2.5 sm:gap-3 min-w-0 flex-1">
            <div className="flex size-8 sm:size-9 shrink-0 items-center justify-center rounded-lg border border-border bg-muted/60 text-cyan-400 mt-0.5 sm:mt-0">
              <ShieldCheck className="size-4.5 sm:size-5" />
            </div>
            <div className="min-w-0 flex-1">
              <span className="text-[10px] font-mono text-muted-foreground font-semibold uppercase tracking-wider block">
                Verifikasi Akuntabilitas Lintas Modul
              </span>
              <div className="text-sm sm:text-base font-semibold text-foreground font-mono flex items-center gap-1.5 sm:gap-2 flex-wrap mt-0.5">
                <span className="text-primary font-bold shrink-0">{fpbNumber}</span>
                {activePo ? (
                  <span className="text-amber-400 font-mono text-xs px-2 py-0.5 rounded-md bg-amber-500/10 border border-amber-500/20 shrink-0 font-medium">
                    PO: {activePo}
                  </span>
                ) : (
                  <span className="text-muted-foreground font-mono text-xs px-2 py-0.5 rounded-md bg-muted border border-border shrink-0">
                    PO: - (Kosong)
                  </span>
                )}
                {/* Badge Kategori Transaksi */}
                <span
                  className={`font-mono text-xs px-2 py-0.5 rounded-md font-semibold border flex items-center gap-1 shrink-0 ${
                    isJasaOnly
                      ? 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30'
                      : isCampuran
                      ? 'bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-500/30'
                      : 'bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20'
                  }`}
                  title={
                    isJasaOnly
                      ? 'Kategori Pengadaan: Jasa (Pekerjaan / Servis / Subkon / Overhaul)'
                      : isCampuran
                      ? 'Kategori Pengadaan: Campuran (Material Barang & Jasa)'
                      : 'Kategori Pengadaan: Barang / Material Fisik'
                  }
                >
                  {isJasaOnly ? (
                    <>
                      <Wrench className="size-3 shrink-0" />
                      <span>JASA</span>
                    </>
                  ) : isCampuran ? (
                    <>
                      <Boxes className="size-3 shrink-0" />
                      <span>BARANG & JASA</span>
                    </>
                  ) : (
                    <>
                      <PackageCheck className="size-3 shrink-0" />
                      <span>BARANG</span>
                    </>
                  )}
                </span>
                {effectiveWorkOrderNo && (
                  <span
                    className="text-cyan-600 dark:text-cyan-400 font-mono text-xs px-2 py-0.5 rounded-md bg-cyan-500/10 border border-cyan-500/20 font-semibold shrink-0"
                    title={`Nomor Work Order Operasional: ${effectiveWorkOrderNo}`}
                  >
                    WO: {effectiveWorkOrderNo}
                  </span>
                )}
                <span className="text-foreground font-sans text-xs sm:text-sm font-medium truncate max-w-full">
                  &bull; {itemsS2[0]?.armada || itemS1?.deptArmada || itemS1?.item || 'Nama Kapal / Armada'}
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 self-end sm:self-auto shrink-0 flex-wrap sm:flex-nowrap">
            {/* Indikator Risiko Otomatis (Proaktif Terlihat Langsung) */}
            <div
              className={`h-8 px-2.5 rounded-lg border font-mono text-[11px] font-semibold flex items-center gap-1.5 shrink-0 shadow-2xs ${auditRisk.color}`}
              title={auditRisk.description}
            >
              {auditRisk.level === 'TINGGI' || auditRisk.level === 'PERHATIAN' ? (
                <AlertTriangle className="size-3.5 shrink-0" />
              ) : (
                <ShieldCheck className="size-3.5 shrink-0" />
              )}
              <span className="truncate">{auditRisk.tag}</span>
            </div>

            {/* Tombol: Cek Foto TimeMark (FSTB / TTB) - Dapat diakses oleh semua pengguna termasuk Visitor */}
            {(activeFstb || parsedTtbList.length > 0 || activeTtb) && (
              <button
                onClick={() => {
                  setSelectedTtbForPhoto(parsedTtbList[0] || activeTtb);
                  setShowTimemarkModal(true);
                }}
                className="h-8 px-2.5 sm:px-3 rounded-lg border border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-300 text-xs font-semibold shadow-xs flex items-center gap-1.5 transition active:scale-95 touch-manipulation cursor-pointer"
                title={`Verifikasi foto serah terima fisik TimeMark / Server TTB (${fstbLast5 || activeTtb || '-'})`}
              >
                <Camera className="size-3.5 text-amber-600 dark:text-amber-400" />
                <span>Foto {fstbLast5 ? `TimeMark (${fstbLast5})` : 'TTB'}</span>
              </button>
            )}

            {/* Action buttons khusus Admin & Staff User (Visitor tidak perlu) */}
            {!isVisitor && (
              <>
                {/* Tombol: Cek Stok Gudang & Rekomendasi */}
                <button
                  onClick={() => setShowStockModal(true)}
                  className="h-8 px-2.5 sm:px-3 rounded-lg border border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 text-xs font-medium shadow-xs flex items-center gap-1.5 transition active:scale-95 touch-manipulation cursor-pointer"
                  title="Buka Pengecekan Stok Gudang Accurate & Analisis Rekomendasi"
                >
                  <Boxes className="size-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span>Cek Stok Gudang</span>
                </button>

                {/* Risk Audit Button */}
                <button
                  onClick={handleRunAiAudit}
                  className="h-8 px-2.5 sm:px-3 rounded-lg border border-purple-500/30 bg-purple-500/10 hover:bg-purple-500/20 text-purple-700 dark:text-purple-300 text-xs font-medium shadow-xs flex items-center gap-1.5 transition active:scale-95 touch-manipulation cursor-pointer"
                >
                  <Sparkles className="size-3.5 text-purple-600 dark:text-amber-300" />
                  <span>Analisis Risiko</span>
                </button>
              </>
            )}

            <button
              onClick={onClose}
              className="size-8 rounded-lg border border-border bg-background hover:bg-muted text-muted-foreground hover:text-foreground flex items-center justify-center transition touch-manipulation cursor-pointer"
            >
              <X className="size-4" />
            </button>
          </div>
        </div>

        {/* Document Risk Callout Box */}
        {showAiRisk && !isVisitor && (
          <div className="p-4 rounded-xl bg-purple-500/10 border border-purple-500/30 text-xs space-y-2">
            <div className="flex items-center justify-between text-purple-800 dark:text-purple-300 font-semibold font-mono">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-purple-500 animate-ping"></span>
                Hasil Analisis Risiko Berkas
              </span>
              <span
                className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono ${auditRisk.color}`}
              >
                RISIKO: {auditRisk.tag}
              </span>
            </div>
            <div className="text-foreground leading-relaxed font-sans">
              {auditRisk.level === 'TINGGI' ? (
                <>
                  <p className="mb-1 text-foreground">
                    <strong>Peringatan SLA:</strong> Berkas <code>{itemS1?.fpb}</code> telah
                    tertahan selama <strong>{itemS1?.lapse} hari</strong> pada status{' '}
                    <em>{statusSaatIni}</em>.
                  </p>
                  <p className="text-muted-foreground">
                    PIC Aktif saat ini:{' '}
                    <strong className="text-foreground">{itemS1?.picAktif || 'Belum Ditugaskan'}</strong>. Terdeteksi
                    adanya kendala pada tindak lanjut berkas. Disarankan melakukan eskalasi langsung melalui WhatsApp agar berkas segera
                    diselesaikan ke bagian berikutnya.
                  </p>
                </>
              ) : auditRisk.level === 'PERHATIAN' ? (
                <>
                  <p className="mb-1 text-foreground">
                    <strong>Perhatian Akuntabilitas Fisik:</strong> Dokumen penerimaan logistik (TTB:{' '}
                    <code>{parsedTtbList.join(', ') || activeTtb}</code>) telah tercatat, namun bukti serah terima fisik ke tim lapangan / kapal belum lengkap.
                  </p>
                  <p className="text-muted-foreground">
                    PIC Logistik: <strong className="text-foreground">{cleanPicTtb || 'Belum Tercatat'}</strong>,{' '}
                    PIC Lapangan: <strong className="text-foreground">{isPicLapFilled ? itemS1?.picLap : 'Belum Tercatat'}</strong>,{' '}
                    Tanggal Diantar: <strong className="text-foreground">{hasTglDiantar ? formatDateDdMmYy(itemS1?.tglBarangDiantar) : 'Belum Diantar'}</strong>.
                    Perlu konfirmasi serah terima fisik aktual sebelum berkas dinyatakan selesai secara operasional.
                  </p>
                </>
              ) : (
                <>
                  <p className="mb-1 text-foreground">
                    <strong>Alur Berkas Bersih:</strong> Berkas <code>{itemS1?.fpb}</code> berada
                    dalam koridor SLA normal (Lapse: <strong>{itemS1?.lapseText === 'TBC' ? 'TBC' : `${itemS1?.lapse || 0} hari`}</strong>
                    ).
                  </p>
                  <p className="text-muted-foreground">
                    Rantai pertanggungjawaban 5 divisi: Pembuatan FPB (&rarr;{' '}
                    {displayPicFpb}), Purchasing (&rarr;{' '}
                    {activePo ? `${itemS1?.picPch || 'Purchasing'} - PO: ${activePo}` : 'Menunggu PO'}), TTB Logistik (&rarr;{' '}
                    {cleanPicTtb ? cleanPicTtb : parsedTtbList.length > 0 ? `TTB (${parsedTtbList.join(', ')})` : 'Belum Ada TTB'}), Lapangan (&rarr;{' '}
                    {isPicLapFilled ? itemS1?.picLap : hasTglDiantar ? `Diantar tgl ${formatDateDdMmYy(itemS1?.tglBarangDiantar)}` : 'Belum Dikonfirmasi'}), dan Purchasing / ADM (&rarr;{' '}
                    {hasValidSpp ? `${itemS1?.picAdm || 'Purchasing/ADM'} - SPP: ${itemS1?.noSpp}` : 'Menunggu Berkas ADM'}).
                  </p>
                </>
              )}
            </div>
          </div>
        )}

        {/* Top Overview Cards Row: PO Internal | Work Order (WO) | Status Saat Ini */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 min-w-0 items-stretch">
          {/* 1. Left Card: NOMOR PO INTERNAL */}
          <div className="p-3.5 rounded-xl bg-card border border-border min-w-0 flex flex-col justify-between shadow-xs">
            <div>
              <span className="text-[10px] text-muted-foreground font-mono block">
                NOMOR PO INTERNAL
              </span>
              <span className="text-sm font-semibold font-mono mt-0.5 block truncate" title={activePo || ''}>
                {activePo ? (
                  <span className="text-foreground">{activePo}</span>
                ) : (
                  <span className="text-muted-foreground font-normal italic">- (Kosong)</span>
                )}
              </span>
            </div>

            <div className="pt-2 mt-2 border-t border-border/60 flex items-center justify-between text-xs font-mono">
              <span className="text-[10px] text-muted-foreground uppercase">ENTITAS &amp; TANGGAL:</span>
              <span className="font-semibold text-foreground truncate ml-1 text-right">
                {itemsS2[0]?.entity || itemS1?.entity || 'CPL'} &bull;{' '}
                {formatDateDdMmYy(itemsS2[0]?.tglPo || itemsS2[0]?.tglFpb || itemS1?.date)}
              </span>
            </div>
          </div>

          {/* 2. Center Card: KOTAK MENU NOMOR WORK ORDER (WO) */}
          <div className="p-3.5 rounded-xl bg-card border border-border min-w-0 flex flex-col justify-between shadow-xs hover:border-cyan-500/40 transition-colors">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-muted-foreground font-mono block">
                  NOMOR WORK ORDER (WO)
                </span>
                <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-cyan-500/10 text-cyan-700 dark:text-cyan-400 border border-cyan-500/20 font-semibold">
                  WO
                </span>
              </div>
              <span className="text-sm font-semibold font-mono mt-0.5 block truncate" title={effectiveWorkOrderNo || 'Belum Ada Nomor Work Order'}>
                {effectiveWorkOrderNo ? (
                  <span className="text-cyan-700 dark:text-cyan-400 font-bold">{effectiveWorkOrderNo}</span>
                ) : (
                  <span className="text-muted-foreground font-normal italic">- (Kosong)</span>
                )}
              </span>
            </div>

            <div className="pt-2 mt-2 border-t border-border/60 flex items-center justify-between text-xs font-mono">
              <span className="text-[10px] text-muted-foreground uppercase">STATUS WO:</span>
              <span
                className={`font-semibold truncate ml-1 text-right text-[11px] ${
                  effectiveWorkOrderNo
                    ? 'text-cyan-700 dark:text-cyan-400'
                    : 'text-muted-foreground italic'
                }`}
              >
                {effectiveWorkOrderNo ? 'Tersinkronisasi e-FPB' : 'Belum Diterbitkan'}
              </span>
            </div>
          </div>

          {/* 3. Right Card: STATUS SAAT INI */}
          <div className="p-3.5 rounded-xl bg-card border border-border min-w-0 flex flex-col justify-between shadow-xs">
            <div>
              <span className="text-[10px] text-muted-foreground font-mono block">
                STATUS SAAT INI
              </span>
              <span className={`text-sm font-semibold font-mono mt-0.5 block truncate ${statusSaatIniColor}`} title={statusSaatIni}>
                {statusSaatIni}
              </span>
            </div>
            <div className="pt-2 mt-2 border-t border-border/60 flex items-center justify-between text-[11px] font-mono text-muted-foreground">
              <span className="uppercase text-[10px]">VERIFIKASI:</span>
              <span className="font-semibold text-foreground">
                {verifiedModulesCount}/4 Modul
              </span>
            </div>
          </div>
        </div>

        {/* 4 Cross Verification Badges */}
        {!isVisitor && (
          <div className="bg-muted/30 rounded-xl border border-border p-4 space-y-3 min-w-0">
            <div className="flex items-center justify-between flex-wrap gap-2 min-w-0">
              <h4 className="text-xs font-semibold text-foreground uppercase tracking-wider flex items-center gap-1.5 min-w-0">
                <ShieldCheck className="size-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span className="truncate">Status Validasi Dokumen Lintas Modul</span>
              </h4>
              <div className="flex items-center gap-1.5 shrink-0 flex-wrap">
                <span
                  className={`text-[10px] font-mono px-2.5 py-0.5 rounded-full border font-semibold shrink-0 ${
                    verifiedModulesCount === 4
                      ? 'text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
                      : 'text-amber-700 dark:text-amber-400 bg-amber-500/10 border-amber-500/20'
                  }`}
                >
                  {verifiedModulesCount}/4 Modul Terverifikasi
                </span>
                {verifiedModulesCount < 4 && (
                  <span className="text-[10px] font-mono text-amber-600 dark:text-amber-400 hidden sm:inline">
                    {!isModul3Done
                      ? '(Menunggu PO)'
                      : !isCard4Done
                      ? '(Logistik: Menunggu Serah Terima Fisik)'
                      : '(Menunggu Validasi Dokumen)'}
                  </span>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 text-xs min-w-0">
              {/* 1. INPUT DATA MELINDA */}
              <div className="p-3 rounded-lg bg-card border border-border flex flex-col justify-between gap-2.5 shadow-xs hover:shadow-subtle transition min-w-0">
                <div className="text-[11px] font-semibold text-foreground tracking-wide uppercase leading-tight min-h-[1.75rem] flex items-center min-w-0">
                  <span className="truncate">INPUT DATA MELINDA</span>
                </div>
                <div className="flex items-center justify-between pt-2 border-t border-border min-w-0 gap-1.5">
                  <span className="text-[10px] text-muted-foreground font-mono shrink-0">Status:</span>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 font-mono text-[11px] font-medium shrink-0">
                    <Check className="size-3 text-emerald-600 dark:text-emerald-400" />
                    DONE
                  </span>
                </div>
              </div>

              {/* 2. PEMBUATAN FPB (TERVERIFIKASI FPB CHECK BU NOOR / BU MELINDA) */}
              <div className="p-3 rounded-lg bg-card border border-border flex flex-col justify-between gap-2.5 shadow-xs hover:shadow-subtle transition min-w-0">
                <div className="flex flex-col justify-center min-h-[1.75rem] gap-0.5 min-w-0">
                  <span className="text-[11px] font-semibold text-foreground tracking-wide uppercase leading-tight truncate min-w-0" title={`PEMBUATAN FPB ${isValidPicName(displayPicFpb) ? `(${displayPicFpb})` : ''}`}>
                    PEMBUATAN FPB {isValidPicName(displayPicFpb) ? `(${displayPicFpb})` : ''}
                  </span>
                  <div className="text-[9.5px] font-mono text-emerald-700 dark:text-emerald-400 font-medium leading-tight flex items-center gap-1 min-w-0" title={fpbCheckInfo.label}>
                    <CheckCircle2 className="size-2.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    <span className="truncate min-w-0">{fpbCheckInfo.label}</span>
                  </div>
                </div>
                <div className="flex items-center justify-between pt-2 border-t border-border min-w-0 gap-1.5">
                  <span className="text-[10px] text-muted-foreground font-mono shrink-0">Status:</span>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 font-mono text-[11px] font-medium shrink-0">
                    <Check className="size-3 text-emerald-600 dark:text-emerald-400" />
                    {itemS1?.statusCheckFpb || itemS1?.doneCheckFpb || (itemS1?.picCheckFpb && itemS1.picCheckFpb !== '-' ? 'TERVERIFIKASI' : 'CLOSE')}
                  </span>
                </div>
              </div>

              {/* 3. PROCUREMENT */}
              <div className="p-3 rounded-lg bg-card border border-border flex flex-col justify-between gap-2.5 shadow-xs hover:shadow-subtle transition min-w-0">
                <div className="text-[11px] font-semibold text-foreground tracking-wide uppercase leading-tight min-h-[1.75rem] flex items-center min-w-0">
                  <span className="truncate">PROCUREMENT</span>
                </div>
                <div className="flex items-center justify-between pt-2 border-t border-border min-w-0 gap-1.5">
                  <span className="text-[10px] text-muted-foreground font-mono shrink-0">Status:</span>
                  {isModul3Done ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 font-mono text-[11px] font-medium shrink-0">
                      <Check className="size-3 text-emerald-600 dark:text-emerald-400" />
                      DONE
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20 font-mono text-[11px] font-medium shrink-0">
                      <Clock className="size-3 text-amber-600 dark:text-amber-400" />
                      MENUNGGU PO
                    </span>
                  )}
                </div>
              </div>

              {/* 4. PENGANTARAN LOGISTIK / PELAKSANAAN & BERITA ACARA JASA */}
              <div className="p-3 rounded-lg bg-card border border-border flex flex-col justify-start gap-1.5 shadow-xs hover:shadow-subtle transition min-w-0">
                <div className="text-[11px] font-semibold text-foreground tracking-wide uppercase leading-tight flex items-center gap-1.5 min-w-0">
                  {isJasaOnly ? (
                    <>
                      <Wrench className="size-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                      <span className="truncate" title="Pelaksanaan & Berita Acara (BAST / MTC)">PELAKSANAAN &amp; BAST JASA</span>
                    </>
                  ) : isCampuran ? (
                    <>
                      <Boxes className="size-3.5 text-purple-600 dark:text-purple-400 shrink-0" />
                      <span className="truncate" title="Logistik & Serah Terima Jasa">LOGISTIK &amp; SERAH TERIMA</span>
                    </>
                  ) : (
                    <span className="truncate">PENGANTARAN LOGISTIK</span>
                  )}
                </div>
                <div className="space-y-1 pt-1.5 border-t border-border min-w-0">
                  <div className="flex items-center justify-between min-w-0 gap-1.5">
                    <span className="text-[10px] text-muted-foreground font-mono shrink-0">Status:</span>
                    {isCard4Done ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 font-mono text-[11px] font-medium shrink-0">
                        <Check className="size-3 text-emerald-600 dark:text-emerald-400" />
                        {isJasaOnly ? 'SELESAI' : 'DONE'}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20 font-mono text-[11px] font-medium shrink-0">
                        <Clock className="size-3 text-amber-600 dark:text-amber-400" />
                        {isJasaOnly ? 'PENGERJAAN' : 'DALAM PROSES'}
                      </span>
                    )}
                  </div>
                  <div className="text-[9.5px] font-mono text-muted-foreground truncate" title={isCard4Done ? 'Serah terima fisik terverifikasi' : 'Dokumen TTB ada, menunggu serah terima fisik lapangan'}>
                    {isCard4Done ? '✓ Serah terima lengkap' : activeTtb ? 'Menunggu konfirmasi fisik' : 'Menunggu dokumen TTB'}
                  </div>
                  {detectedServiceReportNo && (
                    <a
                      href={`/api/mtc-redirect?no=${encodeURIComponent(detectedServiceReportNo)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[9.5px] font-mono text-cyan-700 dark:text-cyan-300 bg-cyan-500/10 hover:bg-cyan-500/20 px-1.5 py-0.5 rounded border border-cyan-500/30 flex items-center justify-between gap-1 transition mt-0.5 min-w-0"
                      title={`Buka Dokumen PDF Service Report MTC (${detectedServiceReportNo})`}
                    >
                      <span className="truncate flex items-center gap-1 min-w-0">
                        <FileText className="size-2.5 shrink-0 text-cyan-600 dark:text-cyan-400" />
                        <span className="truncate">MTC: {detectedServiceReportNo}</span>
                      </span>
                      <ExternalLink className="size-2.5 shrink-0 opacity-70" />
                    </a>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════
            RANTAI TANGGUNG JAWAB & AUDIT DETAIL (5 DIVISI LENGKAP)
            1. VERIFIKASI FPB
            2. PURCHASING
            3. LOGISTIK TTB
            4. TIM LAPANGAN
            5. PURCHASING / ADM
            ═══════════════════════════════════════════════════════════ */}
        <div className="space-y-2.5 pt-1">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h4 className="text-xs font-semibold text-foreground uppercase tracking-wider flex items-center gap-1.5">
              <span>Alur Tanggung Jawab Fisik & PIC (5 Divisi Terverifikasi)</span>
            </h4>
            <div className="flex items-center gap-2.5 flex-wrap">
              {(itemS1 || itemsS2[0]) && (
                <WorkflowTrafficLight
                  item={(itemS1 || itemsS2[0]) as any}
                  showBadge={true}
                  compact={true}
                />
              )}
              <span className="text-[10px] text-muted-foreground font-mono bg-muted px-2 py-0.5 rounded-md border border-border">
                Detail Riwayat Lengkap
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 text-xs">
            {/* 1. PEMBUATAN FPB */}
            <div className="p-3.5 rounded-lg bg-card border border-border flex flex-col justify-between space-y-2.5 shadow-xs hover:border-foreground/20 transition min-w-0">
              <div className="min-w-0">
                <div className="flex items-center justify-between pb-2 border-b border-border gap-1 min-w-0">
                  <span className="text-[11px] font-semibold text-foreground font-mono flex items-center gap-1.5 min-w-0 truncate">
                    <FileCheck className="size-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
                    <span className="truncate">1. PEMBUATAN FPB</span>
                  </span>
                  <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-muted text-muted-foreground border border-border font-semibold shrink-0">
                    FPB
                  </span>
                </div>
                <div className="mt-2.5 space-y-1.5 text-[11px]">
                  <div className="flex items-center justify-between min-w-0">
                    <span className="text-muted-foreground shrink-0 whitespace-nowrap">PIC:</span>
                    <span
                      className="font-semibold text-foreground font-mono truncate text-right ml-1.5 min-w-0"
                      title={isValidPicName(pdfData?.requestedBy) ? `Requested By: ${pdfData?.requestedBy}` : displayPicFpb}
                    >
                      {displayPicFpb}
                    </span>
                  </div>
                  <div className="flex items-center justify-between min-w-0">
                    <span className="text-muted-foreground shrink-0 whitespace-nowrap">Tgl:</span>
                    <span
                      className="text-muted-foreground font-mono text-right ml-1.5 truncate min-w-0"
                      title={pdfData?.requestedTimestamp ? `Timestamp: ${pdfData.requestedTimestamp}` : displayTglFpb}
                    >
                      {formatDateDdMmYy(displayTglFpb)}
                    </span>
                  </div>
                  {effectiveWorkOrderNo && (
                    <div className="flex items-center justify-between min-w-0">
                      <span className="text-muted-foreground shrink-0 whitespace-nowrap">No. WO:</span>
                      <span
                        className="text-cyan-700 dark:text-cyan-400 font-mono font-semibold text-[10.5px] truncate text-right ml-1.5 min-w-0"
                        title={`Work Order: ${effectiveWorkOrderNo}`}
                      >
                        {effectiveWorkOrderNo}
                      </span>
                    </div>
                  )}
                  <div className="flex items-center justify-between min-w-0">
                    <span className="text-muted-foreground shrink-0 whitespace-nowrap">Status:</span>
                    <span className="text-blue-600 dark:text-blue-400 font-mono font-bold text-right ml-1.5 truncate min-w-0">
                      {itemS1?.statusCheckFpb || itemsS2[0]?.statusCheckFpb || (itemS1?.doneCheckFpb ? 'DONE' : 'CLOSE')}
                    </span>
                  </div>
                  <div className="flex items-start justify-between gap-1.5 min-w-0">
                    <span className="text-muted-foreground shrink-0 whitespace-nowrap">Verifikasi:</span>
                    {fpbCheckInfo.checkerName ? (
                      <span
                        className="text-[10px] font-mono text-right text-emerald-700 dark:text-emerald-400 font-medium leading-tight ml-1.5 truncate min-w-0"
                        title={fpbCheckInfo.label}
                      >
                        FPB Check {fpbCheckInfo.checkerName}
                      </span>
                    ) : (
                      <span className="text-muted-foreground/60 font-mono text-[10px] italic text-right ml-1.5 shrink-0">
                        Belum Diverifikasi
                      </span>
                    )}
                  </div>
                  <div className="flex items-center justify-between gap-1.5 min-w-0">
                    <span className="text-muted-foreground shrink-0 whitespace-nowrap">Approved:</span>
                    {pdfData?.approvedBy ? (
                      <span
                        className="text-muted-foreground font-mono text-right ml-1.5 truncate min-w-0"
                        title={`Approved By: ${pdfData.approvedBy} (${formatDateDdMmYy(pdfData.approvedDate) || ''})`}
                      >
                        {pdfData.approvedBy}{pdfData.approvedDate ? ` (${formatDateDdMmYy(pdfData.approvedDate)})` : ''}
                      </span>
                    ) : itemS1?.tglApproveWeb ? (
                      <span className="text-muted-foreground font-mono text-right ml-1.5 truncate min-w-0">
                        {formatDateDdMmYy(itemS1.tglApproveWeb)}
                      </span>
                    ) : itemsS2[0]?.tglApproveWeb ? (
                      <span className="text-muted-foreground font-mono text-right ml-1.5 truncate min-w-0">
                        {formatDateDdMmYy(itemsS2[0].tglApproveWeb)}
                      </span>
                    ) : itemS1?.statusCheckFpb === 'CLOSE' ? (
                      <span className="text-muted-foreground font-mono text-right ml-1.5 truncate min-w-0">
                        Tervalidasi
                      </span>
                    ) : (
                      <span className="text-muted-foreground/60 font-mono text-[10px] italic text-right ml-1.5 shrink-0">
                        Belum Diapprove
                      </span>
                    )}
                  </div>
                  <div className="flex items-center justify-between gap-1.5 min-w-0">
                    <span className="text-muted-foreground shrink-0 whitespace-nowrap">Received:</span>
                    {pdfData?.receivedBy ? (
                      <span
                        className="font-semibold text-foreground font-mono text-right ml-1.5 truncate min-w-0"
                        title={`Received By (Logistic Staff): ${pdfData.receivedBy} (${formatDateDdMmYy(pdfData.receivedDate) || ''})`}
                      >
                        {pdfData.receivedBy}
                      </span>
                    ) : (
                      <span
                        className="text-muted-foreground/60 font-mono text-[10px] italic text-right ml-1.5 shrink-0"
                        title="Belum di-approved / diterima oleh Logistik"
                      >
                        Belum Diterima
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <div className="pt-2 border-t border-border flex flex-col gap-1.5 min-w-0">
                {fpbPdfUrl ? (
                  <a
                    href={fpbPdfUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[10px] font-mono text-blue-700 dark:text-blue-300 bg-blue-500/10 hover:bg-blue-500/20 active:scale-95 px-2 py-1 rounded-md border border-blue-500/30 flex items-center justify-center gap-1.5 text-center truncate font-medium transition cursor-pointer shadow-2xs group min-w-0"
                    title={`Klik untuk Buka Dokumen PDF e-FPB (${primaryDocNum || 'FPB'})${pdfData?.approvedBy ? ` - Approved by ${pdfData.approvedBy}` : ''}`}
                  >
                    <FileText className="size-3 text-blue-600 dark:text-blue-400 shrink-0" />
                    <span className="truncate">Buka PDF e-FPB</span>
                    <ExternalLink className="size-2.5 opacity-60 group-hover:opacity-100 shrink-0" />
                  </a>
                ) : (
                  <span className="text-[10px] font-mono text-blue-700 dark:text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded-md border border-blue-500/20 block text-center truncate font-medium min-w-0">
                    {itemS1?.statusCheckFpb === 'CLOSE' || itemS1?.doneCheckFpb === 'DONE'
                      ? 'FPB Selesai'
                      : 'Menunggu FPB'}
                  </span>
                )}
              </div>
            </div>

            {/* 2. PURCHASING */}
            <div className="p-3.5 rounded-lg bg-card border border-border flex flex-col justify-between space-y-2.5 shadow-xs hover:border-foreground/20 transition min-w-0">
              <div className="min-w-0">
                <div className="flex items-center justify-between pb-2 border-b border-border gap-1 min-w-0">
                  <span className="text-[11px] font-semibold text-foreground font-mono flex items-center gap-1.5 min-w-0 truncate">
                    <ShoppingBag className="size-3.5 text-cyan-600 dark:text-cyan-400 shrink-0" />
                    <span className="truncate">2. PURCHASING</span>
                  </span>
                  <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-muted text-muted-foreground border border-border font-semibold shrink-0">
                    PCH
                  </span>
                </div>
                <div className="mt-2.5 space-y-1.5 text-[11px]">
                  <div className="flex items-center justify-between min-w-0">
                    <span className="text-muted-foreground shrink-0 whitespace-nowrap">PIC:</span>
                    {hasPicPch ? (
                      <span className="font-semibold text-foreground font-mono truncate text-right ml-1.5 min-w-0">
                        {itemS1?.picPch}
                      </span>
                    ) : (
                      <span className="text-muted-foreground/60 font-mono text-[10px] italic text-right ml-1.5 shrink-0">
                        Belum Ditugaskan
                      </span>
                    )}
                  </div>
                  <div className="flex items-center justify-between min-w-0">
                    <span className="text-muted-foreground shrink-0 whitespace-nowrap">No. PO:</span>
                    {hasValidPo ? (
                      <span
                        className="text-foreground font-mono font-bold truncate text-right ml-1.5 min-w-0"
                        title={activePo || itemsS2[0]?.noPo || itemS1?.po || ''}
                      >
                        {activePo || itemsS2[0]?.noPo || itemS1?.po}
                      </span>
                    ) : (
                      <span className="text-muted-foreground/60 font-mono text-[10px] italic text-right ml-1.5 shrink-0">
                        Belum Terbit
                      </span>
                    )}
                  </div>
                  <div className="flex items-center justify-between min-w-0">
                    <span className="text-muted-foreground shrink-0 whitespace-nowrap">Tgl PO:</span>
                    {displayTglPo && displayTglPo !== '-' ? (
                      <span className="text-muted-foreground font-mono text-right ml-1.5 truncate min-w-0">
                        {displayTglPo}
                      </span>
                    ) : (
                      <span className="text-muted-foreground/60 font-mono text-[10px] italic text-right ml-1.5 shrink-0">
                        Belum Terbit
                      </span>
                    )}
                  </div>
                  <div className="flex items-center justify-between min-w-0">
                    <span className="text-muted-foreground shrink-0 whitespace-nowrap">Delivery:</span>
                    {(itemS1?.deliveryTime && itemS1.deliveryTime !== '-') || (itemsS2[0]?.waktuProses && itemsS2[0].waktuProses !== '-') ? (
                      <span className="text-muted-foreground font-mono text-right ml-1.5 truncate min-w-0">
                        {itemS1?.deliveryTime || itemsS2[0]?.waktuProses}
                      </span>
                    ) : (
                      <span className="text-muted-foreground/60 font-mono text-[10px] italic text-right ml-1.5 shrink-0">
                        Belum Dijadwalkan
                      </span>
                    )}
                  </div>
                  <div className="flex items-center justify-between min-w-0">
                    <span className="text-muted-foreground shrink-0 whitespace-nowrap">No. FSTB:</span>
                    {(activeFstb && activeFstb !== '-' && activeFstb !== '(kosong)') || (itemsS2[0]?.noFstb && itemsS2[0].noFstb !== '-') || (itemS1?.noFstb && itemS1.noFstb !== '-') ? (
                      <span
                        className="text-muted-foreground font-mono truncate text-right ml-1.5 min-w-0"
                        title={activeFstb || itemsS2[0]?.noFstb || itemS1?.noFstb || ''}
                      >
                        {activeFstb || itemsS2[0]?.noFstb || itemS1?.noFstb}
                      </span>
                    ) : (
                      <span className="text-muted-foreground/60 font-mono text-[10px] italic text-right ml-1.5 shrink-0">
                        Belum Terbit
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <div className="pt-2 border-t border-border min-w-0">
                {activePo ? (
                  <span className="inline-flex items-center justify-center gap-1 text-[10px] font-mono text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded-md border border-emerald-500/20 w-full truncate font-semibold min-w-0">
                    <Check className="size-3 text-emerald-600 dark:text-emerald-400" />
                    PO Diterbitkan
                  </span>
                ) : (
                  <span className="inline-flex items-center justify-center gap-1 text-[10px] font-mono text-amber-700 dark:text-amber-400 bg-amber-500/10 px-2 py-1 rounded-md border border-amber-500/20 w-full truncate font-medium min-w-0">
                    <Clock className="size-3 text-amber-600 dark:text-amber-400" />
                    Menunggu PO
                  </span>
                )}
              </div>
            </div>

            {/* 3. LOGISTIK TTB / ADMINISTRASI BAST */}
            <div className="p-3.5 rounded-lg bg-card border border-border flex flex-col justify-between space-y-2.5 shadow-xs hover:border-foreground/20 transition min-w-0">
              <div className="min-w-0">
                <div className="flex items-center justify-between pb-2 border-b border-border gap-1 min-w-0">
                  <span className="text-[11px] font-semibold text-foreground font-mono flex items-center gap-1.5 min-w-0 truncate">
                    {isJasaOnly ? (
                      <ClipboardCheck className="size-3.5 text-purple-600 dark:text-purple-400 shrink-0" />
                    ) : (
                      <PackageCheck className="size-3.5 text-purple-600 dark:text-purple-400 shrink-0" />
                    )}
                    <span className="truncate">{isJasaOnly ? '3. TTB / BAST' : isCampuran ? '3. TTB & BAST' : '3. LOGISTIK TTB'}</span>
                  </span>
                  <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-muted text-muted-foreground border border-border font-semibold shrink-0">
                    {isJasaOnly ? 'BAST' : 'LOG'}
                  </span>
                </div>
                <div className="mt-2.5 space-y-1.5 text-[11px]">
                  <div className="flex items-center justify-between min-w-0">
                    <span className="text-muted-foreground shrink-0 whitespace-nowrap">
                      {isJasaOnly ? 'PIC Admin:' : 'PIC TTB:'}
                    </span>
                    {cleanPicTtb ? (
                      <span className="font-semibold text-foreground font-mono truncate text-right ml-1.5 min-w-0">
                        {cleanPicTtb}
                      </span>
                    ) : (
                      <span className="text-muted-foreground/60 font-mono text-[10px] italic text-right ml-1.5 shrink-0">
                        Belum Ditugaskan
                      </span>
                    )}
                  </div>
                  <div className="flex items-start justify-between min-w-0">
                    <span className="text-muted-foreground shrink-0 whitespace-nowrap mt-0.5">
                      {isJasaOnly ? 'No. BAST/TTB:' : 'No. TTB:'}
                    </span>
                    <div className="flex flex-col items-end gap-1 ml-1.5 min-w-0">
                      {parsedTtbList.length > 0 ? (
                        <>
                          <div className="flex flex-wrap justify-end gap-1 min-w-0 max-w-full">
                            {parsedTtbList.map((ttbNo) => (
                              <button
                                key={ttbNo}
                                type="button"
                                onClick={() => {
                                  setSelectedTtbForPhoto(ttbNo);
                                  setShowTimemarkModal(true);
                                }}
                                className="inline-flex items-center gap-1 font-mono text-purple-700 dark:text-purple-300 bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/25 px-1.5 py-0.5 rounded text-[10px] font-bold cursor-pointer transition active:scale-95 truncate"
                                title={`Klik untuk lihat foto serah terima TimeMark / Server: ${ttbNo}`}
                              >
                                <Camera className="size-2.5 text-purple-600 dark:text-purple-400 shrink-0" />
                                <span className="truncate">{ttbNo}</span>
                              </button>
                            ))}
                          </div>
                          {parsedTtbList.length > 1 && (
                            <span className="text-[9px] font-mono text-muted-foreground">
                              ({parsedTtbList.length} Dokumen TTB Terpisah)
                            </span>
                          )}
                        </>
                      ) : activeTtb && activeTtb !== '-' && activeTtb !== '(kosong)' ? (
                        <span className="text-purple-700 dark:text-purple-300 font-mono font-bold text-[10px] truncate">
                          {activeTtb}
                        </span>
                      ) : (
                        <span className="text-muted-foreground/60 font-mono text-[10px] italic text-right ml-1.5 shrink-0">
                          Belum Terbit
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center justify-between min-w-0">
                    <span className="text-muted-foreground shrink-0 whitespace-nowrap">
                      {isJasaOnly ? 'Tgl Validasi:' : 'Tgl TTB:'}
                    </span>
                    {(itemsS2[0]?.tglTtb && itemsS2[0].tglTtb !== '-') || (itemS1?.tglInputTtb && itemS1.tglInputTtb !== '-') ? (
                      <span
                        className="text-muted-foreground font-mono text-right ml-1.5 truncate min-w-0"
                        title={itemsS2[0]?.tglTtb || itemS1?.tglInputTtb}
                      >
                        {formatDateDdMmYy(itemsS2[0]?.tglTtb || itemS1?.tglInputTtb)}
                      </span>
                    ) : (
                      <span className="text-muted-foreground/60 font-mono text-[10px] italic text-right ml-1.5 shrink-0">
                        Belum Terbit
                      </span>
                    )}
                  </div>
                  {(activeFstb || parsedTtbList.length > 0 || activeTtb) && (
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedTtbForPhoto(parsedTtbList[0] || activeTtb);
                        setShowTimemarkModal(true);
                      }}
                      className="w-full mt-1.5 py-1 px-2 rounded-md bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/30 text-[10px] font-semibold flex items-center justify-center gap-1.5 transition active:scale-95 shadow-2xs min-w-0 cursor-pointer"
                      title="Bandingkan foto serah terima TimeMark dengan foto server TTB"
                    >
                      <Camera className="size-3 text-amber-600 dark:text-amber-400 shrink-0" />
                      <span className="truncate">Foto {fstbLast5 ? `TimeMark (${fstbLast5})` : 'TTB'}</span>
                      <ExternalLink className="size-2.5 opacity-60 shrink-0" />
                    </button>
                  )}
                </div>
              </div>
              <div className="pt-2 border-t border-border min-w-0">
                {isLogistikTtbFilled ? (
                  <span className="inline-flex items-center justify-center gap-1 text-[10px] font-mono text-purple-700 dark:text-purple-400 bg-purple-500/10 px-2 py-1 rounded-md border border-purple-500/20 w-full truncate font-semibold min-w-0">
                    <Check className="size-3 text-purple-600 dark:text-purple-400" />
                    {isJasaOnly ? 'BAST Tercatat' : 'TTB Tercatat'}
                  </span>
                ) : (
                  <span className="inline-flex items-center justify-center gap-1 text-[10px] font-mono text-amber-700 dark:text-amber-400 bg-amber-500/10 px-2 py-1 rounded-md border border-amber-500/20 w-full truncate font-medium min-w-0">
                    <Clock className="size-3 text-amber-600 dark:text-amber-400" />
                    {isJasaOnly ? 'Menunggu BAST' : 'Menunggu TTB'}
                  </span>
                )}
              </div>
            </div>

            {/* 4. TIM LAPANGAN / PENGAWAS & TEKNISI */}
            <div className="p-3.5 rounded-lg bg-card border border-border flex flex-col justify-between space-y-2.5 shadow-xs hover:border-foreground/20 transition min-w-0">
              <div className="min-w-0">
                <div className="flex items-center justify-between pb-2 border-b border-border gap-1 min-w-0">
                  <span className="text-[11px] font-semibold text-foreground font-mono flex items-center gap-1.5 min-w-0 truncate">
                    {isJasaOnly ? (
                      <Wrench className="size-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                    ) : (
                      <HardHat className="size-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                    )}
                    <span className="truncate">{isJasaOnly ? '4. TEKNISI LAPANGAN' : isCampuran ? '4. TIM LAPANGAN & TEK' : '4. TIM LAPANGAN'}</span>
                  </span>
                  <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-muted text-muted-foreground border border-border font-semibold shrink-0">
                    {isJasaOnly ? 'TEK' : 'LAP'}
                  </span>
                </div>
                <div className="mt-2.5 space-y-1.5 text-[11px]">
                  <div className="flex items-center justify-between min-w-0">
                    <span className="text-muted-foreground shrink-0 whitespace-nowrap">
                      {isJasaOnly ? 'Teknisi:' : 'PIC Lap:'}
                    </span>
                    {isPicLapFilled ? (
                      <span className="font-semibold text-foreground font-mono truncate text-right ml-1.5 min-w-0">
                        {itemS1?.picLap}
                      </span>
                    ) : (
                      <span
                        className="text-amber-600 dark:text-amber-400 font-mono text-[10px] italic font-medium flex items-center gap-1 text-right ml-1.5 shrink-0"
                        title="PIC penerima tim lapangan belum dicatat pada berkas ini"
                      >
                        <AlertTriangle className="size-2.5 shrink-0" />
                        Belum Tercatat
                      </span>
                    )}
                  </div>
                  <div className="flex items-center justify-between min-w-0">
                    <span className="text-muted-foreground shrink-0 whitespace-nowrap">
                      {isJasaOnly ? 'Ke Lapangan:' : 'Tgl diterima TL:'}
                    </span>
                    {hasTglKeLap ? (
                      <span className="text-muted-foreground font-mono text-right ml-1.5 truncate min-w-0">
                        {formatDateDdMmYy(itemS1?.tglKeTimLapangan)}
                      </span>
                    ) : (
                      <span className="text-muted-foreground/60 font-mono text-[10px] italic text-right ml-1.5 shrink-0">
                        Belum Diserahkan
                      </span>
                    )}
                  </div>
                  <div className="flex items-center justify-between min-w-0">
                    <span className="text-muted-foreground shrink-0 whitespace-nowrap">
                      {isJasaOnly ? 'Tgl Selesai:' : 'Tgl Diantar:'}
                    </span>
                    {hasTglDiantar ? (
                      <span className="text-amber-600 dark:text-amber-400 font-mono text-right ml-1.5 truncate min-w-0 font-medium">
                        {formatDateDdMmYy(itemS1?.tglBarangDiantar)}
                      </span>
                    ) : (
                      <span className="text-muted-foreground/60 font-mono text-[10px] italic text-right ml-1.5 shrink-0">
                        {isJasaOnly ? 'Belum Selesai' : 'Belum Diantar'}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center justify-between min-w-0">
                    <span className="text-muted-foreground shrink-0 whitespace-nowrap">TL ke TTB:</span>
                    {hasTglTimLapKePicTtb ? (
                      <span className="text-muted-foreground font-mono text-right ml-1.5 truncate min-w-0">
                        {formatDateDdMmYy(itemS1?.tglTimLapKePicTtb || itemsS2[0]?.tglTimLapKePicTtb)}
                      </span>
                    ) : (
                      <span className="text-muted-foreground/60 font-mono text-[10px] italic text-right ml-1.5 shrink-0">
                        Belum Ada
                      </span>
                    )}
                  </div>
                  <div className="flex items-center justify-between min-w-0">
                    <span className="text-muted-foreground shrink-0 whitespace-nowrap">TTB ke PCH:</span>
                    {hasTglTtbKePch ? (
                      <span className="text-muted-foreground font-mono text-right ml-1.5 truncate min-w-0">
                        {formatDateDdMmYy(itemS1?.tglTtbKePicPch)}
                      </span>
                    ) : (
                      <span className="text-muted-foreground/60 font-mono text-[10px] italic text-right ml-1.5 shrink-0">
                        Belum Diserahkan
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <div className="pt-2 border-t border-border min-w-0">
                {isCard4Done ? (
                  <span className="inline-flex items-center justify-center gap-1 text-[10px] font-mono text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded-md border border-emerald-500/20 w-full truncate font-semibold min-w-0">
                    <Check className="size-3 text-emerald-600 dark:text-emerald-400" />
                    {isJasaOnly ? 'Pekerjaan Selesai' : 'Serah Terima Lengkap'}
                  </span>
                ) : isTimLapFilled || activeTtb || hasTglKeLap ? (
                  <span className="inline-flex items-center justify-center gap-1 text-[10px] font-mono text-amber-700 dark:text-amber-400 bg-amber-500/10 px-2 py-1 rounded-md border border-amber-500/20 w-full truncate font-semibold min-w-0">
                    <Clock className="size-3 text-amber-600 dark:text-amber-400" />
                    {isJasaOnly ? 'Pelaksanaan Lapangan' : 'Menunggu Konfirmasi Fisik'}
                  </span>
                ) : (
                  <span className="inline-flex items-center justify-center gap-1 text-[10px] font-mono text-muted-foreground bg-muted px-2 py-1 rounded-md border border-border w-full truncate font-medium min-w-0">
                    <span className="size-1.5 rounded-full bg-muted-foreground/40 mr-0.5"></span>
                    Menunggu Distribusi
                  </span>
                )}
              </div>
            </div>

            {/* 5. PURCHASING / ADM */}
            <div className="p-3.5 rounded-lg bg-card border border-border flex flex-col justify-between space-y-2.5 shadow-xs hover:border-foreground/20 transition min-w-0">
              <div className="min-w-0">
                <div className="flex items-center justify-between pb-2 border-b border-border gap-1 min-w-0">
                  <span className="text-[11px] font-semibold text-foreground font-mono flex items-center gap-1.5 min-w-0 truncate">
                    <Landmark className="size-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    <span className="truncate">5. PURCHASING / ADM</span>
                  </span>
                  <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-muted text-muted-foreground border border-border font-semibold shrink-0">
                    ADM
                  </span>
                </div>
                <div className="mt-2.5 space-y-1.5 text-[11px]">
                  <div className="flex items-center justify-between min-w-0">
                    <span className="text-muted-foreground shrink-0 whitespace-nowrap">PIC Adm:</span>
                    {itemS1?.picAdm && itemS1.picAdm !== '-' ? (
                      <span className="font-semibold text-foreground font-mono truncate text-right ml-1.5 min-w-0">
                        {itemS1.picAdm}
                      </span>
                    ) : (
                      <span className="text-muted-foreground/60 font-mono text-[10px] italic text-right ml-1.5 shrink-0">
                        Belum Ditugaskan
                      </span>
                    )}
                  </div>
                  <div className="flex items-center justify-between min-w-0">
                    <span className="text-muted-foreground shrink-0 whitespace-nowrap">No. SPP:</span>
                    {hasValidSpp ? (
                      <span
                        className="text-emerald-600 dark:text-emerald-400 font-mono font-bold truncate text-right ml-1.5 min-w-0"
                        title={itemS1?.noSpp || '-'}
                      >
                        {itemS1?.noSpp}
                      </span>
                    ) : (
                      <span className="text-muted-foreground/60 font-mono text-[10px] italic text-right ml-1.5 shrink-0">
                        Belum Terbit
                      </span>
                    )}
                  </div>
                  <div className="flex items-center justify-between min-w-0">
                    <span className="text-muted-foreground shrink-0 whitespace-nowrap">Tgl SPP:</span>
                    {itemS1?.tglInputSpp && itemS1.tglInputSpp !== '-' ? (
                      <span className="text-muted-foreground font-mono text-right ml-1.5 truncate min-w-0">
                        {formatDateDdMmYy(itemS1.tglInputSpp)}
                      </span>
                    ) : (
                      <span className="text-muted-foreground/60 font-mono text-[10px] italic text-right ml-1.5 shrink-0">Belum Terbit</span>
                    )}
                  </div>
                  <div className="flex items-center justify-between min-w-0">
                    <span className="text-muted-foreground shrink-0 whitespace-nowrap">Ke Keuangan:</span>
                    {itemS1?.tglKeKeuangan && itemS1.tglKeKeuangan !== '-' ? (
                      <span className="text-muted-foreground font-mono text-right ml-1.5 truncate min-w-0">
                        {formatDateDdMmYy(itemS1.tglKeKeuangan)}
                      </span>
                    ) : (
                      <span className="text-muted-foreground/60 font-mono text-[10px] italic text-right ml-1.5 shrink-0">
                        Menunggu Berkas ADM
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <div className="pt-2 border-t border-border min-w-0">
                {hasValidSpp && itemS1?.tglKeKeuangan ? (
                  <span className="inline-flex items-center justify-center gap-1 text-[10px] font-mono text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded-md border border-emerald-500/20 w-full truncate font-semibold min-w-0">
                    <Check className="size-3 text-emerald-600 dark:text-emerald-400" />
                    Selesai di Keuangan
                  </span>
                ) : hasValidSpp ? (
                  <span className="inline-flex items-center justify-center gap-1 text-[10px] font-mono text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded-md border border-emerald-500/20 w-full truncate font-semibold min-w-0">
                    <Clock className="size-3 text-emerald-600 dark:text-emerald-400" />
                    Proses SPP Kas
                  </span>
                ) : itemS1?.tglKeKeuangan || itemS1?.tglKeAdmPch || (itemS1?.picAdm && itemS1.picAdm !== '-') ? (
                  <span className="inline-flex items-center justify-center gap-1 text-[10px] font-mono text-cyan-700 dark:text-cyan-400 bg-cyan-500/10 px-2 py-1 rounded-md border border-cyan-500/20 w-full truncate font-semibold min-w-0">
                    <Clock className="size-3 text-cyan-600 dark:text-cyan-400" />
                    Proses ADM Purchasing
                  </span>
                ) : (
                  <span className="inline-flex items-center justify-center gap-1 text-[10px] font-mono text-muted-foreground bg-muted px-2 py-1 rounded-md border border-border w-full truncate font-medium min-w-0">
                    <span className="size-1.5 rounded-full bg-muted-foreground/40 mr-0.5"></span>
                    Menunggu Berkas ADM
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Split: Tujuan Pengadaan & Tanggal Penerimaan Barang Terakhir */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 min-w-0">
          {/* Kolom 1: Tujuan Pengadaan */}
          <div className="bg-muted/30 rounded-xl border border-border p-3.5 space-y-1.5 flex flex-col justify-between min-w-0">
            <div className="flex items-center justify-between flex-wrap gap-1.5 min-w-0">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Tujuan Pengadaan:
              </span>
              {tujuanPengadaan && !pdfData?.tujuanPeruntukan && armadaKeterangans.length > 0 ? (
                <span className="text-[10px] font-mono text-foreground bg-muted border border-border px-1.5 py-0.2 rounded shrink-0">
                  Worksheet Armada
                </span>
              ) : null}
            </div>
            {tujuanPengadaan ? (
              <p className="text-xs font-medium text-foreground leading-relaxed bg-background p-2.5 rounded-lg border border-border break-words overflow-hidden">
                {tujuanPengadaan}
              </p>
            ) : (
              <p className="text-xs font-mono text-muted-foreground italic bg-background/50 p-2.5 rounded-lg border border-dashed border-border">
                - (kosong)
              </p>
            )}
          </div>

          {/* Kolom 2: Tanggal Penerimaan Barang Terakhir */}
          <div className="bg-muted/30 rounded-xl border border-border p-3.5 space-y-2 flex flex-col justify-between min-w-0">
            <div className="flex items-center justify-between flex-wrap gap-1.5 min-w-0">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Riwayat Penerimaan Terakhir (Pre-FPB):
              </span>
              {pdfData && (
                <span className="text-[10px] font-mono text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.2 rounded font-semibold shrink-0" title="Data tercatat pada formulir e-FPB pemohon">
                  Format FPB
                </span>
              )}
            </div>

            <div className="space-y-1.5">
              {tglPenerimaanTerakhir && tglPenerimaanTerakhir !== '-' && tglPenerimaanTerakhir !== 'BELUM PERNAH' ? (
                <p className="text-xs font-mono font-semibold text-foreground leading-relaxed bg-background p-2.5 rounded-lg border border-border flex items-center gap-2 min-w-0 break-words">
                  <Calendar className="size-3.5 text-cyan-600 dark:text-cyan-400 shrink-0" />
                  <span className="truncate min-w-0">{tglPenerimaanTerakhir}</span>
                </p>
              ) : (
                <p className="text-xs font-mono text-muted-foreground italic bg-background/50 p-2.5 rounded-lg border border-dashed border-border flex items-center gap-2">
                  <Calendar className="size-3.5 text-muted-foreground/40 shrink-0" />
                  <span>BELUM PERNAH (Pengadaan Baru / Pertama Kali)</span>
                </p>
              )}

              {/* Cross-reference penerimaan transaksi saat ini jika TTB sudah ada */}
              {activeTglTtb && (
                <div className="flex items-center gap-1.5 text-[10px] font-mono text-purple-700 dark:text-purple-300 bg-purple-500/10 border border-purple-500/20 px-2 py-1 rounded-md">
                  <CheckCircle2 className="size-3 text-purple-600 shrink-0" />
                  <span>Penerimaan Transaksi Ini: <strong>TTB Tgl {formatDateDdMmYy(activeTglTtb)}</strong></span>
                </div>
              )}
            </div>

            <p className="text-[10px] text-muted-foreground font-sans leading-tight">
              * Kolom ini mencatat riwayat penerimaan barang sejenis <em>sebelum</em> FPB ini diajukan, bukan tanggal TTB transaksi saat ini.
            </p>
          </div>
        </div>

        {/* Items Table Breakdown */}
        <div className="space-y-2.5">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Daftar Rincian Item Barang {activePo ? `(Khusus PO: ${activePo})` : '(Layanan Armada Matching)'}:
              </span>
              {effectiveWorkOrderNo && (
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-700 dark:text-cyan-400 border border-cyan-500/20 font-medium">
                  WO: {effectiveWorkOrderNo}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono text-muted-foreground">
                {pdfData && Array.isArray(pdfData.items) && pdfData.items.length > 0
                  ? `${pdfData.items.length} item (dari PDF e-FPB)`
                  : `${itemsS2.length} item ditemukan`}
              </span>
              {fpbPdfUrl && (
                <button
                  onClick={handleFetchPdfData}
                  disabled={isLoadingPdf}
                  className="h-6 px-2.5 rounded-md border border-blue-500/30 bg-blue-500/10 hover:bg-blue-500/20 text-blue-700 dark:text-blue-400 text-[11px] font-medium flex items-center gap-1 transition shadow-2xs active:scale-95"
                  title="Tarik data rincian item langsung dari PDF e-FPB resmi"
                >
                  <RefreshCw className={`size-3 ${isLoadingPdf ? 'animate-spin' : ''}`} />
                  <span>{pdfData ? 'Tarik Ulang PDF' : 'Tarik dari PDF e-FPB'}</span>
                </button>
              )}
            </div>
          </div>

          {/* Callout box when Excel has 0 items but PDF exists */}
          {itemsS2.length === 0 && !pdfData && fpbPdfUrl && (
            <div className="p-3.5 rounded-xl border border-blue-500/30 bg-blue-500/10 flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-3">
                <div className="size-8 rounded-lg bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                  <FileText className="size-4" />
                </div>
                <div>
                  <div className="font-semibold text-foreground text-xs flex items-center gap-1.5 flex-wrap">
                    <span>Rincian Item Belum Ada di File Excel</span>
                    <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/30">
                      Excel Belum Lengkap
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Dokumen resmi e-FPB (<strong>{primaryDocNum}</strong>) tersedia di server. Anda dapat langsung menarik rincian barang, satuan, qty &amp; tujuan peruntukan straight dari PDF asli.
                  </p>
                </div>
              </div>
              <button
                onClick={handleFetchPdfData}
                disabled={isLoadingPdf}
                className="h-8 px-3.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition shadow-xs active:scale-95 shrink-0"
              >
                {isLoadingPdf ? (
                  <>
                    <RefreshCw className="size-3.5 animate-spin" />
                    <span>Sedang Menarik Data...</span>
                  </>
                ) : (
                  <>
                    <Download className="size-3.5" />
                    <span>Tarik Data Straight dari PDF</span>
                  </>
                )}
              </button>
            </div>
          )}

          {/* Banner when data was successfully loaded from PDF */}
          {pdfData && Array.isArray(pdfData.items) && pdfData.items.length > 0 && (
            <div className="p-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 flex items-center justify-between flex-wrap gap-2 text-xs">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="size-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span className="text-foreground font-medium">
                  Rincian barang berhasil disinkronkan langsung dari PDF e-FPB ({pdfData.items.length} item ditemukan)
                  {pdfData.userArmada ? ` • User/Armada: ${pdfData.userArmada}` : ''}
                </span>
              </div>
              <span className="text-[10px] font-mono text-emerald-700 dark:text-emerald-400 bg-emerald-500/20 px-2 py-0.5 rounded border border-emerald-500/30 font-medium">
                100% terverifikasi
              </span>
            </div>
          )}

          <div className="border border-border rounded-xl overflow-x-auto shadow-2xs">
            <table className="w-full min-w-[760px] text-left text-xs text-foreground">
              <thead className="bg-muted/40 text-muted-foreground text-[10px] uppercase font-semibold border-b border-border">
                <tr>
                  <th className="p-2.5 min-w-[220px] max-w-[340px]">Item Deskripsi &amp; Tujuan</th>
                  <th className="p-2.5 text-center whitespace-nowrap">Priority</th>
                  <th className="p-2.5 text-center whitespace-nowrap">Satuan</th>
                  <th className="p-2.5 text-center whitespace-nowrap">Qty FPB</th>
                  <th className="p-2.5 text-center whitespace-nowrap">Qty PO</th>
                  <th className="p-2.5 text-center whitespace-nowrap">Qty FSTB</th>
                  <th className="p-2.5 text-center whitespace-nowrap">Qty TTB</th>
                  <th className="p-2.5 text-center whitespace-nowrap">Status Pemenuhan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60 font-mono text-xs">
                {pdfData && Array.isArray(pdfData.items) && pdfData.items.length > 0 ? (
                  pdfData.items.map((pi, idx) => {
                    // Cek korelasi ke worksheet Armada/Procurement untuk data PO, FSTB, TTB jika tersedia
                    const matchedS2 = itemsS2.find(
                      (it) =>
                        (it.kodeBarang && pi.itemCode && it.kodeBarang.trim().toLowerCase() === pi.itemCode.trim().toLowerCase()) ||
                        (it.item && pi.itemName && it.item.trim().toLowerCase().includes(pi.itemName.trim().toLowerCase()))
                    );

                    const valQtyPo =
                      matchedS2?.qtyPO !== undefined && matchedS2.qtyPO !== null
                        ? matchedS2.qtyPO
                        : activePo
                        ? pi.qty
                        : '-';
                    const valQtyFstb =
                      matchedS2?.qtyFSTB !== undefined && matchedS2.qtyFSTB !== null
                        ? matchedS2.qtyFSTB
                        : '-';
                    const valQtyTtb =
                      matchedS2?.qtyTTB !== undefined && matchedS2.qtyTTB !== null
                        ? matchedS2.qtyTTB
                        : '-';

                    const itIsJasa = isItemJasa({
                      code: pi.itemCode,
                      name: pi.itemName,
                      unit: pi.unit,
                      description: pi.description,
                    });

                    return (
                      <tr key={`pdf-${pi.itemCode}-${idx}`} className="hover:bg-muted/40 transition bg-emerald-500/5">
                        <td className="p-2.5 text-foreground font-sans min-w-[220px] max-w-[340px] break-words">
                          <div className="font-medium text-foreground flex items-center gap-1.5 flex-wrap">
                            <span className="break-words">{pi.itemName}</span>
                            {itIsJasa ? (
                              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded text-[9px] font-mono bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/30 font-semibold shrink-0" title="Item Kategori Jasa / Pekerjaan">
                                <Wrench className="size-2.5 shrink-0" />
                                JASA
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded text-[9px] font-mono bg-blue-500/15 text-blue-700 dark:text-blue-300 border border-blue-500/30 font-semibold shrink-0" title="Item Kategori Barang / Material Fisik">
                                BARANG
                              </span>
                            )}
                            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded text-[9px] font-mono bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 font-semibold shrink-0">
                              PDF e-FPB
                            </span>
                          </div>
                          {pi.itemCode && (
                            <div className="text-[10px] text-muted-foreground font-mono mt-0.5">
                              Kode: {pi.itemCode}
                            </div>
                          )}
                          {pi.description && (
                            <div className="text-[11px] text-muted-foreground font-mono mt-0.5 break-words">
                              <span className="text-muted-foreground/70 font-sans mr-1">Tujuan:</span>
                              {cleanSingleDescription(pi.description)}
                            </div>
                          )}
                          {pi.lastDate && pi.lastDate !== '-' && (
                            <div className="text-[10px] text-muted-foreground font-mono mt-0.5 flex items-center gap-1">
                              <span className="text-muted-foreground/70 font-sans">Last Supplied:</span>
                              <span className="text-cyan-600 dark:text-cyan-400 font-semibold">{pi.lastDate}</span>
                            </div>
                          )}
                        </td>
                        <td className="p-2.5 text-center">
                          {renderPriorityBadge(pi.priority || itemS1?.priority)}
                        </td>
                        <td className="p-2.5 text-center font-mono">
                          {pi.unit ? (
                            <span
                              className="inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold bg-muted text-foreground border border-border"
                              title={
                                itIsJasa && ['PCS', 'PC', 'BUAH', 'BH'].includes(pi.unit.toUpperCase())
                                  ? `Satuan standar operasional untuk jasa (mengoreksi input e-FPB '${pi.unit}')`
                                  : undefined
                              }
                            >
                              {itIsJasa ? normalizeJasaUnit(pi.unit, pi.itemName) : pi.unit}
                            </span>
                          ) : (
                            <span className="text-muted-foreground/60 text-[11px]">-</span>
                          )}
                        </td>
                        <td className="p-2.5 text-center text-foreground font-semibold font-mono">
                          {typeof pi.qty === 'number' ? pi.qty.toLocaleString('id-ID') : pi.qty}
                        </td>
                        <td className="p-2.5 text-center text-foreground font-semibold font-mono">
                          {typeof valQtyPo === 'number' ? valQtyPo.toLocaleString('id-ID') : valQtyPo}
                        </td>
                        <td className="p-2.5 text-center text-muted-foreground font-mono">
                          {typeof valQtyFstb === 'number' ? valQtyFstb.toLocaleString('id-ID') : valQtyFstb}
                        </td>
                        <td className="p-2.5 text-center text-muted-foreground font-mono">
                          {typeof valQtyTtb === 'number' ? valQtyTtb.toLocaleString('id-ID') : valQtyTtb}
                        </td>
                        <td className="p-2.5 text-center">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-medium border ${
                              matchedS2?.selisih === 0
                                ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20'
                                : 'bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20'
                            }`}
                          >
                            {matchedS2?.status || (activePo ? 'PO Diterbitkan' : 'Disetujui di e-FPB')}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                ) : isLoadingPdf ? (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-muted-foreground">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <RefreshCw className="size-5 animate-spin text-primary" />
                        <span className="text-xs font-mono">
                          Menghubungkan ke server e-FPB dan membaca berkas PDF resmi...
                        </span>
                      </div>
                    </td>
                  </tr>
                ) : itemsS2.length > 0 ? (
                  itemsS2.map((i, idx) => {
                    const itemSatuan = i.satuan || itemS1?.satuan;
                    const valQtyPo =
                      i.qtyPO !== undefined && i.qtyPO !== null
                        ? i.qtyPO
                        : activePo
                        ? i.qtyFPB
                        : '-';
                    const valQtyTtb =
                      i.qtyTTB !== undefined && i.qtyTTB !== null
                        ? i.qtyTTB
                        : i.noTtb
                        ? i.qtyFSTB
                        : '-';

                    const itIsJasa = isItemJasa({
                      code: i.kodeBarang,
                      name: i.item,
                      unit: itemSatuan,
                      description: i.keterangan,
                    });

                    return (
                      <tr key={`${i.fpb}-${i.item}-${idx}`} className="hover:bg-muted/40 transition">
                        <td className="p-2.5 text-foreground font-sans min-w-[220px] max-w-[340px] break-words">
                          <div className="font-medium text-foreground flex items-center gap-1.5 flex-wrap">
                            <span className="break-words">{i.item}</span>
                            {itIsJasa ? (
                              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded text-[9px] font-mono bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/30 font-semibold shrink-0" title="Item Kategori Jasa / Pekerjaan">
                                <Wrench className="size-2.5 shrink-0" />
                                JASA
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded text-[9px] font-mono bg-blue-500/15 text-blue-700 dark:text-blue-300 border border-blue-500/30 font-semibold shrink-0" title="Item Kategori Barang / Material Fisik">
                                BARANG
                              </span>
                            )}
                          </div>
                          {i.kodeBarang && (
                            <div className="text-[10px] text-muted-foreground font-mono mt-0.5">
                              Kode: {i.kodeBarang}
                            </div>
                          )}
                          {i.keterangan && (
                            <div className="text-[11px] text-muted-foreground font-mono mt-0.5 break-words">
                              <span className="text-muted-foreground/70 font-sans mr-1">Tujuan:</span>
                              {i.keterangan}
                            </div>
                          )}
                        </td>
                        <td className="p-2.5 text-center">
                          {renderPriorityBadge(i.priority || itemS1?.priority)}
                        </td>
                        <td className="p-2.5 text-center font-mono">
                          {itemSatuan ? (
                            <span
                              className="inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold bg-muted text-foreground border border-border"
                              title={
                                itIsJasa && ['PCS', 'PC', 'BUAH', 'BH'].includes(itemSatuan.toUpperCase())
                                  ? `Satuan standar operasional untuk jasa (mengoreksi input '${itemSatuan}')`
                                  : undefined
                              }
                            >
                              {itIsJasa ? normalizeJasaUnit(itemSatuan, i.item) : itemSatuan}
                            </span>
                          ) : (
                            <span className="text-muted-foreground/60 text-[11px]">-</span>
                          )}
                        </td>
                        <td className="p-2.5 text-center text-foreground font-semibold font-mono">
                          {typeof i.qtyFPB === 'number' ? i.qtyFPB.toLocaleString('id-ID') : i.qtyFPB}
                        </td>
                        <td className="p-2.5 text-center text-foreground font-semibold font-mono">
                          {typeof valQtyPo === 'number' ? valQtyPo.toLocaleString('id-ID') : valQtyPo}
                        </td>
                        <td className="p-2.5 text-center text-muted-foreground font-mono">
                          {typeof i.qtyFSTB === 'number' ? i.qtyFSTB.toLocaleString('id-ID') : i.qtyFSTB}
                        </td>
                        <td className="p-2.5 text-center text-muted-foreground font-mono">
                          {typeof valQtyTtb === 'number' ? valQtyTtb.toLocaleString('id-ID') : valQtyTtb}
                        </td>
                        <td className="p-2.5 text-center">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-medium border ${
                              i.selisih === 0
                                ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20'
                                : 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20'
                            }`}
                          >
                            {i.status}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td className="p-2.5 text-foreground font-sans min-w-[220px] max-w-[340px] break-words">
                      {itemS1 ? itemS1.item : 'Item Standar'}
                    </td>
                    <td className="p-2.5 text-center">
                      {renderPriorityBadge(itemS1?.priority)}
                    </td>
                    <td className="p-2.5 text-center font-mono">
                      {itemS1?.satuan ? (
                        <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold bg-muted text-foreground border border-border">
                          {itemS1.satuan}
                        </span>
                      ) : (
                        <span className="text-muted-foreground/60 text-[11px]">-</span>
                      )}
                    </td>
                    <td className="p-2.5 text-center text-foreground font-semibold font-mono">
                      {itemS1?.qtyFPB ?? 1}
                    </td>
                    <td className="p-2.5 text-center text-foreground font-semibold font-mono">
                      {itemS1?.qtyPO ?? itemS1?.qtyFPB ?? 1}
                    </td>
                    <td className="p-2.5 text-center text-muted-foreground font-mono">
                      {itemS1?.qtyFSTB ?? 1}
                    </td>
                    <td className="p-2.5 text-center text-muted-foreground font-mono">
                      {itemS1?.qtyTTB ?? itemS1?.qtyFSTB ?? 1}
                    </td>
                    <td className="p-2.5 text-center">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
                        Lengkap
                      </span>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Action Footer */}
        <div className="flex items-center justify-between pt-3 border-t border-border flex-wrap gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            {!isVisitor && (
              <button
                onClick={handleWhatsappNudge}
                className="h-8 px-3.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30 rounded-lg text-xs font-medium flex items-center gap-1.5 transition"
              >
                <MessageSquare className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-400" />
                <span>Eskalasi PIC via WhatsApp</span>
              </button>
            )}
            {fpbPdfUrl && !pdfData && (
              <button
                onClick={handleFetchPdfData}
                disabled={isLoadingPdf}
                className="h-8 px-3.5 bg-blue-500/10 hover:bg-blue-500/20 text-blue-700 dark:text-blue-400 border border-blue-500/30 rounded-lg text-xs font-medium flex items-center gap-1.5 transition shadow-2xs"
                title="Tarik data rincian barang langsung dari PDF server"
              >
                <Download className="size-3.5" />
                <span>{isLoadingPdf ? 'Menarik...' : 'Tarik dari PDF'}</span>
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                if (typeof window !== 'undefined') window.print();
              }}
              className="h-8 px-3.5 bg-background hover:bg-muted text-foreground border border-border rounded-lg text-xs font-semibold flex items-center gap-1.5 transition active:scale-95 shadow-xs cursor-pointer print:hidden"
              title="Cetak atau simpan modul ini ke format PDF"
            >
              <Printer className="size-3.5 text-primary" />
              <span>Print PDF</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="h-8 px-4 bg-muted hover:bg-muted/80 text-foreground border border-border rounded-lg text-xs font-bold tracking-wide transition active:scale-95 cursor-pointer print:hidden"
            >
              TUTUP
            </button>
          </div>
        </div>
      </div>

      {/* Pop-up Box: Pengecekan Stok Persediaan Gudang & Hasil Analisis Rekomendasi */}
      {showStockModal && !isVisitor && (
        <StockAuditModal
          isOpen={showStockModal}
          onClose={() => setShowStockModal(false)}
          fpbNumber={cleanFpb || primaryDocNum || 'FPB'}
          armadaName={itemsS2[0]?.armada || itemS1?.deptArmada || 'Armada Kapal'}
          requestedItems={requestedFpbItems}
          inventoryItems={activeInventory}
          showToast={showToast}
        />
      )}

      {/* Pop-up Box: Verifikasi Bukti Foto TimeMark & Foto Server TTB (Dapat diakses juga oleh Visitor) */}
      {showTimemarkModal && (activeFstb || parsedTtbList.length > 0 || activeTtb) && (
        <TimemarkModal
          isOpen={showTimemarkModal}
          onClose={() => {
            setShowTimemarkModal(false);
            setSelectedTtbForPhoto(null);
          }}
          noFstb={activeFstb}
          noTtb={selectedTtbForPhoto || parsedTtbList[0] || activeTtb}
          fpb={primaryDocNum}
          armada={itemsS2[0]?.armada || itemS1?.deptArmada}
          item={itemsS2[0]?.item || itemS1?.item}
          showToast={showToast}
        />
      )}
    </div>
  );
}
