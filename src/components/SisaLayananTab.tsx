'use client';

import React, { useState, useMemo, useRef } from 'react';
import {
  Search,
  Filter,
  Download,
  Upload,
  RefreshCw,
  Layers,
  CheckCircle2,
  AlertCircle,
  Clock,
  Package,
  Boxes,
  Building2,
  Anchor,
  Eye,
  X,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
  Sparkles,
  ExternalLink,
  Copy,
  Check,
  FileSpreadsheet,
  AlertTriangle,
  ChevronDown,
  Info,
  Camera,
  FileText,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { SisaLayananItem, SisaLayananSummary } from '@/types/sisaLayanan';
import { parseSisaLayananWorkbook, calculateSisaLayananSummary } from '@/utils/sisaLayananParser';
import TtbMediaModal from './TtbMediaModal';

interface SisaLayananTabProps {
  items: SisaLayananItem[];
  summary?: SisaLayananSummary | null;
  isLoading?: boolean;
  onRefresh: () => Promise<void>;
  onUploadExcel?: (newItems: SisaLayananItem[], summary: SisaLayananSummary) => void;
  onOpenAudit?: (fpb: string, po?: string) => void;
  showToast?: (msg: string, type?: 'info' | 'success' | 'warning' | 'error') => void;
}

export default function SisaLayananTab({
  items = [],
  summary,
  isLoading = false,
  onRefresh,
  onUploadExcel,
  onOpenAudit,
  showToast,
}: SisaLayananTabProps) {
  // State Filter
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [ptFilter, setPtFilter] = useState<string>('ALL');
  const [deptFilter, setDeptFilter] = useState<string>('ALL');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [priorityFilter, setPriorityFilter] = useState<string>('ALL');
  const [onlySelisih, setOnlySelisih] = useState<boolean>(false);

  // Sorting
  const [sortField, setSortField] = useState<keyof SisaLayananItem>('noFpb');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Pagination
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(50);

  // Detail Modal & Copy State
  const [selectedItem, setSelectedItem] = useState<SisaLayananItem | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [mediaModalData, setMediaModalData] = useState<{
    noTtb?: string;
    noFstb?: string;
    fpb?: string;
    po?: string;
    item?: string;
    armada?: string;
    entity?: string;
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Dynamic filter lists
  const { ptList, deptList, categoryList, priorityList } = useMemo(() => {
    const pts = new Set<string>();
    const depts = new Set<string>();
    const cats = new Set<string>();
    const prios = new Set<string>();

    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      if (it.pt) pts.add(it.pt);
      if (it.departement) depts.add(it.departement);
      if (it.kategori) cats.add(it.kategori);
      if (it.priority) prios.add(it.priority);
    }

    return {
      ptList: Array.from(pts).sort(),
      deptList: Array.from(depts).sort(),
      categoryList: Array.from(cats).sort(),
      priorityList: Array.from(prios).sort(),
    };
  }, [items]);

  // Handle Copy to Clipboard
  const handleCopy = (text: string | undefined | null, label: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedKey(label);
    if (showToast) showToast(`${label} disalin ke clipboard!`, 'info');
    setTimeout(() => setCopiedKey(null), 2000);
  };

  // Filtered & Sorted items
  const filteredItems = useMemo(() => {
    let result = items;

    // Status filter
    if (statusFilter !== 'ALL') {
      result = result.filter((it) => it.status.toUpperCase() === statusFilter.toUpperCase());
    }

    // PT filter
    if (ptFilter !== 'ALL') {
      result = result.filter((it) => it.pt === ptFilter);
    }

    // Departemen filter
    if (deptFilter !== 'ALL') {
      result = result.filter((it) => it.departement === deptFilter);
    }

    // Kategori filter
    if (categoryFilter !== 'ALL') {
      result = result.filter((it) => it.kategori.toLowerCase() === categoryFilter.toLowerCase());
    }

    // Priority filter
    if (priorityFilter !== 'ALL') {
      result = result.filter((it) => it.priority === priorityFilter);
    }

    // Hanya yang ada selisih (belum lengkap diterima)
    if (onlySelisih) {
      result = result.filter((it) => it.selisih > 0 || it.status !== 'CLOSE');
    }

    // Search query
    if (searchQuery.trim() !== '') {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(
        (it) =>
          (it.noFpb || '').toLowerCase().includes(q) ||
          (it.noPo || '').toLowerCase().includes(q) ||
          (it.noFstb || '').toLowerCase().includes(q) ||
          (it.noTtb || '').toLowerCase().includes(q) ||
          (it.kodeBarang || '').toLowerCase().includes(q) ||
          (it.namaBarang || '').toLowerCase().includes(q) ||
          (it.departement || '').toLowerCase().includes(q) ||
          (it.keterangan || '').toLowerCase().includes(q) ||
          (it.pt || '').toLowerCase().includes(q) ||
          (it.kategori || '').toLowerCase().includes(q)
      );
    }

    // Sorting
    return [...result].sort((a, b) => {
      let valA: any = a[sortField];
      let valB: any = b[sortField];

      if (typeof valA === 'number' && typeof valB === 'number') {
        return sortOrder === 'asc' ? valA - valB : valB - valA;
      }

      valA = String(valA || '').toLowerCase();
      valB = String(valB || '').toLowerCase();

      if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
      if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });
  }, [
    items,
    statusFilter,
    ptFilter,
    deptFilter,
    categoryFilter,
    priorityFilter,
    onlySelisih,
    searchQuery,
    sortField,
    sortOrder,
  ]);

  // Pagination calculation
  const totalPages = Math.ceil(filteredItems.length / pageSize) || 1;
  const currentSafePage = Math.min(currentPage, totalPages);
  const startIndex = (currentSafePage - 1) * pageSize;
  const paginatedItems = useMemo(
    () => filteredItems.slice(startIndex, startIndex + pageSize),
    [filteredItems, startIndex, pageSize]
  );

  const handleSort = (field: keyof SisaLayananItem) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  // Export to Excel handler
  const handleExportExcel = () => {
    if (filteredItems.length === 0) {
      showToast?.('Tidak ada data yang sesuai filter untuk diekspor.', 'warning');
      return;
    }

    setIsExporting(true);
    showToast?.('Menyiapkan file Excel ekspor...', 'info');

    setTimeout(() => {
      try {
        const exportRows = filteredItems.map((r) => ({
          'NO. FPB': r.noFpb,
          'TGL FPB': r.tglFpb,
          'NO. PO': r.noPo,
          'TGL PO': r.tglPo,
          'NO. FSTB': r.noFstb,
          'TGL FSTB': r.tglFstb,
          'NO. TTB': r.noTtb,
          'TGL TTB': r.tglTtb,
          'KODE BARANG': r.kodeBarang,
          'NAMA BARANG': r.namaBarang,
          'JML FPB': r.jmlFpb,
          'JML PO': r.jmlPo,
          'JML FSTB': r.jmlFstb,
          'JML TTB': r.jmlTtb,
          SELISIH: r.selisih,
          SATUAN: r.satuan,
          KETERANGAN: r.keterangan,
          KATEGORI: r.kategori,
          STATUS: r.status,
          DEPARTEMENT: r.departement,
          PT: r.pt,
          PRIORITY: r.priority,
          'WAKTU PROSES': r.waktuProses,
        }));

        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet(exportRows);
        XLSX.utils.book_append_sheet(wb, ws, 'SISA LAYANAN');
        XLSX.writeFile(
          wb,
          `CPG_Sisa_Layanan_Gabungan_${new Date().toISOString().slice(0, 10)}.xlsx`
        );
        showToast?.(
          `Berhasil mengekspor ${filteredItems.length.toLocaleString('id-ID')} baris data ke Excel!`,
          'success'
        );
      } catch (err) {
        console.error('Export Error:', err);
        showToast?.('Gagal mengekspor data ke Excel.', 'error');
      } finally {
        setIsExporting(false);
      }
    }, 100);
  };

  // Upload Excel handler
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    showToast?.('Membaca & memproses file Excel Sisa Layanan...', 'info');

    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(new Uint8Array(buffer), { type: 'array' });
      const result = parseSisaLayananWorkbook(workbook);

      if (result.items.length === 0) {
        showToast?.('Tidak ditemukan baris data valid pada sheet Excel.', 'error');
        return;
      }

      // Kirim file ke backend API untuk persistensi server
      const formData = new FormData();
      formData.append('file', file);
      fetch('/api/sisa-layanan', {
        method: 'POST',
        body: formData,
      }).catch((err) => console.warn('Gagal sinkron file ke server disk:', err));

      if (onUploadExcel) {
        onUploadExcel(result.items, result.summary);
      }

      showToast?.(
        `Berhasil memuat ${result.items.length.toLocaleString('id-ID')} data Sisa Layanan Gabungan!`,
        'success'
      );
    } catch (err: any) {
      console.error('Upload Error:', err);
      showToast?.(err.message || 'Gagal memproses file Excel.', 'error');
    } finally {
      e.target.value = '';
    }
  };

  // Active metrics from summary or recalculate
  const currentSummary = useMemo(() => {
    if (summary && summary.totalItems > 0) return summary;
    return calculateSisaLayananSummary(items);
  }, [summary, items]);

  return (
    <div className="space-y-5 animate-in fade-in-50 duration-200">
      {/* Hidden File Input */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileUpload}
        accept=".xlsx, .xls, .csv"
        className="hidden"
      />

      {/* KPI Statistic Banner Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* Total Item */}
        <div className="p-3.5 rounded-xl border border-border bg-card shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
              Total Permintaan
            </span>
            <div className="size-6 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
              <Layers className="size-3.5" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-xl font-bold tracking-tight text-foreground font-mono">
              {currentSummary.totalItems.toLocaleString('id-ID')}
            </span>
            <span className="text-[10px] text-muted-foreground">Baris</span>
          </div>
          <span className="text-[10px] text-muted-foreground mt-1 truncate">
            {currentSummary.totalUnits} Unit Armada &amp; Dept
          </span>
        </div>

        {/* Status CLOSE */}
        <div className="p-3.5 rounded-xl border border-emerald-500/20 bg-emerald-500/5 dark:bg-emerald-950/20 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-emerald-700 dark:text-emerald-300 uppercase tracking-wider">
              Selesai (Close)
            </span>
            <div className="size-6 rounded-lg bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <CheckCircle2 className="size-3.5" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-xl font-bold tracking-tight text-emerald-700 dark:text-emerald-400 font-mono">
              {currentSummary.totalClose.toLocaleString('id-ID')}
            </span>
            <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
              {currentSummary.totalItems > 0
                ? `${((currentSummary.totalClose / currentSummary.totalItems) * 100).toFixed(1)}%`
                : '0%'}
            </span>
          </div>
          <span className="text-[10px] text-muted-foreground mt-1">Lengkap hingga FSTB/TTB</span>
        </div>

        {/* Status OPEN */}
        <div className="p-3.5 rounded-xl border border-sky-500/20 bg-sky-500/5 dark:bg-sky-950/20 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-sky-700 dark:text-sky-300 uppercase tracking-wider">
              Open / Menunggu PO
            </span>
            <div className="size-6 rounded-lg bg-sky-500/20 text-sky-600 dark:text-sky-400 flex items-center justify-center">
              <Clock className="size-3.5" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-xl font-bold tracking-tight text-sky-700 dark:text-sky-400 font-mono">
              {currentSummary.totalOpen.toLocaleString('id-ID')}
            </span>
            <span className="text-[10px] font-semibold text-sky-600 dark:text-sky-400">
              {currentSummary.totalItems > 0
                ? `${((currentSummary.totalOpen / currentSummary.totalItems) * 100).toFixed(1)}%`
                : '0%'}
            </span>
          </div>
          <span className="text-[10px] text-muted-foreground mt-1">FPB terbit, PO belum ada</span>
        </div>

        {/* Status KURANG (Parsial) */}
        <div className="p-3.5 rounded-xl border border-amber-500/20 bg-amber-500/5 dark:bg-amber-950/20 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-amber-700 dark:text-amber-300 uppercase tracking-wider">
              Kurang / Parsial
            </span>
            <div className="size-6 rounded-lg bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <AlertTriangle className="size-3.5" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-xl font-bold tracking-tight text-amber-700 dark:text-amber-400 font-mono">
              {currentSummary.totalKurang.toLocaleString('id-ID')}
            </span>
            <span className="text-[10px] font-semibold text-amber-600 dark:text-amber-400">
              {currentSummary.totalItems > 0
                ? `${((currentSummary.totalKurang / currentSummary.totalItems) * 100).toFixed(1)}%`
                : '0%'}
            </span>
          </div>
          <span className="text-[10px] text-muted-foreground mt-1">Kuantitas TTB &lt; FPB</span>
        </div>

        {/* Status BELUM TTB */}
        <div className="p-3.5 rounded-xl border border-purple-500/20 bg-purple-500/5 dark:bg-purple-950/20 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-purple-700 dark:text-purple-300 uppercase tracking-wider">
              Belum TTB
            </span>
            <div className="size-6 rounded-lg bg-purple-500/20 text-purple-600 dark:text-purple-400 flex items-center justify-center">
              <Package className="size-3.5" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-xl font-bold tracking-tight text-purple-700 dark:text-purple-400 font-mono">
              {currentSummary.totalBelumTtb.toLocaleString('id-ID')}
            </span>
            <span className="text-[10px] font-semibold text-purple-600 dark:text-purple-400">
              {currentSummary.totalItems > 0
                ? `${((currentSummary.totalBelumTtb / currentSummary.totalItems) * 100).toFixed(1)}%`
                : '0%'}
            </span>
          </div>
          <span className="text-[10px] text-muted-foreground mt-1">PO ada, barang belum TTB</span>
        </div>

        {/* Fulfillment Rate */}
        <div className="p-3.5 rounded-xl border border-border bg-card shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
              Tingkat Selesai
            </span>
            <div className="size-6 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
              <Sparkles className="size-3.5" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-xl font-bold tracking-tight text-foreground font-mono">
              {currentSummary.fulfillmentRate}%
            </span>
            <span className="text-[10px] text-muted-foreground">Realisasi</span>
          </div>
          <div className="w-full bg-muted rounded-full h-1.5 mt-2 overflow-hidden">
            <div
              className="bg-emerald-500 h-1.5 rounded-full transition-all duration-500"
              style={{ width: `${currentSummary.fulfillmentRate}%` }}
            />
          </div>
        </div>
      </div>

      {/* Main Container Card */}
      <div className="rounded-xl border border-border bg-card shadow-xs overflow-hidden">
        {/* Controls Toolbar */}
        <div className="p-4 border-b border-border space-y-3.5">
          {/* Top Row: Search + Quick Action Buttons */}
          <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
            {/* Search Input */}
            <div className="relative flex-1 min-w-[260px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Cari No. FPB, PO, FSTB, TTB, Kode/Nama Barang, Armada, Keterangan..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full h-9 pl-9 pr-8 rounded-lg bg-background border border-border text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 text-muted-foreground hover:text-foreground rounded transition"
                  title="Hapus pencarian"
                >
                  <X className="size-3.5" />
                </button>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-2 flex-wrap">
              {/* Toggle Selisih Only */}
              <button
                type="button"
                onClick={() => {
                  setOnlySelisih(!onlySelisih);
                  setCurrentPage(1);
                }}
                className={`h-9 px-3 rounded-lg text-xs font-medium flex items-center gap-1.5 transition border cursor-pointer ${
                  onlySelisih
                    ? 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30'
                    : 'bg-background text-muted-foreground hover:text-foreground border-border hover:bg-muted'
                }`}
                title="Tampilkan hanya permintaan yang memiliki selisih atau belum CLOSE"
              >
                <AlertTriangle className="size-3.5" />
                <span>Hanya Berselisih</span>
              </button>

              {/* Upload Excel */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="h-9 px-3 rounded-lg bg-background hover:bg-muted text-muted-foreground hover:text-foreground border border-border text-xs font-medium flex items-center gap-1.5 transition shadow-xs cursor-pointer"
                title="Unggah file Excel Laporan Sisa Layanan Gabungan baru"
              >
                <Upload className="size-3.5" />
                <span className="hidden sm:inline">Unggah Excel</span>
              </button>

              {/* Export Excel */}
              <button
                type="button"
                onClick={handleExportExcel}
                disabled={isExporting}
                className="h-9 px-3 rounded-lg bg-background hover:bg-muted text-muted-foreground hover:text-foreground border border-border text-xs font-medium flex items-center gap-1.5 transition shadow-xs cursor-pointer disabled:opacity-50"
                title="Ekspor data hasil filter ke file Excel"
              >
                <Download className="size-3.5" />
                <span className="hidden sm:inline">Ekspor Excel</span>
              </button>

              {/* Refresh Button */}
              <button
                type="button"
                onClick={onRefresh}
                disabled={isLoading}
                className="h-9 px-3 rounded-lg bg-foreground text-background hover:opacity-90 text-xs font-medium flex items-center gap-1.5 transition shadow-xs cursor-pointer disabled:opacity-50"
                title="Segarkan data dari server"
              >
                <RefreshCw className={`size-3.5 ${isLoading ? 'animate-spin' : ''}`} />
                <span className="hidden sm:inline">Refresh</span>
              </button>
            </div>
          </div>

          {/* Status Pills Row */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar text-xs">
            <span className="text-[11px] font-medium text-muted-foreground mr-1 shrink-0">
              Status:
            </span>
            {[
              { id: 'ALL', label: 'Semua Status', count: items.length },
              { id: 'CLOSE', label: 'CLOSE (Selesai)', count: currentSummary.totalClose, color: 'text-emerald-600' },
              { id: 'OPEN', label: 'OPEN (Belum PO)', count: currentSummary.totalOpen, color: 'text-sky-600' },
              { id: 'KURANG', label: 'KURANG (Parsial)', count: currentSummary.totalKurang, color: 'text-amber-600' },
              { id: 'BELUM TTB', label: 'BELUM TTB', count: currentSummary.totalBelumTtb, color: 'text-purple-600' },
            ].map((st) => {
              const active = statusFilter === st.id;
              return (
                <button
                  key={st.id}
                  onClick={() => {
                    setStatusFilter(st.id);
                    setCurrentPage(1);
                  }}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium whitespace-nowrap transition flex items-center gap-1.5 border cursor-pointer ${
                    active
                      ? 'bg-primary text-primary-foreground border-primary font-semibold shadow-xs'
                      : 'bg-background hover:bg-muted text-muted-foreground hover:text-foreground border-border'
                  }`}
                >
                  <span>{st.label}</span>
                  <span
                    className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full ${
                      active
                        ? 'bg-background/20 text-primary-foreground'
                        : 'bg-muted text-muted-foreground'
                    }`}
                  >
                    {st.count.toLocaleString('id-ID')}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Dropdown Filters Row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-2 pt-1 text-xs">
            {/* PT Dropdown */}
            <div>
              <label className="text-[10px] font-medium text-muted-foreground mb-1 block">
                Entitas PT
              </label>
              <select
                value={ptFilter}
                onChange={(e) => {
                  setPtFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full h-8 px-2 rounded-lg bg-background border border-border text-xs text-foreground focus:outline-none focus:border-primary"
              >
                <option value="ALL">Semua PT ({ptList.length})</option>
                {ptList.map((p) => (
                  <option key={p} value={p}>
                    PT {p}
                  </option>
                ))}
              </select>
            </div>

            {/* Departemen / Unit Armada Dropdown */}
            <div>
              <label className="text-[10px] font-medium text-muted-foreground mb-1 block">
                Armada / Departemen
              </label>
              <select
                value={deptFilter}
                onChange={(e) => {
                  setDeptFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full h-8 px-2 rounded-lg bg-background border border-border text-xs text-foreground focus:outline-none focus:border-primary"
              >
                <option value="ALL">Semua Unit ({deptList.length})</option>
                {deptList.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>

            {/* Kategori Dropdown */}
            <div>
              <label className="text-[10px] font-medium text-muted-foreground mb-1 block">
                Kategori Barang
              </label>
              <select
                value={categoryFilter}
                onChange={(e) => {
                  setCategoryFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full h-8 px-2 rounded-lg bg-background border border-border text-xs text-foreground focus:outline-none focus:border-primary"
              >
                <option value="ALL">Semua Kategori</option>
                {categoryList.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            {/* Priority Dropdown */}
            <div>
              <label className="text-[10px] font-medium text-muted-foreground mb-1 block">
                Prioritas
              </label>
              <select
                value={priorityFilter}
                onChange={(e) => {
                  setPriorityFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full h-8 px-2 rounded-lg bg-background border border-border text-xs text-foreground focus:outline-none focus:border-primary"
              >
                <option value="ALL">Semua Prioritas</option>
                {priorityList.map((pr) => (
                  <option key={pr} value={pr}>
                    {pr}
                  </option>
                ))}
              </select>
            </div>

            {/* Baris per Halaman */}
            <div className="col-span-2 sm:col-span-4 lg:col-span-1">
              <label className="text-[10px] font-medium text-muted-foreground mb-1 block">
                Tampilkan Baris
              </label>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="w-full h-8 px-2 rounded-lg bg-background border border-border text-xs text-foreground focus:outline-none focus:border-primary"
              >
                <option value={25}>25 per halaman</option>
                <option value={50}>50 per halaman</option>
                <option value={100}>100 per halaman</option>
                <option value={250}>250 per halaman</option>
                <option value={500}>500 per halaman</option>
              </select>
            </div>
          </div>
        </div>

        {/* Counter & Active Filter Badge Information */}
        <div className="px-4 py-2.5 bg-muted/40 border-b border-border flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <span>
              Menampilkan <strong className="text-foreground">{filteredItems.length.toLocaleString('id-ID')}</strong> dari{' '}
              {items.length.toLocaleString('id-ID')} permintaan barang
            </span>
            {(searchQuery || statusFilter !== 'ALL' || ptFilter !== 'ALL' || deptFilter !== 'ALL' || categoryFilter !== 'ALL' || priorityFilter !== 'ALL' || onlySelisih) && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setStatusFilter('ALL');
                  setPtFilter('ALL');
                  setDeptFilter('ALL');
                  setCategoryFilter('ALL');
                  setPriorityFilter('ALL');
                  setOnlySelisih(false);
                  setCurrentPage(1);
                }}
                className="text-[11px] text-primary hover:underline flex items-center gap-1 cursor-pointer font-medium ml-2"
              >
                <X className="size-3" />
                Reset Semua Filter
              </button>
            )}
          </div>
          <div className="text-[11px] font-mono text-muted-foreground">
            Halaman {currentSafePage} dari {totalPages}
          </div>
        </div>

        {/* Responsive Table Container */}
        <div className="overflow-x-auto min-h-[420px] max-h-[640px] overflow-y-auto no-scrollbar">
          <table className="w-full text-xs text-left border-collapse">
            <thead className="bg-muted/80 text-muted-foreground sticky top-0 z-10 backdrop-blur-xs border-b border-border select-none">
              <tr>
                <th className="py-2.5 px-3 font-semibold w-12 text-center">#</th>
                <th
                  onClick={() => handleSort('noFpb')}
                  className="py-2.5 px-3 font-semibold cursor-pointer hover:text-foreground transition"
                >
                  <div className="flex items-center gap-1">
                    <span>No. FPB &amp; Tgl</span>
                    <ArrowUpDown className="size-3 text-muted-foreground" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort('noPo')}
                  className="py-2.5 px-3 font-semibold cursor-pointer hover:text-foreground transition"
                >
                  <div className="flex items-center gap-1">
                    <span>No. PO</span>
                    <ArrowUpDown className="size-3 text-muted-foreground" />
                  </div>
                </th>
                <th className="py-2.5 px-3 font-semibold">FSTB / TTB</th>
                <th
                  onClick={() => handleSort('namaBarang')}
                  className="py-2.5 px-3 font-semibold cursor-pointer hover:text-foreground transition min-w-[220px]"
                >
                  <div className="flex items-center gap-1">
                    <span>Barang &amp; Keterangan</span>
                    <ArrowUpDown className="size-3 text-muted-foreground" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort('jmlFpb')}
                  className="py-2.5 px-3 font-semibold cursor-pointer hover:text-foreground transition text-right"
                >
                  <div className="flex items-center justify-end gap-1">
                    <span>FPB / TTB</span>
                    <ArrowUpDown className="size-3 text-muted-foreground" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort('selisih')}
                  className="py-2.5 px-3 font-semibold cursor-pointer hover:text-foreground transition text-center"
                >
                  <div className="flex items-center justify-center gap-1">
                    <span>Selisih</span>
                    <ArrowUpDown className="size-3 text-muted-foreground" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort('departement')}
                  className="py-2.5 px-3 font-semibold cursor-pointer hover:text-foreground transition"
                >
                  <div className="flex items-center gap-1">
                    <span>Armada / Unit</span>
                    <ArrowUpDown className="size-3 text-muted-foreground" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort('pt')}
                  className="py-2.5 px-3 font-semibold cursor-pointer hover:text-foreground transition text-center"
                >
                  <div className="flex items-center justify-center gap-1">
                    <span>PT</span>
                    <ArrowUpDown className="size-3 text-muted-foreground" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort('status')}
                  className="py-2.5 px-3 font-semibold cursor-pointer hover:text-foreground transition text-center"
                >
                  <div className="flex items-center justify-center gap-1">
                    <span>Status</span>
                    <ArrowUpDown className="size-3 text-muted-foreground" />
                  </div>
                </th>
                <th className="py-2.5 px-3 font-semibold text-center w-24">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {paginatedItems.length === 0 ? (
                <tr>
                  <td colSpan={11} className="py-16 text-center text-muted-foreground">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Package className="size-8 text-muted-foreground/50" />
                      <p className="text-sm font-medium">Tidak ada data permintaan ditemukan</p>
                      <p className="text-xs text-muted-foreground">
                        Coba sesuaikan kata kunci pencarian atau bersihkan filter di atas.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedItems.map((item, idx) => {
                  const globalIdx = startIndex + idx + 1;
                  const isClose = item.status === 'CLOSE';
                  const isOpen = item.status === 'OPEN';
                  const isKurang = item.status === 'KURANG';
                  const isBelumTtb = item.status === 'BELUM TTB';

                  return (
                    <tr
                      key={item.id}
                      className="hover:bg-muted/50 transition-colors group text-xs"
                    >
                      {/* Index */}
                      <td className="py-2.5 px-3 text-center text-[11px] font-mono text-muted-foreground">
                        {globalIdx}
                      </td>

                      <td className="py-2.5 px-3">
                        <div className="font-mono font-medium text-foreground text-[11px] flex items-center gap-1">
                          <span
                            className="cursor-help"
                            title={`No. FPB: ${item.noFpb || '-'}\n• Nama Barang: ${item.namaBarang || '-'}\n• Keterangan: ${item.keterangan || '-'}`}
                          >
                            {item.noFpb || '-'}
                          </span>
                          {item.noFpb && (
                            <button
                              onClick={() => handleCopy(item.noFpb, `FPB ${item.noFpb}`)}
                              className="opacity-0 group-hover:opacity-100 p-0.5 text-muted-foreground hover:text-foreground transition"
                              title="Salin No. FPB"
                            >
                              {copiedKey === `FPB ${item.noFpb}` ? (
                                <Check className="size-3 text-emerald-500" />
                              ) : (
                                <Copy className="size-3" />
                              )}
                            </button>
                          )}
                        </div>
                        <div className="text-[10px] text-muted-foreground">{item.tglFpb || '-'}</div>
                      </td>

                      {/* No. PO */}
                      <td className="py-2.5 px-3">
                        <div className="font-mono text-foreground text-[11px]">
                          {item.noPo ? item.noPo : <span className="text-muted-foreground/60 italic">-</span>}
                        </div>
                        {item.tglPo && (
                          <div className="text-[10px] text-muted-foreground">{item.tglPo}</div>
                        )}
                      </td>

                      {/* FSTB / TTB */}
                      <td className="py-2.5 px-3">
                        <div className="font-mono text-[10px] text-foreground">
                          {item.noTtb ? (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setMediaModalData({
                                  noTtb: item.noTtb,
                                  noFstb: item.noFstb,
                                  fpb: item.noFpb,
                                  po: item.noPo,
                                  item: item.namaBarang,
                                  armada: item.departement,
                                  entity: item.pt,
                                });
                              }}
                              className="inline-flex items-center gap-1 text-[10px] text-cyan-700 dark:text-cyan-300 bg-cyan-500/10 hover:bg-cyan-500/20 px-1.5 py-0.5 rounded border border-cyan-500/30 font-semibold transition active:scale-95 cursor-pointer shadow-xs"
                              title={`Lihat Dokumen Scan PDF & Galeri Foto TTB (${item.noTtb})`}
                            >
                              <FileText className="size-2.5 text-cyan-500 shrink-0" />
                              <Camera className="size-2.5 text-purple-500 shrink-0" />
                              <span>TTB: {item.noTtb}</span>
                            </button>
                          ) : item.noFstb ? (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setMediaModalData({
                                  noFstb: item.noFstb,
                                  fpb: item.noFpb,
                                  po: item.noPo,
                                  item: item.namaBarang,
                                  armada: item.departement,
                                  entity: item.pt,
                                });
                              }}
                              className="inline-flex items-center gap-1 text-[10px] text-amber-700 dark:text-amber-400 bg-amber-500/10 hover:bg-amber-500/20 px-1.5 py-0.5 rounded border border-amber-500/25 transition active:scale-95 cursor-pointer"
                              title={`Cek Foto TimeMark & Berkas (${item.noFstb})`}
                            >
                              <Camera className="size-2.5 text-amber-600 dark:text-amber-400 shrink-0" />
                              <span>FSTB: {item.noFstb}</span>
                            </button>
                          ) : (
                            <span className="text-muted-foreground/60 italic">-</span>
                          )}
                        </div>
                        {item.tglTtb && (
                          <div className="text-[10px] text-muted-foreground">{item.tglTtb}</div>
                        )}
                      </td>

                      {/* Kode & Nama Barang */}
                      <td className="py-2.5 px-3">
                        <div className="font-medium text-foreground line-clamp-1" title={item.namaBarang}>
                          {item.namaBarang || '-'}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5 text-[10px] text-muted-foreground">
                          {item.kodeBarang && (
                            <span className="font-mono text-muted-foreground bg-muted px-1 rounded">
                              {item.kodeBarang}
                            </span>
                          )}
                          {item.kategori && (
                            <span className="text-muted-foreground">&bull; {item.kategori}</span>
                          )}
                        </div>
                        {item.keterangan && (
                          <div
                            className="text-[10px] text-muted-foreground/80 line-clamp-1 italic mt-0.5"
                            title={item.keterangan}
                          >
                            {item.keterangan}
                          </div>
                        )}
                      </td>

                      {/* FPB / TTB */}
                      <td className="py-2.5 px-3 text-right font-mono">
                        <div className="text-[11px] font-semibold text-foreground">
                          {item.jmlTtb} / {item.jmlFpb} {item.satuan}
                        </div>
                        <div className="text-[10px] text-muted-foreground">
                          PO: {item.jmlPo} &bull; FSTB: {item.jmlFstb}
                        </div>
                      </td>

                      {/* Selisih */}
                      <td className="py-2.5 px-3 text-center">
                        {item.selisih > 0 ? (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20">
                            -{item.selisih} {item.satuan}
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono font-medium text-emerald-600 dark:text-emerald-400">
                            0
                          </span>
                        )}
                      </td>

                      {/* Armada / Departemen */}
                      <td className="py-2.5 px-3">
                        <div className="font-medium text-foreground flex items-center gap-1.5">
                          <Anchor className="size-3 text-muted-foreground shrink-0" />
                          <span className="truncate max-w-[140px]" title={item.departement}>
                            {item.departement || '-'}
                          </span>
                        </div>
                      </td>

                      {/* PT */}
                      <td className="py-2.5 px-3 text-center">
                        <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-muted text-foreground border border-border">
                          {item.pt || '-'}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="py-2.5 px-3 text-center">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold whitespace-nowrap ${
                            isClose
                              ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20'
                              : isOpen
                              ? 'bg-sky-500/10 text-sky-700 dark:text-sky-400 border border-sky-500/20'
                              : isKurang
                              ? 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20'
                              : isBelumTtb
                              ? 'bg-purple-500/10 text-purple-700 dark:text-purple-400 border border-purple-500/20'
                              : 'bg-muted text-muted-foreground border border-border'
                          }`}
                        >
                          {item.status}
                        </span>
                      </td>

                      {/* Aksi */}
                      <td className="py-2.5 px-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            type="button"
                            onClick={() => setSelectedItem(item)}
                            className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition cursor-pointer"
                            title="Lihat Detail Transaksi"
                          >
                            <Eye className="size-3.5" />
                          </button>
                          {item.noFpb && onOpenAudit && (
                            <button
                              type="button"
                              onClick={() => onOpenAudit(item.noFpb, item.noPo)}
                              className="p-1 rounded text-primary hover:bg-primary/10 transition cursor-pointer"
                              title="Audit Lacak Berkas"
                            >
                              <ExternalLink className="size-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Footer Pagination Bar */}
        <div className="p-3.5 border-t border-border bg-card flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
          <div className="text-muted-foreground text-xs">
            Menampilkan baris{' '}
            <strong className="text-foreground">
              {filteredItems.length === 0 ? 0 : startIndex + 1}
            </strong>{' '}
            hingga{' '}
            <strong className="text-foreground">
              {Math.min(startIndex + pageSize, filteredItems.length)}
            </strong>{' '}
            dari <strong className="text-foreground">{filteredItems.length.toLocaleString('id-ID')}</strong> data
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentSafePage <= 1}
              className="px-2.5 py-1.5 rounded-lg border border-border bg-background hover:bg-muted text-xs font-medium text-foreground disabled:opacity-40 disabled:pointer-events-none transition flex items-center gap-1 cursor-pointer"
            >
              <ChevronLeft className="size-3.5" />
              <span>Sebelumnya</span>
            </button>

            <span className="text-xs font-mono px-2 text-muted-foreground">
              {currentSafePage} / {totalPages}
            </span>

            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentSafePage >= totalPages}
              className="px-2.5 py-1.5 rounded-lg border border-border bg-background hover:bg-muted text-xs font-medium text-foreground disabled:opacity-40 disabled:pointer-events-none transition flex items-center gap-1 cursor-pointer"
            >
              <span>Berikutnya</span>
              <ChevronRight className="size-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Detail Item Modal Drawer */}
      {selectedItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="w-full max-w-2xl bg-card border border-border rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-border flex items-center justify-between bg-muted/40">
              <div className="flex items-center gap-2.5">
                <div className="size-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                  <Package className="size-4.5" />
                </div>
                <div>
                  <h3 className="font-bold text-foreground text-sm leading-tight">
                    Detail Permintaan Layanan
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Konsolidasi Laporan Sisa Layanan ({selectedItem.pt} &bull; {selectedItem.departement})
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedItem(null)}
                className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition cursor-pointer"
              >
                <X className="size-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-5 text-xs no-scrollbar">
              {/* Status Header Bar */}
              <div className="flex items-center justify-between p-3 rounded-xl bg-muted/50 border border-border">
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground font-medium">Status Pemenuhan:</span>
                  <span
                    className={`px-2 py-0.5 rounded text-xs font-bold ${
                      selectedItem.status === 'CLOSE'
                        ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20'
                        : selectedItem.status === 'OPEN'
                        ? 'bg-sky-500/10 text-sky-700 dark:text-sky-400 border border-sky-500/20'
                        : selectedItem.status === 'KURANG'
                        ? 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20'
                        : 'bg-purple-500/10 text-purple-700 dark:text-purple-400 border border-purple-500/20'
                    }`}
                  >
                    {selectedItem.status}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">Prioritas:</span>
                  <span className="font-mono font-bold text-foreground bg-background px-2 py-0.5 rounded border border-border">
                    {selectedItem.priority || 'P3'}
                  </span>
                </div>
              </div>

              {/* Supply Chain Lifecycle Flow */}
              <div className="space-y-2">
                <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block">
                  Alur Berkas Supply Chain
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {/* Step 1: FPB */}
                  <div className="p-2.5 rounded-lg border border-border bg-background">
                    <span className="text-[10px] text-muted-foreground block">1. Form FPB</span>
                    <span className="font-mono font-semibold text-foreground text-xs block truncate mt-0.5">
                      {selectedItem.noFpb || '-'}
                    </span>
                    <span className="text-[10px] text-muted-foreground block mt-1">
                      {selectedItem.tglFpb || 'Tanpa Tgl'}
                    </span>
                  </div>

                  {/* Step 2: PO */}
                  <div className="p-2.5 rounded-lg border border-border bg-background">
                    <span className="text-[10px] text-muted-foreground block">2. Purchase Order</span>
                    <span className="font-mono font-semibold text-foreground text-xs block truncate mt-0.5">
                      {selectedItem.noPo || '-'}
                    </span>
                    <span className="text-[10px] text-muted-foreground block mt-1">
                      {selectedItem.tglPo || 'Tanpa Tgl'}
                    </span>
                  </div>

                    {/* Step 3: FSTB */}
                    <div className="p-2.5 rounded-lg border border-border bg-background">
                      <span className="text-[10px] text-muted-foreground block">3. FSTB (Kirim)</span>
                      <span className="font-mono font-semibold text-foreground text-xs block truncate mt-0.5">
                        {selectedItem.noFstb || '-'}
                      </span>
                      <span className="text-[10px] text-muted-foreground block mt-1">
                        {selectedItem.tglFstb || 'Tanpa Tgl'}
                      </span>
                      {selectedItem.noFstb && (
                        <button
                          type="button"
                          onClick={() => {
                            setMediaModalData({
                              noFstb: selectedItem.noFstb,
                              noTtb: selectedItem.noTtb,
                              fpb: selectedItem.noFpb,
                              po: selectedItem.noPo,
                              item: selectedItem.namaBarang,
                              armada: selectedItem.departement,
                              entity: selectedItem.pt,
                            });
                          }}
                          className="mt-1.5 w-full h-6 px-1.5 rounded text-[10px] font-semibold bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30 hover:bg-amber-500/25 transition cursor-pointer flex items-center justify-center gap-1"
                        >
                          <Camera className="size-2.5" />
                          <span>TimeMark</span>
                        </button>
                      )}
                    </div>

                    {/* Step 4: TTB */}
                    <div className="p-2.5 rounded-lg border border-border bg-background">
                      <span className="text-[10px] text-muted-foreground block">4. TTB (Terima)</span>
                      <span className="font-mono font-semibold text-foreground text-xs block truncate mt-0.5">
                        {selectedItem.noTtb || '-'}
                      </span>
                      <span className="text-[10px] text-muted-foreground block mt-1">
                        {selectedItem.tglTtb || 'Tanpa Tgl'}
                      </span>
                      {selectedItem.noTtb && (
                        <button
                          type="button"
                          onClick={() => {
                            setMediaModalData({
                              noTtb: selectedItem.noTtb,
                              noFstb: selectedItem.noFstb,
                              fpb: selectedItem.noFpb,
                              po: selectedItem.noPo,
                              item: selectedItem.namaBarang,
                              armada: selectedItem.departement,
                              entity: selectedItem.pt,
                            });
                          }}
                          className="mt-1.5 w-full h-6 px-1.5 rounded text-[10px] font-semibold bg-cyan-500/15 text-cyan-700 dark:text-cyan-300 border border-cyan-500/30 hover:bg-cyan-500/25 transition cursor-pointer flex items-center justify-center gap-1"
                        >
                          <FileText className="size-2.5" />
                          <Camera className="size-2.5" />
                          <span>Berkas & Foto</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Barang & Detail Deskripsi */}
              <div className="space-y-1.5 p-3 rounded-xl border border-border bg-background">
                <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider block">
                  Informasi Barang
                </span>
                <p className="text-sm font-bold text-foreground">{selectedItem.namaBarang}</p>
                <div className="flex flex-wrap items-center gap-3 pt-1 text-muted-foreground">
                  <span>Kode: <strong className="font-mono text-foreground">{selectedItem.kodeBarang || '-'}</strong></span>
                  <span>Kategori: <strong className="text-foreground">{selectedItem.kategori}</strong></span>
                  <span>Satuan: <strong className="text-foreground">{selectedItem.satuan}</strong></span>
                </div>
                {selectedItem.keterangan && (
                  <div className="pt-2 text-xs text-muted-foreground/90 bg-muted/30 p-2 rounded-lg mt-1">
                    <strong className="text-foreground">Keterangan:</strong> {selectedItem.keterangan}
                  </div>
                )}
              </div>

              {/* Kuantitas Metrics Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                <div className="p-2.5 rounded-lg bg-muted/40 border border-border text-center">
                  <span className="text-[10px] text-muted-foreground block">Diminta (FPB)</span>
                  <span className="text-base font-bold text-foreground font-mono mt-1 block">
                    {selectedItem.jmlFpb}
                  </span>
                </div>
                <div className="p-2.5 rounded-lg bg-muted/40 border border-border text-center">
                  <span className="text-[10px] text-muted-foreground block">Dipesan (PO)</span>
                  <span className="text-base font-bold text-foreground font-mono mt-1 block">
                    {selectedItem.jmlPo}
                  </span>
                </div>
                <div className="p-2.5 rounded-lg bg-muted/40 border border-border text-center">
                  <span className="text-[10px] text-muted-foreground block">Dikirim (FSTB)</span>
                  <span className="text-base font-bold text-foreground font-mono mt-1 block">
                    {selectedItem.jmlFstb}
                  </span>
                </div>
                <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-center">
                  <span className="text-[10px] text-emerald-700 dark:text-emerald-300 block">Diterima (TTB)</span>
                  <span className="text-base font-bold text-emerald-700 dark:text-emerald-400 font-mono mt-1 block">
                    {selectedItem.jmlTtb}
                  </span>
                </div>
                <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-center">
                  <span className="text-[10px] text-amber-700 dark:text-amber-300 block">Selisih Belum</span>
                  <span className="text-base font-bold text-amber-700 dark:text-amber-400 font-mono mt-1 block">
                    {selectedItem.selisih}
                  </span>
                </div>
              </div>

              {/* Entity, Department & Processing Time */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                <div className="p-2.5 rounded-lg bg-background border border-border">
                  <span className="text-[10px] text-muted-foreground block">Entitas PT</span>
                  <span className="font-semibold text-foreground mt-0.5 block">PT {selectedItem.pt}</span>
                </div>
                <div className="p-2.5 rounded-lg bg-background border border-border">
                  <span className="text-[10px] text-muted-foreground block">Unit Armada / Departemen</span>
                  <span className="font-semibold text-foreground mt-0.5 block truncate">
                    {selectedItem.departement}
                  </span>
                </div>
                <div className="p-2.5 rounded-lg bg-background border border-border">
                  <span className="text-[10px] text-muted-foreground block">Waktu Proses</span>
                  <span className="font-semibold text-foreground mt-0.5 block">
                    {selectedItem.waktuProses || '-'}
                  </span>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-3.5 border-t border-border bg-muted/40 flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => handleCopy(selectedItem.noFpb, 'No. FPB')}
                  className="px-2.5 py-1.5 rounded-lg bg-background hover:bg-muted text-xs font-medium border border-border text-foreground flex items-center gap-1 transition cursor-pointer"
                >
                  <Copy className="size-3" />
                  <span>Salin FPB</span>
                </button>
                {selectedItem.noPo && (
                  <button
                    type="button"
                    onClick={() => handleCopy(selectedItem.noPo, 'No. PO')}
                    className="px-2.5 py-1.5 rounded-lg bg-background hover:bg-muted text-xs font-medium border border-border text-foreground flex items-center gap-1 transition cursor-pointer"
                  >
                    <Copy className="size-3" />
                    <span>Salin PO</span>
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2">
                {selectedItem.noFpb && onOpenAudit && (
                  <button
                    type="button"
                    onClick={() => {
                      onOpenAudit(selectedItem.noFpb, selectedItem.noPo);
                      setSelectedItem(null);
                    }}
                    className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:opacity-90 flex items-center gap-1.5 transition shadow-xs cursor-pointer"
                  >
                    <ExternalLink className="size-3.5" />
                    <span>Audit Alur Berkas</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setSelectedItem(null)}
                  className="px-3 py-1.5 rounded-lg bg-background hover:bg-muted text-xs font-medium border border-border text-muted-foreground hover:text-foreground transition cursor-pointer"
                >
                  Tutup
                </button>
              </div>
            </div>
          </div>
      )}

      {/* Modal Terpadu Dokumen Scan TTB (PDF) & Galeri Foto Lapangan */}
      {mediaModalData && (
        <TtbMediaModal
          isOpen={true}
          onClose={() => setMediaModalData(null)}
          noTtb={mediaModalData.noTtb}
          noFstb={mediaModalData.noFstb}
          fpb={mediaModalData.fpb}
          po={mediaModalData.po}
          item={mediaModalData.item}
          armada={mediaModalData.armada}
          entity={mediaModalData.entity}
          showToast={showToast}
        />
      )}
    </div>
  );
}

