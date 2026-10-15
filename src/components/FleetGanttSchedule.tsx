'use client';

import React, { useState, useMemo } from 'react';
import REAL_FLEET_DATA from '@/data/realFleetData.json';
import {
  Calendar,
  Search,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Layers,
  Ship,
  Sparkles,
  Info,
  CheckCircle2,
  Clock,
  AlertTriangle,
  RotateCcw,
  AlertCircle,
  PackageCheck,
  Check,
} from 'lucide-react';

// ============================================================================
// HELPER: Konversi tanggal transaksi ke indeks kolom timeline 0..19 (Jun W1..Okt W4)
// Mendukung format: Excel Serial, Teks Indonesia ('30 Sep 2026', '15 Okt 2026'),
// ISO ('2026-09-30'), DMY ('30/09/2026')
// ============================================================================
function dateToTimelineCol(val: any): number | null {
  if (!val && val !== 0) return null;
  let year = 2026;
  let month = 7;
  let day = 1;

  if (typeof val === 'number') {
    if (val > 10000 && val < 100000) {
      const d = new Date((val - 25569) * 86400 * 1000);
      year = d.getUTCFullYear();
      month = d.getUTCMonth() + 1;
      day = d.getUTCDate();
    } else if (val > 1000000000000) {
      const d = new Date(val);
      year = d.getFullYear();
      month = d.getMonth() + 1;
      day = d.getDate();
    }
  } else if (typeof val === 'string') {
    const trimmed = val.trim();
    if (!trimmed || trimmed === '-') return null;

    // Format Tanggal Teks: "30 Sep 2026", "24 September 2026", "15 Okt 2026"
    const textMatch = trimmed.match(/^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})/);
    if (textMatch) {
      day = parseInt(textMatch[1], 10);
      year = parseInt(textMatch[3], 10);
      const mStr = textMatch[2].toLowerCase();
      const mNames: Record<string, number> = {
        jan: 1, januari: 1, january: 1,
        feb: 2, februari: 2, february: 2,
        mar: 3, maret: 3, march: 3,
        apr: 4, april: 4,
        mei: 5, may: 5,
        jun: 6, juni: 6, june: 6,
        jul: 7, juli: 7, july: 7,
        agu: 8, agustus: 8, aug: 8, august: 8,
        sep: 9, september: 9,
        okt: 10, oktober: 10, oct: 10, october: 10,
        nov: 11, november: 11,
        des: 12, desember: 12, dec: 12, december: 12,
      };
      month = mNames[mStr.slice(0, 3)] || 7;
    } else {
      const isoMatch = trimmed.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
      if (isoMatch) {
        year = parseInt(isoMatch[1], 10);
        month = parseInt(isoMatch[2], 10);
        day = parseInt(isoMatch[3], 10);
      } else {
        const dmyMatch = trimmed.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
        if (dmyMatch) {
          year = parseInt(dmyMatch[3], 10);
          month = parseInt(dmyMatch[2], 10);
          day = parseInt(dmyMatch[1], 10);
        } else {
          const num = parseFloat(trimmed);
          if (!isNaN(num) && num > 10000 && num < 100000) {
            const d = new Date((num - 25569) * 86400 * 1000);
            year = d.getUTCFullYear();
            month = d.getUTCMonth() + 1;
            day = d.getUTCDate();
          } else {
            const parsed = Date.parse(trimmed);
            if (!isNaN(parsed)) {
              const d = new Date(parsed);
              year = d.getFullYear();
              month = d.getMonth() + 1;
              day = d.getDate();
            } else {
              return null;
            }
          }
        }
      }
    }
  } else {
    return null;
  }

  // 06 (Jun): 0..3, 07 (Jul): 4..7, 08 (Agu): 8..11, 09 (Sep): 12..15, 10 (Okt): 16..19
  let monthOffset = 4;
  if (month <= 6) monthOffset = 0;
  else if (month === 7) monthOffset = 4;
  else if (month === 8) monthOffset = 8;
  else if (month === 9) monthOffset = 12;
  else monthOffset = 16;

  let weekOffset = 0;
  if (day <= 7) weekOffset = 0;
  else if (day <= 14) weekOffset = 1;
  else if (day <= 21) weekOffset = 2;
  else weekOffset = 3;

  return Math.max(0, Math.min(19, monthOffset + weekOffset));
}

export interface FleetGanttItem {
  id?: string;
  fpb: string;
  armada: string;
  workOrderNo?: string;
  item: string;
  qtyFPB: number;
  qtyFSTB: number;
  selisih: number;
  status: string;
  entity?: string;
  tglFpb?: string;
  noPo?: string;
  tglPo?: string;
  noFstb?: string;
  tglFstb?: string;
  noTtb?: string;
  tglTtb?: string;
  satuan?: string;
  keterangan?: string;
  kategori?: string;
  priority?: string;
  waktuProses?: string | number;
  tglBarangDiantar?: string;
  picLap?: string;
  tglTimLapKePicTtb?: string;
  tglTtbKePicPch?: string;
  noSpp?: string;
}

export interface GanttSubItem {
  fpb: string;
  item: string;
  startCol: number;
  endCol: number;
  status: 'LENGKAP' | 'PROSES' | 'PARSIAL' | 'BACKLOG';
  qtyFpb?: number;
  qtyFstb?: number;
  selisih?: number;
  satuan?: string;
  tglFpb?: string;
  tglPo?: string;
  tglFstb?: string;
  noPo?: string;
}

export interface CuratedVessel {
  name: string;
  tag: string;
  fpbCount: number;
  startCol: number; // 0 to 19 (Jun W1 = 0, Okt W4 = 19)
  endCol: number;   // 0 to 19
  gradientStyle: string;
  colorType: 'HIJAU' | 'BIRU_ORANYE' | 'BIRU_ORANYE_MERAH' | 'HIJAU_MERAH' | 'HIJAU_ORANYE' | 'HIJAU_BIRU_MERAH';
  summaryText: string;
  statusBadge: { lengkap: number; proses: number; parsial: number; backlog: number };
  sampleItems: GanttSubItem[];
}

interface FleetGanttScheduleProps {
  items?: FleetGanttItem[];
  onOpenAudit?: (fpb: string, po?: string) => void;
  selectedEntity?: string;
}

// 5 Bulan Timeline (Juni - Oktober 2026)
const TIMELINE_MONTHS = [
  { key: '06', name: 'JUN', label: 'Juni 2026', startCol: 0 },
  { key: '07', name: 'JUL', label: 'Juli 2026', startCol: 4 },
  { key: '08', name: 'AGU', label: 'Agustus 2026', startCol: 8 },
  { key: '09', name: 'SEP', label: 'September 2026', startCol: 12 },
  { key: '10', name: 'OKT', label: 'Oktober 2026', startCol: 16 },
];

const WEEKS_PER_MONTH = ['W1', 'W2', 'W3', 'W4'];

// Today Marker Position: 15 Oktober 2026 (W3 -> Col 18)
const TODAY_COL = 18;

const PAGE_SIZE = 12;

export default function FleetGanttSchedule({
  items = [],
  onOpenAudit,
  selectedEntity = 'ALL',
}: FleetGanttScheduleProps) {
  const [selectedPeriod, setSelectedPeriod] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'LENGKAP' | 'PROSES' | 'PARSIAL' | 'BACKLOG'>('ALL');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});
  const [allExpanded, setAllExpanded] = useState<boolean>(false);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [hoveredVessel, setHoveredVessel] = useState<CuratedVessel | null>(null);
  const [hoveredSubItem, setHoveredSubItem] = useState<{
    vesselName: string;
    sub: GanttSubItem;
  } | null>(null);

  // ==========================================================================
  // PEMETAAN DATA LENGKAP ARMADA RIIL & RINCIAN TIKET FPB (100% RIIL PROCUREMENT)
  // ==========================================================================
  const fullFleetList = useMemo<CuratedVessel[]>(() => {
    if (items && items.length > 0) {
      const map = new Map<string, {
        name: string;
        tag: string;
        fpbs: Set<string>;
        items: FleetGanttItem[];
        startCols: number[];
        endCols: number[];
        lengkap: number;
        proses: number;
        parsial: number;
        backlog: number;
      }>();

      for (const it of items) {
        const rawName = (it.armada || (it as any).deptArmada || '').trim();
        if (!rawName || rawName === '-' || rawName.length < 2) continue;

        let tag = it.entity?.trim().toUpperCase() || '';
        if (!tag || tag === 'ALL' || tag.length > 5) {
          if (it.fpb && it.fpb.includes('-')) {
            tag = it.fpb.split('-')[0].trim().toUpperCase();
          }
        }
        if (!tag) tag = 'CPL';

        let entry = map.get(rawName);
        if (!entry) {
          entry = {
            name: rawName,
            tag,
            fpbs: new Set(),
            items: [],
            startCols: [],
            endCols: [],
            lengkap: 0,
            proses: 0,
            parsial: 0,
            backlog: 0,
          };
          map.set(rawName, entry);
        }

        if (it.fpb) entry.fpbs.add(it.fpb.trim());
        entry.items.push(it);

        const qFpb = Number(it.qtyFPB) || 0;
        const qFstb = Number(it.qtyFSTB) || 0;
        const qSel = it.selisih !== undefined ? Number(it.selisih) : Math.max(0, qFpb - qFstb);

        const statusUpper = (it.status || '').toUpperCase();
        const isDelivered = Boolean(
          it.tglBarangDiantar ||
          (it as any).picLap ||
          it.tglTimLapKePicTtb ||
          it.tglTtbKePicPch ||
          (it as any).noSpp
        );
        const isComp =
          isDelivered ||
          (qSel === 0 && qFstb > 0) ||
          statusUpper.includes('LENGKAP') ||
          statusUpper.includes('CLOSE') ||
          statusUpper.includes('SELESAI') ||
          statusUpper.includes('DELIVERED') ||
          Boolean(it.noTtb);
        const isPart = !isComp && (statusUpper.includes('PARSIAL') || (qFstb > 0 && qSel > 0));
        const isBacklog =
          !isComp &&
          (statusUpper.includes('BACKLOG') ||
            statusUpper.includes('KRITIS') ||
            statusUpper.includes('BELUM TERPENUHI') ||
            statusUpper.includes('OPEN') ||
            (!isPart && (it.noPo === '-' || !it.noPo)));

        if (isComp) entry.lengkap++;
        else if (isPart) entry.parsial++;
        else if (isBacklog) entry.backlog++;
        else entry.proses++;

        const dateStr = it.tglFstb || it.tglPo || it.tglFpb || (it as any).date;
        const col = dateToTimelineCol(dateStr);
        if (col !== null) {
          entry.startCols.push(col);
          entry.endCols.push(col);
        }
      }

      if (map.size > 0) {
        const months = ['Jun', 'Jul', 'Agu', 'Sep', 'Okt'];
        const realFleetMap = new Map<string, CuratedVessel>(
          (REAL_FLEET_DATA as CuratedVessel[]).map((v) => [v.name.toUpperCase(), v])
        );

        const dynamicList: CuratedVessel[] = [];

        for (const entry of Array.from(map.values())) {
          const curatedMatch = realFleetMap.get(entry.name.toUpperCase());
          const fpbCount = Math.max(entry.fpbs.size, 1);
          const minCol = entry.startCols.length > 0 ? Math.min(...entry.startCols) : (curatedMatch?.startCol ?? 4);
          const maxCol = entry.endCols.length > 0 ? Math.max(...entry.endCols) : (curatedMatch?.endCol ?? 19);
          const startCol = Math.max(0, Math.min(minCol, 18));
          const endCol = Math.max(startCol + 1, Math.min(maxCol, 19));

          const totalStatus = entry.lengkap + entry.proses + entry.parsial + entry.backlog || 1;
          const lkRatio = entry.lengkap / totalStatus;
          const bkRatio = entry.backlog / totalStatus;

          let gradientStyle = 'bg-gradient-to-r from-sky-600 via-sky-500 to-amber-500';
          let colorType: CuratedVessel['colorType'] = 'BIRU_ORANYE';

          if (lkRatio >= 0.7) {
            gradientStyle = 'bg-gradient-to-r from-emerald-600 via-emerald-500 to-teal-500';
            colorType = 'HIJAU';
          } else if (bkRatio >= 0.25) {
            gradientStyle = 'bg-gradient-to-r from-emerald-600 via-amber-500 to-rose-600';
            colorType = 'HIJAU_MERAH';
          } else if (entry.backlog > 0 && entry.proses > 0) {
            gradientStyle = 'bg-gradient-to-r from-sky-600 via-amber-500 to-rose-600';
            colorType = 'BIRU_ORANYE_MERAH';
          }

          const sM = months[Math.floor(startCol / 4)] || 'Jul';
          const sW = 'W' + ((startCol % 4) + 1);
          const eM = months[Math.floor(endCol / 4)] || 'Okt';
          const eW = 'W' + ((endCol % 4) + 1);
          const summaryText = `${sM} ${sW} - ${eM} ${eW}`;

          let sampleItems: GanttSubItem[] = [];
          const seenKeys = new Set<string>();

          for (const child of entry.items) {
            const fpbNum = (child.fpb || '').trim();
            if (!fpbNum) continue;

            const rawItemName = (child.item || '').trim();
            const comboKey = `${fpbNum}_${rawItemName}`;
            if (seenKeys.has(comboKey)) continue;
            seenKeys.add(comboKey);

            const qFpb = Number(child.qtyFPB) || 0;
            const qFstb = Number(child.qtyFSTB) || 0;
            const qSel = child.selisih !== undefined ? Number(child.selisih) : Math.max(0, qFpb - qFstb);

            const childStatusUpper = (child.status || '').toUpperCase();
            const isChildDelivered = Boolean(
              child.tglBarangDiantar ||
              (child as any).picLap ||
              child.tglTimLapKePicTtb ||
              child.tglTtbKePicPch ||
              (child as any).noSpp
            );

            let childStatus: 'LENGKAP' | 'PROSES' | 'PARSIAL' | 'BACKLOG' = 'PROSES';
            if (isChildDelivered || (qSel === 0 && qFstb > 0) || childStatusUpper.includes('LENGKAP') || childStatusUpper.includes('CLOSE') || childStatusUpper.includes('SELESAI') || child.noTtb) {
              childStatus = 'LENGKAP';
            } else if (childStatusUpper.includes('PARSIAL') || (qFstb > 0 && qSel > 0)) {
              childStatus = 'PARSIAL';
            } else if (childStatusUpper.includes('BACKLOG') || childStatusUpper.includes('KRITIS') || (qFstb === 0 && qSel > 0) || childStatusUpper.includes('OPEN')) {
              childStatus = 'BACKLOG';
            } else if (child.noPo && child.noPo !== '-') {
              childStatus = 'PROSES';
            }

            // Hitung posisi granular timeline sub-item
            const fpbCol = dateToTimelineCol(child.tglFpb);
            const poCol = dateToTimelineCol(child.tglPo);
            const fstbCol = dateToTimelineCol(child.tglFstb);

            let cStart = fpbCol ?? poCol ?? fstbCol ?? startCol;
            let cEnd = cStart + 1;

            if (childStatus === 'LENGKAP') {
              cEnd = fstbCol ?? (poCol !== null ? Math.max(cStart + 1, poCol + 1) : cStart + 1);
            } else if (childStatus === 'BACKLOG') {
              // Item Backlog: bar membentang dari pengajuan hingga minggu berjalan (TODAY Col 18)
              cEnd = Math.max(cStart + 1, TODAY_COL);
            } else if (childStatus === 'PARSIAL') {
              cEnd = Math.max(cStart + 2, fstbCol ?? 16);
            } else {
              cEnd = Math.max(cStart + 1, poCol ?? (cStart + 2));
            }

            cStart = Math.max(0, Math.min(18, cStart));
            cEnd = Math.max(cStart + 1, Math.min(19, cEnd));

            const itemName = rawItemName && rawItemName !== '-' && !rawItemName.toLowerCase().startsWith('kebutuhan')
              ? rawItemName
              : (curatedMatch?.sampleItems?.find((s) => s.fpb === fpbNum)?.item || `Suku Cadang & Perlengkapan`);

            sampleItems.push({
              fpb: fpbNum,
              item: itemName,
              startCol: cStart,
              endCol: cEnd,
              status: childStatus,
              qtyFpb: qFpb,
              qtyFstb: qFstb,
              selisih: qSel,
              satuan: child.satuan || 'UNIT',
              tglFpb: child.tglFpb,
              tglPo: child.tglPo,
              tglFstb: child.tglFstb,
              noPo: child.noPo,
            });

            if (sampleItems.length >= 12) break;
          }

          if (sampleItems.length === 0 && curatedMatch && curatedMatch.sampleItems?.length > 0) {
            sampleItems = curatedMatch.sampleItems;
          }

          dynamicList.push({
            name: entry.name,
            tag: entry.tag,
            fpbCount,
            startCol,
            endCol,
            gradientStyle,
            colorType,
            summaryText,
            statusBadge: {
              lengkap: entry.lengkap,
              proses: entry.proses,
              parsial: entry.parsial,
              backlog: entry.backlog,
            },
            sampleItems: sampleItems.length > 0 ? sampleItems : (curatedMatch?.sampleItems || [
              {
                fpb: Array.from(entry.fpbs)[0] || `${entry.tag}-FPB-26-0001`,
                item: `Suku Cadang & Perlengkapan ${entry.name}`,
                startCol,
                endCol,
                status: colorType === 'HIJAU' ? 'LENGKAP' : 'PROSES',
              },
            ]),
          });
        }

        dynamicList.sort((a, b) => b.fpbCount - a.fpbCount || a.name.localeCompare(b.name));
        return dynamicList;
      }
    }

    return REAL_FLEET_DATA as CuratedVessel[];
  }, [items]);

  // Filter Data Armada
  const filteredFleetList = useMemo(() => {
    return fullFleetList.filter((v) => {
      if (selectedEntity !== 'ALL' && v.tag.toUpperCase() !== selectedEntity.toUpperCase()) {
        return false;
      }
      if (selectedPeriod !== 'ALL') {
        const periodMap: Record<string, [number, number]> = {
          '06': [0, 3],
          '07': [4, 7],
          '08': [8, 11],
          '09': [12, 15],
          '10': [16, 19],
        };
        const range = periodMap[selectedPeriod];
        if (range && (v.endCol < range[0] || v.startCol > range[1])) {
          return false;
        }
      }
      if (searchTerm.trim() !== '') {
        const q = searchTerm.toLowerCase().trim();
        const match =
          v.name.toLowerCase().includes(q) ||
          v.tag.toLowerCase().includes(q) ||
          v.sampleItems.some((s) => s.fpb.toLowerCase().includes(q) || s.item.toLowerCase().includes(q));
        if (!match) return false;
      }
      if (statusFilter === 'LENGKAP' && v.statusBadge.lengkap === 0) return false;
      if (statusFilter === 'PROSES' && v.statusBadge.proses === 0) return false;
      if (statusFilter === 'PARSIAL' && v.statusBadge.parsial === 0) return false;
      if (statusFilter === 'BACKLOG' && v.statusBadge.backlog === 0) return false;
      return true;
    });
  }, [fullFleetList, selectedEntity, selectedPeriod, searchTerm, statusFilter]);

  // Pagination
  const totalFilteredCount = filteredFleetList.length;
  const totalPages = Math.max(1, Math.ceil(totalFilteredCount / PAGE_SIZE));
  const activePage = Math.min(currentPage, totalPages);

  const paginatedVessels = useMemo(() => {
    const start = (activePage - 1) * PAGE_SIZE;
    return filteredFleetList.slice(start, start + PAGE_SIZE);
  }, [filteredFleetList, activePage]);

  // Toggle Accordion Detail
  const toggleRow = (name: string) => {
    setExpandedRows((prev) => ({
      ...prev,
      [name]: !prev[name],
    }));
  };

  const handleToggleAll = () => {
    if (allExpanded) {
      setExpandedRows({});
      setAllExpanded(false);
    } else {
      const next: Record<string, boolean> = {};
      paginatedVessels.forEach((v) => {
        next[v.name] = true;
      });
      setExpandedRows(next);
      setAllExpanded(true);
    }
  };

  // Periode Kolom yang Ditampilkan
  const displayMonths = useMemo(() => {
    if (selectedPeriod === 'ALL') return TIMELINE_MONTHS;
    return TIMELINE_MONTHS.filter((m) => m.key === selectedPeriod);
  }, [selectedPeriod]);

  const totalCols = displayMonths.length * 4; // 20 jika ALL, 4 jika 1 bulan
  const colOffset = selectedPeriod === 'ALL' ? 0 : TIMELINE_MONTHS.find((m) => m.key === selectedPeriod)?.startCol || 0;

  // Indikator Posisi Garis 'Today' (15 Oktober 2026 / W3)
  const todayColInView = TODAY_COL - colOffset;
  const isTodayInView = todayColInView >= 0 && todayColInView < totalCols;
  const todayPercent = isTodayInView ? ((todayColInView + 0.5) / totalCols) * 100 : null;

  return (
    <div className="bg-white dark:bg-card border border-slate-200/90 dark:border-border rounded-2xl p-4 sm:p-5 shadow-xs space-y-4 transition">
      {/* ============================================================== */}
      {/* 1. CONTROL HEADER: FILTER & LEGENDA                             */}
      {/* ============================================================== */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3 border-b border-border/70">
        <div>
          <div className="flex items-center gap-2">
            <div className="size-8 rounded-lg bg-teal-50 dark:bg-teal-950/60 border border-teal-200 dark:border-teal-800 text-teal-600 dark:text-teal-400 flex items-center justify-center shrink-0">
              <Calendar className="size-4" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-foreground tracking-tight flex items-center gap-2">
                <span>JADWAL &amp; SIKLUS PERMINTAAN ARMADA</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-teal-100 dark:bg-teal-900/60 text-teal-700 dark:text-teal-300">
                  Gantt Schedule
                </span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-muted-foreground mt-0.5">
                Visualisasi jadwal rentang waktu pengajuan (FPB) hingga realisasi barang (FSTB) per armada.
              </p>
            </div>
          </div>
        </div>

        {/* Filter Controls Bar */}
        <div className="flex items-center gap-2 flex-wrap text-xs">
          {/* Dropdown Periode */}
          <div className="flex items-center bg-slate-50 dark:bg-muted border border-slate-200 dark:border-border rounded-lg px-2.5 py-1.5 shadow-2xs">
            <span className="text-[11px] text-muted-foreground mr-1.5 font-medium">Periode:</span>
            <select
              value={selectedPeriod}
              onChange={(e) => {
                setSelectedPeriod(e.target.value);
                setCurrentPage(1);
              }}
              className="bg-transparent text-xs font-semibold text-foreground focus:outline-hidden cursor-pointer"
            >
              <option value="ALL">Semua (Jun – Okt 2026)</option>
              <option value="06">Juni 2026</option>
              <option value="07">Juli 2026</option>
              <option value="08">Agustus 2026</option>
              <option value="09">September 2026</option>
              <option value="10">Oktober 2026</option>
            </select>
          </div>

          {/* Dropdown Status */}
          <div className="flex items-center bg-slate-50 dark:bg-muted border border-slate-200 dark:border-border rounded-lg px-2.5 py-1.5 shadow-2xs">
            <span className="text-[11px] text-muted-foreground mr-1.5 font-medium">Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value as any);
                setCurrentPage(1);
              }}
              className="bg-transparent text-xs font-semibold text-foreground focus:outline-hidden cursor-pointer"
            >
              <option value="ALL">Semua Status</option>
              <option value="LENGKAP">🟢 Lengkap / Selesai (FSTB)</option>
              <option value="PROSES">🔵 Proses PO / Gudang</option>
              <option value="PARSIAL">🟠 Parsial (Sebagian Terkirim)</option>
              <option value="BACKLOG">🔴 Backlog / Kritis</option>
            </select>
          </div>

          {/* Search Input */}
          <div className="relative">
            <input
              type="text"
              placeholder="Cari armada, FPB..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              className="h-8 pl-7 pr-2.5 text-xs bg-slate-50 dark:bg-muted border border-slate-200 dark:border-border rounded-lg placeholder:text-muted-foreground/60 text-foreground focus:ring-1 focus:ring-primary focus:outline-hidden w-36 sm:w-48 shadow-2xs"
            />
            <Search className="size-3.5 text-muted-foreground absolute left-2 top-2.5 pointer-events-none" />
          </div>

          {/* Tombol Outline Tutup / Buka Detail */}
          <button
            type="button"
            onClick={handleToggleAll}
            className="h-8 px-3 bg-white hover:bg-slate-50 dark:bg-card dark:hover:bg-muted text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-border rounded-lg text-xs font-semibold transition inline-flex items-center gap-1.5 shadow-2xs cursor-pointer"
          >
            <Layers className="size-3.5 text-slate-500" />
            <span>{allExpanded ? 'Tutup Detail' : 'Buka Detail'}</span>
          </button>
        </div>
      </div>

      {/* Legenda Status & Counter Armada */}
      <div className="flex items-center justify-between pb-1 flex-wrap gap-2 text-[11px]">
        <div className="flex items-center gap-3.5 flex-wrap">
          <span className="font-semibold text-slate-700 dark:text-slate-300">Legenda Status:</span>
          <div className="flex items-center gap-1.5">
            <span className="size-3 rounded-full bg-[#10B981] border border-[#059669] shrink-0" />
            <span className="text-slate-600 dark:text-slate-400 font-medium">Lengkap / Selesai (FSTB)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="size-3 rounded-full bg-[#0EA5E9] border border-[#0284C7] shrink-0" />
            <span className="text-slate-600 dark:text-slate-400 font-medium">Proses PO / Gudang</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="size-3 rounded-full bg-[#F59E0B] border border-[#D97706] shrink-0" />
            <span className="text-slate-600 dark:text-slate-400 font-medium">Parsial (Sebagian Terkirim)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="size-3 rounded-full bg-[#EF4444] border border-[#DC2626] shrink-0" />
            <span className="text-slate-600 dark:text-slate-400 font-medium">Backlog / Kritis</span>
          </div>
        </div>

        <div className="text-[11px] font-mono text-slate-500 dark:text-muted-foreground font-semibold">
          Menampilkan <strong className="text-slate-900 dark:text-foreground">{totalFilteredCount} armada aktif</strong>
        </div>
      </div>

      {/* ============================================================== */}
      {/* 2. GANTT SCHEDULE TABLE WITH STICKY HEADER & TODAY LINE        */}
      {/* ============================================================== */}
      <div className="relative border border-slate-200/90 dark:border-slate-800 rounded-xl overflow-hidden bg-white dark:bg-slate-900 shadow-sm">
        <div className="overflow-x-auto min-w-full">
          <div className="min-w-[1100px]">
            {/* ---------------------------------------------------------- */}
            {/* STICKY HEADER: Bulan & Minggu dengan Indikator TODAY       */}
            {/* ---------------------------------------------------------- */}
            <div className="sticky top-0 z-30 bg-slate-900 dark:bg-slate-950 text-slate-100 border-b border-slate-700/80 shadow-xs backdrop-blur-md">
              {/* Baris 1: Bulan (JUN, JUL, AGU, SEP, OKT) */}
              <div className="flex items-stretch h-10 border-b border-slate-700/70">
                <div className="w-80 sm:w-96 shrink-0 px-3.5 flex items-center justify-between border-r border-slate-700 bg-slate-900 dark:bg-slate-950 text-slate-200 font-bold uppercase tracking-wider text-[11px] sticky left-0 z-30">
                  <span className="flex items-center gap-2">
                    <Ship className="size-3.5 text-teal-400" />
                    <span>ARMADA &amp; RINCIAN TIKET FPB</span>
                  </span>
                  <span className="text-[10px] font-mono text-slate-400 font-normal">STATUS / TIKET</span>
                </div>

                <div
                  className="flex-1 grid text-center text-[11px] font-extrabold tracking-wider uppercase"
                  style={{ gridTemplateColumns: `repeat(${displayMonths.length}, minmax(0, 1fr))` }}
                >
                  {displayMonths.map((m) => (
                    <div
                      key={m.key}
                      className="py-2 border-r border-slate-700/70 last:border-r-0 flex items-center justify-center gap-1.5"
                    >
                      <span className="text-slate-100">{m.label}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Baris 2: Sub-Header Minggu (W1, W2, W3, W4) + 'TODAY' Pin */}
              <div className="relative flex items-stretch h-8 bg-slate-800/90 dark:bg-slate-900/90 text-[10.5px] font-mono text-slate-300">
                <div className="w-80 sm:w-96 shrink-0 px-3.5 flex items-center justify-between border-r border-slate-700 bg-slate-800 dark:bg-slate-900 sticky left-0 z-30">
                  <span className="text-[10px] font-sans text-slate-400">Katalog Armada (Klik baris untuk buka FPB)</span>
                  <span className="text-[10px] text-slate-400 font-mono">Tag Entitas</span>
                </div>

                <div
                  className="flex-1 grid text-center font-bold relative"
                  style={{ gridTemplateColumns: `repeat(${totalCols}, minmax(0, 1fr))` }}
                >
                  {displayMonths.map((m) =>
                    WEEKS_PER_MONTH.map((w, wIdx) => {
                      const absoluteCol = m.startCol + wIdx;
                      const inViewCol = absoluteCol - colOffset;
                      const isTodayCol = inViewCol === todayColInView && isTodayInView;

                      return (
                        <div
                          key={`${m.key}-${w}`}
                          className={`flex items-center justify-center border-r border-slate-700/50 last:border-r-0 transition ${
                            isTodayCol
                              ? 'bg-rose-500/20 text-rose-300 font-black'
                              : wIdx === 0
                              ? 'bg-slate-700/40 text-slate-200'
                              : 'text-slate-400'
                          }`}
                        >
                          {w}
                        </div>
                      );
                    })
                  )}

                  {/* Marker Pin Badge 'TODAY' di Header */}
                  {isTodayInView && todayPercent !== null && (
                    <div
                      className="absolute top-0 -translate-x-1/2 z-40 flex flex-col items-center pointer-events-none"
                      style={{ left: `${todayPercent}%` }}
                    >
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-mono font-black bg-rose-600 text-white shadow-md border border-rose-400 animate-pulse">
                        <span className="size-1.5 rounded-full bg-white" />
                        HARI INI • 15 OKT
                      </span>
                      <div className="w-0 h-0 border-x-4 border-x-transparent border-t-4 border-t-rose-600 -mt-0.5" />
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* ---------------------------------------------------------- */}
            {/* TABLE ROWS: ARMADA INDUK & GRANULAR SUB-ITEM FPB           */}
            {/* ---------------------------------------------------------- */}
            <div className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
              {paginatedVessels.map((vessel, vIdx) => {
                const isExpanded = Boolean(expandedRows[vessel.name]);
                const rankNum = (activePage - 1) * PAGE_SIZE + vIdx + 1;

                // Hitung posisi horizontal parent vessel bar
                let vStart = vessel.startCol - colOffset;
                let vEnd = vessel.endCol - colOffset;

                vStart = Math.max(0, Math.min(totalCols - 1, vStart));
                vEnd = Math.max(vStart, Math.min(totalCols - 1, vEnd));

                const leftPercent = (vStart / totalCols) * 100;
                const widthPercent = Math.max(4, ((vEnd - vStart + 1) / totalCols) * 100);

                return (
                  <React.Fragment key={vessel.name}>
                    {/* BARIS UTAMA ARMADA INDUK */}
                    <div className="flex items-stretch min-h-[54px] bg-slate-50/50 dark:bg-slate-900/60 hover:bg-slate-100/70 dark:hover:bg-slate-800/60 transition group border-b border-slate-200/80 dark:border-slate-800">
                      {/* Kolom Kiri: Nama Armada & Badges */}
                      <div className="w-80 sm:w-96 shrink-0 px-3.5 py-2 border-r border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2 sticky left-0 bg-slate-50 dark:bg-slate-900 group-hover:bg-slate-100/90 dark:group-hover:bg-slate-800/90 z-20 shadow-[2px_0_6px_-2px_rgba(0,0,0,0.06)] transition">
                        <button
                          type="button"
                          onClick={() => toggleRow(vessel.name)}
                          className="flex items-center gap-1.5 text-left font-bold text-slate-900 dark:text-slate-100 hover:text-primary transition truncate flex-1 cursor-pointer"
                          title={`Klik untuk melihat ${vessel.sampleItems.length} rincian tiket FPB`}
                        >
                          <span className="size-4.5 rounded flex items-center justify-center text-slate-400 group-hover:text-primary group-hover:bg-slate-200/60 dark:group-hover:bg-slate-800 shrink-0 transition">
                            {isExpanded ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
                          </span>
                          <span className="text-[11px] font-mono text-slate-400 shrink-0">#{rankNum}</span>
                          <span className="truncate text-xs">{vessel.name}</span>
                        </button>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-200/80 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300">
                            {vessel.tag}
                          </span>
                          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-sky-50 dark:bg-sky-950/70 text-sky-600 dark:text-sky-400 border border-sky-200 dark:border-sky-800 shrink-0">
                            {vessel.fpbCount} FPB
                          </span>
                        </div>
                      </div>

                      {/* Kolom Kanan: Timeline Grid dengan Background & Today Line */}
                      <div className="flex-1 relative flex items-center h-full min-h-[54px] px-1">
                        {/* Grid Kolom Vertikal */}
                        <div
                          className="absolute inset-0 grid pointer-events-none"
                          style={{ gridTemplateColumns: `repeat(${totalCols}, minmax(0, 1fr))` }}
                        >
                          {Array.from({ length: totalCols }).map((_, cIdx) => (
                            <div
                              key={cIdx}
                              className={`h-full border-r ${
                                cIdx === todayColInView && isTodayInView ? 'bg-rose-500/5 dark:bg-rose-500/10' : ''
                              } ${
                                cIdx % 4 === 3
                                  ? 'border-slate-200 dark:border-slate-800'
                                  : 'border-slate-100 dark:border-slate-800/40'
                              }`}
                            />
                          ))}
                        </div>

                        {/* Garis Vertikal 'TODAY' Marker */}
                        {isTodayInView && todayPercent !== null && (
                          <div
                            className="absolute top-0 bottom-0 -translate-x-1/2 z-15 pointer-events-none flex flex-col items-center"
                            style={{ left: `${todayPercent}%` }}
                          >
                            <div className="w-0.5 h-full bg-gradient-to-b from-rose-500 via-rose-500 to-rose-400 opacity-80 shadow-[0_0_6px_rgba(244,63,94,0.4)]" />
                          </div>
                        )}

                        {/* Parent Vessel Gantt Bar */}
                        <div
                          className={`absolute h-8.5 rounded-lg shadow-xs flex items-center px-3 transition-all cursor-pointer hover:shadow-md hover:scale-[1.004] text-white select-none overflow-hidden border border-white/20 ${vessel.gradientStyle}`}
                          style={{
                            left: `calc(${leftPercent}% + 2px)`,
                            width: `calc(${widthPercent}% - 4px)`,
                          }}
                          onClick={() => toggleRow(vessel.name)}
                          onMouseEnter={() => setHoveredVessel(vessel)}
                          onMouseLeave={() => setHoveredVessel(null)}
                          title={`${vessel.name}: ${vessel.summaryText}. Klik untuk melihat ${vessel.sampleItems.length} tiket FPB.`}
                        >
                          <div className="flex items-center justify-between w-full text-[11px] font-bold truncate leading-none">
                            <span className="truncate flex items-center gap-1.5 min-w-0">
                              <Ship className="size-3.5 shrink-0 opacity-90" />
                              <span className="truncate">{vessel.name}</span>
                            </span>
                            <span className="text-[10px] font-mono bg-black/25 px-2 py-0.5 rounded ml-1.5 shrink-0 border border-white/20">
                              {vessel.fpbCount} FPB • {vessel.statusBadge.lengkap} Selesai
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* BARIS ANAK SUB-TIKET FPB (GRANULAR REPRESENTATION) */}
                    {isExpanded &&
                      vessel.sampleItems.map((sub, sIdx) => {
                        let subStart = sub.startCol - colOffset;
                        let subEnd = sub.endCol - colOffset;

                        subStart = Math.max(0, Math.min(totalCols - 1, subStart));
                        subEnd = Math.max(subStart, Math.min(totalCols - 1, subEnd));

                        const subLeftPct = (subStart / totalCols) * 100;
                        const subWidthPct = Math.max(4.5, ((subEnd - subStart + 1) / totalCols) * 100);

                        // Warna bar sub-tiket sesuai LEGENDA STATUS
                        let barBg = 'bg-[#10B981] hover:bg-[#059669] border-[#059669] text-white';
                        let statusIcon = <CheckCircle2 className="size-3 shrink-0 opacity-95" />;
                        let statusLabel = 'LENGKAP';

                        if (sub.status === 'PROSES') {
                          barBg = 'bg-[#0EA5E9] hover:bg-[#0284C7] border-[#0284C7] text-white';
                          statusIcon = <Clock className="size-3 shrink-0 opacity-95" />;
                          statusLabel = 'PROSES';
                        } else if (sub.status === 'PARSIAL') {
                          barBg = 'bg-[#F59E0B] hover:bg-[#D97706] border-[#D97706] text-white';
                          statusIcon = <Layers className="size-3 shrink-0 opacity-95" />;
                          statusLabel = 'PARSIAL';
                        } else if (sub.status === 'BACKLOG') {
                          barBg = 'bg-[#EF4444] hover:bg-[#DC2626] border-[#DC2626] text-white';
                          statusIcon = <AlertTriangle className="size-3 shrink-0 opacity-95" />;
                          statusLabel = 'BACKLOG';
                        }

                        return (
                          <div
                            key={`${sub.fpb}-${sIdx}`}
                            className="flex items-stretch min-h-[48px] bg-white dark:bg-slate-900/40 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition border-b border-slate-100 dark:border-slate-800/60 group/sub"
                          >
                            {/* Kolom Kiri: Rincian FPB & Barang (Bebas Text-Clipping) */}
                            <div className="w-80 sm:w-96 shrink-0 pl-7 pr-3 py-1.5 border-r border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2 sticky left-0 bg-white dark:bg-slate-900 group-hover/sub:bg-slate-50 dark:group-hover/sub:bg-slate-800/90 z-20 shadow-[2px_0_6px_-2px_rgba(0,0,0,0.06)] transition">
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span
                                    onClick={() => onOpenAudit && onOpenAudit(sub.fpb)}
                                    className="font-mono font-bold text-[11px] text-slate-800 dark:text-slate-100 hover:text-sky-600 dark:hover:text-sky-400 transition cursor-pointer"
                                    title="Klik untuk membuka riwayat audit berkas"
                                  >
                                    {sub.fpb}
                                  </span>
                                  <span
                                    className={`px-1.5 py-0.5 rounded text-[9px] font-mono font-bold border leading-none ${
                                      sub.status === 'LENGKAP'
                                        ? 'bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/70 dark:text-emerald-300 dark:border-emerald-700/60'
                                        : sub.status === 'PROSES'
                                        ? 'bg-sky-50 text-sky-700 border-sky-300 dark:bg-sky-950/70 dark:text-sky-300 dark:border-sky-700/60'
                                        : sub.status === 'PARSIAL'
                                        ? 'bg-amber-50 text-amber-700 border-amber-300 dark:bg-amber-950/70 dark:text-amber-300 dark:border-amber-700/60'
                                        : 'bg-rose-50 text-rose-700 border-rose-300 dark:bg-rose-950/70 dark:text-rose-300 dark:border-rose-700/60'
                                    }`}
                                  >
                                    {sub.status}
                                  </span>
                                </div>
                                <div className="flex items-center gap-1 text-[10.5px] text-slate-500 dark:text-slate-400 mt-0.5 truncate leading-tight">
                                  <span className="truncate max-w-[200px] sm:max-w-[240px]" title={sub.item}>
                                    {sub.item}
                                  </span>
                                  {sub.qtyFpb !== undefined && sub.qtyFpb > 0 && (
                                    <span className="font-mono text-[9px] text-slate-400 shrink-0">
                                      ({sub.qtyFstb || 0}/{sub.qtyFpb} {sub.satuan || 'UNIT'})
                                    </span>
                                  )}
                                </div>
                              </div>

                              {onOpenAudit && (
                                <button
                                  type="button"
                                  onClick={() => onOpenAudit(sub.fpb)}
                                  className="p-1 rounded text-slate-400 hover:text-primary hover:bg-slate-200/60 dark:hover:bg-slate-800 transition shrink-0 cursor-pointer"
                                  title="Buka Audit Trail Berkas"
                                >
                                  <ExternalLink className="size-3.5" />
                                </button>
                              )}
                            </div>

                            {/* Kolom Kanan: Timeline Sub-Bar Sejajar Sempurna */}
                            <div className="flex-1 relative flex items-center h-full min-h-[48px] px-1">
                              {/* Grid Kolom Vertikal */}
                              <div
                                className="absolute inset-0 grid pointer-events-none"
                                style={{ gridTemplateColumns: `repeat(${totalCols}, minmax(0, 1fr))` }}
                              >
                                {Array.from({ length: totalCols }).map((_, cIdx) => (
                                  <div
                                    key={cIdx}
                                    className={`h-full border-r ${
                                      cIdx === todayColInView && isTodayInView ? 'bg-rose-500/5 dark:bg-rose-500/10' : ''
                                    } ${
                                      cIdx % 4 === 3
                                        ? 'border-slate-200 dark:border-slate-800'
                                        : 'border-slate-100 dark:border-slate-800/40'
                                    }`}
                                  />
                                ))}
                              </div>

                              {/* Garis Vertikal 'TODAY' Marker */}
                              {isTodayInView && todayPercent !== null && (
                                <div
                                  className="absolute top-0 bottom-0 -translate-x-1/2 z-15 pointer-events-none flex flex-col items-center"
                                  style={{ left: `${todayPercent}%` }}
                                >
                                  <div className="w-0.5 h-full bg-gradient-to-b from-rose-500 via-rose-500 to-rose-400 opacity-80 shadow-[0_0_6px_rgba(244,63,94,0.4)]" />
                                </div>
                              )}

                              {/* Sub-Bar Gantt Progress Bar (Tinggi h-7 stabil, tidak terpotong) */}
                              <div
                                className={`absolute h-7 rounded-md shadow-xs flex items-center px-2.5 transition-all cursor-pointer hover:shadow-md hover:scale-[1.004] z-10 select-none border ${barBg}`}
                                style={{
                                  left: `calc(${subLeftPct}% + 2px)`,
                                  width: `calc(${subWidthPct}% - 4px)`,
                                }}
                                onClick={() => onOpenAudit && onOpenAudit(sub.fpb)}
                                onMouseEnter={() => setHoveredSubItem({ vesselName: vessel.name, sub })}
                                onMouseLeave={() => setHoveredSubItem(null)}
                                title={`${sub.fpb}: ${sub.item} (${sub.status})`}
                              >
                                <div className="flex items-center justify-between w-full text-[10px] font-semibold truncate leading-none">
                                  <span className="truncate flex items-center gap-1.5 min-w-0">
                                    {statusIcon}
                                    <span className="font-mono font-bold tracking-tight shrink-0">{sub.fpb}</span>
                                    <span className="truncate opacity-90 hidden sm:inline">• {sub.item}</span>
                                  </span>
                                  <span className="text-[9px] font-mono font-bold bg-black/25 px-1.5 py-0.5 rounded ml-1 shrink-0 border border-white/20">
                                    {statusLabel}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                  </React.Fragment>
                );
              })}
            </div>
          </div>
        </div>

        {/* -------------------------------------------------------------- */}
        {/* POPUP TOOLTIP FLOATING: DETAIL ARMADA INDUK                    */}
        {/* -------------------------------------------------------------- */}
        {hoveredVessel && (
          <div className="fixed bottom-6 right-6 max-w-sm bg-slate-900/95 text-white p-4 rounded-xl shadow-2xl border border-slate-700 text-xs space-y-2.5 z-50 pointer-events-none backdrop-blur-md animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between gap-2 border-b border-slate-700 pb-2">
              <div className="flex items-center gap-1.5 font-bold text-teal-400">
                <Ship className="size-4" />
                <span className="text-sm">{hoveredVessel.name}</span>
              </div>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-800 border border-slate-600 text-slate-200">
                {hoveredVessel.tag}
              </span>
            </div>

            <div className="flex items-center justify-between text-[11px] font-mono">
              <span className="text-slate-400">Rentang Siklus:</span>
              <span className="font-bold text-teal-300">{hoveredVessel.summaryText}</span>
            </div>

            <div className="flex items-center justify-between text-[11px] font-mono">
              <span className="text-slate-400">Total Pengajuan:</span>
              <span className="font-bold text-white">{hoveredVessel.fpbCount} FPB</span>
            </div>

            {/* Komposisi Status */}
            <div className="grid grid-cols-4 gap-1.5 pt-1 text-[10px] font-mono text-center">
              <div className="bg-emerald-500/20 border border-emerald-500/40 rounded p-1.5">
                <div className="text-emerald-400 font-bold">{hoveredVessel.statusBadge.lengkap}</div>
                <div className="text-emerald-200/80 text-[9px]">Selesai</div>
              </div>
              <div className="bg-sky-500/20 border border-sky-500/40 rounded p-1.5">
                <div className="text-sky-400 font-bold">{hoveredVessel.statusBadge.proses}</div>
                <div className="text-sky-200/80 text-[9px]">Proses</div>
              </div>
              <div className="bg-amber-500/20 border border-amber-500/40 rounded p-1.5">
                <div className="text-amber-400 font-bold">{hoveredVessel.statusBadge.parsial}</div>
                <div className="text-amber-200/80 text-[9px]">Parsial</div>
              </div>
              <div className="bg-rose-500/20 border border-rose-500/40 rounded p-1.5">
                <div className="text-rose-400 font-bold">{hoveredVessel.statusBadge.backlog}</div>
                <div className="text-rose-200/80 text-[9px]">Backlog</div>
              </div>
            </div>
          </div>
        )}

        {/* -------------------------------------------------------------- */}
        {/* POPUP TOOLTIP FLOATING: DETAIL SUB-ITEM FPB                    */}
        {/* -------------------------------------------------------------- */}
        {hoveredSubItem && (
          <div className="fixed bottom-6 right-6 max-w-sm bg-slate-900/95 text-white p-4 rounded-xl shadow-2xl border border-slate-700 text-xs space-y-2.5 z-50 pointer-events-none backdrop-blur-md animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between gap-2 border-b border-slate-700 pb-2">
              <div className="flex items-center gap-1.5 font-mono font-bold text-sky-400">
                <span>{hoveredSubItem.sub.fpb}</span>
              </div>
              <span
                className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold border ${
                  hoveredSubItem.sub.status === 'LENGKAP'
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                    : hoveredSubItem.sub.status === 'PROSES'
                    ? 'bg-sky-500/20 text-sky-300 border-sky-500/40'
                    : hoveredSubItem.sub.status === 'PARSIAL'
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                    : 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                }`}
              >
                {hoveredSubItem.sub.status}
              </span>
            </div>

            <div>
              <div className="text-[10.5px] text-slate-400">Armada / Departemen:</div>
              <div className="font-semibold text-teal-300 text-xs mt-0.5">{hoveredSubItem.vesselName}</div>
            </div>

            <div>
              <div className="text-[10.5px] text-slate-400">Nama Barang:</div>
              <div className="font-semibold text-slate-100 text-xs mt-0.5 leading-snug">
                {hoveredSubItem.sub.item}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-1 font-mono text-[11px]">
              <div className="bg-slate-800/80 p-2 rounded border border-slate-700/60">
                <span className="text-slate-400 block text-[9.5px]">Qty FPB</span>
                <span className="font-bold text-white text-xs">
                  {hoveredSubItem.sub.qtyFpb || 1} {hoveredSubItem.sub.satuan || 'UNIT'}
                </span>
              </div>
              <div className="bg-slate-800/80 p-2 rounded border border-slate-700/60">
                <span className="text-slate-400 block text-[9.5px]">Realisasi (FSTB)</span>
                <span className="font-bold text-emerald-400 text-xs">
                  {hoveredSubItem.sub.qtyFstb ?? 0} {hoveredSubItem.sub.satuan || 'UNIT'}
                </span>
              </div>
            </div>

            <div className="text-[10px] text-slate-400 pt-1 flex items-center justify-between border-t border-slate-800">
              <span>Status: {hoveredSubItem.sub.status}</span>
              <span className="text-sky-400 font-semibold flex items-center gap-1">
                <ExternalLink className="size-3" /> Klik untuk Audit Trail
              </span>
            </div>
          </div>
        )}
      </div>

      {/* ============================================================== */}
      {/* 3. FOOTER: INFORMASI HALAMAN & PAGINASI                        */}
      {/* ============================================================== */}
      <div className="flex items-center justify-between pt-1 text-xs text-muted-foreground flex-wrap gap-2">
        <p className="font-mono">
          Halaman <strong className="text-slate-900 dark:text-foreground">{activePage}</strong> dari{' '}
          <strong className="text-slate-900 dark:text-foreground">{totalPages}</strong>
        </p>

        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={activePage <= 1}
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            className="px-3 py-1.5 bg-white hover:bg-slate-50 dark:bg-card dark:hover:bg-muted border border-slate-300 dark:border-border text-slate-700 dark:text-slate-200 disabled:opacity-40 disabled:pointer-events-none rounded-lg text-xs font-semibold transition inline-flex items-center gap-1 shadow-2xs cursor-pointer"
          >
            &larr; Sebelumnya
          </button>
          <button
            type="button"
            disabled={activePage >= totalPages}
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            className="px-3 py-1.5 bg-white hover:bg-slate-50 dark:bg-card dark:hover:bg-muted border border-slate-300 dark:border-border text-slate-700 dark:text-slate-200 disabled:opacity-40 disabled:pointer-events-none rounded-lg text-xs font-semibold transition inline-flex items-center gap-1 shadow-2xs cursor-pointer"
          >
            Selanjutnya &rarr;
          </button>
        </div>
      </div>
    </div>
  );
}
