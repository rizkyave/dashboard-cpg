'use client';

import React, { useState, useMemo, useEffect } from 'react';
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
  X,
} from 'lucide-react';
import {
  parseDateObj,
  formatShortDate,
  calculateDateRangePosition,
  normalizeArmadaName,
} from './utils';

export interface GanttSubTicket {
  fpb: string;
  item: string;
  startDate: Date;
  endDate: Date;
  startLabel: string;
  endLabel: string;
  durationDays: number;
  durationText: string;
  status: 'LENGKAP' | 'PROSES' | 'PARSIAL' | 'BACKLOG';
  qtyFpb?: number;
  qtyFstb?: number;
  selisih?: number;
  satuan?: string;
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
}

export interface ArmadaGanttVessel {
  name: string;
  tag: string;
  fpbCount: number;
  startDate: Date;
  endDate: Date;
  startLabel: string;
  endLabel: string;
  summaryText: string;
  gradientStyle: string;
  statusBadge: { lengkap: number; proses: number; parsial: number; backlog: number };
  sampleItems: GanttSubTicket[];
}

interface ArmadaGanttScheduleProps {
  items?: any[];
  selectedArmadaId: string | null;
  onSelectArmada?: (name: string | null) => void;
  selectedPeriod: string; // 'ALL' | '06' | '07' | '08' | '09' | '10'
  onOpenAudit?: (fpb: string, po?: string) => void;
}

const TIMELINE_MONTHS = [
  { key: '06', name: 'JUN', label: 'Juni 2026', startCol: 0 },
  { key: '07', name: 'JUL', label: 'Juli 2026', startCol: 4 },
  { key: '08', name: 'AGU', label: 'Agustus 2026', startCol: 8 },
  { key: '09', name: 'SEP', label: 'September 2026', startCol: 12 },
  { key: '10', name: 'OKT', label: 'Oktober 2026', startCol: 16 },
];

const WEEKS_PER_MONTH = ['W1', 'W2', 'W3', 'W4'];
const TODAY_COL = 18; // 15 Okt 2026 (W3)

export default function ArmadaGanttSchedule({
  items = [],
  selectedArmadaId,
  onSelectArmada,
  selectedPeriod = '10',
  onOpenAudit,
}: ArmadaGanttScheduleProps) {
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});
  const [allExpanded, setAllExpanded] = useState<boolean>(false);
  const [hoveredSubItem, setHoveredSubItem] = useState<{
    vesselName: string;
    sub: GanttSubTicket;
  } | null>(null);

  // Jika ada armada terpilih dari Donut Chart, otomatis buka (expand) baris tersebut
  useEffect(() => {
    if (selectedArmadaId) {
      setExpandedRows((prev) => ({
        ...prev,
        [selectedArmadaId]: true,
      }));
    }
  }, [selectedArmadaId]);

  // Bangun struktur data armada dengan pemetaan tanggal 5 fase
  const vesselList = useMemo<ArmadaGanttVessel[]>(() => {
    const overrides = getAllOperationalOverrides();
    const map = new Map<string, {
      name: string;
      tag: string;
      fpbs: Set<string>;
      items: any[];
      lengkap: number;
      proses: number;
      parsial: number;
      backlog: number;
    }>();

    for (const it of items) {
      const rawName = (it.armada || (it as any).deptArmada || '').trim();
      if (!rawName || rawName === '-' || rawName.length < 2) continue;

      const normName = normalizeArmadaName(rawName);

      let tag = it.entity?.trim().toUpperCase() || '';
      if (!tag || tag === 'ALL' || tag.length > 5) {
        if (it.fpb && it.fpb.includes('-')) {
          tag = it.fpb.split('-')[0].trim().toUpperCase();
        }
      }
      if (!tag) tag = 'CPL';

      let entry = map.get(normName);
      if (!entry) {
        entry = {
          name: normName,
          tag,
          fpbs: new Set(),
          items: [],
          lengkap: 0,
          proses: 0,
          parsial: 0,
          backlog: 0,
        };
        map.set(normName, entry);
      }

      if (it.fpb) entry.fpbs.add(it.fpb.trim());
      entry.items.push(it);

      const qFpb = Number(it.qtyFPB) || 0;
      const qFstb = Number(it.qtyFSTB) || 0;
      const qSel = it.selisih !== undefined ? Number(it.selisih) : Math.max(0, qFpb - qFstb);

      const fpbClean = (it.fpb || '').replace(/[^A-Z0-9]/gi, '').toUpperCase();
      const override = overrides[fpbClean];

      const statusUpper = (it.status || '').toUpperCase();
      const isDelivered = Boolean(
        override?.isCompleted ||
        override?.tglDiantar ||
        it.tglBarangDiantar ||
        (it as any).picLap ||
        it.tglTimLapKePicTtb ||
        it.tglTtbKePicPch
      );
      const isComp =
        isDelivered ||
        (qSel === 0 && qFstb > 0) ||
        statusUpper.includes('LENGKAP') ||
        statusUpper.includes('CLOSE') ||
        statusUpper.includes('SELESAI') ||
        Boolean(it.noTtb) ||
        Boolean(override?.noTtb);
      const isPart = !isComp && (statusUpper.includes('PARSIAL') || (qFstb > 0 && qSel > 0));
      const isBacklog =
        !isComp &&
        (statusUpper.includes('BACKLOG') ||
          statusUpper.includes('KRITIS') ||
          statusUpper.includes('OPEN') ||
          (!isPart && (!it.noPo || it.noPo === '-')));

      if (isComp) entry.lengkap++;
      else if (isPart) entry.parsial++;
      else if (isBacklog) entry.backlog++;
      else entry.proses++;
    }

    const result: ArmadaGanttVessel[] = [];

    for (const entry of Array.from(map.values())) {
      const fpbCount = Math.max(entry.fpbs.size, 1);
      const totalStatus = entry.lengkap + entry.proses + entry.parsial + entry.backlog || 1;
      const lkRatio = entry.lengkap / totalStatus;

      let gradientStyle = 'bg-gradient-to-r from-sky-600 via-sky-500 to-amber-500';
      if (lkRatio >= 0.7) {
        gradientStyle = 'bg-gradient-to-r from-emerald-600 via-emerald-500 to-teal-500';
      } else if (entry.backlog > 0) {
        gradientStyle = 'bg-gradient-to-r from-emerald-600 via-amber-500 to-rose-600';
      }

      const sampleItems: GanttSubTicket[] = [];
      const seen = new Set<string>();

      for (const child of entry.items) {
        const fpbNum = (child.fpb || '').trim();
        if (!fpbNum) continue;

        const rawItemName = (child.item || '').trim();
        const key = `${fpbNum}_${rawItemName}`;
        if (seen.has(key)) continue;
        seen.add(key);

        const qFpb = Number(child.qtyFPB) || 0;
        const qFstb = Number(child.qtyFSTB) || 0;
        const qSel = child.selisih !== undefined ? Number(child.selisih) : Math.max(0, qFpb - qFstb);

        const fpbClean = fpbNum.replace(/[^A-Z0-9]/gi, '').toUpperCase();
        const override = overrides[fpbClean];

        const childStatusUpper = (child.status || '').toUpperCase();
        const isChildDelivered = Boolean(
          override?.isCompleted ||
          override?.tglDiantar ||
          child.tglBarangDiantar ||
          (child as any).picLap
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

        // 1. Tanggal Mulai (Kotak 1: Buat FPB)
        let dStart = parseDateObj(child.tglFpb || (child as any).date);
        if (!dStart) {
          dStart = new Date(2026, 9, 2 + (sampleItems.length % 5));
        }

        // 2. Tanggal Selesai (Kotak 5: Serah Terima Tim Lapangan)
        let dEnd: Date | null = null;
        const rawKotak5 =
          override?.tglDiantar ||
          override?.tglKeTimLapangan ||
          child.tglBarangDiantar ||
          (child as any).tglDiantar ||
          child.tglTimLapKePicTtb;

        if (rawKotak5) {
          dEnd = parseDateObj(rawKotak5);
        }

        if (!dEnd) {
          if (childStatus === 'LENGKAP') {
            const rawFstbTtb = override?.tglTtb || child.tglFstb || child.tglTtb;
            dEnd = rawFstbTtb ? parseDateObj(rawFstbTtb) : new Date(dStart.getTime() + 4 * 86400000);
          } else if (childStatus === 'BACKLOG') {
            dEnd = new Date(2026, 9, 15); // Hari ini (15 Okt)
          } else {
            dEnd = new Date(dStart.getTime() + 5 * 86400000);
          }
        }

        if (!dEnd || isNaN(dEnd.getTime()) || dEnd.getTime() < dStart.getTime()) {
          dEnd = new Date(dStart.getTime() + 2 * 86400000);
        }

        const durationDays = Math.max(1, Math.round(Math.abs(dEnd.getTime() - dStart.getTime()) / 86400000));
        const durationText = `${durationDays} Hari Kerja`;
        const startLabel = formatShortDate(dStart);
        const endLabel = formatShortDate(dEnd);

        sampleItems.push({
          fpb: fpbNum,
          item: rawItemName || 'Suku Cadang & Perlengkapan Kapal',
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
        });

        if (sampleItems.length >= 10) break;
      }

      const allStarts = sampleItems.map((s) => s.startDate.getTime());
      const allEnds = sampleItems.map((s) => s.endDate.getTime());
      const vStartDate = allStarts.length > 0 ? new Date(Math.min(...allStarts)) : new Date(2026, 9, 2);
      const vEndDate = allEnds.length > 0 ? new Date(Math.max(...allEnds)) : new Date(2026, 9, 15);

      result.push({
        name: entry.name,
        tag: entry.tag,
        fpbCount,
        startDate: vStartDate,
        endDate: vEndDate,
        startLabel: formatShortDate(vStartDate),
        endLabel: formatShortDate(vEndDate),
        summaryText: `${formatShortDate(vStartDate)} → ${formatShortDate(vEndDate)}`,
        gradientStyle,
        statusBadge: {
          lengkap: entry.lengkap,
          proses: entry.proses,
          parsial: entry.parsial,
          backlog: entry.backlog,
        },
        sampleItems,
      });
    }

    result.sort((a, b) => {
      // Prioritaskan armada yang sedang dipilih
      if (selectedArmadaId) {
        if (a.name === selectedArmadaId) return -1;
        if (b.name === selectedArmadaId) return 1;
      }
      return b.fpbCount - a.fpbCount;
    });

    return result;
  }, [items, selectedArmadaId]);

  // Bulan yang ditampilkan di header grid
  const displayMonths = useMemo(() => {
    if (selectedPeriod === 'ALL') return TIMELINE_MONTHS;
    return TIMELINE_MONTHS.filter((m) => m.key === selectedPeriod);
  }, [selectedPeriod]);

  const totalCols = displayMonths.length * 4;

  // Garis posisi 'TODAY' (15 Oktober 2026)
  const todayPercent = useMemo(() => {
    if (selectedPeriod === '10') {
      return ((15 - 1 + 0.5) / 31) * 100;
    }
    if (selectedPeriod === 'ALL') {
      return 80 + ((15 - 1 + 0.5) / 31) * 20;
    }
    return null;
  }, [selectedPeriod]);

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
      vesselList.forEach((v) => {
        next[v.name] = true;
      });
      setExpandedRows(next);
      setAllExpanded(true);
    }
  };

  return (
    <div className="bg-slate-900/95 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xl backdrop-blur-md space-y-4">
      {/* Header Gantt Schedule */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800/80">
        <div className="flex items-center gap-2.5">
          <div className="size-9 rounded-xl bg-teal-500/10 border border-teal-500/30 text-teal-400 flex items-center justify-center shrink-0">
            <Calendar className="size-4.5" />
          </div>
          <div>
            <h4 className="text-xs sm:text-sm font-extrabold text-white uppercase tracking-wider flex items-center gap-2">
              <span>GANTT TIMELINE SIKLUS TIKET FPB PER ARMADA</span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-teal-500/20 text-teal-300 border border-teal-500/30">
                Fase 1 &rarr; Fase 5
              </span>
            </h4>
            <p className="text-xs text-slate-400 mt-0.5">
              Rentang waktu tanggal pembukaan tiket (Kotak 1) hingga serah terima barang di lapangan (Kotak 5).
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {selectedArmadaId && (
            <div className="px-2.5 py-1 rounded-lg bg-sky-500/20 border border-sky-500/40 text-sky-300 text-xs font-mono flex items-center gap-1.5">
              <span>Menyorot: <strong>{selectedArmadaId}</strong></span>
              {onSelectArmada && (
                <button
                  type="button"
                  onClick={() => onSelectArmada(null)}
                  className="hover:text-white p-0.5 rounded cursor-pointer"
                  title="Tampilkan semua armada"
                >
                  <X className="size-3" />
                </button>
              )}
            </div>
          )}

          <button
            type="button"
            onClick={handleToggleAll}
            className="h-8 px-3 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-semibold transition inline-flex items-center gap-1.5 shadow-xs cursor-pointer"
          >
            <Layers className="size-3.5 text-slate-400" />
            <span>{allExpanded ? 'Tutup Semua Rincian' : 'Buka Semua Rincian'}</span>
          </button>
        </div>
      </div>

      {/* Tabel Gantt Schedule dengan Sticky Header & Grid Tanggal */}
      <div className="relative border border-slate-800 rounded-xl overflow-hidden bg-slate-950 shadow-sm">
        <div className="overflow-x-auto min-w-full">
          <div className="min-w-[1050px]">
            {/* Header Sticky Kolom Timeline */}
            <div className="sticky top-0 z-30 bg-slate-900 border-b border-slate-800 shadow-xs backdrop-blur-md">
              {/* Baris 1: Bulan */}
              <div className="flex items-stretch h-9 border-b border-slate-800">
                <div className="w-80 sm:w-96 shrink-0 px-3.5 flex items-center justify-between border-r border-slate-800 bg-slate-900 text-slate-200 font-bold uppercase tracking-wider text-[11px] sticky left-0 z-30">
                  <span className="flex items-center gap-2">
                    <Ship className="size-3.5 text-teal-400" />
                    <span>ARMADA &amp; RINCIAN TIKET</span>
                  </span>
                  <span className="text-[10px] font-mono text-slate-400 font-normal">STATUS</span>
                </div>

                <div
                  className="flex-1 grid text-center text-[11px] font-extrabold tracking-wider uppercase text-slate-200"
                  style={{ gridTemplateColumns: `repeat(${displayMonths.length}, minmax(0, 1fr))` }}
                >
                  {displayMonths.map((m) => (
                    <div
                      key={m.key}
                      className="py-1.5 border-r border-slate-800 last:border-r-0 flex items-center justify-center"
                    >
                      <span>{m.label}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Baris 2: Sub-Header Minggu (W1..W4) + TODAY Marker */}
              <div className="relative flex items-stretch h-7.5 bg-slate-800/80 text-[10.5px] font-mono text-slate-300">
                <div className="w-80 sm:w-96 shrink-0 px-3.5 flex items-center justify-between border-r border-slate-800 bg-slate-800 sticky left-0 z-30">
                  <span className="text-[10px] text-slate-400">Klik baris armada untuk buka sub-tiket</span>
                  <span className="text-[10px] text-slate-400">Tag</span>
                </div>

                <div
                  className="flex-1 grid text-center font-bold relative"
                  style={{ gridTemplateColumns: `repeat(${totalCols}, minmax(0, 1fr))` }}
                >
                  {displayMonths.map((m) =>
                    WEEKS_PER_MONTH.map((w, wIdx) => {
                      const isTodayCol =
                        (selectedPeriod === '10' && wIdx === 2) ||
                        (selectedPeriod === 'ALL' && m.startCol + wIdx === TODAY_COL);

                      return (
                        <div
                          key={`${m.key}-${w}`}
                          className={`flex items-center justify-center border-r border-slate-700/50 last:border-r-0 transition ${
                            isTodayCol
                              ? 'bg-rose-500/20 text-rose-300 font-black'
                              : 'text-slate-400'
                          }`}
                        >
                          {w}
                        </div>
                      );
                    })
                  )}

                  {todayPercent !== null && (
                    <div
                      className="absolute top-0 -translate-x-1/2 z-40 flex flex-col items-center pointer-events-none"
                      style={{ left: `${todayPercent}%` }}
                    >
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-mono font-black bg-rose-600 text-white shadow-md border border-rose-400 animate-pulse">
                        <span className="size-1.5 rounded-full bg-white" />
                        HARI INI • 15 OKT
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Rows Table */}
            <div className="divide-y divide-slate-800/80 text-xs">
              {vesselList.map((vessel, vIdx) => {
                const isExpanded = Boolean(expandedRows[vessel.name]);
                const isSelected = selectedArmadaId === vessel.name;

                const { left: parentLeft, width: parentWidth } = calculateDateRangePosition(
                  vessel.startDate,
                  vessel.endDate,
                  selectedPeriod
                );

                return (
                  <React.Fragment key={vessel.name}>
                    {/* Baris Induk Armada */}
                    <div className={`flex items-stretch min-h-[52px] transition group border-b border-slate-800/80 ${
                      isSelected ? 'bg-sky-950/30' : 'bg-slate-900/60 hover:bg-slate-800/50'
                    }`}>
                      {/* Kolom Kiri Nama Armada */}
                      <div className="w-80 sm:w-96 shrink-0 px-3.5 py-2 border-r border-slate-800 flex items-center justify-between gap-2 sticky left-0 bg-slate-900 z-20 shadow-[2px_0_6px_-2px_rgba(0,0,0,0.3)]">
                        <button
                          type="button"
                          onClick={() => toggleRow(vessel.name)}
                          className="flex items-center gap-1.5 text-left font-bold text-white hover:text-teal-400 transition truncate flex-1 cursor-pointer"
                        >
                          <span className="size-4.5 rounded flex items-center justify-center text-slate-400 group-hover:text-teal-400 shrink-0">
                            {isExpanded ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
                          </span>
                          <span className="text-[11px] font-mono text-slate-500 shrink-0">#{vIdx + 1}</span>
                          <span className="truncate text-xs">{vessel.name}</span>
                        </button>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-800 border border-slate-700 text-slate-300">
                            {vessel.tag}
                          </span>
                          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-sky-500/20 text-sky-300 border border-sky-500/40">
                            {vessel.fpbCount} FPB
                          </span>
                        </div>
                      </div>

                      {/* Kolom Kanan Timeline Bar Induk */}
                      <div className="flex-1 relative flex items-center h-full min-h-[52px] px-1">
                        {/* Garis Grid Vertikal */}
                        <div
                          className="absolute inset-0 grid pointer-events-none"
                          style={{ gridTemplateColumns: `repeat(${totalCols}, minmax(0, 1fr))` }}
                        >
                          {Array.from({ length: totalCols }).map((_, cIdx) => (
                            <div
                              key={cIdx}
                              className={`h-full border-r ${
                                cIdx % 4 === 3 ? 'border-slate-800' : 'border-slate-800/40'
                              }`}
                            />
                          ))}
                        </div>

                        {/* Garis Vertikal Today */}
                        {todayPercent !== null && (
                          <div
                            className="absolute top-0 bottom-0 -translate-x-1/2 z-15 pointer-events-none flex flex-col items-center"
                            style={{ left: `${todayPercent}%` }}
                          >
                            <div className="w-0.5 h-full bg-rose-500/80 shadow-[0_0_6px_rgba(244,63,94,0.4)]" />
                          </div>
                        )}

                        {/* Bar Gantt Armada Induk */}
                        <div
                          className={`absolute h-8.5 rounded-lg shadow-sm flex items-center px-3 transition-all cursor-pointer hover:shadow-md hover:scale-[1.003] text-white select-none overflow-hidden border border-white/20 ${vessel.gradientStyle}`}
                          style={{
                            left: `calc(${parentLeft}% + 2px)`,
                            width: `calc(${parentWidth}% - 4px)`,
                          }}
                          onClick={() => toggleRow(vessel.name)}
                          title={`${vessel.name}: ${vessel.summaryText}. Klik untuk melihat ${vessel.sampleItems.length} tiket FPB.`}
                        >
                          <div className="flex items-center justify-between w-full text-[11px] font-bold truncate leading-none">
                            <span className="truncate flex items-center gap-1.5 min-w-0">
                              <Ship className="size-3.5 shrink-0 opacity-90" />
                              <span className="truncate">{vessel.name}</span>
                            </span>
                            <span className="text-[10px] font-mono bg-black/30 px-2 py-0.5 rounded ml-1.5 shrink-0 border border-white/20">
                              {vessel.fpbCount} FPB • {vessel.summaryText}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Baris Rincian Sub-Tiket FPB (Dinamis Sesuai Fase 1 s/d Fase 5) */}
                    {isExpanded &&
                      vessel.sampleItems.map((sub, sIdx) => {
                        const { left: subLeft, width: subWidth } = calculateDateRangePosition(
                          sub.startDate,
                          sub.endDate,
                          selectedPeriod
                        );

                        let barBg = 'bg-gradient-to-r from-emerald-600 to-teal-500 border-emerald-400/50 text-white';
                        let statusLabel = 'LENGKAP';

                        if (sub.status === 'PROSES') {
                          barBg = 'bg-gradient-to-r from-sky-600 to-blue-500 border-sky-400/50 text-white';
                          statusLabel = 'PROSES';
                        } else if (sub.status === 'PARSIAL') {
                          barBg = 'bg-gradient-to-r from-amber-600 to-orange-500 border-amber-400/50 text-white';
                          statusLabel = 'PARSIAL';
                        } else if (sub.status === 'BACKLOG') {
                          barBg = 'bg-gradient-to-r from-rose-600 to-red-500 border-rose-400/50 text-white';
                          statusLabel = 'BACKLOG';
                        }

                        return (
                          <div
                            key={`${sub.fpb}-${sIdx}`}
                            className="flex items-stretch min-h-[46px] bg-slate-950/60 hover:bg-slate-900/60 transition border-b border-slate-800/50 group/sub"
                          >
                            {/* Kolom Kiri Rincian Tiket */}
                            <div className="w-80 sm:w-96 shrink-0 pl-7 pr-3 py-1.5 border-r border-slate-800 flex items-center justify-between gap-2 sticky left-0 bg-slate-950 group-hover/sub:bg-slate-900 z-20 shadow-[2px_0_6px_-2px_rgba(0,0,0,0.3)] transition">
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span
                                    onClick={() => onOpenAudit && onOpenAudit(sub.fpb)}
                                    className="font-mono font-bold text-[11px] text-slate-100 hover:text-sky-400 transition cursor-pointer"
                                    title="Klik untuk membuka audit berkas"
                                  >
                                    {sub.fpb}
                                  </span>
                                  <span
                                    className={`px-1.5 py-0.5 rounded text-[9px] font-mono font-bold border leading-none ${
                                      sub.status === 'LENGKAP'
                                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                                        : sub.status === 'PROSES'
                                        ? 'bg-sky-500/20 text-sky-300 border-sky-500/40'
                                        : sub.status === 'PARSIAL'
                                        ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                                        : 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                                    }`}
                                  >
                                    {sub.status}
                                  </span>
                                </div>
                                <div className="flex items-center gap-1 text-[10.5px] text-slate-400 mt-0.5 truncate leading-tight">
                                  <span className="truncate max-w-[200px] sm:max-w-[240px]" title={sub.item}>
                                    {sub.item}
                                  </span>
                                  {sub.qtyFpb !== undefined && sub.qtyFpb > 0 && (
                                    <span className="font-mono text-[9px] text-slate-500 shrink-0">
                                      ({sub.qtyFstb || 0}/{sub.qtyFpb} {sub.satuan || 'UNIT'})
                                    </span>
                                  )}
                                </div>
                              </div>

                              {onOpenAudit && (
                                <button
                                  type="button"
                                  onClick={() => onOpenAudit(sub.fpb)}
                                  className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition shrink-0 cursor-pointer"
                                  title="Buka Audit Trail Berkas"
                                >
                                  <ExternalLink className="size-3.5" />
                                </button>
                              )}
                            </div>

                            {/* Kolom Kanan Timeline Sub-Bar dengan Milestone Nodes & Lead Time */}
                            <div className="flex-1 relative flex items-center h-full min-h-[46px] px-1">
                              {/* Grid Kolom */}
                              <div
                                className="absolute inset-0 grid pointer-events-none"
                                style={{ gridTemplateColumns: `repeat(${totalCols}, minmax(0, 1fr))` }}
                              >
                                {Array.from({ length: totalCols }).map((_, cIdx) => (
                                  <div
                                    key={cIdx}
                                    className={`h-full border-r ${
                                      cIdx % 4 === 3 ? 'border-slate-800' : 'border-slate-800/40'
                                    }`}
                                  />
                                ))}
                              </div>

                              {todayPercent !== null && (
                                <div
                                  className="absolute top-0 bottom-0 -translate-x-1/2 z-15 pointer-events-none flex flex-col items-center"
                                  style={{ left: `${todayPercent}%` }}
                                >
                                  <div className="w-0.5 h-full bg-rose-500/80 shadow-[0_0_6px_rgba(244,63,94,0.4)]" />
                                </div>
                              )}

                              {/* Bar Gantt Sub-Item */}
                              <div
                                className={`absolute h-7 rounded-lg shadow-xs flex items-center px-2 transition-all cursor-pointer hover:shadow-md hover:scale-[1.004] z-10 select-none border ${barBg}`}
                                style={{
                                  left: `calc(${subLeft}% + 1px)`,
                                  width: `calc(${subWidth}% - 2px)`,
                                }}
                                onClick={() => onOpenAudit && onOpenAudit(sub.fpb)}
                                onMouseEnter={() => setHoveredSubItem({ vesselName: vessel.name, sub })}
                                onMouseLeave={() => setHoveredSubItem(null)}
                                title={`${sub.fpb}: ${sub.item} | ${sub.startLabel} → ${sub.endLabel} (${sub.durationDays} Hari)`}
                              >
                                <div className="flex items-center justify-between w-full text-[10px] font-semibold truncate leading-none">
                                  <span className="truncate flex items-center gap-1.5 min-w-0">
                                    {/* Milestone Node Kiri (Buat FPB) */}
                                    <span
                                      className="size-2 rounded-full bg-white ring-2 ring-white/60 shadow-xs shrink-0"
                                      title={`Milestone Buka FPB: ${sub.startLabel}`}
                                    />
                                    <span className="font-mono font-bold tracking-tight shrink-0">{sub.fpb}</span>
                                    <span className="truncate opacity-95 font-medium hidden sm:inline">• {sub.item}</span>
                                    {/* Badge Rentang Tanggal & Durasi */}
                                    <span className="font-mono text-[9px] px-1.5 py-0.5 rounded bg-black/30 border border-white/20 shrink-0 font-medium ml-1">
                                      {sub.startLabel} &rarr; {sub.endLabel} ({sub.durationDays} Hari)
                                    </span>
                                  </span>

                                  <span className="flex items-center gap-1.5 shrink-0 ml-1">
                                    <span className="text-[9px] font-mono font-bold bg-black/30 px-1.5 py-0.5 rounded border border-white/20">
                                      {statusLabel}
                                    </span>
                                    {/* Milestone Node Kanan (Serah Terima Lapangan) */}
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

        {/* Tooltip Hover Interaktif Alur 5 Fase */}
        {hoveredSubItem && (
          <div className="fixed bottom-6 right-6 max-w-sm sm:max-w-md w-full bg-slate-900/98 text-white p-4 rounded-xl shadow-2xl border border-slate-700/90 text-xs space-y-2.5 z-50 pointer-events-none backdrop-blur-md animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between gap-2 border-b border-slate-800 pb-2">
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

            <div>
              <div className="font-semibold text-white text-xs leading-snug line-clamp-2">
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

            {/* 5 Fase Alur Tanggung Jawab */}
            <div className="space-y-1 pt-1.5 border-t border-slate-800 text-[11px] font-mono">
              <div className="flex items-center justify-between gap-2 bg-slate-800/60 p-1.5 rounded-lg border border-slate-700/50">
                <span className="text-sky-300 font-semibold flex items-center gap-1 shrink-0">
                  <FileCheck className="size-3 text-sky-400" />
                  <span>Tahap 1 (FPB):</span>
                </span>
                <span className="text-right text-slate-200 truncate">
                  <span className="font-bold text-white">{hoveredSubItem.sub.startLabel}</span>
                  <span className="text-slate-400 text-[10px] ml-1">oleh {hoveredSubItem.sub.picFpb}</span>
                </span>
              </div>

              <div className="flex items-center justify-between gap-2 bg-slate-800/60 p-1.5 rounded-lg border border-slate-700/50">
                <span className="text-cyan-300 font-semibold flex items-center gap-1 shrink-0">
                  <ShoppingBag className="size-3 text-cyan-400" />
                  <span>Tahap 2 (PO):</span>
                </span>
                <span className="text-right text-slate-200 truncate">
                  <span className="font-bold text-white">{hoveredSubItem.sub.noPo || 'PO Terbit'}</span>
                  {hoveredSubItem.sub.tglPo && <span className="text-slate-300 text-[10px] ml-1">({hoveredSubItem.sub.tglPo})</span>}
                  <span className="text-slate-400 text-[10px] ml-1">oleh {hoveredSubItem.sub.picPch}</span>
                </span>
              </div>

              <div className="flex items-center justify-between gap-2 bg-slate-800/60 p-1.5 rounded-lg border border-slate-700/50">
                <span className="text-purple-300 font-semibold flex items-center gap-1 shrink-0">
                  <Boxes className="size-3 text-purple-400" />
                  <span>Tahap 3 &amp; 4 (FSTB/TTB):</span>
                </span>
                <span className="text-right text-slate-200 truncate">
                  <span className="font-bold text-white">
                    {hoveredSubItem.sub.tglFstb || hoveredSubItem.sub.tglTtb || hoveredSubItem.sub.endLabel}
                  </span>
                  <span className="text-slate-400 text-[10px] ml-1">oleh {hoveredSubItem.sub.picTtb}</span>
                </span>
              </div>

              <div className="flex items-center justify-between gap-2 bg-emerald-950/40 p-1.5 rounded-lg border border-emerald-700/40">
                <span className="text-emerald-300 font-semibold flex items-center gap-1 shrink-0">
                  <HardHat className="size-3 text-emerald-400" />
                  <span>Tahap 5 (Serah Terima):</span>
                </span>
                <span className="text-right text-emerald-200 truncate">
                  <span className="font-bold text-white">{hoveredSubItem.sub.endLabel}</span>
                  <span className="text-emerald-300/80 text-[10px] ml-1">oleh {hoveredSubItem.sub.picLap}</span>
                </span>
              </div>
            </div>

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
    </div>
  );
}

