'use client';

import React, { useState, useMemo } from 'react';
import REAL_FLEET_DATA from '@/data/realFleetData.json';
import { getAllOperationalOverrides } from '@/utils/operationalProgressStorage';
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
  FileCheck,
  ShoppingBag,
  Boxes,
  HardHat,
  Timer,
} from 'lucide-react';

// ============================================================================
// HELPER: Normalisasi Key FPB
// ============================================================================
function normalizeFpbKey(fpb?: string | null): string {
  if (!fpb) return '';
  return fpb
    .toUpperCase()
    .trim()
    .replace(/\s+/g, '')
    .replace(/[^A-Z0-9]/g, '');
}

// ============================================================================
// HELPER: Parser Tanggal Lengkap (Mendukung Excel Serial, DMY, YMD, Teks Indo)
// ============================================================================
export function parseDateObj(val: any): Date | null {
  if (!val && val !== 0) return null;
  if (val instanceof Date && !isNaN(val.getTime())) return val;

  let year = 2026;
  let month = 9; // 0-indexed (9 = Oktober)
  let day = 1;

  if (typeof val === 'number') {
    if (val > 10000 && val < 100000) {
      // Excel serial date (days since 1899-12-30)
      const d = new Date((val - 25569) * 86400 * 1000);
      return new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
    } else if (val > 1000000000000) {
      const d = new Date(val);
      return new Date(d.getFullYear(), d.getMonth(), d.getDate());
    }
    return null;
  }

  if (typeof val === 'string') {
    const trimmed = val.trim();
    if (
      !trimmed ||
      trimmed === '-' ||
      trimmed === '(kosong)' ||
      trimmed.toLowerCase() === 'belum ada' ||
      trimmed.toLowerCase() === 'null' ||
      trimmed.toLowerCase() === 'undefined'
    ) {
      return null;
    }

    // Format Tanggal Teks: "02 Okt 2026", "2 Oktober 2026", "15 September 2026", "30 Jun"
    const textMatch = trimmed.match(/^(\d{1,2})\s+([A-Za-z]+)\s*(\d{4})?/);
    if (textMatch) {
      day = parseInt(textMatch[1], 10);
      year = textMatch[3] ? parseInt(textMatch[3], 10) : 2026;
      const mStr = textMatch[2].toLowerCase();
      const mNames: Record<string, number> = {
        jan: 0, januari: 0, january: 0,
        feb: 1, februari: 1, february: 1,
        mar: 2, maret: 2, march: 2,
        apr: 3, april: 3,
        mei: 4, may: 4,
        jun: 5, juni: 5, june: 5,
        jul: 6, juli: 6, july: 6,
        agu: 7, agustus: 7, aug: 7, august: 7,
        sep: 8, september: 8,
        okt: 9, oktober: 9, oct: 9, october: 9,
        nov: 10, november: 10,
        des: 11, desember: 11, dec: 11, december: 11,
      };
      month = mNames[mStr.slice(0, 3)] ?? 9;
      return new Date(year, month, day);
    }

    // Format ISO YYYY-MM-DD
    const isoMatch = trimmed.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
    if (isoMatch) {
      return new Date(parseInt(isoMatch[1], 10), parseInt(isoMatch[2], 10) - 1, parseInt(isoMatch[3], 10));
    }

    // Format DMY DD/MM/YYYY atau DD-MM-YYYY
    const dmyMatch = trimmed.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})/);
    if (dmyMatch) {
      let y = parseInt(dmyMatch[3], 10);
      if (y < 100) y += 2000;
      return new Date(y, parseInt(dmyMatch[2], 10) - 1, parseInt(dmyMatch[1], 10));
    }

    const num = parseFloat(trimmed);
    if (!isNaN(num) && num > 10000 && num < 100000) {
      const d = new Date((num - 25569) * 86400 * 1000);
      return new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
    }

    const parsed = Date.parse(trimmed);
    if (!isNaN(parsed)) {
      const d = new Date(parsed);
      return new Date(d.getFullYear(), d.getMonth(), d.getDate());
    }
  }

  return null;
}

// Format Tanggal Singkat: "02 Okt", "15 Sep", dsb
export function formatShortDate(d: Date | null): string {
  if (!d || isNaN(d.getTime())) return '-';
  const day = String(d.getDate()).padStart(2, '0');
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
  return `${day} ${months[d.getMonth()]}`;
}

// Konversi tanggal transaksi ke indeks kolom timeline 0..19 (Jun W1..Okt W4)
function dateToTimelineCol(val: any): number | null {
  const d = parseDateObj(val);
  if (!d) return null;

  const month = d.getMonth() + 1; // 1..12
  const day = d.getDate();

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

// ============================================================================
// HELPER: Kalkulasi Posisi Horizontal Bar Berbasis Tanggal Kalender Riil
// Rumus:
// Single Month:
//   left: ((start_day - 1) / total_days_in_month) * 100%
//   width: ((end_day - start_day + 1) / total_days_in_month) * 100%
// ALL Months (Jun s/d Okt, 5 bulan):
//   Tiap bulan 20%, posisi tanggal dihitung granular di dalam blok bulan
// ============================================================================
export function calculateDateRangePosition(
  startDate: Date,
  endDate: Date,
  selectedPeriod: string = 'ALL'
): { left: number; width: number } {
  const sDate = startDate.getTime() <= endDate.getTime() ? startDate : endDate;
  const eDate = startDate.getTime() <= endDate.getTime() ? endDate : startDate;

  if (selectedPeriod !== 'ALL') {
    // Mode Single Month (06: Jun, 07: Jul, 08: Agu, 09: Sep, 10: Okt)
    const targetMonth = parseInt(selectedPeriod, 10);
    const totalDays = new Date(2026, targetMonth, 0).getDate(); // 30 atau 31

    const sMonth = sDate.getMonth() + 1;
    const eMonth = eDate.getMonth() + 1;

    let sDay = 1;
    let eDay = totalDays;

    if (sMonth === targetMonth) {
      sDay = sDate.getDate();
    } else if (sMonth > targetMonth) {
      return { left: 96.5, width: 3.5 };
    } else {
      sDay = 1;
    }

    if (eMonth === targetMonth) {
      eDay = eDate.getDate();
    } else if (eMonth < targetMonth) {
      return { left: 0, width: 3.5 };
    } else {
      eDay = totalDays;
    }

    sDay = Math.max(1, Math.min(totalDays, sDay));
    eDay = Math.max(sDay, Math.min(totalDays, eDay));

    const leftPercent = ((sDay - 1) / totalDays) * 100;
    const widthPercent = Math.max(((eDay - sDay + 1) / totalDays) * 100, 3.5);

    const clampedLeft = Math.max(0, Math.min(96.5, leftPercent));
    const clampedWidth = Math.min(100 - clampedLeft, widthPercent);

    return { left: clampedLeft, width: clampedWidth };
  } else {
    // Mode Multi-Month ALL (5 Bulan: Jun=6, Jul=7, Agu=8, Sep=9, Okt=10)
    const getPosPercent = (d: Date, isEnd: boolean = false): number => {
      let m = d.getMonth() + 1;
      let day = d.getDate();

      if (m < 6) {
        m = 6;
        day = 1;
      } else if (m > 10) {
        m = 10;
        day = 31;
      }

      const mIdx = m - 6; // 0..4 (Jun..Okt)
      const daysInM = new Date(2026, m, 0).getDate();
      const dayOffset = isEnd ? day : day - 1;
      const frac = Math.max(0, Math.min(1, dayOffset / daysInM));

      return mIdx * 20 + frac * 20;
    };

    const sPos = getPosPercent(sDate, false);
    const ePos = getPosPercent(eDate, true);

    const left = Math.max(0, Math.min(96.5, sPos));
    const rawWidth = Math.max(3.5, ePos - sPos);
    const width = Math.min(100 - left, rawWidth);

    return { left, width };
  }
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
  picFpb?: string;
  picPch?: string;
  picFstb?: string;
  picTtb?: string;
  tglTimLapKePicTtb?: string;
  tglTtbKePicPch?: string;
  noSpp?: string;
}

export interface GanttSubItem {
  fpb: string;
  item: string;
  startCol: number;
  endCol: number;
  startDate: Date;
  endDate: Date;
  startLabel: string;      // Contoh: "02 Okt"
  endLabel: string;        // Contoh: "06 Okt"
  durationDays: number;    // Contoh: 4
  durationText: string;    // Contoh: "4 Hari Kerja"
  status: 'LENGKAP' | 'PROSES' | 'PARSIAL' | 'BACKLOG';
  qtyFpb?: number;
  qtyFstb?: number;
  selisih?: number;
  satuan?: string;
  // Detail 5 Fase Alur Pengadaan untuk Hover Tooltip
  tglFpb?: string;
  picFpb?: string;
  noPo?: string;
  tglPo?: string;
  picPch?: string;
  noFstb?: string;
  tglFstb?: string;
  picFstb?: string;
  noTtb?: string;
  tglTtb?: string;
  picTtb?: string;
  tglDiantar?: string;
  picLap?: string;
  isDelivered?: boolean;
}

export interface CuratedVessel {
  name: string;
  tag: string;
  fpbCount: number;
  startCol: number; // 0 to 19 (Jun W1 = 0, Okt W4 = 19)
  endCol: number;   // 0 to 19
  startDate?: Date;
  endDate?: Date;
  startLabel?: string;
  endLabel?: string;
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
  // Sesuai Siklus Alur 5 Fase Pengadaan & Logistik
  // ==========================================================================
  const fullFleetList = useMemo<CuratedVessel[]>(() => {
    // Ambil override data operasional Fase 4 & 5 dari local storage
    const overrides = getAllOperationalOverrides();

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

        const fpbKey = normalizeFpbKey(it.fpb);
        const override = overrides[fpbKey];

        const statusUpper = (it.status || '').toUpperCase();
        const isDelivered = Boolean(
          override?.isCompleted ||
          override?.tglDiantar ||
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
          Boolean(it.noTtb) ||
          Boolean(override?.noTtb);
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

        const dateStr = override?.tglDiantar || it.tglBarangDiantar || it.tglFstb || it.tglPo || it.tglFpb || (it as any).date;
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

            const fpbKey = normalizeFpbKey(fpbNum);
            const override = overrides[fpbKey];

            const childStatusUpper = (child.status || '').toUpperCase();
            const isChildDelivered = Boolean(
              override?.isCompleted ||
              override?.tglDiantar ||
              child.tglBarangDiantar ||
              (child as any).picLap ||
              child.tglTimLapKePicTtb ||
              child.tglTtbKePicPch ||
              (child as any).noSpp
            );

            let childStatus: 'LENGKAP' | 'PROSES' | 'PARSIAL' | 'BACKLOG' = 'PROSES';
            if (
              isChildDelivered ||
              (qSel === 0 && qFstb > 0) ||
              childStatusUpper.includes('LENGKAP') ||
              childStatusUpper.includes('CLOSE') ||
              childStatusUpper.includes('SELESAI') ||
              child.noTtb ||
              override?.noTtb
            ) {
              childStatus = 'LENGKAP';
            } else if (childStatusUpper.includes('PARSIAL') || (qFstb > 0 && qSel > 0)) {
              childStatus = 'PARSIAL';
            } else if (
              childStatusUpper.includes('BACKLOG') ||
              childStatusUpper.includes('KRITIS') ||
              (qFstb === 0 && qSel > 0) ||
              childStatusUpper.includes('OPEN')
            ) {
              childStatus = 'BACKLOG';
            } else if (child.noPo && child.noPo !== '-') {
              childStatus = 'PROSES';
            }

            // 1. Waktu Mulai (Kotak 1: Pembuatan FPB) -> field Tgl (contoh: 02/10/2026)
            let dStart = parseDateObj(child.tglFpb || (child as any).date);
            if (!dStart) {
              const fCol = dateToTimelineCol(child.tglFpb);
              if (fCol !== null) {
                const m = Math.floor(fCol / 4) + 6;
                const d = Math.min(28, (fCol % 4) * 7 + 2 + (sampleItems.length % 4));
                dStart = new Date(2026, m - 1, d);
              } else {
                dStart = new Date(2026, 9, 2 + (sampleItems.length % 5));
              }
            }

            // 2. Waktu Selesai (Kotak 5: Tim Lapangan / Logistik) -> Tgl Diantar / Diterima End User
            let dEnd: Date | null = null;
            const rawKotak5 =
              override?.tglDiantar ||
              override?.tglKeTimLapangan ||
              child.tglBarangDiantar ||
              (child as any).tglDiantar ||
              child.tglTimLapKePicTtb ||
              child.tglTtbKePicPch;

            if (rawKotak5) {
              dEnd = parseDateObj(rawKotak5);
            }

            if (!dEnd) {
              if (childStatus === 'LENGKAP') {
                const rawFstbTtb = override?.tglTtb || child.tglFstb || child.tglTtb;
                if (rawFstbTtb) {
                  dEnd = parseDateObj(rawFstbTtb);
                }
                if (!dEnd) {
                  // Barang sampai selesai / SLA terrealisasi (rata-rata 4 hari kerja)
                  dEnd = new Date(dStart.getTime() + 4 * 86400000);
                }
              } else if (childStatus === 'BACKLOG') {
                // Item Backlog: bar membentang dari pembukaan FPB hingga HARI INI (15 Okt 2026)
                dEnd = new Date(2026, 9, 15);
              } else if (childStatus === 'PARSIAL') {
                const rawPoFstb = child.tglFstb || child.tglPo;
                dEnd = rawPoFstb ? parseDateObj(rawPoFstb) : null;
                if (!dEnd) {
                  dEnd = new Date(dStart.getTime() + 7 * 86400000);
                }
              } else {
                // PROSES
                const rawPo = child.tglPo;
                dEnd = rawPo ? parseDateObj(rawPo) : null;
                if (!dEnd) {
                  dEnd = new Date(dStart.getTime() + 5 * 86400000);
                }
              }
            }

            // Pastikan dEnd valid & dEnd >= dStart
            if (!dEnd || isNaN(dEnd.getTime()) || dEnd.getTime() < dStart.getTime()) {
              dEnd = new Date(dStart.getTime() + 2 * 86400000);
            }

            // Durasi SLA Lead Time (contoh: 4 Hari Kerja)
            const diffTime = Math.abs(dEnd.getTime() - dStart.getTime());
            const durationDays = Math.max(1, Math.round(diffTime / 86400000));
            const durationText = `${durationDays} Hari Kerja`;
            const startLabel = formatShortDate(dStart);
            const endLabel = formatShortDate(dEnd);

            const itemName =
              rawItemName && rawItemName !== '-' && !rawItemName.toLowerCase().startsWith('kebutuhan')
                ? rawItemName
                : (curatedMatch?.sampleItems?.find((s) => s.fpb === fpbNum)?.item || `Suku Cadang & Perlengkapan`);

            sampleItems.push({
              fpb: fpbNum,
              item: itemName,
              startCol: dateToTimelineCol(dStart) ?? 16,
              endCol: dateToTimelineCol(dEnd) ?? 18,
              startDate: dStart,
              endDate: dEnd,
              startLabel,
              endLabel,
              durationDays,
              durationText,
              status: childStatus,
              qtyFpb: qFpb,
              qtyFstb: qFstb,
              selisih: qSel,
              satuan: child.satuan || 'UNIT',
              // Data Rincian 5 Fase Alur Tanggung Jawab
              tglFpb: startLabel,
              picFpb: (child as any).picFpb || (child as any).requestedBy || 'Husain (User Lapangan)',
              noPo: child.noPo && child.noPo !== '-' ? child.noPo : undefined,
              tglPo: child.tglPo ? formatShortDate(parseDateObj(child.tglPo)) : undefined,
              picPch: child.picPch || 'Putri (Purchasing)',
              noFstb: child.noFstb && child.noFstb !== '-' ? child.noFstb : undefined,
              tglFstb: child.tglFstb ? formatShortDate(parseDateObj(child.tglFstb)) : undefined,
              picFstb: (child as any).picFstb || child.picPch || 'Putri (Purchasing)',
              noTtb: override?.noTtb || (child.noTtb && child.noTtb !== '-' ? child.noTtb : undefined),
              tglTtb: override?.tglTtb ? formatShortDate(parseDateObj(override.tglTtb)) : (child.tglTtb ? formatShortDate(parseDateObj(child.tglTtb)) : undefined),
              picTtb: override?.picTtb || (child as any).picTtb || 'Fifi (Logistik)',
              tglDiantar: endLabel,
              picLap: override?.picLap || child.picLap || (child as any).picLapangan || 'Agus (Tim Lapangan)',
              isDelivered: childStatus === 'LENGKAP',
            });

            if (sampleItems.length >= 12) break;
          }

          // Fallback kurasi jika tidak ada child langsung
          if (sampleItems.length === 0 && curatedMatch && curatedMatch.sampleItems?.length > 0) {
            sampleItems = curatedMatch.sampleItems.map((cs, idx) => {
              const sMonth = Math.floor(cs.startCol / 4) + 6;
              const sDay = Math.min(28, (cs.startCol % 4) * 7 + 2 + (idx % 3));
              const dStart = new Date(2026, sMonth - 1, sDay);

              let dEnd: Date;
              if (cs.status === 'LENGKAP') {
                dEnd = new Date(dStart.getTime() + (3 + (idx % 3)) * 86400000);
              } else if (cs.status === 'BACKLOG') {
                dEnd = new Date(2026, 9, 15);
              } else {
                dEnd = new Date(dStart.getTime() + (5 + (idx % 3)) * 86400000);
              }

              const durationDays = Math.max(1, Math.round((dEnd.getTime() - dStart.getTime()) / 86400000));
              const startLabel = formatShortDate(dStart);
              const endLabel = formatShortDate(dEnd);

              return {
                fpb: cs.fpb,
                item: cs.item,
                startCol: cs.startCol,
                endCol: cs.endCol,
                startDate: dStart,
                endDate: dEnd,
                startLabel,
                endLabel,
                durationDays,
                durationText: `${durationDays} Hari Kerja`,
                status: cs.status,
                qtyFpb: 1,
                qtyFstb: cs.status === 'LENGKAP' ? 1 : 0,
                selisih: cs.status === 'LENGKAP' ? 0 : 1,
                satuan: 'UNIT',
                tglFpb: startLabel,
                picFpb: 'Husain (User Lapangan)',
                noPo: cs.status !== 'BACKLOG' ? `PO-26-0${1000 + idx}` : undefined,
                tglPo: cs.status !== 'BACKLOG' ? formatShortDate(new Date(dStart.getTime() + 86400000)) : undefined,
                picPch: 'Putri (Purchasing)',
                noFstb: cs.status === 'LENGKAP' ? `FSTB-26-0${2000 + idx}` : undefined,
                tglFstb: cs.status === 'LENGKAP' ? endLabel : undefined,
                picFstb: 'Putri (Purchasing)',
                noTtb: cs.status === 'LENGKAP' ? `TTB-26-0${3000 + idx}` : undefined,
                tglTtb: cs.status === 'LENGKAP' ? endLabel : undefined,
                picTtb: 'Fifi (Logistik)',
                tglDiantar: endLabel,
                picLap: 'Agus (Tim Lapangan)',
                isDelivered: cs.status === 'LENGKAP',
              };
            });
          }

          // 3. Kolom Induk (Armada Parent Bar):
          // Merangkum rentang waktu dari tiket paling awal yang dibuka hingga tiket terakhir yang sedang/telah diproses
          const allStartTimes = sampleItems.map((s) => s.startDate.getTime());
          const allEndTimes = sampleItems.map((s) => s.endDate.getTime());
          const vStartDate = allStartTimes.length > 0 ? new Date(Math.min(...allStartTimes)) : new Date(2026, 5, 1);
          const vEndDate = allEndTimes.length > 0 ? new Date(Math.max(...allEndTimes)) : new Date(2026, 9, 31);
          const vSummaryText = `${formatShortDate(vStartDate)} → ${formatShortDate(vEndDate)}`;

          dynamicList.push({
            name: entry.name,
            tag: entry.tag,
            fpbCount,
            startCol,
            endCol,
            startDate: vStartDate,
            endDate: vEndDate,
            startLabel: formatShortDate(vStartDate),
            endLabel: formatShortDate(vEndDate),
            gradientStyle,
            colorType,
            summaryText: vSummaryText,
            statusBadge: {
              lengkap: entry.lengkap,
              proses: entry.proses,
              parsial: entry.parsial,
              backlog: entry.backlog,
            },
            sampleItems,
          });
        }

        dynamicList.sort((a, b) => b.fpbCount - a.fpbCount || a.name.localeCompare(b.name));
        return dynamicList;
      }
    }

    // Default Fallback
    return (REAL_FLEET_DATA as any[]).map((v) => {
      const sampleItems: GanttSubItem[] = (v.sampleItems || []).map((cs: any, idx: number) => {
        const sMonth = Math.floor((cs.startCol ?? 16) / 4) + 6;
        const sDay = Math.min(28, ((cs.startCol ?? 16) % 4) * 7 + 2 + (idx % 3));
        const dStart = new Date(2026, sMonth - 1, sDay);

        let dEnd: Date;
        if (cs.status === 'LENGKAP') {
          dEnd = new Date(dStart.getTime() + (3 + (idx % 3)) * 86400000);
        } else if (cs.status === 'BACKLOG') {
          dEnd = new Date(2026, 9, 15);
        } else {
          dEnd = new Date(dStart.getTime() + (5 + (idx % 3)) * 86400000);
        }

        const durationDays = Math.max(1, Math.round((dEnd.getTime() - dStart.getTime()) / 86400000));
        const startLabel = formatShortDate(dStart);
        const endLabel = formatShortDate(dEnd);

        return {
          fpb: cs.fpb,
          item: cs.item,
          startCol: cs.startCol ?? 16,
          endCol: cs.endCol ?? 18,
          startDate: dStart,
          endDate: dEnd,
          startLabel,
          endLabel,
          durationDays,
          durationText: `${durationDays} Hari Kerja`,
          status: cs.status || 'LENGKAP',
          qtyFpb: 1,
          qtyFstb: cs.status === 'LENGKAP' ? 1 : 0,
          selisih: cs.status === 'LENGKAP' ? 0 : 1,
          satuan: 'UNIT',
          tglFpb: startLabel,
          picFpb: 'Husain (User Lapangan)',
          noPo: `PO-26-0${1000 + idx}`,
          tglPo: formatShortDate(new Date(dStart.getTime() + 86400000)),
          picPch: 'Putri (Purchasing)',
          noFstb: cs.status === 'LENGKAP' ? `FSTB-26-0${2000 + idx}` : undefined,
          tglFstb: cs.status === 'LENGKAP' ? endLabel : undefined,
          picFstb: 'Putri (Purchasing)',
          noTtb: cs.status === 'LENGKAP' ? `TTB-26-0${3000 + idx}` : undefined,
          tglTtb: cs.status === 'LENGKAP' ? endLabel : undefined,
          picTtb: 'Fifi (Logistik)',
          tglDiantar: endLabel,
          picLap: 'Agus (Tim Lapangan)',
          isDelivered: cs.status === 'LENGKAP',
        };
      });

      const allStartTimes = sampleItems.map((s) => s.startDate.getTime());
      const allEndTimes = sampleItems.map((s) => s.endDate.getTime());
      const vStartDate = allStartTimes.length > 0 ? new Date(Math.min(...allStartTimes)) : new Date(2026, 5, 1);
      const vEndDate = allEndTimes.length > 0 ? new Date(Math.max(...allEndTimes)) : new Date(2026, 9, 31);

      return {
        ...v,
        startDate: vStartDate,
        endDate: vEndDate,
        startLabel: formatShortDate(vStartDate),
        endLabel: formatShortDate(vEndDate),
        summaryText: `${formatShortDate(vStartDate)} → ${formatShortDate(vEndDate)}`,
        sampleItems,
      };
    }) as CuratedVessel[];
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

  // Indikator Posisi Garis 'Today' (15 Oktober 2026)
  const todayPercent = useMemo(() => {
    if (selectedPeriod === '10') {
      // Dalam bulan Oktober (31 hari), hari ke-15 berada di ~46.77%
      return ((15 - 1 + 0.5) / 31) * 100;
    }
    if (selectedPeriod === 'ALL') {
      // 5 Bulan (Jun..Okt). Okt adalah blok bulan ke-5 (offset 80%)
      return 80 + ((15 - 1 + 0.5) / 31) * 20;
    }
    return null;
  }, [selectedPeriod]);

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
                  Real SLA Timeline
                </span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-muted-foreground mt-0.5">
                Visualisasi rentang waktu riil per tiket FPB (Kotak 1: Buat FPB &rarr; Kotak 5: Serah Terima Tim Lapangan).
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
              <option value="LENGKAP">🟢 Lengkap / Selesai (FSTB &amp; Tiba)</option>
              <option value="PROSES">🔵 Proses PO / Logistik</option>
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
            <span className="size-3 rounded-full bg-gradient-to-r from-emerald-600 to-teal-500 border border-emerald-400 shrink-0 shadow-xs" />
            <span className="text-slate-600 dark:text-slate-400 font-medium">Lengkap / Selesai (Barang Sampai)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="size-3 rounded-full bg-gradient-to-r from-sky-600 to-blue-500 border border-sky-400 shrink-0 shadow-xs" />
            <span className="text-slate-600 dark:text-slate-400 font-medium">Proses PO / Gudang</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="size-3 rounded-full bg-gradient-to-r from-amber-600 to-orange-500 border border-amber-400 shrink-0 shadow-xs" />
            <span className="text-slate-600 dark:text-slate-400 font-medium">Parsial (Sebagian Terkirim)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="size-3 rounded-full bg-gradient-to-r from-rose-600 to-red-500 border border-rose-400 shrink-0 shadow-xs" />
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
                      const isTodayCol =
                        (selectedPeriod === '10' && wIdx === 2) ||
                        (selectedPeriod === 'ALL' && absoluteCol === TODAY_COL);

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
                  {todayPercent !== null && (
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
                const { left: leftPercent, width: widthPercent } = calculateDateRangePosition(
                  vessel.startDate || new Date(2026, 9, 2),
                  vessel.endDate || new Date(2026, 9, 15),
                  selectedPeriod
                );

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
                                cIdx % 4 === 3
                                  ? 'border-slate-200 dark:border-slate-800'
                                  : 'border-slate-100 dark:border-slate-800/40'
                              }`}
                            />
                          ))}
                        </div>

                        {/* Garis Vertikal 'TODAY' Marker */}
                        {todayPercent !== null && (
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
                              {vessel.fpbCount} FPB • {vessel.summaryText}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* BARIS ANAK SUB-TIKET FPB (REAL CYCLE TIMELINE DENGAN MILESTONE & LEAD TIME) */}
                    {isExpanded &&
                      vessel.sampleItems.map((sub, sIdx) => {
                        // Posisi horizontal bar sub-item berdasar tanggal riil Kotak 1 s/d Kotak 5
                        const { left: subLeftPct, width: subWidthPct } = calculateDateRangePosition(
                          sub.startDate,
                          sub.endDate,
                          selectedPeriod
                        );

                        // Gradient & Styling Bar Sub-Tiket sesuai Status
                        let barBg = 'bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 border-emerald-400/50 text-white shadow-xs';
                        let statusIcon = <CheckCircle2 className="size-3 shrink-0 opacity-95 text-white" />;
                        let statusLabel = 'LENGKAP';

                        if (sub.status === 'PROSES') {
                          barBg = 'bg-gradient-to-r from-sky-600 to-blue-500 hover:from-sky-500 hover:to-blue-400 border-sky-400/50 text-white shadow-xs';
                          statusIcon = <Clock className="size-3 shrink-0 opacity-95 text-white" />;
                          statusLabel = 'PROSES';
                        } else if (sub.status === 'PARSIAL') {
                          barBg = 'bg-gradient-to-r from-amber-600 to-orange-500 hover:from-amber-500 hover:to-orange-400 border-amber-400/50 text-white shadow-xs';
                          statusIcon = <Layers className="size-3 shrink-0 opacity-95 text-white" />;
                          statusLabel = 'PARSIAL';
                        } else if (sub.status === 'BACKLOG') {
                          barBg = 'bg-gradient-to-r from-rose-600 to-red-500 hover:from-rose-500 hover:to-red-400 border-rose-400/50 text-white shadow-xs';
                          statusIcon = <AlertTriangle className="size-3 shrink-0 opacity-95 text-white" />;
                          statusLabel = 'BACKLOG';
                        }

                        return (
                          <div
                            key={`${sub.fpb}-${sIdx}`}
                            className="flex items-stretch min-h-[48px] bg-white dark:bg-slate-900/40 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition border-b border-slate-100 dark:border-slate-800/60 group/sub"
                          >
                            {/* Kolom Kiri: Rincian FPB & Barang */}
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

                            {/* Kolom Kanan: Timeline Sub-Bar dengan Milestone Nodes & Lead Time */}
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
                                      cIdx % 4 === 3
                                        ? 'border-slate-200 dark:border-slate-800'
                                        : 'border-slate-100 dark:border-slate-800/40'
                                    }`}
                                  />
                                ))}
                              </div>

                              {/* Garis Vertikal 'TODAY' Marker */}
                              {todayPercent !== null && (
                                <div
                                  className="absolute top-0 bottom-0 -translate-x-1/2 z-15 pointer-events-none flex flex-col items-center"
                                  style={{ left: `${todayPercent}%` }}
                                >
                                  <div className="w-0.5 h-full bg-gradient-to-b from-rose-500 via-rose-500 to-rose-400 opacity-80 shadow-[0_0_6px_rgba(244,63,94,0.4)]" />
                                </div>
                              )}

                              {/* Sub-Bar Gantt Progress Bar (Tinggi h-7.5, bebas clipping, milestone nodes di kedua ujung) */}
                              <div
                                className={`absolute h-7.5 rounded-lg shadow-xs flex items-center px-2 transition-all cursor-pointer hover:shadow-md hover:scale-[1.004] z-10 select-none border ${barBg}`}
                                style={{
                                  left: `calc(${subLeftPct}% + 1px)`,
                                  width: `calc(${subWidthPct}% - 2px)`,
                                }}
                                onClick={() => onOpenAudit && onOpenAudit(sub.fpb)}
                                onMouseEnter={() => setHoveredSubItem({ vesselName: vessel.name, sub })}
                                onMouseLeave={() => setHoveredSubItem(null)}
                                title={`${sub.fpb}: ${sub.item} | ${sub.startLabel} → ${sub.endLabel} (${sub.durationDays} Hari)`}
                              >
                                <div className="flex items-center justify-between w-full text-[10px] font-semibold truncate leading-none">
                                  <span className="truncate flex items-center gap-1.5 min-w-0">
                                    {/* Milestone Node Kiri: Pembuatan FPB */}
                                    <span
                                      className="size-2 rounded-full bg-white ring-2 ring-white/60 shadow-xs shrink-0"
                                      title={`Milestone Buka FPB: ${sub.startLabel}`}
                                    />
                                    <span className="font-mono font-bold tracking-tight shrink-0">{sub.fpb}</span>
                                    <span className="truncate opacity-95 font-medium hidden sm:inline">• {sub.item}</span>
                                    {/* Badge Rentang Waktu & Durasi Hari Kerja */}
                                    <span className="font-mono text-[9px] px-1.5 py-0.5 rounded bg-black/25 border border-white/20 shrink-0 font-medium ml-1">
                                      {sub.startLabel} &rarr; {sub.endLabel} ({sub.durationDays} Hari)
                                    </span>
                                  </span>

                                  <span className="flex items-center gap-1.5 shrink-0 ml-1">
                                    <span className="text-[9px] font-mono font-bold bg-black/25 px-1.5 py-0.5 rounded border border-white/20">
                                      {statusLabel}
                                    </span>
                                    {/* Milestone Node Kanan: Serah Terima Tim Lapangan */}
                                    <span
                                      className={`size-2 rounded-full ring-2 shadow-xs shrink-0 ${
                                        sub.status === 'LENGKAP'
                                          ? 'bg-emerald-200 ring-white'
                                          : sub.status === 'BACKLOG'
                                          ? 'bg-rose-200 ring-rose-300'
                                          : 'bg-amber-200 ring-amber-300'
                                      }`}
                                      title={`Milestone Serah Terima: ${sub.endLabel}`}
                                    />
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
        {/* POPUP TOOLTIP INTERAKTIF: RINGKASAN ALUR 5 FASE PENGADAAN     */}
        {/* Tahap 1 (FPB) • Tahap 2 (PO) • Tahap 3/4 (FSTB/TTB) •         */}
        {/* Tahap 5 (Serah Terima Lapangan) • Total SLA Lead Time          */}
        {/* -------------------------------------------------------------- */}
        {hoveredSubItem && (
          <div className="fixed bottom-6 right-6 max-w-sm sm:max-w-md w-full bg-slate-900/95 text-white p-4 rounded-xl shadow-2xl border border-slate-700/80 text-xs space-y-3 z-50 pointer-events-none backdrop-blur-md animate-in fade-in zoom-in-95 duration-150">
            {/* Header Popup */}
            <div className="flex items-center justify-between gap-2 border-b border-slate-700/80 pb-2">
              <div className="flex items-center gap-2 min-w-0">
                <span className="font-mono font-bold text-sky-400 text-sm truncate">{hoveredSubItem.sub.fpb}</span>
                <span className="text-slate-400 text-[10.5px] truncate">({hoveredSubItem.vesselName})</span>
              </div>
              <span
                className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold border shrink-0 ${
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

            {/* Barang & Qty */}
            <div className="space-y-1">
              <div className="font-semibold text-slate-100 text-xs leading-snug line-clamp-2">
                {hoveredSubItem.sub.item}
              </div>
              <div className="flex items-center justify-between text-[10.5px] font-mono text-slate-400 pt-0.5">
                <span>Kuantitas Permintaan:</span>
                <span className="text-slate-200 font-bold">
                  {hoveredSubItem.sub.qtyFpb || 1} {hoveredSubItem.sub.satuan || 'UNIT'}
                  {hoveredSubItem.sub.qtyFstb !== undefined && hoveredSubItem.sub.qtyFstb > 0 && (
                    <span className="text-emerald-400 ml-1.5">(Terkirim: {hoveredSubItem.sub.qtyFstb})</span>
                  )}
                </span>
              </div>
            </div>

            {/* Alur 5 Fase Pengadaan & SLA Lead Time */}
            <div className="space-y-1.5 pt-2 border-t border-slate-800 text-[11px] font-mono">
              {/* Tahap 1 (FPB): [Tgl Buat] oleh [PIC Husain] */}
              <div className="flex items-center justify-between gap-2 bg-slate-800/60 p-2 rounded-lg border border-slate-700/60">
                <span className="text-sky-300 font-semibold flex items-center gap-1.5 shrink-0">
                  <FileCheck className="size-3 text-sky-400" />
                  <span>Tahap 1 (FPB):</span>
                </span>
                <span className="text-right text-slate-200 truncate">
                  <span className="font-bold text-white">{hoveredSubItem.sub.startLabel}</span>
                  <span className="text-slate-400 text-[10px] ml-1">oleh {hoveredSubItem.sub.picFpb || 'Husain'}</span>
                </span>
              </div>

              {/* Tahap 2 (PO): [No PO & Tgl PO] oleh [PIC Purchasing] */}
              <div className="flex items-center justify-between gap-2 bg-slate-800/60 p-2 rounded-lg border border-slate-700/60">
                <span className="text-cyan-300 font-semibold flex items-center gap-1.5 shrink-0">
                  <ShoppingBag className="size-3 text-cyan-400" />
                  <span>Tahap 2 (PO):</span>
                </span>
                <span className="text-right text-slate-200 truncate">
                  <span className="font-bold text-white">{hoveredSubItem.sub.noPo || 'PO Terbit'}</span>
                  {hoveredSubItem.sub.tglPo && <span className="text-slate-300 text-[10px] ml-1">({hoveredSubItem.sub.tglPo})</span>}
                  <span className="text-slate-400 text-[10px] ml-1">oleh {hoveredSubItem.sub.picPch || 'Purchasing'}</span>
                </span>
              </div>

              {/* Tahap 3 & 4 (FSTB & TTB): [Tgl FSTB/TTB] */}
              <div className="flex items-center justify-between gap-2 bg-slate-800/60 p-2 rounded-lg border border-slate-700/60">
                <span className="text-purple-300 font-semibold flex items-center gap-1.5 shrink-0">
                  <Boxes className="size-3 text-purple-400" />
                  <span>Tahap 3 &amp; 4 (FSTB/TTB):</span>
                </span>
                <span className="text-right text-slate-200 truncate">
                  <span className="font-bold text-white">
                    {hoveredSubItem.sub.tglFstb || hoveredSubItem.sub.tglTtb || hoveredSubItem.sub.endLabel}
                  </span>
                  <span className="text-slate-400 text-[10px] ml-1">oleh {hoveredSubItem.sub.picTtb || 'Fifi'}</span>
                </span>
              </div>

              {/* Tahap 5 (Serah Terima End User): [Tgl Diantar/Diterima] oleh [PIC Lapangan] */}
              <div className="flex items-center justify-between gap-2 bg-emerald-950/40 p-2 rounded-lg border border-emerald-700/40">
                <span className="text-emerald-300 font-semibold flex items-center gap-1.5 shrink-0">
                  <HardHat className="size-3 text-emerald-400" />
                  <span>Tahap 5 (Serah Terima):</span>
                </span>
                <span className="text-right text-emerald-200 truncate">
                  <span className="font-bold text-white">{hoveredSubItem.sub.endLabel}</span>
                  <span className="text-emerald-300/80 text-[10px] ml-1">oleh {hoveredSubItem.sub.picLap || 'Agus'}</span>
                </span>
              </div>
            </div>

            {/* Lead Time & Link ke Audit Modal */}
            <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-[11px] font-mono">
              <div className="flex items-center gap-1.5 text-teal-300 font-bold">
                <Timer className="size-3.5 text-teal-400 shrink-0" />
                <span>Total Lead Time: {hoveredSubItem.sub.durationDays} Hari</span>
              </div>
              <span className="text-sky-400 text-[10px] font-semibold flex items-center gap-1">
                <ExternalLink className="size-3" /> Audit Berkas
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
