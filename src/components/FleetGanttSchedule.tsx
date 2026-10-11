'use client';

import React, { useState, useMemo } from 'react';
import {
  Calendar,
  Clock,
  Ship,
  Search,
  Filter,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Layers,
  Sparkles,
  Info,
  Maximize2,
  Minimize2,
  PackageCheck,
  AlertTriangle,
  RotateCcw,
} from 'lucide-react';
import { extractDateInfo } from '@/utils/formatDate';

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
}

interface FleetGanttScheduleProps {
  items: FleetGanttItem[];
  onOpenAudit?: (fpb: string, po?: string) => void;
  selectedEntity?: string;
}

// Representasi kolom periode waktu (Mingguan)
interface WeekColumn {
  id: string; // Misal '2026-06-W1'
  year: string;
  month: string;
  monthName: string;
  weekNum: number; // 1, 2, 3, 4
  label: string; // 'W1', 'W2', dst.
  fullLabel: string; // 'Jun W1', 'Jun W2', dst.
  startDay: number;
  endDay: number;
}

export default function FleetGanttSchedule({
  items,
  onOpenAudit,
  selectedEntity,
}: FleetGanttScheduleProps) {
  const [selectedMonthFilter, setSelectedMonthFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'LENGKAP' | 'PROSES' | 'PARSIAL' | 'BACKLOG'>('ALL');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [expandedVessels, setExpandedVessels] = useState<Record<string, boolean>>({});
  const [isFullWidth, setIsFullWidth] = useState<boolean>(false);
  const [hoveredBar, setHoveredBar] = useState<{
    vessel: string;
    fpb: string;
    wo?: string;
    item: string;
    startDate: string;
    endDate: string;
    durationDays: number;
    qtyFPB: number;
    qtyFSTB: number;
    status: string;
    statusType: 'LENGKAP' | 'PROSES' | 'PARSIAL' | 'BACKLOG';
    kategori?: string;
  } | null>(null);

  // 1. Tentukan rentang tahun & bulan yang aktif pada dataset
  const activeYear = useMemo(() => {
    for (const it of items) {
      const d = extractDateInfo(it.tglPo || it.tglFpb || it.tglFstb);
      if (d.year && d.year.length === 4) return d.year;
    }
    return '2026';
  }, [items]);

  // Daftar bulan default (Juni - Oktober 2026)
  const monthOrder = useMemo(() => {
    return [
      { key: '06', name: 'Jun' },
      { key: '07', name: 'Jul' },
      { key: '08', name: 'Agu' },
      { key: '09', name: 'Sep' },
      { key: '10', name: 'Okt' },
    ];
  }, []);

  // 2. Buat definisi kolom mingguan (Week 1 s/d Week 4 per bulan)
  const weekColumns: WeekColumn[] = useMemo(() => {
    const cols: WeekColumn[] = [];
    const targetMonths =
      selectedMonthFilter === 'ALL'
        ? monthOrder
        : monthOrder.filter((m) => m.key === selectedMonthFilter);

    targetMonths.forEach((m) => {
      // Bagi 1 bulan menjadi 4 rentang minggu standar
      const weeksDef = [
        { num: 1, start: 1, end: 7 },
        { num: 2, start: 8, end: 14 },
        { num: 3, start: 15, end: 21 },
        { num: 4, start: 22, end: 31 },
      ];

      weeksDef.forEach((w) => {
        cols.push({
          id: `${activeYear}-${m.key}-W${w.num}`,
          year: activeYear,
          month: m.key,
          monthName: m.name,
          weekNum: w.num,
          label: `W${w.num}`,
          fullLabel: `${m.name} W${w.num}`,
          startDay: w.start,
          endDay: w.end,
        });
      });
    });

    return cols;
  }, [activeYear, monthOrder, selectedMonthFilter]);

  // 3. Helper pemetaan tanggal ke index kolom minggu
  const mapDateToColumnIndex = (dateStr?: string | number | null): number => {
    if (!dateStr && dateStr !== 0) return -1;
    const info = extractDateInfo(dateStr);
    if (!info.month || !info.day) return -1;

    const dNum = parseInt(info.day, 10);
    let wNum = 1;
    if (dNum >= 22) wNum = 4;
    else if (dNum >= 15) wNum = 3;
    else if (dNum >= 8) wNum = 2;
    else wNum = 1;

    const colId = `${info.year || activeYear}-${info.month}-W${wNum}`;
    return weekColumns.findIndex((c) => c.id === colId);
  };

  // 4. Pengelompokan data per Armada & evaluasi bar Gantt
  const vesselScheduleGroups = useMemo(() => {
    const map = new Map<
      string,
      {
        vesselName: string;
        entity: string;
        totalRequests: number;
        completedRequests: number;
        partialRequests: number;
        backlogRequests: number;
        items: Array<{
          id: string;
          fpb: string;
          wo?: string;
          item: string;
          qtyFPB: number;
          qtyFSTB: number;
          selisih: number;
          kategori?: string;
          status: string;
          statusType: 'LENGKAP' | 'PROSES' | 'PARSIAL' | 'BACKLOG';
          startDateStr: string;
          endDateStr: string;
          durationDays: number;
          startColIdx: number;
          endColIdx: number;
          // Palet warna Gantt
          barColor: string;
          borderColor: string;
        }>;
      }
    >();

    // Palet warna modern berurutan untuk pembeda baris / armada (seperti di referensi)
    const vesselColorPalettes = [
      { bg: 'bg-emerald-500', border: 'border-emerald-600', text: 'text-emerald-700 dark:text-emerald-300' },
      { bg: 'bg-lime-500', border: 'border-lime-600', text: 'text-lime-700 dark:text-lime-300' },
      { bg: 'bg-cyan-500', border: 'border-cyan-600', text: 'text-cyan-700 dark:text-cyan-300' },
      { bg: 'bg-sky-500', border: 'border-sky-600', text: 'text-sky-700 dark:text-sky-300' },
      { bg: 'bg-amber-500', border: 'border-amber-600', text: 'text-amber-700 dark:text-amber-300' },
      { bg: 'bg-orange-500', border: 'border-orange-600', text: 'text-orange-700 dark:text-orange-300' },
      { bg: 'bg-blue-600', border: 'border-blue-700', text: 'text-blue-700 dark:text-blue-300' },
      { bg: 'bg-indigo-500', border: 'border-indigo-600', text: 'text-indigo-700 dark:text-indigo-300' },
      { bg: 'bg-purple-500', border: 'border-purple-600', text: 'text-purple-700 dark:text-purple-300' },
      { bg: 'bg-pink-500', border: 'border-pink-600', text: 'text-pink-700 dark:text-pink-300' },
      { bg: 'bg-rose-500', border: 'border-rose-600', text: 'text-rose-700 dark:text-rose-300' },
    ];

    items.forEach((it) => {
      const vName = (it.armada || 'Umum / Lainnya').trim();
      if (!vName) return;

      // Status Klasifikasi
      const qFpb = Number(it.qtyFPB) || 0;
      const qFstb = Number(it.qtyFSTB) || 0;
      const qSel = Number(it.selisih) || Math.max(0, qFpb - qFstb);

      const isComp =
        (qSel === 0 && qFstb > 0) ||
        it.status?.toUpperCase().includes('LENGKAP') ||
        it.status?.toUpperCase().includes('SELESAI');
      const isPart = it.status?.toUpperCase().includes('PARSIAL') || (qFstb > 0 && qSel > 0);
      const isProses = it.status?.toUpperCase().includes('PO') || it.status?.toUpperCase().includes('PROSES');

      let statusType: 'LENGKAP' | 'PROSES' | 'PARSIAL' | 'BACKLOG' = 'BACKLOG';
      if (isComp) statusType = 'LENGKAP';
      else if (isPart) statusType = 'PARSIAL';
      else if (isProses) statusType = 'PROSES';

      // Filter status jika dipilih
      if (statusFilter !== 'ALL' && statusType !== statusFilter) {
        return;
      }

      // Filter pencarian
      if (searchTerm.trim() !== '') {
        const q = searchTerm.toLowerCase().trim();
        const match =
          vName.toLowerCase().includes(q) ||
          (it.fpb && it.fpb.toLowerCase().includes(q)) ||
          (it.item && it.item.toLowerCase().includes(q)) ||
          (it.workOrderNo && it.workOrderNo.toLowerCase().includes(q));
        if (!match) return;
      }

      // Hitung kolom awal (Start Date: Tgl FPB / PO)
      const startDateStr = it.tglFpb || it.tglPo || '-';
      let startIdx = mapDateToColumnIndex(startDateStr);

      // Hitung kolom akhir (End Date: Tgl FSTB / TTB / Lead time estimate)
      const endDateStr = it.tglFstb || it.tglTtb || it.tglPo || startDateStr;
      let endIdx = mapDateToColumnIndex(endDateStr);

      // Jika tanggal berada di luar jangkauan tampilan saat ini
      if (startIdx === -1 && endIdx === -1) {
        // Jika filter bulan spesifik, abaikan item di luar bulan tsb
        if (selectedMonthFilter !== 'ALL') return;
        // Fallback default: sematkan pada kolom pertama & kedua
        startIdx = 0;
        endIdx = 1;
      } else if (startIdx === -1) {
        startIdx = 0;
      } else if (endIdx === -1) {
        endIdx = Math.min(weekColumns.length - 1, startIdx + 1);
      }

      if (endIdx < startIdx) {
        endIdx = startIdx;
      }

      // Estimasi hari proses / durasi
      let durationDays = 3;
      if (typeof it.waktuProses === 'number' && it.waktuProses > 0) {
        durationDays = it.waktuProses;
      } else if (typeof it.waktuProses === 'string') {
        const m = it.waktuProses.match(/\d+(\.\d+)?/);
        if (m) durationDays = Math.round(parseFloat(m[0]));
      }

      if (!map.has(vName)) {
        map.set(vName, {
          vesselName: vName,
          entity: it.entity || 'CPG',
          totalRequests: 0,
          completedRequests: 0,
          partialRequests: 0,
          backlogRequests: 0,
          items: [],
        });
      }

      const group = map.get(vName)!;
      group.totalRequests++;
      if (statusType === 'LENGKAP') group.completedRequests++;
      else if (statusType === 'PARSIAL') group.partialRequests++;
      else group.backlogRequests++;

      // Warna bar berdasarkan status atau palette index
      let barColor = 'bg-emerald-500';
      let borderColor = 'border-emerald-600';
      if (statusType === 'PROSES') {
        barColor = 'bg-sky-500';
        borderColor = 'border-sky-600';
      } else if (statusType === 'PARSIAL') {
        barColor = 'bg-amber-500';
        borderColor = 'border-amber-600';
      } else if (statusType === 'BACKLOG') {
        barColor = 'bg-rose-500';
        borderColor = 'border-rose-600';
      }

      group.items.push({
        id: `${it.fpb}-${group.items.length}`,
        fpb: it.fpb || `FPB-${group.items.length + 1}`,
        wo: it.workOrderNo,
        item: it.item || 'Suku Cadang',
        qtyFPB: qFpb,
        qtyFSTB: qFstb,
        selisih: qSel,
        kategori: it.kategori,
        status: it.status || statusType,
        statusType,
        startDateStr,
        endDateStr,
        durationDays,
        startColIdx: startIdx,
        endColIdx: endIdx,
        barColor,
        borderColor,
      });
    });

    const arr = Array.from(map.values());
    // Urutkan berdasarkan intensitas permintaan terbanyak
    arr.sort((a, b) => b.totalRequests - a.totalRequests);
    return arr;
  }, [items, weekColumns, statusFilter, searchTerm, selectedMonthFilter]);

  // Toggle ekspansi per kapal
  const toggleExpand = (vName: string) => {
    setExpandedVessels((prev) => ({
      ...prev,
      [vName]: !prev[vName],
    }));
  };

  const expandAll = () => {
    const next: Record<string, boolean> = {};
    vesselScheduleGroups.forEach((g) => {
      next[g.vesselName] = true;
    });
    setExpandedVessels(next);
  };

  const collapseAll = () => {
    setExpandedVessels({});
  };

  // Batasi pagination baris jika ada banyak kapal
  const [currentPage, setCurrentPage] = useState<number>(1);
  const pageSize = 12;
  const totalPages = Math.max(1, Math.ceil(vesselScheduleGroups.length / pageSize));
  const paginatedGroups = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return vesselScheduleGroups.slice(start, start + pageSize);
  }, [vesselScheduleGroups, currentPage, pageSize]);

  return (
    <div className={`bg-white dark:bg-card border border-slate-200/90 dark:border-border rounded-2xl p-4 sm:p-5 shadow-xs transition space-y-4 ${isFullWidth ? 'col-span-full' : ''}`}>
      {/* 1. Header Toolbar & Judul */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3 border-b border-border/70">
        <div>
          <div className="flex items-center gap-2">
            <div className="size-8 rounded-lg bg-teal-50 dark:bg-teal-950/60 border border-teal-200 dark:border-teal-800 text-teal-600 dark:text-teal-400 flex items-center justify-center shrink-0">
              <Calendar className="size-4" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-foreground tracking-tight flex items-center gap-2">
                <span>JADWAL & SIKLUS PERMINTAAN ARMADA</span>
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

        {/* Filter Controls: Periode, Status, Cari */}
        <div className="flex items-center gap-2 flex-wrap text-xs">
          {/* Filter Bulan */}
          <div className="flex items-center bg-slate-50 dark:bg-muted border border-slate-200 dark:border-border rounded-lg px-2 py-1">
            <span className="text-[11px] text-muted-foreground mr-1.5 font-medium">Periode:</span>
            <select
              value={selectedMonthFilter}
              onChange={(e) => {
                setSelectedMonthFilter(e.target.value);
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

          {/* Filter Status */}
          <div className="flex items-center bg-slate-50 dark:bg-muted border border-slate-200 dark:border-border rounded-lg px-2 py-1">
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
              <option value="LENGKAP">🟢 Lengkap / Selesai</option>
              <option value="PROSES">🔵 Proses PO / Gudang</option>
              <option value="PARSIAL">🟠 Parsial (Sebagian)</option>
              <option value="BACKLOG">🔴 Backlog / Tertunda</option>
            </select>
          </div>

          {/* Pencarian Cepat */}
          <div className="relative">
            <input
              type="text"
              placeholder="Cari armada, FPB..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              className="h-8 pl-7 pr-2.5 text-xs bg-slate-50 dark:bg-muted border border-slate-200 dark:border-border rounded-lg placeholder:text-muted-foreground/60 text-foreground focus:ring-1 focus:ring-primary focus:outline-hidden w-36 sm:w-44"
            />
            <Search className="size-3.5 text-muted-foreground absolute left-2 top-2.5 pointer-events-none" />
          </div>

          {/* Expand / Collapse All */}
          <button
            type="button"
            onClick={Object.keys(expandedVessels).length > 0 ? collapseAll : expandAll}
            className="h-8 px-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-muted dark:hover:bg-muted/80 text-foreground border border-slate-200 dark:border-border rounded-lg text-xs font-medium transition inline-flex items-center gap-1 cursor-pointer"
            title="Buka / Tutup Rincian Tiket FPB Kapal"
          >
            <Layers className="size-3.5" />
            <span className="hidden sm:inline">
              {Object.keys(expandedVessels).length > 0 ? 'Tutup Detail' : 'Buka Detail'}
            </span>
          </button>
        </div>
      </div>

      {/* 2. Legenda Status Bar Gantt */}
      <div className="flex items-center justify-between pb-1 flex-wrap gap-2 text-[11px]">
        <div className="flex items-center gap-3.5 flex-wrap">
          <span className="font-semibold text-slate-700 dark:text-slate-300">Keterangan Bar:</span>
          <div className="flex items-center gap-1.5">
            <span className="size-3 rounded-xs bg-emerald-500 border border-emerald-600 shrink-0" />
            <span className="text-slate-600 dark:text-slate-400 font-medium">Lengkap / Selesai (FSTB)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="size-3 rounded-xs bg-sky-500 border border-sky-600 shrink-0" />
            <span className="text-slate-600 dark:text-slate-400 font-medium">Proses PO / Gudang</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="size-3 rounded-xs bg-amber-500 border border-amber-600 shrink-0" />
            <span className="text-slate-600 dark:text-slate-400 font-medium">Parsial (Sebagian Terkirim)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="size-3 rounded-xs bg-rose-500 border border-rose-600 shrink-0" />
            <span className="text-slate-600 dark:text-slate-400 font-medium">Backlog / Kritis</span>
          </div>
        </div>

        <div className="text-[11px] text-muted-foreground font-mono">
          Menampilkan <strong className="text-foreground">{vesselScheduleGroups.length}</strong> armada aktif
        </div>
      </div>

      {/* 3. Gantt Chart Table Grid (Horizontal Scrollable) */}
      <div className="relative border border-slate-200 dark:border-border rounded-xl overflow-hidden bg-white dark:bg-card">
        <div className="overflow-x-auto min-w-full">
          <div className="min-w-[920px]">
            {/* Header Sumbu Waktu: Nama Kapal vs Week 1, Week 2, ... */}
            <div className="grid grid-cols-12 bg-slate-100/90 dark:bg-muted/70 border-b border-slate-200 dark:border-border text-xs font-bold text-slate-700 dark:text-slate-200">
              {/* Kolom Kiri: Nama Armada / Task */}
              <div className="col-span-3 sm:col-span-3 p-2.5 pl-3 border-r border-slate-200 dark:border-border flex items-center justify-between">
                <span>ARMADA / TASK NAME</span>
                <span className="text-[10px] font-mono text-muted-foreground font-normal">FPB Aktif</span>
              </div>

              {/* Kolom Kanan: Kolom Minggu (Grid Columns) */}
              <div className="col-span-9 sm:col-span-9 grid" style={{ gridTemplateColumns: `repeat(${weekColumns.length}, minmax(0, 1fr))` }}>
                {weekColumns.map((col, idx) => (
                  <div
                    key={col.id}
                    className={`py-2 px-1 text-center border-r border-slate-200 dark:border-border/80 last:border-r-0 ${
                      col.weekNum === 1 ? 'bg-slate-200/50 dark:bg-slate-800/40 font-extrabold' : ''
                    }`}
                  >
                    <div className="text-[10px] text-slate-500 dark:text-muted-foreground uppercase leading-none font-semibold">
                      {col.weekNum === 1 || selectedMonthFilter !== 'ALL' ? col.monthName : ''}
                    </div>
                    <div className="text-[11px] font-mono text-slate-800 dark:text-slate-200 mt-0.5">
                      {col.label}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Body Rows: Daftar Armada & Timeline Bars */}
            {paginatedGroups.length === 0 ? (
              <div className="p-8 text-center text-xs text-muted-foreground flex flex-col items-center justify-center gap-2">
                <Ship className="size-6 text-muted-foreground/60" />
                <p>Tidak ada jadwal permintaan armada yang cocok dengan filter saat ini.</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-border/60 text-xs">
                {paginatedGroups.map((group, gIdx) => {
                  const isExpanded = Boolean(expandedVessels[group.vesselName]);
                  const rankNum = (currentPage - 1) * pageSize + gIdx + 1;

                  // Hitung rentang keseluruhan bar induk armada
                  const minStartCol = Math.min(...group.items.map((it) => it.startColIdx));
                  const maxEndCol = Math.max(...group.items.map((it) => it.endColIdx));
                  const totalCols = weekColumns.length;

                  const parentLeftPct = totalCols > 0 ? (Math.max(0, minStartCol) / totalCols) * 100 : 0;
                  const parentWidthPct =
                    totalCols > 0 ? (Math.max(1, maxEndCol - minStartCol + 1) / totalCols) * 100 : 100;

                  return (
                    <div key={group.vesselName} className="group hover:bg-slate-50/60 dark:hover:bg-muted/30 transition">
                      {/* Baris Induk Kapal */}
                      <div className="grid grid-cols-12 items-center">
                        {/* Kolom Kiri: Nama Kapal & Tombol Expand */}
                        <div className="col-span-3 sm:col-span-3 p-2.5 pl-3 border-r border-slate-200 dark:border-border flex items-center justify-between gap-1.5">
                          <button
                            type="button"
                            onClick={() => toggleExpand(group.vesselName)}
                            className="flex items-center gap-1.5 text-left font-bold text-slate-900 dark:text-foreground hover:text-primary transition truncate flex-1 cursor-pointer"
                            title={`Klik untuk melihat ${group.items.length} rincian tiket FPB`}
                          >
                            <span className="size-4 flex items-center justify-center text-slate-400 group-hover:text-primary">
                              {isExpanded ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
                            </span>
                            <span className="text-[11px] font-mono text-slate-400 shrink-0">{rankNum}.</span>
                            <span className="truncate">{group.vesselName}</span>
                          </button>

                          <div className="flex items-center gap-1 shrink-0">
                            <span className="px-1.5 py-0.5 rounded text-[9.5px] font-mono font-semibold bg-muted border border-border text-foreground">
                              {group.entity}
                            </span>
                            <span className="px-1.5 py-0.5 rounded text-[9.5px] font-mono font-bold bg-sky-50 dark:bg-sky-950/60 text-sky-600 dark:text-sky-400 border border-sky-200 dark:border-sky-800">
                              {group.items.length} FPB
                            </span>
                          </div>
                        </div>

                        {/* Kolom Kanan: Area Bar Gantt Induk */}
                        <div
                          className="col-span-9 sm:col-span-9 grid relative py-2.5 px-1 items-center"
                          style={{ gridTemplateColumns: `repeat(${weekColumns.length}, minmax(0, 1fr))` }}
                        >
                          {/* Garis Kisi Vertikal Pembatas Kolom */}
                          {weekColumns.map((c) => (
                            <div key={c.id} className="h-full border-r border-slate-100 dark:border-border/40 pointer-events-none last:border-r-0" />
                          ))}

                          {/* Bar Gantt Rangkuman Armada */}
                          <div
                            className="absolute inset-y-2 rounded-md shadow-2xs flex items-center px-2 transition-all cursor-pointer hover:brightness-95 select-none overflow-hidden bg-slate-700 dark:bg-slate-600 border border-slate-800 text-white"
                            style={{
                              left: `calc(${parentLeftPct}% + 4px)`,
                              width: `calc(${parentWidthPct}% - 8px)`,
                            }}
                            onClick={() => toggleExpand(group.vesselName)}
                            title={`Armada ${group.vesselName}: Siklus aktif sepanjang ${group.items.length} tiket permintaan. Klik untuk buka detail.`}
                          >
                            <div className="flex items-center justify-between w-full text-[10px] font-semibold truncate leading-none">
                              <span className="truncate flex items-center gap-1">
                                <Ship className="size-3 shrink-0" />
                                <span>{group.vesselName} ({group.items.length} Tiket Aktif)</span>
                              </span>
                              <span className="text-[9px] font-mono bg-black/25 px-1 py-0.5 rounded ml-1 shrink-0">
                                {group.completedRequests}/{group.totalRequests} Selesai
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Sub-Baris: Tiket FPB Kapal (Muncul jika Di-expand) */}
                      {isExpanded && (
                        <div className="bg-slate-50/70 dark:bg-muted/40 border-t border-slate-100 dark:border-border/60">
                          {group.items.map((sub, sIdx) => {
                            const subLeftPct = totalCols > 0 ? (sub.startColIdx / totalCols) * 100 : 0;
                            const subWidthPct =
                              totalCols > 0 ? (Math.max(1, sub.endColIdx - sub.startColIdx + 1) / totalCols) * 100 : 100;

                            return (
                              <div
                                key={sub.id}
                                className="grid grid-cols-12 items-center hover:bg-slate-100/60 dark:hover:bg-muted/70 transition border-b border-slate-100 dark:border-border/40 last:border-b-0"
                              >
                                {/* Kolom Kiri: Nomor FPB & Barang */}
                                <div className="col-span-3 sm:col-span-3 p-2 pl-7 border-r border-slate-200 dark:border-border flex items-center justify-between gap-1.5">
                                  <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-1.5">
                                      <span className="font-mono font-bold text-[11px] text-slate-800 dark:text-slate-100">
                                        {sub.fpb}
                                      </span>
                                      {sub.wo && (
                                        <span className="text-[9.5px] font-mono text-muted-foreground truncate">
                                          ({sub.wo})
                                        </span>
                                      )}
                                    </div>
                                    <p className="text-[10px] text-slate-500 dark:text-muted-foreground truncate" title={sub.item}>
                                      {sub.item}
                                    </p>
                                  </div>

                                  {onOpenAudit && (
                                    <button
                                      type="button"
                                      onClick={() => onOpenAudit(sub.fpb)}
                                      className="p-1 text-slate-400 hover:text-primary transition shrink-0"
                                      title="Buka Audit Trail Berkas"
                                    >
                                      <ExternalLink className="size-3" />
                                    </button>
                                  )}
                                </div>

                                {/* Kolom Kanan: Sub-Bar Gantt Tiap FPB */}
                                <div
                                  className="col-span-9 sm:col-span-9 grid relative py-2 px-1 items-center"
                                  style={{ gridTemplateColumns: `repeat(${weekColumns.length}, minmax(0, 1fr))` }}
                                >
                                  {/* Garis Kisi Vertikal */}
                                  {weekColumns.map((c) => (
                                    <div key={c.id} className="h-full border-r border-slate-100 dark:border-border/40 pointer-events-none last:border-r-0" />
                                  ))}

                                  {/* Bar Gantt Tiket FPB */}
                                  <div
                                    className={`absolute inset-y-1.5 rounded-md shadow-xs border flex items-center px-2 transition-all cursor-pointer hover:scale-[1.01] hover:brightness-105 select-none overflow-hidden text-white ${sub.barColor} ${sub.borderColor}`}
                                    style={{
                                      left: `calc(${subLeftPct}% + 4px)`,
                                      width: `calc(${subWidthPct}% - 8px)`,
                                    }}
                                    onMouseEnter={() =>
                                      setHoveredBar({
                                        vessel: group.vesselName,
                                        fpb: sub.fpb,
                                        wo: sub.wo,
                                        item: sub.item,
                                        startDate: sub.startDateStr,
                                        endDate: sub.endDateStr,
                                        durationDays: sub.durationDays,
                                        qtyFPB: sub.qtyFPB,
                                        qtyFSTB: sub.qtyFSTB,
                                        status: sub.status,
                                        statusType: sub.statusType,
                                        kategori: sub.kategori,
                                      })
                                    }
                                    onMouseLeave={() => setHoveredBar(null)}
                                    onClick={() => onOpenAudit && onOpenAudit(sub.fpb)}
                                  >
                                    <div className="flex items-center justify-between w-full text-[9.5px] font-bold truncate leading-none">
                                      <span className="truncate">
                                        {sub.fpb}: {sub.item}
                                      </span>
                                      <span className="text-[9px] font-mono bg-black/20 px-1 py-0.5 rounded ml-1 shrink-0">
                                        {sub.qtyFSTB}/{sub.qtyFPB}
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Floating Detail Tooltip Popover saat Bar di-hover */}
        {hoveredBar && (
          <div className="absolute bottom-3 right-3 max-w-sm bg-slate-900/95 text-white p-3 rounded-xl shadow-xl border border-slate-700 text-xs space-y-1.5 z-30 pointer-events-none backdrop-blur-xs animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between gap-2 border-b border-slate-700/80 pb-1.5">
              <div className="flex items-center gap-1.5 font-bold text-sky-400">
                <Ship className="size-3.5" />
                <span>{hoveredBar.vessel}</span>
              </div>
              <span
                className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold ${
                  hoveredBar.statusType === 'LENGKAP'
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                    : hoveredBar.statusType === 'PROSES'
                    ? 'bg-sky-500/20 text-sky-400 border border-sky-500/40'
                    : hoveredBar.statusType === 'PARSIAL'
                    ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                    : 'bg-rose-500/20 text-rose-400 border border-rose-500/40'
                }`}
              >
                {hoveredBar.status}
              </span>
            </div>

            <div>
              <p className="font-semibold text-white truncate">{hoveredBar.item}</p>
              <p className="text-[11px] text-slate-300 font-mono mt-0.5">
                No. FPB: <span className="text-sky-300 font-bold">{hoveredBar.fpb}</span>
                {hoveredBar.wo && ` • WO: ${hoveredBar.wo}`}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2 text-[10.5px] pt-1 text-slate-300 border-t border-slate-800">
              <div>
                <span className="text-slate-400">Periode Masuk:</span>
                <p className="font-mono text-slate-200">{hoveredBar.startDate}</p>
              </div>
              <div>
                <span className="text-slate-400">Realisasi FSTB:</span>
                <p className="font-mono text-slate-200">{hoveredBar.endDate}</p>
              </div>
            </div>

            <div className="flex items-center justify-between text-[11px] pt-1 font-mono">
              <span className="text-slate-400">Kuantitas:</span>
              <span className="font-bold text-white">
                {hoveredBar.qtyFSTB} / {hoveredBar.qtyFPB} Unit
              </span>
            </div>
          </div>
        )}
      </div>

      {/* 4. Footer Pagination & Navigasi Halaman */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-1 text-xs text-muted-foreground flex-wrap gap-2">
          <p>
            Halaman <strong className="text-foreground">{currentPage}</strong> dari <strong>{totalPages}</strong>
          </p>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 dark:bg-muted dark:hover:bg-muted/80 disabled:opacity-40 disabled:pointer-events-none rounded text-xs font-semibold text-foreground transition"
            >
              &larr; Sebelumnya
            </button>
            <button
              type="button"
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 dark:bg-muted dark:hover:bg-muted/80 disabled:opacity-40 disabled:pointer-events-none rounded text-xs font-semibold text-foreground transition"
            >
              Selanjutnya &rarr;
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

