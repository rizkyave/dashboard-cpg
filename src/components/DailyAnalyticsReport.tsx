'use client';

import React, { useState, useMemo, useEffect } from 'react';
import {
  CalendarDays,
  Calendar,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Search,
  Download,
  Share2,
  Ship,
  Building2,
  Truck,
  Wrench,
  Users,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Check,
  RotateCcw,
  Layers,
  X,
  Package,
  User,
  Filter,
  MessageCircle,
} from 'lucide-react';
import { ProcurementItem, ArmadaItem } from '@/types/procurement';
import { SisaLayananItem } from '@/types/sisaLayanan';
import { loadStoredSisaLayanan } from '@/utils/sisaLayananStorage';
import { normalizeFpbKey } from '@/utils/dataMerger';
import { extractDateInfo, formatDateDdMmYy } from '@/utils/formatDate';
import {
  evaluateFiveDivisionWorkflow,
  hasValue,
  cleanPicName,
} from '@/utils/statusWorkflow';

export interface DailyAnalyticsReportProps {
  items: ProcurementItem[];
  armadaItems?: ArmadaItem[];
  sisaLayananItems?: SisaLayananItem[];
  onOpenAudit?: (fpb: string, po?: string) => void;
  showToast?: (msg: string, type?: 'info' | 'success' | 'warning' | 'error') => void;
  className?: string;
}

type TrafficFilterType = 'ALL' | 'OPS_DELIVERED' | 'OPS_STUCK' | 'ON_DELIVERY';
type FunnelStageCode = 'FPB' | 'PCH' | 'LOG' | 'LAP';
type QuickTableFilter = 'ALL' | 'KAPAL' | 'DARAT' | 'KANTOR' | 'OVERDUE';
type UnitCategory = 'ARMADA' | 'KENDARAAN' | 'ALAT_BERAT' | 'KANTOR';

export interface UnitClassification {
  type: UnitCategory;
  name: string;
  categoryLabel: string;
  badgeColor: string;
  badgeIcon: 'ship' | 'truck' | 'wrench' | 'building';
  isArmada: boolean;
}

interface PrimaryBottleneck {
  stageCode: FunnelStageCode | 'NONE';
  stageName: string;
  reason: string;
  responsiblePic: string;
  isStuck: boolean;
}

interface SisaGoodsSummary {
  primaryName: string;
  totalItemsCount: number;
  qtyText: string;
  allItems: Array<{
    nama: string;
    qty: number;
    satuan: string;
    kodeBarang: string;
    status: string;
  }>;
  tooltipText: string;
  allItemNames: string;
}

export interface OperationalDeliveryInfo {
  isDelivered: boolean;
  deliveryDateIso: string | null;
  deliveryDateFormatted: string;
  deliveryPic: string;
  deliveryNote: string;
}

/**
 * Ekstraksi tanggal dan PIC serah terima tuntas fisik di lapangan (tahap LAP).
 * Mengutamakan tanggal saat PIC Lapangan (BARDI dkk) selesai melakukan pengantaran ke lapangan.
 * TIDAK PERNAH menggunakan tanggal SPP/Keuangan (AMY).
 */
export function getOperationalDeliveryInfo(item: ProcurementItem): OperationalDeliveryInfo {
  const pic = cleanPicName(
    item.picLap && item.picLap !== '-' && item.picLap !== 'null'
      ? item.picLap
      : (item as any).picTl || item.picTtb || 'Tim Lapangan'
  );

  // Urutan prioritas tanggal penyelesaian fisik oleh tim lapangan (BARDI dkk):
  // 1. Tanggal barang diantar ke lapangan (tglBarangDiantar / tglDiantar)
  // 2. Tanggal Tim Lapangan serahkan ke TTB (tglTimLapKePicTtb)
  // 3. Tanggal TTB diserahkan kembali ke PCH (tglTtbKePicPch)
  // 4. Tanggal diterima tim lapangan (tglKeTimLapangan)
  // 5. Tanggal penerbitan TTB (tglTtb / tglInputTtb)
  const candidateDates = [
    item.tglBarangDiantar,
    (item as any).tglDiantar,
    item.tglTimLapKePicTtb,
    item.tglTtbKePicPch,
    item.tglKeTimLapangan,
    (item as any).tglKeTimLap,
    item.tglTtb,
    item.tglInputTtb,
  ];

  let foundDateIso: string | null = null;
  let foundDateFormatted = '-';

  for (const c of candidateDates) {
    if (hasValue(c)) {
      const info = extractDateInfo(c);
      if (info.fullDate && info.year && parseInt(info.year, 10) >= 2020) {
        foundDateIso = info.fullDate;
        foundDateFormatted = formatDateDdMmYy(info.fullDate);
        break;
      }
    }
  }

  const hasDeliveryDate = Boolean(
    hasValue(item.tglBarangDiantar) ||
    hasValue((item as any).tglDiantar) ||
    hasValue(item.tglTimLapKePicTtb) ||
    hasValue(item.tglTtbKePicPch)
  );

  const isDelivered = Boolean(
    hasDeliveryDate ||
    (Boolean(item.picLap && item.picLap !== '-') && foundDateIso !== null)
  );

  const deliveryNote = hasValue(item.tglBarangDiantar) || hasValue((item as any).tglDiantar)
    ? `Diantar ${foundDateFormatted}`
    : hasValue(item.tglTimLapKePicTtb)
    ? `TL ke TTB ${foundDateFormatted}`
    : foundDateFormatted !== '-'
    ? `Serah terima ${foundDateFormatted}`
    : 'Tuntas Terkirim';

  return {
    isDelivered,
    deliveryDateIso: foundDateIso,
    deliveryDateFormatted: foundDateFormatted,
    deliveryPic: pic,
    deliveryNote,
  };
}

/**
 * Klasifikasi presisi peruntukan / unit pemohon dari data asli DEPT/ ARMADA
 * Memisahkan: Armada Kapal (🚢), Truk & Kendaraan Darat (🚛), Alat Berat (🏗️), Kantor & Departemen (🏢)
 */
function classifyUnitType(rawUnit?: string, peruntukan?: string): UnitClassification {
  const raw = String(rawUnit || '').trim();
  const ket = String(peruntukan || '').trim();
  const name = raw || ket || 'Unit Pemohon';
  const combined = `${raw} ${ket}`.trim().toUpperCase();

  // 1. Cek Alat Berat & Mesin
  const heavyMatch = /\b(EXCA|EXCAVATOR|CRANE|FORKLIFT|DOZER|COMPACTOR|GENSET|AIR COMPRESSOR|AIRMAN|KAESER|KOMATSU|SANY|CAT 3|PC 200)\b/i.test(combined);
  if (heavyMatch) {
    return {
      type: 'ALAT_BERAT',
      name,
      categoryLabel: 'Alat Berat',
      badgeColor: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20',
      badgeIcon: 'wrench',
      isArmada: false,
    };
  }

  // 2. Cek Kendaraan Darat & Truk (Plat Nomor atau Truk)
  const isPlate = /\b(KT|DA|B|L|D)\s*\d{3,5}\s*[A-Z]{0,3}\b/i.test(raw);
  const isTruck = /\b(TRUCK|TRUK|TANGKI|DUMP TRUCK|DT DOTON|TRAILER|MOBIL|KENDARAAN)\b/i.test(combined);
  if (isPlate || isTruck) {
    return {
      type: 'KENDARAAN',
      name,
      categoryLabel: 'Truk / Darat',
      badgeColor: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
      badgeIcon: 'truck',
      isArmada: false,
    };
  }

  // 3. Cek Kapal Spesifik CPG (SPOB, TB, TK, MT, AHTS, SV, UB, HB, CAKRA, dll)
  const isVesselSpecific = /\b(AHTS|SPOB|TB|TK|MT|SV|UB|HB|BARGE|TONGKANG|TUGBOAT|TWINSISTER|CAKRA|SEA LION|FERY 471|ROYAL REY|DEWA YANI|DOMINO|BARONGKO|KING OCEAN|DEWI SRI|AJ PUTRA|COASTWAY|PMI ABADI|KING STAR|CINDARA 2107|CINDARA 3112|EQUATOR|MAJENE|MAMUJU|TEMASEK|ATTAKA|SEPINGGAN|MEDIVRO|AMBER|CPL 250|CPL 235|CMPL 01|ROYAL REY 07|ROYAL REY 300|ROYAL REY 350|ROYAL REY 3001|ROYAL REY 3002|ROYAL REY 5001)\b/i.test(raw);

  if (isVesselSpecific) {
    return {
      type: 'ARMADA',
      name,
      categoryLabel: 'Kapal',
      badgeColor: 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20',
      badgeIcon: 'ship',
      isArmada: true,
    };
  }

  // 4. Cek Kantor, Departemen, Mess, Workshop, Site (Gunakan word boundary agar tidak salah deteksi)
  const isOffice = /\b(OFFICE|HEAD OFFICE|KANTOR|DEPT|DEPARTEMEN|DEPARTMENT|HRD|IT|HSE|FINANCE|ACCOUNTING|KEAGENAN|KEPANDUAN|LOGISTIK|PROCUREMENT|PURCHASING|WORKSHOP|BENGKEL|GUDANG|MESS|POOL|SITE|PAGATAN|PULAU BALANG|DPA|GA|GENERAL AFFAIR)\b/i.test(raw);

  if (isOffice) {
    return {
      type: 'KANTOR',
      name,
      categoryLabel: 'Kantor / Dept',
      badgeColor: 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20',
      badgeIcon: 'building',
      isArmada: false,
    };
  }

  // 5. Cek kata kapal umum di peruntukan
  if (/\b(KAPAL|BOAT|VESSEL|PELAYARAN|MARITIM|SAMUDRA|BAHARI)\b/i.test(combined)) {
    return {
      type: 'ARMADA',
      name,
      categoryLabel: 'Kapal',
      badgeColor: 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20',
      badgeIcon: 'ship',
      isArmada: true,
    };
  }

  // Default: Unit Pemohon Operasional
  return {
    type: 'KANTOR',
    name,
    categoryLabel: 'Unit Pemohon',
    badgeColor: 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20',
    badgeIcon: 'building',
    isArmada: false,
  };
}

/**
 * Ekstraksi variasi kunci nomor FPB guna pencocokan data yang akurat
 */
function extractFpbKeys(raw?: string | null): string[] {
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

export default function DailyAnalyticsReport({
  items,
  armadaItems = [],
  sisaLayananItems = [],
  onOpenAudit,
  showToast,
  className = '',
}: DailyAnalyticsReportProps) {
  // Fallback state untuk data Sisa Layanan jika belum terisi dari props
  const [internalSisaItems, setInternalSisaItems] = useState<SisaLayananItem[]>([]);

  useEffect(() => {
    if (sisaLayananItems && sisaLayananItems.length > 0) return;

    loadStoredSisaLayanan().then((stored) => {
      if (stored && stored.items && stored.items.length > 0) {
        setInternalSisaItems(stored.items);
      } else {
        fetch('/api/sisa-layanan')
          .then((res) => res.json())
          .then((data) => {
            if (data.success && Array.isArray(data.items)) {
              setInternalSisaItems(data.items);
            }
          })
          .catch((err) => console.warn('Gagal memuat sisa layanan di DailyAnalyticsReport:', err));
      }
    });
  }, [sisaLayananItems]);

  const effectiveSisaItems = useMemo(() => {
    return sisaLayananItems && sisaLayananItems.length > 0
      ? sisaLayananItems
      : internalSisaItems;
  }, [sisaLayananItems, internalSisaItems]);

  // Index pencocokan cepat: FPB -> Data Barang Sisa Layanan
  const sisaLayananFpbMap = useMemo(() => {
    const map = new Map<string, SisaGoodsSummary>();
    if (!effectiveSisaItems || effectiveSisaItems.length === 0) return map;

    const fpbGroups = new Map<string, SisaLayananItem[]>();

    for (const it of effectiveSisaItems) {
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
  }, [effectiveSisaItems]);

  // 1. Gabungkan seluruh data transaksi unik tanpa duplikasi
  const allTransactions = useMemo(() => {
    const list = [...items];
    if (armadaItems && armadaItems.length > 0) {
      const existingFpbs = new Set(list.map((i) => i.fpb?.trim().toUpperCase()).filter(Boolean));
      for (const a of armadaItems) {
        const fKey = a.fpb?.trim().toUpperCase();
        if (fKey && !existingFpbs.has(fKey)) {
          list.push(a as unknown as ProcurementItem);
          existingFpbs.add(fKey);
        }
      }
    }
    return list;
  }, [items, armadaItems]);

  // 2. Kumpulkan daftar tanggal unik berurutan kronologis descending (MURNI OPERASIONAL LOGISTIK: FPB -> PCH -> LOG -> LAP)
  const availableDates = useMemo(() => {
    const dateMap = new Map<string, { fullDate: string; timestamp: number; formatted: string }>();
    for (const it of allTransactions) {
      const candidates = [
        it.tglBarangDiantar,
        (it as any).tglDiantar,
        it.tglTimLapKePicTtb,
        it.tglTtbKePicPch,
        it.tglKeTimLapangan,
        (it as any).tglKeTimLap,
        it.tglTtb,
        it.tglInputTtb,
        it.tglPo,
        it.date,
        it.tglInputFstb,
        it.tglFstb,
        it.tglFpb,
      ];
      for (const c of candidates) {
        if (!hasValue(c)) continue;
        const info = extractDateInfo(c);
        if (info.fullDate && info.year && parseInt(info.year, 10) >= 2020 && info.timestamp > 0) {
          if (!dateMap.has(info.fullDate)) {
            dateMap.set(info.fullDate, {
              fullDate: info.fullDate,
              timestamp: info.timestamp,
              formatted: formatDateDdMmYy(info.fullDate),
            });
          }
        }
      }
    }
    return Array.from(dateMap.values()).sort((a, b) => b.timestamp - a.timestamp);
  }, [allTransactions]);

  const defaultIsoDate = useMemo(() => {
    return availableDates.length > 0 ? availableDates[0].fullDate : new Date().toISOString().split('T')[0];
  }, [availableDates]);

  // States
  const [selectedIsoDate, setSelectedIsoDate] = useState<string>(defaultIsoDate);
  const [entityFilter, setEntityFilter] = useState<string>('ALL');
  const [trafficFilter, setTrafficFilter] = useState<TrafficFilterType>('ALL');
  const [activeFunnelStage, setActiveFunnelStage] = useState<FunnelStageCode | null>(null);
  const [quickFilter, setQuickFilter] = useState<QuickTableFilter>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [isCopied, setIsCopied] = useState<boolean>(false);
  const pageSize = 12;

  const selectedFormattedDate = useMemo(() => formatDateDdMmYy(selectedIsoDate), [selectedIsoDate]);

  // Filter transaksi berdasarkan tanggal aktivitas terpilih (MURNI OPERASIONAL LOGISTIK: FPB -> PCH -> LOG -> LAP)
  const dailyTransactions = useMemo(() => {
    if (!selectedIsoDate) return [];

    return allTransactions.filter((it) => {
      if (entityFilter !== 'ALL') {
        const itemEnt = (it.entity || '').toUpperCase();
        if (itemEnt !== entityFilter.toUpperCase()) return false;
      }

      const matchesDate = (rawDate?: string | number | null) => {
        if (!hasValue(rawDate)) return false;
        return extractDateInfo(rawDate).fullDate === selectedIsoDate;
      };

      // HANYA mencocokkan tanggal aktivitas fisik/operasional logistik (BARDI dkk).
      // DILARANG mencocokkan tglSpp, tglInputSpp, tglKeKeuangan (AMY / Seksi ADM Keuangan).
      return (
        matchesDate(it.tglBarangDiantar) ||
        matchesDate((it as any).tglDiantar) ||
        matchesDate(it.tglTimLapKePicTtb) ||
        matchesDate(it.tglTtbKePicPch) ||
        matchesDate(it.tglKeTimLapangan) ||
        matchesDate((it as any).tglKeTimLap) ||
        matchesDate(it.tglTtb) ||
        matchesDate(it.tglInputTtb) ||
        matchesDate(it.tglPo) ||
        matchesDate(it.date) ||
        matchesDate(it.tglInputFstb) ||
        matchesDate(it.tglFstb) ||
        matchesDate(it.tglFpb)
      );
    });
  }, [allTransactions, selectedIsoDate, entityFilter]);

  // Evaluasi mendalam alur 4 seksi & deteksi Primary Bottleneck serta sinkronisasi Deskripsi Barang Sisa Layanan
  const dailyEvaluatedItems = useMemo(() => {
    return dailyTransactions.map((item) => {
      const wf = evaluateFiveDivisionWorkflow(item);
      const deliveryInfo = getOperationalDeliveryInfo(item);

      // 1. Cocokkan FPB dengan data Sisa Layanan
      let sisaMatch: SisaGoodsSummary | undefined;
      const candidateKeys = extractFpbKeys(item.fpb);
      for (const k of candidateKeys) {
        if (sisaLayananFpbMap.has(k)) {
          sisaMatch = sisaLayananFpbMap.get(k);
          break;
        }
      }

      const displayItemName = sisaMatch?.primaryName || item.item || '-';
      const displayQty = sisaMatch?.qtyText || (item.qtyPO || item.qtyFPB ? `Qty: ${item.qtyPO || item.qtyFPB}` : '');
      const isMatchedSisa = Boolean(sisaMatch);
      const extraItemsCount = sisaMatch ? Math.max(0, sisaMatch.totalItemsCount - 1) : 0;
      const itemTooltip = sisaMatch ? sisaMatch.tooltipText : (item.item || '-');
      const searchableGoods = sisaMatch ? `${displayItemName} ${sisaMatch.allItemNames}` : (item.item || '');

      // 2. Deteksi tipe unit (Armada vs Kantor)
      const unitInfo = classifyUnitType(
        (item as any).armada || (item as any).deptArmada,
        item.peruntukan
      );

      // 3. Hitung lapse / aging days
      let agingDays = typeof item.lapse === 'number' && item.lapse > 0 ? item.lapse : 0;
      if (!agingDays && item.tglPo) {
        const poDate = extractDateInfo(item.tglPo).timestamp;
        if (poDate > 0) {
          agingDays = Math.max(0, Math.floor((Date.now() - poDate) / (1000 * 60 * 60 * 24)));
        }
      }

      // Evaluasi status tuntas operasional: serah terima fisik di lapangan (oleh BARDI dkk)
      const isOpsComplete = wf.isOperationalDelivered || deliveryInfo.isDelivered;
      const isOpsStuck = !isOpsComplete;

      // 4. Tentukan PRIMARY BOTTLENECK secara presisi & berurutan (4 Seksi Operasional: FPB -> PCH -> LOG -> LAP)
      let primaryBottleneck: PrimaryBottleneck;

      if (isOpsComplete) {
        // Titik 100% tuntas operasional mutlak tercapai saat barang diserahkan di lapangan (tahap LAP/TTB) oleh BARDI dkk
        primaryBottleneck = {
          stageCode: 'NONE',
          stageName: 'Tuntas Terkirim',
          reason: deliveryInfo.deliveryNote || 'Serah Terima Selesai',
          responsiblePic: cleanPicName(deliveryInfo.deliveryPic || item.picLap || item.picTtb || 'Tim Lapangan'),
          isStuck: false,
        };
      } else {
        // Evaluasi hanya 4 seksi fisik logistik operasional
        const operationalStages = wf.stages.slice(0, 4);
        const partialStage = operationalStages.find((s) => s.isPartial);

        if (partialStage) {
          let pic = '-';
          if (partialStage.code === 'FPB') {
            pic = (item.picCheckFpb && item.picCheckFpb !== '-' ? item.picCheckFpb : '') ||
                  (item.picPch && item.picPch !== '-' ? `${item.picPch} (Purchasing)` : '') ||
                  'Pemohon';
          } else if (partialStage.code === 'PCH') {
            pic = (item.picPch && item.picPch !== '-' ? `${item.picPch} (Purchasing)` : '') || 'Purchasing';
          } else if (partialStage.code === 'LOG') {
            pic = (item.picTtb && item.picTtb !== '-' ? `${item.picTtb} (Logistik)` : '') || 'Gudang Logistik';
          } else if (partialStage.code === 'LAP') {
            pic = (deliveryInfo.deliveryPic && deliveryInfo.deliveryPic !== '-' && deliveryInfo.deliveryPic !== 'Tim Lapangan' ? deliveryInfo.deliveryPic : '') ||
                  (item.picLap && item.picLap !== '-' ? `${item.picLap} (Lapangan)` : '') ||
                  'Tim Lapangan';
          }

          primaryBottleneck = {
            stageCode: partialStage.code as FunnelStageCode,
            stageName: partialStage.name,
            reason: partialStage.statusText,
            responsiblePic: cleanPicName(pic),
            isStuck: true,
          };
        } else {
          const firstUnpassedStage = operationalStages.find((s) => !s.isPassed);
          if (firstUnpassedStage) {
            let pic = '-';
            let reasonText = `Menunggu ${firstUnpassedStage.name}`;
            if (firstUnpassedStage.code === 'FPB') {
              pic = (item.picCheckFpb && item.picCheckFpb !== '-' ? item.picCheckFpb : '') ||
                    (item.picPch && item.picPch !== '-' ? `${item.picPch} (Purchasing)` : '') ||
                    'Pemohon';
              reasonText = 'Menunggu Verifikasi FPB';
            } else if (firstUnpassedStage.code === 'PCH') {
              pic = (item.picPch && item.picPch !== '-' ? `${item.picPch} (Purchasing)` : '') || 'Purchasing';
              reasonText = 'Menunggu Penerbitan PO';
            } else if (firstUnpassedStage.code === 'LOG') {
              pic = (item.picTtb && item.picTtb !== '-' ? `${item.picTtb} (Logistik)` : '') || 'Gudang Logistik';
              reasonText = 'Menunggu Penerimaan TTB (Gudang)';
            } else if (firstUnpassedStage.code === 'LAP') {
              pic = (deliveryInfo.deliveryPic && deliveryInfo.deliveryPic !== '-' && deliveryInfo.deliveryPic !== 'Tim Lapangan' ? deliveryInfo.deliveryPic : '') ||
                    (item.picLap && item.picLap !== '-' ? `${item.picLap} (Lapangan)` : '') ||
                    'Tim Lapangan';
              reasonText = 'Menunggu Serah Terima Fisik (Lapangan)';
            }

            primaryBottleneck = {
              stageCode: firstUnpassedStage.code as FunnelStageCode,
              stageName: firstUnpassedStage.name,
              reason: reasonText,
              responsiblePic: cleanPicName(pic),
              isStuck: true,
            };
          } else {
            primaryBottleneck = {
              stageCode: 'NONE',
              stageName: 'Tuntas Terkirim',
              reason: deliveryInfo.deliveryNote || 'Serah Terima Selesai',
              responsiblePic: cleanPicName(deliveryInfo.deliveryPic || item.picLap || 'Tim Lapangan'),
              isStuck: false,
            };
          }
        }
      }

      // On Delivery: Berkas aktif yang sudah melewati PO atau gudang dan sedang dalam proses pengiriman ke armada
      const isOnDelivery = !isOpsComplete && (wf.stages[1].isPassed || wf.stages[2].isPassed || Boolean(item.po));

      return {
        item,
        wf,
        deliveryInfo,
        primaryBottleneck,
        agingDays,
        displayItemName,
        displayQty,
        isMatchedSisa,
        extraItemsCount,
        itemTooltip,
        searchableGoods,
        sisaMatch,
        unitInfo,
        isOpsComplete,
        isOpsStuck,
        isOnDelivery,
      };
    });
  }, [dailyTransactions, sisaLayananFpbMap]);

  // Metrik KPI Eksekutif & Bottleneck Funnel Tracker
  const dailyMetrics = useMemo(() => {
    const total = dailyEvaluatedItems.length;
    let opsDeliveredCount = 0;
    let opsStuckCount = 0;
    let onDeliveryCount = 0;

    const funnelCounts: Record<FunnelStageCode, { stuck: number; name: string; action: string }> = {
      FPB: { stuck: 0, name: 'FPB Permintaan', action: 'Verifikasi Pemohon' },
      PCH: { stuck: 0, name: 'PCH Purchasing', action: 'Delivery PO / FSTB' },
      LOG: { stuck: 0, name: 'LOG Gudang', action: 'Penerimaan TTB' },
      LAP: { stuck: 0, name: 'LAP Lapangan', action: 'Serah Terima Tuntas' },
    };

    const unitsSet = new Set<string>();
    let kapalCount = 0;
    let kendaraanCount = 0;
    let alatBeratCount = 0;
    let kantorCount = 0;

    for (const { item, primaryBottleneck, unitInfo, isOpsComplete, isOpsStuck, isOnDelivery } of dailyEvaluatedItems) {
      if (isOpsComplete) {
        opsDeliveredCount++;
      } else {
        opsStuckCount++;
      }

      if (isOnDelivery) {
        onDeliveryCount++;
      }

      if (primaryBottleneck.isStuck && primaryBottleneck.stageCode !== 'NONE') {
        if (funnelCounts[primaryBottleneck.stageCode]) {
          funnelCounts[primaryBottleneck.stageCode].stuck++;
        }
      }

      if (unitInfo.name && unitInfo.name !== '-') {
        unitsSet.add(unitInfo.name);
      }

      if (unitInfo.type === 'ARMADA') kapalCount++;
      else if (unitInfo.type === 'KENDARAAN') kendaraanCount++;
      else if (unitInfo.type === 'ALAT_BERAT') alatBeratCount++;
      else kantorCount++;
    }

    const opsFulfillmentRate = total > 0 ? Math.round((opsDeliveredCount / total) * 100) : 0;
    const maxStuck = Math.max(...Object.values(funnelCounts).map((f) => f.stuck));
    const unitList = Array.from(unitsSet);

    const breakdownParts = [];
    if (kapalCount > 0) breakdownParts.push(`${kapalCount} Kapal`);
    if (kendaraanCount > 0) breakdownParts.push(`${kendaraanCount} Truk/Darat`);
    if (alatBeratCount > 0) breakdownParts.push(`${alatBeratCount} Alat Berat`);
    if (kantorCount > 0) breakdownParts.push(`${kantorCount} Kantor/Dept`);
    const unitBreakdownText = breakdownParts.join(' • ') || 'Semua Unit Pemohon';

    return {
      total,
      opsDeliveredCount,
      opsStuckCount,
      onDeliveryCount,
      opsFulfillmentRate,
      funnelCounts,
      maxStuck,
      unitCount: unitsSet.size,
      unitList,
      kapalCount,
      kendaraanCount,
      alatBeratCount,
      kantorCount,
      unitBreakdownText,
      // Backward compatibility aliases
      completeCount: opsDeliveredCount,
      stuckCount: opsStuckCount,
      completionRate: opsFulfillmentRate,
      vesselsCount: unitsSet.size,
      vesselList: unitList,
    };
  }, [dailyEvaluatedItems]);

  // Hitung jumlah untuk Quick Filter Tab di atas tabel
  const quickFilterCounts = useMemo(() => {
    let kapal = 0;
    let darat = 0;
    let kantor = 0;
    let overdue = 0;

    for (const it of dailyEvaluatedItems) {
      if (it.unitInfo.type === 'ARMADA') kapal++;
      else if (it.unitInfo.type === 'KENDARAAN' || it.unitInfo.type === 'ALAT_BERAT') darat++;
      else kantor++;

      if (it.agingDays >= 4 && !it.isOpsComplete) overdue++;
    }

    return {
      all: dailyEvaluatedItems.length,
      kapal,
      darat,
      kantor,
      overdue,
    };
  }, [dailyEvaluatedItems]);

  // Filter daftar data berdasarkan seluruh parameter
  const filteredList = useMemo(() => {
    return dailyEvaluatedItems.filter(({ item, wf, primaryBottleneck, searchableGoods, unitInfo, agingDays, isOpsComplete, isOpsStuck, isOnDelivery }) => {
      // 1. Filter KPI Cards
      if (trafficFilter === 'OPS_DELIVERED' && !isOpsComplete) return false;
      if (trafficFilter === 'OPS_STUCK' && !isOpsStuck) return false;
      if (trafficFilter === 'ON_DELIVERY' && !isOnDelivery) return false;

      // 2. Filter Funnel Stage
      if (activeFunnelStage && primaryBottleneck.stageCode !== activeFunnelStage) {
        return false;
      }

      // 3. Quick Filter Tab
      if (quickFilter === 'KAPAL' && unitInfo.type !== 'ARMADA') return false;
      if (quickFilter === 'DARAT' && unitInfo.type !== 'KENDARAAN' && unitInfo.type !== 'ALAT_BERAT') return false;
      if (quickFilter === 'KANTOR' && unitInfo.type !== 'KANTOR') return false;
      if (quickFilter === 'OVERDUE' && (agingDays < 4 || isOpsComplete)) return false;

      // 4. Pencarian Global
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const fpb = (item.fpb || '').toLowerCase();
        const po = (item.po || (item as any).noPo || '').toLowerCase();
        const itName = searchableGoods.toLowerCase();
        const pic = (item.picAktif || item.picPch || item.picTtb || primaryBottleneck.responsiblePic || '').toLowerCase();
        const unit = unitInfo.name.toLowerCase();
        const ent = (item.entity || '').toLowerCase();
        const bottleneckText = primaryBottleneck.reason.toLowerCase();

        return (
          fpb.includes(q) ||
          po.includes(q) ||
          itName.includes(q) ||
          pic.includes(q) ||
          unit.includes(q) ||
          ent.includes(q) ||
          bottleneckText.includes(q)
        );
      }

      return true;
    });
  }, [dailyEvaluatedItems, trafficFilter, activeFunnelStage, quickFilter, searchQuery]);

  // Pagination
  const totalPages = Math.ceil(filteredList.length / pageSize) || 1;
  const paginatedList = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredList.slice(start, start + pageSize);
  }, [filteredList, currentPage, pageSize]);

  // Navigasi Tanggal
  const currentIdx = availableDates.findIndex((d) => d.fullDate === selectedIsoDate);
  const handlePrevDay = () => {
    if (currentIdx !== -1 && currentIdx < availableDates.length - 1) {
      setSelectedIsoDate(availableDates[currentIdx + 1].fullDate);
      setCurrentPage(1);
    }
  };
  const handleNextDay = () => {
    if (currentIdx > 0) {
      setSelectedIsoDate(availableDates[currentIdx - 1].fullDate);
      setCurrentPage(1);
    }
  };

  const handleResetFilters = () => {
    setTrafficFilter('ALL');
    setActiveFunnelStage(null);
    setQuickFilter('ALL');
    setSearchQuery('');
    setEntityFilter('ALL');
    setCurrentPage(1);
  };

  const hasActiveFilters =
    trafficFilter !== 'ALL' ||
    activeFunnelStage !== null ||
    quickFilter !== 'ALL' ||
    searchQuery.trim() !== '' ||
    entityFilter !== 'ALL';

  // Salin Rekap WhatsApp dengan nama barang riil & tipe unit
  const handleCopyWhatsApp = () => {
    const topStuckItems = dailyEvaluatedItems
      .filter(({ isOpsComplete }) => !isOpsComplete)
      .slice(0, 4);

    const text = `📋 *LAPORAN HARIAN SUPPLY CHAIN & PEMENUHAN LOGISTIK CPG*
📅 *Tanggal Aktivitas:* ${selectedFormattedDate} (${selectedIsoDate})
🏢 *Filter Entitas:* ${entityFilter === 'ALL' ? 'Semua Entitas' : entityFilter}

📊 *RINGKASAN EKSEKUTIF PEMENUHAN:*
• Total Berkas Aktif: *${dailyMetrics.total} Dokumen*
• 🟢 Tuntas Terkirim (Serah Terima Lapangan): *${dailyMetrics.opsDeliveredCount} Dokumen (${dailyMetrics.opsFulfillmentRate}%)*
• 🔴 Backlog Fisik Logistik (Belum Tuntas): *${dailyMetrics.opsStuckCount} Dokumen*
• 🚚 Sedang Dalam Pengiriman (On Delivery): *${dailyMetrics.onDeliveryCount} Dokumen*
• 🏢/🚢 Total Unit/Dept Pemohon: *${dailyMetrics.unitCount} Unit (${dailyMetrics.unitBreakdownText})*

🚦 *DISTRIBUSI KENDALA PIPELINE 4 SEKSI:*
1. FPB (Permintaan): ${dailyMetrics.funnelCounts.FPB.stuck > 0 ? `⚠️ *${dailyMetrics.funnelCounts.FPB.stuck} berkas* (Verifikasi Pemohon)` : '✅ Lancar'}
2. PCH (Purchasing): ${dailyMetrics.funnelCounts.PCH.stuck > 0 ? `⚠️ *${dailyMetrics.funnelCounts.PCH.stuck} berkas* (Delivery/FSTB Belum)` : '✅ Lancar'}
3. LOG (Gudang/TTB): ${dailyMetrics.funnelCounts.LOG.stuck > 0 ? `⚠️ *${dailyMetrics.funnelCounts.LOG.stuck} berkas* (Menunggu TTB)` : '✅ Lancar'}
4. LAP (Lapangan): ${dailyMetrics.funnelCounts.LAP.stuck > 0 ? `⚠️ *${dailyMetrics.funnelCounts.LAP.stuck} berkas* (Serah Terima Fisik)` : '✅ Tuntas Terkirim'}
${
  topStuckItems.length > 0
    ? `\n🚨 *PRIORITAS PERCEPATAN FISIK LOGISTIK HARI INI:*
${topStuckItems
  .map(
    ({ item, primaryBottleneck, agingDays, displayItemName, extraItemsCount, unitInfo }, idx) =>
      `${idx + 1}. *FPB:* ${item.fpb} (${unitInfo.badgeIcon === 'ship' ? '🚢 ' : unitInfo.badgeIcon === 'truck' ? '🚛 ' : unitInfo.badgeIcon === 'wrench' ? '🏗️ ' : '🏢 '}${unitInfo.name} [${unitInfo.categoryLabel}])
   └ Barang: ${displayItemName}${extraItemsCount > 0 ? ` (+${extraItemsCount} item)` : ''}
   └ Kendala: [${primaryBottleneck.stageCode}] ${primaryBottleneck.reason}
   └ PIC: ${cleanPicName(primaryBottleneck.responsiblePic)} | Aging: ${agingDays} Hari`
  )
  .join('\n')}`
    : '\n✅ Seluruh dokumen fisik pada tanggal ini berstatus tuntas!'
}

_Dashboard Operasional CPG - Sistem Monitoring Alur 4 Seksi Logistik_`;

    if (navigator.clipboard) {
      navigator.clipboard.writeText(text).then(() => {
        setIsCopied(true);
        setTimeout(() => setIsCopied(false), 2500);
        showToast?.('Format pesan WhatsApp berhasil disalin ke clipboard!', 'success');
      });
    }
  };

  // Unduh CSV
  const handleDownloadCsv = () => {
    if (filteredList.length === 0) {
      showToast?.('Tidak ada data transaksi untuk diekspor.', 'warning');
      return;
    }
    const headers = [
      'NO',
      'NO FPB',
      'ENTITAS',
      'KATEGORI UNIT',
      'NAMA DEPT / UNIT PEMOHON',
      'DESKRIPSI BARANG (SISA LAYANAN)',
      'QTY & SATUAN',
      'NO PO',
      'TGL PO',
      'PIC TANGGUNG JAWAB',
      'STATUS PROGRESS',
      'KENDALA TERKINI',
      'AGING (HARI)',
      'STATUS OVERDUE',
    ];
    const rows = filteredList.map(({ item, wf, deliveryInfo, primaryBottleneck, agingDays, displayItemName, displayQty, sisaMatch, unitInfo, isOpsComplete }, idx) => [
      idx + 1,
      `"${item.fpb || '-'}"`,
      `"${item.entity || '-'}"`,
      `"${unitInfo.categoryLabel}"`,
      `"${unitInfo.name}"`,
      `"${(sisaMatch ? sisaMatch.allItems.map((i) => `${i.nama}${i.qty > 0 ? ` (${i.qty} ${i.satuan})` : ''}`).join('; ') : displayItemName).replace(/"/g, '""')}"`,
      `"${displayQty}"`,
      `"${item.po || (item as any).noPo || '-'}"`,
      `"${formatDateDdMmYy(item.tglPo || item.date)}"`,
      `"${cleanPicName(primaryBottleneck.responsiblePic || (isOpsComplete ? deliveryInfo.deliveryPic : '-'))}"`,
      `"${isOpsComplete ? '✓ TUNTAS TERKIRIM' : wf.summaryBadge}"`,
      `"${primaryBottleneck.reason}"`,
      agingDays,
      agingDays >= 4 && !isOpsComplete ? 'OVERDUE' : agingDays >= 2 && !isOpsComplete ? 'PERHATIAN' : 'NORMAL',
    ]);

    const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Laporan_Harian_CPG_${selectedIsoDate}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToast?.('File CSV berhasil diunduh.', 'success');
  };

  return (
    <div className={`space-y-4 ${className}`}>
      {/* ═══════════════════════════════════════════════════════════
          1. HEADER & CONTROL HUB
          ═══════════════════════════════════════════════════════════ */}
      <div className="bg-card border border-border rounded-2xl p-4 sm:p-5 shadow-xs space-y-4">
        {/* Baris Atas: Judul & Tombol Aksi Utama */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 shrink-0">
              <CalendarDays className="size-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-foreground tracking-tight">
                  Laporan Harian Operasional &amp; Pemenuhan Lapangan (4 Seksi)
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
                  Live Sync
                </span>
                {effectiveSisaItems.length > 0 && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-sky-500/10 text-sky-700 dark:text-sky-300 border border-sky-500/20 hidden md:inline-flex items-center gap-1">
                    <Package className="size-2.5" />
                    <span>Sisa Layanan: {effectiveSisaItems.length.toLocaleString('id-ID')} Item Terhubung</span>
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Monitoring berkas aktif, deskripsi suku cadang Sisa Layanan, pipeline pemenuhan fisik 4 seksi, dan SLA armada.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
            <button
              type="button"
              onClick={handleCopyWhatsApp}
              className={`h-9 px-3.5 rounded-xl text-xs font-semibold shadow-xs flex items-center gap-1.5 transition active:scale-95 cursor-pointer ${
                isCopied
                  ? 'bg-emerald-600 text-white'
                  : 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30'
              }`}
              title="Salin ringkasan pesan ke clipboard format WhatsApp"
            >
              {isCopied ? <Check className="size-4" /> : <Share2 className="size-4" />}
              <span>{isCopied ? 'Tersalin ke WA!' : 'Salin Ringkasan WhatsApp'}</span>
            </button>

            <button
              type="button"
              onClick={handleDownloadCsv}
              className="h-9 px-3.5 rounded-xl text-xs font-medium bg-muted hover:bg-muted/80 text-foreground border border-border shadow-xs flex items-center gap-1.5 transition active:scale-95 cursor-pointer"
            >
              <Download className="size-4 text-muted-foreground" />
              <span>Export CSV</span>
            </button>
          </div>
        </div>

        {/* Baris Bawah: Unified Filter Toolbar */}
        <div className="pt-3 border-t border-border/70 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          {/* Segment Filter Tanggal */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center bg-muted/60 p-1 rounded-xl border border-border shadow-2xs">
              <button
                type="button"
                onClick={handlePrevDay}
                disabled={currentIdx >= availableDates.length - 1}
                className="p-1.5 rounded-lg hover:bg-card text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed transition"
                title="Hari Sebelumnya"
              >
                <ChevronLeft className="size-4" />
              </button>

              <div className="flex items-center gap-1.5 px-2.5">
                <Calendar className="size-3.5 text-primary shrink-0" />
                <input
                  type="date"
                  value={selectedIsoDate}
                  onChange={(e) => {
                    if (e.target.value) {
                      setSelectedIsoDate(e.target.value);
                      setCurrentPage(1);
                    }
                  }}
                  className="bg-transparent text-xs font-bold font-mono text-foreground focus:outline-hidden cursor-pointer"
                />
              </div>

              <button
                type="button"
                onClick={handleNextDay}
                disabled={currentIdx <= 0}
                className="p-1.5 rounded-lg hover:bg-card text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed transition"
                title="Hari Berikutnya"
              >
                <ChevronRight className="size-4" />
              </button>
            </div>

            <button
              type="button"
              onClick={() => {
                if (availableDates.length > 0) {
                  setSelectedIsoDate(availableDates[0].fullDate);
                  setCurrentPage(1);
                }
              }}
              className={`h-8.5 px-2.5 rounded-xl text-xs font-mono font-medium border transition ${
                selectedIsoDate === defaultIsoDate
                  ? 'bg-primary text-primary-foreground border-primary font-semibold shadow-xs'
                  : 'bg-card hover:bg-muted text-muted-foreground border-border'
              }`}
            >
              Data Terakhir ({formatDateDdMmYy(defaultIsoDate)})
            </button>

            <button
              type="button"
              onClick={() => {
                setSelectedIsoDate(new Date().toISOString().split('T')[0]);
                setCurrentPage(1);
              }}
              className="h-8.5 px-2.5 rounded-xl text-xs font-mono font-medium bg-card hover:bg-muted text-muted-foreground border border-border transition"
            >
              Hari Ini
            </button>
          </div>

          {/* Segment Filter Entitas & Global Search */}
          <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
            <div className="relative flex-1 sm:w-72">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
              <input
                type="text"
                placeholder="Cari FPB, Barang Sisa Layanan, PIC..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full h-8.5 pl-8 pr-7 text-xs rounded-xl bg-card border border-border text-foreground placeholder:text-muted-foreground focus:outline-hidden focus:border-primary transition"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded text-muted-foreground hover:text-foreground"
                >
                  <X className="size-3" />
                </button>
              )}
            </div>

            <div className="relative">
              <select
                value={entityFilter}
                onChange={(e) => {
                  setEntityFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="h-8.5 pl-3 pr-8 rounded-xl bg-card border border-border text-xs text-foreground font-medium focus:outline-hidden cursor-pointer"
              >
                <option value="ALL">Semua Entitas</option>
                <option value="CPL">PT CPL</option>
                <option value="PPI">PT PPI</option>
                <option value="HL">PT HL</option>
                <option value="GAJ">PT GAJ</option>
                <option value="MIL">PT MIL</option>
                <option value="SP">PT SP</option>
                <option value="SSK">PT SSK</option>
                <option value="MO">PT MO</option>
              </select>
            </div>
          </div>
        </div>

        {/* Active Filter Chips / Reset Bar */}
        {hasActiveFilters && (
          <div className="pt-2.5 border-t border-border/50 flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[11px] font-mono text-muted-foreground flex items-center gap-1">
                <Filter className="size-3 text-primary" />
                Filter Aktif:
              </span>

              {entityFilter !== 'ALL' && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10.5px] font-mono bg-muted border border-border text-foreground">
                  Entitas: {entityFilter}
                  <button onClick={() => setEntityFilter('ALL')} className="hover:text-rose-500">
                    <X className="size-3" />
                  </button>
                </span>
              )}

              {trafficFilter !== 'ALL' && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10.5px] font-mono bg-primary/10 border border-primary/20 text-primary">
                  Status:{' '}
                  {trafficFilter === 'OPS_DELIVERED'
                    ? 'Tuntas Terkirim (Barang Diterima)'
                    : trafficFilter === 'OPS_STUCK'
                    ? 'Backlog Fisik Logistik'
                    : 'Sedang Dikirim (On Delivery)'}
                  <button onClick={() => setTrafficFilter('ALL')} className="hover:text-rose-500">
                    <X className="size-3" />
                  </button>
                </span>
              )}

              {activeFunnelStage && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10.5px] font-mono bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-400">
                  Tahap: {activeFunnelStage}
                  <button onClick={() => setActiveFunnelStage(null)} className="hover:text-rose-500">
                    <X className="size-3" />
                  </button>
                </span>
              )}

              {quickFilter !== 'ALL' && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10.5px] font-mono bg-sky-500/10 border border-sky-500/20 text-sky-700 dark:text-sky-300">
                  Tipe: {quickFilter === 'KAPAL' ? 'Khusus Kapal' : quickFilter === 'KANTOR' ? 'Khusus Kantor' : 'Overdue > 3H'}
                  <button onClick={() => setQuickFilter('ALL')} className="hover:text-rose-500">
                    <X className="size-3" />
                  </button>
                </span>
              )}

              {searchQuery.trim() && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10.5px] font-mono bg-muted border border-border text-foreground">
                  &ldquo;{searchQuery}&rdquo;
                  <button onClick={() => setSearchQuery('')} className="hover:text-rose-500">
                    <X className="size-3" />
                  </button>
                </span>
              )}
            </div>

            <button
              type="button"
              onClick={handleResetFilters}
              className="text-[11px] font-mono text-rose-600 dark:text-rose-400 hover:underline flex items-center gap-1 cursor-pointer"
            >
              <RotateCcw className="size-3" />
              <span>Reset Semua Filter</span>
            </button>
          </div>
        )}
      </div>

      {/* ═══════════════════════════════════════════════════════════
          2. EXECUTIVE KPI CARDS (4 OPERATIONAL PILLARS + UNIT)
          ═══════════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
        {/* Card 1: Total Berkas Aktif */}
        <div className="p-4 rounded-2xl bg-card border border-border shadow-xs flex flex-col justify-between space-y-2">
          <div className="flex items-center justify-between text-xs text-muted-foreground font-mono font-medium">
            <span>TOTAL BERKAS AKTIF</span>
            <Layers className="size-4 text-primary" />
          </div>
          <div>
            <div className="text-3xl font-extrabold font-mono text-foreground tracking-tight">
              {dailyMetrics.total}
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">
              Aktivitas transaksi pada {selectedFormattedDate}
            </p>
          </div>
        </div>

        {/* Card 2: Tuntas Terkirim (Realisasi 100% di Lapangan) */}
        <div
          onClick={() => setTrafficFilter(trafficFilter === 'OPS_DELIVERED' ? 'ALL' : 'OPS_DELIVERED')}
          className={`p-4 rounded-2xl bg-card border shadow-xs flex flex-col justify-between space-y-2 cursor-pointer transition hover:border-emerald-500/60 ${
            trafficFilter === 'OPS_DELIVERED'
              ? 'ring-2 ring-emerald-500/40 border-emerald-500 bg-emerald-500/5'
              : 'border-emerald-500/30'
          }`}
          title="Batas KPI Logistik: Transaksi tuntas saat serah terima barang di lapangan (LAP/TTB) selesai"
        >
          <div className="flex items-center justify-between text-xs text-emerald-700 dark:text-emerald-400 font-mono font-bold">
            <span>TUNTAS TERKIRIM</span>
            <CheckCircle2 className="size-4 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div>
            <div className="flex items-baseline justify-between">
              <span className="text-3xl font-extrabold font-mono text-emerald-600 dark:text-emerald-400 tracking-tight">
                {dailyMetrics.opsDeliveredCount}
              </span>
              <span className="text-xs font-mono font-bold text-emerald-700 dark:text-emerald-400 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                {dailyMetrics.opsFulfillmentRate}%
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">
              Barang diterima di lapangan (LAP/TTB)
            </p>
          </div>
        </div>

        {/* Card 3: Backlog Fisik Logistik (Kendala Riil Distribusi Barang) */}
        <div
          onClick={() => setTrafficFilter(trafficFilter === 'OPS_STUCK' ? 'ALL' : 'OPS_STUCK')}
          className={`p-4 rounded-2xl bg-card border shadow-xs flex flex-col justify-between space-y-2 cursor-pointer transition hover:border-rose-500/60 ${
            trafficFilter === 'OPS_STUCK'
              ? 'ring-2 ring-rose-500/40 border-rose-500 bg-rose-500/5'
              : 'border-rose-500/30'
          }`}
          title="Klik untuk memfilter berkas yang barang fisiknya masih tertahan / belum serah terima"
        >
          <div className="flex items-center justify-between text-xs text-rose-700 dark:text-rose-400 font-mono font-bold">
            <span>BACKLOG FISIK</span>
            <AlertTriangle className="size-4 text-rose-500" />
          </div>
          <div>
            <div className="flex items-baseline justify-between">
              <span className="text-3xl font-extrabold font-mono text-rose-600 dark:text-rose-400 tracking-tight">
                {dailyMetrics.opsStuckCount}
              </span>
              <span className="text-[10px] font-mono font-bold text-rose-700 dark:text-rose-300 px-2 py-0.5 rounded-full bg-rose-500/10 border border-rose-500/30">
                Belum Tuntas
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">
              Tertahan di FPB / PO / Gudang / Lapangan
            </p>
          </div>
        </div>

        {/* Card 4: Barang Sedang Dikirim (On Delivery) */}
        <div
          onClick={() => setTrafficFilter(trafficFilter === 'ON_DELIVERY' ? 'ALL' : 'ON_DELIVERY')}
          className={`p-4 rounded-2xl bg-card border shadow-xs flex flex-col justify-between space-y-2 cursor-pointer transition hover:border-amber-500/60 ${
            trafficFilter === 'ON_DELIVERY'
              ? 'ring-2 ring-amber-500/40 border-amber-500 bg-amber-500/5'
              : 'border-amber-500/30'
          }`}
          title="Barang telah diproses purchasing/gudang dan sedang dalam perjalanan / proses serah terima"
        >
          <div className="flex items-center justify-between text-xs text-amber-700 dark:text-amber-400 font-mono font-bold">
            <span>SEDANG DIKIRIM</span>
            <Truck className="size-4 text-amber-500" />
          </div>
          <div>
            <div className="flex items-baseline justify-between">
              <span className="text-3xl font-extrabold font-mono text-amber-600 dark:text-amber-400 tracking-tight">
                {dailyMetrics.onDeliveryCount}
              </span>
              <span className="text-[10px] font-mono font-bold text-amber-700 dark:text-amber-300 px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/30">
                On Delivery
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">
              Proses pengantaran ke armada/unit
            </p>
          </div>
        </div>

        {/* Card 5: Total Unit / Pemohon Terdampak */}
        <div className="p-4 rounded-2xl bg-card border border-border shadow-xs flex flex-col justify-between space-y-2">
          <div className="flex items-center justify-between text-xs text-muted-foreground font-mono font-medium">
            <span>TOTAL UNIT / PEMOHON</span>
            <Users className="size-4 text-sky-500" />
          </div>
          <div>
            <div className="text-3xl font-extrabold font-mono text-foreground tracking-tight">
              {dailyMetrics.unitCount}
            </div>
            <p className="text-[11px] text-muted-foreground mt-1 truncate" title={dailyMetrics.unitBreakdownText}>
              {dailyMetrics.unitBreakdownText}
            </p>
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════
          3. PIPELINE 4 SEKSI PEMENUHAN FISIK (CONNECTED FUNNEL BAR)
          ═══════════════════════════════════════════════════════════ */}
      <div className="bg-card border border-border rounded-2xl p-4 sm:p-5 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h4 className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5">
              <AlertTriangle className="size-3.5 text-amber-500" />
              <span>Pipeline Funnel Alur 4 Seksi (Volume &amp; Bottleneck Pemenuhan Fisik)</span>
            </h4>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              🚚 Alur Pemenuhan Lapangan: 1. FPB (Permintaan) ➔ 2. PCH (Purchasing) ➔ 3. LOG (Gudang/TTB) ➔ 4. LAP (Serah Terima Tuntas)
            </p>
          </div>

          {activeFunnelStage && (
            <button
              type="button"
              onClick={() => setActiveFunnelStage(null)}
              className="px-2.5 py-1 rounded-lg bg-muted hover:bg-muted/80 text-foreground text-[11px] font-mono flex items-center gap-1 self-start sm:self-auto transition cursor-pointer"
            >
              <RotateCcw className="size-3 text-muted-foreground" />
              <span>Reset Filter Pipeline ({activeFunnelStage})</span>
            </button>
          )}
        </div>

        {/* Connected Chevron / Funnel Bar 4 Seksi */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 lg:gap-3 pt-1">
          {[
            { code: 'FPB' as FunnelStageCode, num: 1, name: 'Permintaan', sub: 'Verifikasi Pemohon' },
            { code: 'PCH' as FunnelStageCode, num: 2, name: 'Purchasing', sub: 'Delivery PO / FSTB' },
            { code: 'LOG' as FunnelStageCode, num: 3, name: 'Logistik', sub: 'Penerimaan TTB' },
            { code: 'LAP' as FunnelStageCode, num: 4, name: 'Lapangan', sub: 'Serah Terima Tuntas' },
          ].map((stage, sIdx) => {
            const stuckCount = dailyMetrics.funnelCounts[stage.code].stuck;
            const isSelected = activeFunnelStage === stage.code;
            const isMaxBottleneck = stuckCount === dailyMetrics.maxStuck && dailyMetrics.maxStuck > 0;
            const isClean = stuckCount === 0;
            const volumePercent =
              dailyMetrics.opsStuckCount > 0
                ? Math.round((stuckCount / dailyMetrics.opsStuckCount) * 100)
                : 0;

            // Conditional Border & Background Styling
            let cardStyle = 'bg-card border-border hover:border-amber-400/80 shadow-xs';
            let barColor = 'bg-amber-500';

            if (isSelected) {
              cardStyle = 'bg-primary/5 border-primary ring-2 ring-primary/30 shadow-md';
            } else if (isMaxBottleneck) {
              cardStyle = 'bg-rose-500/10 border-rose-500 text-rose-700 dark:text-rose-300 ring-2 ring-rose-500/20 shadow-xs';
              barColor = 'bg-rose-500';
            } else if (isClean) {
              cardStyle = 'bg-emerald-500/5 border-emerald-500/25 hover:border-emerald-500/50';
              barColor = 'bg-emerald-500';
            }

            return (
              <div key={stage.code} className="relative flex items-center">
                <button
                  type="button"
                  onClick={() => setActiveFunnelStage(isSelected ? null : stage.code)}
                  className={`w-full p-3 sm:p-3.5 rounded-xl border text-left transition-all duration-200 flex flex-col justify-between cursor-pointer group ${cardStyle}`}
                >
                  {/* Top: Step Number, Stage Code, and Badge */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <span className={`size-5 rounded-full flex items-center justify-center text-[10px] font-bold font-mono ${
                        isMaxBottleneck
                          ? 'bg-rose-600 text-white'
                          : isClean
                          ? 'bg-emerald-600 text-white'
                          : 'bg-muted text-muted-foreground group-hover:bg-primary group-hover:text-primary-foreground'
                      } transition-colors`}>
                        {stage.num}
                      </span>
                      <span className="text-xs font-bold font-mono text-foreground">
                        {stage.code}
                      </span>
                    </div>

                    {isMaxBottleneck ? (
                      <span className="px-1.5 py-0.2 rounded-full text-[9px] font-mono font-bold bg-rose-600 text-white animate-pulse">
                        Max Bottleneck
                      </span>
                    ) : isClean ? (
                      <span className="px-1.5 py-0.2 rounded-full text-[9px] font-mono font-medium bg-emerald-500/15 text-emerald-700 dark:text-emerald-400">
                        ✓ Lancar
                      </span>
                    ) : (
                      <span className="px-1.5 py-0.2 rounded-full text-[9px] font-mono font-medium bg-amber-500/10 text-amber-700 dark:text-amber-400">
                        {stuckCount} Tertahan
                      </span>
                    )}
                  </div>

                  {/* Middle: Volume Number & Subtitle */}
                  <div className="mt-2.5">
                    <div className="flex items-baseline justify-between">
                      <span className={`text-2xl font-black font-mono tracking-tight ${
                        isMaxBottleneck ? 'text-rose-600 dark:text-rose-400' : 'text-foreground'
                      }`}>
                        {stuckCount}
                      </span>
                      <span className="text-[10px] font-mono text-muted-foreground">
                        {volumePercent}% beban
                      </span>
                    </div>
                    <div className="text-[10.5px] font-medium leading-tight mt-0.5 truncate text-muted-foreground">
                      {stage.sub}
                    </div>
                  </div>

                  {/* Bottom: Volume Bar Indicator (Persentase Tumpukan) */}
                  <div className="mt-2.5 pt-2 border-t border-border/50">
                    <div className="w-full h-1.5 rounded-full bg-muted overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${barColor}`}
                        style={{ width: `${Math.max(isClean ? 100 : 8, volumePercent)}%` }}
                        title={`${volumePercent}% dari total seluruh berkas tertahan`}
                      />
                    </div>
                  </div>
                </button>

                {/* Chevron Arrow Connector between stages on desktop */}
                {sIdx < 3 && (
                  <div className="hidden lg:block absolute -right-2.5 top-1/2 -translate-y-1/2 z-10 pointer-events-none text-muted-foreground/40 font-bold">
                    ➔
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════
          4. INTERACTIVE DATA TABLE (PROBLEM-SOLVING ORIENTED)
          ═══════════════════════════════════════════════════════════ */}
      <div className="bg-card border border-border rounded-2xl shadow-xs overflow-hidden space-y-0">
        {/* Table Toolbar Header with Quick Filter Tabs */}
        <div className="p-3.5 sm:p-4 border-b border-border bg-muted/20 flex flex-col md:flex-row md:items-center justify-between gap-3 flex-wrap">
          {/* Quick Filter Tabs */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              type="button"
              onClick={() => setQuickFilter('ALL')}
              className={`h-8 px-3 rounded-xl text-xs font-mono font-medium border transition cursor-pointer ${
                quickFilter === 'ALL'
                  ? 'bg-primary text-primary-foreground border-primary font-bold shadow-xs'
                  : 'bg-card hover:bg-muted text-muted-foreground border-border'
              }`}
            >
              Semua ({quickFilterCounts.all})
            </button>

            {quickFilterCounts.kapal > 0 && (
              <button
                type="button"
                onClick={() => setQuickFilter('KAPAL')}
                className={`h-8 px-3 rounded-xl text-xs font-mono font-medium border transition flex items-center gap-1.5 cursor-pointer ${
                  quickFilter === 'KAPAL'
                    ? 'bg-sky-600 text-white border-sky-600 font-bold shadow-xs'
                    : 'bg-card hover:bg-muted text-muted-foreground border-border'
                }`}
              >
                <Ship className="size-3.5" />
                <span>Kapal ({quickFilterCounts.kapal})</span>
              </button>
            )}

            {quickFilterCounts.darat > 0 && (
              <button
                type="button"
                onClick={() => setQuickFilter('DARAT')}
                className={`h-8 px-3 rounded-xl text-xs font-mono font-medium border transition flex items-center gap-1.5 cursor-pointer ${
                  quickFilter === 'DARAT'
                    ? 'bg-amber-600 text-white border-amber-600 font-bold shadow-xs'
                    : 'bg-card hover:bg-muted text-muted-foreground border-border'
                }`}
              >
                <Truck className="size-3.5" />
                <span>Truk / Darat ({quickFilterCounts.darat})</span>
              </button>
            )}

            {quickFilterCounts.kantor > 0 && (
              <button
                type="button"
                onClick={() => setQuickFilter('KANTOR')}
                className={`h-8 px-3 rounded-xl text-xs font-mono font-medium border transition flex items-center gap-1.5 cursor-pointer ${
                  quickFilter === 'KANTOR'
                    ? 'bg-slate-700 text-white border-slate-700 font-bold shadow-xs'
                    : 'bg-card hover:bg-muted text-muted-foreground border-border'
                }`}
              >
                <Building2 className="size-3.5" />
                <span>Kantor / Dept ({quickFilterCounts.kantor})</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setQuickFilter('OVERDUE')}
              className={`h-8 px-3 rounded-xl text-xs font-mono font-medium border transition flex items-center gap-1.5 cursor-pointer ${
                quickFilter === 'OVERDUE'
                  ? 'bg-rose-600 text-white border-rose-600 font-bold shadow-xs'
                  : 'bg-card hover:bg-muted text-muted-foreground border-border'
              }`}
            >
              <AlertTriangle className="size-3.5 text-rose-500" />
              <span>Macet &gt; 3 Hari ({quickFilterCounts.overdue})</span>
            </button>
          </div>

          <div className="flex items-center gap-2 self-start md:self-auto text-[11px] text-muted-foreground font-mono">
            <span>Menampilkan <strong>{filteredList.length}</strong> transaksi</span>
            <span>•</span>
            <span>Hal {currentPage} / {totalPages}</span>
          </div>
        </div>

        {filteredList.length === 0 ? (
          <div className="p-10 text-center space-y-3">
            <div className="inline-flex p-3 rounded-full bg-muted text-muted-foreground">
              <CalendarDays className="size-6 text-muted-foreground" />
            </div>
            <div className="max-w-md mx-auto space-y-2">
              <h4 className="text-sm font-semibold text-foreground">
                Tidak ada transaksi yang cocok
              </h4>
              <p className="text-xs text-muted-foreground">
                Tidak ditemukan data dengan filter saat ini pada tanggal {selectedFormattedDate}.
              </p>
              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={handleResetFilters}
                  className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-mono font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition cursor-pointer"
                >
                  <RotateCcw className="size-3.5" />
                  <span>Reset Semua Filter</span>
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left border-collapse table-auto">
              <thead>
                <tr className="border-b border-border bg-muted/40 font-mono text-[10.5px] text-muted-foreground uppercase">
                  <th className="py-2.5 px-2.5 text-center whitespace-nowrap w-9">No</th>
                  <th className="py-2.5 px-3 whitespace-nowrap w-32 min-w-[125px]">Dokumen &amp; Entitas</th>
                  <th className="py-2.5 px-3 whitespace-nowrap w-40 min-w-[140px]">Dept / Unit Pemohon</th>
                  <th className="py-2.5 px-3 whitespace-nowrap min-w-[150px] max-w-[200px]">Deskripsi Barang</th>
                  <th className="py-2.5 px-3 whitespace-nowrap w-24 min-w-[100px]">PIC Terkait</th>
                  <th className="py-2.5 px-3 text-center whitespace-nowrap w-32 min-w-[120px]">Progress (4 Seksi)</th>
                  <th className="py-2.5 px-3 whitespace-nowrap min-w-[150px] max-w-[190px]">Bottleneck Terkini</th>
                  <th className="py-2.5 px-3 text-center whitespace-nowrap w-28 min-w-[110px]">Aging SLA</th>
                  <th className="py-2.5 px-3 text-center whitespace-nowrap w-36 min-w-[135px]">Aksi &amp; Follow-Up</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {paginatedList.map(({ item, wf, deliveryInfo, primaryBottleneck, agingDays, displayItemName, displayQty, isMatchedSisa, extraItemsCount, itemTooltip, unitInfo, isOpsComplete }, idx) => {
                  const globalIdx = (currentPage - 1) * pageSize + idx + 1;
                  const fpb = item.fpb || '-';
                  const po = item.po || (item as any).noPo || '-';

                  // Strict Conditional SLA Aging Styling:
                  // 0-1 Hari: Normal (Hijau) | 2-3 Hari: Perhatian (Kuning) | >= 4 Hari: Overdue (Merah Tebal)
                  const isOverdue = agingDays >= 4;
                  const isWarning = agingDays >= 2 && agingDays <= 3;

                  // Template WhatsApp Deep Link untuk Hubungi PIC
                  const picName = cleanPicName(
                    primaryBottleneck.responsiblePic !== '-'
                      ? primaryBottleneck.responsiblePic
                      : isOpsComplete
                      ? deliveryInfo.deliveryPic
                      : item.picAktif || 'PIC'
                  );
                  const unitLabel = `${unitInfo.categoryLabel} ${unitInfo.name}`;
                  const waMessage = isOpsComplete
                    ? `Halo Pak/Bu ${picName}, dokumen FPB *${fpb}* (${unitLabel}) terkait pengadaan *${displayItemName}* tercatat telah tuntas diserahterimakan di lapangan (${deliveryInfo.deliveryNote} oleh ${deliveryInfo.deliveryPic}).\n\nTerima kasih atas kerja samanya.`
                    : `Halo Pak/Bu ${picName}, mohon update tindak lanjut untuk dokumen FPB *${fpb}* (${unitLabel}) terkait pengadaan *${displayItemName}*.\n\nSaat ini berkas tertahan di tahap *${primaryBottleneck.stageCode}* (${primaryBottleneck.reason}), dengan durasi macet *${agingDays} Hari*.\n\nMohon konfirmasi dan percepatannya. Terima kasih.`;
                  const waUrl = `https://wa.me/?text=${encodeURIComponent(waMessage)}`;

                  return (
                    <tr
                      key={item.id || `${fpb}-${idx}`}
                      className="hover:bg-muted/30 transition-colors group"
                    >
                      {/* 1. No */}
                      <td className="py-2.5 px-2.5 font-mono text-muted-foreground text-[11px] text-center">
                        {globalIdx}
                      </td>

                      {/* 2. Dokumen & Entitas */}
                      <td className="py-2.5 px-3">
                        <span className="font-bold font-mono text-foreground block truncate" title={fpb}>
                          {fpb}
                        </span>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="text-[9.5px] font-mono px-1.5 py-0.2 rounded bg-muted text-muted-foreground border border-border">
                            {item.entity || 'CPG'}
                          </span>
                          <span className="text-[9.5px] font-mono text-muted-foreground">
                            PO: {po !== '-' ? po : 'Belum'}
                          </span>
                        </div>
                      </td>

                      {/* 3. Dept / Unit Pemohon (Badge Tipe Unit Akurat) */}
                      <td className="py-2.5 px-3">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`p-1 rounded-md shrink-0 border ${unitInfo.badgeColor}`}
                            title={unitInfo.categoryLabel}
                          >
                            {unitInfo.badgeIcon === 'ship' && <Ship className="size-3.5" />}
                            {unitInfo.badgeIcon === 'truck' && <Truck className="size-3.5" />}
                            {unitInfo.badgeIcon === 'wrench' && <Wrench className="size-3.5" />}
                            {unitInfo.badgeIcon === 'building' && <Building2 className="size-3.5" />}
                          </span>
                          <div className="min-w-0">
                            <span className="font-semibold text-foreground block truncate text-[11px]" title={unitInfo.name}>
                              {unitInfo.name}
                            </span>
                            <span className="text-[9px] font-mono text-muted-foreground">
                              {unitInfo.categoryLabel}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* 4. Deskripsi Barang (Sinkron Sisa Layanan) */}
                      <td className="py-2.5 px-3">
                        <div className="flex items-start gap-1.5">
                          <Package
                            className={`size-3 shrink-0 mt-0.5 ${
                              isMatchedSisa ? 'text-primary' : 'text-muted-foreground'
                            }`}
                          />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1 flex-wrap">
                              <span
                                className="text-foreground font-medium block truncate max-w-[145px] text-[11px]"
                                title={itemTooltip}
                              >
                                {displayItemName}
                              </span>
                              {extraItemsCount > 0 && (
                                <span
                                  className="px-1 py-0.2 rounded text-[8.5px] font-mono font-semibold bg-primary/10 text-primary border border-primary/20 shrink-0"
                                  title={itemTooltip}
                                >
                                  +{extraItemsCount}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                              {displayQty && (
                                <span className="text-[9.5px] font-mono text-muted-foreground">
                                  {displayQty}
                                </span>
                              )}
                              {isMatchedSisa && (
                                <span
                                  className="text-[8.5px] font-mono px-1 py-0.1 rounded bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20"
                                  title="Data barang terverifikasi dari Database Sisa Layanan"
                                >
                                  ✓ Sisa
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* 5. PIC Bertanggung Jawab */}
                      <td className="py-2.5 px-3">
                        <div className="flex items-center gap-1">
                          <User className="size-3 text-muted-foreground shrink-0" />
                          <span className="font-medium text-foreground truncate text-[11px]" title={primaryBottleneck.responsiblePic}>
                            {cleanPicName(
                              primaryBottleneck.responsiblePic !== '-'
                                ? primaryBottleneck.responsiblePic
                                : isOpsComplete
                                ? deliveryInfo.deliveryPic
                                : item.picAktif || '-'
                            )}
                          </span>
                        </div>
                      </td>

                      {/* 6. Progress (4 Seksi): Linear Step Badge Ringkas */}
                      <td className="py-2.5 px-3 text-center whitespace-nowrap">
                        <div
                          onClick={() => onOpenAudit?.(item.fpb, item.po || (item as any).noPo)}
                          className="inline-flex flex-col items-center justify-center gap-1 cursor-pointer group/step hover:opacity-90"
                          title="Klik untuk membuka Audit Alur 4 Seksi"
                        >
                          {/* 4-Segment Mini Step Progress Bar */}
                          <div className="flex items-center gap-1 w-20">
                            {wf.stages.slice(0, 4).map((st) => {
                              let segColor = 'bg-muted-foreground/20';
                              if (st.isFull) segColor = 'bg-emerald-500';
                              else if (st.isPartial) segColor = 'bg-amber-500 animate-pulse';
                              else if (st.isPassed) segColor = 'bg-sky-500';

                              return (
                                <div
                                  key={st.code}
                                  className={`h-1.5 flex-1 rounded-full transition-colors ${segColor}`}
                                  title={`${st.stepNumber}. ${st.code}: ${st.statusText}`}
                                />
                              );
                            })}
                          </div>

                          {/* Linear Step Text Label */}
                          <span className={`text-[10px] font-mono font-semibold ${
                            isOpsComplete
                              ? 'text-emerald-700 dark:text-emerald-400'
                              : 'text-muted-foreground group-hover/step:text-foreground'
                          }`}>
                            {isOpsComplete
                              ? '✓ Tuntas Terkirim'
                              : `Tahap ${
                                  primaryBottleneck.stageCode === 'FPB'
                                    ? 1
                                    : primaryBottleneck.stageCode === 'PCH'
                                    ? 2
                                    : primaryBottleneck.stageCode === 'LOG'
                                    ? 3
                                    : primaryBottleneck.stageCode === 'LAP'
                                    ? 4
                                    : Math.min(wf.passedCount, 4)
                                }/4 (${primaryBottleneck.stageCode !== 'NONE' ? primaryBottleneck.stageCode : 'FPB'})`}
                          </span>
                          {isOpsComplete && deliveryInfo.deliveryDateFormatted !== '-' && (
                            <span className="text-[9px] font-mono text-emerald-600/80 dark:text-emerald-400/80 block">
                              {deliveryInfo.deliveryNote}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* 7. Bottleneck Terkini */}
                      <td className="py-2.5 px-3">
                        {isOpsComplete ? (
                          <div className="inline-flex flex-col">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-medium bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
                              <Check className="size-3 text-emerald-600 dark:text-emerald-400 shrink-0" />
                              <span>✓ Tuntas ({deliveryInfo.deliveryDateFormatted !== '-' ? deliveryInfo.deliveryDateFormatted : 'Lapangan'})</span>
                            </span>
                            <span className="text-[8.5px] font-mono text-muted-foreground mt-0.5 pl-1">
                              PIC: {cleanPicName(deliveryInfo.deliveryPic)}
                            </span>
                          </div>
                        ) : (
                          <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-mono bg-amber-500/10 text-amber-800 dark:text-amber-300 border border-amber-500/20 max-w-full">
                            <span className="font-bold shrink-0">[{primaryBottleneck.stageCode}]</span>
                            <span className="truncate" title={primaryBottleneck.reason}>
                              {primaryBottleneck.reason}
                            </span>
                          </div>
                        )}
                      </td>

                      {/* 8. Durasi Macet (Aging SLA dengan Conditional Styling Tegas) */}
                      <td className="py-2.5 px-3 text-center whitespace-nowrap">
                        {isOpsComplete ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold border bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20" title={`Barang fisik telah diserahkan oleh ${deliveryInfo.deliveryPic} pada ${deliveryInfo.deliveryDateFormatted}. Tidak ada kendala operasional logistik.`}>
                            <Check className="size-3 shrink-0 text-emerald-600" />
                            <span>Tuntas ({deliveryInfo.deliveryDateFormatted})</span>
                          </span>
                        ) : isOverdue ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-extrabold border bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500 shadow-xs animate-pulse" title="Melebihi SLA (> 3 Hari) - Butuh Tindak Lanjut Mendesak">
                            <AlertTriangle className="size-3 shrink-0 text-rose-600 dark:text-rose-400" />
                            <span>{agingDays}H Overdue</span>
                          </span>
                        ) : isWarning ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold border bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30" title="Masa Waktu Peringatan (2-3 Hari)">
                            <Clock className="size-3 shrink-0" />
                            <span>{agingDays}H Perhatian</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold border bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20" title="Dalam Batas SLA Aman (0-1 Hari)">
                            <Clock className="size-3 shrink-0" />
                            <span>{agingDays}H Normal</span>
                          </span>
                        )}
                      </td>

                      {/* 9. Aksi & Quick Follow-Up PIC */}
                      <td className="py-2.5 px-3 text-center whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5 justify-center">
                          {/* Tombol Audit */}
                          <button
                            type="button"
                            onClick={() => onOpenAudit?.(item.fpb, item.po || (item as any).noPo)}
                            className="h-7 px-2 rounded-lg bg-muted hover:bg-primary hover:text-primary-foreground text-foreground border border-border text-[10.5px] font-medium transition active:scale-95 cursor-pointer inline-flex items-center gap-1"
                            title="Buka Audit Rinci 5 Seksi"
                          >
                            <span>Audit</span>
                            <ArrowRight className="size-3" />
                          </button>

                          {/* Tombol Hubungi PIC via WhatsApp Deep Link */}
                          {!isOpsComplete && (
                            <a
                              href={waUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="h-7 px-2 rounded-lg bg-emerald-500/10 hover:bg-emerald-600 hover:text-white text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 text-[10.5px] font-medium transition active:scale-95 inline-flex items-center gap-1 cursor-pointer"
                              title={`Hubungi ${picName} via WhatsApp mengenai berkas ini`}
                            >
                              <MessageCircle className="size-3 text-emerald-600 dark:text-emerald-400 group-hover:text-white" />
                              <span>WA PIC</span>
                            </a>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Toolbar */}
        {filteredList.length > pageSize && (
          <div className="p-3.5 border-t border-border flex items-center justify-between text-xs text-muted-foreground bg-muted/20 flex-wrap gap-2">
            <span className="font-mono text-[11px]">
              Menampilkan {(currentPage - 1) * pageSize + 1} -{' '}
              {Math.min(currentPage * pageSize, filteredList.length)} dari {filteredList.length} transaksi
            </span>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setCurrentPage(1)}
                disabled={currentPage <= 1}
                className="p-1 rounded-md hover:bg-card disabled:opacity-30 disabled:cursor-not-allowed transition cursor-pointer"
              >
                <ChevronsLeft className="size-4" />
              </button>
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage <= 1}
                className="p-1 rounded-md hover:bg-card disabled:opacity-30 disabled:cursor-not-allowed transition cursor-pointer"
              >
                <ChevronLeft className="size-4" />
              </button>
              <span className="px-2 font-mono font-bold text-foreground">
                {currentPage}
              </span>
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage >= totalPages}
                className="p-1 rounded-md hover:bg-card disabled:opacity-30 disabled:cursor-not-allowed transition cursor-pointer"
              >
                <ChevronRight className="size-4" />
              </button>
              <button
                type="button"
                onClick={() => setCurrentPage(totalPages)}
                disabled={currentPage >= totalPages}
                className="p-1 rounded-md hover:bg-card disabled:opacity-30 disabled:cursor-not-allowed transition cursor-pointer"
              >
                <ChevronsRight className="size-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
