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
          isActive ? 'text-cyan-400 bg-cyan-950/70' : 'text-slate-500 hover:text-slate-300'
        }`}
      >
        {isActive ? (
          sortDirection === 'asc' ? (
            <ArrowUp className="w-3.5 h-3.5" />
          ) : (
            <ArrowDown className="w-3.5 h-3.5" />
          )
        ) : (
          <ArrowUpDown className="w-3 h-3 opacity-50" />
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
      <div className="glass-panel p-5 rounded-2xl border border-slate-800 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3 flex-wrap gap-2">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Anchor className="w-5 h-5 text-cyan-400" />
              <span>Monitoring Layanan Armada & Stok Backlog</span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Verifikasi pemenuhan QTY FPB diajukan vs QTY FSTB terealisasi, pemantauan selisih backlog, dan rincian peruntukan armada.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 bg-cyan-950 text-cyan-300 rounded-lg text-xs font-mono border border-cyan-800">
              {items.length.toLocaleString()} Total Baris Item
            </span>
          </div>
        </div>

        {/* 4 KPI Summary Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/10 text-cyan-400 flex items-center justify-center border border-cyan-500/20">
              <Boxes className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
                Total QTY Diminta (FPB)
              </span>
              <span className="text-base font-bold text-white font-mono">
                {metrics.totalQtyFPB.toLocaleString()}
              </span>
              <span className="text-[10px] text-slate-500 block">
                Unit barang dari {metrics.totalItems.toLocaleString()} item
              </span>
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center border border-emerald-500/20">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
                Total QTY Dipenuhi (FSTB)
              </span>
              <span className="text-base font-bold text-emerald-400 font-mono">
                {metrics.totalQtyFSTB.toLocaleString()}
              </span>
              <span className="text-[10px] text-emerald-500/80 block">
                {metrics.completeItemCount.toLocaleString()} item terpenuhi 100%
              </span>
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-500/10 text-rose-400 flex items-center justify-center border border-rose-500/20">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
                Total QTY Selisih Backlog
              </span>
              <span className="text-base font-bold text-rose-400 font-mono">
                {metrics.totalBacklogQty.toLocaleString()}
              </span>
              <span className="text-[10px] text-rose-400/80 block">
                Qty fisik yang belum diterima armada
              </span>
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center border border-amber-500/20">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
                Item Menunggu Pemenuhan
              </span>
              <span className="text-base font-bold text-amber-400 font-mono">
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
        <div className="bg-[#090e1d] p-4 rounded-xl border border-slate-800 space-y-3">
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
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
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
                  className="w-full pl-9 pr-8 py-2 bg-slate-900 border border-slate-700/80 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition"
                />
                {searchTerm && (
                  <button
                    type="button"
                    onClick={() => handleSearchChange('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                    title="Hapus kata kunci"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
              <button
                type="submit"
                className="px-3.5 py-2 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition active:scale-95 shadow-md shadow-cyan-950/40 whitespace-nowrap"
                title="Tekan Enter atau klik untuk mencari"
              >
                <Search className="w-3.5 h-3.5" />
                <span>Cari</span>
              </button>
            </form>

            {/* Quick Status Filter Buttons */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 lg:pb-0 text-xs">
              <span className="text-slate-400 text-[11px] font-medium mr-1 flex items-center gap-1">
                <Filter className="w-3.5 h-3.5 text-cyan-400" />
                Status:
              </span>
              <button
                onClick={() => setStatusFilter('ALL')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition whitespace-nowrap ${
                  statusFilter === 'ALL'
                    ? 'bg-cyan-600 text-white shadow-sm'
                    : 'bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-800 border border-slate-800'
                }`}
              >
                Semua ({items.length})
              </button>
              <button
                onClick={() => setStatusFilter('BACKLOG')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition whitespace-nowrap flex items-center gap-1.5 ${
                  statusFilter === 'BACKLOG'
                    ? 'bg-rose-600 text-white shadow-sm'
                    : 'bg-slate-900 text-rose-300 hover:text-white hover:bg-rose-950/50 border border-rose-900/40'
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-rose-400 animate-pulse"></span>
                <span>Hanya Backlog ({metrics.backlogItemCount})</span>
              </button>
              <button
                onClick={() => setStatusFilter('LENGKAP')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition whitespace-nowrap ${
                  statusFilter === 'LENGKAP'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'bg-slate-900 text-emerald-300 hover:text-white hover:bg-emerald-950/50 border border-emerald-900/40'
                }`}
              >
                Lengkap ({metrics.completeItemCount})
              </button>
              <button
                onClick={() => setStatusFilter('PARSIAL')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition whitespace-nowrap ${
                  statusFilter === 'PARSIAL'
                    ? 'bg-amber-600 text-white shadow-sm'
                    : 'bg-slate-900 text-amber-300 hover:text-white hover:bg-amber-950/50 border border-amber-900/40'
                }`}
              >
                Parsial ({metrics.partialItemCount})
              </button>
            </div>
          </div>

          {/* Row 2: Filter Waktu (Tahun, Bulan, Rentang Tanggal) & Quick Sort Tanggal */}
          <div className="flex flex-wrap items-center justify-between gap-2.5 pt-2 border-t border-slate-800/80 text-xs">
            <div className="flex flex-wrap items-center gap-2">
              {/* Tahun Filter */}
              <div className="flex items-center gap-1.5 bg-slate-900/90 px-2.5 py-1.5 rounded-lg border border-slate-700/80">
                <Calendar className="w-3.5 h-3.5 text-cyan-400" />
                <span className="text-slate-400 text-[11px] font-medium">Tahun:</span>
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(e.target.value)}
                  className="bg-transparent text-slate-200 text-xs focus:outline-none font-mono cursor-pointer"
                >
                  <option value="ALL" className="bg-slate-900 text-slate-200">
                    Semua Tahun {uniqueYears.length > 0 ? `(${uniqueYears.length})` : ''}
                  </option>
                  {uniqueYears.map((yr) => (
                    <option key={yr} value={yr} className="bg-slate-900 text-slate-200 font-mono">
                      {yr}
                    </option>
                  ))}
                </select>
              </div>

              {/* Bulan Filter */}
              <div className="flex items-center gap-1.5 bg-slate-900/90 px-2.5 py-1.5 rounded-lg border border-slate-700/80">
                <CalendarDays className="w-3.5 h-3.5 text-cyan-400" />
                <span className="text-slate-400 text-[11px] font-medium">Bulan:</span>
                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="bg-transparent text-slate-200 text-xs focus:outline-none cursor-pointer"
                >
                  {MONTH_OPTIONS.map((m) => (
                    <option key={m.value} value={m.value} className="bg-slate-900 text-slate-200">
                      {m.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Rentang Tanggal (Date Range) */}
              <div className="flex items-center gap-1.5 bg-slate-900/90 px-2.5 py-1.5 rounded-lg border border-slate-700/80 text-slate-300">
                <CalendarRange className="w-3.5 h-3.5 text-cyan-400" />
                <span className="text-slate-400 text-[11px]">Tgl:</span>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="bg-transparent text-slate-200 text-xs focus:outline-none font-mono cursor-pointer"
                  title="Dari Tanggal"
                />
                <span className="text-slate-500 text-[11px]">&ndash;</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="bg-transparent text-slate-200 text-xs focus:outline-none font-mono cursor-pointer"
                  title="Sampai Tanggal"
                />
                {(startDate || endDate) && (
                  <button
                    type="button"
                    onClick={() => {
                      setStartDate('');
                      setEndDate('');
                    }}
                    className="text-slate-400 hover:text-white ml-1"
                    title="Hapus filter rentang tanggal"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>

            {/* Quick Sorting Buttons by Tanggal */}
            <div className="flex items-center gap-1.5">
              <span className="text-slate-400 text-[11px] mr-1 hidden sm:inline">Urut Tanggal:</span>
              <button
                type="button"
                onClick={() => {
                  setSortField('date');
                  setSortDirection('desc');
                }}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition ${
                  sortField === 'date' && sortDirection === 'desc'
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/50 shadow-sm'
                    : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
                }`}
                title="Urutkan tanggal terbaru di atas"
              >
                <ArrowDown className="w-3.5 h-3.5 text-cyan-400" />
                <span>Terbaru</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setSortField('date');
                  setSortDirection('asc');
                }}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition ${
                  sortField === 'date' && sortDirection === 'asc'
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/50 shadow-sm'
                    : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
                }`}
                title="Urutkan tanggal terlama di atas"
              >
                <ArrowUp className="w-3.5 h-3.5 text-cyan-400" />
                <span>Terlama</span>
              </button>
            </div>
          </div>

          {/* Row 3: Secondary Dropdown Filters & Sorting Shortcuts */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-800/80 text-xs">
            <div className="flex flex-wrap items-center gap-2.5">
              {/* Entitas / PT Filter */}
              {uniqueEntities.length > 0 && (
                <div className="flex items-center gap-1.5">
                  <span className="text-slate-400 text-[11px]">PT:</span>
                  <select
                    value={entityFilter}
                    onChange={(e) => setEntityFilter(e.target.value)}
                    className="bg-slate-900 border border-slate-700 text-slate-200 text-xs rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-cyan-400 font-mono"
                  >
                    <option value="ALL">Semua PT ({uniqueEntities.length})</option>
                    {uniqueEntities.map((ent) => (
                      <option key={ent} value={ent}>
                        {ent}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Kapal / Armada Filter */}
              {uniqueArmadas.length > 0 && (
                <div className="flex items-center gap-1.5">
                  <span className="text-slate-400 text-[11px]">Kapal / Armada:</span>
                  <select
                    value={armadaFilter}
                    onChange={(e) => setArmadaFilter(e.target.value)}
                    className="bg-slate-900 border border-slate-700 text-slate-200 text-xs rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-cyan-400 max-w-[220px]"
                  >
                    <option value="ALL">Semua Kapal / Armada ({uniqueArmadas.length})</option>
                    {uniqueArmadas.map((arm) => (
                      <option key={arm} value={arm}>
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
                className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition ${
                  sortField === 'selisih' && sortDirection === 'desc'
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                    : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
                }`}
                title="Urutkan backlog tertinggi di atas"
              >
                <ArrowDown className="w-3.5 h-3.5 text-amber-400" />
                <span>Backlog Terbanyak</span>
              </button>

              {/* Reset Filter Button */}
              {isFiltered && (
                <button
                  onClick={handleResetFilters}
                  className="px-2.5 py-1.5 rounded-lg text-xs font-semibold text-rose-300 hover:text-white bg-rose-950/40 hover:bg-rose-900/60 border border-rose-800/40 flex items-center gap-1 transition"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Reset Filter</span>
                </button>
              )}
            </div>

            {/* Results Counter & Active Sorting Indicator */}
            <div className="flex items-center gap-3 text-slate-400 text-[11px]">
              <span>
                Menampilkan{' '}
                <strong className="text-cyan-400 font-mono">
                  {sortedItems.length.toLocaleString()}
                </strong>{' '}
                dari {items.length.toLocaleString()} data
              </span>
              <span className="text-slate-600">|</span>
              <span>
                Urutan:{' '}
                <strong className="text-slate-200 font-mono uppercase">
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
            <div className="flex items-center justify-between gap-2 px-3 py-1.5 rounded-lg bg-cyan-950/40 border border-cyan-800/60 text-xs flex-wrap">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-cyan-300 font-mono font-semibold">
                  Filter Aktif:
                </span>
                {searchTerm.trim() !== '' && (
                  <span className="px-2 py-0.5 rounded bg-cyan-900/60 border border-cyan-700/60 text-white font-mono text-[11px]">
                    Cari: &quot;{searchTerm}&quot;
                  </span>
                )}
                {selectedYear !== 'ALL' && (
                  <span className="px-2 py-0.5 rounded bg-blue-900/60 border border-blue-700/60 text-white font-mono text-[11px]">
                    Tahun: {selectedYear}
                  </span>
                )}
                {selectedMonth !== 'ALL' && (
                  <span className="px-2 py-0.5 rounded bg-indigo-900/60 border border-indigo-700/60 text-white font-mono text-[11px]">
                    Bulan: {MONTH_OPTIONS.find((m) => m.value === selectedMonth)?.label}
                  </span>
                )}
                {(startDate || endDate) && (
                  <span className="px-2 py-0.5 rounded bg-purple-900/60 border border-purple-700/60 text-white font-mono text-[11px]">
                    Rentang: {startDate || 'Awal'} s/d {endDate || 'Sekarang'}
                  </span>
                )}
                {statusFilter !== 'ALL' && (
                  <span className="px-2 py-0.5 rounded bg-amber-900/60 border border-amber-700/60 text-white font-mono text-[11px]">
                    Status: {statusFilter}
                  </span>
                )}
                {entityFilter !== 'ALL' && (
                  <span className="px-2 py-0.5 rounded bg-teal-900/60 border border-teal-700/60 text-white font-mono text-[11px]">
                    PT: {entityFilter}
                  </span>
                )}
                {armadaFilter !== 'ALL' && (
                  <span className="px-2 py-0.5 rounded bg-sky-900/60 border border-sky-700/60 text-white font-mono text-[11px]">
                    Armada: {armadaFilter}
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={handleResetFilters}
                className="text-slate-400 hover:text-white text-[11px] underline flex items-center gap-1 ml-auto"
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
        <div className="overflow-x-auto rounded-xl border border-slate-800 shadow-xl">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-[#080d1a] text-slate-400 font-semibold border-b border-slate-800 uppercase tracking-wider text-[11px] select-none">
              <tr>
                <th
                  onClick={() => handleSort('fpb')}
                  className="p-3 cursor-pointer hover:text-white hover:bg-slate-900/60 transition group whitespace-nowrap"
                >
                  <span className="flex items-center">
                    NO FPB ASAL
                    {renderSortIndicator('fpb')}
                  </span>
                </th>
                <th
                  onClick={() => handleSort('armada')}
                  className="p-3 cursor-pointer hover:text-white hover:bg-slate-900/60 transition group whitespace-nowrap"
                >
                  <span className="flex items-center">
                    NAMA KAPAL / ARMADA
                    {renderSortIndicator('armada')}
                  </span>
                </th>
                <th
                  onClick={() => handleSort('item')}
                  className="p-3 cursor-pointer hover:text-white hover:bg-slate-900/60 transition group"
                >
                  <span className="flex items-center">
                    ITEM DESCRIPTION & KETERANGAN
                    {renderSortIndicator('item')}
                  </span>
                </th>
                <th
                  onClick={() => handleSort('qtyFPB')}
                  className="p-3 text-center cursor-pointer hover:text-white hover:bg-slate-900/60 transition group whitespace-nowrap"
                >
                  <span className="flex items-center justify-center">
                    QTY FPB
                    {renderSortIndicator('qtyFPB')}
                  </span>
                </th>
                <th
                  onClick={() => handleSort('qtyFSTB')}
                  className="p-3 text-center cursor-pointer hover:text-white hover:bg-slate-900/60 transition group whitespace-nowrap"
                >
                  <span className="flex items-center justify-center">
                    QTY FSTB
                    {renderSortIndicator('qtyFSTB')}
                  </span>
                </th>
                <th
                  onClick={() => handleSort('selisih')}
                  className="p-3 text-center cursor-pointer hover:text-white hover:bg-slate-900/60 transition group whitespace-nowrap bg-amber-950/20"
                >
                  <span className="flex items-center justify-center text-amber-300 font-bold">
                    SELISIH BACKLOG
                    {renderSortIndicator('selisih')}
                  </span>
                </th>
                <th
                  onClick={() => handleSort('status')}
                  className="p-3 text-center cursor-pointer hover:text-white hover:bg-slate-900/60 transition group whitespace-nowrap"
                >
                  <span className="flex items-center justify-center">
                    STATUS PEMENUHAN
                    {renderSortIndicator('status')}
                  </span>
                </th>
                <th className="p-3 text-center whitespace-nowrap">AKSI</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-sans">
              {paginatedItems.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-10 text-center text-slate-500">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Anchor className="w-8 h-8 opacity-30 text-amber-400" />
                      <p className="text-sm font-semibold text-slate-300">
                        Tidak ada data yang sesuai filter
                      </p>
                      <p className="text-xs text-slate-500 max-w-md">
                        Coba sesuaikan kata kunci pencarian, filter status, atau klik tombol Reset Filter di atas.
                      </p>
                      {isFiltered && (
                        <button
                          onClick={handleResetFilters}
                          className="mt-2 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-cyan-300 rounded-lg text-xs font-semibold transition"
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
                      className="hover:bg-slate-900/60 transition group"
                    >
                      {/* No FPB, Entity Tag & Tanggal */}
                      <td className="p-3 whitespace-nowrap font-mono">
                        <button
                          onClick={() => onOpenAudit && onOpenAudit(row.fpb, row.noPo)}
                          className="font-bold text-cyan-400 hover:text-cyan-300 hover:underline flex items-center gap-1"
                          title="Buka audit modal FPB"
                        >
                          <span>{row.fpb}</span>
                          <ExternalLink className="w-3 h-3 opacity-50 group-hover:opacity-100 transition-opacity" />
                        </button>
                        <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                          {row.entity && (
                            <span className="inline-block px-1.5 py-0.2 rounded text-[10px] font-mono bg-slate-800 text-slate-300 border border-slate-700">
                              {row.entity}
                            </span>
                          )}
                          {(row.tglPo || row.tglFpb) && (
                            <span className="text-[10px] text-slate-400 font-mono">
                              {row.tglPo || row.tglFpb}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Nama Kapal & Peruntukan Keterangan */}
                      <td className="p-3 max-w-[240px]">
                        <div className="text-white font-medium flex items-center gap-1.5">
                          <Anchor className="w-3.5 h-3.5 text-cyan-400 flex-shrink-0" />
                          <span>{row.armada}</span>
                        </div>
                        {row.keterangan && (
                          <div className="text-[11px] text-cyan-300 font-mono mt-1 leading-snug pl-5">
                            {row.keterangan}
                          </div>
                        )}
                      </td>

                      {/* Item Description */}
                      <td className="p-3 max-w-[280px]">
                        <div className="text-slate-200 font-medium">{row.item}</div>
                        <div className="flex items-center gap-2 mt-0.5 text-[10px] text-slate-500 font-mono flex-wrap">
                          {row.kodeBarang && <span>Kode: {row.kodeBarang}</span>}
                          {row.satuan && <span>&bull; {row.satuan}</span>}
                          {row.noPo && <span>&bull; PO: {row.noPo}</span>}
                          {row.picPch && row.picPch !== '-' && (
                            <span className="text-cyan-400 font-semibold">&bull; PIC: {row.picPch}</span>
                          )}
                        </div>
                      </td>

                      {/* Qty FPB */}
                      <td className="p-3 text-center text-cyan-300 font-mono font-bold">
                        {row.qtyFPB.toLocaleString()}
                      </td>

                      {/* Qty FSTB */}
                      <td className="p-3 text-center text-slate-200 font-mono">
                        {row.qtyFSTB.toLocaleString()}
                      </td>

                      {/* Selisih Backlog */}
                      <td
                        className={`p-3 text-center font-mono font-bold text-sm bg-slate-950/40 ${
                          isComplete
                            ? 'text-emerald-400'
                            : isPartial
                            ? 'text-amber-400'
                            : 'text-rose-400'
                        }`}
                      >
                        {row.selisih.toLocaleString()}
                      </td>

                      {/* Status Pemenuhan & Alur Berkas Procurement */}
                      <td className="p-3 text-center whitespace-nowrap">
                        <div className="space-y-1">
                          <span
                            className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-semibold tracking-wide border ${
                              isComplete
                                ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                                : isPartial
                                ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                                : 'bg-rose-500/15 text-rose-300 border-rose-500/30'
                            }`}
                          >
                            {row.status}
                          </span>
                          {row.statusBadge && (
                            <div>
                              <span className="inline-block px-1.5 py-0.5 rounded text-[9px] font-mono bg-cyan-950/90 text-cyan-300 border border-cyan-800/60 font-medium">
                                {row.statusBadge}
                              </span>
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Action Button */}
                      <td className="p-3 text-center whitespace-nowrap">
                        {onOpenAudit && (
                          <button
                            onClick={() => onOpenAudit(row.fpb, row.noPo)}
                            className="px-2.5 py-1 bg-slate-800 hover:bg-cyan-900/60 text-slate-300 hover:text-cyan-300 border border-slate-700/80 hover:border-cyan-500/50 rounded-lg text-[11px] font-semibold transition"
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
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-slate-800 text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <span>Baris per halaman:</span>
            <select
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value))}
              className="bg-slate-900 border border-slate-700 text-slate-200 rounded px-2 py-1 focus:outline-none focus:border-cyan-400 font-mono"
            >
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
              <option value={200}>200</option>
            </select>
            <span className="text-slate-500">
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
              className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 disabled:opacity-30 disabled:pointer-events-none border border-slate-800 transition"
              title="Halaman Pertama"
            >
              <ChevronsLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 disabled:opacity-30 disabled:pointer-events-none border border-slate-800 transition"
              title="Halaman Sebelumnya"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <span className="px-3 py-1 bg-slate-950 rounded border border-slate-800 text-slate-200">
              Halaman {currentPage} / {totalPages}
            </span>

            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 disabled:opacity-30 disabled:pointer-events-none border border-slate-800 transition"
              title="Halaman Berikutnya"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            <button
              onClick={() => setCurrentPage(totalPages)}
              disabled={currentPage === totalPages}
              className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 disabled:opacity-30 disabled:pointer-events-none border border-slate-800 transition"
              title="Halaman Terakhir"
            >
              <ChevronsRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
