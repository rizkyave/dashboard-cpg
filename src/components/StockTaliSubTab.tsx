'use client';

import React, { useState, useMemo, useEffect } from 'react';
import {
  Package,
  Ship,
  Building2,
  RefreshCw,
  Download,
  ExternalLink,
  Search,
  SlidersHorizontal,
  Layers,
  Calendar,
  UserCheck,
  Truck,
  CheckCircle2,
  Clock,
  Sparkles,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Copy,
  Check,
  AlertCircle,
  FileSpreadsheet,
  RotateCcw,
  Tag,
} from 'lucide-react';
import { StockTaliItem, StockTaliSummary } from '@/types/stockTali';
import initialStockTaliData from '@/data/stock-tali-data.json';

interface StockTaliSubTabProps {
  showToast?: (message: string, type?: 'success' | 'warning' | 'info' | 'error') => void;
}

const GOOGLE_SHEET_URL =
  'https://docs.google.com/spreadsheets/d/1Bou_dU7L8UWhDEjgBpPqtKnIqoF7wLQSUN2bnYbrp1I/edit?gid=2021352613#gid=2021352613';

// Badge warna untuk entitas PT
const PT_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  CPL: { bg: 'bg-blue-500/10 dark:bg-blue-500/20', text: 'text-blue-600 dark:text-blue-400', border: 'border-blue-500/30' },
  HL: { bg: 'bg-indigo-500/10 dark:bg-indigo-500/20', text: 'text-indigo-600 dark:text-indigo-400', border: 'border-indigo-500/30' },
  MIL: { bg: 'bg-emerald-500/10 dark:bg-emerald-500/20', text: 'text-emerald-600 dark:text-emerald-400', border: 'border-emerald-500/30' },
  GAJ: { bg: 'bg-amber-500/10 dark:bg-amber-500/20', text: 'text-amber-600 dark:text-amber-400', border: 'border-amber-500/30' },
  MO: { bg: 'bg-purple-500/10 dark:bg-purple-500/20', text: 'text-purple-600 dark:text-purple-400', border: 'border-purple-500/30' },
};

export default function StockTaliSubTab({ showToast }: StockTaliSubTabProps) {
  // Data state
  const [items, setItems] = useState<StockTaliItem[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem('cpg_stock_tali_items');
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        }
      } catch {}
    }
    return (initialStockTaliData.items as StockTaliItem[]) || [];
  });

  const [lastSyncTime, setLastSyncTime] = useState<string>(() => {
    return initialStockTaliData.updatedAt || new Date().toISOString();
  });

  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Filters state
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedEntity, setSelectedEntity] = useState<string>('ALL');
  const [selectedPicTtb, setSelectedPicTtb] = useState<string>('ALL');
  const [selectedPicLap, setSelectedPicLap] = useState<string>('ALL');
  const [selectedKategori, setSelectedKategori] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<'ALL' | 'DIANTAR' | 'BALIK_TTB' | 'TUTUP_PCH' | 'PENDING'>('ALL');

  // Sorting state
  const [sortField, setSortField] = useState<keyof StockTaliItem>('no');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  // Pagination state
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(15);

  // Fetch data awal dari API jika belum ada di localStorage
  useEffect(() => {
    async function loadData() {
      try {
        const res = await fetch('/api/sync-stock-tali');
        const json = await res.json();
        if (json.success && Array.isArray(json.items)) {
          setItems(json.items);
          setLastSyncTime(json.updatedAt);
          try {
            localStorage.setItem('cpg_stock_tali_items', JSON.stringify(json.items));
            localStorage.setItem('cpg_stock_tali_updatedAt', json.updatedAt);
          } catch {}
        }
      } catch (err) {
        console.warn('Gagal fetch /api/sync-stock-tali, menggunakan data fallback lokal:', err);
      }
    }
    loadData();
  }, []);

  // Sync handler (Tarik langsung dari Google Sheets)
  const handleSyncGoogleSheet = async () => {
    setIsSyncing(true);
    try {
      const res = await fetch('/api/sync-stock-tali', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: GOOGLE_SHEET_URL }),
      });
      const json = await res.json();
      if (json.success && Array.isArray(json.items)) {
        setItems(json.items);
        setLastSyncTime(json.updatedAt);
        try {
          localStorage.setItem('cpg_stock_tali_items', JSON.stringify(json.items));
          localStorage.setItem('cpg_stock_tali_updatedAt', json.updatedAt);
        } catch {}
        showToast?.(
          json.message || `Berhasil menyinkronkan ${json.items.length} mutasi stock tali dari Google Sheets!`,
          'success'
        );
      } else {
        showToast?.(json.message || 'Gagal menyinkronkan Google Sheets.', 'warning');
      }
    } catch (err: any) {
      showToast?.(`Error: ${err.message || 'Gagal menghubungi server'}`, 'error');
    } finally {
      setIsSyncing(false);
    }
  };

  // Copy helper
  const handleCopy = (text: string, key: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 1500);
  };

  // Export to CSV
  const handleExportCsv = () => {
    const headers = [
      'NO',
      'PT',
      'DEPT/ ARMADA',
      'NO. FPB',
      'PIC TTB',
      'TTB',
      'TANGGAL INPUT TTB',
      'TANGGAL KE TIM LAPANGAN',
      'KETERANGAN',
      'LAPSE DAY',
      'PIC LAPANGAN',
      'TANGGAL BARANG DI DIANTAR',
      'KETERANGAN ANTAR',
      'TANGGAL TIM LAP KE PIC TTB',
      'LAPSE DAY 2',
      'TANGGAL TTB KE PIC PCH',
      'KETERANGAN PCH',
      'LAPSE DAY 3',
    ];

    const rows = filteredItems.map((item) => [
      item.no,
      item.pt,
      `"${item.deptArmada.replace(/"/g, '""')}"`,
      item.noFpb,
      item.picTtb,
      item.ttb,
      item.tglInputTtb,
      item.tglKeTimLapangan,
      `"${item.keterangan.replace(/"/g, '""')}"`,
      item.lapseDay1,
      item.picLapangan,
      item.tglBarangDiantar,
      `"${item.keteranganAntar.replace(/"/g, '""')}"`,
      item.tglTimLapKePicTtb,
      item.lapseDay2,
      item.tglTtbKePicPch,
      `"${item.keteranganPch.replace(/"/g, '""')}"`,
      item.lapseDay3,
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,\uFEFF' +
      [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute(
      'download',
      `laporan_mutasi_stock_tali_${new Date().toISOString().slice(0, 10)}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast?.('Berhasil mengekspor data ke file CSV!', 'success');
  };

  // Distinct Filter Options
  const entityOptions = useMemo(() => {
    const set = new Set<string>();
    items.forEach((it) => {
      if (it.pt) set.add(it.pt.trim().toUpperCase());
    });
    return Array.from(set).sort();
  }, [items]);

  const picTtbOptions = useMemo(() => {
    const set = new Set<string>();
    items.forEach((it) => {
      if (it.picTtb) set.add(it.picTtb.trim().toUpperCase());
    });
    return Array.from(set).sort();
  }, [items]);

  const picLapOptions = useMemo(() => {
    const set = new Set<string>();
    items.forEach((it) => {
      if (it.picLapangan) set.add(it.picLapangan.trim().toUpperCase());
    });
    return Array.from(set).sort();
  }, [items]);

  // Overall KPI Calculation
  const kpi = useMemo<StockTaliSummary>(() => {
    const armadas = new Set<string>();
    const pts = new Set<string>();
    const ptCounts: Record<string, number> = {};
    const picTtbCounts: Record<string, number> = {};
    const picLapCounts: Record<string, number> = {};

    let terkirim = 0;
    let kembaliTtb = 0;
    let tutupPch = 0;

    for (const it of items) {
      if (it.deptArmada) armadas.add(it.deptArmada);
      if (it.pt) {
        pts.add(it.pt);
        ptCounts[it.pt] = (ptCounts[it.pt] || 0) + 1;
      }
      if (it.picTtb) {
        picTtbCounts[it.picTtb] = (picTtbCounts[it.picTtb] || 0) + 1;
      }
      if (it.picLapangan) {
        picLapCounts[it.picLapangan] = (picLapCounts[it.picLapangan] || 0) + 1;
      }

      if (it.tglBarangDiantar && it.tglBarangDiantar !== '-' && it.tglBarangDiantar !== '/') {
        terkirim++;
      }
      if (it.tglTimLapKePicTtb && it.tglTimLapKePicTtb !== '-' && it.tglTimLapKePicTtb !== '/') {
        kembaliTtb++;
      }
      if (it.tglTtbKePicPch && it.tglTtbKePicPch !== '-' && it.tglTtbKePicPch !== '/') {
        tutupPch++;
      }
    }

    return {
      totalItems: items.length,
      totalArmada: armadas.size,
      totalEntitas: pts.size,
      terkirimLapangan: terkirim,
      kembaliKeTtb: kembaliTtb,
      tutupSiklusPch: tutupPch,
      dalamProses: Math.max(0, items.length - terkirim),
      ptCounts,
      picTtbCounts,
      picLapCounts,
    };
  }, [items]);

  // Filtering Logic
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      // Search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const match =
          item.no.toLowerCase().includes(q) ||
          item.pt.toLowerCase().includes(q) ||
          item.deptArmada.toLowerCase().includes(q) ||
          item.noFpb.toLowerCase().includes(q) ||
          item.ttb.toLowerCase().includes(q) ||
          item.picTtb.toLowerCase().includes(q) ||
          item.picLapangan.toLowerCase().includes(q) ||
          item.keterangan.toLowerCase().includes(q) ||
          item.keteranganAntar.toLowerCase().includes(q);
        if (!match) return false;
      }

      // Filter PT
      if (selectedEntity !== 'ALL' && item.pt.toUpperCase() !== selectedEntity) {
        return false;
      }

      // Filter PIC TTB
      if (selectedPicTtb !== 'ALL' && item.picTtb.toUpperCase() !== selectedPicTtb) {
        return false;
      }

      // Filter PIC Lapangan
      if (selectedPicLap !== 'ALL' && item.picLapangan.toUpperCase() !== selectedPicLap) {
        return false;
      }

      // Filter Kategori (Tali vs Oli vs Lainnya)
      if (selectedKategori !== 'ALL') {
        const ket = item.keterangan.toLowerCase();
        if (selectedKategori === 'TALI' && !ket.includes('tali')) return false;
        if (selectedKategori === 'OLI' && !ket.includes('oli')) return false;
        if (selectedKategori === 'OTHER' && (ket.includes('tali') || ket.includes('oli'))) return false;
      }

      // Filter Status
      if (selectedStatus === 'DIANTAR') {
        if (!item.tglBarangDiantar || item.tglBarangDiantar === '-' || item.tglBarangDiantar === '/') return false;
      } else if (selectedStatus === 'BALIK_TTB') {
        if (!item.tglTimLapKePicTtb || item.tglTimLapKePicTtb === '-' || item.tglTimLapKePicTtb === '/') return false;
      } else if (selectedStatus === 'TUTUP_PCH') {
        if (!item.tglTtbKePicPch || item.tglTtbKePicPch === '-' || item.tglTtbKePicPch === '/') return false;
      } else if (selectedStatus === 'PENDING') {
        if (item.tglBarangDiantar && item.tglBarangDiantar !== '-' && item.tglBarangDiantar !== '/') return false;
      }

      return true;
    });
  }, [items, searchQuery, selectedEntity, selectedPicTtb, selectedPicLap, selectedKategori, selectedStatus]);

  // Sorting
  const sortedItems = useMemo(() => {
    return [...filteredItems].sort((a, b) => {
      let valA = a[sortField] || '';
      let valB = b[sortField] || '';

      if (sortField === 'no') {
        const numA = parseInt(valA as string, 10) || 0;
        const numB = parseInt(valB as string, 10) || 0;
        return sortDirection === 'asc' ? numA - numB : numB - numA;
      }

      const strA = (valA as string).toLowerCase();
      const strB = (valB as string).toLowerCase();
      if (strA < strB) return sortDirection === 'asc' ? -1 : 1;
      if (strA > strB) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }, [filteredItems, sortField, sortDirection]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(sortedItems.length / (pageSize === -1 ? sortedItems.length || 1 : pageSize)));
  const paginatedItems = useMemo(() => {
    if (pageSize === -1) return sortedItems;
    const start = (currentPage - 1) * pageSize;
    return sortedItems.slice(start, start + pageSize);
  }, [sortedItems, currentPage, pageSize]);

  const handleSort = (field: keyof StockTaliItem) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const handleResetFilters = () => {
    setSearchQuery('');
    setSelectedEntity('ALL');
    setSelectedPicTtb('ALL');
    setSelectedPicLap('ALL');
    setSelectedKategori('ALL');
    setSelectedStatus('ALL');
    setCurrentPage(1);
  };

  const hasActiveFilters =
    searchQuery.trim() !== '' ||
    selectedEntity !== 'ALL' ||
    selectedPicTtb !== 'ALL' ||
    selectedPicLap !== 'ALL' ||
    selectedKategori !== 'ALL' ||
    selectedStatus !== 'ALL';

  return (
    <div className="space-y-6 animate-in fade-in-50 duration-200">
      {/* ======================================================== */}
      {/* 1. Header Hub & Action Bar                                */}
      {/* ======================================================== */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 rounded-2xl bg-card border border-border shadow-xs">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
              <Package className="size-6" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-xl font-bold tracking-tight text-foreground">
                  Laporan Mutasi Barang Stock Tali &amp; Gudang Galangan
                </h2>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                  <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Live Sync Google Sheets (GID: 2021352613)
                </span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border border-indigo-500/30">
                  <Sparkles className="size-3" />
                  Tanpa PO Baru (Pakai Stok)
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Data mutasi stok tali &amp; oli internal untuk 34 armada kapal. Pemantauan 3 fase: Gudang TTB ➔ Serah Terima Tim Lapangan ➔ Arsip Purchasing.
                {lastSyncTime && (
                  <span className="ml-2 text-[11px] text-muted-foreground/80">
                    • Terakhir sinkron:{' '}
                    {new Date(lastSyncTime).toLocaleDateString('id-ID', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                )}
              </p>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Buka Google Sheet Asli */}
          <a
            href={GOOGLE_SHEET_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border border-border bg-background hover:bg-muted text-foreground transition shadow-xs"
            title="Buka Tab Sheet Asli di Google Sheets (GID: 2021352613)"
          >
            <ExternalLink className="size-3.5 text-muted-foreground" />
            <span>Buka Sheet</span>
          </a>

          {/* Export CSV */}
          <button
            type="button"
            onClick={handleExportCsv}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border border-border bg-background hover:bg-muted text-foreground transition shadow-xs cursor-pointer"
            title="Ekspor baris terfilter ke format CSV"
          >
            <Download className="size-3.5 text-muted-foreground" />
            <span>Export CSV</span>
          </button>

          {/* Sinkronkan Google Sheets */}
          <button
            type="button"
            onClick={handleSyncGoogleSheet}
            disabled={isSyncing}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-bold rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition shadow-sm cursor-pointer disabled:opacity-50"
            title="Tarik pembaruan data mutasi stock tali langsung dari Google Sheets"
          >
            <RefreshCw className={`size-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
            <span>{isSyncing ? 'Menyinkronkan...' : 'Sinkronkan Sheet'}</span>
          </button>
        </div>
      </div>

      {/* ======================================================== */}
      {/* 2. Top Summary KPI Cards                                  */}
      {/* ======================================================== */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* Total Mutasi */}
        <div
          onClick={() => {
            handleResetFilters();
          }}
          className="p-4 rounded-xl bg-card border border-border hover:border-primary/50 transition cursor-pointer shadow-xs group"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
              Total Mutasi
            </span>
            <div className="p-1.5 rounded-lg bg-primary/10 text-primary group-hover:scale-110 transition">
              <Package className="size-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-bold tracking-tight text-foreground">
            {kpi.totalItems}
          </div>
          <p className="text-[11px] text-muted-foreground mt-0.5">Semua transaksi stok</p>
        </div>

        {/* Armada Terlayani */}
        <div
          onClick={() => setSelectedEntity('ALL')}
          className="p-4 rounded-xl bg-card border border-border hover:border-blue-500/50 transition cursor-pointer shadow-xs group"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
              Armada / Dept
            </span>
            <div className="p-1.5 rounded-lg bg-blue-500/10 text-blue-500 group-hover:scale-110 transition">
              <Ship className="size-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-bold tracking-tight text-foreground">
            {kpi.totalArmada}
          </div>
          <p className="text-[11px] text-muted-foreground mt-0.5">Dari 5 entitas PT</p>
        </div>

        {/* Terkirim Lapangan */}
        <div
          onClick={() => setSelectedStatus('DIANTAR')}
          className="p-4 rounded-xl bg-card border border-border hover:border-emerald-500/50 transition cursor-pointer shadow-xs group"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
              Terkirim Lapangan
            </span>
            <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-500 group-hover:scale-110 transition">
              <Truck className="size-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400">
            {kpi.terkirimLapangan}
          </div>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            {kpi.totalItems > 0 ? Math.round((kpi.terkirimLapangan / kpi.totalItems) * 100) : 0}% telah diantar
          </p>
        </div>

        {/* Berkas Balik ke TTB */}
        <div
          onClick={() => setSelectedStatus('BALIK_TTB')}
          className="p-4 rounded-xl bg-card border border-border hover:border-teal-500/50 transition cursor-pointer shadow-xs group"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
              Kembali ke TTB
            </span>
            <div className="p-1.5 rounded-lg bg-teal-500/10 text-teal-500 group-hover:scale-110 transition">
              <CheckCircle2 className="size-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-bold tracking-tight text-teal-600 dark:text-teal-400">
            {kpi.kembaliKeTtb}
          </div>
          <p className="text-[11px] text-muted-foreground mt-0.5">Fisik balik ke PIC TTB</p>
        </div>

        {/* Ke PIC Purchasing */}
        <div
          onClick={() => setSelectedStatus('TUTUP_PCH')}
          className="p-4 rounded-xl bg-card border border-border hover:border-indigo-500/50 transition cursor-pointer shadow-xs group"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
              Tutup ke PCH
            </span>
            <div className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-500 group-hover:scale-110 transition">
              <UserCheck className="size-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-bold tracking-tight text-foreground">
            {kpi.tutupSiklusPch}
          </div>
          <p className="text-[11px] text-amber-600 dark:text-amber-400 mt-0.5">
            {kpi.totalItems - kpi.tutupSiklusPch} menunggu serah terima
          </p>
        </div>

        {/* Entitas Terbanyak */}
        <div className="p-4 rounded-xl bg-card border border-border shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
              Top Entitas
            </span>
            <div className="p-1.5 rounded-lg bg-purple-500/10 text-purple-500">
              <Building2 className="size-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-2xl font-bold tracking-tight text-blue-600 dark:text-blue-400">CPL</span>
            <span className="text-xs text-muted-foreground font-medium">
              ({kpi.ptCounts['CPL'] || 0} mutasi)
            </span>
          </div>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            HL ({kpi.ptCounts['HL'] || 0}) • GAJ ({kpi.ptCounts['GAJ'] || 0}) • MIL ({kpi.ptCounts['MIL'] || 0})
          </p>
        </div>
      </div>

      {/* ======================================================== */}
      {/* 3. Filter & Search Bar                                    */}
      {/* ======================================================== */}
      <div className="p-4 rounded-2xl bg-card border border-border shadow-xs space-y-3">
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
          {/* Search Box */}
          <div className="relative flex-1 min-w-[260px]">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="Cari No. FPB, No. TTB, Armada, Keterangan barang atau tujuan..."
              className="w-full pl-10 pr-4 py-2 text-xs rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground hover:text-foreground"
              >
                ✕
              </button>
            )}
          </div>

          {/* Dropdown Filters */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Filter PT */}
            <div className="flex items-center gap-1.5 text-xs">
              <span className="text-muted-foreground hidden sm:inline">PT:</span>
              <select
                value={selectedEntity}
                onChange={(e) => {
                  setSelectedEntity(e.target.value);
                  setCurrentPage(1);
                }}
                className="px-2.5 py-1.5 text-xs rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/20"
              >
                <option value="ALL">Semua PT ({items.length})</option>
                {entityOptions.map((pt) => (
                  <option key={pt} value={pt}>
                    {pt} ({kpi.ptCounts[pt] || 0})
                  </option>
                ))}
              </select>
            </div>

            {/* Filter PIC TTB */}
            <div className="flex items-center gap-1.5 text-xs">
              <span className="text-muted-foreground hidden sm:inline">PIC TTB:</span>
              <select
                value={selectedPicTtb}
                onChange={(e) => {
                  setSelectedPicTtb(e.target.value);
                  setCurrentPage(1);
                }}
                className="px-2.5 py-1.5 text-xs rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/20"
              >
                <option value="ALL">Semua PIC TTB</option>
                {picTtbOptions.map((pic) => (
                  <option key={pic} value={pic}>
                    {pic} ({kpi.picTtbCounts[pic] || 0})
                  </option>
                ))}
              </select>
            </div>

            {/* Filter PIC Lapangan */}
            <div className="flex items-center gap-1.5 text-xs">
              <span className="text-muted-foreground hidden sm:inline">PIC Lapangan:</span>
              <select
                value={selectedPicLap}
                onChange={(e) => {
                  setSelectedPicLap(e.target.value);
                  setCurrentPage(1);
                }}
                className="px-2.5 py-1.5 text-xs rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/20"
              >
                <option value="ALL">Semua PIC Lapangan</option>
                {picLapOptions.map((pic) => (
                  <option key={pic} value={pic}>
                    {pic} ({kpi.picLapCounts[pic] || 0})
                  </option>
                ))}
              </select>
            </div>

            {/* Filter Kategori Barang */}
            <div className="flex items-center gap-1.5 text-xs">
              <span className="text-muted-foreground hidden sm:inline">Barang:</span>
              <select
                value={selectedKategori}
                onChange={(e) => {
                  setSelectedKategori(e.target.value);
                  setCurrentPage(1);
                }}
                className="px-2.5 py-1.5 text-xs rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/20"
              >
                <option value="ALL">Semua Barang</option>
                <option value="TALI">🧵 Stock Tali</option>
                <option value="OLI">🛢️ Stock Oli</option>
                <option value="OTHER">📦 Stok Lainnya</option>
              </select>
            </div>

            {/* Reset Filters */}
            {hasActiveFilters && (
              <button
                type="button"
                onClick={handleResetFilters}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-lg text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 transition cursor-pointer"
                title="Reset semua filter ke posisi default"
              >
                <RotateCcw className="size-3" />
                <span>Reset</span>
              </button>
            )}
          </div>
        </div>

        {/* Filter Quick Pills: Status Logistik */}
        <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-border/60 text-xs">
          <span className="text-muted-foreground text-[11px] font-medium mr-1">Status Alur:</span>
          <button
            type="button"
            onClick={() => {
              setSelectedStatus('ALL');
              setCurrentPage(1);
            }}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition cursor-pointer ${
              selectedStatus === 'ALL'
                ? 'bg-primary text-primary-foreground font-semibold shadow-xs'
                : 'bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground'
            }`}
          >
            Semua ({items.length})
          </button>
          <button
            type="button"
            onClick={() => {
              setSelectedStatus('DIANTAR');
              setCurrentPage(1);
            }}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition cursor-pointer ${
              selectedStatus === 'DIANTAR'
                ? 'bg-emerald-600 text-white font-semibold shadow-xs'
                : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20'
            }`}
          >
            ✓ Sudah Diantar Lapangan ({kpi.terkirimLapangan})
          </button>
          <button
            type="button"
            onClick={() => {
              setSelectedStatus('BALIK_TTB');
              setCurrentPage(1);
            }}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition cursor-pointer ${
              selectedStatus === 'BALIK_TTB'
                ? 'bg-teal-600 text-white font-semibold shadow-xs'
                : 'bg-teal-500/10 text-teal-600 dark:text-teal-400 hover:bg-teal-500/20'
            }`}
          >
            ✓ Bukti Fisik Balik ke TTB ({kpi.kembaliKeTtb})
          </button>
          <button
            type="button"
            onClick={() => {
              setSelectedStatus('TUTUP_PCH');
              setCurrentPage(1);
            }}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition cursor-pointer ${
              selectedStatus === 'TUTUP_PCH'
                ? 'bg-indigo-600 text-white font-semibold shadow-xs'
                : 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-500/20'
            }`}
          >
            ✓ Tutup ke Purchasing ({kpi.tutupSiklusPch})
          </button>
        </div>
      </div>

      {/* ======================================================== */}
      {/* 4. Table Display                                          */}
      {/* ======================================================== */}
      <div className="rounded-2xl border border-border bg-card shadow-xs overflow-hidden">
        {/* Table Sub-header Information */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 border-b border-border bg-muted/30">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>
              Menampilkan <strong className="text-foreground">{paginatedItems.length}</strong> dari{' '}
              <strong className="text-foreground">{filteredItems.length}</strong> mutasi
            </span>
            {hasActiveFilters && (
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 font-medium">
                Filter Aktif
              </span>
            )}
          </div>

          {/* Page size selector */}
          <div className="flex items-center gap-2 text-xs">
            <span className="text-muted-foreground">Baris per halaman:</span>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="px-2 py-1 text-xs rounded-lg border border-border bg-background focus:outline-none"
            >
              <option value="10">10</option>
              <option value="15">15</option>
              <option value="25">25</option>
              <option value="50">50</option>
              <option value="-1">Semua ({filteredItems.length})</option>
            </select>
          </div>
        </div>

        {/* Scrollable Table Area */}
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left border-collapse">
            {/* Top Multi-Header: Column Groups */}
            <thead>
              <tr className="border-b border-border bg-muted/60 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                <th colSpan={4} className="py-2 px-3 border-r border-border text-center bg-blue-500/5 text-blue-600 dark:text-blue-400">
                  1. Identitas &amp; Unit Penerima
                </th>
                <th colSpan={5} className="py-2 px-3 border-r border-border text-center bg-purple-500/5 text-purple-600 dark:text-purple-400">
                  2. Logistik Gudang (TTB)
                </th>
                <th colSpan={5} className="py-2 px-3 border-r border-border text-center bg-emerald-500/5 text-emerald-600 dark:text-emerald-400">
                  3. Pengantaran Tim Lapangan
                </th>
                <th colSpan={4} className="py-2 px-3 text-center bg-amber-500/5 text-amber-600 dark:text-amber-400">
                  4. Tutup Siklus (Ke Purchasing)
                </th>
              </tr>

              {/* Bottom Column Headers */}
              <tr className="border-b border-border bg-muted/40 text-[11px] font-semibold text-muted-foreground">
                {/* 1. Identitas */}
                <th
                  onClick={() => handleSort('no')}
                  className="py-3 px-3 text-center w-12 cursor-pointer hover:text-foreground select-none"
                >
                  <div className="inline-flex items-center gap-1 justify-center">
                    <span>No</span>
                    <ArrowUpDown className="size-3 text-muted-foreground/60" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort('pt')}
                  className="py-3 px-3 cursor-pointer hover:text-foreground select-none"
                >
                  <div className="inline-flex items-center gap-1">
                    <span>PT</span>
                    <ArrowUpDown className="size-3 text-muted-foreground/60" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort('deptArmada')}
                  className="py-3 px-3 min-w-[150px] cursor-pointer hover:text-foreground select-none"
                >
                  <div className="inline-flex items-center gap-1">
                    <span>Dept / Armada</span>
                    <ArrowUpDown className="size-3 text-muted-foreground/60" />
                  </div>
                </th>
                <th className="py-3 px-3 min-w-[110px] border-r border-border">
                  <span>No. FPB</span>
                </th>

                {/* 2. Logistik TTB */}
                <th className="py-3 px-3 min-w-[110px]">
                  <span>No. TTB</span>
                </th>
                <th
                  onClick={() => handleSort('picTtb')}
                  className="py-3 px-3 cursor-pointer hover:text-foreground select-none"
                >
                  <div className="inline-flex items-center gap-1">
                    <span>PIC TTB</span>
                    <ArrowUpDown className="size-3 text-muted-foreground/60" />
                  </div>
                </th>
                <th className="py-3 px-3 whitespace-nowrap">
                  <span>Tgl Input TTB</span>
                </th>
                <th className="py-3 px-3 whitespace-nowrap">
                  <span>Ke Tim Lapangan</span>
                </th>
                <th className="py-3 px-3 min-w-[150px] border-r border-border">
                  <span>Keterangan Stok</span>
                </th>

                {/* 3. Tim Lapangan */}
                <th
                  onClick={() => handleSort('picLapangan')}
                  className="py-3 px-3 cursor-pointer hover:text-foreground select-none"
                >
                  <div className="inline-flex items-center gap-1">
                    <span>PIC Lapangan</span>
                    <ArrowUpDown className="size-3 text-muted-foreground/60" />
                  </div>
                </th>
                <th className="py-3 px-3 whitespace-nowrap">
                  <span>Tgl Diantar</span>
                </th>
                <th className="py-3 px-3 min-w-[130px]">
                  <span>Ket. Antar / Lokasi</span>
                </th>
                <th className="py-3 px-3 whitespace-nowrap">
                  <span>Fisik Balik ke TTB</span>
                </th>
                <th className="py-3 px-2 text-center border-r border-border">
                  <span>Lapse</span>
                </th>

                {/* 4. Tutup Siklus Purchasing */}
                <th className="py-3 px-3 whitespace-nowrap">
                  <span>TTB ke PIC PCH</span>
                </th>
                <th className="py-3 px-3 min-w-[120px]">
                  <span>Ket. PCH</span>
                </th>
                <th className="py-3 px-2 text-center">
                  <span>Lapse</span>
                </th>
                <th className="py-3 px-3 text-center">
                  <span>Status Alur</span>
                </th>
              </tr>
            </thead>

            {/* Table Body */}
            <tbody className="divide-y divide-border">
              {paginatedItems.length === 0 ? (
                <tr>
                  <td colSpan={18} className="py-12 text-center text-muted-foreground">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <AlertCircle className="size-8 text-muted-foreground/50" />
                      <p className="text-sm font-medium">Tidak ada data mutasi yang cocok dengan filter.</p>
                      <button
                        type="button"
                        onClick={handleResetFilters}
                        className="text-xs text-primary hover:underline mt-1"
                      >
                        Reset semua filter
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedItems.map((item, idx) => {
                  const ptStyle = PT_COLORS[item.pt] || {
                    bg: 'bg-muted',
                    text: 'text-foreground',
                    border: 'border-border',
                  };

                  const isTerkirim = item.tglBarangDiantar && item.tglBarangDiantar !== '-' && item.tglBarangDiantar !== '/';
                  const isKembaliTtb = item.tglTimLapKePicTtb && item.tglTimLapKePicTtb !== '-' && item.tglTimLapKePicTtb !== '/';
                  const isTutupPch = item.tglTtbKePicPch && item.tglTtbKePicPch !== '-' && item.tglTtbKePicPch !== '/';

                  return (
                    <tr
                      key={`${item.no}-${item.ttb}-${idx}`}
                      className="hover:bg-muted/40 transition-colors"
                    >
                      {/* 1. No */}
                      <td className="py-2.5 px-3 text-center font-mono text-muted-foreground">
                        {item.no}
                      </td>

                      {/* 2. PT */}
                      <td className="py-2.5 px-3">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold border ${ptStyle.bg} ${ptStyle.text} ${ptStyle.border}`}
                        >
                          {item.pt}
                        </span>
                      </td>

                      {/* 3. Dept / Armada */}
                      <td className="py-2.5 px-3">
                        <div className="flex items-center gap-1.5 font-semibold text-foreground">
                          <Ship className="size-3.5 text-muted-foreground shrink-0" />
                          <span>{item.deptArmada}</span>
                        </div>
                      </td>

                      {/* 4. No. FPB */}
                      <td className="py-2.5 px-3 border-r border-border">
                        {item.noFpb ? (
                          <div className="inline-flex items-center gap-1">
                            <span className="font-mono font-medium text-foreground bg-muted/60 px-1.5 py-0.5 rounded text-[11px]">
                              {item.noFpb}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleCopy(item.noFpb, `fpb-${item.no}`)}
                              className="text-muted-foreground hover:text-foreground p-0.5 rounded cursor-pointer"
                              title="Salin No FPB"
                            >
                              {copiedKey === `fpb-${item.no}` ? (
                                <Check className="size-3 text-emerald-500" />
                              ) : (
                                <Copy className="size-3" />
                              )}
                            </button>
                          </div>
                        ) : (
                          <span className="text-[10px] text-muted-foreground/70 italic px-1.5 py-0.5 rounded bg-muted/30">
                            Mutasi Langsung
                          </span>
                        )}
                      </td>

                      {/* 5. No. TTB */}
                      <td className="py-2.5 px-3">
                        <div className="inline-flex items-center gap-1">
                          <span className="font-mono font-bold text-primary">
                            {item.ttb || '-'}
                          </span>
                          {item.ttb && (
                            <button
                              type="button"
                              onClick={() => handleCopy(item.ttb, `ttb-${item.no}`)}
                              className="text-muted-foreground hover:text-foreground p-0.5 rounded cursor-pointer"
                              title="Salin No TTB"
                            >
                              {copiedKey === `ttb-${item.no}` ? (
                                <Check className="size-3 text-emerald-500" />
                              ) : (
                                <Copy className="size-3" />
                              )}
                            </button>
                          )}
                        </div>
                      </td>

                      {/* 6. PIC TTB */}
                      <td className="py-2.5 px-3">
                        {item.picTtb ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
                            {item.picTtb}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </td>

                      {/* 7. Tgl Input TTB */}
                      <td className="py-2.5 px-3 whitespace-nowrap text-muted-foreground">
                        {item.tglInputTtb || '-'}
                      </td>

                      {/* 8. Tgl ke Tim Lapangan */}
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        {item.tglKeTimLapangan ? (
                          <span className="font-medium text-foreground">{item.tglKeTimLapangan}</span>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </td>

                      {/* 9. Keterangan Stok */}
                      <td className="py-2.5 px-3 border-r border-border">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-muted text-foreground">
                          <Tag className="size-3 text-muted-foreground" />
                          <span>{item.keterangan || 'STOCK GAJ'}</span>
                        </span>
                      </td>

                      {/* 10. PIC Lapangan */}
                      <td className="py-2.5 px-3">
                        {item.picLapangan ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                            <Truck className="size-3" />
                            <span>{item.picLapangan}</span>
                          </span>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </td>

                      {/* 11. Tgl Barang Diantar */}
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        {isTerkirim ? (
                          <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-semibold">
                            <CheckCircle2 className="size-3 text-emerald-500" />
                            <span>{item.tglBarangDiantar}</span>
                          </span>
                        ) : (
                          <span className="text-muted-foreground italic">Menunggu antaran</span>
                        )}
                      </td>

                      {/* 12. Keterangan Antar / Lokasi */}
                      <td className="py-2.5 px-3">
                        {item.keteranganAntar ? (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-500/10 text-blue-600 dark:text-blue-400">
                            {item.keteranganAntar}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </td>

                      {/* 13. Tgl Tim Lap ke PIC TTB */}
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        {isKembaliTtb ? (
                          <span className="text-foreground font-medium">{item.tglTimLapKePicTtb}</span>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </td>

                      {/* 14. Lapse Lapangan */}
                      <td className="py-2.5 px-2 text-center border-r border-border text-muted-foreground font-mono">
                        {item.lapseDay2 || '-'}
                      </td>

                      {/* 15. Tgl TTB ke PIC PCH */}
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        {isTutupPch ? (
                          <span className="text-indigo-600 dark:text-indigo-400 font-semibold">
                            {item.tglTtbKePicPch}
                          </span>
                        ) : (
                          <span className="text-[10px] text-amber-600 dark:text-amber-400 font-medium">
                            Menunggu Arsip PCH
                          </span>
                        )}
                      </td>

                      {/* 16. Keterangan PCH */}
                      <td className="py-2.5 px-3 text-muted-foreground">
                        {item.keteranganPch || '-'}
                      </td>

                      {/* 17. Lapse Hari 3 */}
                      <td className="py-2.5 px-2 text-center text-muted-foreground font-mono">
                        {item.lapseDay3 && item.lapseDay3 !== '/' ? item.lapseDay3 : '-'}
                      </td>

                      {/* 18. Status Alur Badge */}
                      <td className="py-2.5 px-3 text-center whitespace-nowrap">
                        {isTutupPch ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
                            <CheckCircle2 className="size-3" />
                            Selesai Siklus
                          </span>
                        ) : isKembaliTtb ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-teal-500/10 text-teal-600 dark:text-teal-400 border border-teal-500/20">
                            <CheckCircle2 className="size-3" />
                            Fisik di TTB
                          </span>
                        ) : isTerkirim ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                            <Truck className="size-3" />
                            Terkirim Kapal
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                            <Clock className="size-3" />
                            Dalam Proses
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Table Pagination Footer */}
        {sortedItems.length > 0 && pageSize !== -1 && (
          <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 border-t border-border bg-muted/20">
            <span className="text-xs text-muted-foreground">
              Halaman <strong className="text-foreground">{currentPage}</strong> dari{' '}
              <strong className="text-foreground">{totalPages}</strong> (Total{' '}
              <strong className="text-foreground">{sortedItems.length}</strong> baris)
            </span>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setCurrentPage(1)}
                disabled={currentPage <= 1}
                className="p-1.5 rounded-lg border border-border bg-background hover:bg-muted text-foreground disabled:opacity-40 transition cursor-pointer"
                title="Halaman Pertama"
              >
                <ChevronsLeft className="size-4" />
              </button>
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage <= 1}
                className="p-1.5 rounded-lg border border-border bg-background hover:bg-muted text-foreground disabled:opacity-40 transition cursor-pointer"
                title="Halaman Sebelumnya"
              >
                <ChevronLeft className="size-4" />
              </button>

              <span className="px-3 py-1 text-xs font-semibold rounded-lg bg-primary/10 text-primary">
                {currentPage} / {totalPages}
              </span>

              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage >= totalPages}
                className="p-1.5 rounded-lg border border-border bg-background hover:bg-muted text-foreground disabled:opacity-40 transition cursor-pointer"
                title="Halaman Berikutnya"
              >
                <ChevronRight className="size-4" />
              </button>
              <button
                type="button"
                onClick={() => setCurrentPage(totalPages)}
                disabled={currentPage >= totalPages}
                className="p-1.5 rounded-lg border border-border bg-background hover:bg-muted text-foreground disabled:opacity-40 transition cursor-pointer"
                title="Halaman Terakhir"
              >
                <ChevronsRight className="size-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

