'use client';

import React, { useState, useMemo, useEffect } from 'react';
import {
  Sparkles,
  ExternalLink,
  Search,
  Filter,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  RotateCcw,
  X,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Clock,
  Building2,
  AlertTriangle,
  Calendar,
  CalendarDays,
  FileSpreadsheet,
  FileText,
  UserCheck,
} from 'lucide-react';
import { ProcurementItem, StatusTone } from '@/types/procurement';
import { EntityDonutChart, PipelineBarChart } from './Charts';

const extractDateInfo = (dateStr?: string) => {
  if (!dateStr) return { year: '', month: '', fullDate: '', timestamp: 0 };
  const str = dateStr.trim();
  const isoMatch = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    const year = isoMatch[1];
    const month = isoMatch[2];
    const day = isoMatch[3];
    return {
      year,
      month,
      fullDate: `${year}-${month}-${day}`,
      timestamp: new Date(`${year}-${month}-${day}T00:00:00`).getTime(),
    };
  }
  const slashMatch = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (slashMatch) {
    const day = slashMatch[1].padStart(2, '0');
    const month = slashMatch[2].padStart(2, '0');
    const year = slashMatch[3];
    return {
      year,
      month,
      fullDate: `${year}-${month}-${day}`,
      timestamp: new Date(`${year}-${month}-${day}T00:00:00`).getTime(),
    };
  }
  const parsed = Date.parse(str);
  if (!isNaN(parsed)) {
    const dt = new Date(parsed);
    const year = String(dt.getFullYear());
    const month = String(dt.getMonth() + 1).padStart(2, '0');
    const day = String(dt.getDate()).padStart(2, '0');
    return {
      year,
      month,
      fullDate: `${year}-${month}-${day}`,
      timestamp: parsed,
    };
  }
  return { year: '', month: '', fullDate: '', timestamp: 0 };
};

const MONTH_OPTIONS = [
  { value: 'ALL', label: 'Semua Bulan' },
  { value: '01', label: '01 - Januari' },
  { value: '02', label: '02 - Februari' },
  { value: '03', label: '03 - Maret' },
  { value: '04', label: '04 - April' },
  { value: '05', label: '05 - Mei' },
  { value: '06', label: '06 - Juni' },
  { value: '07', label: '07 - Juli' },
  { value: '08', label: '08 - Agustus' },
  { value: '09', label: '09 - September' },
  { value: '10', label: '10 - Oktober' },
  { value: '11', label: '11 - November' },
  { value: '12', label: '12 - Desember' },
];

interface OverviewTabProps {
  items: ProcurementItem[];
  totalAllItems: number;
  searchKeyword?: string;
  onSearchKeywordChange?: (kw: string) => void;
  onOpenAudit: (fpb: string, po?: string) => void;
  onTriggerAiAudit: () => void;
}

type SortField = 'fpb' | 'po' | 'date' | 'item' | 'statusBadge' | 'lapse';
type SortDirection = 'asc' | 'desc';

export default function OverviewTab({
  items,
  totalAllItems,
  searchKeyword = '',
  onSearchKeywordChange,
  onOpenAudit,
  onTriggerAiAudit,
}: OverviewTabProps) {
  const [searchTerm, setSearchTerm] = useState(searchKeyword);
  const [selectedEntity, setSelectedEntity] = useState<string>('ALL');
  const [selectedLapse, setSelectedLapse] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');

  const [selectedYear, setSelectedYear] = useState<string>('ALL');
  const [selectedMonth, setSelectedMonth] = useState<string>('ALL');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  const [sortField, setSortField] = useState<SortField>('lapse');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  const [currentPage, setCurrentPage] = useState<number>(1);
  const itemsPerPage = 15;

  useEffect(() => {
    setSearchTerm(searchKeyword);
    setCurrentPage(1);
  }, [searchKeyword]);

  const handleSearchChange = (val: string) => {
    setSearchTerm(val);
    setCurrentPage(1);
    if (onSearchKeywordChange) {
      onSearchKeywordChange(val);
    }
  };

  const uniqueYears = useMemo(() => {
    const years = new Set<string>();
    items.forEach((item) => {
      const { year } = extractDateInfo(item.date);
      if (year && year.length === 4 && Number(year) > 2000 && Number(year) < 2100) {
        years.add(year);
      }
    });
    return Array.from(years).sort((a, b) => b.localeCompare(a));
  }, [items]);

  const uniqueStatuses = useMemo(() => {
    const s = new Set<string>();
    items.forEach((item) => {
      if (item.statusBadge) s.add(item.statusBadge);
    });
    return Array.from(s).sort();
  }, [items]);

  const counts = useMemo(() => {
    let critical = 0;
    let warning = 0;
    let normal = 0;
    items.forEach((item) => {
      if (item.lapse > 5) critical++;
      else if (item.lapse >= 3) warning++;
      else normal++;
    });
    return { critical, warning, normal };
  }, [items]);

  const filteredItems = useMemo(() => {
    return items.filter((row) => {
      if (selectedEntity !== 'ALL' && row.entity !== selectedEntity) return false;

      if (selectedLapse === 'CRITICAL' && row.lapse <= 5) return false;
      if (selectedLapse === 'WARNING' && (row.lapse < 3 || row.lapse > 5)) return false;
      if (selectedLapse === 'NORMAL' && row.lapse > 2) return false;

      if (selectedStatus !== 'ALL' && row.statusBadge !== selectedStatus) return false;

      const { year, month, fullDate, timestamp } = extractDateInfo(row.date);

      if (selectedYear !== 'ALL' && year !== selectedYear) return false;
      if (selectedMonth !== 'ALL' && month !== selectedMonth) return false;

      if (startDate && timestamp > 0) {
        const startTs = new Date(`${startDate}T00:00:00`).getTime();
        if (timestamp < startTs) return false;
      }
      if (endDate && timestamp > 0) {
        const endTs = new Date(`${endDate}T23:59:59`).getTime();
        if (timestamp > endTs) return false;
      }

      if (searchTerm.trim() !== '') {
        const q = searchTerm.toLowerCase().trim();
        const fpbMatch = row.fpb?.toLowerCase().includes(q);
        const poMatch = row.po?.toLowerCase().includes(q);
        const itemMatch = row.item?.toLowerCase().includes(q);
        const peruntukanMatch = row.peruntukan?.toLowerCase().includes(q);
        const armadaMatch = row.deptArmada?.toLowerCase().includes(q);
        const picMatch =
          row.picPch?.toLowerCase().includes(q) ||
          row.picTtb?.toLowerCase().includes(q) ||
          row.picLap?.toLowerCase().includes(q) ||
          row.picAktif?.toLowerCase().includes(q);
        const statusMatch = row.statusBadge?.toLowerCase().includes(q);
        if (!fpbMatch && !poMatch && !itemMatch && !peruntukanMatch && !armadaMatch && !picMatch && !statusMatch) {
          return false;
        }
      }

      return true;
    });
  }, [
    items,
    selectedEntity,
    selectedLapse,
    selectedStatus,
    selectedYear,
    selectedMonth,
    startDate,
    endDate,
    searchTerm,
  ]);

  const sortedItems = useMemo(() => {
    return [...filteredItems].sort((a, b) => {
      let aVal: any = a[sortField];
      let bVal: any = b[sortField];

      if (sortField === 'date') {
        const aTs = extractDateInfo(a.date).timestamp;
        const bTs = extractDateInfo(b.date).timestamp;
        return sortDirection === 'asc' ? aTs - bTs : bTs - aTs;
      }

      if (sortField === 'lapse') {
        return sortDirection === 'asc' ? (a.lapse || 0) - (b.lapse || 0) : (b.lapse || 0) - (a.lapse || 0);
      }

      aVal = String(aVal || '').toLowerCase();
      bVal = String(bVal || '').toLowerCase();
      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }, [filteredItems, sortField, sortDirection]);

  const totalPages = Math.ceil(sortedItems.length / itemsPerPage) || 1;
  const paginatedItems = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return sortedItems.slice(start, start + itemsPerPage);
  }, [sortedItems, currentPage]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection(field === 'lapse' || field === 'date' ? 'desc' : 'asc');
    }
    setCurrentPage(1);
  };

  const handleResetFilters = () => {
    handleSearchChange('');
    setSelectedEntity('ALL');
    setSelectedLapse('ALL');
    setSelectedStatus('ALL');
    setSelectedYear('ALL');
    setSelectedMonth('ALL');
    setStartDate('');
    setEndDate('');
    setSortField('lapse');
    setSortDirection('desc');
    setCurrentPage(1);
  };

  const isFiltered =
    searchTerm.trim() !== '' ||
    selectedEntity !== 'ALL' ||
    selectedLapse !== 'ALL' ||
    selectedStatus !== 'ALL' ||
    selectedYear !== 'ALL' ||
    selectedMonth !== 'ALL' ||
    startDate !== '' ||
    endDate !== '';

  const toneStyles: Record<StatusTone, string> = {
    emerald: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    cyan: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
    purple: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
    amber: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    rose: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
  };

  return (
    <div className="space-y-6">
      {/* ═══════════════════════════════════════════════════════════
          CHARTS SECTION (studio-admin Customer Activity Card Style)
          ═══════════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Chart 1: Pipeline Timeline Bar Chart */}
        <div className="rounded-xl border border-border bg-card p-4.5 text-card-foreground shadow-xs ring-1 ring-border/50 lg:col-span-2 flex flex-col justify-between">
          <div className="flex items-center justify-between border-b border-border pb-3">
            <div>
              <div className="font-heading text-sm font-medium text-foreground">
                Customer Activity &bull; Milestone Fisik Berkas
              </div>
              <div className="text-xs text-muted-foreground mt-0.5">
                Pemantauan posisi antrian dokumen dari PO hingga Divisi Keuangan
              </div>
            </div>
            <button
              onClick={onTriggerAiAudit}
              disabled={items.length === 0}
              className="inline-flex items-center gap-1.5 rounded-lg border border-purple-500/30 bg-purple-950/40 px-2.5 py-1 text-xs font-medium text-purple-300 hover:bg-purple-900/50 transition active:scale-95 disabled:opacity-40"
            >
              <Sparkles className="size-3 text-amber-300" />
              <span>Audit Cerdas AI</span>
            </button>
          </div>

          <div className="h-64 pt-4 relative">
            <PipelineBarChart data={items} />
          </div>

          <div className="mt-3 pt-3 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-cyan-400"></span>
              Alur: PO &rarr; TTB Logistik &rarr; Lapangan &rarr; SPP &rarr; Keuangan
            </span>
            <span className="font-mono text-[11px] text-cyan-400">SLA Efektif: &le; 5 Hari</span>
          </div>
        </div>

        {/* Chart 2: Entitas Donut Chart */}
        <div className="rounded-xl border border-border bg-card p-4.5 text-card-foreground shadow-xs ring-1 ring-border/50 flex flex-col justify-between">
          <div className="border-b border-border pb-3">
            <div className="font-heading text-sm font-medium text-foreground">
              Distribusi Entitas CPG
            </div>
            <div className="text-xs text-muted-foreground mt-0.5">
              Komposisi berkas terdistribusi di 7 anak perusahaan
            </div>
          </div>

          <div className="h-56 relative flex items-center justify-center my-auto">
            <EntityDonutChart data={items} />
          </div>

          <div className="grid grid-cols-3 gap-1.5 text-center text-xs pt-3 border-t border-border font-mono">
            <div className="p-1 rounded-md bg-muted/40 border border-border">
              <span className="text-cyan-400 font-bold">CPL:</span> {items.filter((i) => i.entity === 'CPL').length}
            </div>
            <div className="p-1 rounded-md bg-muted/40 border border-border">
              <span className="text-blue-400 font-bold">PPI:</span> {items.filter((i) => i.entity === 'PPI').length}
            </div>
            <div className="p-1 rounded-md bg-muted/40 border border-border">
              <span className="text-amber-400 font-bold">GAJ:</span> {items.filter((i) => i.entity === 'GAJ').length}
            </div>
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════
          DATA TABLE CARD (studio-admin 18,426 Customers Style)
          ═══════════════════════════════════════════════════════════ */}
      <div className="rounded-xl border border-border bg-card text-card-foreground shadow-xs ring-1 ring-border/50 overflow-hidden">
        {/* Card Header */}
        <div className="p-4.5 border-b border-border flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="font-heading text-base font-semibold text-foreground flex items-center gap-2">
              <span>{sortedItems.length.toLocaleString()} Berkas Pengadaan & Armada</span>
              {isFiltered && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
                  Terfilter ({items.length} total)
                </span>
              )}
            </div>
            <div className="text-xs text-muted-foreground mt-0.5">
              Daftar berkas terintegrasi dengan alur PIC, PO, SLA, dan status pemenuhan logistik.
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isFiltered && (
              <button
                onClick={handleResetFilters}
                className="inline-flex h-8 items-center gap-1 rounded-lg border border-border bg-background px-2.5 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition"
              >
                <RotateCcw className="size-3" />
                <span>Reset Filter</span>
              </button>
            )}
          </div>
        </div>

        {/* Toolbar Controls */}
        <div className="p-3.5 border-b border-border bg-muted/20 flex flex-col xl:flex-row items-stretch xl:items-center justify-between gap-2.5">
          {/* Search Input */}
          <div className="relative flex-1 min-w-[260px] max-w-md">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => handleSearchChange(e.target.value)}
              placeholder="Search berkas, FPB, PO, nama barang, PIC..."
              className="h-8 w-full rounded-lg border border-border bg-background pl-8 pr-7 text-xs text-foreground placeholder:text-muted-foreground outline-none focus:border-zinc-500 transition"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => handleSearchChange('')}
                className="absolute top-1/2 right-2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="size-3" />
              </button>
            )}
          </div>

          {/* Filter Dropdowns and Buttons */}
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            {/* Status Select */}
            <select
              value={selectedStatus}
              onChange={(e) => {
                setSelectedStatus(e.target.value);
                setCurrentPage(1);
              }}
              className="h-8 rounded-lg border border-border bg-background px-2.5 text-xs text-foreground outline-none cursor-pointer hover:bg-muted transition"
            >
              <option value="ALL">Semua Status</option>
              {uniqueStatuses.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>

            {/* Lapse Filter Buttons */}
            <button
              onClick={() => {
                setSelectedLapse((prev) => (prev === 'CRITICAL' ? 'ALL' : 'CRITICAL'));
                setCurrentPage(1);
              }}
              className={`h-8 px-2.5 rounded-lg border text-xs font-medium inline-flex items-center gap-1 transition ${
                selectedLapse === 'CRITICAL'
                  ? 'border-rose-500/50 bg-rose-950/60 text-rose-300'
                  : 'border-border bg-background hover:bg-muted text-muted-foreground'
              }`}
            >
              <span className="size-1.5 rounded-full bg-rose-400"></span>
              <span>Kritis ({counts.critical})</span>
            </button>

            <button
              onClick={() => {
                setSelectedLapse((prev) => (prev === 'WARNING' ? 'ALL' : 'WARNING'));
                setCurrentPage(1);
              }}
              className={`h-8 px-2.5 rounded-lg border text-xs font-medium inline-flex items-center gap-1 transition ${
                selectedLapse === 'WARNING'
                  ? 'border-amber-500/50 bg-amber-950/60 text-amber-300'
                  : 'border-border bg-background hover:bg-muted text-muted-foreground'
              }`}
            >
              <span className="size-1.5 rounded-full bg-amber-400"></span>
              <span>Perhatian ({counts.warning})</span>
            </button>

            {/* Tahun Filter */}
            {uniqueYears.length > 0 && (
              <select
                value={selectedYear}
                onChange={(e) => {
                  setSelectedYear(e.target.value);
                  setCurrentPage(1);
                }}
                className="h-8 rounded-lg border border-border bg-background px-2 text-xs text-foreground outline-none cursor-pointer hover:bg-muted transition font-mono"
              >
                <option value="ALL">Semua Tahun</option>
                {uniqueYears.map((yr) => (
                  <option key={yr} value={yr}>
                    {yr}
                  </option>
                ))}
              </select>
            )}

            {/* Bulan Filter */}
            <select
              value={selectedMonth}
              onChange={(e) => {
                setSelectedMonth(e.target.value);
                setCurrentPage(1);
              }}
              className="h-8 rounded-lg border border-border bg-background px-2 text-xs text-foreground outline-none cursor-pointer hover:bg-muted transition"
            >
              {MONTH_OPTIONS.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Table Container */}
        <div className="relative w-full overflow-x-auto">
          <table className="w-full text-left text-xs text-foreground">
            <thead className="bg-muted/30 border-b border-border text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
              <tr>
                <th
                  className="p-3 cursor-pointer hover:text-foreground select-none transition"
                  onClick={() => handleSort('fpb')}
                >
                  <div className="flex items-center gap-1">
                    <span>Berkas & Entitas</span>
                    {sortField === 'fpb' && (
                      <span className="text-primary">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </div>
                </th>
                <th
                  className="p-3 cursor-pointer hover:text-foreground select-none transition"
                  onClick={() => handleSort('po')}
                >
                  <div className="flex items-center gap-1">
                    <span>Nomor PO</span>
                    {sortField === 'po' && (
                      <span className="text-primary">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </div>
                </th>
                <th
                  className="p-3 cursor-pointer hover:text-foreground select-none transition"
                  onClick={() => handleSort('date')}
                >
                  <div className="flex items-center gap-1">
                    <span>Tanggal PO</span>
                    {sortField === 'date' && (
                      <span className="text-primary">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </div>
                </th>
                <th
                  className="p-3 cursor-pointer hover:text-foreground select-none transition"
                  onClick={() => handleSort('item')}
                >
                  <div className="flex items-center gap-1">
                    <span>Deskripsi Barang & Peruntukan</span>
                    {sortField === 'item' && (
                      <span className="text-primary">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </div>
                </th>
                <th
                  className="p-3 cursor-pointer hover:text-foreground select-none transition"
                  onClick={() => handleSort('statusBadge')}
                >
                  <div className="flex items-center gap-1">
                    <span>Status Berkas & PIC</span>
                    {sortField === 'statusBadge' && (
                      <span className="text-primary">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </div>
                </th>
                <th
                  className="p-3 text-center cursor-pointer hover:text-foreground select-none transition"
                  onClick={() => handleSort('lapse')}
                >
                  <div className="flex items-center justify-center gap-1">
                    <span>Lapse SLA</span>
                    {sortField === 'lapse' && (
                      <span className="text-primary">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </div>
                </th>
                <th className="p-3 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {items.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-10 text-center text-muted-foreground">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <FileSpreadsheet className="size-8 opacity-30 text-muted-foreground" />
                      <p className="text-sm font-medium text-foreground">Belum ada data monitoring</p>
                      <p className="text-xs text-muted-foreground">
                        Gunakan tombol &quot;Unggah Excel&quot; di bagian atas untuk memasukkan data Anda.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : paginatedItems.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-10 text-center text-muted-foreground">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Search className="size-8 opacity-30 text-muted-foreground" />
                      <p className="text-sm font-medium text-foreground">Tidak ada berkas yang cocok</p>
                      <button
                        onClick={handleResetFilters}
                        className="mt-2 h-7 px-3 rounded-lg border border-border bg-background text-xs font-medium hover:bg-muted transition"
                      >
                        Reset Filter
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedItems.map((row) => {
                  const badgeClass = toneStyles[row.statusTone] || toneStyles.cyan;
                  const lapseBadgeClass =
                    row.lapse <= 2
                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                      : row.lapse <= 5
                      ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                      : 'bg-rose-500/10 text-rose-400 border-rose-500/20';

                  return (
                    <tr
                      key={row.id || `${row.fpb}-${row.po}-${row.item}-${row.date}`}
                      onClick={() => onOpenAudit(row.fpb, row.po)}
                      className="hover:bg-muted/40 transition cursor-pointer group"
                    >
                      {/* FPB & Entitas */}
                      <td className="p-3">
                        <div className="flex items-center gap-2.5">
                          <div className="flex size-7.5 shrink-0 items-center justify-center rounded-lg border border-border bg-muted/60 text-muted-foreground">
                            <FileText className="size-3.5 text-cyan-400" />
                          </div>
                          <div>
                            <div className="font-mono font-semibold text-xs text-foreground group-hover:text-cyan-400 transition flex items-center gap-1">
                              <span>{row.fpb}</span>
                              <ExternalLink className="size-3 opacity-0 group-hover:opacity-100 transition" />
                            </div>
                            <span className="inline-block mt-0.5 px-1.5 py-0.2 rounded text-[10px] font-mono font-medium bg-muted border border-border text-muted-foreground">
                              {row.entity}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* PO Number */}
                      <td className="p-3 font-mono text-xs">
                        {row.po && row.po !== '-' ? (
                          <span className="font-semibold text-foreground">{row.po}</span>
                        ) : (
                          <span className="text-muted-foreground italic text-[11px]">- (Kosong)</span>
                        )}
                      </td>

                      {/* Date */}
                      <td className="p-3 font-mono text-xs text-muted-foreground">{row.date}</td>

                      {/* Item Description */}
                      <td className="p-3 max-w-[280px]">
                        <div className="font-medium text-xs text-foreground flex items-center gap-1.5 flex-wrap">
                          <span>{row.item}</span>
                          {row.qtyFPB !== undefined && row.qtyFPB > 0 && (
                            <span className="px-1.5 py-0.2 rounded-md bg-muted border border-border text-[10px] font-mono text-muted-foreground">
                              {row.qtyFPB} {row.satuan || ''}
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-muted-foreground mt-0.5 leading-snug">
                          {row.deptArmada && (
                            <span className="text-cyan-400 font-medium mr-1">
                              [{row.deptArmada}]
                            </span>
                          )}
                          {row.peruntukan && row.peruntukan !== '-' ? (
                            <span>{row.peruntukan}</span>
                          ) : (
                            <span className="italic text-muted-foreground/60">-</span>
                          )}
                        </div>
                      </td>

                      {/* Status & PIC */}
                      <td className="p-3">
                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${badgeClass}`}
                            >
                              {row.statusBadge || 'TERDATA'}
                            </span>
                            <span className="px-1.5 py-0.2 rounded-md bg-muted border border-border text-muted-foreground text-[10px] font-medium flex items-center gap-1">
                              <UserCheck className="size-3 text-cyan-400" />
                              <span>{row.picAktif || row.picPch}</span>
                            </span>
                          </div>
                          <div className="text-[11px] text-muted-foreground leading-tight">
                            {row.statusPenjelasan || 'Dalam alur proses'}
                          </div>
                        </div>
                      </td>

                      {/* Lapse SLA */}
                      <td className="p-3 text-center">
                        <span
                          className={`inline-flex items-center justify-center px-2 py-0.5 rounded-full font-mono text-[11px] font-bold border ${lapseBadgeClass}`}
                        >
                          {row.lapse} Hari
                        </span>
                      </td>

                      {/* Action */}
                      <td className="p-3 text-center">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onOpenAudit(row.fpb, row.po);
                          }}
                          className="h-7 px-2.5 rounded-lg border border-border bg-background hover:bg-muted text-xs font-medium text-foreground inline-flex items-center gap-1 transition shadow-xs active:scale-95"
                        >
                          <span>Verifikasi</span>
                          <ExternalLink className="size-3 text-muted-foreground" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        {sortedItems.length > 0 && (
          <div className="p-3.5 border-t border-border bg-muted/10 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-muted-foreground">
            <div>
              Menampilkan{' '}
              <strong className="text-foreground">
                {(currentPage - 1) * itemsPerPage + 1}
              </strong>{' '}
              hingga{' '}
              <strong className="text-foreground">
                {Math.min(currentPage * itemsPerPage, sortedItems.length)}
              </strong>{' '}
              dari <strong className="text-foreground">{sortedItems.length.toLocaleString()}</strong> berkas
            </div>

            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setCurrentPage(1)}
                disabled={currentPage === 1}
                className="size-7 rounded-lg border border-border bg-background hover:bg-muted disabled:opacity-40 flex items-center justify-center transition"
                title="Halaman Pertama"
              >
                <ChevronsLeft className="size-3.5" />
              </button>
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="size-7 rounded-lg border border-border bg-background hover:bg-muted disabled:opacity-40 flex items-center justify-center transition"
                title="Halaman Sebelumnya"
              >
                <ChevronLeft className="size-3.5" />
              </button>

              <span className="px-2 font-mono text-foreground font-semibold">
                {currentPage} / {totalPages}
              </span>

              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="size-7 rounded-lg border border-border bg-background hover:bg-muted disabled:opacity-40 flex items-center justify-center transition"
                title="Halaman Selanjutnya"
              >
                <ChevronRight className="size-3.5" />
              </button>
              <button
                onClick={() => setCurrentPage(totalPages)}
                disabled={currentPage === totalPages}
                className="size-7 rounded-lg border border-border bg-background hover:bg-muted disabled:opacity-40 flex items-center justify-center transition"
                title="Halaman Terakhir"
              >
                <ChevronsRight className="size-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
