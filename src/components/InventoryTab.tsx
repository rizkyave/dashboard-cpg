'use client';

import React, { useState, useMemo, useRef } from 'react';
import {
  Search,
  Boxes,
  PackageCheck,
  PackageX,
  Layers,
  Building2,
  Filter,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Eye,
  CheckCircle2,
  AlertTriangle,
  FileSpreadsheet,
  ArrowUpDown,
  Sparkles,
  GitCompare,
  TrendingUp,
  X,
  ExternalLink,
  Copy,
  Check,
  Upload,
  RotateCcw,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import {
  InventoryItem,
  InventorySummary,
  ProcurementItem,
  ArmadaItem,
} from '@/types/procurement';
import { parseInventoryWorkbook } from '@/utils/inventoryParser';
import { determineCategory } from '@/utils/categoryClassifier';

interface InventoryTabProps {
  items: InventoryItem[];
  summary: InventorySummary | null;
  isLoading?: boolean;
  procurementItems?: ProcurementItem[];
  armadaItems?: ArmadaItem[];
  onUpdateInventory: (newItems: InventoryItem[], newSummary?: InventorySummary | null) => void;
  onLoadSampleInventory?: () => void;
  showToast?: (msg: string, type?: 'info' | 'success' | 'warning' | 'error') => void;
}

type StockStatusFilter = 'ALL' | 'READY' | 'ZERO' | 'NEGATIVE';
type CategoryFilter =
  | 'ALL'
  | 'Consumable'
  | 'Mechanical'
  | 'Electrical'
  | 'Construction'
  | 'Jasa'
  | 'General';
type ItemTypeFilter = 'ALL' | 'Persediaan' | 'Non Persediaan' | 'Servis';
type ViewMode = 'table' | 'top15' | 'crossCheck';

export default function InventoryTab({
  items,
  summary,
  isLoading = false,
  procurementItems = [],
  armadaItems = [],
  onUpdateInventory,
  onLoadSampleInventory,
  showToast,
}: InventoryTabProps) {
  // File upload input ref for stock excel
  const fileInputRef = useRef<HTMLInputElement>(null);

  // File upload handler
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const buffer = evt.target?.result as ArrayBuffer;
        const workbook = XLSX.read(new Uint8Array(buffer), { type: 'array' });
        const result = parseInventoryWorkbook(workbook);

        if (result.items.length === 0) {
          showToast?.(
            'Format file Excel tidak cocok atau tidak ada baris data persediaan yang terbaca.',
            'error'
          );
          return;
        }

        onUpdateInventory(result.items, result.summary);
        showToast?.(
          `Berhasil memuat ${result.items.length.toLocaleString('id-ID')} item persediaan stok dari Excel!`,
          'success'
        );
      } catch (err: any) {
        showToast?.(`Gagal membaca file Excel stok: ${err.message || 'Format tidak valid'}`, 'error');
      }
    };
    reader.readAsArrayBuffer(file);
    e.target.value = '';
  };

  // Reset inventory items handler
  const handleResetInventory = () => {
    onUpdateInventory([], null);
    showToast?.('Data persediaan telah dikosongkan. Siap untuk pengujian file Excel baru.', 'info');
  };

  // Filters state
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCompany, setSelectedCompany] = useState<string>('ALL');
  const [stockStatus, setStockStatus] = useState<StockStatusFilter>('ALL');
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('ALL');
  const [itemTypeFilter, setItemTypeFilter] = useState<ItemTypeFilter>('ALL');
  const [viewMode, setViewMode] = useState<ViewMode>('table');

  // Pagination state
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [rowsPerPage, setRowsPerPage] = useState<number>(25);

  // Sorting state
  const [sortField, setSortField] = useState<'quantity' | 'itemCode' | 'description'>('quantity');
  const [sortAsc, setSortAsc] = useState<boolean>(false);

  // Detail Modal state
  const [selectedItemDetail, setSelectedItemDetail] = useState<InventoryItem | null>(null);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  // Cross-check search query
  const [crossCheckQuery, setCrossCheckQuery] = useState<string>('');

  // Reset page when any filter changes
  const handleFilterChange = (setter: () => void) => {
    setter();
    setCurrentPage(1);
  };

  // Company badge styling
  const getCompanyBadgeClass = (company: string) => {
    const up = company.toUpperCase();
    if (up.includes('CINDARA') || up.includes('CPL')) {
      return 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20';
    }
    if (up.includes('MANDAR') || up.includes('MO')) {
      return 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20';
    }
    if (up.includes('HANA') || up.includes('HL')) {
      return 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/20';
    }
    return 'bg-muted text-muted-foreground border-border';
  };

  // Category badge styling
  const getCategoryBadgeClass = (category: string = '') => {
    const up = category.toUpperCase();
    if (up.includes('CONSUMABLE')) {
      return 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20';
    }
    if (up.includes('MECHANICAL')) {
      return 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20';
    }
    if (up.includes('ELECTRICAL')) {
      return 'bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/20';
    }
    if (up.includes('CONSTRUCTION')) {
      return 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20';
    }
    if (up.includes('JASA')) {
      return 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20';
    }
    return 'bg-muted text-muted-foreground border-border';
  };

  // Filtered dataset
  const filteredItems = useMemo(() => {
    let result = items;

    // Company filter
    if (selectedCompany !== 'ALL') {
      result = result.filter(
        (it) => it.perusahaan === selectedCompany || it.entity === selectedCompany
      );
    }

    // Stock Status filter
    if (stockStatus === 'READY') {
      result = result.filter((it) => it.quantity > 0);
    } else if (stockStatus === 'ZERO') {
      result = result.filter((it) => it.quantity === 0);
    } else if (stockStatus === 'NEGATIVE') {
      result = result.filter((it) => it.quantity < 0);
    }

    // Category filter
    if (categoryFilter !== 'ALL') {
      result = result.filter((it) => {
        const cat = it.category || determineCategory(it.itemCode, it.description, it.itemType);
        return cat.toLowerCase() === categoryFilter.toLowerCase();
      });
    }

    // Item Type filter
    if (itemTypeFilter !== 'ALL') {
      result = result.filter((it) =>
        it.itemType.toLowerCase().includes(itemTypeFilter.toLowerCase())
      );
    }

    // Search query filter
    if (searchQuery.trim() !== '') {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(
        (it) =>
          it.itemCode.toLowerCase().includes(q) ||
          it.description.toLowerCase().includes(q) ||
          it.perusahaan.toLowerCase().includes(q) ||
          it.inventoryType.toLowerCase().includes(q)
      );
    }

    // Sorting
    result = [...result].sort((a, b) => {
      let cmp = 0;
      if (sortField === 'quantity') {
        cmp = a.quantity - b.quantity;
      } else if (sortField === 'itemCode') {
        cmp = a.itemCode.localeCompare(b.itemCode);
      } else if (sortField === 'description') {
        cmp = a.description.localeCompare(b.description);
      }
      return sortAsc ? cmp : -cmp;
    });

    return result;
  }, [
    items,
    selectedCompany,
    stockStatus,
    categoryFilter,
    itemTypeFilter,
    searchQuery,
    sortField,
    sortAsc,
  ]);

  // Paginated items
  const totalPages = Math.max(1, Math.ceil(filteredItems.length / rowsPerPage));
  const paginatedItems = useMemo(() => {
    const start = (currentPage - 1) * rowsPerPage;
    return filteredItems.slice(start, start + rowsPerPage);
  }, [filteredItems, currentPage, rowsPerPage]);

  // Copy item code to clipboard
  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    showToast?.(`Kode barang "${code}" disalin ke clipboard!`, 'info');
    setTimeout(() => setCopiedCode(null), 2000);
  };

  // Active cross-check matching between procurement & inventory
  const crossCheckMatches = useMemo(() => {
    if (!crossCheckQuery.trim() && procurementItems.length === 0) return [];

    const query = crossCheckQuery.toLowerCase().trim();
    // If query provided, search inventory directly
    if (query) {
      return items
        .filter(
          (it) =>
            it.description.toLowerCase().includes(query) ||
            it.itemCode.toLowerCase().includes(query)
        )
        .slice(0, 20);
    }

    // Otherwise match items from pending FPB in procurement list
    const pendingProcItems = procurementItems.filter((p) => p.statusBadge !== 'COMPLETED');
    const matched: { proc: ProcurementItem; invMatches: InventoryItem[] }[] = [];

    const sampleProc = pendingProcItems.slice(0, 10);
    for (const proc of sampleProc) {
      const words = proc.item
        .toLowerCase()
        .split(/[\s,.-]+/)
        .filter((w) => w.length >= 3);

      const found = items.filter((inv) => {
        const invDesc = inv.description.toLowerCase();
        const invCode = inv.itemCode.toLowerCase();
        return words.some((w) => invDesc.includes(w) || invCode.includes(w));
      });

      if (found.length > 0) {
        matched.push({
          proc,
          invMatches: found.slice(0, 5),
        });
      }
    }

    return matched;
  }, [crossCheckQuery, procurementItems, items]);

  return (
    <div className="space-y-6">
      {/* Top Banner / Context Info */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-card border border-border rounded-xl p-4 sm:p-5 shadow-xs">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5 flex-wrap">
            <span className="p-2 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
              <Boxes className="size-5" />
            </span>
            <div>
              <h2 className="text-lg font-bold tracking-tight text-foreground flex items-center gap-2">
                Cek Persediaan & Stok Gudang
                <span className="text-[11px] font-mono font-medium px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                  Accurate System
                </span>
              </h2>
              <p className="text-xs text-muted-foreground">
                Data persediaan barang konsolidasi per 26 September 2026 lintas unit PT CPL, PT Hana
                Lines, dan PT Mandar Ocean.
              </p>
            </div>
          </div>
        </div>

        {/* Actions: View Mode, Upload, Reset */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* View mode toggle */}
          <div className="flex items-center bg-muted/70 p-1 rounded-lg border border-border text-xs">
            <button
              onClick={() => setViewMode('table')}
              className={`px-3 py-1.5 rounded-md font-medium transition ${
                viewMode === 'table'
                  ? 'bg-background text-foreground shadow-xs font-semibold'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Semua Stok
            </button>
            <button
              onClick={() => setViewMode('top15')}
              className={`px-3 py-1.5 rounded-md font-medium transition flex items-center gap-1.5 ${
                viewMode === 'top15'
                  ? 'bg-background text-foreground shadow-xs font-semibold'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <TrendingUp className="size-3 text-amber-500" />
              <span>Top 15 Kuantitas</span>
            </button>
            <button
              onClick={() => setViewMode('crossCheck')}
              className={`px-3 py-1.5 rounded-md font-medium transition flex items-center gap-1.5 ${
                viewMode === 'crossCheck'
                  ? 'bg-background text-foreground shadow-xs font-semibold'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <GitCompare className="size-3 text-sky-500" />
              <span>Cek vs FPB</span>
            </button>
          </div>

          {/* Hidden File Input */}
          <input
            type="file"
            ref={fileInputRef}
            accept=".xlsx, .xls, .csv"
            className="hidden"
            onChange={handleFileUpload}
          />

          {/* Direct Upload Button */}
          <button
            onClick={() => fileInputRef.current?.click()}
            className="h-8 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium shadow-xs flex items-center gap-1.5 transition active:scale-95 shrink-0"
            title="Unggah file Excel stok persediaan Accurate"
          >
            <Upload className="size-3.5" />
            <span>Unggah Stok</span>
          </button>

          {/* Reset Button (only shown if data is present) */}
          {items.length > 0 && (
            <button
              onClick={handleResetInventory}
              className="h-8 px-2.5 rounded-lg border border-border bg-background hover:bg-rose-500/10 text-muted-foreground hover:text-rose-500 text-xs font-medium transition shadow-xs flex items-center gap-1.5 active:scale-95 shrink-0"
              title="Kosongkan data persediaan untuk menguji upload baru"
            >
              <RotateCcw className="size-3.5" />
              <span className="hidden sm:inline">Reset Stok</span>
            </button>
          )}
        </div>
      </div>

      {/* 4 Pillar Executive KPI Cards for Inventory */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Total Catalog Items */}
        <div className="bg-card border border-border rounded-xl p-4 sm:p-5 shadow-xs space-y-2">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium">Total Item Terdaftar</span>
            <span className="p-1.5 rounded-md bg-muted text-muted-foreground">
              <Boxes className="size-4" />
            </span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground font-mono">
              {(summary?.totalItems ?? items.length).toLocaleString('id-ID')}
            </span>
            <span className="text-xs text-muted-foreground">item</span>
          </div>
          <div className="text-[11px] text-muted-foreground flex items-center gap-1.5 font-mono">
            <span>{summary?.parentItems.toLocaleString('id-ID') ?? '-'} Induk</span>
            <span>&bull;</span>
            <span>{summary?.subItems.toLocaleString('id-ID') ?? '-'} Sub-Barang</span>
          </div>
        </div>

        {/* Total Quantity */}
        <div className="bg-card border border-border rounded-xl p-4 sm:p-5 shadow-xs space-y-2">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium">Total Kuantitas Fisik</span>
            <span className="p-1.5 rounded-md bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
              <Layers className="size-4" />
            </span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground font-mono">
              {(summary?.totalQuantity ?? 0).toLocaleString('id-ID')}
            </span>
            <span className="text-xs text-muted-foreground">unit</span>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Total akumulasi stok induk konsolidasi
          </p>
        </div>

        {/* Ready Stock (>0) */}
        <div className="bg-card border border-border rounded-xl p-4 sm:p-5 shadow-xs space-y-2">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium">Stok Tersedia (&gt; 0)</span>
            <span className="p-1.5 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <PackageCheck className="size-4" />
            </span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-extrabold tracking-tight text-emerald-600 dark:text-emerald-400 font-mono">
              {(summary?.activeStock ?? 0).toLocaleString('id-ID')}
            </span>
            <span className="text-xs text-muted-foreground">item siap</span>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Siap didistribusikan langsung ke kapal / unit
          </p>
        </div>

        {/* Zero Stock (=0) */}
        <div className="bg-card border border-border rounded-xl p-4 sm:p-5 shadow-xs space-y-2">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium">Stok Kosong (0)</span>
            <span className="p-1.5 rounded-md bg-rose-500/10 text-rose-600 dark:text-rose-400">
              <PackageX className="size-4" />
            </span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-extrabold tracking-tight text-rose-600 dark:text-rose-400 font-mono">
              {(summary?.zeroStock ?? 0).toLocaleString('id-ID')}
            </span>
            <span className="text-xs text-muted-foreground">item habis</span>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Katalog barang butuh PO jika dipesan oleh armada
          </p>
        </div>
      </div>

      {/* If items are empty: Show prominent Empty State Card */}
      {items.length === 0 ? (
        <div className="bg-card border-2 border-dashed border-border rounded-2xl p-8 sm:p-14 text-center space-y-5 shadow-xs">
          <div className="size-16 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto border border-emerald-500/20">
            <Boxes className="size-8" />
          </div>
          <div className="max-w-md mx-auto space-y-2">
            <h3 className="text-base sm:text-lg font-bold text-foreground">
              Belum Ada Data Persediaan Gudang
            </h3>
            <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
              Modul cek persediaan disetel dalam kondisi bersih setiap kali refresh untuk memfasilitasi pengujian unggah file Excel stok Accurate Anda.
            </p>
          </div>
          <div className="flex items-center justify-center gap-3 pt-1 flex-wrap">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="h-10 px-5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold transition shadow-xs flex items-center gap-2 active:scale-95"
            >
              <Upload className="size-4" />
              <span>Unggah File Excel Stok (.xlsx)</span>
            </button>
            {onLoadSampleInventory && (
              <button
                onClick={onLoadSampleInventory}
                className="h-10 px-4 rounded-xl border border-border bg-background hover:bg-muted text-foreground text-xs font-medium transition shadow-xs flex items-center gap-2 active:scale-95"
              >
                <RefreshCw className="size-3.5 text-muted-foreground" />
                <span>Muat Data Uji Coba (Accurate 10k)</span>
              </button>
            )}
          </div>
        </div>
      ) : (
        <>
          {/* Breakdown per Perusahaan Cards */}
          {summary?.byCompany && summary.byCompany.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {summary.byCompany.map((c) => {
            const isSelected = selectedCompany === c.name;
            return (
              <button
                key={c.name}
                onClick={() =>
                  handleFilterChange(() =>
                    setSelectedCompany(isSelected ? 'ALL' : c.name)
                  )
                }
                className={`p-3.5 rounded-xl border text-left transition touch-manipulation ${
                  isSelected
                    ? 'border-primary ring-2 ring-primary/20 bg-primary/5'
                    : 'border-border bg-card hover:bg-muted/40'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Building2 className="size-4 text-muted-foreground shrink-0" />
                    <span className="font-semibold text-xs text-foreground truncate">
                      {c.name}
                    </span>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold border ${getCompanyBadgeClass(
                      c.name
                    )}`}
                  >
                    {c.entity}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2 mt-3 pt-2 border-t border-border/60 text-[11px]">
                  <div>
                    <span className="text-muted-foreground block text-[10px]">Total Item</span>
                    <span className="font-mono font-bold text-foreground">
                      {c.totalItems.toLocaleString('id-ID')}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[10px]">Stok &gt; 0</span>
                    <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                      {c.activeStock.toLocaleString('id-ID')}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[10px]">Kuantitas</span>
                    <span className="font-mono font-bold text-foreground">
                      {c.totalQuantity.toLocaleString('id-ID')}
                    </span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODE 1: Interactive Paginated Table */}
      {/* ========================================================================= */}
      {viewMode === 'table' && (
        <div className="space-y-4">
          {/* Search Bar & Secondary Filter Row */}
          <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 bg-card p-3 rounded-xl border border-border shadow-xs">
            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) =>
                  handleFilterChange(() => setSearchQuery(e.target.value))
                }
                placeholder="Cari no. barang (contoh: TRD-BIO04, OAT01) atau deskripsi (Biosolar, Oli, Filter)..."
                className="w-full h-9 pl-9 pr-9 text-xs rounded-lg bg-background border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />
              {searchQuery && (
                <button
                  onClick={() => handleFilterChange(() => setSearchQuery(''))}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground"
                >
                  <X className="size-3.5" />
                </button>
              )}
            </div>

            {/* Filter Controls: Company, Status, Level, Tipe */}
            <div className="flex items-center gap-2 flex-wrap">
              {/* Filter Company */}
              <select
                value={selectedCompany}
                onChange={(e) =>
                  handleFilterChange(() => setSelectedCompany(e.target.value))
                }
                className="h-9 px-2.5 text-xs rounded-lg bg-background border border-border text-foreground focus:outline-none focus:ring-1 focus:ring-primary font-medium"
              >
                <option value="ALL">Semua Perusahaan</option>
                <option value="PT CINDARA PRATAMA LINES">PT Cindara Pratama Lines (CPL)</option>
                <option value="PT MANDAR OCEAN">PT Mandar Ocean (MO)</option>
                <option value="PT HANA LINES">PT Hana Lines (HL)</option>
              </select>

              {/* Filter Stock Status */}
              <select
                value={stockStatus}
                onChange={(e) =>
                  handleFilterChange(() =>
                    setStockStatus(e.target.value as StockStatusFilter)
                  )
                }
                className="h-9 px-2.5 text-xs rounded-lg bg-background border border-border text-foreground focus:outline-none focus:ring-1 focus:ring-primary font-medium"
              >
                <option value="ALL">Semua Stok</option>
                <option value="READY">Stok Tersedia (&gt; 0)</option>
                <option value="ZERO">Stok Kosong (= 0)</option>
                <option value="NEGATIVE">Stok Minus (&lt; 0)</option>
              </select>

              {/* Filter Kategori */}
              <select
                value={categoryFilter}
                onChange={(e) =>
                  handleFilterChange(() => setCategoryFilter(e.target.value as CategoryFilter))
                }
                className="h-9 px-2.5 text-xs rounded-lg bg-background border border-border text-foreground focus:outline-none focus:ring-1 focus:ring-primary font-medium"
              >
                <option value="ALL">Semua Kategori</option>
                <option value="Consumable">Consumable</option>
                <option value="Mechanical">Mechanical</option>
                <option value="Electrical">Electrical</option>
                <option value="Construction">Construction</option>
                <option value="Jasa">Jasa</option>
                <option value="General">General</option>
              </select>

              {/* Filter Item Type */}
              <select
                value={itemTypeFilter}
                onChange={(e) =>
                  handleFilterChange(() =>
                    setItemTypeFilter(e.target.value as ItemTypeFilter)
                  )
                }
                className="h-9 px-2.5 text-xs rounded-lg bg-background border border-border text-foreground focus:outline-none focus:ring-1 focus:ring-primary font-medium"
              >
                <option value="ALL">Semua Tipe</option>
                <option value="Persediaan">Persediaan</option>
                <option value="Non Persediaan">Non Persediaan</option>
                <option value="Servis">Servis</option>
              </select>

              {/* Rows per page */}
              <select
                value={rowsPerPage}
                onChange={(e) => {
                  setRowsPerPage(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="h-9 px-2 text-xs rounded-lg bg-background border border-border text-foreground focus:outline-none focus:ring-1 focus:ring-primary font-mono"
              >
                <option value={25}>25 / hal</option>
                <option value={50}>50 / hal</option>
                <option value={100}>100 / hal</option>
              </select>
            </div>
          </div>

          {/* Results count & active filter reset */}
          <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
            <span>
              Menampilkan{' '}
              <strong className="text-foreground font-mono">
                {filteredItems.length.toLocaleString('id-ID')}
              </strong>{' '}
              dari{' '}
              <strong className="text-foreground font-mono">
                {items.length.toLocaleString('id-ID')}
              </strong>{' '}
              total item barang
            </span>
            {(selectedCompany !== 'ALL' ||
              stockStatus !== 'ALL' ||
              categoryFilter !== 'ALL' ||
              itemTypeFilter !== 'ALL' ||
              searchQuery !== '') && (
              <button
                onClick={() => {
                  setSelectedCompany('ALL');
                  setStockStatus('ALL');
                  setCategoryFilter('ALL');
                  setItemTypeFilter('ALL');
                  setSearchQuery('');
                  setCurrentPage(1);
                }}
                className="text-primary hover:underline font-medium text-xs flex items-center gap-1"
              >
                <RefreshCw className="size-3" />
                <span>Reset Semua Filter</span>
              </button>
            )}
          </div>

          {/* Table Container */}
          <div className="bg-card border border-border rounded-xl overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-muted/60 text-muted-foreground border-b border-border select-none uppercase tracking-wider font-semibold text-[10px]">
                  <tr>
                    <th className="py-3 px-3 w-12 text-center">No</th>
                    <th className="py-3 px-3">Perusahaan</th>
                    <th
                      className="py-3 px-3 cursor-pointer hover:text-foreground"
                      onClick={() => {
                        setSortField('itemCode');
                        setSortAsc(sortField === 'itemCode' ? !sortAsc : true);
                      }}
                    >
                      <div className="flex items-center gap-1">
                        <span>No. / Kode Barang</span>
                        <ArrowUpDown className="size-3" />
                      </div>
                    </th>
                    <th
                      className="py-3 px-3 cursor-pointer hover:text-foreground"
                      onClick={() => {
                        setSortField('description');
                        setSortAsc(sortField === 'description' ? !sortAsc : true);
                      }}
                    >
                      <div className="flex items-center gap-1">
                        <span>Deskripsi Barang</span>
                        <ArrowUpDown className="size-3" />
                      </div>
                    </th>
                    <th className="py-3 px-3">Kategori</th>
                    <th className="py-3 px-3">Tipe</th>
                    <th
                      className="py-3 px-3 text-right cursor-pointer hover:text-foreground"
                      onClick={() => {
                        setSortField('quantity');
                        setSortAsc(sortField === 'quantity' ? !sortAsc : false);
                      }}
                    >
                      <div className="flex items-center justify-end gap-1">
                        <span>Kuantitas Stok</span>
                        <ArrowUpDown className="size-3" />
                      </div>
                    </th>
                    <th className="py-3 px-3 text-center">Status</th>
                    <th className="py-3 px-3 text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {paginatedItems.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-12 text-center text-muted-foreground">
                        <PackageX className="size-8 mx-auto mb-2 opacity-40" />
                        <p className="font-medium text-sm">Tidak ada barang yang cocok</p>
                        <p className="text-xs">Coba ubah kata kunci pencarian atau sesuaikan filter Anda.</p>
                      </td>
                    </tr>
                  ) : (
                    paginatedItems.map((item, idx) => {
                      const absoluteIdx = (currentPage - 1) * rowsPerPage + idx + 1;
                      const isReady = item.quantity > 0;
                      const isZero = item.quantity === 0;
                      const isNegative = item.quantity < 0;

                      return (
                        <tr
                          key={item.id || `${item.itemCode}-${idx}`}
                          className="hover:bg-muted/30 transition-colors"
                        >
                          <td className="py-2.5 px-3 text-center font-mono text-muted-foreground text-[11px]">
                            {absoluteIdx}
                          </td>
                          <td className="py-2.5 px-3 whitespace-nowrap">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-mono font-medium border ${getCompanyBadgeClass(
                                item.perusahaan
                              )}`}
                              title={item.perusahaan}
                            >
                              {item.entity || item.perusahaan.split(' ')[1] || item.perusahaan}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 whitespace-nowrap">
                            <div className="flex items-center gap-1.5 font-mono font-semibold text-foreground">
                              <span>{item.itemCode || '-'}</span>
                              {item.itemCode && (
                                <button
                                  onClick={() => handleCopyCode(item.itemCode)}
                                  title="Salin kode barang"
                                  className="text-muted-foreground hover:text-foreground opacity-60 hover:opacity-100 transition p-0.5"
                                >
                                  {copiedCode === item.itemCode ? (
                                    <Check className="size-3 text-emerald-500" />
                                  ) : (
                                    <Copy className="size-3" />
                                  )}
                                </button>
                              )}
                            </div>
                          </td>
                          <td className="py-2.5 px-3">
                            <span className="font-medium text-foreground block max-w-md truncate">
                              {item.description}
                            </span>
                            {item.inventoryType && item.inventoryType !== '-' && (
                              <span className="text-[10px] text-muted-foreground">
                                {item.inventoryType}
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 whitespace-nowrap">
                            {(() => {
                              const cat =
                                item.category ||
                                determineCategory(item.itemCode, item.description, item.itemType);
                              return (
                                <span
                                  className={`px-2 py-0.5 rounded text-[10px] font-mono font-medium border ${getCategoryBadgeClass(
                                    cat
                                  )}`}
                                >
                                  {cat}
                                </span>
                              );
                            })()}
                          </td>
                          <td className="py-2.5 px-3 whitespace-nowrap text-muted-foreground text-[11px]">
                            {item.itemType}
                          </td>
                          <td className="py-2.5 px-3 text-right whitespace-nowrap">
                            <span
                              className={`font-mono font-bold text-sm ${
                                isReady
                                  ? 'text-emerald-600 dark:text-emerald-400'
                                  : isZero
                                  ? 'text-muted-foreground'
                                  : 'text-rose-600 dark:text-rose-400'
                              }`}
                            >
                              {item.quantity.toLocaleString('id-ID')}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-center whitespace-nowrap">
                            {isReady ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                                <CheckCircle2 className="size-2.5" />
                                Tersedia
                              </span>
                            ) : isZero ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-muted text-muted-foreground border border-border">
                                Kosong
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
                                <AlertTriangle className="size-2.5" />
                                Minus
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-center whitespace-nowrap">
                            <button
                              onClick={() => setSelectedItemDetail(item)}
                              className="p-1.5 rounded-lg border border-border bg-background hover:bg-muted text-muted-foreground hover:text-foreground transition"
                              title="Lihat rincian barang"
                            >
                              <Eye className="size-3.5" />
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            {filteredItems.length > 0 && (
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3.5 border-t border-border bg-muted/20 text-xs">
                <span className="text-muted-foreground">
                  Halaman <strong className="text-foreground font-mono">{currentPage}</strong> dari{' '}
                  <strong className="text-foreground font-mono">{totalPages}</strong> (
                  {filteredItems.length.toLocaleString('id-ID')} total baris)
                </span>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setCurrentPage(1)}
                    disabled={currentPage === 1}
                    className="px-2 py-1 rounded border border-border bg-background hover:bg-muted text-foreground disabled:opacity-40 text-xs font-mono"
                  >
                    &laquo; Awal
                  </button>
                  <button
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="p-1 rounded border border-border bg-background hover:bg-muted text-foreground disabled:opacity-40"
                    title="Halaman Sebelumnya"
                  >
                    <ChevronLeft className="size-4" />
                  </button>

                  <div className="flex items-center gap-1 px-2 font-mono text-xs">
                    <span>{currentPage}</span>
                    <span className="text-muted-foreground">/</span>
                    <span>{totalPages}</span>
                  </div>

                  <button
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="p-1 rounded border border-border bg-background hover:bg-muted text-foreground disabled:opacity-40"
                    title="Halaman Selanjutnya"
                  >
                    <ChevronRight className="size-4" />
                  </button>
                  <button
                    onClick={() => setCurrentPage(totalPages)}
                    disabled={currentPage === totalPages}
                    className="px-2 py-1 rounded border border-border bg-background hover:bg-muted text-foreground disabled:opacity-40 text-xs font-mono"
                  >
                    Akhir &raquo;
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODE 2: Top 15 Kuantitas Tertinggi (Barang Volume Terbesar) */}
      {/* ========================================================================= */}
      {viewMode === 'top15' && (
        <div className="space-y-4">
          <div className="bg-card border border-border rounded-xl p-4 sm:p-5 shadow-xs">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-bold text-sm text-foreground flex items-center gap-2">
                  <TrendingUp className="size-4 text-amber-500" />
                  Top 15 Barang dengan Kuantitas Fisik Tertinggi
                </h3>
                <p className="text-xs text-muted-foreground">
                  Daftar komoditas dan item strategis persediaan konsolidasi seluruh anak perusahaan.
                </p>
              </div>
              <button
                onClick={() => setViewMode('table')}
                className="text-xs text-primary hover:underline font-medium"
              >
                Lihat Semua Tabel &rarr;
              </button>
            </div>

            <div className="space-y-3">
              {(summary?.topItems || []).map((it) => {
                const maxQty = summary?.topItems[0]?.quantity || 1;
                const pct = Math.min(100, Math.max(5, Math.round((it.quantity / maxQty) * 100)));

                return (
                  <div
                    key={`${it.rank}-${it.itemCode}`}
                    className="p-3 rounded-lg border border-border bg-background hover:bg-muted/40 transition space-y-2"
                  >
                    <div className="flex items-center justify-between gap-3 text-xs">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="size-6 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 font-bold font-mono text-xs flex items-center justify-center shrink-0 border border-amber-500/20">
                          {it.rank}
                        </span>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-foreground truncate">
                              {it.description}
                            </span>
                            <span className="font-mono text-[11px] text-muted-foreground">
                              ({it.itemCode})
                            </span>
                          </div>
                          <span className="text-[10px] text-muted-foreground">
                            {it.company} &bull;{' '}
                            {it.category ||
                              determineCategory(it.itemCode, it.description, it.itemType)}
                          </span>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <span className="font-mono font-bold text-sm text-foreground block">
                          {it.quantity.toLocaleString('id-ID')}
                        </span>
                        <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">
                          Stok Siap
                        </span>
                      </div>
                    </div>

                    {/* Progress bar */}
                    <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                      <div
                        className="bg-linear-to-r from-amber-500 to-emerald-500 h-full rounded-full transition-all duration-500"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODE 3: Cross-Check Pengadaan (FPB) vs Stok Gudang */}
      {/* ========================================================================= */}
      {viewMode === 'crossCheck' && (
        <div className="space-y-4">
          <div className="bg-card border border-border rounded-xl p-4 sm:p-5 shadow-xs space-y-4">
            <div>
              <h3 className="font-bold text-sm text-foreground flex items-center gap-2">
                <GitCompare className="size-4 text-sky-500" />
                Pencocokan Cepat: Kebutuhan FPB vs Stok Persediaan Gudang
              </h3>
              <p className="text-xs text-muted-foreground">
                Gunakan alat ini untuk mengecek apakah barang yang diajukan divisi/armada dalam FPB
                sudah ada stoknya di gudang CPL, Hana Lines, atau Mandar Ocean, guna menghindari PO
                berulang.
              </p>
            </div>

            {/* Live Search for custom item cross-check */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <input
                type="text"
                value={crossCheckQuery}
                onChange={(e) => setCrossCheckQuery(e.target.value)}
                placeholder="Ketik nama barang yang mau dicek ketersediaannya di gudang (contoh: BIOSOLAR, MEDITRAN, FILTER, AKI, CAT)..."
                className="w-full h-10 pl-9 pr-9 text-xs rounded-lg bg-background border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />
              {crossCheckQuery && (
                <button
                  onClick={() => setCrossCheckQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground"
                >
                  <X className="size-3.5" />
                </button>
              )}
            </div>

            {/* Results display */}
            {crossCheckQuery ? (
              <div className="space-y-3">
                <div className="text-xs font-semibold text-foreground flex items-center justify-between">
                  <span>Hasil pencarian stok gudang untuk &ldquo;{crossCheckQuery}&rdquo;:</span>
                  <span className="font-mono text-muted-foreground">
                    {crossCheckMatches.length} ditemukan
                  </span>
                </div>

                {crossCheckMatches.length === 0 ? (
                  <div className="py-8 text-center text-muted-foreground border border-dashed border-border rounded-lg">
                    <PackageX className="size-6 mx-auto mb-1 opacity-50" />
                    <p className="text-xs">
                      Tidak ditemukan barang yang cocok dengan kata kunci &ldquo;{crossCheckQuery}&rdquo; di gudang.
                    </p>
                    <p className="text-[11px] text-muted-foreground mt-1">
                      Perlu diproses pengadaan / PO baru ke supplier.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {(crossCheckMatches as InventoryItem[]).map((match) => (
                      <div
                        key={match.id}
                        className="p-3.5 rounded-lg border border-border bg-background space-y-2"
                      >
                        <div className="flex items-center justify-between">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-mono border ${getCompanyBadgeClass(
                              match.perusahaan
                            )}`}
                          >
                            {match.perusahaan}
                          </span>
                          <span className="font-mono font-bold text-xs text-foreground">
                            {match.itemCode}
                          </span>
                        </div>
                        <p className="font-semibold text-xs text-foreground">{match.description}</p>
                        <div className="flex items-center justify-between pt-2 border-t border-border/60 text-xs">
                          <span className="text-muted-foreground">Kuantitas di Gudang:</span>
                          <span
                            className={`font-mono font-bold ${
                              match.quantity > 0
                                ? 'text-emerald-600 dark:text-emerald-400'
                                : 'text-rose-600 dark:text-rose-400'
                            }`}
                          >
                            {match.quantity.toLocaleString('id-ID')} unit
                          </span>
                        </div>
                        {match.quantity > 0 ? (
                          <div className="text-[11px] text-emerald-700 dark:text-emerald-300 bg-emerald-500/10 p-2 rounded border border-emerald-500/20 flex items-center gap-1.5">
                            <CheckCircle2 className="size-3.5 shrink-0" />
                            <span>
                              <strong>Stok Tersedia!</strong> Dapat dimutasi langsung tanpa menerbitkan PO baru.
                            </span>
                          </div>
                        ) : (
                          <div className="text-[11px] text-muted-foreground bg-muted/40 p-2 rounded border border-border flex items-center gap-1.5">
                            <AlertTriangle className="size-3.5 shrink-0 text-amber-500" />
                            <span>Stok habis di gudang ini (perlu PO).</span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                <div className="text-xs font-semibold text-muted-foreground">
                  Deteksi Otomatis: Pencocokan Item FPB Pengadaan Aktif vs Stok Gudang
                </div>
                {procurementItems.length === 0 ? (
                  <div className="py-6 text-center text-muted-foreground border border-dashed border-border rounded-lg text-xs">
                    Belum ada data antrian FPB pengadaan. Silakan unggah berkas pengadaan atau ketik kata kunci di kolom pencarian di atas untuk memeriksa stok barang.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {(crossCheckMatches as { proc: ProcurementItem; invMatches: InventoryItem[] }[]).map(
                      (item, i) => (
                        <div
                          key={`match-${i}`}
                          className="p-3.5 rounded-lg border border-border bg-background space-y-2"
                        >
                          <div className="flex items-center justify-between text-xs">
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-bold text-primary">
                                FPB: {item.proc.fpb}
                              </span>
                              <span className="text-muted-foreground">&bull;</span>
                              <span className="font-medium text-foreground">{item.proc.item}</span>
                            </div>
                            <span className="text-muted-foreground text-[11px]">
                              {item.proc.entity} ({item.proc.deptArmada || '-'})
                            </span>
                          </div>

                          <div className="bg-muted/40 p-2.5 rounded-md border border-border/80 space-y-1">
                            <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider block">
                              Kandidat Stok di Gudang:
                            </span>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                              {item.invMatches.map((inv) => (
                                <div
                                  key={inv.id}
                                  className="p-2 rounded bg-background border border-border flex items-center justify-between gap-2"
                                >
                                  <div className="min-w-0">
                                    <span className="font-semibold text-foreground block truncate">
                                      {inv.description}
                                    </span>
                                    <span className="text-[10px] text-muted-foreground">
                                      {inv.perusahaan} ({inv.itemCode})
                                    </span>
                                  </div>
                                  <span
                                    className={`font-mono font-bold text-xs shrink-0 ${
                                      inv.quantity > 0
                                        ? 'text-emerald-600 dark:text-emerald-400'
                                        : 'text-muted-foreground'
                                    }`}
                                  >
                                    {inv.quantity.toLocaleString('id-ID')} unit
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      )
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
        </>
      )}

      {/* ========================================================================= */}
      {/* Modal: Item Detail Inspection */}
      {/* ========================================================================= */}
      {selectedItemDetail && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl max-w-lg w-full p-5 sm:p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div className="flex items-center gap-2">
                <Boxes className="size-5 text-primary" />
                <h3 className="font-bold text-base text-foreground">Detail Data Persediaan</h3>
              </div>
              <button
                onClick={() => setSelectedItemDetail(null)}
                className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3 rounded-lg bg-muted/40 border border-border space-y-1">
                <span className="text-muted-foreground text-[11px] block">Deskripsi Barang:</span>
                <p className="font-bold text-sm text-foreground">{selectedItemDetail.description}</p>
                <div className="flex items-center gap-2 pt-1">
                  <span className="font-mono text-muted-foreground">
                    Kode: <strong>{selectedItemDetail.itemCode || '-'}</strong>
                  </span>
                  {selectedItemDetail.itemCode && (
                    <button
                      onClick={() => handleCopyCode(selectedItemDetail.itemCode)}
                      className="text-primary hover:underline text-[11px] flex items-center gap-1"
                    >
                      <Copy className="size-3" />
                      <span>Salin</span>
                    </button>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-lg border border-border bg-background">
                  <span className="text-muted-foreground text-[10px] block">Perusahaan:</span>
                  <span className="font-semibold text-foreground">
                    {selectedItemDetail.perusahaan}
                  </span>
                  <span className="text-[10px] text-muted-foreground block mt-0.5">
                    Entitas: {selectedItemDetail.entity}
                  </span>
                </div>

                <div className="p-3 rounded-lg border border-border bg-background">
                  <span className="text-muted-foreground text-[10px] block">Kuantitas Stok:</span>
                  <span
                    className={`font-mono font-bold text-base ${
                      selectedItemDetail.quantity > 0
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : selectedItemDetail.quantity === 0
                        ? 'text-muted-foreground'
                        : 'text-rose-600 dark:text-rose-400'
                    }`}
                  >
                    {selectedItemDetail.quantity.toLocaleString('id-ID')}
                  </span>
                  <span className="text-[10px] text-muted-foreground block">
                    Status: {selectedItemDetail.quantity > 0 ? 'Tersedia di Gudang' : 'Kosong'}
                  </span>
                </div>

                <div className="p-3 rounded-lg border border-border bg-background">
                  <span className="text-muted-foreground text-[10px] block">Kategori:</span>
                  <span className="font-semibold text-foreground font-mono">
                    {selectedItemDetail.category ||
                      determineCategory(
                        selectedItemDetail.itemCode,
                        selectedItemDetail.description,
                        selectedItemDetail.itemType
                      )}
                  </span>
                </div>

                <div className="p-3 rounded-lg border border-border bg-background">
                  <span className="text-muted-foreground text-[10px] block">Tipe Barang:</span>
                  <span className="font-semibold text-foreground">
                    {selectedItemDetail.itemType}
                  </span>
                  {selectedItemDetail.inventoryType && (
                    <span className="text-[10px] text-muted-foreground block">
                      {selectedItemDetail.inventoryType}
                    </span>
                  )}
                </div>
              </div>

              {/* Action recommendation */}
              <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-800 dark:text-emerald-300">
                <div className="flex items-center gap-1.5 font-semibold text-xs mb-1">
                  <Sparkles className="size-3.5" />
                  <span>Rekomendasi Operasional:</span>
                </div>
                {selectedItemDetail.quantity > 0 ? (
                  <p className="text-[11px] leading-relaxed">
                    Stok barang ini siap dipakai. Jika ada pengajuan FPB dari armada untuk barang ini,
                    langsung terbitkan FSTB pengeluaran barang tanpa perlu membuat PO baru ke vendor.
                  </p>
                ) : (
                  <p className="text-[11px] leading-relaxed">
                    Stok barang ini 0 di sistem Accurate. Jika ada permintaan kebutuhan dari kapal / unit,
                    segera proses pembuatan FPB dan PO pengadaan baru.
                  </p>
                )}
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setSelectedItemDetail(null)}
                className="px-4 py-2 rounded-lg bg-foreground text-background font-semibold text-xs transition active:scale-95"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
