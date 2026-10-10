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
  FileText,
  AlertTriangle,
  Clock,
  Building2,
  Calendar,
  CalendarDays,
  CalendarRange,
  LayoutGrid,
  Table as TableIcon,
  ChevronDown,
  Camera,
  SlidersHorizontal,
  RefreshCw,
  Sparkles,
  Loader2,
  Pin,
  ChevronUp,
} from 'lucide-react';

import { ProcurementItem, StatusTone, PdfItemsCache } from '@/types/procurement';
import { extractFstbLast5, openTimemarkWithFstb } from '@/utils/timemark';
import { formatDateDdMmYy, formatDateDdMmYyDash, extractDateInfo } from '@/utils/formatDate';
import { cleanTujuanPeruntukan } from '@/utils/descriptionCleaner';
import { loadPdfItemsCache, savePdfItemsCache } from '@/utils/appStorage';
import { getWorkflowGroupedStatuses } from '@/utils/statusWorkflow';

// Helper formatting PIC & Status Penjelasan
const formatPicAktif = (pic?: string) => {
  if (!pic) return '-';
  return pic.replace(/\(adm\/finance\)/gi, '(ADM/PRC)');
};

const formatStatusPenjelasan = (desc?: string) => {
  if (!desc) return 'Dokumen sedang diproses';
  return desc.replace(
    /Berkas sudah di [Kk]euangan pada (.+)/gi,
    (_: string, d: string) => `Berkas sudah di administrasi purchasing pada ${formatDateDdMmYyDash(d)}`
  );
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
  showToast?: (msg: string, type?: 'info' | 'success' | 'warning' | 'error') => void;
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
  showToast,
}: ProcurementTabProps) {
  const handleOpenTimemark = (e: React.MouseEvent, fstb?: string) => {
    e.stopPropagation();
    if (!fstb) return;
    openTimemarkWithFstb(fstb, showToast);
  };

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

  // Advanced Search State
  const [showAdvancedSearch, setShowAdvancedSearch] = useState<boolean>(false);
  const [searchBarang, setSearchBarang] = useState<string>('');
  const [searchFpb, setSearchFpb] = useState<string>('');
  const [searchPo, setSearchPo] = useState<string>('');
  const [searchPic, setSearchPic] = useState<string>('');

  // Cache nama barang dari PDF e-FPB
  const [pdfCache, setPdfCache] = useState<PdfItemsCache>({});
  const [isScanningPdf, setIsScanningPdf] = useState<boolean>(false);
  const [scanProgress, setScanProgress] = useState<{ current: number; total: number } | null>(null);

  // Split View & Freeze Header Pane State
  const [splitHeight, setSplitHeight] = useState<'compact' | 'default' | 'expanded'>('default');
  const [isTableScrolled, setIsTableScrolled] = useState<boolean>(false);
  const tableContainerRef = React.useRef<HTMLDivElement>(null);

  const handleTableScroll = (e: React.UIEvent<HTMLDivElement>) => {
    setIsTableScrolled(e.currentTarget.scrollTop > 30);
  };

  const scrollToTop = () => {
    if (tableContainerRef.current) {
      tableContainerRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  useEffect(() => {
    loadPdfItemsCache().then((cached) => {
      if (cached) setPdfCache(cached);
    }).catch(() => {});
  }, []);

  // Fungsi Scan / Tarik Nama Barang dari PDF FPB yang belum ada di cache
  const handleScanPdfItems = async () => {
    // Ambil daftar FPB unik dari dataset yang belum ada di cache
    const uniqueFpbs = Array.from(new Set(items.map((i) => i.fpb).filter(Boolean)));
    const uncachedFpbs = uniqueFpbs.filter((f) => !pdfCache[f] || pdfCache[f].length === 0);

    if (uncachedFpbs.length === 0) {
      showToast?.(`Semua ${uniqueFpbs.length} FPB sudah memiliki rincian PDF di cache!`, 'success');
      return;
    }

    setIsScanningPdf(true);
    setScanProgress({ current: 0, total: uncachedFpbs.length });
    showToast?.(`Memulai pemindaian PDF untuk ${uncachedFpbs.length} FPB...`, 'info');

    let successCount = 0;
    const newCache = { ...pdfCache };

    // Batch scan paralel dengan concurrency limit 3 agar tidak membebani server
    const batchSize = 3;
    for (let i = 0; i < uncachedFpbs.length; i += batchSize) {
      const batch = uncachedFpbs.slice(i, i + batchSize);
      await Promise.all(
        batch.map(async (fpbNo) => {
          try {
            const res = await fetch(`/api/parse-fpb-pdf?fpb=${encodeURIComponent(fpbNo)}`);
            const json = await res.json();
            if (json.success && json.data && json.data.items && json.data.items.length > 0) {
              const itemNames = json.data.items.map((it: { itemName: string; description?: string; itemCode?: string }) =>
                [it.itemName, it.description, it.itemCode].filter(Boolean).join(' | ')
              );
              newCache[fpbNo] = itemNames;
              successCount++;
            }
          } catch {}
        })
      );
      setScanProgress({ current: Math.min(i + batchSize, uncachedFpbs.length), total: uncachedFpbs.length });
    }

    setPdfCache(newCache);
    await savePdfItemsCache(newCache);
    setIsScanningPdf(false);
    setScanProgress(null);
    showToast?.(`Selesai! Berhasil membaca rincian barang dari ${successCount} berkas PDF.`, 'success');
  };


  useEffect(() => {
    if (searchKeyword !== undefined) {
      setSearchTerm(searchKeyword);
    }
  }, [searchKeyword]);

  const handleSearchChange = (val: string) => {
    setSearchTerm(val);
    onSearchKeywordChange?.(val);
  };

  // Sorting State (Default: Tanggal Terbaru / Descending)
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  // View Grouping State: 'items' (All Line Items from Monitoring Layanan Armada) vs 'dossiers' (Consolidated by FPB/PO)
  const [viewGrouping, setViewGrouping] = useState<'items' | 'dossiers'>('items');

  // Pagination State
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(50);

  // View Mode: Card (mobile optimal) vs Table
  const [viewMode, setViewMode] = useState<'card' | 'table'>('table');
  const [showMobileFilters, setShowMobileFilters] = useState<boolean>(false);

  useEffect(() => {
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      setViewMode('card');
    }
  }, []);

  const toneStyles: Record<StatusTone, string> = {
    emerald: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20',
    cyan: 'bg-cyan-500/10 text-cyan-700 dark:text-cyan-400 border-cyan-500/20',
    purple: 'bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-500/20',
    amber: 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20',
    rose: 'bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/20',
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
        if (it.peruntukan) {
          existing.peruntukan = cleanTujuanPeruntukan(
            existing.peruntukan ? `${existing.peruntukan} • ${it.peruntukan}` : it.peruntukan
          );
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
    return Array.from(set);
  }, [displayBaseItems]);

  const statusCounts = useMemo(() => {
    const countsMap: Record<string, number> = {};
    for (const item of displayBaseItems) {
      if (item.statusBadge) {
        const key = item.statusBadge.trim();
        countsMap[key] = (countsMap[key] || 0) + 1;
      }
    }
    return countsMap;
  }, [displayBaseItems]);

  const workflowStatusGroups = useMemo(() => {
    return getWorkflowGroupedStatuses(uniqueStatuses, statusCounts);
  }, [uniqueStatuses, statusCounts]);

  // Counts for quick badges
  const counts = useMemo(() => {
    let critical = 0;
    let warning = 0;
    let normal = 0;
    for (const item of displayBaseItems) {
      if (item.lapseText === 'TBC' || item.lapse < 0) {
        // TBC (belum input TTB ke PIC PCH)
      } else if (item.lapse > 5) critical++;
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
    searchBarang,
    searchFpb,
    searchPo,
    searchPic,
  ]);

  // Filter items
  const filteredItems = useMemo(() => {
    return displayBaseItems.filter((row) => {
      // Entity Filter
      if (selectedEntity !== 'ALL' && row.entity?.toUpperCase() !== selectedEntity) {
        return false;
      }

      // Lapse Filter
      const isTbc = row.lapseText === 'TBC' || row.lapse < 0;
      if (selectedLapse === 'NORMAL' && (isTbc || row.lapse > 2)) return false;
      if (selectedLapse === 'WARNING' && (isTbc || row.lapse < 3 || row.lapse > 5)) return false;
      if (selectedLapse === 'CRITICAL' && (isTbc || row.lapse <= 5)) return false;

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
        const matchWo = row.workOrderNo?.toLowerCase().includes(q);
        const matchPo = row.po?.toLowerCase().includes(q);
        const matchItem = row.item?.toLowerCase().includes(q);
        const matchPeruntukan = row.peruntukan?.toLowerCase().includes(q);
        const matchDeptArmada = row.deptArmada?.toLowerCase().includes(q);
        const matchEntity = row.entity?.toLowerCase().includes(q);
        const matchPicAktif = row.picAktif?.toLowerCase().includes(q);
        const matchPicCheckFpb = row.picCheckFpb?.toLowerCase().includes(q);
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
          !matchWo &&
          !matchPo &&
          !matchItem &&
          !matchPeruntukan &&
          !matchDeptArmada &&
          !matchEntity &&
          !matchPicAktif &&
          !matchPicCheckFpb &&
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

      // Advanced Search: Spesifik Nama Barang / Item & Peruntukan (termasuk hasil scan PDF e-FPB)
      if (searchBarang.trim() !== '') {
        const qb = searchBarang.toLowerCase().trim();
        const matchItem = row.item?.toLowerCase().includes(qb);
        const matchPeruntukan = row.peruntukan?.toLowerCase().includes(qb);
        const matchKode = row.kodeBarang?.toLowerCase().includes(qb);
        const matchSatuan = row.satuan?.toLowerCase().includes(qb);

        // Cari juga di rincian item PDF e-FPB yang tersimpan di cache
        const pdfItems = row.fpb ? pdfCache[row.fpb] : undefined;
        const matchPdf = pdfItems && pdfItems.some((pi) => pi.toLowerCase().includes(qb));

        if (!matchItem && !matchPeruntukan && !matchKode && !matchSatuan && !matchPdf) {
          return false;
        }
      }

      // Advanced Search: Spesifik Nomor FPB
      if (searchFpb.trim() !== '') {
        const qf = searchFpb.toLowerCase().trim();
        if (!row.fpb?.toLowerCase().includes(qf)) {
          return false;
        }
      }

      // Advanced Search: Spesifik Nomor PO
      if (searchPo.trim() !== '') {
        const qp = searchPo.toLowerCase().trim();
        if (!row.po?.toLowerCase().includes(qp)) {
          return false;
        }
      }

      // Advanced Search: Spesifik PIC / Keterangan
      if (searchPic.trim() !== '') {
        const qpic = searchPic.toLowerCase().trim();
        const matchPic =
          row.picAktif?.toLowerCase().includes(qpic) ||
          row.picPch?.toLowerCase().includes(qpic) ||
          row.picCheckFpb?.toLowerCase().includes(qpic) ||
          row.picTtb?.toLowerCase().includes(qpic) ||
          row.picLap?.toLowerCase().includes(qpic) ||
          row.picAdm?.toLowerCase().includes(qpic);
        if (!matchPic) {
          return false;
        }
      }

      return true;
    });
  }, [
    displayBaseItems,
    selectedEntity,
    selectedLapse,
    selectedStatus,
    selectedYear,
    selectedMonth,
    startDate,
    endDate,
    searchTerm,
    searchBarang,
    searchFpb,
    searchPo,
    searchPic,
    pdfCache,
  ]);


  // Sort filtered items
  const sortedItems = useMemo(() => {
    const list = [...filteredItems];
    list.sort((a, b) => {
      // Accurate chronological sorting when sorting by date
      if (sortField === 'date') {
        const timeA = extractDateInfo(a.date).timestamp || 0;
        const timeB = extractDateInfo(b.date).timestamp || 0;
        if (timeA !== timeB) {
          return sortDirection === 'asc' ? timeA - timeB : timeB - timeA;
        }
        // Tie-breaker when dates are equal: larger FPB / PO number first
        const numA = (a.fpb || a.po || '').trim();
        const numB = (b.fpb || b.po || '').trim();
        return sortDirection === 'asc'
          ? numA.localeCompare(numB, undefined, { numeric: true, sensitivity: 'base' })
          : numB.localeCompare(numA, undefined, { numeric: true, sensitivity: 'base' });
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
    setSortField('date');
    setSortDirection('desc');
    setSearchBarang('');
    setSearchFpb('');
    setSearchPo('');
    setSearchPic('');
    setCurrentPage(1);
  };

  const hasActiveAdvancedSearch = Boolean(
    searchBarang.trim() || searchFpb.trim() || searchPo.trim() || searchPic.trim()
  );

  const isFiltered =
    searchTerm.trim() !== '' ||
    selectedEntity !== 'ALL' ||
    selectedLapse !== 'ALL' ||
    selectedStatus !== 'ALL' ||
    selectedYear !== 'ALL' ||
    selectedMonth !== 'ALL' ||
    startDate !== '' ||
    endDate !== '' ||
    hasActiveAdvancedSearch;

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border bg-card text-card-foreground shadow-sm overflow-hidden">
        {/* Header Title & Action Button */}
        <div className="flex items-center justify-between flex-wrap gap-3 p-5 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="size-9 rounded-lg border border-border bg-muted/60 text-muted-foreground flex items-center justify-center">
              <FileSpreadsheet className="w-4.5 h-4.5 text-foreground" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-sm font-semibold tracking-tight text-foreground">
                  Monitoring Pengadaan & Layanan Armada
                </h3>
                <span className="rounded-full px-2 py-0.5 text-[10px] font-medium border bg-muted/60 text-muted-foreground border-border">
                  Acuan Utama: Monitoring Layanan Armada
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Alur rantai pertanggungjawaban fisik dokumen dan layanan armada dari Purchasing, Logistik TTB, Kru Lapangan, hingga Staf Keuangan.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {/* View Mode Switcher: Cards (mobile-friendly) vs Table */}
            <div className="flex items-center bg-muted/60 p-0.5 rounded-lg border border-border">
              <button
                type="button"
                onClick={() => setViewMode('card')}
                className={`h-7 px-2.5 rounded-md text-xs font-medium flex items-center gap-1.5 transition touch-manipulation ${
                  viewMode === 'card'
                    ? 'bg-background text-foreground shadow-xs font-semibold'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
                title="Tampilan Kartu Ringkas (Optimal untuk HP)"
              >
                <LayoutGrid className="size-3.5" />
                <span>Kartu</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('table')}
                className={`h-7 px-2.5 rounded-md text-xs font-medium flex items-center gap-1.5 transition touch-manipulation ${
                  viewMode === 'table'
                    ? 'bg-background text-foreground shadow-xs font-semibold'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
                title="Tampilan Tabel Lengkap"
              >
                <TableIcon className="size-3.5" />
                <span>Tabel</span>
              </button>
            </div>

            {/* View Grouping Toggle: Per Item Armada vs Ringkasan Berkas/PO */}
            <div className="hidden sm:flex items-center bg-muted/60 p-0.5 rounded-lg border border-border text-xs">
              <button
                type="button"
                onClick={() => setViewGrouping('items')}
                className={`h-7 px-2.5 rounded-md text-xs font-medium transition ${
                  viewGrouping === 'items'
                    ? 'bg-background text-foreground shadow-sm border border-border/80 font-semibold'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
                title="Tampilkan setiap baris item dari sheet Monitoring Layanan Armada"
              >
                Semua Item ({items.length.toLocaleString()})
              </button>
              <button
                type="button"
                onClick={() => setViewGrouping('dossiers')}
                className={`h-7 px-2.5 rounded-md text-xs font-medium transition ${
                  viewGrouping === 'dossiers'
                    ? 'bg-background text-foreground shadow-sm border border-border/80 font-semibold'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
                title="Kelompokkan data per berkas PO / FPB"
              >
                Ringkasan Berkas
              </button>
            </div>

            <button
              onClick={onOpenNewRecord}
              className="h-8 px-3 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg text-xs font-medium flex items-center gap-1.5 transition shadow-sm touch-manipulation active:scale-95"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Input Berkas</span>
            </button>
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════════
            FILTER & SEARCH BAR CONTROL
            ═══════════════════════════════════════════════════════════ */}
        <div className="p-3 sm:p-4 bg-muted/20 border-b border-border space-y-3">
          {/* Row 1: Search Input & Quick Lapse Filter Buttons */}
          <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
            {/* Search Input Form & Mobile Filter Button */}
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const input = e.currentTarget.querySelector('input');
                  input?.blur();
                }}
                className="flex items-center gap-2 flex-1 min-w-0"
              >
                <div className="relative flex-1 min-w-0">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => handleSearchChange(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.currentTarget.blur();
                      }
                    }}
                    placeholder="Cari Nama Kapal / Pencarian Cepat..."
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
              </form>

              {/* Advanced Search Toggle Button */}
              <button
                type="button"
                onClick={() => setShowAdvancedSearch((prev) => !prev)}
                className={`h-8 px-2.5 rounded-lg border text-xs font-medium flex items-center gap-1.5 transition whitespace-nowrap shrink-0 ${
                  hasActiveAdvancedSearch
                    ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30 font-semibold'
                    : showAdvancedSearch
                    ? 'bg-muted text-foreground border-border'
                    : 'bg-background text-muted-foreground hover:text-foreground border-border hover:bg-muted'
                }`}
                title="Buka / Tutup Pencarian Lanjutan (Spesifik Nama Barang, FPB, PO, PIC)"
              >
                <SlidersHorizontal className="size-3.5" />
                <span className="hidden sm:inline">Advanced Search</span>
                <span className="sm:hidden">Adv</span>
                {hasActiveAdvancedSearch && (
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                )}
                <ChevronDown className={`size-3 transition-transform ${showAdvancedSearch ? 'rotate-180' : ''}`} />
              </button>

              {/* Mobile Filter Toggle Button */}
              <button
                type="button"
                onClick={() => setShowMobileFilters((prev) => !prev)}
                className="sm:hidden h-8 px-2.5 rounded-lg border border-border bg-background text-xs font-medium flex items-center gap-1 text-muted-foreground hover:text-foreground shrink-0 transition"
              >
                <Filter className="size-3.5" />
                <span>Filter</span>
                <ChevronDown className={`size-3 transition-transform ${showMobileFilters ? 'rotate-180' : ''}`} />
              </button>
            </div>

            {/* Quick Lapse Filter Buttons */}
            <div className={`${showMobileFilters ? 'flex' : 'hidden'} sm:flex items-center gap-1.5 overflow-x-auto pb-1 lg:pb-0 text-xs`}>
              <span className="text-muted-foreground text-[11px] font-medium mr-1 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                Lapse:
              </span>
              <button
                onClick={() => setSelectedLapse('ALL')}
                className={`h-7 px-2.5 rounded-lg text-xs font-medium transition whitespace-nowrap border ${
                  selectedLapse === 'ALL'
                    ? 'bg-foreground text-background border-foreground font-semibold'
                    : 'bg-background text-muted-foreground hover:text-foreground border-border hover:bg-muted'
                }`}
              >
                Semua ({items.length})
              </button>
              <button
                onClick={() => setSelectedLapse('CRITICAL')}
                className={`h-7 px-2.5 rounded-lg text-xs font-medium transition whitespace-nowrap flex items-center gap-1.5 border ${
                  selectedLapse === 'CRITICAL'
                    ? 'bg-rose-500/10 text-rose-400 border-rose-500/30 font-semibold'
                    : 'bg-background text-muted-foreground hover:text-foreground border-border hover:bg-muted'
                }`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
                <span>Kritis &gt;5 Hari ({counts.critical})</span>
              </button>
              <button
                onClick={() => setSelectedLapse('WARNING')}
                className={`h-7 px-2.5 rounded-lg text-xs font-medium transition whitespace-nowrap border ${
                  selectedLapse === 'WARNING'
                    ? 'bg-amber-500/10 text-amber-400 border-amber-500/30 font-semibold'
                    : 'bg-background text-muted-foreground hover:text-foreground border-border hover:bg-muted'
                }`}
              >
                Perhatian 3-5 Hari ({counts.warning})
              </button>
              <button
                onClick={() => setSelectedLapse('NORMAL')}
                className={`h-7 px-2.5 rounded-lg text-xs font-medium transition whitespace-nowrap border ${
                  selectedLapse === 'NORMAL'
                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 font-semibold'
                    : 'bg-background text-muted-foreground hover:text-foreground border-border hover:bg-muted'
                }`}
              >
                Normal ≤2 Hari ({counts.normal})
              </button>
            </div>
          </div>

          {/* ═══════════════════════════════════════════════════════════
              COLLAPSIBLE ADVANCED SEARCH PANEL
              ═══════════════════════════════════════════════════════════ */}
          {showAdvancedSearch && (
            <div className="p-3.5 rounded-xl bg-card border border-border/80 shadow-xs space-y-3 animate-in fade-in-50 duration-150">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <SlidersHorizontal className="size-3.5 text-amber-500" />
                  <span className="text-xs font-semibold text-foreground">
                    Advanced Search (Pencarian Spesifik Kolom)
                  </span>
                  <span className="text-[11px] text-muted-foreground hidden sm:inline">
                    &bull; Otomatis realtime tanpa reload halaman
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {/* Tombol Scan Nama Barang dari PDF e-FPB */}
                  <button
                    type="button"
                    onClick={handleScanPdfItems}
                    disabled={isScanningPdf}
                    className={`h-7 px-2.5 rounded-lg text-[11px] font-medium flex items-center gap-1.5 transition border ${
                      isScanningPdf
                        ? 'bg-amber-500/10 text-amber-400 border-amber-500/30 cursor-wait'
                        : 'bg-muted/70 hover:bg-muted text-muted-foreground hover:text-foreground border-border'
                    }`}
                    title="Pindai seluruh rincian nama barang dari PDF e-FPB untuk memperluas pencarian"
                  >
                    {isScanningPdf ? (
                      <>
                        <Loader2 className="size-3 animate-spin text-amber-500" />
                        <span>
                          Memindai PDF ({scanProgress ? `${scanProgress.current}/${scanProgress.total}` : '...'})
                        </span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="size-3 text-amber-500" />
                        <span>
                          Scan Rincian PDF ({Object.keys(pdfCache).length} siap dicari)
                        </span>
                      </>
                    )}
                  </button>

                  {hasActiveAdvancedSearch && (
                    <button
                      type="button"
                      onClick={() => {
                        setSearchBarang('');
                        setSearchFpb('');
                        setSearchPo('');
                        setSearchPic('');
                      }}
                      className="text-[11px] text-rose-500 hover:text-rose-400 flex items-center gap-1 hover:underline transition"
                    >
                      <RotateCcw className="size-3" />
                      <span>Bersihkan Input</span>
                    </button>
                  )}
                </div>
              </div>


              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 text-xs">
                {/* 1. Spesifik Nama Barang / Item & Peruntukan */}
                <div>
                  <label className="block text-[11px] font-medium text-foreground mb-1">
                    Nama Barang / Item:
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={searchBarang}
                      onChange={(e) => setSearchBarang(e.target.value)}
                      placeholder="Cth: Oli, Filter, Pompa, Valve..."
                      className="w-full h-8 px-2.5 pr-7 bg-background border border-border rounded-lg text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                    />
                    {searchBarang && (
                      <button
                        type="button"
                        onClick={() => setSearchBarang('')}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        title="Hapus filter barang"
                      >
                        <X className="size-3" />
                      </button>
                    )}
                  </div>
                </div>

                {/* 2. Spesifik Nomor FPB Asal */}
                <div>
                  <label className="block text-[11px] font-medium text-foreground mb-1">
                    No. FPB Asal:
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={searchFpb}
                      onChange={(e) => setSearchFpb(e.target.value)}
                      placeholder="Cth: HL-FPB-26-0001391..."
                      className="w-full h-8 px-2.5 pr-7 bg-background border border-border rounded-lg text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring font-mono"
                    />
                    {searchFpb && (
                      <button
                        type="button"
                        onClick={() => setSearchFpb('')}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        title="Hapus filter FPB"
                      >
                        <X className="size-3" />
                      </button>
                    )}
                  </div>
                </div>

                {/* 3. Spesifik Nomor PO */}
                <div>
                  <label className="block text-[11px] font-medium text-foreground mb-1">
                    No. PO (Purchase Order):
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={searchPo}
                      onChange={(e) => setSearchPo(e.target.value)}
                      placeholder="Cth: HL-PO-26-01639..."
                      className="w-full h-8 px-2.5 pr-7 bg-background border border-border rounded-lg text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring font-mono"
                    />
                    {searchPo && (
                      <button
                        type="button"
                        onClick={() => setSearchPo('')}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        title="Hapus filter PO"
                      >
                        <X className="size-3" />
                      </button>
                    )}
                  </div>
                </div>

                {/* 4. PIC / Keterangan */}
                <div>
                  <label className="block text-[11px] font-medium text-foreground mb-1">
                    PIC / Petugas:
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={searchPic}
                      onChange={(e) => setSearchPic(e.target.value)}
                      placeholder="Cth: Elsa, Melinda, Logistics..."
                      className="w-full h-8 px-2.5 pr-7 bg-background border border-border rounded-lg text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                    />
                    {searchPic && (
                      <button
                        type="button"
                        onClick={() => setSearchPic('')}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        title="Hapus filter PIC"
                      >
                        <X className="size-3" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

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

              {/* Rentang Tanggal PO (Date Range) */}
              <div className="flex items-center gap-1.5 bg-background h-8 px-2.5 rounded-lg border border-border text-foreground">
                <CalendarRange className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-muted-foreground text-[11px]">Tgl PO:</span>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="bg-transparent text-foreground text-xs focus:outline-none font-mono cursor-pointer"
                  title="Dari Tanggal PO"
                />
                <span className="text-muted-foreground text-[11px]">&ndash;</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="bg-transparent text-foreground text-xs focus:outline-none font-mono cursor-pointer"
                  title="Sampai Tanggal PO"
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
                title="Urutkan tanggal PO terbaru di atas"
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
                title="Urutkan tanggal PO terlama di atas"
              >
                <ArrowUp className="w-3 h-3" />
                <span>Terlama</span>
              </button>
            </div>
          </div>

          {/* Row 3: Secondary Dropdowns & Lapse Controls */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-border/60 text-xs">
            <div className="flex flex-wrap items-center gap-2">
              {/* Entitas / PT Filter */}
              {uniqueEntities.length > 0 && (
                <div className="flex items-center gap-1.5">
                  <span className="text-muted-foreground text-[11px] flex items-center gap-1">
                    <Building2 className="w-3.5 h-3.5 text-muted-foreground" />
                    PT:
                  </span>
                  <select
                    value={selectedEntity}
                    onChange={(e) => setSelectedEntity(e.target.value)}
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

              {/* Status Berkas Filter */}
              {uniqueStatuses.length > 0 && (
                <div className="flex items-center gap-1.5">
                  <span className="text-muted-foreground text-[11px] flex items-center gap-1">
                    <Filter className="w-3.5 h-3.5 text-muted-foreground" />
                    Status:
                  </span>
                  <select
                    value={selectedStatus}
                    onChange={(e) => setSelectedStatus(e.target.value)}
                    className="h-7 bg-background border border-border text-foreground text-xs rounded-lg px-2.5 focus:outline-none focus:ring-1 focus:ring-ring max-w-[260px] font-medium"
                  >
                    <option value="ALL">Semua Status ({displayBaseItems.length})</option>
                    {workflowStatusGroups.map((group) => (
                      <optgroup
                        key={group.moduleCode}
                        label={group.moduleTitle}
                        className="font-semibold text-muted-foreground bg-muted/60"
                      >
                        {group.options.map((opt) => (
                          <option
                            key={opt.value}
                            value={opt.value}
                            className="font-normal text-foreground bg-background"
                          >
                            {opt.label}{opt.count !== undefined ? ` (${opt.count})` : ''}
                          </option>
                        ))}
                      </optgroup>
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
                className={`h-7 px-2.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition border ${
                  sortField === 'lapse' && sortDirection === 'desc'
                    ? 'bg-rose-500/10 text-rose-400 border-rose-500/30 font-semibold'
                    : 'bg-background text-muted-foreground hover:text-foreground border-border hover:bg-muted'
                }`}
                title="Urutkan berkas dengan durasi tertunda paling lama"
              >
                <AlertTriangle className="w-3 h-3 text-rose-400" />
                <span>Lapse Tertinggi</span>
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
                dari {items.length.toLocaleString()} berkas
              </span>
              <span className="text-border">|</span>
              <span>
                Urutan:{' '}
                <strong className="text-foreground font-mono uppercase">
                  {sortField === 'date'
                    ? `Tanggal PO (${sortDirection === 'desc' ? 'Terbaru' : 'Terlama'})`
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
                {selectedEntity !== 'ALL' && (
                  <span className="px-2 py-0.5 rounded-full bg-background border border-border text-foreground font-mono text-[11px]">
                    PT: {selectedEntity}
                  </span>
                )}
                {selectedLapse !== 'ALL' && (
                  <span className="px-2 py-0.5 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-400 font-mono text-[11px]">
                    Lapse: {selectedLapse}
                  </span>
                )}
                {selectedStatus !== 'ALL' && (
                  <span className="px-2 py-0.5 rounded-full bg-background border border-border text-foreground font-mono text-[11px]">
                    Status: {selectedStatus}
                  </span>
                )}
                {searchBarang.trim() !== '' && (
                  <span className="px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30 font-mono text-[11px] flex items-center gap-1">
                    <span>Barang: &quot;{searchBarang}&quot;</span>
                    <button
                      type="button"
                      onClick={() => setSearchBarang('')}
                      className="hover:text-rose-500 transition"
                      title="Hapus filter barang"
                    >
                      <X className="w-2.5 h-2.5" />
                    </button>
                  </span>
                )}
                {searchFpb.trim() !== '' && (
                  <span className="px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/30 font-mono text-[11px] flex items-center gap-1">
                    <span>FPB: &quot;{searchFpb}&quot;</span>
                    <button
                      type="button"
                      onClick={() => setSearchFpb('')}
                      className="hover:text-rose-500 transition"
                      title="Hapus filter FPB"
                    >
                      <X className="w-2.5 h-2.5" />
                    </button>
                  </span>
                )}
                {searchPo.trim() !== '' && (
                  <span className="px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/30 font-mono text-[11px] flex items-center gap-1">
                    <span>PO: &quot;{searchPo}&quot;</span>
                    <button
                      type="button"
                      onClick={() => setSearchPo('')}
                      className="hover:text-rose-500 transition"
                      title="Hapus filter PO"
                    >
                      <X className="w-2.5 h-2.5" />
                    </button>
                  </span>
                )}
                {searchPic.trim() !== '' && (
                  <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 font-mono text-[11px] flex items-center gap-1">
                    <span>PIC: &quot;{searchPic}&quot;</span>
                    <button
                      type="button"
                      onClick={() => setSearchPic('')}
                      className="hover:text-rose-500 transition"
                      title="Hapus filter PIC"
                    >
                      <X className="w-2.5 h-2.5" />
                    </button>
                  </span>
                )}
                <span className="text-muted-foreground font-mono text-[11px]">
                  ({sortedItems.length} berkas ditemukan)
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
            CONTENT AREA: CARD VIEW (OPTIMAL FOR PHONE) OR TABLE VIEW
            ═══════════════════════════════════════════════════════════ */}
        {viewMode === 'card' ? (
          <div>
            {paginatedItems.length === 0 ? (
              <div className="p-10 text-center text-muted-foreground">
                <div className="flex flex-col items-center justify-center gap-2">
                  <FileSpreadsheet className="w-8 h-8 opacity-30 text-muted-foreground" />
                  <p className="text-sm font-medium text-foreground">
                    Tidak ada berkas yang cocok dengan filter
                  </p>
                  <p className="text-xs text-muted-foreground max-w-md">
                    Coba sesuaikan kata kunci pencarian, filter status, filter lapse day, atau klik tombol Reset Filter.
                  </p>
                  {isFiltered && (
                    <button
                      onClick={handleResetFilters}
                      className="mt-2 h-8 px-3 bg-muted hover:bg-muted/80 text-foreground border border-border rounded-lg text-xs font-medium transition"
                    >
                      Tampilkan Semua Berkas
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div className="p-3 sm:p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {paginatedItems.map((row) => {
                  const badgeClass = toneStyles[row.statusTone] || toneStyles.cyan;
                  const isTbc = row.lapseText === 'TBC' || row.lapse < 0;
                  const lapseBadgeClass = isTbc
                    ? 'bg-slate-500/10 text-slate-700 dark:text-slate-300 border-slate-500/20'
                    : row.lapse <= 2
                    ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20'
                    : row.lapse <= 4
                    ? 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20'
                    : 'bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/20';

                  const cleanRowFpb = (row.fpb || '').trim().replace(/^["']|["']$/g, '');
                  const fpbDocNum = cleanRowFpb || (row.po || '').trim().replace(/^["']|["']$/g, '');
                  const rowPdfUrl = fpbDocNum
                    ? `https://e-fpb.cindaragroup.com/files/logistik_Approved_rev_sign_${encodeURIComponent(cleanRowFpb || fpbDocNum)}.pdf`
                    : null;

                  return (
                    <div
                      key={row.id || `${row.fpb}-${row.po}-${row.item}-${row.date}`}
                      onClick={() => onOpenAudit(row.fpb, row.po)}
                      className="rounded-xl border border-border bg-card hover:border-foreground/30 p-3.5 transition shadow-xs hover:shadow-subtle cursor-pointer flex flex-col justify-between gap-2.5 active:scale-[0.99] touch-manipulation group"
                    >
                      {/* Header */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="flex size-7.5 shrink-0 items-center justify-center rounded-lg border border-border bg-muted/60 text-sky-500">
                            <FileText className="size-4" />
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-mono font-bold text-xs text-foreground group-hover:text-primary transition truncate">
                                {row.fpb}
                              </span>
                            </div>
                            <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-muted border border-border text-muted-foreground inline-block">
                                {row.entity}
                              </span>
                              {row.workOrderNo && (
                                <span
                                  className="text-[10px] font-mono font-semibold px-1.5 py-0.2 rounded bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-400 inline-flex items-center gap-0.5"
                                  title={`Nomor Work Order Operasional: ${row.workOrderNo}`}
                                >
                                  <span>🔧 WO:</span>
                                  <span className="truncate max-w-[120px]">{row.workOrderNo}</span>
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        <span
                          className={`shrink-0 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold border ${lapseBadgeClass}`}
                          title={isTbc ? 'TBC (To Be Confirmed) - Tanggal TTB ke PIC PCH belum diinput' : `${row.lapse} Hari`}
                        >
                          {isTbc ? 'TBC' : `${row.lapse} Hari`}
                        </span>
                      </div>

                      {/* Body */}
                      <div className="space-y-1 text-xs">
                        <div className="flex items-center justify-between text-[11px] text-muted-foreground font-mono">
                          <span>PO: <strong className="text-foreground">{row.po && row.po !== '-' ? row.po : 'Belum Ada'}</strong></span>
                          <span>{formatDateDdMmYy(row.date)}</span>
                        </div>
                        <p className="font-medium text-foreground text-xs line-clamp-2 mt-1">
                          {row.item}
                        </p>
                        {row.qtyFPB !== undefined && row.qtyFPB > 0 && (
                          <span className="inline-block px-1.5 py-0.2 rounded bg-muted text-[10px] font-mono text-muted-foreground border border-border/80">
                            Qty: {row.qtyFPB} {row.satuan || ''}
                          </span>
                        )}
                        {row.peruntukan && (
                          <p className="text-[11px] text-muted-foreground line-clamp-1">
                            Peruntukan: <span className="text-foreground">{row.peruntukan}</span>
                          </p>
                        )}
                      </div>

                      {/* Footer */}
                      <div className="pt-2 border-t border-border/60 flex items-center justify-between gap-2 text-xs">
                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-medium border truncate max-w-[160px] ${badgeClass}`}>
                          {row.statusBadge}
                        </span>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onOpenAudit(row.fpb, row.po);
                            }}
                            className="h-6.5 px-2 rounded-md bg-muted hover:bg-muted/80 text-[11px] font-medium text-foreground inline-flex items-center gap-1 border border-border transition touch-manipulation"
                          >
                            <span>Detail</span>
                            <ArrowRight className="size-2.5 opacity-70" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          /* Table Container with Split Freeze Header */
          <div className="relative w-full">
            {/* Split / Freeze Panes Status & Controls */}
            <div className="py-2.5 px-3.5 border-b border-border bg-muted/40 flex items-center justify-between gap-3 text-xs flex-wrap">
              <div className="flex items-center gap-2 flex-wrap">
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-primary/10 text-primary border border-primary/20 shadow-2xs">
                  <Pin className="size-3 text-primary rotate-45" />
                  <span>Header Terkunci (Split Scroll Aktif)</span>
                  <span className="size-1.5 rounded-full bg-primary animate-pulse"></span>
                </div>
                <span className="text-[11px] text-muted-foreground hidden md:inline">
                  Judul kolom tetap melayang di atas saat scroll ke bawah
                </span>
              </div>

              <div className="flex items-center gap-2 ml-auto flex-wrap">
                <div className="flex items-center gap-1 bg-background border border-border p-0.5 rounded-lg text-[11px]">
                  <span className="px-2 text-muted-foreground text-[10px] font-medium hidden sm:inline">
                    Tinggi Panel:
                  </span>
                  <button
                    type="button"
                    onClick={() => setSplitHeight('compact')}
                    className={`px-2 py-0.5 rounded-md font-medium transition cursor-pointer ${
                      splitHeight === 'compact'
                        ? 'bg-primary text-primary-foreground shadow-xs font-semibold'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                    title="Tinggi Ringkas (500px)"
                  >
                    500px
                  </button>
                  <button
                    type="button"
                    onClick={() => setSplitHeight('default')}
                    className={`px-2 py-0.5 rounded-md font-medium transition cursor-pointer ${
                      splitHeight === 'default'
                        ? 'bg-primary text-primary-foreground shadow-xs font-semibold'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                    title="Tinggi Fokus Layar (72vh - Rekomendasi)"
                  >
                    Fokus (72vh)
                  </button>
                  <button
                    type="button"
                    onClick={() => setSplitHeight('expanded')}
                    className={`px-2 py-0.5 rounded-md font-medium transition cursor-pointer ${
                      splitHeight === 'expanded'
                        ? 'bg-primary text-primary-foreground shadow-xs font-semibold'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                    title="Tinggi Bebas (Mengikuti Seluruh Baris)"
                  >
                    Penuh
                  </button>
                </div>

                {isTableScrolled && (
                  <button
                    type="button"
                    onClick={scrollToTop}
                    className="h-7 px-2.5 rounded-lg border border-primary/30 bg-primary/10 hover:bg-primary/20 text-primary text-[11px] font-semibold flex items-center gap-1 transition shadow-xs cursor-pointer active:scale-95 animate-in fade-in"
                    title="Kembali ke baris teratas"
                  >
                    <ChevronUp className="size-3.5" />
                    <span className="hidden sm:inline">Ke Atas</span>
                  </button>
                )}
              </div>
            </div>

            {/* Scroll Container with Freeze Header */}
            <div
              ref={tableContainerRef}
              onScroll={handleTableScroll}
              className={`overflow-auto relative transition-all duration-200 ${
                splitHeight === 'compact'
                  ? 'max-h-[500px]'
                  : splitHeight === 'default'
                  ? 'max-h-[72vh]'
                  : 'max-h-none'
              }`}
            >
              <table className="w-full text-left text-xs text-foreground border-collapse">
                <thead className="sticky top-0 z-20 bg-muted/95 dark:bg-card/95 backdrop-blur-md text-[11px] font-medium text-muted-foreground uppercase tracking-wider border-b border-border shadow-[0_2px_8px_rgba(0,0,0,0.06)] dark:shadow-[0_2px_8px_rgba(0,0,0,0.35)] select-none">
                  <tr>
                    <th
                      onClick={() => handleSort('fpb')}
                      className="p-3.5 cursor-pointer hover:text-foreground transition group whitespace-nowrap sticky top-0 z-20 bg-muted/95 dark:bg-card/95 backdrop-blur-md"
                    >
                      <span className="flex items-center">
                        NO FPB & ENTITAS
                        {renderSortIndicator('fpb')}
                      </span>
                    </th>
                    <th
                      onClick={() => handleSort('po')}
                      className="p-3.5 cursor-pointer hover:text-foreground transition group whitespace-nowrap sticky top-0 z-20 bg-muted/95 dark:bg-card/95 backdrop-blur-md"
                    >
                      <span className="flex items-center">
                        NO PO INTERNAL
                        {renderSortIndicator('po')}
                      </span>
                    </th>
                    <th
                      onClick={() => handleSort('date')}
                      className="p-3.5 cursor-pointer hover:text-foreground transition group whitespace-nowrap sticky top-0 z-20 bg-muted/95 dark:bg-card/95 backdrop-blur-md"
                    >
                      <span className="flex items-center">
                        TANGGAL PO
                        {renderSortIndicator('date')}
                      </span>
                    </th>
                    <th
                      onClick={() => handleSort('item')}
                      className="p-3.5 cursor-pointer hover:text-foreground transition group sticky top-0 z-20 bg-muted/95 dark:bg-card/95 backdrop-blur-md"
                    >
                      <span className="flex items-center">
                        ARMADA
                        {renderSortIndicator('item')}
                      </span>
                    </th>
                    <th
                      onClick={() => handleSort('statusBadge')}
                      className="p-3.5 cursor-pointer hover:text-foreground transition group sticky top-0 z-20 bg-muted/95 dark:bg-card/95 backdrop-blur-md"
                    >
                      <span className="flex items-center">
                        STATUS BERKAS & PIC
                        {renderSortIndicator('statusBadge')}
                      </span>
                    </th>
                    <th
                      onClick={() => handleSort('lapse')}
                      className="p-3.5 text-center cursor-pointer hover:text-foreground transition group whitespace-nowrap sticky top-0 z-20 bg-muted/95 dark:bg-card/95 backdrop-blur-md"
                    >
                      <span className="flex items-center justify-center font-semibold">
                        LAPSE DAY
                        {renderSortIndicator('lapse')}
                      </span>
                    </th>
                    <th className="p-3.5 text-center whitespace-nowrap sticky top-0 z-20 bg-muted/95 dark:bg-card/95 backdrop-blur-md">AKSI</th>
                  </tr>
                </thead>
            <tbody className="divide-y divide-border/60">
              {paginatedItems.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-10 text-center text-muted-foreground">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <FileSpreadsheet className="w-8 h-8 opacity-30 text-muted-foreground" />
                      <p className="text-sm font-medium text-foreground">
                        Tidak ada berkas yang cocok dengan filter
                      </p>
                      <p className="text-xs text-muted-foreground max-w-md">
                        Coba sesuaikan kata kunci pencarian, filter status, filter lapse day, atau klik tombol Reset Filter.
                      </p>
                      {isFiltered && (
                        <button
                          onClick={handleResetFilters}
                          className="mt-2 h-8 px-3 bg-muted hover:bg-muted/80 text-foreground border border-border rounded-lg text-xs font-medium transition"
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
                  const isTbc = row.lapseText === 'TBC' || row.lapse < 0;
                  const lapseBadgeClass = isTbc
                    ? 'bg-slate-500/10 text-slate-700 dark:text-slate-300 border-slate-500/20'
                    : row.lapse <= 2
                    ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20'
                    : row.lapse <= 4
                    ? 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20'
                    : 'bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/20';

                  const cleanRowFpb = (row.fpb || '').trim().replace(/^["']|["']$/g, '');
                  const fpbDocNum = cleanRowFpb || (row.po || '').trim().replace(/^["']|["']$/g, '');
                  const rowPdfUrl = fpbDocNum
                    ? `https://e-fpb.cindaragroup.com/files/logistik_Approved_rev_sign_${encodeURIComponent(cleanRowFpb || fpbDocNum)}.pdf`
                    : null;

                  return (
                    <tr
                      key={row.id || `${row.fpb}-${row.po}-${row.item}-${row.date}`}
                      onClick={() => onOpenAudit(row.fpb, row.po)}
                      className="hover:bg-muted/30 cursor-pointer transition group"
                    >
                      <td className="p-3.5">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onOpenAudit(row.fpb, row.po);
                            }}
                            className="font-mono font-medium text-foreground hover:underline flex items-center gap-1.5 text-left"
                          >
                            <span>{row.fpb}</span>
                            <ExternalLink className="w-3 h-3 text-muted-foreground group-hover:text-foreground transition-colors" />
                          </button>
                        </div>
                        <div className="flex items-center gap-1.5 flex-wrap mt-1">
                          <span className="inline-block px-1.5 py-0.5 bg-muted text-muted-foreground rounded text-[10px] font-mono border border-border">
                            {row.entity}
                          </span>
                          {row.workOrderNo && (
                            <span
                              className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-400"
                              title={`Nomor Work Order Operasional: ${row.workOrderNo}`}
                            >
                              <span>🔧 WO:</span>
                              <span className="truncate max-w-[130px]">{row.workOrderNo}</span>
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="p-3.5">
                        {row.po && row.po !== '-' ? (
                          <span className="font-mono text-foreground">{row.po}</span>
                        ) : (
                          <span className="font-mono text-muted-foreground italic text-[11px]">- (Kosong)</span>
                        )}
                      </td>
                      <td className="p-3.5 font-mono text-muted-foreground">{formatDateDdMmYy(row.date)}</td>
                      <td className="p-3.5 max-w-[290px]">
                        <div className="font-medium text-foreground flex items-center gap-1.5 flex-wrap">
                          <span>{row.deptArmada || row.item}</span>
                          {row.qtyFPB !== undefined && row.qtyFPB > 0 && (
                            <span className="px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground border border-border text-[10px] font-mono whitespace-nowrap">
                              {row.qtyFPB} {row.satuan || ''}
                            </span>
                          )}
                        </div>
                        {row.fpb && pdfCache[row.fpb] && pdfCache[row.fpb].length > 0 && (
                          <div className="mt-1 flex items-center gap-1 flex-wrap">
                            <span className="px-1.5 py-0.2 rounded bg-amber-500/10 text-amber-500 border border-amber-500/20 text-[9px] font-medium inline-flex items-center gap-0.5" title={`Rincian PDF: ${pdfCache[row.fpb].join(', ')}`}>
                              <Sparkles className="size-2.5" />
                              <span>{pdfCache[row.fpb].length} item PDF</span>
                            </span>
                          </div>
                        )}
                      </td>

                      <td className="p-3.5">
                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span
                              className={`px-2 py-0.5 rounded-full font-mono text-[10px] font-medium border ${badgeClass}`}
                            >
                              {row.statusBadge || 'TERDATA'}
                            </span>
                            <span className="px-2 py-0.5 rounded bg-muted border border-border text-foreground text-[10px] font-medium flex items-center gap-1">
                              <span className="text-muted-foreground">PIC:</span>
                              <span className="font-mono">
                                {formatPicAktif(row.picAktif || row.picPch)}
                              </span>
                            </span>
                          </div>
                          <div className="text-[11px] text-muted-foreground leading-snug">
                            {formatStatusPenjelasan(row.statusPenjelasan)}
                          </div>
                          <div className="text-[10px] text-muted-foreground font-mono flex items-center gap-2 pt-0.5">
                            <span>
                              PCH:{' '}
                              <strong className="text-foreground">{row.picPch || '-'}</strong>
                            </span>
                            <span>&bull;</span>
                            <span>
                              TTB:{' '}
                              <strong className="text-foreground">{row.picTtb || '-'}</strong>
                            </span>
                            <span>&bull;</span>
                            <span>
                              LAP:{' '}
                              <strong className="text-foreground">{row.picLap || '-'}</strong>
                            </span>
                          </div>
                          {row.noFstb && (
                            <div className="pt-0.5">
                              <button
                                type="button"
                                onClick={(e) => handleOpenTimemark(e, row.noFstb)}
                                className="inline-flex items-center gap-1 text-[10px] text-amber-700 dark:text-amber-400 bg-amber-500/10 hover:bg-amber-500/20 px-1.5 py-0.5 rounded border border-amber-500/20 font-medium transition active:scale-95"
                                title={`Cek Foto TimeMark (${extractFstbLast5(row.noFstb)})`}
                              >
                                <Camera className="size-2.5 text-amber-600 dark:text-amber-400" />
                                <span>FSTB: {extractFstbLast5(row.noFstb)}</span>
                              </button>
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="p-3.5 text-center">
                        <span
                          className={`inline-block px-2.5 py-0.5 rounded-full font-mono text-xs font-semibold border ${lapseBadgeClass}`}
                          title={isTbc ? 'TBC (To Be Confirmed) - Tanggal TTB ke PIC PCH belum diinput' : `${row.lapse} Hari`}
                        >
                          {isTbc ? 'TBC' : `${row.lapse} Hari`}
                        </span>
                      </td>
                      <td className="p-3.5 text-center" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => onOpenAudit(row.fpb, row.po)}
                            className="h-7 px-2.5 bg-background hover:bg-muted border border-border text-foreground rounded-lg text-xs font-medium transition flex items-center gap-1"
                          >
                            <span>Detail</span>
                            <ArrowRight className="w-3 h-3 text-muted-foreground" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Floating Quick Back to Top Button */}
        {isTableScrolled && splitHeight !== 'expanded' && (
          <button
            type="button"
            onClick={scrollToTop}
            className="absolute bottom-16 right-5 z-30 shadow-lg bg-foreground text-background hover:bg-foreground/90 font-semibold text-xs py-1.5 px-3.5 rounded-full flex items-center gap-1.5 transition active:scale-95 cursor-pointer animate-in fade-in slide-in-from-bottom-2 duration-200 border border-border/40 shadow-primary/10"
            title="Kembali ke baris pertama tabel"
          >
            <ChevronUp className="size-3.5" />
            <span>Kembali ke Atas</span>
          </button>
        )}
      </div>
    )}

        {/* ═══════════════════════════════════════════════════════════
            PAGINATION & STATUS FOOTER
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
