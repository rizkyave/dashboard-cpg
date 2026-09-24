'use client';

import React, { useState, useMemo, useEffect } from 'react';
import {
  Plus,
  ArrowRight,
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
  FileSpreadsheet,
  AlertTriangle,
  Clock,
  Building2,
  Calendar,
  CalendarDays,
  CalendarRange,
} from 'lucide-react';
import { ProcurementItem, StatusTone } from '@/types/procurement';

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
  // Fallback Date.parse
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

interface ProcurementTabProps {
  items: ProcurementItem[];
  totalAllItems: number;
  searchKeyword?: string;
  onSearchKeywordChange?: (kw: string) => void;
  onOpenNewRecord: () => void;
  onOpenAudit: (fpb: string, po?: string) => void;
}

type SortField = 'fpb' | 'po' | 'date' | 'item' | 'peruntukan' | 'statusBadge' | 'lapse';
type LapseFilter = 'ALL' | 'NORMAL' | 'WARNING' | 'CRITICAL';

export default function ProcurementTab({
  items,
  totalAllItems,
  searchKeyword,
  onSearchKeywordChange,
  onOpenNewRecord,
  onOpenAudit,
}: ProcurementTabProps) {
  // Search & Filters State
  const [searchTerm, setSearchTerm] = useState<string>(searchKeyword || '');
  const [selectedEntity, setSelectedEntity] = useState<string>('ALL');
  const [selectedLapse, setSelectedLapse] = useState<LapseFilter>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');

  // Date, Month & Year Filters State
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

  // Sorting State
  const [sortField, setSortField] = useState<SortField>('lapse');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  // View Grouping State: 'items' (All Line Items from Monitoring Layanan Armada) vs 'dossiers' (Consolidated by FPB/PO)
  const [viewGrouping, setViewGrouping] = useState<'items' | 'dossiers'>('items');

  // Pagination State
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(50);

  const toneStyles: Record<StatusTone, string> = {
    emerald: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
    cyan: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30',
    purple: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
    amber: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
    rose: 'bg-rose-500/20 text-rose-300 border-rose-500/30',
  };

  // Base items depending on view grouping
  const displayBaseItems = useMemo(() => {
    if (viewGrouping === 'items') return items;

    // Group items by FPB + PO
    const map = new Map<string, ProcurementItem>();
    for (const it of items) {
      const key = `${it.fpb}___${it.po}`;
      const existing = map.get(key);
      if (!existing) {
        map.set(key, { ...it });
      } else {
        if (it.item && !existing.item.includes(it.item)) {
          existing.item = `${existing.item}, ${it.item}`;
        }
        if (it.peruntukan && !existing.peruntukan.includes(it.peruntukan)) {
          existing.peruntukan = `${existing.peruntukan} • ${it.peruntukan}`;
        }
        existing.lapse = Math.max(existing.lapse, it.lapse);
        if (it.qtyFPB) existing.qtyFPB = (existing.qtyFPB || 0) + it.qtyFPB;
        if (it.qtyFSTB) existing.qtyFSTB = (existing.qtyFSTB || 0) + it.qtyFSTB;
      }
    }
    return Array.from(map.values());
  }, [items, viewGrouping]);

  // Extract unique Entities from data
  const uniqueEntities = useMemo(() => {
    const set = new Set<string>();
    for (const item of displayBaseItems) {
      if (item.entity) set.add(item.entity.trim().toUpperCase());
    }
    return Array.from(set).sort();
  }, [displayBaseItems]);

  // Extract unique Years from data
  const uniqueYears = useMemo(() => {
    const set = new Set<string>();
    for (const item of displayBaseItems) {
      const info = extractDateInfo(item.date);
      if (info.year && info.year.length === 4) {
        set.add(info.year);
      }
    }
    return Array.from(set).sort((a, b) => b.localeCompare(a));
  }, [displayBaseItems]);

  // Extract unique Statuses from data
  const uniqueStatuses = useMemo(() => {
    const set = new Set<string>();
    for (const item of displayBaseItems) {
      if (item.statusBadge) set.add(item.statusBadge.trim());
    }
    return Array.from(set).sort();
  }, [displayBaseItems]);

  // Counts for quick badges
  const counts = useMemo(() => {
    let critical = 0;
    let warning = 0;
    let normal = 0;
    for (const item of displayBaseItems) {
      if (item.lapse > 5) critical++;
      else if (item.lapse >= 3) warning++;
      else normal++;
    }
    return { critical, warning, normal };
  }, [displayBaseItems]);

  // Reset page to 1 whenever filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [
    searchTerm,
    selectedEntity,
    selectedLapse,
    selectedStatus,
    selectedYear,
    selectedMonth,
    startDate,
    endDate,
    sortField,
    sortDirection,
    pageSize,
    viewGrouping,
  ]);

  // Filter items
  const filteredItems = useMemo(() => {
    return displayBaseItems.filter((row) => {
      // Entity Filter
      if (selectedEntity !== 'ALL' && row.entity?.toUpperCase() !== selectedEntity) {
        return false;
      }

      // Lapse Filter
      if (selectedLapse === 'NORMAL' && row.lapse > 2) return false;
      if (selectedLapse === 'WARNING' && (row.lapse < 3 || row.lapse > 5)) return false;
      if (selectedLapse === 'CRITICAL' && row.lapse <= 5) return false;

      // Status Filter
      if (selectedStatus !== 'ALL' && row.statusBadge !== selectedStatus) {
        return false;
      }

      // Year Filter
      if (selectedYear !== 'ALL') {
        const info = extractDateInfo(row.date);
        if (info.year !== selectedYear) return false;
      }

      // Month Filter
      if (selectedMonth !== 'ALL') {
        const info = extractDateInfo(row.date);
        if (info.month !== selectedMonth) return false;
      }

      // Date Range Filter (Dari Tgl - Sampai Tgl)
      if (startDate) {
        const info = extractDateInfo(row.date);
        if (info.fullDate && info.fullDate < startDate) return false;
      }
      if (endDate) {
        const info = extractDateInfo(row.date);
        if (info.fullDate && info.fullDate > endDate) return false;
      }

      // Search Keyword
      if (searchTerm.trim() !== '') {
        const q = searchTerm.toLowerCase().trim();
        const matchFpb = row.fpb?.toLowerCase().includes(q);
        const matchPo = row.po?.toLowerCase().includes(q);
        const matchItem = row.item?.toLowerCase().includes(q);
        const matchPeruntukan = row.peruntukan?.toLowerCase().includes(q);
        const matchDeptArmada = row.deptArmada?.toLowerCase().includes(q);
        const matchEntity = row.entity?.toLowerCase().includes(q);
        const matchPicAktif = row.picAktif?.toLowerCase().includes(q);
        const matchPicPch = row.picPch?.toLowerCase().includes(q);
        const matchPicTtb = row.picTtb?.toLowerCase().includes(q);
        const matchPicLap = row.picLap?.toLowerCase().includes(q);
        const matchPicAdm = row.picAdm?.toLowerCase().includes(q);
        const matchNoFstb = row.noFstb?.toLowerCase().includes(q);
        const matchNoTtb = row.noTtb?.toLowerCase().includes(q);
        const matchNoSpp = row.noSpp?.toLowerCase().includes(q);
        const matchStatus = row.statusBadge?.toLowerCase().includes(q);
        const matchPenjelasan = row.statusPenjelasan?.toLowerCase().includes(q);

        if (
          !matchFpb &&
          !matchPo &&
          !matchItem &&
          !matchPeruntukan &&
          !matchDeptArmada &&
          !matchEntity &&
          !matchPicAktif &&
          !matchPicPch &&
          !matchPicTtb &&
          !matchPicLap &&
          !matchPicAdm &&
          !matchNoFstb &&
          !matchNoTtb &&
          !matchNoSpp &&
          !matchStatus &&
          !matchPenjelasan
        ) {
          return false;
        }
      }

      return true;
    });
  }, [displayBaseItems, selectedEntity, selectedLapse, selectedStatus, selectedYear, selectedMonth, startDate, endDate, searchTerm]);

  // Sort filtered items
  const sortedItems = useMemo(() => {
    const list = [...filteredItems];
    list.sort((a, b) => {
      // Accurate chronological sorting when sorting by date
      if (sortField === 'date') {
        const timeA = extractDateInfo(a.date).timestamp;
        const timeB = extractDateInfo(b.date).timestamp;
        if (timeA && timeB) {
          return sortDirection === 'asc' ? timeA - timeB : timeB - timeA;
        }
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

  // Paginated items
  const totalPages = Math.max(1, Math.ceil(sortedItems.length / pageSize));
  const paginatedItems = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sortedItems.slice(start, start + pageSize);
  }, [sortedItems, currentPage, pageSize]);

  // Column header sort toggle
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

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

  // Reset filters
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

  return (
    <div className="space-y-4">
      <div className="glass-panel p-5 rounded-2xl border border-slate-800 space-y-4">
        {/* Header Title & Action Button */}
        <div className="flex items-center justify-between flex-wrap gap-3 border-b border-slate-800 pb-3">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2 flex-wrap">
              <FileSpreadsheet className="w-5 h-5 text-cyan-400" />
              <span>Monitoring Pengadaan & Layanan Armada</span>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                Acuan Utama: Monitoring Layanan Armada
              </span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Alur rantai pertanggungjawaban fisik dokumen dan layanan armada dari Purchasing, Logistik TTB,
              Kru Lapangan, hingga Staf Keuangan.
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {/* View Mode Toggle: Per Item Armada vs Ringkasan Berkas/PO */}
            <div className="flex items-center bg-slate-900/90 p-1 rounded-lg border border-slate-700/80 text-xs">
              <button
                type="button"
                onClick={() => setViewGrouping('items')}
                className={`px-2.5 py-1 rounded text-xs font-semibold transition ${
                  viewGrouping === 'items'
                    ? 'bg-cyan-600 text-white shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
                title="Tampilkan setiap baris item dari sheet Monitoring Layanan Armada"
              >
                📋 Semua Item ({items.length.toLocaleString()})
              </button>
              <button
                type="button"
                onClick={() => setViewGrouping('dossiers')}
                className={`px-2.5 py-1 rounded text-xs font-semibold transition ${
                  viewGrouping === 'dossiers'
                    ? 'bg-cyan-600 text-white shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
                title="Kelompokkan data per berkas PO / FPB"
              >
                📁 Ringkasan Berkas
              </button>
            </div>

            <button
              onClick={onOpenNewRecord}
              className="px-3.5 py-2 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition shadow"
            >
              <Plus className="w-4 h-4" />
              <span>Input Berkas PO Baru</span>
            </button>
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════════
            FILTER & SEARCH BAR CONTROL
            ═══════════════════════════════════════════════════════════ */}
        <div className="bg-[#090e1d] p-4 rounded-xl border border-slate-800 space-y-3">
          {/* Row 1: Search Input & Quick Lapse Filter Buttons */}
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
                  placeholder="Cari FPB, No PO, Nama Kapal / Armada, Peruntukan, PIC..."
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

            {/* Quick Lapse Filter Buttons */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 lg:pb-0 text-xs">
              <span className="text-slate-400 text-[11px] font-medium mr-1 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-cyan-400" />
                Lapse:
              </span>
              <button
                onClick={() => setSelectedLapse('ALL')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition whitespace-nowrap ${
                  selectedLapse === 'ALL'
                    ? 'bg-cyan-600 text-white shadow-sm'
                    : 'bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-800 border border-slate-800'
                }`}
              >
                Semua ({items.length})
              </button>
              <button
                onClick={() => setSelectedLapse('CRITICAL')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition whitespace-nowrap flex items-center gap-1.5 ${
                  selectedLapse === 'CRITICAL'
                    ? 'bg-rose-600 text-white shadow-sm'
                    : 'bg-slate-900 text-rose-300 hover:text-white hover:bg-rose-950/50 border border-rose-900/40'
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-rose-400 animate-pulse"></span>
                <span>Kritis &gt;5 Hari ({counts.critical})</span>
              </button>
              <button
                onClick={() => setSelectedLapse('WARNING')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition whitespace-nowrap ${
                  selectedLapse === 'WARNING'
                    ? 'bg-amber-600 text-white shadow-sm'
                    : 'bg-slate-900 text-amber-300 hover:text-white hover:bg-amber-950/50 border border-amber-900/40'
                }`}
              >
                Perhatian 3-5 Hari ({counts.warning})
              </button>
              <button
                onClick={() => setSelectedLapse('NORMAL')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition whitespace-nowrap ${
                  selectedLapse === 'NORMAL'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'bg-slate-900 text-emerald-300 hover:text-white hover:bg-emerald-950/50 border border-emerald-900/40'
                }`}
              >
                Normal ≤2 Hari ({counts.normal})
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

              {/* Rentang Tanggal PO (Date Range) */}
              <div className="flex items-center gap-1.5 bg-slate-900/90 px-2.5 py-1.5 rounded-lg border border-slate-700/80 text-slate-300">
                <CalendarRange className="w-3.5 h-3.5 text-cyan-400" />
                <span className="text-slate-400 text-[11px]">Tgl PO:</span>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="bg-transparent text-slate-200 text-xs focus:outline-none font-mono cursor-pointer"
                  title="Dari Tanggal PO"
                />
                <span className="text-slate-500 text-[11px]">&ndash;</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="bg-transparent text-slate-200 text-xs focus:outline-none font-mono cursor-pointer"
                  title="Sampai Tanggal PO"
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
                title="Urutkan tanggal PO terbaru di atas"
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
                title="Urutkan tanggal PO terlama di atas"
              >
                <ArrowUp className="w-3.5 h-3.5 text-cyan-400" />
                <span>Terlama</span>
              </button>
            </div>
          </div>

          {/* Row 3: Secondary Dropdowns & Lapse Controls */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-800/80 text-xs">
            <div className="flex flex-wrap items-center gap-2.5">
              {/* Entitas / PT Filter */}
              {uniqueEntities.length > 0 && (
                <div className="flex items-center gap-1.5">
                  <span className="text-slate-400 text-[11px] flex items-center gap-1">
                    <Building2 className="w-3.5 h-3.5 text-cyan-400" />
                    PT:
                  </span>
                  <select
                    value={selectedEntity}
                    onChange={(e) => setSelectedEntity(e.target.value)}
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

              {/* Status Berkas Filter */}
              {uniqueStatuses.length > 0 && (
                <div className="flex items-center gap-1.5">
                  <span className="text-slate-400 text-[11px] flex items-center gap-1">
                    <Filter className="w-3.5 h-3.5 text-cyan-400" />
                    Status:
                  </span>
                  <select
                    value={selectedStatus}
                    onChange={(e) => setSelectedStatus(e.target.value)}
                    className="bg-slate-900 border border-slate-700 text-slate-200 text-xs rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-cyan-400 max-w-[220px]"
                  >
                    <option value="ALL">Semua Status ({uniqueStatuses.length})</option>
                    {uniqueStatuses.map((st) => (
                      <option key={st} value={st}>
                        {st}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Quick Sort Shortcut: Lapse Day Highest */}
              <button
                onClick={() => {
                  setSortField('lapse');
                  setSortDirection('desc');
                }}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition ${
                  sortField === 'lapse' && sortDirection === 'desc'
                    ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                    : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
                }`}
                title="Urutkan berkas dengan durasi tertunda paling lama"
              >
                <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
                <span>Lapse Tertinggi</span>
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
                dari {items.length.toLocaleString()} berkas
              </span>
              <span className="text-slate-600">|</span>
              <span>
                Urutan:{' '}
                <strong className="text-slate-200 font-mono uppercase">
                  {sortField === 'date'
                    ? `Tanggal PO (${sortDirection === 'desc' ? 'Terbaru' : 'Terlama'})`
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
                {selectedEntity !== 'ALL' && (
                  <span className="px-2 py-0.5 rounded bg-emerald-900/60 border border-emerald-700/60 text-white font-mono text-[11px]">
                    PT: {selectedEntity}
                  </span>
                )}
                {selectedLapse !== 'ALL' && (
                  <span className="px-2 py-0.5 rounded bg-rose-900/60 border border-rose-700/60 text-white font-mono text-[11px]">
                    Lapse: {selectedLapse}
                  </span>
                )}
                {selectedStatus !== 'ALL' && (
                  <span className="px-2 py-0.5 rounded bg-slate-800 border border-slate-600 text-white font-mono text-[11px]">
                    Status: {selectedStatus}
                  </span>
                )}
                <span className="text-cyan-400 font-mono text-[11px]">
                  ({sortedItems.length} berkas ditemukan)
                </span>
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
            DETAILED SHEET 1 TABLE (INTERACTIVE SORTING)
            ═══════════════════════════════════════════════════════════ */}
        <div className="overflow-x-auto rounded-xl border border-slate-800 shadow-xl">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-[#080d1a] text-slate-400 font-semibold border-b border-slate-800 uppercase tracking-wider text-[11px] select-none">
              <tr>
                <th
                  onClick={() => handleSort('fpb')}
                  className="p-3.5 cursor-pointer hover:text-white hover:bg-slate-900/60 transition group whitespace-nowrap"
                >
                  <span className="flex items-center">
                    NO FPB & ENTITAS
                    {renderSortIndicator('fpb')}
                  </span>
                </th>
                <th
                  onClick={() => handleSort('po')}
                  className="p-3.5 cursor-pointer hover:text-white hover:bg-slate-900/60 transition group whitespace-nowrap"
                >
                  <span className="flex items-center">
                    NO PO INTERNAL
                    {renderSortIndicator('po')}
                  </span>
                </th>
                <th
                  onClick={() => handleSort('date')}
                  className="p-3.5 cursor-pointer hover:text-white hover:bg-slate-900/60 transition group whitespace-nowrap"
                >
                  <span className="flex items-center">
                    TANGGAL PO
                    {renderSortIndicator('date')}
                  </span>
                </th>
                <th
                  onClick={() => handleSort('item')}
                  className="p-3.5 cursor-pointer hover:text-white hover:bg-slate-900/60 transition group"
                >
                  <span className="flex items-center">
                    DESKRIPSI BARANG & PERUNTUKAN
                    {renderSortIndicator('item')}
                  </span>
                </th>
                <th
                  onClick={() => handleSort('statusBadge')}
                  className="p-3.5 cursor-pointer hover:text-white hover:bg-slate-900/60 transition group"
                >
                  <span className="flex items-center">
                    STATUS BERKAS & PERSON IN CHARGE (PIC)
                    {renderSortIndicator('statusBadge')}
                  </span>
                </th>
                <th
                  onClick={() => handleSort('lapse')}
                  className="p-3.5 text-center cursor-pointer hover:text-white hover:bg-slate-900/60 transition group whitespace-nowrap bg-rose-950/20"
                >
                  <span className="flex items-center justify-center text-rose-300 font-bold">
                    LAPSE DAY
                    {renderSortIndicator('lapse')}
                  </span>
                </th>
                <th className="p-3.5 text-center whitespace-nowrap">AKSI AUDIT</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-sans">
              {paginatedItems.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-10 text-center text-slate-500">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <FileSpreadsheet className="w-8 h-8 opacity-30 text-cyan-400" />
                      <p className="text-sm font-semibold text-slate-300">
                        Tidak ada berkas yang cocok dengan filter
                      </p>
                      <p className="text-xs text-slate-500 max-w-md">
                        Coba sesuaikan kata kunci pencarian, filter status, filter lapse day, atau klik tombol Reset Filter.
                      </p>
                      {isFiltered && (
                        <button
                          onClick={handleResetFilters}
                          className="mt-2 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-cyan-300 rounded-lg text-xs font-semibold transition"
                        >
                          Tampilkan Semua Berkas
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedItems.map((row) => {
                  const badgeClass = toneStyles[row.statusTone] || toneStyles.cyan;
                  const lapseBadgeClass =
                    row.lapse <= 2
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                      : row.lapse <= 4
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                      : 'bg-rose-500/20 text-rose-300 border-rose-500/30';

                  return (
                    <tr
                      key={row.id || `${row.fpb}-${row.po}-${row.item}-${row.date}`}
                      onClick={() => onOpenAudit(row.fpb, row.po)}
                      className="hover:bg-cyan-950/20 hover:border-cyan-500/30 cursor-pointer transition group"
                    >
                      <td className="p-3.5">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onOpenAudit(row.fpb, row.po);
                          }}
                          className="font-mono font-bold text-cyan-400 hover:text-cyan-200 hover:underline flex items-center gap-1.5 text-left group-hover:text-cyan-300"
                        >
                          <span>{row.fpb}</span>
                          <ExternalLink className="w-3.5 h-3.5 opacity-60 group-hover:opacity-100 transition-opacity" />
                        </button>
                        <span className="inline-block mt-1 px-1.5 py-0.5 bg-slate-800 text-slate-300 rounded text-[10px] font-mono border border-slate-700">
                          {row.entity}
                        </span>
                      </td>
                      <td className="p-3.5">
                        {row.po && row.po !== '-' ? (
                          <span className="font-mono text-slate-200">{row.po}</span>
                        ) : (
                          <span className="font-mono text-slate-500 italic text-[11px]">- (Kosong)</span>
                        )}
                      </td>
                      <td className="p-3.5 font-mono text-slate-300">{row.date}</td>
                      <td className="p-3.5 max-w-[290px]">
                        <div className="font-medium text-white flex items-center gap-1.5 flex-wrap">
                          <span>{row.item}</span>
                          {row.qtyFPB !== undefined && row.qtyFPB > 0 && (
                            <span className="px-1.5 py-0.5 rounded bg-cyan-950/80 text-cyan-300 border border-cyan-800/60 text-[10px] font-mono whitespace-nowrap">
                              {row.qtyFPB} {row.satuan || ''}
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-cyan-400 font-mono mt-0.5 leading-snug">
                          {row.deptArmada && (
                            <span className="text-slate-400 font-sans mr-1">
                              [{row.deptArmada}]
                            </span>
                          )}
                          {row.peruntukan && row.peruntukan !== '-' ? (
                            <span>{row.peruntukan}</span>
                          ) : (
                            <span className="text-slate-500 italic font-normal text-[10px]">-</span>
                          )}
                        </div>
                      </td>
                      <td className="p-3.5">
                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span
                              className={`px-2 py-0.5 rounded font-mono text-[10px] font-bold border ${badgeClass}`}
                            >
                              {row.statusBadge || 'TERDATA'}
                            </span>
                            <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-700 text-slate-200 text-[10px] font-semibold flex items-center gap-1">
                              <span className="text-slate-400">PIC Aktif:</span>
                              <span className="text-cyan-300 font-mono">
                                {row.picAktif || row.picPch}
                              </span>
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-400 leading-snug">
                            {row.statusPenjelasan || 'Dokumen sedang diproses'}
                          </div>
                          <div className="text-[10px] text-slate-500 font-mono flex items-center gap-2 pt-0.5">
                            <span>
                              PCH:{' '}
                              <strong className="text-slate-300">{row.picPch || '-'}</strong>
                            </span>
                            <span>&bull;</span>
                            <span>
                              TTB:{' '}
                              <strong className="text-slate-300">{row.picTtb || '-'}</strong>
                            </span>
                            <span>&bull;</span>
                            <span>
                              LAP:{' '}
                              <strong className="text-slate-300">{row.picLap || '-'}</strong>
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="p-3.5 text-center">
                        <span
                          className={`inline-block px-2.5 py-1 rounded font-mono text-xs font-bold border ${lapseBadgeClass}`}
                        >
                          {row.lapse} Hari
                        </span>
                      </td>
                      <td className="p-3.5 text-center" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => onOpenAudit(row.fpb, row.po)}
                          className="px-2.5 py-1 bg-cyan-950/80 hover:bg-cyan-800 border border-cyan-500/40 text-cyan-300 hover:text-white rounded text-xs font-mono transition flex items-center gap-1 mx-auto"
                        >
                          <span>Audit</span>
                          <ArrowRight className="w-3 h-3" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* ═══════════════════════════════════════════════════════════
            PAGINATION & STATUS FOOTER
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
