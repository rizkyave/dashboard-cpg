'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { ArmadaItem } from '@/types/procurement';
import {
  Anchor,
  Search,
  Filter,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  RotateCcw,
  ExternalLink,
  AlertTriangle,
  CheckCircle2,
  Boxes,
  Layers,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  X,
  Calendar,
  CalendarDays,
  CalendarRange,
} from 'lucide-react';

interface ArmadaTabProps {
  items: ArmadaItem[];
  searchKeyword?: string;
  onSearchKeywordChange?: (kw: string) => void;
  onOpenAudit?: (fpb: string, po?: string) => void;
  initialEntity?: string;
}

// Helper: Extract date information accurately (Year, Month, Full Date, Timestamp)
const extractDateInfo = (dateStr?: string) => {
  if (!dateStr) return { year: '', month: '', fullDate: '', timestamp: 0 };
  const str = dateStr.trim();
  // Format YYYY-MM-DD
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
  // Format DD/MM/YYYY
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
  // Format YYYY/MM/DD
  const slashIsoMatch = str.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})/);
  if (slashIsoMatch) {
    const year = slashIsoMatch[1];
    const month = slashIsoMatch[2].padStart(2, '0');
    const day = slashIsoMatch[3].padStart(2, '0');
    return {
      year,
      month,
      fullDate: `${year}-${month}-${day}`,
      timestamp: new Date(`${year}-${month}-${day}T00:00:00`).getTime(),
    };
  }
  // Fallback: try Date.parse
  const parsed = Date.parse(str);
  if (!isNaN(parsed)) {
    const d = new Date(parsed);
    const year = d.getFullYear().toString();
    const month = (d.getMonth() + 1).toString().padStart(2, '0');
    const day = d.getDate().toString().padStart(2, '0');
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

type SortField = 'fpb' | 'armada' | 'item' | 'qtyFPB' | 'qtyFSTB' | 'selisih' | 'status' | 'date';
type StatusFilterType = 'ALL' | 'BACKLOG' | 'LENGKAP' | 'PARSIAL';

export default function ArmadaTab({
  items,
  searchKeyword,
  onSearchKeywordChange,
  onOpenAudit,
  initialEntity = 'ALL',
}: ArmadaTabProps) {
  // Filters state
  const [searchTerm, setSearchTerm] = useState<string>(searchKeyword || '');
  const [statusFilter, setStatusFilter] = useState<StatusFilterType>('ALL');
  const [entityFilter, setEntityFilter] = useState<string>(initialEntity);
  const [armadaFilter, setArmadaFilter] = useState<string>('ALL');

  // Date / Month / Year Filters
  const [selectedYear, setSelectedYear] = useState<string>('ALL');
  const [selectedMonth, setSelectedMonth] = useState<string>('ALL');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  useEffect(() => {
    if (searchKeyword !== undefined) {
      setSearchTerm(searchKeyword);
    }
  }, [searchKeyword]);

  const handleSearchChange = (val: string) => {
    setSearchTerm(val);
    onSearchKeywordChange?.(val);
  };

  // Sorting state
  const [sortField, setSortField] = useState<SortField>('selisih');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  // Pagination state
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(50);

  // Sync initialEntity if changed from parent
  useEffect(() => {
    if (initialEntity) {
      setEntityFilter(initialEntity);
    }
  }, [initialEntity]);

  // Reset to page 1 whenever any filter/sort changes
  useEffect(() => {
    setCurrentPage(1);
  }, [
    searchTerm,
    statusFilter,
    entityFilter,
    armadaFilter,
    selectedYear,
    selectedMonth,
    startDate,
    endDate,
    sortField,
    sortDirection,
    pageSize,
  ]);

  // Overall KPI Metrics for the dataset
  const metrics = useMemo(() => {
    let totalQtyFPB = 0;
    let totalQtyFSTB = 0;
    let totalBacklogQty = 0;
    let backlogItemCount = 0;
    let completeItemCount = 0;
    let partialItemCount = 0;

    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      totalQtyFPB += it.qtyFPB;
      totalQtyFSTB += it.qtyFSTB;
      totalBacklogQty += it.selisih;
      if (it.selisih === 0 && it.qtyFSTB > 0) {
        completeItemCount++;
      } else if (it.qtyFSTB > 0 && it.selisih > 0) {
        partialItemCount++;
        backlogItemCount++;
      } else {
        backlogItemCount++;
      }
    }

    return {
      totalItems: items.length,
      totalQtyFPB,
      totalQtyFSTB,
      totalBacklogQty,
      backlogItemCount,
      completeItemCount,
      partialItemCount,
    };
  }, [items]);

  // Extract unique Entities from data
  const uniqueEntities = useMemo(() => {
    const set = new Set<string>();
    for (const item of items) {
      if (item.entity) set.add(item.entity.trim().toUpperCase());
    }
    return Array.from(set).sort();
  }, [items]);

  // Extract unique Armada units from data
  const uniqueArmadas = useMemo(() => {
    const set = new Set<string>();
    for (const item of items) {
      if (item.armada) set.add(item.armada.trim());
    }
    return Array.from(set).sort();
  }, [items]);

  // Extract unique Years from dataset (from tglPo or tglFpb)
  const uniqueYears = useMemo(() => {
    const set = new Set<string>();
    for (const item of items) {
      const info = extractDateInfo(item.tglPo || item.tglFpb);
      if (info.year && info.year.length === 4) {
        set.add(info.year);
      }
    }
    return Array.from(set).sort((a, b) => b.localeCompare(a));
  }, [items]);

  // Filter items based on active criteria
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      // 1. Status Filter
      if (statusFilter === 'BACKLOG' && item.selisih <= 0) return false;
      if (statusFilter === 'LENGKAP' && (item.selisih > 0 || item.qtyFSTB === 0)) return false;
      if (statusFilter === 'PARSIAL' && !item.status.toUpperCase().includes('PARSIAL')) return false;

      // 2. Entity Filter
      if (entityFilter !== 'ALL' && item.entity?.trim().toUpperCase() !== entityFilter) {
        return false;
      }

      // 3. Armada Filter
      if (armadaFilter !== 'ALL' && item.armada?.trim() !== armadaFilter) {
        return false;
      }

      // 4. Date, Month, Year & Date Range Filters
      if (selectedYear !== 'ALL' || selectedMonth !== 'ALL' || startDate || endDate) {
        const dateInfo = extractDateInfo(item.tglPo || item.tglFpb);
        if (selectedYear !== 'ALL' && dateInfo.year !== selectedYear) {
          return false;
        }
        if (selectedMonth !== 'ALL' && dateInfo.month !== selectedMonth) {
          return false;
        }
        if (startDate && dateInfo.fullDate && dateInfo.fullDate < startDate) {
          return false;
        }
        if (endDate && dateInfo.fullDate && dateInfo.fullDate > endDate) {
          return false;
        }
        if ((startDate || endDate || selectedMonth !== 'ALL' || selectedYear !== 'ALL') && !dateInfo.fullDate) {
          return false;
        }
      }

      // 5. Keyword Search
      if (searchTerm.trim() !== '') {
        const q = searchTerm.toLowerCase().trim();
        const matchFpb = item.fpb?.toLowerCase().includes(q);
        const matchArmada = item.armada?.toLowerCase().includes(q);
        const matchItem = item.item?.toLowerCase().includes(q);
        const matchKet = item.keterangan?.toLowerCase().includes(q);
        const matchKode = item.kodeBarang?.toLowerCase().includes(q);
        const matchPo = item.noPo?.toLowerCase().includes(q);
        const matchFstb = item.noFstb?.toLowerCase().includes(q);
        const matchTtb = item.noTtb?.toLowerCase().includes(q);
        const matchSatuan = item.satuan?.toLowerCase().includes(q);
        const matchStatus = item.status?.toLowerCase().includes(q);

        if (
          !matchFpb &&
          !matchArmada &&
          !matchItem &&
          !matchKet &&
          !matchKode &&
          !matchPo &&
          !matchFstb &&
          !matchTtb &&
          !matchSatuan &&
          !matchStatus
        ) {
          return false;
        }
      }

      return true;
    });
  }, [
    items,
    statusFilter,
    entityFilter,
    armadaFilter,
    selectedYear,
    selectedMonth,
    startDate,
    endDate,
    searchTerm,
  ]);

  // Sort filtered items
  const sortedItems = useMemo(() => {
    const list = [...filteredItems];
    list.sort((a, b) => {
      // Sorting by date chronologically
      if (sortField === 'date') {
        const dateA = extractDateInfo(a.tglPo || a.tglFpb).timestamp;
        const dateB = extractDateInfo(b.tglPo || b.tglFpb).timestamp;
        return sortDirection === 'asc' ? dateA - dateB : dateB - dateA;
      }

      const aVal = a[sortField];
      const bVal = b[sortField];

      if (typeof aVal === 'string' && typeof bVal === 'string') {
        const cmp = aVal.localeCompare(bVal, undefined, { numeric: true, sensitivity: 'base' });
        return sortDirection === 'asc' ? cmp : -cmp;
      }

      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
      }

      return 0;
    });
    return list;
  }, [filteredItems, sortField, sortDirection]);

  // Pagination calculation
  const totalPages = Math.max(1, Math.ceil(sortedItems.length / pageSize));
  const paginatedItems = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sortedItems.slice(start, start + pageSize);
  }, [sortedItems, currentPage, pageSize]);

  // Sort column toggle handler
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  // Helper to render sort icon on table headers
  const renderSortIndicator = (field: SortField) => {
    const isActive = sortField === field;
    return (
      <span
        className={`inline-flex items-center ml-1 p-0.5 rounded transition ${
          isActive ? 'text-foreground' : 'text-muted-foreground/60'
        }`}
      >
        {isActive ? (
          sortDirection === 'asc' ? (
            <ArrowUp className="w-3.5 h-3.5" />
          ) : (
            <ArrowDown className="w-3.5 h-3.5" />
          )
        ) : (
          <ArrowUpDown className="w-3 h-3 opacity-40" />
        )}
      </span>
    );
  };

  // Reset all filters
  const handleResetFilters = () => {
    handleSearchChange('');
    setStatusFilter('ALL');
    setEntityFilter('ALL');
    setArmadaFilter('ALL');
    setSelectedYear('ALL');
    setSelectedMonth('ALL');
    setStartDate('');
    setEndDate('');
    setSortField('selisih');
    setSortDirection('desc');
    setCurrentPage(1);
  };

  const isFiltered =
    searchTerm.trim() !== '' ||
    statusFilter !== 'ALL' ||
    entityFilter !== 'ALL' ||
    armadaFilter !== 'ALL' ||
    selectedYear !== 'ALL' ||
    selectedMonth !== 'ALL' ||
    Boolean(startDate) ||
    Boolean(endDate);

  return (
    <div className="space-y-4">
      {/* ═══════════════════════════════════════════════════════════
          1. HEADER & KPI CARDS
          ═══════════════════════════════════════════════════════════ */}
      <div className="rounded-xl border border-border bg-card text-card-foreground shadow-sm overflow-hidden">
        <div className="flex items-center justify-between p-5 border-b border-border flex-wrap gap-2">
          <div className="flex items-center gap-3">
            <div className="size-9 rounded-lg border border-border bg-muted/60 text-muted-foreground flex items-center justify-center">
              <Anchor className="w-4.5 h-4.5 text-foreground" />
            </div>
            <div>
              <h3 className="text-sm font-semibold tracking-tight text-foreground">
                Monitoring Layanan Armada & Stok Backlog
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Verifikasi pemenuhan QTY FPB diajukan vs QTY FSTB terealisasi, pemantauan selisih backlog, dan rincian peruntukan armada.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded-full px-2.5 py-0.5 text-xs font-mono border border-border bg-muted/60 text-muted-foreground">
              {items.length.toLocaleString()} Total Baris Item
            </span>
          </div>
        </div>

        {/* 4 KPI Summary Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 p-5 border-b border-border">
          <div className="p-3.5 rounded-xl bg-background border border-border flex items-center gap-3">
            <div className="size-9 rounded-lg bg-muted/60 text-muted-foreground flex items-center justify-center border border-border">
              <Boxes className="w-4.5 h-4.5" />
            </div>
            <div>
              <span className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider block">
                Total QTY Diminta (FPB)
              </span>
              <span className="text-base font-semibold text-foreground font-mono">
                {metrics.totalQtyFPB.toLocaleString()}
              </span>
              <span className="text-[10px] text-muted-foreground block">
                Unit barang dari {metrics.totalItems.toLocaleString()} item
              </span>
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-background border border-border flex items-center gap-3">
            <div className="size-9 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center border border-emerald-500/20">
              <CheckCircle2 className="w-4.5 h-4.5" />
            </div>
            <div>
              <span className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider block">
                Total QTY Dipenuhi (FSTB)
              </span>
              <span className="text-base font-semibold text-emerald-400 font-mono">
                {metrics.totalQtyFSTB.toLocaleString()}
              </span>
              <span className="text-[10px] text-emerald-500/80 block">
                {metrics.completeItemCount.toLocaleString()} item terpenuhi 100%
              </span>
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-background border border-border flex items-center gap-3">
            <div className="size-9 rounded-lg bg-rose-500/10 text-rose-400 flex items-center justify-center border border-rose-500/20">
              <AlertTriangle className="w-4.5 h-4.5" />
            </div>
            <div>
              <span className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider block">
                Total QTY Selisih Backlog
              </span>
              <span className="text-base font-semibold text-rose-400 font-mono">
                {metrics.totalBacklogQty.toLocaleString()}
              </span>
              <span className="text-[10px] text-rose-400/80 block">
                Qty fisik yang belum diterima armada
              </span>
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-background border border-border flex items-center gap-3">
            <div className="size-9 rounded-lg bg-amber-500/10 text-amber-400 flex items-center justify-center border border-amber-500/20">
              <Layers className="w-4.5 h-4.5" />
            </div>
            <div>
              <span className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider block">
                Item Menunggu Pemenuhan
              </span>
              <span className="text-base font-semibold text-amber-400 font-mono">
                {metrics.backlogItemCount.toLocaleString()}
              </span>
              <span className="text-[10px] text-amber-400/80 block">
                {metrics.partialItemCount.toLocaleString()} parsial &bull; sisanya belum ada FSTB
              </span>
            </div>
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════════
            2. FILTER & SORT CONTROL BAR
            ═══════════════════════════════════════════════════════════ */}
        <div className="p-4 bg-muted/20 border-b border-border space-y-3">
          <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
            {/* Search Input Form */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const input = e.currentTarget.querySelector('input');
                input?.blur();
              }}
              className="flex items-center gap-2 flex-1 min-w-[280px]"
            >
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.currentTarget.blur();
                    }
                  }}
                  placeholder="Cari FPB, Nama Kapal / Armada, Nama Barang, Tujuan / Keterangan, No PO..."
                  className="w-full h-8 pl-8 pr-7 bg-background border border-border rounded-lg text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring transition"
                />
                {searchTerm && (
                  <button
                    type="button"
                    onClick={() => handleSearchChange('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    title="Hapus kata kunci"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
              <button
                type="submit"
                className="h-8 px-3 rounded-lg border border-border bg-background hover:bg-muted text-xs font-medium text-foreground flex items-center gap-1.5 transition whitespace-nowrap"
                title="Tekan Enter atau klik untuk mencari"
              >
                <Search className="w-3.5 h-3.5" />
                <span>Cari</span>
              </button>
            </form>

            {/* Quick Status Filter Buttons */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 lg:pb-0 text-xs">
              <span className="text-muted-foreground text-[11px] font-medium mr-1 flex items-center gap-1">
                <Filter className="w-3.5 h-3.5 text-muted-foreground" />
                Status:
              </span>
              <button
                onClick={() => setStatusFilter('ALL')}
                className={`h-7 px-2.5 rounded-lg text-xs font-medium transition whitespace-nowrap border ${
                  statusFilter === 'ALL'
                    ? 'bg-foreground text-background border-foreground font-semibold'
                    : 'bg-background text-muted-foreground hover:text-foreground border-border hover:bg-muted'
                }`}
              >
                Semua ({items.length})
              </button>
              <button
                onClick={() => setStatusFilter('BACKLOG')}
                className={`h-7 px-2.5 rounded-lg text-xs font-medium transition whitespace-nowrap flex items-center gap-1.5 border ${
                  statusFilter === 'BACKLOG'
                    ? 'bg-rose-500/10 text-rose-400 border-rose-500/30 font-semibold'
                    : 'bg-background text-muted-foreground hover:text-foreground border-border hover:bg-muted'
                }`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
                <span>Hanya Backlog ({metrics.backlogItemCount})</span>
              </button>
              <button
                onClick={() => setStatusFilter('LENGKAP')}
                className={`h-7 px-2.5 rounded-lg text-xs font-medium transition whitespace-nowrap border ${
                  statusFilter === 'LENGKAP'
                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 font-semibold'
                    : 'bg-background text-muted-foreground hover:text-foreground border-border hover:bg-muted'
                }`}
              >
                Lengkap ({metrics.completeItemCount})
              </button>
              <button
                onClick={() => setStatusFilter('PARSIAL')}
                className={`h-7 px-2.5 rounded-lg text-xs font-medium transition whitespace-nowrap border ${
                  statusFilter === 'PARSIAL'
                    ? 'bg-amber-500/10 text-amber-400 border-amber-500/30 font-semibold'
                    : 'bg-background text-muted-foreground hover:text-foreground border-border hover:bg-muted'
                }`}
              >
                Parsial ({metrics.partialItemCount})
              </button>
            </div>
          </div>

          {/* Row 2: Filter Waktu (Tahun, Bulan, Rentang Tanggal) & Quick Sort Tanggal */}
          <div className="flex flex-wrap items-center justify-between gap-2.5 pt-2 border-t border-border/60 text-xs">
            <div className="flex flex-wrap items-center gap-2">
              {/* Tahun Filter */}
              <div className="flex items-center gap-1.5 bg-background h-8 px-2.5 rounded-lg border border-border">
                <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-muted-foreground text-[11px] font-medium">Tahun:</span>
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(e.target.value)}
                  className="bg-transparent text-foreground text-xs focus:outline-none font-mono cursor-pointer"
                >
                  <option value="ALL" className="bg-popover text-popover-foreground">
                    Semua ({uniqueYears.length})
                  </option>
                  {uniqueYears.map((yr) => (
                    <option key={yr} value={yr} className="bg-popover text-popover-foreground font-mono">
                      {yr}
                    </option>
                  ))}
                </select>
              </div>

              {/* Bulan Filter */}
              <div className="flex items-center gap-1.5 bg-background h-8 px-2.5 rounded-lg border border-border">
                <CalendarDays className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-muted-foreground text-[11px] font-medium">Bulan:</span>
                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="bg-transparent text-foreground text-xs focus:outline-none cursor-pointer"
                >
                  {MONTH_OPTIONS.map((m) => (
                    <option key={m.value} value={m.value} className="bg-popover text-popover-foreground">
                      {m.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Rentang Tanggal (Date Range) */}
              <div className="flex items-center gap-1.5 bg-background h-8 px-2.5 rounded-lg border border-border text-foreground">
                <CalendarRange className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-muted-foreground text-[11px]">Tgl:</span>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="bg-transparent text-foreground text-xs focus:outline-none font-mono cursor-pointer"
                  title="Dari Tanggal"
                />
                <span className="text-muted-foreground text-[11px]">&ndash;</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="bg-transparent text-foreground text-xs focus:outline-none font-mono cursor-pointer"
                  title="Sampai Tanggal"
                />
                {(startDate || endDate) && (
                  <button
                    type="button"
                    onClick={() => {
                      setStartDate('');
                      setEndDate('');
                    }}
                    className="text-muted-foreground hover:text-foreground ml-1"
                    title="Hapus filter rentang tanggal"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>

            {/* Quick Sorting Buttons by Tanggal */}
            <div className="flex items-center gap-1.5">
              <span className="text-muted-foreground text-[11px] mr-1 hidden sm:inline">Urut Tanggal:</span>
              <button
                type="button"
                onClick={() => {
                  setSortField('date');
                  setSortDirection('desc');
                }}
                className={`h-7 px-2.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition border ${
                  sortField === 'date' && sortDirection === 'desc'
                    ? 'bg-foreground text-background border-foreground font-semibold'
                    : 'bg-background text-muted-foreground hover:text-foreground border-border hover:bg-muted'
                }`}
                title="Urutkan tanggal terbaru di atas"
              >
                <ArrowDown className="w-3 h-3" />
                <span>Terbaru</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setSortField('date');
                  setSortDirection('asc');
                }}
                className={`h-7 px-2.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition border ${
                  sortField === 'date' && sortDirection === 'asc'
                    ? 'bg-foreground text-background border-foreground font-semibold'
                    : 'bg-background text-muted-foreground hover:text-foreground border-border hover:bg-muted'
                }`}
                title="Urutkan tanggal terlama di atas"
              >
                <ArrowUp className="w-3 h-3" />
                <span>Terlama</span>
              </button>
            </div>
          </div>

          {/* Row 3: Secondary Dropdown Filters & Sorting Shortcuts */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-border/60 text-xs">
            <div className="flex flex-wrap items-center gap-2">
              {/* Entitas / PT Filter */}
              {uniqueEntities.length > 0 && (
                <div className="flex items-center gap-1.5">
                  <span className="text-muted-foreground text-[11px]">PT:</span>
                  <select
                    value={entityFilter}
                    onChange={(e) => setEntityFilter(e.target.value)}
                    className="h-7 bg-background border border-border text-foreground text-xs rounded-lg px-2.5 focus:outline-none focus:ring-1 focus:ring-ring font-mono"
                  >
                    <option value="ALL">Semua PT ({uniqueEntities.length})</option>
                    {uniqueEntities.map((ent) => (
                      <option key={ent} value={ent} className="bg-popover text-popover-foreground">
                        {ent}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Kapal / Armada Filter */}
              {uniqueArmadas.length > 0 && (
                <div className="flex items-center gap-1.5">
                  <span className="text-muted-foreground text-[11px]">Kapal / Armada:</span>
                  <select
                    value={armadaFilter}
                    onChange={(e) => setArmadaFilter(e.target.value)}
                    className="h-7 bg-background border border-border text-foreground text-xs rounded-lg px-2.5 focus:outline-none focus:ring-1 focus:ring-ring max-w-[220px]"
                  >
                    <option value="ALL">Semua Kapal / Armada ({uniqueArmadas.length})</option>
                    {uniqueArmadas.map((arm) => (
                      <option key={arm} value={arm} className="bg-popover text-popover-foreground">
                        {arm}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Quick Sort Button: Largest Backlog */}
              <button
                onClick={() => {
                  setSortField('selisih');
                  setSortDirection('desc');
                }}
                className={`h-7 px-2.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition border ${
                  sortField === 'selisih' && sortDirection === 'desc'
                    ? 'bg-amber-500/10 text-amber-400 border-amber-500/30 font-semibold'
                    : 'bg-background text-muted-foreground hover:text-foreground border-border hover:bg-muted'
                }`}
                title="Urutkan backlog tertinggi di atas"
              >
                <ArrowDown className="w-3 h-3 text-amber-400" />
                <span>Backlog Terbanyak</span>
              </button>

              {/* Reset Filter Button */}
              {isFiltered && (
                <button
                  onClick={handleResetFilters}
                  className="h-7 px-2.5 rounded-lg text-xs font-medium text-rose-400 hover:text-rose-300 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 flex items-center gap-1 transition"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Reset Filter</span>
                </button>
              )}
            </div>

            {/* Results Counter & Active Sorting Indicator */}
            <div className="flex items-center gap-3 text-muted-foreground text-[11px]">
              <span>
                Menampilkan{' '}
                <strong className="text-foreground font-mono">
                  {sortedItems.length.toLocaleString()}
                </strong>{' '}
                dari {items.length.toLocaleString()} data
              </span>
              <span className="text-border">|</span>
              <span>
                Urutan:{' '}
                <strong className="text-foreground font-mono uppercase">
                  {sortField === 'date'
                    ? `Tanggal (${sortDirection === 'desc' ? 'Terbaru' : 'Terlama'})`
                    : sortField === 'selisih'
                    ? `Selisih Backlog (${sortDirection})`
                    : `${sortField} (${sortDirection})`}
                </strong>
              </span>
            </div>
          </div>

          {/* Active Search & Filter Notification */}
          {isFiltered && (
            <div className="flex items-center justify-between gap-2 px-3 py-1.5 rounded-lg bg-muted/50 border border-border text-xs flex-wrap">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-foreground font-mono font-medium">
                  Filter Aktif:
                </span>
                {searchTerm.trim() !== '' && (
                  <span className="px-2 py-0.5 rounded-full bg-background border border-border text-foreground font-mono text-[11px]">
                    Cari: &quot;{searchTerm}&quot;
                  </span>
                )}
                {selectedYear !== 'ALL' && (
                  <span className="px-2 py-0.5 rounded-full bg-background border border-border text-foreground font-mono text-[11px]">
                    Tahun: {selectedYear}
                  </span>
                )}
                {selectedMonth !== 'ALL' && (
                  <span className="px-2 py-0.5 rounded-full bg-background border border-border text-foreground font-mono text-[11px]">
                    Bulan: {MONTH_OPTIONS.find((m) => m.value === selectedMonth)?.label}
                  </span>
                )}
                {(startDate || endDate) && (
                  <span className="px-2 py-0.5 rounded-full bg-background border border-border text-foreground font-mono text-[11px]">
                    Rentang: {startDate || 'Awal'} s/d {endDate || 'Sekarang'}
                  </span>
                )}
                {statusFilter !== 'ALL' && (
                  <span className="px-2 py-0.5 rounded-full bg-background border border-border text-foreground font-mono text-[11px]">
                    Status: {statusFilter}
                  </span>
                )}
                {entityFilter !== 'ALL' && (
                  <span className="px-2 py-0.5 rounded-full bg-background border border-border text-foreground font-mono text-[11px]">
                    PT: {entityFilter}
                  </span>
                )}
                {armadaFilter !== 'ALL' && (
                  <span className="px-2 py-0.5 rounded-full bg-background border border-border text-foreground font-mono text-[11px]">
                    Armada: {armadaFilter}
                  </span>
                )}
                <span className="text-muted-foreground font-mono text-[11px]">
                  ({sortedItems.length} baris ditemukan)
                </span>
              </div>
              <button
                type="button"
                onClick={handleResetFilters}
                className="text-muted-foreground hover:text-foreground text-[11px] underline flex items-center gap-1 ml-auto"
              >
                <X className="w-3 h-3" />
                <span>Hapus Semua Filter</span>
              </button>
            </div>
          )}
        </div>

        {/* ═══════════════════════════════════════════════════════════
            3. INTERACTIVE DATA TABLE
            ═══════════════════════════════════════════════════════════ */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-foreground">
            <thead className="bg-muted/40 text-muted-foreground font-medium border-b border-border uppercase tracking-wider text-[11px] select-none">
              <tr>
                <th
                  onClick={() => handleSort('fpb')}
                  className="p-3.5 cursor-pointer hover:text-foreground transition group whitespace-nowrap"
                >
                  <span className="flex items-center">
                    NO FPB ASAL
                    {renderSortIndicator('fpb')}
                  </span>
                </th>
                <th
                  onClick={() => handleSort('armada')}
                  className="p-3.5 cursor-pointer hover:text-foreground transition group whitespace-nowrap"
                >
                  <span className="flex items-center">
                    NAMA KAPAL / ARMADA
                    {renderSortIndicator('armada')}
                  </span>
                </th>
                <th
                  onClick={() => handleSort('item')}
                  className="p-3.5 cursor-pointer hover:text-foreground transition group"
                >
                  <span className="flex items-center">
                    ITEM DESCRIPTION & KETERANGAN
                    {renderSortIndicator('item')}
                  </span>
                </th>
                <th
                  onClick={() => handleSort('qtyFPB')}
                  className="p-3.5 text-center cursor-pointer hover:text-foreground transition group whitespace-nowrap"
                >
                  <span className="flex items-center justify-center">
                    QTY FPB
                    {renderSortIndicator('qtyFPB')}
                  </span>
                </th>
                <th
                  onClick={() => handleSort('qtyFSTB')}
                  className="p-3.5 text-center cursor-pointer hover:text-foreground transition group whitespace-nowrap"
                >
                  <span className="flex items-center justify-center">
                    QTY FSTB
                    {renderSortIndicator('qtyFSTB')}
                  </span>
                </th>
                <th
                  onClick={() => handleSort('selisih')}
                  className="p-3.5 text-center cursor-pointer hover:text-foreground transition group whitespace-nowrap"
                >
                  <span className="flex items-center justify-center font-semibold">
                    SELISIH BACKLOG
                    {renderSortIndicator('selisih')}
                  </span>
                </th>
                <th
                  onClick={() => handleSort('status')}
                  className="p-3.5 text-center cursor-pointer hover:text-foreground transition group whitespace-nowrap"
                >
                  <span className="flex items-center justify-center">
                    STATUS PEMENUHAN
                    {renderSortIndicator('status')}
                  </span>
                </th>
                <th className="p-3.5 text-center whitespace-nowrap">AKSI</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {paginatedItems.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-10 text-center text-muted-foreground">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Anchor className="w-8 h-8 opacity-30 text-muted-foreground" />
                      <p className="text-sm font-medium text-foreground">
                        Tidak ada data yang sesuai filter
                      </p>
                      <p className="text-xs text-muted-foreground max-w-md">
                        Coba sesuaikan kata kunci pencarian, filter status, atau klik tombol Reset Filter di atas.
                      </p>
                      {isFiltered && (
                        <button
                          onClick={handleResetFilters}
                          className="mt-2 h-8 px-3 bg-muted hover:bg-muted/80 text-foreground border border-border rounded-lg text-xs font-medium transition"
                        >
                          Tampilkan Semua Data
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedItems.map((row, idx) => {
                  const isComplete = row.selisih === 0;
                  const isPartial = row.selisih > 0 && row.qtyFSTB > 0;

                  return (
                    <tr
                      key={`${row.fpb}-${row.item}-${idx}`}
                      className="hover:bg-muted/30 transition group"
                    >
                      {/* No FPB, Entity Tag & Tanggal */}
                      <td className="p-3.5 whitespace-nowrap font-mono">
                        <button
                          onClick={() => onOpenAudit && onOpenAudit(row.fpb, row.noPo)}
                          className="font-medium text-foreground hover:underline flex items-center gap-1"
                          title="Buka audit modal FPB"
                        >
                          <span>{row.fpb}</span>
                          <ExternalLink className="w-3 h-3 text-muted-foreground group-hover:text-foreground transition-colors" />
                        </button>
                        <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                          {row.entity && (
                            <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-mono bg-muted text-muted-foreground border border-border">
                              {row.entity}
                            </span>
                          )}
                          {(row.tglPo || row.tglFpb) && (
                            <span className="text-[10px] text-muted-foreground font-mono">
                              {row.tglPo || row.tglFpb}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Nama Kapal & Peruntukan Keterangan */}
                      <td className="p-3.5 max-w-[240px]">
                        <div className="text-foreground font-medium flex items-center gap-1.5">
                          <Anchor className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                          <span>{row.armada}</span>
                        </div>
                        {row.keterangan && (
                          <div className="text-[11px] text-muted-foreground font-mono mt-1 leading-snug pl-5">
                            {row.keterangan}
                          </div>
                        )}
                      </td>

                      {/* Item Description */}
                      <td className="p-3.5 max-w-[280px]">
                        <div className="text-foreground font-medium">{row.item}</div>
                        <div className="flex items-center gap-2 mt-0.5 text-[10px] text-muted-foreground font-mono flex-wrap">
                          {row.kodeBarang && <span>Kode: {row.kodeBarang}</span>}
                          {row.satuan && <span>&bull; {row.satuan}</span>}
                          {row.noPo && <span>&bull; PO: {row.noPo}</span>}
                          {row.picPch && row.picPch !== '-' && (
                            <span className="text-foreground font-medium">&bull; PIC: {row.picPch}</span>
                          )}
                        </div>
                      </td>

                      {/* Qty FPB */}
                      <td className="p-3.5 text-center text-foreground font-mono font-medium">
                        {row.qtyFPB.toLocaleString()}
                      </td>

                      {/* Qty FSTB */}
                      <td className="p-3.5 text-center text-muted-foreground font-mono">
                        {row.qtyFSTB.toLocaleString()}
                      </td>

                      {/* Selisih Backlog */}
                      <td
                        className={`p-3.5 text-center font-mono font-semibold text-sm ${
                          isComplete
                            ? 'text-emerald-700 dark:text-emerald-400'
                            : isPartial
                            ? 'text-amber-700 dark:text-amber-400'
                            : 'text-rose-700 dark:text-rose-400'
                        }`}
                      >
                        {row.selisih.toLocaleString()}
                      </td>

                      {/* Status Pemenuhan & Alur Berkas Procurement */}
                      <td className="p-3.5 text-center whitespace-nowrap">
                        <div className="space-y-1">
                          <span
                            className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-medium border ${
                              isComplete
                                ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20'
                                : isPartial
                                ? 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20'
                                : 'bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/20'
                            }`}
                          >
                            {row.status}
                          </span>
                          {row.statusBadge && (
                            <div>
                              <span className="inline-block px-1.5 py-0.5 rounded text-[9px] font-mono bg-muted text-muted-foreground border border-border font-medium">
                                {row.statusBadge}
                              </span>
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Action Button */}
                      <td className="p-3.5 text-center whitespace-nowrap">
                        {onOpenAudit && (
                          <button
                            onClick={() => onOpenAudit(row.fpb, row.noPo)}
                            className="h-7 px-2.5 bg-background hover:bg-muted text-foreground border border-border rounded-lg text-xs font-medium transition"
                            title="Audit Akuntabilitas 4 Sheet"
                          >
                            Audit
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* ═══════════════════════════════════════════════════════════
            4. PAGINATION FOOTER
            ═══════════════════════════════════════════════════════════ */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-4 border-t border-border text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <span>Baris per halaman:</span>
            <select
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value))}
              className="h-7 bg-background border border-border text-foreground rounded-lg px-2 focus:outline-none focus:ring-1 focus:ring-ring font-mono"
            >
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
              <option value={200}>200</option>
            </select>
            <span className="text-muted-foreground/80">
              (Menampilkan{' '}
              {sortedItems.length > 0 ? (currentPage - 1) * pageSize + 1 : 0} -{' '}
              {Math.min(currentPage * pageSize, sortedItems.length)} dari{' '}
              {sortedItems.length.toLocaleString()})
            </span>
          </div>

          {/* Page controls */}
          <div className="flex items-center gap-1 font-mono">
            <button
              onClick={() => setCurrentPage(1)}
              disabled={currentPage === 1}
              className="h-8 w-8 rounded-lg bg-background hover:bg-muted text-foreground disabled:opacity-30 disabled:pointer-events-none border border-border flex items-center justify-center transition"
              title="Halaman Pertama"
            >
              <ChevronsLeft className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="h-8 w-8 rounded-lg bg-background hover:bg-muted text-foreground disabled:opacity-30 disabled:pointer-events-none border border-border flex items-center justify-center transition"
              title="Halaman Sebelumnya"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>

            <span className="px-3 h-8 flex items-center rounded-lg border border-border bg-muted/40 text-foreground text-xs">
              Hal {currentPage} / {totalPages}
            </span>

            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="h-8 w-8 rounded-lg bg-background hover:bg-muted text-foreground disabled:opacity-30 disabled:pointer-events-none border border-border flex items-center justify-center transition"
              title="Halaman Berikutnya"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setCurrentPage(totalPages)}
              disabled={currentPage === totalPages}
              className="h-8 w-8 rounded-lg bg-background hover:bg-muted text-foreground disabled:opacity-30 disabled:pointer-events-none border border-border flex items-center justify-center transition"
              title="Halaman Terakhir"
            >
              <ChevronsRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
