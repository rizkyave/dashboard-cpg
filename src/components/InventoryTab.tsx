'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
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
  ChevronDown,
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
  Settings2,
  Globe,
  Printer,
  ShieldAlert,
  BarChart3,
  Wrench,
  Zap,
  Fuel,
  Droplet,
  Compass,
  AlertOctagon,
  FileText,
  Share2,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import SyncEfpbModal from './SyncEfpbModal';
import {
  InventoryItem,
  InventorySummary,
  ProcurementItem,
  ArmadaItem,
} from '@/types/procurement';
import { parseInventoryWorkbook, calculateInventorySummary, exportInventoryToExcel } from '@/utils/inventoryParser';
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
type SifatEntitasFilter = 'ALL' | 'FISIK' | 'JASA' | 'AKUNTANSI';
type LevelFilter = 'ALL' | 'Induk' | 'Sub-Barang';
type SubTabMode = 'katalog' | 'analisis' | 'crossCheck' | 'cleansing';

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
  const fileInputRef = useRef<HTMLInputElement>(null);

  // SubTab Navigation State
  const [activeSubTab, setActiveSubTab] = useState<SubTabMode>('katalog');

  // Server Reload State
  const [isReloadingServer, setIsReloadingServer] = useState<boolean>(false);

  // e-FPB Sync Modal State
  const [isEfpbModalOpen, setIsEfpbModalOpen] = useState<boolean>(false);
  const [isQuickSyncingEfpb, setIsQuickSyncingEfpb] = useState<boolean>(false);
  const [lastEfpbSyncTime, setLastEfpbSyncTime] = useState<string>('');

  // KPI collapse state
  const [isKpiHidden, setIsKpiHidden] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('CPG_INVENTORY_KPI_HIDDEN') === 'true';
    }
    return false;
  });

  const toggleKpiHidden = () => {
    setIsKpiHidden((prev) => {
      const next = !prev;
      if (typeof window !== 'undefined') {
        localStorage.setItem('CPG_INVENTORY_KPI_HIDDEN', String(next));
      }
      return next;
    });
  };

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedTime = localStorage.getItem('EFPB_LAST_SYNC_TIME');
      if (savedTime) setLastEfpbSyncTime(savedTime);
    }
  }, []);

  // Compute live summary if summary prop is empty or needs refresh
  const liveSummary: InventorySummary = useMemo(() => {
    if (summary && summary.totalItems === items.length && summary.byCategory) {
      return summary;
    }
    return calculateInventorySummary(items);
  }, [items, summary]);

  // Handler to reload freshest data from /api/inventory?force=true
  const handleReloadFreshestData = async () => {
    setIsReloadingServer(true);
    showToast?.('Memuat ulang 10.049 data persediaan terbaru dari server...', 'info');
    try {
      const res = await fetch('/api/inventory?force=true');
      const data = await res.json();
      if (data.success && Array.isArray(data.items)) {
        onUpdateInventory(data.items, data.summary);
        showToast?.(
          `Berhasil memuat ${data.items.length.toLocaleString('id-ID')} item persediaan konsolidasi Accurate 2026!`,
          'success'
        );
      } else {
        throw new Error(data.message || 'Gagal memuat data persediaan.');
      }
    } catch (err: any) {
      console.error('Reload inventory error:', err);
      showToast?.(`Gagal memuat data: ${err.message || 'Kesalahan server'}`, 'error');
    } finally {
      setIsReloadingServer(false);
    }
  };

  // e-FPB Quick Sync
  const handleQuickRefreshEfpb = async () => {
    if (typeof window === 'undefined') return;
    const savedUser = localStorage.getItem('EFPB_USERNAME') || 'Hermansyah';
    const savedPass = localStorage.getItem('EFPB_PASSWORD') || 'Biocpl24!@#';
    const savedSess = localStorage.getItem('EFPB_SESSION_ID') || '';
    const savedUrl =
      localStorage.getItem('EFPB_URL') ||
      'https://e-fpb.cindaragroup.com/KodeItemForAccurateList';

    setIsQuickSyncingEfpb(true);
    showToast?.('Menghubungkan ke e-FPB & mengunduh data stok Accurate...', 'info');

    try {
      const payload: Record<string, any> = { url: savedUrl };
      if (savedUser && savedPass) {
        payload.username = savedUser;
        payload.password = savedPass;
      } else if (savedSess) {
        payload.sessionId = savedSess;
      }

      const res = await fetch('/api/sync-efpb-stock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const resText = await res.text();
      let data: any = {};
      try {
        data = resText ? JSON.parse(resText) : {};
      } catch {
        throw new Error(`Server tidak mengembalikan respons valid (${res.status}).`);
      }

      if (data.requiresAuth || !res.ok) {
        setIsEfpbModalOpen(true);
        showToast?.(data.message || 'Sesi e-FPB memerlukan login ulang.', 'warning');
        return;
      }

      if (data.success && data.items) {
        onUpdateInventory(data.items, data.summary);
        const now = new Date();
        const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now
          .getMinutes()
          .toString()
          .padStart(2, '0')}`;
        setLastEfpbSyncTime(timeStr);
        localStorage.setItem('EFPB_LAST_SYNC_TIME', timeStr);
        showToast?.(
          data.message ||
            `Berhasil menyinkronkan ${data.items.length.toLocaleString('id-ID')} item persediaan dari e-FPB!`,
          'success'
        );
      }
    } catch (err: any) {
      console.error('Quick sync e-FPB error:', err);
      showToast?.('Gagal menyinkronkan e-FPB. Buka pengaturan.', 'error');
      setIsEfpbModalOpen(true);
    } finally {
      setIsQuickSyncingEfpb(false);
    }
  };

  // Local File Upload Handler
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
    if (typeof window !== 'undefined' && !window.confirm('Kosongkan data persediaan di layar saat ini? Anda dapat memuat ulang kapan saja.')) {
      return;
    }
    onUpdateInventory([], null);
    showToast?.('Data persediaan telah dikosongkan.', 'info');
  };

  // Filters state
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCompany, setSelectedCompany] = useState<string>('ALL');
  const [stockStatus, setStockStatus] = useState<StockStatusFilter>('ALL');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [sifatFilter, setSifatFilter] = useState<SifatEntitasFilter>('ALL');
  const [levelFilter, setLevelFilter] = useState<LevelFilter>('ALL');
  const [isCompactDensity, setIsCompactDensity] = useState<boolean>(false);

  // Pagination state
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [rowsPerPage, setRowsPerPage] = useState<number>(25);

  // Sorting state
  const [sortField, setSortField] = useState<'quantity' | 'itemCode' | 'description' | 'perusahaan' | 'kategoriUtama'>('quantity');
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

  // Distinct categories available in current items
  const distinctCategories = useMemo(() => {
    const set = new Set<string>();
    items.forEach((it) => {
      const cat = it.kategoriUtama || it.category;
      if (cat && cat !== '-') set.add(cat);
    });
    return Array.from(set).sort();
  }, [items]);

  // Filtered dataset for Katalog subtab
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
    if (selectedCategory !== 'ALL') {
      result = result.filter((it) => {
        const cat = it.kategoriUtama || it.category;
        return cat === selectedCategory;
      });
    }

    // Sifat Entitas filter
    if (sifatFilter === 'FISIK') {
      result = result.filter((it) => (it.sifatEntitas || '').toLowerCase().includes('fisik') && !(it.sifatEntitas || '').toLowerCase().includes('non'));
    } else if (sifatFilter === 'JASA') {
      result = result.filter((it) => (it.sifatEntitas || '').toLowerCase().includes('jasa'));
    } else if (sifatFilter === 'AKUNTANSI') {
      result = result.filter((it) => (it.sifatEntitas || '').toLowerCase().includes('akun'));
    }

    // Level filter
    if (levelFilter !== 'ALL') {
      result = result.filter((it) => (it.level || '').toLowerCase().includes(levelFilter.toLowerCase()));
    }

    // Search query filter
    if (searchQuery.trim() !== '') {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(
        (it) =>
          it.itemCode.toLowerCase().includes(q) ||
          it.description.toLowerCase().includes(q) ||
          it.perusahaan.toLowerCase().includes(q) ||
          (it.kategoriUtama || '').toLowerCase().includes(q) ||
          (it.subKategori || '').toLowerCase().includes(q) ||
          (it.rekomendasi || '').toLowerCase().includes(q)
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
      } else if (sortField === 'perusahaan') {
        cmp = a.perusahaan.localeCompare(b.perusahaan);
      } else if (sortField === 'kategoriUtama') {
        cmp = (a.kategoriUtama || '').localeCompare(b.kategoriUtama || '');
      }
      return sortAsc ? cmp : -cmp;
    });

    return result;
  }, [
    items,
    selectedCompany,
    stockStatus,
    selectedCategory,
    sifatFilter,
    levelFilter,
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

  // Export full or filtered data to Excel
  const handleExportExcel = () => {
    if (items.length === 0) {
      showToast?.('Tidak ada data persediaan untuk diekspor.', 'warning');
      return;
    }
    showToast?.('Menyiapkan file Excel persediaan lengkap...', 'info');
    exportInventoryToExcel(items, 'Data_Persediaan_Stok_Accurate_CPG_2026.xlsx');
    showToast?.('File Excel berhasil diunduh!', 'success');
  };

  // Company badge styling
  const getCompanyBadgeClass = (company: string) => {
    const up = company.toUpperCase();
    if (up.includes('CINDARA') || up.includes('CPL')) {
      return 'bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/30';
    }
    if (up.includes('MANDAR') || up.includes('MO')) {
      return 'bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/30';
    }
    if (up.includes('HANA') || up.includes('HL')) {
      return 'bg-cyan-500/10 text-cyan-700 dark:text-cyan-300 border-cyan-500/30';
    }
    return 'bg-muted text-muted-foreground border-border';
  };

  // Sifat Entitas badge styling
  const getSifatBadgeClass = (sifat: string = '') => {
    const up = sifat.toUpperCase();
    if (up.includes('JASA')) {
      return 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30';
    }
    if (up.includes('AKUN')) {
      return 'bg-violet-500/10 text-violet-700 dark:text-violet-400 border-violet-500/30';
    }
    return 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30';
  };

  // Cleansing Items (tagged "Keluarkan dari Master Persediaan" or non-physical items or negative stock)
  const cleansingItems = useMemo(() => {
    return items.filter((it) => {
      const rek = (it.rekomendasi || '').toLowerCase();
      const sifat = (it.sifatEntitas || '').toLowerCase();
      return (
        rek.includes('keluarkan') ||
        sifat.includes('jasa') ||
        sifat.includes('akun') ||
        it.quantity < 0
      );
    });
  }, [items]);

  // Cross-check matching between procurement/FPB & inventory
  const crossCheckMatches = useMemo(() => {
    const query = crossCheckQuery.toLowerCase().trim();
    if (query) {
      return items
        .filter(
          (it) =>
            it.description.toLowerCase().includes(query) ||
            it.itemCode.toLowerCase().includes(query) ||
            (it.subKategori || '').toLowerCase().includes(query)
        )
        .slice(0, 30);
    }

    // Match pending procurement requests
    const pendingProc = procurementItems.filter((p) => p.statusBadge !== 'COMPLETED').slice(0, 15);
    const results: { proc: ProcurementItem; invMatches: InventoryItem[] }[] = [];

    for (const proc of pendingProc) {
      const words = proc.item
        .toLowerCase()
        .split(/[\s,.-]+/)
        .filter((w) => w.length >= 3 && !['dan', 'untuk', 'kapal', 'unit', 'set', 'pcs'].includes(w));

      if (words.length === 0) continue;

      const matches = items.filter((inv) => {
        const desc = inv.description.toLowerCase();
        return words.some((w) => desc.includes(w));
      });

      if (matches.length > 0) {
        results.push({
          proc,
          invMatches: matches.slice(0, 6),
        });
      }
    }

    return results;
  }, [crossCheckQuery, procurementItems, items]);

  return (
    <div className="space-y-5">
      {/* ========================================================================= */}
      {/* 1. Header Banner & Action Bar                                             */}
      {/* ========================================================================= */}
      <div className="bg-card border border-border rounded-xl p-4 sm:p-5 shadow-xs space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <span className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 shrink-0">
              <Boxes className="size-6" />
            </span>
            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-xl font-bold tracking-tight text-foreground">
                  Cek Persediaan &amp; Stok Gudang
                </h2>
                <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                  Accurate System
                </span>
                <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                  10.049 Item Terdaftar
                </span>
              </div>
              <p className="text-xs text-muted-foreground flex items-center gap-2 flex-wrap">
                <span>
                  Katalog stok konsolidasi Accurate lintas unit PT Cindara Pratama Lines (4.109), PT Mandar Ocean (3.050), dan PT Hana Lines (2.890).
                </span>
                {lastEfpbSyncTime && (
                  <span className="inline-flex items-center gap-1 font-mono text-[10px] text-indigo-600 dark:text-indigo-400 bg-indigo-500/10 px-1.5 py-0.5 rounded border border-indigo-500/20 font-semibold">
                    <Globe className="size-2.5" /> e-FPB: {lastEfpbSyncTime}
                  </span>
                )}
              </p>
            </div>
          </div>

          {/* Action Toolbar */}
          <div className="flex items-center gap-2 flex-wrap self-start lg:self-auto">
            {/* Muat Ulang Data Terbaru Button */}
            <button
              onClick={handleReloadFreshestData}
              disabled={isReloadingServer || isLoading}
              className="h-8 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-xs flex items-center gap-1.5 transition active:scale-95 disabled:opacity-50 cursor-pointer"
              title="Muat ulang 10.049 data persediaan dari file konsolidasi Excel di server"
            >
              <RefreshCw className={`size-3.5 ${isReloadingServer ? 'animate-spin' : ''}`} />
              <span>{isReloadingServer ? 'Memuat...' : 'Muat Data Terbaru'}</span>
            </button>

            {/* Ekspor Excel Resmi */}
            <button
              onClick={handleExportExcel}
              className="h-8 px-3 rounded-lg border border-border bg-background hover:bg-muted text-foreground text-xs font-semibold shadow-xs flex items-center gap-1.5 transition active:scale-95 cursor-pointer"
              title="Unduh laporan persediaan lengkap format Excel (.xlsx)"
            >
              <FileSpreadsheet className="size-3.5 text-emerald-600" />
              <span>Ekspor Excel</span>
            </button>

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
              className="h-8 px-2.5 rounded-lg border border-border bg-background hover:bg-muted text-muted-foreground hover:text-foreground text-xs font-medium shadow-xs flex items-center gap-1.5 transition active:scale-95 cursor-pointer"
              title="Unggah file Excel stok persediaan Accurate manual"
            >
              <Upload className="size-3.5" />
              <span className="hidden sm:inline">Unggah Excel</span>
            </button>

            {/* Refresh dari e-FPB Link Button */}
            <div className="flex items-center rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs transition shrink-0 overflow-hidden">
              <button
                onClick={handleQuickRefreshEfpb}
                disabled={isQuickSyncingEfpb}
                className="h-8 px-2.5 text-xs font-semibold flex items-center gap-1.5 transition active:scale-95 disabled:opacity-60 cursor-pointer"
                title="Refresh persediaan langsung dari portal e-FPB"
              >
                <RefreshCw className={`size-3.5 ${isQuickSyncingEfpb ? 'animate-spin' : ''}`} />
                <span className="hidden md:inline">{isQuickSyncingEfpb ? 'e-FPB...' : 'e-FPB'}</span>
              </button>
              <button
                onClick={() => setIsEfpbModalOpen(true)}
                className="h-8 px-1.5 bg-indigo-700/60 hover:bg-indigo-700 text-white/90 hover:text-white border-l border-indigo-500/40 transition flex items-center justify-center cursor-pointer"
                title="Pengaturan Kredensial & URL e-FPB"
              >
                <Settings2 className="size-3.5" />
              </button>
            </div>

            {/* Reset Button */}
            {items.length > 0 && (
              <button
                onClick={handleResetInventory}
                className="h-8 px-2 rounded-lg border border-border bg-background hover:bg-rose-500/10 text-muted-foreground hover:text-rose-500 text-xs font-medium transition shadow-xs flex items-center gap-1 active:scale-95 cursor-pointer"
                title="Kosongkan data di layar untuk pengujian"
              >
                <RotateCcw className="size-3.5" />
              </button>
            )}

            {/* Toggle KPI button */}
            <button
              onClick={toggleKpiHidden}
              className="h-8 px-2.5 rounded-lg border border-border bg-card hover:bg-muted text-xs text-muted-foreground hover:text-foreground font-medium transition shadow-xs flex items-center gap-1 cursor-pointer"
              title={isKpiHidden ? 'Tampilkan Ringkasan Metrik' : 'Sembunyikan Ringkasan Metrik'}
            >
              <span>{isKpiHidden ? 'Tampilkan KPI' : 'Sembunyikan KPI'}</span>
              <ChevronDown
                className={`size-3 transition-transform duration-200 ${
                  isKpiHidden ? '-rotate-90' : ''
                }`}
              />
            </button>
          </div>
        </div>

        {/* 4 Interactive Sub-Tabs Navigation */}
        <div className="flex items-center gap-1.5 border-t border-border pt-3 overflow-x-auto no-scrollbar">
          <button
            onClick={() => setActiveSubTab('katalog')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-2 shrink-0 cursor-pointer ${
              activeSubTab === 'katalog'
                ? 'bg-primary text-primary-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted'
            }`}
          >
            <Boxes className="size-3.5" />
            <span>Katalog Terpadu</span>
            <span
              className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full ${
                activeSubTab === 'katalog' ? 'bg-primary-foreground/20 text-primary-foreground' : 'bg-muted text-muted-foreground'
              }`}
            >
              {items.length.toLocaleString('id-ID')}
            </span>
          </button>

          <button
            onClick={() => setActiveSubTab('analisis')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-2 shrink-0 cursor-pointer ${
              activeSubTab === 'analisis'
                ? 'bg-primary text-primary-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted'
            }`}
          >
            <BarChart3 className="size-3.5" />
            <span>Analisis &amp; Kategori</span>
            <span
              className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full ${
                activeSubTab === 'analisis' ? 'bg-primary-foreground/20 text-primary-foreground' : 'bg-muted text-muted-foreground'
              }`}
            >
              Top 25
            </span>
          </button>

          <button
            onClick={() => setActiveSubTab('crossCheck')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-2 shrink-0 cursor-pointer ${
              activeSubTab === 'crossCheck'
                ? 'bg-primary text-primary-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted'
            }`}
          >
            <GitCompare className="size-3.5 text-sky-400" />
            <span>Cek Silang vs FPB</span>
          </button>

          <button
            onClick={() => setActiveSubTab('cleansing')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-2 shrink-0 cursor-pointer ${
              activeSubTab === 'cleansing'
                ? 'bg-primary text-primary-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted'
            }`}
          >
            <ShieldAlert className="size-3.5 text-amber-500" />
            <span>Rekomendasi Cleansing</span>
            <span
              className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full ${
                activeSubTab === 'cleansing' ? 'bg-amber-500/20 text-amber-200' : 'bg-amber-500/10 text-amber-600'
              }`}
            >
              {cleansingItems.length}
            </span>
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. Executive 6 KPI Cards for Inventory                                    */}
      {/* ========================================================================= */}
      {!isKpiHidden && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4 animate-in fade-in-50 duration-200">
          {/* Card 1: Total Master Items */}
          <div className="bg-card border border-border rounded-xl p-3.5 sm:p-4 shadow-xs space-y-1">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-[11px] font-semibold">Total Katalog</span>
              <Boxes className="size-4 text-primary" />
            </div>
            <div className="text-xl sm:text-2xl font-extrabold tracking-tight text-foreground font-mono">
              {liveSummary.totalItems.toLocaleString('id-ID')}
            </div>
            <p className="text-[10px] text-muted-foreground font-mono truncate">
              {liveSummary.parentItems.toLocaleString('id-ID')} Induk &bull; {liveSummary.subItems.toLocaleString('id-ID')} Sub
            </p>
          </div>

          {/* Card 2: Stok Aktif (>0) */}
          <div className="bg-card border border-emerald-500/20 bg-emerald-500/5 rounded-xl p-3.5 sm:p-4 shadow-xs space-y-1">
            <div className="flex items-center justify-between text-emerald-600 dark:text-emerald-400">
              <span className="text-[11px] font-semibold">Stok Aktif (&gt; 0)</span>
              <PackageCheck className="size-4" />
            </div>
            <div className="text-xl sm:text-2xl font-extrabold tracking-tight text-emerald-600 dark:text-emerald-400 font-mono">
              {liveSummary.activeStock.toLocaleString('id-ID')}
            </div>
            <p className="text-[10px] text-emerald-700/80 dark:text-emerald-300/80 truncate">
              Tersedia di Gudang &amp; Kapal
            </p>
          </div>

          {/* Card 3: Total Kuantitas Fisik */}
          <div className="bg-card border border-border rounded-xl p-3.5 sm:p-4 shadow-xs space-y-1">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-[11px] font-semibold">Total Kuantitas</span>
              <Layers className="size-4 text-indigo-500" />
            </div>
            <div className="text-xl sm:text-2xl font-extrabold tracking-tight text-foreground font-mono">
              {liveSummary.totalQuantity.toLocaleString('id-ID')}
            </div>
            <p className="text-[10px] text-muted-foreground truncate">
              Akumulasi Stok Induk
            </p>
          </div>

          {/* Card 4: Stok Kosong (0) */}
          <div className="bg-card border border-border rounded-xl p-3.5 sm:p-4 shadow-xs space-y-1">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-[11px] font-semibold">Stok Kosong (0)</span>
              <PackageX className="size-4 text-muted-foreground" />
            </div>
            <div className="text-xl sm:text-2xl font-extrabold tracking-tight text-muted-foreground font-mono">
              {liveSummary.zeroStock.toLocaleString('id-ID')}
            </div>
            <p className="text-[10px] text-muted-foreground truncate">
              Katalog Perlu Reorder / PO
            </p>
          </div>

          {/* Card 5: Sifat Entitas Fisik */}
          <div className="bg-card border border-border rounded-xl p-3.5 sm:p-4 shadow-xs space-y-1">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-[11px] font-semibold">Barang Fisik</span>
              <Wrench className="size-4 text-blue-500" />
            </div>
            <div className="text-xl sm:text-2xl font-extrabold tracking-tight text-blue-600 dark:text-blue-400 font-mono">
              {(liveSummary.physicalItems ?? (items.length - (liveSummary.serviceItems ?? 0) - (liveSummary.accountingItems ?? 0))).toLocaleString('id-ID')}
            </div>
            <p className="text-[10px] text-muted-foreground truncate">
              {(liveSummary.serviceItems ?? 0)} Jasa &bull; {(liveSummary.accountingItems ?? 0)} Akun
            </p>
          </div>

          {/* Card 6: Rekomendasi Cleansing */}
          <div className="bg-card border border-amber-500/20 bg-amber-500/5 rounded-xl p-3.5 sm:p-4 shadow-xs space-y-1">
            <div className="flex items-center justify-between text-amber-600 dark:text-amber-400">
              <span className="text-[11px] font-semibold">Perlu Cleansing</span>
              <AlertTriangle className="size-4" />
            </div>
            <div className="text-xl sm:text-2xl font-extrabold tracking-tight text-amber-600 dark:text-amber-400 font-mono">
              {cleansingItems.length}
            </div>
            <p className="text-[10px] text-amber-700/80 dark:text-amber-300/80 truncate">
              {liveSummary.negativeStock} Stok Minus &bull; Non-Fisik
            </p>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* Empty State Banner if items === 0                                         */}
      {/* ========================================================================= */}
      {items.length === 0 && !isLoading && (
        <div className="bg-card border-2 border-dashed border-border rounded-2xl p-8 sm:p-12 text-center space-y-4">
          <div className="size-16 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto border border-emerald-500/20">
            <Boxes className="size-8" />
          </div>
          <div className="space-y-1 max-w-md mx-auto">
            <h3 className="text-lg font-bold text-foreground">Data Persediaan Belum Dimuat</h3>
            <p className="text-xs text-muted-foreground">
              Tekan tombol di bawah untuk langsung memuat 10.049 item katalog persediaan Accurate konsolidasi PT CPL, PT Hana Lines, dan PT Mandar Ocean.
            </p>
          </div>
          <div className="flex items-center justify-center gap-3 pt-2">
            <button
              onClick={handleReloadFreshestData}
              disabled={isReloadingServer}
              className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md transition active:scale-95 flex items-center gap-2 cursor-pointer"
            >
              <RefreshCw className={`size-4 ${isReloadingServer ? 'animate-spin' : ''}`} />
              <span>{isReloadingServer ? 'Memuat 10.049 Item...' : 'Muat 10.049 Item Persediaan Accurate (Terbaru)'}</span>
            </button>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="px-4 py-2.5 rounded-xl border border-border bg-background hover:bg-muted text-foreground font-semibold text-xs transition active:scale-95 flex items-center gap-2 cursor-pointer"
            >
              <Upload className="size-4 text-muted-foreground" />
              <span>Unggah File Excel</span>
            </button>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SUBTAB 1: KATALOG TERPADU (Tabel Utama 10.049 Baris)                     */}
      {/* ========================================================================= */}
      {activeSubTab === 'katalog' && items.length > 0 && (
        <div className="space-y-4">
          {/* Filter Bar */}
          <div className="bg-card border border-border rounded-xl p-4 shadow-xs space-y-3">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              {/* Search input */}
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => handleFilterChange(() => setSearchQuery(e.target.value))}
                  placeholder="Cari kode barang, nama barang, kategori, sub-kategori, atau rekomendasi..."
                  className="w-full pl-9 pr-8 py-2 rounded-lg border border-border bg-background text-xs text-foreground placeholder:text-muted-foreground focus:outline-hidden focus:ring-2 focus:ring-primary/30"
                />
                {searchQuery && (
                  <button
                    onClick={() => handleFilterChange(() => setSearchQuery(''))}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-0.5 rounded cursor-pointer"
                  >
                    <X className="size-3.5" />
                  </button>
                )}
              </div>

              {/* Company Filter Buttons */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[11px] text-muted-foreground font-medium mr-1 hidden sm:inline">Perusahaan:</span>
                {[
                  { id: 'ALL', label: 'Semua' },
                  { id: 'PT CINDARA PRATAMA LINES', label: 'CPL (4.109)' },
                  { id: 'PT MANDAR OCEAN', label: 'MO (3.050)' },
                  { id: 'PT HANA LINES', label: 'HL (2.890)' },
                ].map((comp) => (
                  <button
                    key={comp.id}
                    onClick={() => handleFilterChange(() => setSelectedCompany(comp.id))}
                    className={`h-7 px-2.5 rounded-md text-[11px] font-semibold transition cursor-pointer ${
                      selectedCompany === comp.id
                        ? 'bg-foreground text-background shadow-xs'
                        : 'border border-border bg-background text-muted-foreground hover:text-foreground hover:bg-muted'
                    }`}
                  >
                    {comp.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Secondary Filter Row: Status Stok, Kategori Utama, Sifat, Level */}
            <div className="flex items-center justify-between gap-3 pt-2 border-t border-border flex-wrap">
              <div className="flex items-center gap-2 flex-wrap text-xs">
                {/* Status Stok filter */}
                <div className="flex items-center gap-1">
                  <span className="text-[11px] text-muted-foreground font-medium">Status:</span>
                  <select
                    value={stockStatus}
                    onChange={(e) => handleFilterChange(() => setStockStatus(e.target.value as StockStatusFilter))}
                    className="h-7 px-2 rounded-md border border-border bg-background text-[11px] font-medium text-foreground focus:outline-hidden"
                  >
                    <option value="ALL">Semua Status Stok</option>
                    <option value="READY">Stok Aktif (&gt; 0)</option>
                    <option value="ZERO">Stok Kosong (0)</option>
                    <option value="NEGATIVE">Stok Minus (&lt; 0)</option>
                  </select>
                </div>

                {/* Kategori Utama filter */}
                <div className="flex items-center gap-1">
                  <span className="text-[11px] text-muted-foreground font-medium">Kategori:</span>
                  <select
                    value={selectedCategory}
                    onChange={(e) => handleFilterChange(() => setSelectedCategory(e.target.value))}
                    className="h-7 max-w-[200px] px-2 rounded-md border border-border bg-background text-[11px] font-medium text-foreground focus:outline-hidden truncate"
                  >
                    <option value="ALL">Semua Kategori ({distinctCategories.length})</option>
                    {distinctCategories.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Sifat Entitas filter */}
                <div className="flex items-center gap-1">
                  <span className="text-[11px] text-muted-foreground font-medium">Sifat:</span>
                  <select
                    value={sifatFilter}
                    onChange={(e) => handleFilterChange(() => setSifatFilter(e.target.value as SifatEntitasFilter))}
                    className="h-7 px-2 rounded-md border border-border bg-background text-[11px] font-medium text-foreground focus:outline-hidden"
                  >
                    <option value="ALL">Semua Sifat</option>
                    <option value="FISIK">Barang Fisik</option>
                    <option value="JASA">Jasa (Non-Fisik)</option>
                    <option value="AKUNTANSI">Akun Akuntansi</option>
                  </select>
                </div>

                {/* Level filter */}
                <div className="flex items-center gap-1">
                  <span className="text-[11px] text-muted-foreground font-medium">Level:</span>
                  <select
                    value={levelFilter}
                    onChange={(e) => handleFilterChange(() => setLevelFilter(e.target.value as LevelFilter))}
                    className="h-7 px-2 rounded-md border border-border bg-background text-[11px] font-medium text-foreground focus:outline-hidden"
                  >
                    <option value="ALL">Semua Level</option>
                    <option value="Induk">Level Induk</option>
                    <option value="Sub-Barang">Level Sub-Barang</option>
                  </select>
                </div>
              </div>

              {/* Density toggle & result stats */}
              <div className="flex items-center gap-3">
                <span className="text-[11px] text-muted-foreground font-mono">
                  Menampilkan <strong>{filteredItems.length.toLocaleString('id-ID')}</strong> dari{' '}
                  {items.length.toLocaleString('id-ID')} item
                </span>
                <button
                  onClick={() => setIsCompactDensity(!isCompactDensity)}
                  className={`h-7 px-2 rounded-md border border-border text-[11px] font-medium transition cursor-pointer ${
                    isCompactDensity ? 'bg-muted text-foreground font-semibold' : 'bg-background text-muted-foreground hover:text-foreground'
                  }`}
                  title="Ubah kerapatan baris tabel"
                >
                  {isCompactDensity ? 'Mode Kompak' : 'Mode Nyaman'}
                </button>
              </div>
            </div>
          </div>

          {/* Table Container */}
          <div className="bg-card border border-border rounded-xl shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-muted/70 border-b border-border text-[11px] font-bold text-muted-foreground uppercase tracking-wider select-none">
                    <th className="py-2.5 px-3 w-12 text-center">No</th>
                    <th
                      onClick={() => {
                        setSortField('perusahaan');
                        setSortAsc(sortField === 'perusahaan' ? !sortAsc : true);
                      }}
                      className="py-2.5 px-3 cursor-pointer hover:text-foreground"
                    >
                      <div className="flex items-center gap-1">
                        <span>Perusahaan</span>
                        <ArrowUpDown className="size-3 opacity-50" />
                      </div>
                    </th>
                    <th
                      onClick={() => {
                        setSortField('itemCode');
                        setSortAsc(sortField === 'itemCode' ? !sortAsc : true);
                      }}
                      className="py-2.5 px-3 cursor-pointer hover:text-foreground"
                    >
                      <div className="flex items-center gap-1">
                        <span>No. Barang</span>
                        <ArrowUpDown className="size-3 opacity-50" />
                      </div>
                    </th>
                    <th
                      onClick={() => {
                        setSortField('description');
                        setSortAsc(sortField === 'description' ? !sortAsc : true);
                      }}
                      className="py-2.5 px-3 cursor-pointer hover:text-foreground min-w-[220px]"
                    >
                      <div className="flex items-center gap-1">
                        <span>Deskripsi Barang</span>
                        <ArrowUpDown className="size-3 opacity-50" />
                      </div>
                    </th>
                    <th
                      onClick={() => {
                        setSortField('kategoriUtama');
                        setSortAsc(sortField === 'kategoriUtama' ? !sortAsc : true);
                      }}
                      className="py-2.5 px-3 cursor-pointer hover:text-foreground"
                    >
                      <div className="flex items-center gap-1">
                        <span>Kategori Utama</span>
                        <ArrowUpDown className="size-3 opacity-50" />
                      </div>
                    </th>
                    <th className="py-2.5 px-3 text-center">Level</th>
                    <th
                      onClick={() => {
                        setSortField('quantity');
                        setSortAsc(sortField === 'quantity' ? !sortAsc : false);
                      }}
                      className="py-2.5 px-3 text-right cursor-pointer hover:text-foreground"
                    >
                      <div className="flex items-center justify-end gap-1">
                        <span>Kuantitas &amp; Satuan</span>
                        <ArrowUpDown className="size-3 opacity-50" />
                      </div>
                    </th>
                    <th className="py-2.5 px-3 text-center">Status Stok</th>
                    <th className="py-2.5 px-3">Rekomendasi Tindakan</th>
                    <th className="py-2.5 px-3 text-center w-24">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {paginatedItems.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="py-12 text-center text-muted-foreground">
                        <PackageX className="size-8 mx-auto mb-2 opacity-50" />
                        <p className="font-semibold text-sm">Tidak ditemukan barang yang cocok dengan filter.</p>
                        <p className="text-xs">Coba ubah kata kunci pencarian atau reset filter.</p>
                      </td>
                    </tr>
                  ) : (
                    paginatedItems.map((item, idx) => {
                      const rowNum = (currentPage - 1) * rowsPerPage + idx + 1;
                      const isZero = item.quantity === 0;
                      const isNegative = item.quantity < 0;
                      const isService = (item.sifatEntitas || '').toLowerCase().includes('jasa');

                      return (
                        <tr
                          key={item.id}
                          className={`hover:bg-muted/40 transition-colors ${
                            isNegative
                              ? 'bg-rose-500/5'
                              : isService
                              ? 'bg-amber-500/5'
                              : ''
                          }`}
                        >
                          <td className={`px-3 text-center font-mono text-[11px] text-muted-foreground ${isCompactDensity ? 'py-1.5' : 'py-2.5'}`}>
                            {rowNum}
                          </td>
                          <td className={`px-3 whitespace-nowrap ${isCompactDensity ? 'py-1.5' : 'py-2.5'}`}>
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold border ${getCompanyBadgeClass(
                                item.perusahaan
                              )}`}
                            >
                              {item.entity || item.perusahaan.split(' ')[1] || item.perusahaan}
                            </span>
                          </td>
                          <td className={`px-3 font-mono font-semibold whitespace-nowrap text-foreground ${isCompactDensity ? 'py-1.5' : 'py-2.5'}`}>
                            <div className="flex items-center gap-1.5">
                              <span>{item.itemCode || '-'}</span>
                              {item.itemCode && (
                                <button
                                  onClick={() => handleCopyCode(item.itemCode)}
                                  className="text-muted-foreground hover:text-primary p-0.5 rounded cursor-pointer"
                                  title="Salin Kode Barang"
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
                          <td className={`px-3 ${isCompactDensity ? 'py-1.5' : 'py-2.5'}`}>
                            <div className="font-medium text-foreground line-clamp-2">
                              {item.description}
                            </div>
                            {item.subKategori && item.subKategori !== '-' && (
                              <div className="text-[10px] text-muted-foreground truncate mt-0.5">
                                {item.subKategori}
                              </div>
                            )}
                          </td>
                          <td className={`px-3 whitespace-nowrap ${isCompactDensity ? 'py-1.5' : 'py-2.5'}`}>
                            <span className="text-[11px] text-muted-foreground font-medium">
                              {item.kategoriUtama || item.category || '-'}
                            </span>
                          </td>
                          <td className={`px-3 text-center whitespace-nowrap ${isCompactDensity ? 'py-1.5' : 'py-2.5'}`}>
                            <span
                              className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                                (item.level || '').toLowerCase().includes('induk')
                                  ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400'
                                  : 'bg-muted text-muted-foreground'
                              }`}
                            >
                              {item.level || 'Induk'}
                            </span>
                          </td>
                          <td className={`px-3 text-right whitespace-nowrap font-mono ${isCompactDensity ? 'py-1.5' : 'py-2.5'}`}>
                            <span
                              className={`font-bold text-xs ${
                                isNegative
                                  ? 'text-rose-600 dark:text-rose-400'
                                  : isZero
                                  ? 'text-muted-foreground'
                                  : 'text-emerald-600 dark:text-emerald-400'
                              }`}
                            >
                              {item.quantity.toLocaleString('id-ID')}
                            </span>
                            <span className="text-[10px] text-muted-foreground font-sans ml-1">
                              {item.uom || 'Pcs'}
                            </span>
                          </td>
                          <td className={`px-3 text-center whitespace-nowrap ${isCompactDensity ? 'py-1.5' : 'py-2.5'}`}>
                            <span
                              className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                                isNegative
                                  ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20'
                                  : isZero
                                  ? 'bg-muted text-muted-foreground border-border'
                                  : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                              }`}
                            >
                              {item.statusStok || (item.quantity > 0 ? 'Stok Aktif (>0)' : 'Stok Kosong (0)')}
                            </span>
                          </td>
                          <td className={`px-3 ${isCompactDensity ? 'py-1.5' : 'py-2.5'}`}>
                            {item.rekomendasi && item.rekomendasi !== '-' ? (
                              <span
                                className={`text-[10px] font-semibold px-2 py-0.5 rounded line-clamp-1 ${
                                  item.rekomendasi.toLowerCase().includes('keluarkan')
                                    ? 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20'
                                    : item.rekomendasi.toLowerCase().includes('kamar mesin') || item.rekomendasi.toLowerCase().includes('bunker')
                                    ? 'bg-blue-500/10 text-blue-700 dark:text-blue-400 border border-blue-500/20'
                                    : 'bg-muted text-foreground'
                                }`}
                              >
                                {item.rekomendasi}
                              </span>
                            ) : (
                              <span className="text-[10px] text-muted-foreground">-</span>
                            )}
                          </td>
                          <td className={`px-3 text-center whitespace-nowrap ${isCompactDensity ? 'py-1.5' : 'py-2.5'}`}>
                            <button
                              onClick={() => setSelectedItemDetail(item)}
                              className="px-2.5 py-1 rounded bg-muted hover:bg-primary hover:text-primary-foreground text-foreground text-[11px] font-semibold transition cursor-pointer flex items-center justify-center gap-1 mx-auto"
                            >
                              <Eye className="size-3" />
                              <span>Detail</span>
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
            {totalPages > 1 && (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 border-t border-border bg-muted/30 text-xs">
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground text-[11px]">Baris per halaman:</span>
                  <select
                    value={rowsPerPage}
                    onChange={(e) => {
                      setRowsPerPage(Number(e.target.value));
                      setCurrentPage(1);
                    }}
                    className="h-7 px-2 rounded-md border border-border bg-background text-[11px] font-medium text-foreground focus:outline-hidden"
                  >
                    <option value={25}>25</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                    <option value={200}>200</option>
                  </select>
                  <span className="text-muted-foreground text-[11px]">
                    Halaman <strong>{currentPage}</strong> dari <strong>{totalPages}</strong>
                  </span>
                </div>

                <div className="flex items-center gap-1 self-end sm:self-auto">
                  <button
                    onClick={() => setCurrentPage(1)}
                    disabled={currentPage === 1}
                    className="h-7 px-2 rounded-md border border-border bg-background hover:bg-muted text-muted-foreground disabled:opacity-40 text-[11px] cursor-pointer"
                  >
                    Awal
                  </button>
                  <button
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="h-7 px-2 rounded-md border border-border bg-background hover:bg-muted text-muted-foreground disabled:opacity-40 flex items-center gap-1 text-[11px] cursor-pointer"
                  >
                    <ChevronLeft className="size-3.5" />
                    <span>Sebelumnya</span>
                  </button>
                  <button
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="h-7 px-2 rounded-md border border-border bg-background hover:bg-muted text-muted-foreground disabled:opacity-40 flex items-center gap-1 text-[11px] cursor-pointer"
                  >
                    <span>Berikutnya</span>
                    <ChevronRight className="size-3.5" />
                  </button>
                  <button
                    onClick={() => setCurrentPage(totalPages)}
                    disabled={currentPage === totalPages}
                    className="h-7 px-2 rounded-md border border-border bg-background hover:bg-muted text-muted-foreground disabled:opacity-40 text-[11px] cursor-pointer"
                  >
                    Akhir
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SUBTAB 2: ANALISIS KATEGORI & TOP 25 KUANTITAS                            */}
      {/* ========================================================================= */}
      {activeSubTab === 'analisis' && (
        <div className="space-y-5">
          {/* 3 Company Cards Breakdown */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {liveSummary.byCompany.map((comp) => {
              const activeRatio = comp.totalItems > 0 ? ((comp.activeStock / comp.totalItems) * 100).toFixed(1) : '0';
              return (
                <div
                  key={comp.name}
                  className="bg-card border border-border rounded-xl p-4 sm:p-5 shadow-xs space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={`px-2.5 py-1 rounded text-xs font-mono font-bold border ${getCompanyBadgeClass(
                        comp.name
                      )}`}
                    >
                      {comp.entity || comp.name}
                    </span>
                    <span className="text-xs text-muted-foreground font-mono">
                      {activeRatio}% Stok Aktif
                    </span>
                  </div>
                  <h4 className="font-bold text-sm text-foreground truncate">{comp.name}</h4>
                  <div className="grid grid-cols-2 gap-2 text-xs pt-1">
                    <div className="p-2 rounded bg-muted/40 border border-border">
                      <span className="text-muted-foreground text-[10px] block">Total Item:</span>
                      <span className="font-bold font-mono text-sm text-foreground">
                        {comp.totalItems.toLocaleString('id-ID')}
                      </span>
                    </div>
                    <div className="p-2 rounded bg-emerald-500/10 border border-emerald-500/20">
                      <span className="text-emerald-700 dark:text-emerald-300 text-[10px] block">Stok Aktif (&gt;0):</span>
                      <span className="font-bold font-mono text-sm text-emerald-600 dark:text-emerald-400">
                        {comp.activeStock.toLocaleString('id-ID')}
                      </span>
                    </div>
                    <div className="p-2 rounded bg-muted/40 border border-border">
                      <span className="text-muted-foreground text-[10px] block">Stok Kosong (0):</span>
                      <span className="font-bold font-mono text-sm text-muted-foreground">
                        {comp.zeroStock.toLocaleString('id-ID')}
                      </span>
                    </div>
                    <div className="p-2 rounded bg-indigo-500/10 border border-indigo-500/20">
                      <span className="text-indigo-700 dark:text-indigo-300 text-[10px] block">Total Kuantitas:</span>
                      <span className="font-bold font-mono text-sm text-indigo-600 dark:text-indigo-400">
                        {comp.totalQuantity.toLocaleString('id-ID')}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Top 25 Highest Stock Items */}
          <div className="bg-card border border-border rounded-xl p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <h3 className="font-bold text-base text-foreground flex items-center gap-2">
                  <TrendingUp className="size-4 text-emerald-500" />
                  <span>Top 25 Item Persediaan Terbanyak (Stok Induk)</span>
                </h3>
                <p className="text-xs text-muted-foreground">
                  Daftar item dengan kuantitas tertinggi mencakup Bahan Bakar (Bunker), Pelumas Mesin, Perkakas, dan Consumables.
                </p>
              </div>
              <span className="text-xs font-mono font-bold px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                Sorted by Qty (Desc)
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {liveSummary.topItems.map((item, idx) => {
                const maxQty = liveSummary.topItems[0]?.quantity || 1;
                const pct = Math.max(2, Math.min(100, (item.quantity / maxQty) * 100));

                return (
                  <div
                    key={`${item.itemCode}-${idx}`}
                    onClick={() => {
                      const fullItem = items.find((it) => it.itemCode === item.itemCode && it.perusahaan === item.company);
                      if (fullItem) setSelectedItemDetail(fullItem);
                    }}
                    className="p-3 rounded-lg border border-border hover:border-primary/50 hover:bg-muted/30 transition cursor-pointer space-y-2"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className={`size-6 rounded-md flex items-center justify-center font-mono font-bold text-xs shrink-0 ${
                            idx === 0
                              ? 'bg-amber-500 text-amber-950 font-black'
                              : idx === 1
                              ? 'bg-slate-300 text-slate-900 font-black'
                              : idx === 2
                              ? 'bg-amber-700 text-amber-100 font-black'
                              : 'bg-muted text-muted-foreground'
                          }`}
                        >
                          {idx + 1}
                        </span>
                        <div className="min-w-0">
                          <span className="font-bold text-xs text-foreground block truncate">
                            {item.description}
                          </span>
                          <span className="text-[10px] text-muted-foreground font-mono">
                            {item.itemCode} &bull; {item.company}
                          </span>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="font-mono font-extrabold text-sm text-emerald-600 dark:text-emerald-400 block">
                          {item.quantity.toLocaleString('id-ID')}
                        </span>
                        <span className="text-[10px] text-muted-foreground font-medium">
                          {item.uom || 'Unit'}
                        </span>
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
                      <div
                        className="bg-emerald-500 h-1.5 rounded-full transition-all duration-500"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Category Distribution Grid */}
          {liveSummary.byCategory && liveSummary.byCategory.length > 0 && (
            <div className="bg-card border border-border rounded-xl p-5 shadow-xs space-y-4">
              <h3 className="font-bold text-base text-foreground flex items-center gap-2">
                <Layers className="size-4 text-primary" />
                <span>Distribusi Kategori Utama Persediaan</span>
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {liveSummary.byCategory.slice(0, 15).map((cat) => {
                  const activeRatio = cat.totalItems > 0 ? ((cat.activeItems / cat.totalItems) * 100).toFixed(0) : '0';
                  return (
                    <div
                      key={cat.category}
                      className="p-3 rounded-lg border border-border bg-background space-y-1.5"
                    >
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-foreground truncate">{cat.category}</span>
                        <span className="font-mono text-[11px] font-semibold text-primary">
                          {cat.totalItems.toLocaleString('id-ID')} item
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                        <span>Stok Aktif: {cat.activeItems} item</span>
                        <span>Total Qty: {cat.totalQuantity.toLocaleString('id-ID')}</span>
                      </div>
                      <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
                        <div
                          className="bg-primary h-1.5 rounded-full"
                          style={{ width: `${Math.max(3, Number(activeRatio))}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* SUBTAB 3: CROSS-CHECK VS FPB & PENGADAAN                                 */}
      {/* ========================================================================= */}
      {activeSubTab === 'crossCheck' && (
        <div className="space-y-4">
          <div className="bg-card border border-border rounded-xl p-5 shadow-xs space-y-3">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20 shrink-0">
                <GitCompare className="size-5" />
              </div>
              <div className="space-y-1">
                <h3 className="font-bold text-base text-foreground">
                  Audit Silang Persediaan vs Pengajuan Barang (FPB)
                </h3>
                <p className="text-xs text-muted-foreground">
                  Gunakan fitur ini untuk memeriksa apakah barang yang sedang diajukan di FPB / Pengadaan sebenarnya sudah tersedia di stok Accurate salah satu perusahaan (CPL / Mandar Ocean / Hana Lines). Menghindari pembelian ganda dan menghemat pengeluaran operasional.
                </p>
              </div>
            </div>

            {/* Cross check search bar */}
            <div className="relative pt-2">
              <Search className="absolute left-3 top-1/2 translate-y-0.5 size-4 text-muted-foreground" />
              <input
                type="text"
                value={crossCheckQuery}
                onChange={(e) => setCrossCheckQuery(e.target.value)}
                placeholder="Ketik nama barang yang diajukan di FPB (contoh: Biosolar, Meditran, Gurinda, Filter, Valve, Kuas, Baut)..."
                className="w-full pl-9 pr-8 py-2.5 rounded-lg border border-border bg-background text-xs text-foreground placeholder:text-muted-foreground focus:outline-hidden focus:ring-2 focus:ring-sky-500/30"
              />
              {crossCheckQuery && (
                <button
                  onClick={() => setCrossCheckQuery('')}
                  className="absolute right-2.5 top-1/2 translate-y-0.5 text-muted-foreground hover:text-foreground p-0.5 rounded cursor-pointer"
                >
                  <X className="size-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Results list */}
          {crossCheckQuery ? (
            <div className="bg-card border border-border rounded-xl p-4 shadow-xs space-y-3">
              <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground">
                <span>Hasil Pencarian di 3 Perusahaan (CPL, MO, HL)</span>
                <span>{(crossCheckMatches as InventoryItem[]).length} item ditemukan</span>
              </div>

              {(crossCheckMatches as InventoryItem[]).length === 0 ? (
                <div className="py-8 text-center text-muted-foreground text-xs">
                  Tidak ditemukan barang di database Accurate dengan kata kunci &quot;{crossCheckQuery}&quot;.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {(crossCheckMatches as InventoryItem[]).map((inv) => (
                    <div
                      key={inv.id}
                      onClick={() => setSelectedItemDetail(inv)}
                      className="p-3 rounded-lg border border-border bg-background hover:border-primary/50 hover:bg-muted/20 transition cursor-pointer space-y-1.5"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <span className="font-bold text-xs text-foreground block truncate">
                            {inv.description}
                          </span>
                          <span className="text-[10px] text-muted-foreground font-mono">
                            {inv.itemCode} &bull; {inv.perusahaan}
                          </span>
                        </div>
                        <span
                          className={`font-mono font-bold text-xs px-2 py-0.5 rounded border shrink-0 ${
                            inv.quantity > 0
                              ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
                              : 'bg-muted text-muted-foreground border-border'
                          }`}
                        >
                          {inv.quantity.toLocaleString('id-ID')} {inv.uom || 'Pcs'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-[10px] text-muted-foreground pt-1">
                        <span>{inv.kategoriUtama || inv.category}</span>
                        <span className="font-semibold text-primary">Klik untuk Rincian &rarr;</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="bg-card border border-border rounded-xl p-4 shadow-xs space-y-3">
              <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground">
                <span>Pencocokan Otomatis dari Pengajuan FPB Pengadaan Terkini:</span>
                <span>{(crossCheckMatches as { proc: ProcurementItem; invMatches: InventoryItem[] }[]).length} FPB Terdeteksi Ada Stok</span>
              </div>

              {(crossCheckMatches as { proc: ProcurementItem; invMatches: InventoryItem[] }[]).length === 0 ? (
                <div className="py-8 text-center text-muted-foreground text-xs">
                  Semua barang di pengadaan sedang diproses atau masukkan kata kunci pada pencarian di atas untuk memeriksa barang tertentu.
                </div>
              ) : (
                <div className="space-y-3">
                  {(crossCheckMatches as { proc: ProcurementItem; invMatches: InventoryItem[] }[]).map(
                    (match, i) => (
                      <div
                        key={`match-${i}`}
                        className="p-3.5 rounded-lg border border-border bg-background space-y-2.5"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-xs">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-primary px-1.5 py-0.5 rounded bg-primary/10">
                              FPB: {match.proc.fpb}
                            </span>
                            <span className="font-semibold text-foreground">{match.proc.item}</span>
                          </div>
                          <span className="text-[11px] text-muted-foreground font-mono">
                            Kapal: {match.proc.deptArmada || match.proc.entity || '-'}
                          </span>
                        </div>

                        <div className="bg-muted/40 p-2.5 rounded-md border border-border/80 space-y-1.5">
                          <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider block">
                            Kandidat Stok Tersedia di Gudang (Bisa Diambil Tanpa Beli Baru):
                          </span>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                            {match.invMatches.map((inv) => (
                              <div
                                key={inv.id}
                                onClick={() => setSelectedItemDetail(inv)}
                                className="p-2 rounded bg-background border border-border flex items-center justify-between gap-2 hover:border-primary/50 cursor-pointer"
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
                                  {inv.quantity.toLocaleString('id-ID')} {inv.uom || 'Pcs'}
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
      )}

      {/* ========================================================================= */}
      {/* SUBTAB 4: REKOMENDASI CLEANSING (356 Item Jasa / Non-Fisik)               */}
      {/* ========================================================================= */}
      {activeSubTab === 'cleansing' && (
        <div className="space-y-4">
          <div className="bg-card border border-amber-500/20 bg-amber-500/5 rounded-xl p-5 shadow-xs space-y-3">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 shrink-0">
                <ShieldAlert className="size-5" />
              </div>
              <div className="space-y-1">
                <h3 className="font-bold text-base text-foreground">
                  Audit Cleansing Master Persediaan Accurate
                </h3>
                <p className="text-xs text-muted-foreground">
                  Ditemukan <strong>{cleansingItems.length} item</strong> yang terdaftar sebagai persediaan barang di Accurate namun bersifat <strong>Jasa Transportasi / Ongkos Angkut / Akun Perantara</strong> atau memiliki <strong>Stok Minus (&lt;0)</strong>. Item-item ini direkomendasikan untuk dikeluarkan dari master persediaan fisik agar laporan valuasi aset persediaan akurat.
                </p>
              </div>
            </div>
          </div>

          <div className="bg-card border border-border rounded-xl shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-muted/70 border-b border-border text-[11px] font-bold text-muted-foreground uppercase tracking-wider select-none">
                    <th className="py-2.5 px-3 w-12 text-center">No</th>
                    <th className="py-2.5 px-3">Perusahaan</th>
                    <th className="py-2.5 px-3">No. Barang</th>
                    <th className="py-2.5 px-3">Deskripsi Barang / Akun</th>
                    <th className="py-2.5 px-3">Sifat Entitas</th>
                    <th className="py-2.5 px-3 text-right">Kuantitas di Accurate</th>
                    <th className="py-2.5 px-3">Rekomendasi Tindakan</th>
                    <th className="py-2.5 px-3 text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {cleansingItems.map((item, idx) => (
                    <tr key={item.id} className="hover:bg-muted/40 transition-colors">
                      <td className="py-2.5 px-3 text-center font-mono text-muted-foreground">
                        {idx + 1}
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold border ${getCompanyBadgeClass(item.perusahaan)}`}>
                          {item.entity || item.perusahaan}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 font-mono font-bold text-foreground">
                        {item.itemCode}
                      </td>
                      <td className="py-2.5 px-3 font-medium text-foreground">
                        {item.description}
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${getSifatBadgeClass(item.sifatEntitas)}`}>
                          {item.sifatEntitas || 'Jasa (Non-Fisik)'}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-foreground">
                        {item.quantity.toLocaleString('id-ID')} {item.uom || 'Unit'}
                      </td>
                      <td className="py-2.5 px-3">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20">
                          {item.rekomendasi || 'Keluarkan dari Master Persediaan'}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <button
                          onClick={() => setSelectedItemDetail(item)}
                          className="px-2 py-1 rounded bg-muted hover:bg-primary hover:text-primary-foreground text-foreground text-[10px] font-semibold transition cursor-pointer"
                        >
                          Detail
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. Modal: Item Detail Inspection                                          */}
      {/* ========================================================================= */}
      {selectedItemDetail && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 printable-modal-overlay">
          <div className="bg-card border border-border rounded-2xl max-w-lg w-full p-5 sm:p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-200 printable-modal-content max-h-[90vh] overflow-y-auto no-scrollbar">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div className="flex items-center gap-2">
                <Boxes className="size-5 text-emerald-500" />
                <h3 className="font-bold text-base text-foreground">Rincian Data Persediaan</h3>
              </div>
              <button
                onClick={() => setSelectedItemDetail(null)}
                className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition cursor-pointer"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              {/* Header Box */}
              <div className="p-3.5 rounded-xl bg-muted/40 border border-border space-y-1.5">
                <span className="text-muted-foreground text-[11px] block">Deskripsi Barang:</span>
                <p className="font-bold text-base text-foreground leading-snug">{selectedItemDetail.description}</p>
                <div className="flex items-center gap-3 pt-1 flex-wrap">
                  <span className="font-mono text-muted-foreground">
                    No. Barang: <strong className="text-foreground">{selectedItemDetail.itemCode || '-'}</strong>
                  </span>
                  {selectedItemDetail.itemCode && (
                    <button
                      onClick={() => handleCopyCode(selectedItemDetail.itemCode)}
                      className="text-primary hover:underline text-[11px] flex items-center gap-1 font-semibold cursor-pointer"
                    >
                      <Copy className="size-3" />
                      <span>Salin Kode</span>
                    </button>
                  )}
                </div>
              </div>

              {/* 2x2 Grid of details */}
              <div className="grid grid-cols-2 gap-2.5">
                <div className="p-3 rounded-lg border border-border bg-background">
                  <span className="text-muted-foreground text-[10px] block">Perusahaan:</span>
                  <span className="font-bold text-foreground block truncate mt-0.5">
                    {selectedItemDetail.perusahaan}
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    Entitas: {selectedItemDetail.entity}
                  </span>
                </div>

                <div className="p-3 rounded-lg border border-border bg-background">
                  <span className="text-muted-foreground text-[10px] block">Kuantitas Stok:</span>
                  <span
                    className={`font-mono font-extrabold text-base block mt-0.5 ${
                      selectedItemDetail.quantity > 0
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : selectedItemDetail.quantity === 0
                        ? 'text-muted-foreground'
                        : 'text-rose-600 dark:text-rose-400'
                    }`}
                  >
                    {selectedItemDetail.quantity.toLocaleString('id-ID')}{' '}
                    <span className="text-xs font-sans font-medium text-muted-foreground">
                      {selectedItemDetail.uom || 'Unit'}
                    </span>
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    {selectedItemDetail.statusStok || (selectedItemDetail.quantity > 0 ? 'Stok Tersedia' : 'Stok Kosong')}
                  </span>
                </div>

                <div className="p-3 rounded-lg border border-border bg-background">
                  <span className="text-muted-foreground text-[10px] block">Kategori Utama:</span>
                  <span className="font-semibold text-foreground block truncate mt-0.5">
                    {selectedItemDetail.kategoriUtama || selectedItemDetail.category || '-'}
                  </span>
                  {selectedItemDetail.subKategori && (
                    <span className="text-[10px] text-muted-foreground block truncate">
                      {selectedItemDetail.subKategori}
                    </span>
                  )}
                </div>

                <div className="p-3 rounded-lg border border-border bg-background">
                  <span className="text-muted-foreground text-[10px] block">Level &amp; Sifat:</span>
                  <span className="font-semibold text-foreground block mt-0.5">
                    {selectedItemDetail.level || 'Induk'} &bull; {selectedItemDetail.sifatEntitas || 'Barang Fisik'}
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    Tipe: {selectedItemDetail.itemType}
                  </span>
                </div>
              </div>

              {/* Rekomendasi Tindakan Logistik Box */}
              <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-900 dark:text-emerald-300 space-y-1">
                <div className="flex items-center gap-1.5 font-bold text-xs">
                  <Sparkles className="size-3.5" />
                  <span>Rekomendasi Tindakan Logistik:</span>
                </div>
                <p className="text-[11px] font-medium leading-relaxed">
                  {selectedItemDetail.rekomendasi || (
                    selectedItemDetail.quantity > 0
                      ? 'Stok barang ini siap pakai di gudang/kamar mesin. Jika ada pengajuan FPB, utamakan pengeluaran stok yang ada sebelum menerbitkan PO baru.'
                      : 'Stok barang ini kosong di sistem Accurate. Jika ada kebutuhan armada, segera proses pengadaan (PO) baru.'
                  )}
                </p>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-between gap-2 pt-2 border-t border-border">
              <button
                type="button"
                onClick={() => {
                  const text = `*INFORMASI STOK ACCURATE CPG*\n- Kode: ${selectedItemDetail.itemCode}\n- Nama: ${selectedItemDetail.description}\n- Perusahaan: ${selectedItemDetail.perusahaan}\n- Kuantitas: ${selectedItemDetail.quantity.toLocaleString('id-ID')} ${selectedItemDetail.uom || 'Unit'}\n- Status: ${selectedItemDetail.statusStok || 'Tersedia'}\n- Rekomendasi: ${selectedItemDetail.rekomendasi || '-'}`;
                  navigator.clipboard.writeText(text);
                  showToast?.('Format pesan WhatsApp disalin ke clipboard!', 'info');
                }}
                className="h-8 px-3 rounded-lg border border-border bg-background hover:bg-muted text-foreground text-xs font-semibold flex items-center gap-1.5 transition active:scale-95 cursor-pointer"
                title="Salin ringkasan data barang untuk dikirim ke tim logistik"
              >
                <Share2 className="size-3 text-emerald-500" />
                <span>Salin Info WhatsApp</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    if (typeof window !== 'undefined') window.print();
                  }}
                  className="h-8 px-3 bg-background hover:bg-muted text-foreground border border-border rounded-lg text-xs font-semibold flex items-center gap-1.5 transition active:scale-95 cursor-pointer print:hidden"
                >
                  <Printer className="size-3.5 text-primary" />
                  <span>Print</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedItemDetail(null)}
                  className="h-8 px-4 rounded-lg bg-foreground text-background font-bold text-xs transition active:scale-95 cursor-pointer"
                >
                  TUTUP
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Sinkronisasi e-FPB */}
      <SyncEfpbModal
        isOpen={isEfpbModalOpen}
        onClose={() => setIsEfpbModalOpen(false)}
        onSuccess={(newItems, newSummary) => {
          onUpdateInventory(newItems, newSummary);
          const now = new Date();
          const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now
            .getMinutes()
            .toString()
            .padStart(2, '0')}`;
          setLastEfpbSyncTime(timeStr);
        }}
        showToast={showToast}
      />
    </div>
  );
}
